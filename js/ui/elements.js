const elementsModule = {
  init: function() {
    const bind = (id, prop) => { this[prop || id.replace(/-([a-z])/g, g => g[1].toUpperCase())] = document.getElementById(id); };
    
    // Core & Layout
    bind('settings-icon');
    bind('settings-panel');
    bind('top-toolbar');
    bind('loading-spinner');
    bind('global-loading-overlay');
    
    // Chat Area
    bind('chat-container');
    bind('chat-area');
    bind('role-buttons-list-container');
    bind('partition-list-container');
    bind('active-role-trigger-list');
    
    // Toolbar Buttons
    bind('role-button');
    bind('rule-button');
    bind('auto-trigger-button');
    bind('model-toggle-button');
    bind('novel-button');
    bind('add-admin-button');
    bind('run-pause-button');
    bind('user-control-trigger-button');

    // Settings Pages & Menus
    this.settingPages = document.querySelectorAll('.setting-page-template');
    this.settingsMenuItems = document.querySelectorAll('#settings-menu .settings-menu-item');
    this.chatRoomSettingsMenuItems = document.querySelectorAll('#chat-room-settings-menu .settings-menu-item');
    this.chatroomDetailSettingsMenuItems = document.querySelectorAll('#chatroom-settings-menu .settings-menu-item');
    this.toolListMenuItems = document.querySelectorAll('#tool-list-container .tool-item');
    this.closeButtons = document.querySelectorAll('.close-button');

    bind('settings-main-page', 'settingsMainMenuPage');
    bind('general-config-page');
    bind('api-settings-page');
    bind('novelai-settings-page');
    bind('prompt-preset-page');
    bind('tool-list-page');
    
    // Error Log
    bind('error-log-display');
    bind('copy-error-log-button');
    bind('clear-all-config-button');
    bind('export-config-button');
    bind('import-config-file');
    bind('import-config-button');

    // Chatroom Management
    bind('chat-room-directory-page');
    bind('chatroom-list-container');
    bind('add-chatroom-button');
    bind('import-chatroom-file');
    bind('import-chatroom-button');
    bind('chat-room-detail-page');
    bind('chatroom-detail-header-title');
    bind('current-chatroom-settings-page');
    
    // Identity Groups
    bind('identity-groups-page');
    bind('identity-groups-list-container');
    bind('add-identity-group-button');

    // Roles
    bind('role-list-page');
    bind('role-list-container');
    bind('add-chatroom-role-button');
    bind('import-role-file');
    bind('import-role-button');
    
    // Role Detail
    bind('role-detail-page');
    bind('role-detail-header-title');
    bind('role-drawing-template-settings');
    bind('export-role-button');
    bind('edit-role-setting-button');
    bind('edit-role-memory-button');
    bind('edit-role-public-info-button');

    // Role Sub-pages
    bind('role-setting-detail-page');
    bind('role-setting-detail-header-title');
    
    bind('role-memory-list-page');
    bind('role-memory-list-header-title');
    bind('role-memory-list-container');
    bind('add-memory-item-form');
    bind('new-memory-time', 'newMemoryTimeInput');
    bind('new-memory-content', 'newMemoryContentTextarea');
    bind('add-memory-button');

    bind('role-public-info-list-page');
    bind('role-public-info-list-header-title');
    bind('role-public-info-list-container');
    bind('add-public-info-item-form');
    bind('new-public-info-keyword', 'newPublicInfoKeywordInput');
    bind('new-public-info-content', 'newPublicInfoContentTextarea');
    bind('add-public-info-button');

    // Novels
    bind('story-mode-page');
    bind('novel-list-container');
    bind('novel-interface');
    bind('novel-interface-toolbar');
    bind('novel-content-page');
    bind('novel-content-area');
    bind('novel-summary-page');
    bind('novel-summary-content-area');
    bind('novel-bookshelf-page');
    bind('novel-bookshelf-list-container');
    bind('novel-toc-page');
    bind('novel-toc-list-container');
    
    bind('novel-sync-progress-button');
    bind('novel-bookshelf-button');
    bind('novel-toc-button');
    bind('novel-summary-button');
    bind('novel-content-button');
    bind('novel-close-button');
    
    bind('novel-search-input');
    bind('novel-search-prev-btn');
    bind('novel-search-next-btn');

    // Events
    bind('events-list-page');
    bind('events-list-container');

    // Knowledge Base
    bind('import-knowledge-image-file');
    bind('import-knowledge-image-button');
    bind('import-knowledge-json-file');
    bind('import-knowledge-json-button');

    // Presets Modal
    bind('preset-selection-modal-overlay');
    bind('preset-modal-title');
    bind('preset-modal-list-container');
    bind('preset-modal-cancel-btn');
    bind('preset-modal-confirm-btn');

    // Image Viewer
    bind('image-viewer-page');
    bind('image-viewer-content');
  }
};