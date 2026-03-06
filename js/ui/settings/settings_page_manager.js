const settingsPageManagerModule = {
  init: () => {
    elementsModule.settingsIcon.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.toggleSettings();
    });
    elementsModule.closeButtons.forEach(button => button.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
        settingsPageManagerModule.closeCurrentSection(button.closest('.setting-page-template').id);
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
        settingsPageManagerModule.showSection(item.dataset.target, stateModule.config.activeChatRoomName);
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

  showSection: (sectionId, contextData = null) => {
    if (sectionId === 'chat-room-directory-page') {
      uiChatImageViewerModule.hideImageViewer();
    }
    if (!elementsModule.settingsPanel.classList.contains('active') && sectionId !== 'settings-main-page') {
      settingsPageManagerModule.toggleSettings(sectionId, contextData);
      return;
    }

    settingsPageManagerModule.hideAllSettingPages();
    const sectionElement = document.getElementById(sectionId);

    const requiresChatroomData = [
      'role-list-page', 'story-mode-page', 'current-chatroom-settings-page', 'chat-room-detail-page',
      'role-setting-detail-page', 'role-memory-list-page', 'role-public-info-list-page', 'role-detail-page',
      'events-list-page', 'identity-groups-page'
    ];

    if (requiresChatroomData.includes(sectionId) && !stateModule.currentChatroomDetails.config.name) {
      settingsPageManagerModule.showSection('chat-room-directory-page');
      return;
    }

    sectionElement.classList.add('active');
    stateModule.activeSettingPage = sectionId;

    if (sectionId === 'settings-main-page') {
      stateModule.pageStack = ['settings-main-page'];
    } else {
      const lastPage = stateModule.pageStack[stateModule.pageStack.length - 1];
      if (lastPage !== sectionId) {
        const parentIndex = stateModule.pageStack.indexOf(sectionId);
        if (parentIndex !== -1) {
          stateModule.pageStack = stateModule.pageStack.slice(0, parentIndex + 1);
        } else {
          stateModule.pageStack.push(sectionId);
        }
      }
    }

    if (sectionId === 'chat-room-detail-page' && contextData) {
      document.getElementById('chatroom-detail-header-title').textContent = `聊天室详情 - ${contextData}`;
    }

    const container = sectionElement.querySelector('.settings-section .settings-group');
    const handlers = {
      'current-chatroom-settings-page': () => settingsChatroomCurrentModule.renderCurrentChatroomSettingsPage(container),
      'identity-groups-page': () => settingsChatroomIdentityGroupsModule.renderPage(),
      'story-mode-page': () => settingsChatroomNovelsModule.updateChatroomNovelPage(),
      'role-list-page': () => settingsChatroomRolesModule.updateChatroomRolePage(),
      'role-detail-page': () => settingsRoleDetailModule.showRoleDetailPage(contextData),
      'role-setting-detail-page': () => settingsRoleSettingDetailModule.renderPage(contextData),
      'role-memory-list-page': () => settingsRoleMemoryListModule.renderPage(contextData),
      'role-public-info-list-page': () => settingsRolePublicInfoListModule.renderPage(contextData),
      'events-list-page': () => settingsEventsListModule.renderPage(),
      'chat-room-directory-page': () => settingsChatroomDirModule.updateChatroomList(),
      'knowledge-base-directory-page': () => settingsKnowledgeBaseDirModule.renderPage(),
      'knowledge-base-entries-page': () => settingsKnowledgeBaseEntriesModule.renderPage(contextData)
    };

    if (handlers[sectionId]) handlers[sectionId]();
  },

  hideAllSettingPages: () => {
    elementsModule.settingPages.forEach(page => page.classList.remove('active'));
    stateModule.activeSettingPage = null;
  },

  closeCurrentSection: (sectionId) => {
    document.getElementById(sectionId).classList.remove('active');
    const stackIndex = stateModule.pageStack.lastIndexOf(sectionId);
    if (stackIndex > -1) stateModule.pageStack.splice(stackIndex);

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
      } else {
        stateModule.activeSettingPage = null;
      }
    }
  },

  showChatroomDetailPage: (name) => {
    settingsPageManagerModule.showSection('chat-room-detail-page', name);
  },
};