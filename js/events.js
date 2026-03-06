const eventListenersModule = {
  _longPressDelay: 250,
  _cooldownDuration: 200,

  _isFullscreen: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
  
  _requestFullscreen: async () => {
    const el = document.documentElement;
    try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch (e) {
    }
  },

  _exitFullscreen: () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  },

  _toggleFullscreen: () => eventListenersModule._isFullscreen() ? eventListenersModule._exitFullscreen() : eventListenersModule._requestFullscreen(),

  _activateCooldown: () => {
    clearTimeout(stateModule.cooldownTimer);
    stateModule.isCooldownActive = true;
    stateModule.cooldownTimer = setTimeout(() => {
      stateModule.isCooldownActive = false;
      stateModule.cooldownTimer = null;
    }, eventListenersModule._cooldownDuration);
  },

  _setupLongPressListener: (element, shortPressAction, longPressAction, allowScroll = false) => {
    let startX, startY, isMoved = false, longPressTimer = null, startEvent = null, longPressFired = false;

    const cleanup = (wasActionFired = false) => {
      clearTimeout(longPressTimer);
      longPressTimer = null; startEvent = null; isMoved = false; longPressFired = false;
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', cleanup);
      element.removeEventListener('pointerleave', handlePointerLeave);
      if (wasActionFired) eventListenersModule._activateCooldown();
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (stateModule.isCooldownActive) return;
      cleanup();
      startEvent = event; startX = event.clientX; startY = event.clientY;
      element.addEventListener('pointermove', handlePointerMove, { passive: true });
      element.addEventListener('pointerup', handlePointerUp);
      element.addEventListener('pointercancel', () => cleanup(false));
      element.addEventListener('pointerleave', handlePointerLeave);

      if (longPressAction) {
        longPressTimer = setTimeout(() => {
          longPressAction(startEvent);
          longPressFired = true;
          longPressTimer = null;
          eventListenersModule._activateCooldown();
        }, eventListenersModule._longPressDelay);
      }
    };

    const handlePointerMove = (event) => {
      if (!startEvent) return;
      const dist = Math.max(Math.abs(event.clientX - startX), Math.abs(event.clientY - startY));
      if (dist > (allowScroll ? 20 : 10)) { isMoved = true; cleanup(false); }
    };

    const handlePointerUp = (event) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (!isMoved && !longPressFired && shortPressAction) { shortPressAction(startEvent || event); cleanup(true); } 
      else cleanup(longPressFired);
    };

    const handlePointerLeave = (event) => {
      const rect = element.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cleanup(false);
    };

    element.removeEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointerdown', handlePointerDown);
  },

  _setupSwipeListener: () => {
    let startX = 0, startY = 0, isTracking = false;
    elementsModule.chatArea.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || stateModule.isNovelInterfaceVisible || elementsModule.settingsPanel.classList.contains('active')) return;
      startX = e.clientX; startY = e.clientY; isTracking = true;
    }, { passive: true });

    elementsModule.chatArea.addEventListener('pointermove', (e) => {
      if (!isTracking || e.pointerType !== 'touch') return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (Math.abs(dx) > Math.abs(dy)) partitionListManagerModule.switchPartitionBySwipe(dx < 0 ? 'next' : 'previous');
        isTracking = false;
      }
    }, { passive: true });

    elementsModule.chatArea.addEventListener('pointerup', () => isTracking = false, { passive: true });
    elementsModule.chatArea.addEventListener('pointercancel', () => isTracking = false, { passive: true });
  },

  setupEventListeners: () => {
    settingsPageManagerModule.init();
    partitionListManagerModule.init();
    settingsApiModule.init();
    settingsPromptPresetsModule.init();
    settingsNovelaiModule.init();
    settingsErrorLogModule.init();
    settingsChatroomDirModule.init();
    settingsChatroomCurrentModule.init();
    settingsChatroomIdentityGroupsModule.init();
    settingsChatroomRolesModule.init();
    settingsChatroomNovelsModule.init();
    settingsEventsListModule.init();
    settingsKnowledgeBaseDirModule.init();
    settingsKnowledgeBaseEntriesModule.init();
    settingsRoleDetailModule.init();
    settingsRoleSettingDetailModule.init();
    settingsRoleMemoryListModule.init();
    settingsRolePublicInfoListModule.init();
    settingsToolListModule.init();
    roleManagementUiModule.init();
    apiResponseHandlerModule.init();
    systemTriggersModule.init();
    messageActionsImplModule.init();
    messageActionsDelegateModule.init();
    uiChatImageViewerModule.init();
    uiNovelMainModule.init();
    uiNovelBookshelfModule.init();
    uiNovelTocModule.init();
    uiNovelSummaryModule.init();
    uiNovelContentModule.init();
    partitionRendererModule.init();
    uiMessageEditorModule.init();

    eventListenersModule._setupLongPressListener(elementsModule.settingsIcon, 
      () => settingsPageManagerModule.toggleSettings(), 
      () => eventListenersModule._toggleFullscreen());

    eventListenersModule._setupLongPressListener(elementsModule.roleButton, 
      () => systemTriggersModule.toggleRoleList(), 
      () => settingsPageManagerModule.showSection('role-list-page'));

    eventListenersModule._setupLongPressListener(elementsModule.ruleButton, 
      () => partitionListManagerModule.togglePartitionList(), 
      () => settingsPageManagerModule.showSection('current-chatroom-settings-page', stateModule.config.activeChatRoomName));

    eventListenersModule._setupLongPressListener(elementsModule.novelButton, 
      () => uiNovelMainModule.novelUI_toggleNovelInterface(), 
      () => {
        if (stateModule.isCooldownActive) return;
        if (stateModule.config.toolSettings.scriptCreationMaster.enabled) {
          const pid = stateModule.activePartitionId;
          const hist = stateModule.currentChatroomDetails.partitions.get(pid).history;
          apiMainTriggerModule.triggerRoleResponse(pid, 'scriptCreationMaster', null, hist.length ? { initiatorMessageId: hist[hist.length-1].id } : null);
        } else {
          alert("剧本创作大师未启用");
        }
      });

    eventListenersModule._setupLongPressListener(elementsModule.modelToggleButton, 
      () => {
        if (stateModule.isCooldownActive) return;
        const next = { primary: 'secondary', secondary: 'tertiary', tertiary: 'primary' }[stateModule.config.generalModelSelectionType] || 'primary';
        transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { 'generalModelSelectionType': next } });
      }, 
      () => {
        if (stateModule.isCooldownActive) return;
        if (stateModule.config.toolSettings.characterCreationMaster.enabled) {
          const pid = stateModule.activePartitionId;
          const hist = stateModule.currentChatroomDetails.partitions.get(pid).history;
          apiMainTriggerModule.triggerRoleResponse(pid, 'characterCreationMaster', null, hist.length ? { initiatorMessageId: hist[hist.length-1].id } : null);
        } else {
          alert("角色创建大师未启用");
        }
      });

    eventListenersModule._setupLongPressListener(elementsModule.addAdminButton, 
      () => !stateModule.isCooldownActive && roleManagementUiModule.createAdminMessage(), 
      () => {
        if (!stateModule.isCooldownActive) {
          if (stateModule.config.toolSettings.plotSummaryMaster.enabled) {
            apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'plotSummaryMaster');
          } else {
            alert("情节总结大师未启用");
          }
        }
      });

    eventListenersModule._setupLongPressListener(elementsModule.autoTriggerButton, () => {
        const partition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
        const newVal = !partition.autoTriggerNextCharacter;
        transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
            chatroomName: stateModule.currentChatroomDetails.config.name,
            partitionId: stateModule.activePartitionId,
            updates: { autoTriggerNextCharacter: newVal }
        });
        elementsModule.autoTriggerButton.textContent = newVal ? '>>' : '||';
    }, () => {
        if (elementsModule.autoTriggerButton === elementsModule.runPauseButton) return; 
        const details = stateModule.currentChatroomDetails;
        const pid = stateModule.activePartitionId;
        
        if (!confirm(`重置分区 "${details.partitions.get(pid).name}"?`)) return;

        transactionManagerModule.dispatch('DELETE_HISTORY_FROM', {
            chatroomName: details.config.name, partitionId: pid, messageId: details.partitions.get(pid).history[0].id
        });
        
        const perms = new Set(details.roles.map(r => r.name)); perms.add("用户");
        const aliases = (details.partitions.get(pid).roleAliases || []).filter(a => perms.has(a.name));
        
        transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
            chatroomName: details.config.name, partitionId: pid,
            updates: { script: '', roleAliases: aliases }
        });
        roleManagementUiModule.hideRoleStateButtons();
    }, false);

    eventListenersModule._setupLongPressListener(elementsModule.runPauseButton, () => {
        const list = elementsModule.activeRoleTriggerList;
        if (list.style.display === 'flex') { list.style.display = 'none'; return; }
        
        if (stateModule.editingMessageContainer) uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
        systemTriggersModule._triggerStatusProcessingSystemIfNeeded(stateModule.activePartitionId);
        systemTriggersModule._triggerActiveRoles(stateModule.activePartitionId);
    }, () => {
        if (stateModule.editingMessageContainer) uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
        if (stateModule.config.toolSettings.privateAssistant.enabled) {
            apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'privateAssistant', null, null, false);
        }
    }, false);

    eventListenersModule._setupLongPressListener(elementsModule.userControlTriggerButton, 
        () => roleManagementUiModule.handleUserControlTriggerClick(), 
        () => {
            if (stateModule.editingMessageContainer) uiMessageEditorModule.saveEditedMessage(stateModule.editingMessageContainer);
            if (stateModule.config.toolSettings.knowledgeRecordingMaster.enabled) {
                apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'knowledgeRecordingMaster');
            }
        }, false);

    document.addEventListener('click', (e) => {
      if (stateModule.isCooldownActive && !e.target.closest('.std-button')) return;

      if (stateModule.isNovelInterfaceVisible && !elementsModule.novelInterface.contains(e.target) && !elementsModule.novelButton.contains(e.target) && !elementsModule.settingsIcon.contains(e.target) && !elementsModule.imageViewerPage.contains(e.target)) {
        uiNovelMainModule.novelUI_toggleNovelInterface();
      }
      if (elementsModule.roleButtonsListContainer.style.display === 'flex' && !elementsModule.roleButtonsListContainer.contains(e.target) && !elementsModule.roleButton.contains(e.target)) {
        systemTriggersModule.toggleRoleList(true);
      }
      if (elementsModule.partitionListContainer.style.display === 'flex' && !elementsModule.partitionListContainer.contains(e.target) && !elementsModule.ruleButton.contains(e.target)) {
        partitionListManagerModule.togglePartitionList();
      }
      if (elementsModule.activeRoleTriggerList.style.display === 'flex' && !elementsModule.activeRoleTriggerList.contains(e.target) && !elementsModule.runPauseButton.contains(e.target)) {
        elementsModule.activeRoleTriggerList.style.display = 'none';
      }
    }, true);

    elementsModule.chatArea.addEventListener('scroll', () => {
      if (elementsModule.roleButtonsListContainer.style.display === 'flex') systemTriggersModule.toggleRoleList(true);
      if (stateModule.activeRoleStateButtons) roleManagementUiModule.hideRoleStateButtons();
      if (elementsModule.partitionListContainer.style.display === 'flex') partitionListManagerModule.togglePartitionList();
      if (elementsModule.activeRoleTriggerList.style.display === 'flex') elementsModule.activeRoleTriggerList.style.display = 'none';
    }, { passive: true });
    
    eventListenersModule._setupSwipeListener();

    eventBus.on('UI_REFRESH_CHATROOM_COMPONENTS', () => {
        roleManagementUiModule.updateRoleButtonsList();
        partitionListManagerModule.updatePartitionList();
        systemTriggersModule.updateAutoTriggerButtonVisual();
        uiNovelMainModule.novelUI_updateNovelButtonVisual();
        
        const handlers = {
            'current-chatroom-settings-page': () => settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(document.querySelector('#current-chatroom-settings-page .settings-group.current-chatroom-settings')),
            'role-list-page': settingsChatroomRolesModule.updateChatroomRolePage,
            'identity-groups-page': settingsChatroomIdentityGroupsModule.renderPage,
            'story-mode-page': settingsChatroomNovelsModule.updateChatroomNovelPage,
            'events-list-page': settingsEventsListModule.renderPage,
            'role-detail-page': () => stateModule.currentRole && settingsRoleDetailModule.showRoleDetailPage(stateModule.currentRole),
            'role-setting-detail-page': () => stateModule.currentRole && !settingsRoleSettingDetailModule.currentEditingSettingItem && settingsRoleSettingDetailModule.renderPage(stateModule.currentRole),
            'role-memory-list-page': () => stateModule.currentRole && !settingsRoleMemoryListModule.currentEditingMemoryItem && settingsRoleMemoryListModule.renderPage(stateModule.currentRole),
            'role-public-info-list-page': () => stateModule.currentRole && !settingsRolePublicInfoListModule.currentEditingPublicInfoItem && settingsRolePublicInfoListModule.renderPage(stateModule.currentRole),
            'knowledge-base-entries-page': () => settingsKnowledgeBaseEntriesModule.currentGroupName && settingsKnowledgeBaseEntriesModule.renderPage(settingsKnowledgeBaseEntriesModule.currentGroupName)
        };
        if (stateModule.activeSettingPage && handlers[stateModule.activeSettingPage]) handlers[stateModule.activeSettingPage]();
    });

    eventBus.on('UI_REFRESH_CHATROOM_BACKGROUND', initializationModule._initializeBackground);

    eventBus.on('PARTITION_SWITCHED', (data) => {
        if (data.newPartitionId) {
            stateModule.newMessagesInPartitions.delete(data.newPartitionId);
            partitionListManagerModule.updatePartitionList();
            roleManagementUiModule.updateRoleButtonsList();
            systemTriggersModule.updateAutoTriggerButtonVisual();
            uiNovelMainModule.novelUI_updateNovelButtonVisual();
        }
    });

    eventBus.on('UI_UPDATE_GLOBAL', () => {
        systemTriggersModule.updateModelToggleButtonVisual();
    });
  }
};