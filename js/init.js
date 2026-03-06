const initializationModule = {
  _initializeAllUI: () => {
    initializationModule._initializeApiSettingsUI();
    initializationModule._initializeNovelAiSettingsUI();
    initializationModule._initializeGeneralSettingsUI();
    initializationModule._initializePromptPresetSettingsUI();
    initializationModule._initializeToolSettingsUI();
    
    initializationModule._initializeTopToolbarUI();
    initializationModule._initializeErrorLogUI();
    initializationModule._initializeBackground();
    initializationModule._initializeChatroomSpecificUI();
  },

  _initializeApiSettingsUI: () => {
    const el = document.querySelector('#api-settings-page .settings-section');
    if (el) settingsApiModule.renderApiSettingsPage(el);
  },
  _initializeNovelAiSettingsUI: () => {
    const el = document.querySelector('#novelai-settings-page .settings-section');
    if (el) settingsNovelaiModule.renderNovelAiSettingsPage(el);
  },
  _initializeGeneralSettingsUI: () => {
    const el = document.querySelector('#general-config-page .settings-group.general-config');
    if (el) settingsPromptPresetsModule.renderGeneralConfigPage(el);
  },
  _initializePromptPresetSettingsUI: () => {
    const el = document.querySelector('#prompt-preset-page .settings-section');
    if (el) settingsPromptPresetsModule.renderPromptPresetPage(el);
  },
  _initializeToolSettingsUI: () => {
    Object.keys(toolNameMap).forEach(toolName => settingsToolListModule.loadGodSettings(toolName));
  },
  _initializeTopToolbarUI: () => {
    elementsModule.runPauseButton.textContent = '▶';
    elementsModule.roleButtonsListContainer.style.display = stateModule.config.isRoleListVisible ? 'flex' : 'none';
    elementsModule.partitionListContainer.style.display = 'none';
    systemTriggersModule.updateModelToggleButtonVisual();
  },
  _initializeErrorLogUI: () => {
    if (elementsModule.errorLogDisplay) elementsModule.errorLogDisplay.value = "";
  },
  _initializeNovelInterfaceUI: () => {
    stateModule.isNovelInterfaceVisible = false;
    uiNovelMainModule.novelUI_closeAndClearAllPages();
    stateModule.novelPageStack = [];
    stateModule.activeNovelPage = null;
    stateModule.currentTocIndexByNovel = {};
  },
  _initializeBackground: () => {
    const bgFile = stateModule.currentChatroomDetails.config.backgroundImageFilename;
    const room = stateModule.config.activeChatRoomName;
    const url = (bgFile && room) ? (bgFile.startsWith('data:') ? bgFile : `/chatrooms/${encodeURIComponent(room)}/${encodeURIComponent(bgFile)}?t=${Date.now()}`) : '';
    elementsModule.chatContainer.style.backgroundImage = url ? `url('${url}')` : '';
  },
  _initializeChatroomSpecificUI: () => {
    document.getElementById('global-loading-overlay').classList.remove('active');
    stateModule.isSwitchingChatroom = false;
    partitionRendererModule.clearAllPartitionCaches();

    if (stateModule.currentChatroomDetails.config.name) {
      stateModule.currentChatroomDetails.partitions.forEach((partition, partitionId) => {
        const div = document.createElement('div');
        div.dataset.partitionId = partitionId;
        div.style.display = 'none';
        const frag = document.createDocumentFragment();
        partition.history.forEach(msg => {
          const el = messageBubbleFactoryModule.createMessageBubble(msg, partitionId);
          if (el) frag.appendChild(el);
        });
        div.appendChild(frag);
        elementsModule.chatArea.appendChild(div);
        stateModule.partitionDOMCache.set(partitionId, div);
      });

      partitionRendererModule.renderChatAreaForPartition(stateModule.activePartitionId, true);
      roleManagementUiModule.updateRoleButtonsList();
      partitionListManagerModule.updatePartitionList();
      uiNovelMainModule.novelUI_updateNovelButtonVisual();
      
      const activePage = document.querySelector('.setting-page-template.active');
      if (activePage) {
          const id = activePage.id;
          if (id === 'role-list-page') settingsChatroomRolesModule.updateChatroomRolePage();
          else if (id === 'story-mode-page') settingsChatroomNovelsModule.updateChatroomNovelPage();
          else if (id === 'current-chatroom-settings-page') settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(activePage.querySelector('.settings-group'));
      }
    } else {
      elementsModule.roleButtonsListContainer.innerHTML = '';
      elementsModule.partitionListContainer.innerHTML = '';
      elementsModule.novelButton.textContent = '📕';
      elementsModule.autoTriggerButton.textContent = '||';
      initializationModule._initializeBackground();
      initializationModule._initializeNovelInterfaceUI();
    }
  },

  initializeConfig: async () => {
    elementsModule.init();
    transactionManagerModule.init();
    
    eventBus.on('GLOBAL_STATE_FULL_UPDATE', (payload) => {
      stateManager.commit('SET_INITIAL_DATA', payload);
      initializationModule._initializeAllUI();
    });
    eventBus.on('UI_UPDATE_GLOBAL', settingsChatroomDirModule.updateChatroomList);

    const res = await apiClientConfigModule.loadInitialData();
    if (!res.success) throw new Error(res.error?.message || "Load failed");
    eventBus.emit('GLOBAL_STATE_FULL_UPDATE', res.data);

    eventListenersModule.setupEventListeners();
    settingsPageManagerModule.hideAllSettingPages();
    elementsModule.settingsPanel.classList.remove('active');
    stateModule.pageStack = [];
  }
};