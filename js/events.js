const eventListenersModule = {
  _longPressDelay: 250,
  _cooldownDuration: 200,
  _isFullscreen: () => {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  },
  _requestFullscreen: async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock(screen.orientation.type).catch(err => {});
      }
    } catch (err) {}
  },
  _exitFullscreen: () => {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  },
  _toggleFullscreen: () => {
    if (eventListenersModule._isFullscreen()) {
      eventListenersModule._exitFullscreen();
    } else {
      eventListenersModule._requestFullscreen();
    }
  },
  _activateCooldown: () => {
    clearTimeout(stateModule.cooldownTimer);
    stateModule.isCooldownActive = true;
    stateModule.cooldownTimer = setTimeout(() => {
      stateModule.isCooldownActive = false;
      stateModule.cooldownTimer = null;
    }, eventListenersModule._cooldownDuration);
  },
  _setupLongPressListener: (element, shortPressAction, longPressAction, allowScroll = false) => {
    let startX, startY, isMoved = false,
      longPressTimer = null,
      startEvent = null,
      longPressFired = false;

    const cleanup = (wasActionFired = false) => {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      startEvent = null;
      isMoved = false;
      longPressFired = false;
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', cleanup);
      element.removeEventListener('pointerleave', handlePointerLeave);
      if (wasActionFired) {
        eventListenersModule._activateCooldown();
      }
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (stateModule.isCooldownActive) return;

      cleanup();

      startEvent = event;
      startX = event.clientX;
      startY = event.clientY;
      isMoved = false;
      longPressFired = false;

      element.addEventListener('pointermove', handlePointerMove, {
        passive: true
      });
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
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      const MOVE_THRESHOLD = 10;
      if (!allowScroll && (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD)) {
        isMoved = true;
        cleanup(false);
      } else if (allowScroll && (deltaX > MOVE_THRESHOLD * 2 || deltaY > MOVE_THRESHOLD * 2)) {
        isMoved = true;
        cleanup(false);
      }
    };

    const handlePointerUp = (event) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (!isMoved && !longPressFired && shortPressAction) {
        shortPressAction(startEvent || event);
        cleanup(true);
      } else {
        cleanup(longPressFired);
      }
    };

    const handlePointerLeave = (event) => {
      const rect = element.getBoundingClientRect();
      const isOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (startEvent && isOutside) {
        cleanup(false);
      }
    };

    element.removeEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointerdown', handlePointerDown);
  },
  _setupSwipeListener: () => {
    let startX = 0;
    let startY = 0;
    let isTrackingSwipe = false;
    const GESTURE_START_THRESHOLD = 10;

    elementsModule.chatArea.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || stateModule.isNovelInterfaceVisible || elementsModule.settingsPanel.classList.contains('active')) return;
      startX = event.clientX;
      startY = event.clientY;
      isTrackingSwipe = true;
    }, {
      passive: true
    });

    elementsModule.chatArea.addEventListener('pointermove', (event) => {
      if (!isTrackingSwipe || event.pointerType !== 'touch') return;

      const deltaX_raw = event.clientX - startX;
      const deltaY_raw = event.clientY - startY;
      const deltaX_abs = Math.abs(deltaX_raw);
      const deltaY_abs = Math.abs(deltaY_raw);

      if (deltaX_abs > GESTURE_START_THRESHOLD || deltaY_abs > GESTURE_START_THRESHOLD) {
        if (deltaX_abs > deltaY_abs) {
          if (deltaX_raw < 0) {
            partitionListManagerModule.switchPartitionBySwipe('next');
          } else {
            partitionListManagerModule.switchPartitionBySwipe('previous');
          }
          isTrackingSwipe = false;
        } else {
          isTrackingSwipe = false;
        }
      }
    }, {
      passive: true
    });

    elementsModule.chatArea.addEventListener('pointerup', () => {
      isTrackingSwipe = false;
    }, {
      passive: true
    });

    elementsModule.chatArea.addEventListener('pointercancel', () => {
      isTrackingSwipe = false;
    }, {
      passive: true
    });
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

    if (elementsModule.settingsIcon) {
      eventListenersModule._setupLongPressListener(
        elementsModule.settingsIcon,
        () => settingsPageManagerModule.toggleSettings(),
        () => eventListenersModule._toggleFullscreen(),
        false
      );
    }
    if (elementsModule.roleButton) {
      eventListenersModule._setupLongPressListener(
        elementsModule.roleButton,
        () => systemTriggersModule.toggleRoleList(),
        () => settingsPageManagerModule.showSection('role-list-page'),
        false
      );
    }
    if (elementsModule.ruleButton) {
      eventListenersModule._setupLongPressListener(
        elementsModule.ruleButton,
        () => partitionListManagerModule.togglePartitionList(),
        () => settingsPageManagerModule.showSection('current-chatroom-settings-page', stateModule.config.activeChatRoomName),
        false
      );
    }
    if (elementsModule.novelButton) {
      eventListenersModule._setupLongPressListener(
        elementsModule.novelButton,
        () => {
          uiNovelMainModule.novelUI_toggleNovelInterface();
        },
        () => {
          if (stateModule.isCooldownActive) return;
          const scriptCreationMasterEnabled = stateModule.config.toolSettings.scriptCreationMaster?.enabled;
          if (scriptCreationMasterEnabled && typeof apiMainTriggerModule !== 'undefined') {
            let initiatorMessageIdForSCM = null;
            const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
            if (activePartition && activePartition.history && activePartition.history.length > 0) {
              initiatorMessageIdForSCM = activePartition.history[activePartition.history.length - 1].id;
            }
            const summaryContextForSCM = initiatorMessageIdForSCM ? {
              initiatorMessageId: initiatorMessageIdForSCM
            } : null;
            apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'scriptCreationMaster', null, summaryContextForSCM);
          } else {
            _logAndDisplayError("Cannot trigger tool: Script Creation Master is not enabled.", "novelButtonLongPress");
          }
        },
        false
      );
    }
    if (elementsModule.modelToggleButton) {
      eventListenersModule._setupLongPressListener(
        elementsModule.modelToggleButton,
        () => {
          if (stateModule.isCooldownActive) return;
          const currentType = stateModule.config.generalModelSelectionType;
          let newType;
          if (currentType === 'primary') {
              newType = 'secondary';
          } else if (currentType === 'secondary') {
              newType = 'tertiary';
          } else {
              newType = 'primary';
          }
          transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
            updates: {
                'generalModelSelectionType': newType
            }
          });
        },
        () => {
          if (stateModule.isCooldownActive) return;
          const characterCreationMasterEnabled = stateModule.config.toolSettings.characterCreationMaster?.enabled;
          if (characterCreationMasterEnabled && typeof apiMainTriggerModule !== 'undefined') {
            let initiatorMessageIdForCCM = null;
            const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
            if (activePartition && activePartition.history && activePartition.history.length > 0) {
              initiatorMessageIdForCCM = activePartition.history[activePartition.history.length - 1].id;
            }
            const summaryContextForCCM = initiatorMessageIdForCCM ? {
              initiatorMessageId: initiatorMessageIdForCCM
            } : null;
            apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'characterCreationMaster', null, summaryContextForCCM);
          } else {
            _logAndDisplayError("Cannot trigger tool: Character Creation Master is not enabled.", "modelToggleButtonLongPress");
          }
        },
        false
      );
    }

    if (elementsModule.addAdminButton) {
      const adminShortPress = () => {
        if (stateModule.isCooldownActive) return;
        roleManagementUiModule.createAdminMessage();
      };
      const adminLongPress = () => {
        if (stateModule.isCooldownActive) return;
        const plotSummaryMasterEnabled = stateModule.config.toolSettings.plotSummaryMaster?.enabled;
        if (plotSummaryMasterEnabled) {
          apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'plotSummaryMaster');
        } else {
          _logAndDisplayError("Cannot trigger tool: Plot Summary Master is not enabled.", "addAdminButtonLongPress");
        }
      };
      eventListenersModule._setupLongPressListener(elementsModule.addAdminButton, adminShortPress, adminLongPress, false);
    }

    document.addEventListener('click', (event) => {
      if (!eventListenersModule._isFullscreen()) {
        const target = event.target;
        if (target === elementsModule.chatArea || (target.classList && target.classList.contains('message-container'))) {
          eventListenersModule._requestFullscreen();
        }
      }

      if (stateModule.isCooldownActive && !event.target.closest('.std-button')) {
        return;
      }
      const isInsideSettings = elementsModule.settingsPanel.contains(event.target);
      const isInsideNovel = elementsModule.novelInterface.contains(event.target);
      const isImageViewer = elementsModule.imageViewerPage?.contains(event.target);
      const isSettingsIcon = elementsModule.settingsIcon.contains(event.target);
      const isNovelButton = elementsModule.novelButton.contains(event.target);

      if (stateModule.isNovelInterfaceVisible && !isInsideNovel && !isNovelButton && !isSettingsIcon && !isImageViewer && typeof uiNovelMainModule !== 'undefined') {
        uiNovelMainModule.novelUI_toggleNovelInterface();
      }

      if (stateModule.isRoleListVisible_temp &&
        !elementsModule.roleButtonsListContainer.contains(event.target) &&
        !elementsModule.roleButton.contains(event.target)) {
        systemTriggersModule.toggleRoleList(true);
      }

      if (elementsModule.partitionListContainer && elementsModule.partitionListContainer.style.display === 'flex' && !elementsModule.partitionListContainer.contains(event.target) && !elementsModule.ruleButton.contains(event.target) && typeof partitionListManagerModule !== 'undefined') {
        partitionListManagerModule.togglePartitionList();
      }
      const activeTriggerList = elementsModule.activeRoleTriggerList;
      if (activeTriggerList && activeTriggerList.style.display === 'flex' && !activeTriggerList.contains(event.target) && !elementsModule.runPauseButton.contains(event.target)) {
        activeTriggerList.style.display = 'none';
      }
    }, true);

    if (elementsModule.chatArea) {
      elementsModule.chatArea.addEventListener('scroll', () => {
        if (stateModule.isRoleListVisible_temp) {
          systemTriggersModule.toggleRoleList(true);
        }
        if (stateModule.activeRoleStateButtons) {
          roleManagementUiModule.hideRoleStateButtons();
        }
        if (elementsModule.partitionListContainer.style.display === 'flex') {
          partitionListManagerModule.togglePartitionList();
        }
        const activeTriggerList = elementsModule.activeRoleTriggerList;
        if (activeTriggerList && activeTriggerList.style.display === 'flex') {
          activeTriggerList.style.display = 'none';
        }
      }, {
        passive: true
      });
      eventListenersModule._setupSwipeListener();
    }

    eventBus.on('UI_REFRESH_CHATROOM_COMPONENTS', () => {
        roleManagementUiModule.updateRoleButtonsList();
        partitionListManagerModule.updatePartitionList();
        systemTriggersModule.updateAutoTriggerButtonVisual();
        uiNovelMainModule.novelUI_updateNovelButtonVisual();
        if (stateModule.activeSettingPage) {
            if (stateModule.activeSettingPage.startsWith('chatroom-override-')) {
                const toolName = stateModule.activeSettingPage.replace('chatroom-override-', '').replace('-page', '');
                const container = document.getElementById(stateModule.activeSettingPage).querySelector('.settings-section');
                if (toolName === 'general') {
                    settingsChatroomOverrideGeneralManagerModule.renderChatroomOverrideGeneralPage(container);
                } else if (toolNameMap[toolName]) {
                    settingsChatroomOverrideToolsManagerModule.renderChatroomOverrideToolPage(container, toolName);
                }
            } else {
                switch (stateModule.activeSettingPage) {
                    case 'current-chatroom-settings-page':
                        settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(document.getElementById('current-chatroom-settings-page').querySelector('.settings-group.current-chatroom-settings'));
                        break;
                    case 'role-list-page':
                        settingsChatroomRolesModule.updateChatroomRolePage();
                        break;
                    case 'identity-groups-page':
                        settingsChatroomIdentityGroupsModule.renderPage();
                        break;
                    case 'story-mode-page':
                        settingsChatroomNovelsModule.updateChatroomNovelPage();
                        break;
                    case 'events-list-page':
                        settingsEventsListModule.renderPage();
                        break;
                    case 'role-detail-page':
                        if (stateModule.currentRole) settingsRoleDetailModule.showRoleDetailPage(stateModule.currentRole);
                        break;
                    case 'role-setting-detail-page':
                        if (stateModule.currentRole && !settingsRoleSettingDetailModule.currentEditingSettingItem) settingsRoleSettingDetailModule.renderPage(stateModule.currentRole);
                        break;
                    case 'role-memory-list-page':
                        if (stateModule.currentRole && !settingsRoleMemoryListModule.currentEditingMemoryItem) settingsRoleMemoryListModule.renderPage(stateModule.currentRole);
                        break;
                    case 'role-public-info-list-page':
                        if (stateModule.currentRole && !settingsRolePublicInfoListModule.currentEditingPublicInfoItem) settingsRolePublicInfoListModule.renderPage(stateModule.currentRole);
                        break;
                    case 'knowledge-base-entries-page':
                        if (settingsKnowledgeBaseEntriesModule.currentGroupName) settingsKnowledgeBaseEntriesModule.renderPage(settingsKnowledgeBaseEntriesModule.currentGroupName);
                        break;
                }
            }
        }
    });

    eventBus.on('UI_REFRESH_CHATROOM_BACKGROUND', () => {
        initializationModule._initializeBackground();
    });

    eventBus.on('PARTITION_SWITCHED', (data) => {
        if (data.newPartitionId) {
            if (stateModule.newMessagesInPartitions.has(data.newPartitionId)) {
                stateModule.newMessagesInPartitions.delete(data.newPartitionId);
            }
            partitionListManagerModule.updatePartitionList();
            roleManagementUiModule.updateRoleButtonsList();
            systemTriggersModule.updateAutoTriggerButtonVisual();
            uiNovelMainModule.novelUI_updateNovelButtonVisual();
        }
    });
  }
};