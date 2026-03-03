const settingsPageManagerModule = {
  init: () => {
    elementsModule.settingsIcon.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.toggleSettings();
    });
    elementsModule.closeButtons.forEach(button => button.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
        const page = button.closest('.setting-page-template');
        if (page) settingsPageManagerModule.closeCurrentSection(page.id);
      }
    }));
    elementsModule.settingsMenuItems.forEach(item => item.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection(item.dataset.target);
    }));
    elementsModule.chatRoomSettingsMenuItems.forEach(item => item.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection(item.dataset.target);
    }));
    elementsModule.chatroomDetailSettingsMenuItems.forEach(item => item.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
        const targetPageId = item.dataset.target;
        const chatroomName = stateModule.config.activeChatRoomName;
        settingsPageManagerModule.showSection(targetPageId, chatroomName);
      }
    }));
  },

  toggleSettings: (initialPageId = 'settings-main-page', initialContextData = null) => {
    elementsModule.settingsPanel.classList.toggle('active');
    if (elementsModule.settingsPanel.classList.contains('active')) {
      settingsPageManagerModule.hideAllSettingPages();
      settingsPageManagerModule.showSection(initialPageId, initialContextData);
      if (stateModule.isNovelInterfaceVisible && typeof uiNovelMainModule !== 'undefined') {
        uiNovelMainModule.novelUI_toggleNovelInterface();
      }
      if (stateModule.isSummaryPageVisible && typeof uiNovelSummaryModule !== 'undefined') {
        uiNovelSummaryModule.novelSummaryUI_toggleSummaryPage();
      }
      if (elementsModule.partitionListContainer.style.display === 'flex') {
        elementsModule.partitionListContainer.style.display = 'none';
      }
    } else {
      settingsPageManagerModule.hideAllSettingPages();
      stateModule.pageStack = [];
    }
  },

  showSection: async (sectionId, contextData = null) => {
    if (sectionId === 'chat-room-directory-page') {
      uiChatImageViewerModule.hideImageViewer();
    }
    if (!elementsModule.settingsPanel.classList.contains('active') && sectionId !== 'settings-main-page') {
      settingsPageManagerModule.toggleSettings(sectionId, contextData);
      await new Promise(resolve => setTimeout(resolve, 0));
      return;
    }

    settingsPageManagerModule.hideAllSettingPages();
    const sectionElement = document.getElementById(sectionId);

    if (!sectionElement) {
      _logAndDisplayError(`Section element with ID '${sectionId}' not found. Defaulting to main settings.`, "settingsPageManagerModule.showSection");
      settingsPageManagerModule.showSection('settings-main-page');
      return;
    }

    let requiresChatroomData = [
      'role-list-page', 'story-mode-page', 'current-chatroom-settings-page', 'chat-room-detail-page',
      'role-setting-detail-page', 'role-memory-list-page', 'role-public-info-list-page', 'role-detail-page',
      'events-list-page', 'identity-groups-page'
    ].includes(sectionId) || sectionId.startsWith('chatroom-override-');

    if (requiresChatroomData) {
      if (!stateModule.currentChatroomDetails.config.name) {
        _logAndDisplayError("Cannot show chatroom-specific section: No active chatroom or details loaded.", "settingsPageManagerModule.showSection");
        settingsPageManagerModule.showSection('chat-room-directory-page');
        return;
      }
    }

    sectionElement.classList.add('active');
    stateModule.activeSettingPage = sectionId;

    if (sectionId === 'settings-main-page') {
      stateModule.pageStack = ['settings-main-page'];
    } else {
      const lastPageInStack = stateModule.pageStack[stateModule.pageStack.length - 1];
      if (lastPageInStack !== sectionId) {
        let parentIndex = stateModule.pageStack.indexOf(sectionId);
        if (parentIndex !== -1) {
          stateModule.pageStack = stateModule.pageStack.slice(0, parentIndex + 1);
        } else {
          stateModule.pageStack.push(sectionId);
        }
      }
    }

    if (sectionId === 'chat-room-detail-page' && contextData) {
      const titleEl = document.getElementById('chatroom-detail-header-title');
      if (titleEl) titleEl.textContent = `聊天室详情 - ${contextData}`;
    }
    const container = sectionElement.querySelector('.settings-section .settings-group');
    switch (sectionId) {
      case 'current-chatroom-settings-page':
        if (container) settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(container);
        break;
      case 'identity-groups-page':
        settingsChatroomIdentityGroupsModule.renderPage();
        break;
      case 'story-mode-page':
        settingsChatroomNovelsModule.updateChatroomNovelPage();
        break;
      case 'role-list-page':
        settingsChatroomRolesModule.updateChatroomRolePage();
        break;
      case 'role-detail-page':
        if (contextData) settingsRoleDetailModule.showRoleDetailPage(contextData);
        break;
      case 'role-setting-detail-page':
        if (contextData) settingsRoleSettingDetailModule.renderPage(contextData);
        break;
      case 'role-memory-list-page':
        if (contextData) settingsRoleMemoryListModule.renderPage(contextData);
        break;
      case 'role-public-info-list-page':
        if (contextData) settingsRolePublicInfoListModule.renderPage(contextData);
        break;
      case 'events-list-page':
        settingsEventsListModule.renderPage();
        break;
      case 'chat-room-directory-page':
        settingsChatroomDirModule.updateChatroomList();
        break;
      case 'knowledge-base-directory-page':
        settingsKnowledgeBaseDirModule.renderPage();
        break;
      case 'knowledge-base-entries-page':
        if (contextData) settingsKnowledgeBaseEntriesModule.renderPage(contextData);
        break;
    }

  },

  hideAllSettingPages: () => {
    elementsModule.settingPages.forEach(page => page.classList.remove('active'));
    stateModule.activeSettingPage = null;
  },

  closeCurrentSection: (sectionId) => {
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.remove('active');
      const stackIndex = stateModule.pageStack.lastIndexOf(sectionId);
      if (stackIndex > -1) {
        stateModule.pageStack.splice(stackIndex);
      }

      if (sectionId === 'current-chatroom-settings-page' && !stateModule.pageStack.includes('chat-room-detail-page')) {
        settingsPageManagerModule.showSection('chat-room-detail-page', stateModule.config.activeChatRoomName);
        return;
      }

      if (stateModule.pageStack.length > 0) {
        const previousPageId = stateModule.pageStack[stateModule.pageStack.length - 1];
        let previousContext = null;
        if (previousPageId === 'chat-room-detail-page') {
          previousContext = stateModule.config.activeChatRoomName;
        } else if (['role-detail-page', 'role-setting-detail-page', 'role-memory-list-page', 'role-public-info-list-page', 'events-list-page', 'knowledge-base-entries-page'].includes(previousPageId)) {
          previousContext = stateModule.currentRole;
        }

        settingsPageManagerModule.showSection(previousPageId, previousContext);
      } else {
        if (elementsModule.settingsPanel.classList.contains('active')) {
          settingsPageManagerModule.showSection('settings-main-page');
          stateModule.pageStack = ['settings-main-page'];
        } else {
          stateModule.activeSettingPage = null;
        }
      }
    }
  },

  showChatroomDetailPage: async (name) => {
    const titleEl = document.getElementById('chatroom-detail-header-title');
    if (titleEl) titleEl.textContent = `聊天室详情 - ${name}`;
    settingsPageManagerModule.showSection('chat-room-detail-page', name);
  },
};