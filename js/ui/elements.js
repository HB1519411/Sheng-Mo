const elementsModule = {
  modelToggleButton: null,
  settingsIcon: null,
  settingsPanel: null,
  settingPages: null,
  settingsMainMenuPage: null,
  settingsMenuItems: null,
  chatRoomSettingsMenuItems: null,
  chatroomDetailSettingsMenuItems: null,
  closeButtons: null,
  chatArea: null,
  chatContainer: null,
  errorLogDisplay: null,
  copyErrorLogButton: null,
  clearAllConfigButton: null,
  exportConfigButton: null,
  importConfigFile: null,
  importConfigButton: null,
  roleListContainer: null,
  addChatroomRoleButton: null,
  importRoleFile: null,
  importRoleButton: null,
  roleDetailHeaderTitle: null,
  roleDetailPage: null,
  editRoleSettingButton: null,
  editRoleMemoryButton: null,
  editRolePublicInfoButton: null,
  roleStateTextarea: null,
  roleDrawingTemplateSettings: null,
  exportRoleButton: null,
  roleSettingDetailPage: null,
  roleSettingDetailHeaderTitle: null,
  roleMemoryListPage: null,
  roleMemoryListHeaderTitle: null,
  addMemoryItemForm: null,
  newMemoryTimeInput: null,
  newMemoryContentTextarea: null,
  addMemoryButton: null,
  roleMemoryListContainer: null,
  rolePublicInfoListPage: null,
  rolePublicInfoListHeaderTitle: null,
  addPublicInfoItemForm: null,
  newPublicInfoKeywordInput: null,
  newPublicInfoContentTextarea: null,
  addPublicInfoButton: null,
  rolePublicInfoListContainer: null,
  toolListMenuItems: null,
  toolListPage: null,
  chatRoomSettingsPage: null,
  generalConfigPage: null,
  chatRoomDirectoryPage: null,
  addChatroomButton: null,
  chatroomListContainer: null,
  importChatroomFile: null,
  importChatroomButton: null,
  chatRoomDetailPage: null,
  chatroomDetailHeaderTitle: null,
  currentChatroomSettingsPage: null,
  identityGroupsPage: null,
  identityGroupsListContainer: null,
  addIdentityGroupButton: null,
  storyModePage: null,
  novelListContainer: null,
  novelButton: null,
  novelInterface: null,
  novelBookshelfButton: null,
  novelTocButton: null,
  novelSummaryButton: null,
  novelStructureButton: null,
  novelContentPage: null,
  novelContentArea: null,
  novelContentDisplay: null,
  novelBookshelfPage: null,
  novelTocPage: null,
  novelSummaryPage: null,
  novelStructurePage: null,
  novelBookshelfCloseButton: null,
  novelTocCloseButton: null,
  novelSummaryCloseButton: null,
  novelStructureCloseButton: null,
  novelBookshelfListContainer: null,
  novelTocListContainer: null,
  novelSummaryContentArea: null,
  novelStructureContentArea: null,
  imageViewerPage: null,
  imageViewerContent: null,
  runPauseButton: null,
  roleButton: null,
  ruleButton: null,
  roleButtonsListContainer: null,
  partitionListContainer: null,
  topToolbar: null,
  loadingSpinner: null,
  addAdminButton: null,
  userControlTriggerButton: null,
  activeRoleTriggerList: null,
  autoTriggerButton: null,
  globalLoadingOverlay: null,
  promptPresetPage: null,
  novelContentButton: null,
  novelCloseButton: null,
  novelSearchInput: null,
  novelSearchPrevBtn: null,
  novelSearchNextBtn: null,
  novelSyncProgressButton: null,
  importKnowledgeImageFile: null,
  importKnowledgeImageButton: null,
  importKnowledgeJsonFile: null,
  importKnowledgeJsonButton: null,
  presetSelectionModalOverlay: null,
  presetModalTitle: null,
  presetModalListContainer: null,
  presetModalCancelBtn: null,
  presetModalConfirmBtn: null,
  init: function() {
    this.settingsIcon = document.getElementById('settings-icon');
    this.settingsPanel = document.getElementById('settings-panel');
    this.settingPages = document.querySelectorAll('.setting-page-template');
    this.settingsMainMenuPage = document.getElementById('settings-main-page');
    this.settingsMenuItems = document.querySelectorAll('#settings-menu .settings-menu-item');
    this.chatRoomSettingsMenuItems = document.querySelectorAll('#chat-room-settings-menu .settings-menu-item');
    this.chatroomDetailSettingsMenuItems = document.querySelectorAll('#chatroom-settings-menu .settings-menu-item');
    this.closeButtons = document.querySelectorAll('.close-button');
    this.chatArea = document.getElementById('chat-area');
    this.chatContainer = document.getElementById('chat-container');
    this.errorLogDisplay = document.getElementById('error-log-display');
    this.copyErrorLogButton = document.getElementById('copy-error-log-button');
    this.clearAllConfigButton = document.getElementById('clear-all-config-button');
    this.exportConfigButton = document.getElementById('export-config-button');
    this.importConfigFile = document.getElementById('import-config-file');
    this.importConfigButton = document.getElementById('import-config-button');
    this.roleListContainer = document.getElementById('role-list-container');
    this.addChatroomRoleButton = document.getElementById('add-chatroom-role-button');
    this.importRoleFile = document.getElementById('import-role-file');
    this.importRoleButton = document.getElementById('import-role-button');
    this.roleDetailHeaderTitle = document.getElementById('role-detail-header-title');
    this.roleDetailPage = document.getElementById('role-detail-page');
    this.editRoleSettingButton = document.getElementById('edit-role-setting-button');
    this.editRoleMemoryButton = document.getElementById('edit-role-memory-button');
    this.editRolePublicInfoButton = document.getElementById('edit-role-public-info-button');
    this.roleStateTextarea = document.getElementById('role-state-textarea');
    this.roleDrawingTemplateSettings = document.getElementById('role-drawing-template-settings');
    this.exportRoleButton = document.getElementById('export-role-button');
    this.roleSettingDetailPage = document.getElementById('role-setting-detail-page');
    this.roleSettingDetailHeaderTitle = document.getElementById('role-setting-detail-header-title');
    this.roleMemoryListPage = document.getElementById('role-memory-list-page');
    this.roleMemoryListHeaderTitle = document.getElementById('role-memory-list-header-title');
    this.addMemoryItemForm = document.getElementById('add-memory-item-form');
    this.newMemoryTimeInput = document.getElementById('new-memory-time');
    this.newMemoryContentTextarea = document.getElementById('new-memory-content');
    this.addMemoryButton = document.getElementById('add-memory-button');
    this.roleMemoryListContainer = document.getElementById('role-memory-list-container');
    this.rolePublicInfoListPage = document.getElementById('role-public-info-list-page');
    this.rolePublicInfoListHeaderTitle = document.getElementById('role-public-info-list-header-title');
    this.addPublicInfoItemForm = document.getElementById('add-public-info-item-form');
    this.newPublicInfoKeywordInput = document.getElementById('new-public-info-keyword');
    this.newPublicInfoContentTextarea = document.getElementById('new-public-info-content');
    this.addPublicInfoButton = document.getElementById('add-public-info-button');
    this.rolePublicInfoListContainer = document.getElementById('role-public-info-list-container');
    this.toolListMenuItems = document.querySelectorAll('#tool-list-container .tool-item');
    this.toolListPage = document.getElementById('tool-list-page');
    this.chatRoomSettingsPage = document.getElementById('chat-room-settings-page');
    this.generalConfigPage = document.getElementById('general-config-page');
    this.chatRoomDirectoryPage = document.getElementById('chat-room-directory-page');
    this.addChatroomButton = document.getElementById('add-chatroom-button');
    this.chatroomListContainer = document.getElementById('chatroom-list-container');
    this.importChatroomFile = document.getElementById('import-chatroom-file');
    this.importChatroomButton = document.getElementById('import-chatroom-button');
    this.chatRoomDetailPage = document.getElementById('chat-room-detail-page');
    this.chatroomDetailHeaderTitle = document.getElementById('chatroom-detail-header-title');
    this.currentChatroomSettingsPage = document.getElementById('current-chatroom-settings-page');
    this.identityGroupsPage = document.getElementById('identity-groups-page');
    this.identityGroupsListContainer = document.getElementById('identity-groups-list-container');
    this.addIdentityGroupButton = document.getElementById('add-identity-group-button');
    this.storyModePage = document.getElementById('story-mode-page');
    this.novelListContainer = document.getElementById('novel-list-container');
    this.novelButton = document.getElementById('novel-button');
    this.novelInterface = document.getElementById('novel-interface');
    this.novelBookshelfButton = document.getElementById('novel-bookshelf-button');
    this.novelTocButton = document.getElementById('novel-toc-button');
    this.novelSummaryButton = document.getElementById('novel-summary-button');
    this.novelStructureButton = document.getElementById('novel-structure-button');
    this.novelContentPage = document.getElementById('novel-content-page');
    this.novelContentArea = document.getElementById('novel-content-area');
    this.novelContentDisplay = document.getElementById('novel-content-area');
    this.novelBookshelfPage = document.getElementById('novel-bookshelf-page');
    this.novelTocPage = document.getElementById('novel-toc-page');
    this.novelSummaryPage = document.getElementById('novel-summary-page');
    this.novelStructurePage = document.getElementById('novel-structure-page');
    this.novelBookshelfCloseButton = document.querySelector('#novel-bookshelf-page .novel-close-button');
    this.novelTocCloseButton = document.querySelector('#novel-toc-page .novel-close-button');
    this.novelSummaryCloseButton = document.querySelector('#novel-summary-page .novel-close-button');
    this.novelStructureCloseButton = document.querySelector('#novel-structure-page .novel-close-button');
    this.novelBookshelfListContainer = document.getElementById('novel-bookshelf-list-container');
    this.novelTocListContainer = document.getElementById('novel-toc-list-container');
    this.novelSummaryContentArea = document.getElementById('novel-summary-content-area');
    this.novelStructureContentArea = document.getElementById('novel-structure-content-area');
    this.imageViewerPage = document.getElementById('image-viewer-page');
    this.imageViewerContent = document.getElementById('image-viewer-content');
    this.runPauseButton = document.getElementById('run-pause-button');
    this.roleButton = document.getElementById('role-button');
    this.ruleButton = document.getElementById('rule-button');
    this.roleButtonsListContainer = document.getElementById('role-buttons-list-container');
    this.partitionListContainer = document.getElementById('partition-list-container');
    this.topToolbar = document.getElementById('top-toolbar');
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.addAdminButton = document.getElementById('add-admin-button');
    this.userControlTriggerButton = document.getElementById('user-control-trigger-button');
    this.activeRoleTriggerList = document.getElementById('active-role-trigger-list');
    this.autoTriggerButton = document.getElementById('auto-trigger-button');
    this.modelToggleButton = document.getElementById('model-toggle-button');
    this.globalLoadingOverlay = document.getElementById('global-loading-overlay');
    this.promptPresetPage = document.getElementById('prompt-preset-page');
    this.novelContentButton = document.getElementById('novel-content-button');
    this.novelCloseButton = document.getElementById('novel-close-button');
    this.novelSearchInput = document.getElementById('novel-search-input');
    this.novelSearchPrevBtn = document.getElementById('novel-search-prev-btn');
    this.novelSearchNextBtn = document.getElementById('novel-search-next-btn');
    this.novelSyncProgressButton = document.getElementById('novel-sync-progress-button');
    this.importKnowledgeImageFile = document.getElementById('import-knowledge-image-file');
    this.importKnowledgeImageButton = document.getElementById('import-knowledge-image-button');
    this.importKnowledgeJsonFile = document.getElementById('import-knowledge-json-file');
    this.importKnowledgeJsonButton = document.getElementById('import-knowledge-json-button');
    
    this.presetSelectionModalOverlay = document.getElementById('preset-selection-modal-overlay');
    this.presetModalTitle = document.getElementById('preset-modal-title');
    this.presetModalListContainer = document.getElementById('preset-modal-list-container');
    this.presetModalCancelBtn = document.getElementById('preset-modal-cancel-btn');
    this.presetModalConfirmBtn = document.getElementById('preset-modal-confirm-btn');
  }
};