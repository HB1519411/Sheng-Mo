const systemTriggersModule = {
  init: () => {
    if (elementsModule.autoTriggerButton) {
      eventListenersModule._setupLongPressListener(
        elementsModule.autoTriggerButton,
        () => {
          if (stateModule.isCooldownActive) return;
          const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
          if (activePartition) {
            const newValue = !activePartition.autoTriggerNextCharacter;
            transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
              chatroomName: stateModule.currentChatroomDetails.config.name,
              partitionId: stateModule.activePartitionId,
              updates: {
                autoTriggerNextCharacter: newValue
              }
            });
            elementsModule.autoTriggerButton.textContent = newValue ? '>>' : '||';
          }
        },
        () => {
          if (stateModule.isCooldownActive && elementsModule.autoTriggerButton !== elementsModule.runPauseButton) return;
          const activeChatRoomName = stateModule.config.activeChatRoomName;
          const activePartitionId = stateModule.activePartitionId;
          if (!activeChatRoomName || !activePartitionId) return;
          const chatroomDetails = stateModule.currentChatroomDetails;
          if (!chatroomDetails || !chatroomDetails.config || chatroomDetails.config.name !== activeChatRoomName) return;
          const partition = chatroomDetails.partitions.get(activePartitionId);
          if (!partition) return;

          if (!confirm(`确定要重置当前分区 "${partition.name}" 吗？`)) {
            return;
          }

          let updates = {};
          updates.script = '';
          if (partition.history && Array.isArray(partition.history) && partition.history.length > 0) {
            const firstMessageId = partition.history[0].id;
            transactionManagerModule.dispatch('DELETE_HISTORY_FROM', {
              chatroomName: activeChatRoomName,
              partitionId: activePartitionId,
              messageId: firstMessageId
            }).then(() => {
              const partitionContainer = stateModule.partitionDOMCache.get(activePartitionId);
              if (partitionContainer) {
                partitionContainer.innerHTML = '';
              }
            });
          }

          const permanentRoleNames = new Set((chatroomDetails.roles || []).map(r => r.name));
          permanentRoleNames.add("用户");

          let newRoleAliases = [...(partition.roleAliases || [])];
          let aliasesChanged = false;

          newRoleAliases = newRoleAliases.filter(alias => permanentRoleNames.has(alias.name));
          if (newRoleAliases.length !== (partition.roleAliases || []).length) {
            aliasesChanged = true;
          }

          if (aliasesChanged) {
            updates.roleAliases = newRoleAliases;
          }

          transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
            chatroomName: activeChatRoomName,
            partitionId: activePartitionId,
            updates
          });

          roleManagementUiModule.hideRoleStateButtons();
          roleManagementUiModule.updateRoleButtonsList();
        },
        false
      );
    }

    eventListenersModule._setupLongPressListener(
      elementsModule.runPauseButton,
      () => {
        const triggerList = elementsModule.activeRoleTriggerList;
        if (triggerList && triggerList.style.display === 'flex') {
          triggerList.style.display = 'none';
          return;
        }

        if (stateModule.editingMessageContainer && typeof uiMessageEditorModule !== 'undefined') {
          uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
        }
        systemTriggersModule._triggerStatusProcessingSystemIfNeeded(stateModule.activePartitionId);
        systemTriggersModule._triggerActiveRoles(stateModule.activePartitionId);
      },
      () => {
        if (stateModule.editingMessageContainer && typeof uiMessageEditorModule !== 'undefined') {
          uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
        }
        const privateAssistantEnabled = stateModule.config.toolSettings.privateAssistant?.enabled;
        if (privateAssistantEnabled) {
          apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'privateAssistant', null, null, false);
        } else {
          _logAndDisplayError("Cannot trigger tool: Private Assistant is not enabled.", "runPauseButtonLongPress");
        }
      },
      false
    );

    if (elementsModule.userControlTriggerButton) {
      const userControlShortPress = () => {
        if (stateModule.isCooldownActive) return;
        roleManagementUiModule.handleUserControlTriggerClick();
      };
      const userControlLongPress = () => {
        if (stateModule.isCooldownActive) return;
        if (stateModule.editingMessageContainer && typeof uiMessageEditorModule !== 'undefined') {
          uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
        }
        const knowledgeMasterEnabled = stateModule.config.toolSettings.knowledgeRecordingMaster?.enabled;
        if (knowledgeMasterEnabled) {
          apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'knowledgeRecordingMaster');
        } else {
          _logAndDisplayError("Cannot trigger tool: Knowledge Recording Master is not enabled.", "userControlTriggerButtonLongPress");
        }
      };
      eventListenersModule._setupLongPressListener(elementsModule.userControlTriggerButton, userControlShortPress, userControlLongPress, false);
    }
  },

  _triggerStatusProcessingSystemIfNeeded: (partitionId) => {
    const statusProcessingSystemEnabled = stateModule.config.toolSettings.statusProcessingSystem?.enabled;
    if (!statusProcessingSystemEnabled) return;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partition = chatroomDetails?.partitions.get(partitionId);
    if (!partition || !partition.history || partition.history.length === 0) {
      return;
    }
    let targetMessage = null;
    for (let i = partition.history.length - 1; i >= 0; i--) {
      const msg = partition.history[i];
      if (msg.sourceType === 'user' && msg.roleName !== '用户') {
        targetMessage = msg;
        break;
      }
    }
    if (targetMessage) {
      const hasStatus = targetMessage.statusProcessingSystemResult || targetMessage.statusProcessingSystemError;
      if (!hasStatus) {
        const placeholderStatus = {
          status: 'pending'
        };
        transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
          chatroomName: chatroomDetails.config.name,
          partitionId,
          messageId: targetMessage.id,
          updates: {
            statusProcessingSystemResult: placeholderStatus
          }
        });
        const summaryContextForSPS = {
          initiatorMessageId: `${targetMessage.id}_sps`,
          triggeringCharacterName: targetMessage.roleName
        };
        apiMainTriggerModule.sendSingleMessageForRoleImpl(partitionId, 'statusProcessingSystem', 'tool', null, targetMessage.roleName, summaryContextForSPS, true);
      }
    }
  },

  _triggerActiveRoles: (partitionId) => {
    const triggerList = elementsModule.activeRoleTriggerList;
    if (triggerList) triggerList.style.display = 'none';

    const partition = stateModule.currentChatroomDetails?.partitions?.get(partitionId);
    if (!partition || !partition.roleAliases) {
      return;
    }

    const activeAndUserRoles = partition.roleAliases
      .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE || alias.state === roleManagementUiModule.ROLE_STATE_USER_CONTROL);

    if (activeAndUserRoles.length > 0) {
      systemTriggersModule.showActiveRoleTriggerList(partitionId, activeAndUserRoles);
    }
  },

  toggleRoleList: (forceClose = false) => {
    if (forceClose) {
      stateModule.isRoleListVisible_temp = false;
    } else {
      stateModule.isRoleListVisible_temp = !stateModule.isRoleListVisible_temp;
    }

    elementsModule.roleButtonsListContainer.style.display = stateModule.isRoleListVisible_temp ? 'flex' : 'none';

    if (!stateModule.isRoleListVisible_temp) {
      roleManagementUiModule.hideRoleStateButtons();
    }
  },

  _handleBulkUpdateTrigger: async () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition || !activePartition.roleAliases) return;
    const permanentRoleNames = new Set((chatroomDetails.roles || []).map(r => r.name));
    const activePermanentRoles = activePartition.roleAliases
      .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE && permanentRoleNames.has(alias.name))
      .map(alias => alias.name);

    if (activePermanentRoles.length === 0) {
      roleManagementUiModule.hideRoleStateButtons();
      return;
    }
    for (const roleName of activePermanentRoles) {
      await new Promise(resolve => setTimeout(resolve, 0));
      apiMainTriggerModule.triggerCharacterUpdateForRole(stateModule.activePartitionId, roleName);
    }
    roleManagementUiModule.hideRoleStateButtons();
  },

  showActiveRoleTriggerList: (partitionId, activeRoleAliases) => {
    const listContainer = elementsModule.activeRoleTriggerList;
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const {
      roleNameMap
    } = uiChatUtilsModule.getRoleNameMaps(partitionId);

    activeRoleAliases.sort((a, b) => {
      if (a.state === roleManagementUiModule.ROLE_STATE_USER_CONTROL && b.state !== roleManagementUiModule.ROLE_STATE_USER_CONTROL) {
        return -1;
      }
      if (b.state === roleManagementUiModule.ROLE_STATE_USER_CONTROL && a.state !== roleManagementUiModule.ROLE_STATE_USER_CONTROL) {
        return 1;
      }
      return 0;
    });

    const triggerAction = (action) => {
      elementsModule.runPauseButton.textContent = '■';
      setTimeout(() => {
        elementsModule.runPauseButton.textContent = '▶';
      }, eventListenersModule._cooldownDuration);
      action();
    };

    const allRolesButton = document.createElement('div');
    allRolesButton.className = 'active-role-trigger-button';
    allRolesButton.textContent = '主持人';
    const allRolesShortPress = () => triggerAction(() => {
      apiMainTriggerModule.triggerRoleResponse(partitionId, 'gameHost', null, null, false);
    });
    const allRolesLongPress = async () => triggerAction(async () => {
      const activeRoleNames = activeRoleAliases.map(a => a.name);
      for (const roleName of activeRoleNames) {
        await new Promise(resolve => setTimeout(resolve, 0));
        apiMainTriggerModule.triggerRoleResponse(partitionId, roleName, null, null, true);
      }
    });
    eventListenersModule._setupLongPressListener(allRolesButton, allRolesShortPress, allRolesLongPress, false);
    listContainer.appendChild(allRolesButton);

    activeRoleAliases.forEach(alias => {
      const roleName = alias.name;
      const button = document.createElement('div');
      button.className = 'active-role-trigger-button';
      button.textContent = roleNameMap[roleName] || roleName;
      button.dataset.roleName = roleName;
      const roleShortPress = () => triggerAction(() => {
        apiMainTriggerModule.triggerRoleResponse(partitionId, roleName, null, null, false);
      });
      const roleLongPress = async () => triggerAction(async () => {
        const otherRoles = activeRoleAliases.map(a => a.name).filter(rn => rn !== roleName);
        for (const otherRoleName of otherRoles) {
          await new Promise(resolve => setTimeout(resolve, 0));
          apiMainTriggerModule.triggerRoleResponse(partitionId, otherRoleName, null, null, true);
        }
      });
      eventListenersModule._setupLongPressListener(button, roleShortPress, roleLongPress, false);
      listContainer.appendChild(button);
    });
    listContainer.style.display = 'flex';
  },

  updateModelToggleButtonVisual: () => {
    if (elementsModule.modelToggleButton) {
        const currentType = stateModule.config.generalModelSelectionType;
        if (currentType === 'primary') {
            elementsModule.modelToggleButton.textContent = '●';
        } else if (currentType === 'secondary') {
            elementsModule.modelToggleButton.textContent = '○';
        } else {
            elementsModule.modelToggleButton.textContent = '◎';
        }
    }
  },

  updateAutoTriggerButtonVisual: () => {
    if (elementsModule.autoTriggerButton) {
      const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
      const isAutoTriggerOn = activePartition?.autoTriggerNextCharacter || false;
      elementsModule.autoTriggerButton.textContent = isAutoTriggerOn ? '>>' : '||';
    }
  },
};