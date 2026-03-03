const initializationModule = {
  _initializeGlobalEventSubscriptions: () => {
    eventBus.on('GLOBAL_STATE_FULL_UPDATE', (payload) => {
      stateManager.commit('SET_INITIAL_DATA', payload);
      initializationModule._initializeAllUI();
    });

    eventBus.on('UI_UPDATE_GLOBAL', () => {
        settingsChatroomDirModule.updateChatroomList();
    });
  },

  _initializeAllUI: () => {
    initializationModule._initializeApiSettingsUI();
    initializationModule._initializeNovelAiSettingsUI();
    initializationModule._initializeGeneralSettingsUI();
    initializationModule._initializePromptPresetSettingsUI();
    initializationModule._initializeToolSettingsUI();
    initializationModule._initializeTopToolbarUI();
    initializationModule._initializeErrorLogUI();
    initializationModule._initializeChatroomListUI();
    initializationModule._initializeBackground();
    initializationModule._initializeChatroomSpecificUI();
  },

  _initializeApiSettingsUI: () => {
    const apiSettingsPage = document.getElementById('api-settings-page');
    if (apiSettingsPage) {
      const container = apiSettingsPage.querySelector('.settings-section');
      if (container) {
        settingsApiModule.renderApiSettingsPage(container);
      }
    }
  },
  _initializeNovelAiSettingsUI: () => {
    const novelaiSettingsPage = document.getElementById('novelai-settings-page');
    if (novelaiSettingsPage) {
      const container = novelaiSettingsPage.querySelector('.settings-section');
      if (container) {
        settingsNovelaiModule.renderNovelAiSettingsPage(container);
      }
    }
  },
  _initializeGeneralSettingsUI: () => {
    if (elementsModule.generalConfigPage) {
      const container = elementsModule.generalConfigPage.querySelector('.settings-section .settings-group.general-config');
      if (container) settingsPromptPresetsModule.renderGeneralConfigPage(container);
    }
  },
  _initializePromptPresetSettingsUI: () => {
    if (elementsModule.promptPresetPage) {
      const container = elementsModule.promptPresetPage.querySelector('.settings-section');
      if (container) settingsPromptPresetsModule.renderPromptPresetPage(container);
    }
  },
  _initializeToolSettingsUI: () => {
    Object.keys(toolNameMap).forEach(toolName => {
      settingsToolListModule.loadGodSettings(toolName);
    });
  },
  _initializeChatroomListUI: () => {
    settingsChatroomDirModule.updateChatroomList();
  },
  _initializeTopToolbarUI: () => {
    elementsModule.runPauseButton.textContent = '▶';
    elementsModule.roleButtonsListContainer.style.display = stateModule.config.isRoleListVisible ? 'flex' : 'none';
    elementsModule.partitionListContainer.style.display = 'none';
    systemTriggersModule.updateModelToggleButtonVisual();
  },
  _initializeErrorLogUI: () => {
    if (elementsModule.errorLogDisplay) {
      elementsModule.errorLogDisplay.value = "";
    }
  },
  _initializeNovelInterfaceUI: () => {
    stateModule.isNovelInterfaceVisible = false;
    uiNovelMainModule.novelUI_closeAndClearAllPages();
    stateModule.novelPageStack = [];
    stateModule.activeNovelPage = null;
    stateModule.currentTocIndexByNovel = {};
  },
  _initializeBackground: () => {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    const backgroundFilename = stateModule.currentChatroomDetails?.config?.backgroundImageFilename;
    const activeRoomName = stateModule.config.activeChatRoomName;
    if (backgroundFilename && activeRoomName && elementsModule.chatContainer) {
      const bgUrl = backgroundFilename.startsWith('data:') ?
        backgroundFilename :
        `/chatrooms/${encodeURIComponent(activeRoomName)}/${encodeURIComponent(backgroundFilename)}?t=${Date.now()}`;
      chatContainer.style.backgroundImage = `url('${bgUrl}')`;
    } else if (elementsModule.chatContainer) {
      chatContainer.style.backgroundImage = '';
    }
  },
  _initializeChatroomSpecificUI: () => {
    const loadingOverlay = document.getElementById('global-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');
    stateModule.isSwitchingChatroom = false;
    
    partitionRendererModule.clearAllPartitionCaches();

    if (stateModule.currentChatroomDetails && stateModule.currentChatroomDetails.config?.name) {
      const partitions = stateModule.currentChatroomDetails.partitions;
      partitions.forEach((partition, partitionId) => {
        const partitionContainer = document.createElement('div');
        partitionContainer.dataset.partitionId = partitionId;
        partitionContainer.style.display = 'none';
        
        const fragment = document.createDocumentFragment();
        (partition.history || []).forEach(msgObj => {
          const newElement = messageBubbleFactoryModule.createMessageBubble(msgObj, partitionId);
          if (newElement) fragment.appendChild(newElement);
        });
        partitionContainer.appendChild(fragment);
        
        elementsModule.chatArea.appendChild(partitionContainer);
        stateModule.partitionDOMCache.set(partitionId, partitionContainer);
      });

      partitionRendererModule.renderChatAreaForPartition(stateModule.activePartitionId, true);
      
      roleManagementUiModule.updateRoleButtonsList();
      partitionListManagerModule.updatePartitionList();
      uiNovelMainModule.novelUI_updateNovelButtonVisual();
      if (document.getElementById('role-list-page')?.classList.contains('active')) {
        settingsChatroomRolesModule.updateChatroomRolePage();
      }
      if (document.getElementById('story-mode-page')?.classList.contains('active')) {
        settingsChatroomNovelsModule.updateChatroomNovelPage();
      }
      if (document.getElementById('current-chatroom-settings-page')?.classList.contains('active')) {
        const currentChatroomSettingsGroup = document.getElementById('current-chatroom-settings-page').querySelector('.settings-group.current-chatroom-settings');
        if (currentChatroomSettingsGroup) settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(currentChatroomSettingsGroup);
      }
    } else {
      roleManagementUiModule.updateRoleButtonsList();
      partitionListManagerModule.updatePartitionList();
      initializationModule._initializeBackground();
      initializationModule._initializeNovelInterfaceUI();
      uiNovelMainModule.novelUI_updateNovelButtonVisual();
    }
  },
  initializeConfig: async () => {
    elementsModule.init();
    transactionManagerModule.init();
    initializationModule._initializeGlobalEventSubscriptions();

    try {
      const result = await apiClientConfigModule.loadInitialData();
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load initial data from server.");
      }
      eventBus.emit('GLOBAL_STATE_FULL_UPDATE', result.data);
    } catch (error) {
      _logAndDisplayError(`Initialization failed: ${error.message}. Please check backend logs. The application may not function correctly.`, 'initializationModule.initializeConfig', 'N/A', 'N/A', error);
      alert(`严重错误：无法从后端加载初始数据！\n\n错误信息: ${error.message}\n\n请检查后端服务是否正在运行以及是否存在错误。在问题解决前，应用可能无法正常工作。`);
    }

    eventListenersModule.setupEventListeners();
    settingsPageManagerModule.hideAllSettingPages();
    elementsModule.settingsPanel.classList.remove('active');
    stateModule.pageStack = [];
  },
};