const roleManagementUiModule = {
  ROLE_STATE_DEFAULT: '默',
  ROLE_STATE_ACTIVE: '活',
  ROLE_STATE_USER_CONTROL: '用',
  ROLE_STATE_UPDATE: '更',

  init: () => {

  },

  updateRoleButtonsList: () => {
    const frag = document.createDocumentFragment();
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!chatroomDetails || !chatroomDetails.config.name || !activePartition) {
      elementsModule.roleButtonsListContainer.innerHTML = '';
      return;
    }

    const roleAliases = activePartition.roleAliases || [];
    const permanentRoles = new Set((chatroomDetails.roles || []).map(r => r.name));

    const usedChars = new Set();
    const roleDataForButtons = roleAliases.map(aliasEntry => {
      const name = aliasEntry.name;
      const alias = aliasEntry.alias || name;
      const isTemporary = !permanentRoles.has(name);

      let charToUse = '';
      if (alias && alias.length > 0) {
        const aliasUpper = alias.toUpperCase();
        let foundChar = false;
        for (let i = 0; i < Math.ceil(aliasUpper.length / 2); i++) {
          const tailChar = aliasUpper[aliasUpper.length - 1 - i];
          if (tailChar && !usedChars.has(tailChar)) {
            charToUse = tailChar;
            foundChar = true;
            break;
          }

          const headChar = aliasUpper[i];
          if (headChar && headChar !== tailChar && !usedChars.has(headChar)) {
            charToUse = headChar;
            foundChar = true;
            break;
          }
        }

        if (!foundChar) {
          let fallbackChar = aliasUpper[0] + '2';
          let i = 2;
          while (usedChars.has(fallbackChar)) {
            fallbackChar = aliasUpper[0] + ++i;
          }
          charToUse = fallbackChar;
        }
      } else {
        charToUse = name.charAt(0).toUpperCase();
      }

      usedChars.add(charToUse);

      return {
        name,
        alias,
        char: charToUse,
        isTemporary,
        state: aliasEntry.state || roleManagementUiModule.ROLE_STATE_DEFAULT,
      };
    });

    roleDataForButtons.forEach(({
      name,
      alias,
      char,
      isTemporary,
      state
    }) => {
      const cont = document.createElement('div');
      cont.className = 'role-button-container';
      const btn = document.createElement('div');
      btn.className = 'std-button';
      btn.textContent = char;
      btn.dataset.roleName = name;

      btn.classList.add(isTemporary ? 'role-temporary' : 'role-permanent');

      if (state === roleManagementUiModule.ROLE_STATE_ACTIVE) {
        btn.classList.add('role-state-active-bg');
      } else if (state === roleManagementUiModule.ROLE_STATE_USER_CONTROL) {
        btn.classList.add('role-state-user-bg');
      }

      cont.appendChild(btn);
      const statesDiv = document.createElement('div');
      statesDiv.className = 'role-state-buttons';
      statesDiv.dataset.roleName = name;
      const statesToShowInPopup = [roleManagementUiModule.ROLE_STATE_DEFAULT, roleManagementUiModule.ROLE_STATE_ACTIVE, roleManagementUiModule.ROLE_STATE_USER_CONTROL, roleManagementUiModule.ROLE_STATE_UPDATE];
      statesToShowInPopup.forEach(s => {
        const sBtn = document.createElement('div');
        sBtn.className = 'std-button role-state-button';
        sBtn.textContent = s;
        sBtn.dataset.roleName = name;
        sBtn.dataset.state = s;
        statesDiv.appendChild(sBtn);
      });
      cont.appendChild(statesDiv);
      frag.appendChild(cont);
    });

    elementsModule.roleButtonsListContainer.innerHTML = '';
    elementsModule.roleButtonsListContainer.appendChild(frag);
    const roleButtonContainers = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container');
    roleButtonContainers.forEach(container => {
      const mainButton = container.querySelector('.std-button:not(.role-state-button)');
      const stateButtons = container.querySelectorAll('.role-state-button');
      const roleName = mainButton.dataset.roleName;
      const roleInfo = roleDataForButtons.find(r => r.name === roleName);
      const roleIsTemporary = roleInfo ? roleInfo.isTemporary : false;
      const mainShortPress = () => roleManagementUiModule.toggleRoleStateButtons(roleName);

      const mainLongPress = () => {
        const targetPageId = 'role-detail-page';
        const targetContextData = roleName;
        if (!elementsModule.settingsPanel.classList.contains('active')) {
          settingsPageManagerModule.toggleSettings(targetPageId, targetContextData);
        } else {
          settingsPageManagerModule.showSection(targetPageId, targetContextData);
        }
        if (stateModule.isRoleListVisible) systemTriggersModule.toggleRoleList();
        roleManagementUiModule.hideRoleStateButtons();
      };

      eventListenersModule._setupLongPressListener(mainButton, mainShortPress, mainLongPress, false);
      stateButtons.forEach(sBtn => {
        const state = sBtn.dataset.state;
        const isDisabled = sBtn.classList.contains('edit-disabled');
        const stateShortPress = isDisabled ? null : () => roleManagementUiModule.selectRoleState(roleName, state);
        let stateLongPress = null;
        if (!isDisabled && state === roleManagementUiModule.ROLE_STATE_UPDATE) {
          stateLongPress = () => systemTriggersModule._handleBulkUpdateTrigger();
        } else if (!isDisabled && state === roleManagementUiModule.ROLE_STATE_USER_CONTROL) {
          stateLongPress = () => {
            roleManagementUiModule.createAndEditMessageForRole(roleName);
            roleManagementUiModule.hideRoleStateButtons();
          };
        } else if (!isDisabled && state === roleManagementUiModule.ROLE_STATE_DEFAULT && roleIsTemporary) {
          stateLongPress = () => roleManagementUiModule.deleteTemporaryRole(roleName, true);
        } else if (!isDisabled && state === roleManagementUiModule.ROLE_STATE_DEFAULT && !roleIsTemporary) {
          stateLongPress = () => roleManagementUiModule.handleRoleDefaultStateLongPress(roleName);
        } else if (!isDisabled && state === roleManagementUiModule.ROLE_STATE_ACTIVE) {
          stateLongPress = () => roleManagementUiModule.handleActivateButtonLongPress(roleName);
        }
        eventListenersModule._setupLongPressListener(sBtn, stateShortPress, stateLongPress, false);
      });
    });
    roleDataForButtons.forEach(({
      name
    }) => {
      roleManagementUiModule.updateRoleStateButtonVisual(name);
    });
    systemTriggersModule.updateModelToggleButtonVisual();
    systemTriggersModule.updateAutoTriggerButtonVisual();
  },

  removeRoleButton: (roleName) => {
    const buttonContainer = document.querySelector(`.role-button-container .std-button[data-role-name="${roleName}"]`)?.closest('.role-button-container');
    if (buttonContainer) {
      buttonContainer.remove();
    }
  },

  toggleRoleStateButtons: (name) => {
    const div = document.querySelector(`.role-state-buttons[data-role-name="${name}"]`);
    if (div) {
      if (stateModule.activeRoleStateButtons === name) {
        div.classList.remove('active');
        stateModule.activeRoleStateButtons = null;
      } else {
        roleManagementUiModule.hideRoleStateButtons();
        div.classList.add('active');
        stateModule.activeRoleStateButtons = name;
      }
    }
  },

  hideRoleStateButtons: () => {
    document.querySelectorAll('.role-state-buttons.active').forEach(el => el.classList.remove('active'));
    stateModule.activeRoleStateButtons = null;
  },

  selectRoleState: async (name, state) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition || !activePartition.roleAliases) return;

    if (state === roleManagementUiModule.ROLE_STATE_UPDATE) {
      const isPermanent = chatroomDetails.roles.some(r => r.name === name);
      let initiatorMessageIdForUpdate = null;
      if (activePartition.history && activePartition.history.length > 0) {
        initiatorMessageIdForUpdate = activePartition.history[activePartition.history.length - 1].id;
      } else {
        initiatorMessageIdForUpdate = stateModule.activePartitionId;
      }

      if (!initiatorMessageIdForUpdate) {
        _logAndDisplayError(`Cannot trigger CharacterUpdate for ${name}: initiatorMessageId could not be determined for partition ${stateModule.activePartitionId}.`, 'roleManagementUiModule.selectRoleState');
        return;
      }

      if (!isPermanent) {
        const newRoleData = {
          ...defaultRoleData,
          name
        };
        transactionManagerModule.dispatch('CREATE_ROLE', {
          chatroomName: chatroomDetails.config.name,
          roleData: newRoleData,
          onSuccess: () => {
            apiMainTriggerModule.triggerCharacterUpdateForRole(stateModule.activePartitionId, name);
          },
          onFailure: () => {
            alert(`创建永久角色文件失败，无法更新角色 ${name}`);
          }
        });
      } else {
        apiMainTriggerModule.triggerCharacterUpdateForRole(stateModule.activePartitionId, name);
      }
    } else {
      const newRoleAliases = activePartition.roleAliases.map(alias => {
        if (alias.name === name) {
          return { ...alias,
            state: state
          };
        }
        return alias;
      });
      transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: chatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        updates: {
          roleAliases: newRoleAliases
        }
      });
    }
    if (typeof partitionListManagerModule !== 'undefined') partitionListManagerModule.updatePartitionList();
  },

  handleRoleDefaultStateLongPress: (roleName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config) {
      return;
    }
    const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
    if (!isPermanent || roleName === "用户") return;

    const activePartition = chatroomDetails.partitions.get(stateModule.activePartitionId);
    if (activePartition && activePartition.roleAliases) {
      const newRoleAliases = activePartition.roleAliases.filter(alias => alias.name !== roleName);
      transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: chatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        updates: {
          roleAliases: newRoleAliases
        }
      });
      roleManagementUiModule.hideRoleStateButtons();
    }
  },

  updateRoleStateButtonVisual: (name) => {
    const stateButtonsDiv = document.querySelector(`.role-state-buttons[data-role-name="${name}"]`);
    const mainButton = document.querySelector(`.role-button-container .std-button[data-role-name="${name}"]:not(.role-state-button)`);
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);

    if (activePartition && activePartition.roleAliases) {
      const roleAlias = activePartition.roleAliases.find(alias => alias.name === name);
      const currentState = roleAlias ? roleAlias.state : roleManagementUiModule.ROLE_STATE_DEFAULT;

      if (stateButtonsDiv) {
        stateButtonsDiv.childNodes.forEach(btn => {
          if (btn.classList?.contains('role-state-button')) {
            btn.classList.remove('role-state-active');
            if (btn.dataset.state === currentState) {
              btn.classList.add('role-state-active');
            }
          }
        });
      }

      if (mainButton) {
        mainButton.classList.remove('role-state-active-bg', 'role-state-user-bg');
        if (currentState === roleManagementUiModule.ROLE_STATE_ACTIVE) {
          mainButton.classList.add('role-state-active-bg');
        } else if (currentState === roleManagementUiModule.ROLE_STATE_USER_CONTROL) {
          mainButton.classList.add('role-state-user-bg');
        }
      }
    }
  },

  createAndEditMessageForRole: async (roleName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) {
      _logAndDisplayError("请先选择一个激活的分区。", "roleManagementUiModule.createAndEditMessageForRole");
      return;
    }
    const roleAlias = (activePartition.roleAliases || []).find(alias => alias.name === roleName);
    if (!roleAlias) {
      _logAndDisplayError(`角色 "${roleName}" 不在当前分区。`, "roleManagementUiModule.createAndEditMessageForRole");
      return;
    }
    const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
    const roleType = isPermanent ? 'role' : 'temporary_role';
    const msgId = uiChatUtilsModule._generateMessageId();
    const timestamp = Date.now();
    const messageObject = {
      id: msgId,
      timestamp: timestamp,
      sourceType: 'user',
      roleName: roleName,
      roleType: roleType,
      targetRoleName: null,
      speechActionText: '',
      rawJson: null,
      displayMode: 'formatted',
      parserError: null,
      status: 'completed',
      activeView: 'none',
      statusProcessingSystemResult: null,
      statusProcessingSystemError: null,
      statusProcessingSystemParserError: null,
      drawingMasterResult: null,
      drawingMasterError: null,
      drawingMasterContext: null,
    };

    await transactionManagerModule.dispatch('ADD_HISTORY_MESSAGE', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        message: messageObject
    });

    const partitionContainer = stateModule.partitionDOMCache.get(stateModule.activePartitionId);
    const newElement = partitionContainer ? partitionContainer.querySelector(`.message-container[data-message-id="${msgId}"]`) : null;

    if (newElement && typeof uiMessageEditorModule !== 'undefined') {
      uiMessageEditorModule.startEdit(newElement);
    }
  },

  createAdminMessage: async () => {
    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) {
      _logAndDisplayError("请先选择一个激活的分区。", "roleManagementUiModule.createAdminMessage");
      return;
    }
    const adminRoleName = '用户';
    const msgId = uiChatUtilsModule._generateMessageId();
    const timestamp = Date.now();
    const messageObject = {
      id: msgId,
      timestamp: timestamp,
      sourceType: 'user',
      roleName: adminRoleName,
      roleType: 'temporary_role',
      targetRoleName: null,
      speechActionText: '',
      rawJson: null,
      displayMode: 'formatted',
      parserError: null,
      status: 'completed',
      activeView: 'none',
      statusProcessingSystemResult: null,
      statusProcessingSystemError: null,
      statusProcessingSystemParserError: null,
      drawingMasterResult: null,
      drawingMasterError: null,
      drawingMasterContext: null,
    };

    await transactionManagerModule.dispatch('ADD_HISTORY_MESSAGE', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        message: messageObject
    });

    const partitionContainer = stateModule.partitionDOMCache.get(stateModule.activePartitionId);
    const newElement = partitionContainer ? partitionContainer.querySelector(`.message-container[data-message-id="${msgId}"]`) : null;

    if (newElement && typeof uiMessageEditorModule !== 'undefined') {
      uiMessageEditorModule.startEdit(newElement);
    }
  },

  addTemporaryRole: async (roleName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) {
      _logAndDisplayError("添加失败：没有激活的分区。", 'roleManagementUiModule.addTemporaryRole');
      return false;
    }
    if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
      _logAndDisplayError("添加失败：名称不能为空。", 'roleManagementUiModule.addTemporaryRole');
      return false;
    }
    const trimmedName = roleName.trim();
    if ((activePartition.roleAliases || []).some(alias => alias.name === trimmedName)) {
      _logAndDisplayError(`添加失败：名称 "${trimmedName}" 已存在于当前分区。`, 'roleManagementUiModule.addTemporaryRole');
      return false;
    }

    const newRoleAliases = [
      ...(activePartition.roleAliases || []), {
        name: trimmedName,
        alias: "",
        state: roleManagementUiModule.ROLE_STATE_ACTIVE,
        detailedState: ""
      }
    ];

    transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
      chatroomName: chatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      updates: {
        roleAliases: newRoleAliases
      }
    });
    return true;
  },

  deleteTemporaryRole: async (roleName, confirmDeletion = true) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const currentPartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!currentPartition) {
      _logAndDisplayError("删除失败：没有激活的分区。", 'roleManagementUiModule.deleteTemporaryRole');
      return false;
    }
    if (roleName === "用户") {
      _logAndDisplayError("不能删除用户角色。", 'roleManagementUiModule.deleteTemporaryRole');
      return false;
    }
    const isPermanent = (chatroomDetails.roles || []).some(r => r.name === roleName);
    if (isPermanent) {
      _logAndDisplayError(`删除失败：角色 "${roleName}" 不是临时角色。`, 'roleManagementUiModule.deleteTemporaryRole');
      return false;
    }

    let partitionsToUpdate = [currentPartition];
    if (currentPartition.allowCrossPartitionHistoryAccess) {
      partitionsToUpdate = Array.from(stateModule.currentChatroomDetails.partitions.values())
        .filter(p => p.allowCrossPartitionHistoryAccess);
    }

    for (const p of partitionsToUpdate) {
      const roleExists = (p.roleAliases || []).some(alias => alias.name === roleName);
      if (roleExists) {
        const newRoleAliases = (p.roleAliases || []).filter(alias => alias.name !== roleName);
        await transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
          chatroomName: chatroomDetails.config.name,
          partitionId: p.id,
          updates: {
            roleAliases: newRoleAliases
          }
        });
      }
    }
    return true;
  },

  handleUserControlTriggerClick: () => {
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (!activePartition || !activePartition.roleAliases) {
      return;
    }

    const userControlRoles = activePartition.roleAliases
      .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_USER_CONTROL)
      .map(alias => alias.name);

    if (userControlRoles.length === 0) {
      return;
    }
    let targetRoleName = null;
    if (userControlRoles.length === 1) {
      targetRoleName = userControlRoles[0];
    } else {
      const history = activePartition.history;
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (userControlRoles.includes(msg.roleName)) {
          targetRoleName = msg.roleName;
          break;
        }
      }
      if (!targetRoleName) {
        targetRoleName = userControlRoles[0];
      }
    }
    if (targetRoleName) {
      roleManagementUiModule.createAndEditMessageForRole(targetRoleName);
    }
  },

  handleActivateButtonLongPress: async (roleName) => {
    let initiatorMessageId = null;
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (activePartition && activePartition.history && activePartition.history.length > 0) {
      initiatorMessageId = activePartition.history[activePartition.history.length - 1].id;
    } else {
      initiatorMessageId = stateModule.activePartitionId;
    }
    if (!initiatorMessageId) {
      _logAndDisplayError(`Cannot activate role ${roleName}: initiatorMessageId could not be determined for partition ${stateModule.activePartitionId}.`, 'roleManagementUiModule.handleActivateButtonLongPress');
      roleManagementUiModule.hideRoleStateButtons();
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, roleName, null, {
      initiatorMessageId
    }, true);
  },
};