const elementsModule = {
    settingsIcon: null,
    settingsPanel: null,
    settingPages: null,
    settingsMainMenuPage: null,
    settingsMenuItems: null,
    roleSettingsMenuItems: null,
    chatRoomSettingsMenuItems: null,
    chatroomDetailSettingsMenuItems: null,
    closeButtons: null,

    apiKeyTextareaSettings: null,
    apiKeyFailureCountsDisplay: null,
    primaryModelSelectSettings: null,
    secondaryModelSelectSettings: null,
    chatArea: null,
    chatContainer: null,
    errorLogDisplay: null,
    clearErrorLogButton: null,
    copyErrorLogButton: null,
    clearAllConfigButton: null,
    exportConfigButton: null,
    importConfigFile: null,
    importConfigButton: null,

    temperatureSettings: null,
    topPSettings: null,
    topKSettings: null,
    maxOutputTokensSettings: null,
    systemInstructionSettings: null,
    responseMimeTypeSettings: null,
    user1InstructionSettings: null,
    user2InstructionSettings: null,
    model1InstructionSettings: null,
    model2InstructionSettings: null,
    user3InstructionSettings: null,
    referenceTextLengthSettings: null,
    worldInfoDisplay: null,

    responseSchemaJsonSettings: null,
    responseSchemaParserJsSettings: null,
    addRoleButton: null,
    roleListContainer: null,
    roleDetailHeaderTitle: null,
    roleDetailpage: null,
    roleInstructionTextarea: null,
    roleMemoryTextarea: null,
    roleStateTextarea: null,
    exportRoleButton: null,
    importRoleFile: null,
    importRoleButton: null,

    roleDrawingTemplateSettings: null,


    toolListMenuItems: null,
    toolListPage: null,

    drawingMasterPage: null,
    drawingMasterResponseSchemaJsonSettings: null,
    drawingMasterResponseSchemaParserJsSettings: null,
    drawingMasterUser2InstructionSettings: null,
    drawingMasterEnabledSettings: null,
    drawingMasterDisplaySettings: null,

    gameHostPage: null,
    gameHostResponseSchemaJsonSettings: null,
    gameHostResponseSchemaParserJsSettings: null,
    gameHostUser2InstructionSettings: null,
    gameHostEnabledSettings: null,
    gameHostDisplaySettings: null,

    writingMasterPage: null,
    writingMasterResponseSchemaJsonSettings: null,
    writingMasterResponseSchemaParserJsSettings: null,
    writingMasterUser2InstructionSettings: null,
    writingMasterEnabledSettings: null,
    writingMasterDisplaySettings: null,

    characterUpdateMasterPage: null,
    characterUpdateMasterResponseSchemaJsonSettings: null,
    characterUpdateMasterResponseSchemaParserJsSettings: null,
    characterUpdateMasterUser2InstructionSettings: null,
    characterUpdateMasterEnabledSettings: null,
    characterUpdateMasterDisplaySettings: null,


    chatRoomSettingsPage: null,
    generalConfigPage: null,
    chatRoomDirectoryPage: null,
    addChatroomButton: null,
    chatroomListContainer: null,
    chatRoomDetailPage: null,
    chatroomDetailHeaderTitle: null,
    currentChatroomSettingsPage: null,
    chatroomHistoryDisplay: null,
    chatroomRolePage: null,
    chatroomRoleListContainer: null,
    exportChatroomButton: null,
    importChatroomFile: null,
    importChatroomButton: null,

    clearChatroomHistoryButton: null,
    chatroomNovelPage: null,
    chatroomNovelListContainer: null,


    runPauseButton: null,
    roleButton: null,
    ruleButton: null,
    roleButtonsListContainer: null,

    topToolbar: null,
    addAdminButton: null,

    storyModeMenuItem: null,
    storyModePage: null,
    addNovelButton: null,
    novelListContainer: null,


    novelButton: null,
    novelInterface: null,
    novelBookshelfButton: null,
    novelTocButton: null,
    novelContentArea: null,
    novelContentDisplay: null,
    novelBookshelfPage: null,
    novelTocPage: null,
    novelBookshelfCloseButton: null,
    novelTocCloseButton: null,
    novelBookshelfListContainer: null,
    novelTocListContainer: null,

    imageViewerPage: null,
    imageViewerContent: null,

    novelaiApiKeySettings: null,
    novelaiModelSettings: null,
    novelaiArtistChainSettings: null,
    novelaiDefaultPositivePromptSettings: null,
    novelaiDefaultNegativePromptSettings: null,
    novelaiLastPromptDisplay: null,
    novelaiWidthSettings: null,
    novelaiHeightSettings: null,
    novelaiStepsSettings: null,
    novelaiScaleSettings: null,
    novelaiCfgRescaleSettings: null,
    novelaiSamplerSettings: null,
    novelaiNoiseScheduleSettings: null,
    novelaiSeedSettings: null,


    roleplayRulesTextarea: null,
    publicInfoTextarea: null,

    init: function() {
        this.settingsIcon = document.getElementById('settings-icon');
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingPages = document.querySelectorAll('.setting-page-template');
        this.settingsMainMenuPage = document.getElementById('settings-main-page');
        this.settingsMenuItems = document.querySelectorAll('#settings-menu .settings-menu-item');
        this.roleSettingsMenuItems = document.querySelectorAll('#role-settings-menu .settings-menu-item');
        this.chatRoomSettingsMenuItems = document.querySelectorAll('#chat-room-settings-menu .settings-menu-item');
        this.chatroomDetailSettingsMenuItems = document.querySelectorAll('#chatroom-settings-menu .settings-menu-item');
        this.closeButtons = document.querySelectorAll('.close-button');

        this.apiKeyTextareaSettings = document.getElementById('api-key-textarea-settings');
        this.apiKeyFailureCountsDisplay = document.getElementById('api-key-failure-counts-display');
        this.primaryModelSelectSettings = document.getElementById('primary-model-select-settings');
        this.secondaryModelSelectSettings = document.getElementById('secondary-model-select-settings');
        this.chatArea = document.getElementById('chat-area');
        this.chatContainer = document.getElementById('chat-container');
        this.errorLogDisplay = document.getElementById('error-log-display');
        this.clearErrorLogButton = document.getElementById('clear-error-log-button');
        this.copyErrorLogButton = document.getElementById('copy-error-log-button');
        this.clearAllConfigButton = document.getElementById('clear-all-config-button');
        this.exportConfigButton = document.getElementById('export-config-button');
        this.importConfigFile = document.getElementById('import-config-file');
        this.importConfigButton = document.getElementById('import-config-button');

        this.temperatureSettings = document.getElementById('temperature-settings');
        this.topPSettings = document.getElementById('top-p-settings');
        this.topKSettings = document.getElementById('top-k-settings');
        this.maxOutputTokensSettings = document.getElementById('max-output-tokens-settings');
        this.systemInstructionSettings = document.getElementById('system-instruction-settings');
        this.responseMimeTypeSettings = document.getElementById('response-mime-type-settings');
        this.user1InstructionSettings = document.getElementById('user1-instruction-settings');
        this.user2InstructionSettings = document.getElementById('user2-instruction-settings');
        this.model1InstructionSettings = document.getElementById('model1-instruction-settings');
        this.model2InstructionSettings = document.getElementById('model2-instruction-settings');
        this.user3InstructionSettings = document.getElementById('user3-instruction-settings');
        this.referenceTextLengthSettings = document.getElementById('reference-text-length-settings');
        this.worldInfoDisplay = document.getElementById('world-info-display');

        this.responseSchemaJsonSettings = document.getElementById('response-schema-json-settings');
        this.responseSchemaParserJsSettings = document.getElementById('response-schema-parser-js-settings');
        this.addRoleButton = document.getElementById('add-role-button');
        this.roleListContainer = document.getElementById('role-list-container');
        this.roleDetailHeaderTitle = document.getElementById('role-detail-header-title');
        this.roleDetailpage = document.getElementById('role-detail-page');
        this.roleInstructionTextarea = document.getElementById('role-instruction-textarea');
        this.roleMemoryTextarea = document.getElementById('role-memory-textarea');
        this.roleStateTextarea = document.getElementById('role-state-textarea');
        this.exportRoleButton = document.getElementById('export-role-button');
        this.importRoleFile = document.getElementById('import-role-file');
        this.importRoleButton = document.getElementById('import-role-button');

        this.roleDrawingTemplateSettings = document.getElementById('role-drawing-template-settings');


        this.toolListMenuItems = document.querySelectorAll('#tool-list-container .tool-item');
        this.toolListPage = document.getElementById('tool-list-page');

        this.drawingMasterPage = document.getElementById('drawing-master-page');
        this.drawingMasterResponseSchemaJsonSettings = document.getElementById('drawing-master-response-schema-json-settings');
        this.drawingMasterResponseSchemaParserJsSettings = document.getElementById('drawing-master-response-schema-parser-js-settings');
        this.drawingMasterUser2InstructionSettings = document.getElementById('drawing-master-user2-instruction-settings');
        this.drawingMasterEnabledSettings = document.getElementById('drawing-master-enabled-settings');
        this.drawingMasterDisplaySettings = document.getElementById('drawing-master-display-settings');

        this.gameHostPage = document.getElementById('game-host-page');
        this.gameHostResponseSchemaJsonSettings = document.getElementById('game-host-response-schema-json-settings');
        this.gameHostResponseSchemaParserJsSettings = document.getElementById('game-host-response-schema-parser-js-settings');
        this.gameHostUser2InstructionSettings = document.getElementById('game-host-user2-instruction-settings');
        this.gameHostEnabledSettings = document.getElementById('game-host-enabled-settings');
        this.gameHostDisplaySettings = document.getElementById('game-host-display-settings');

        this.writingMasterPage = document.getElementById('writing-master-page');
        this.writingMasterResponseSchemaJsonSettings = document.getElementById('writing-master-response-schema-json-settings');
        this.writingMasterResponseSchemaParserJsSettings = document.getElementById('writing-master-response-schema-parser-js-settings');
        this.writingMasterUser2InstructionSettings = document.getElementById('writing-master-user2-instruction-settings');
        this.writingMasterEnabledSettings = document.getElementById('writing-master-enabled-settings');
        this.writingMasterDisplaySettings = document.getElementById('writing-master-display-settings');

        this.characterUpdateMasterPage = document.getElementById('character-update-master-page');
        this.characterUpdateMasterResponseSchemaJsonSettings = document.getElementById('character-update-master-response-schema-json-settings');
        this.characterUpdateMasterResponseSchemaParserJsSettings = document.getElementById('character-update-master-response-schema-parser-js-settings');
        this.characterUpdateMasterUser2InstructionSettings = document.getElementById('character-update-master-user2-instruction-settings');
        this.characterUpdateMasterEnabledSettings = document.getElementById('character-update-master-enabled-settings');
        this.characterUpdateMasterDisplaySettings = document.getElementById('character-update-master-display-settings');


        this.chatRoomSettingsPage = document.getElementById('chat-room-settings-page');
        this.generalConfigPage = document.getElementById('general-config-page');
        this.chatRoomDirectoryPage = document.getElementById('chat-room-directory-page');
        this.addChatroomButton = document.getElementById('add-chatroom-button');
        this.chatroomListContainer = document.getElementById('chatroom-list-container');
        this.chatRoomDetailPage = document.getElementById('chat-room-detail-page');
        this.chatroomDetailHeaderTitle = document.getElementById('chatroom-detail-header-title');
        this.currentChatroomSettingsPage = document.getElementById('current-chatroom-settings-page');
        this.chatroomHistoryDisplay = document.getElementById('chatroom-history-display');
        this.chatroomRolePage = document.getElementById('chatroom-role-page');
        this.chatroomRoleListContainer = document.getElementById('chatroom-role-list-container');
        this.exportChatroomButton = document.getElementById('export-chatroom-button');
        this.importChatroomFile = document.getElementById('import-chatroom-file');
        this.importChatroomButton = document.getElementById('import-chatroom-button');

        this.clearChatroomHistoryButton = document.getElementById('clear-chatroom-history-button');
        this.chatroomNovelPage = document.getElementById('chatroom-novel-page');
        this.chatroomNovelListContainer = document.getElementById('chatroom-novel-list-container');


        this.runPauseButton = document.getElementById('run-pause-button');
        this.roleButton = document.getElementById('role-button');
        this.ruleButton = document.getElementById('rule-button');
        this.roleButtonsListContainer = document.getElementById('role-buttons-list-container');

        this.topToolbar = document.getElementById('top-toolbar');
        this.addAdminButton = document.getElementById('add-admin-button');

        this.storyModeMenuItem = document.getElementById('story-mode-menu-item');
        this.storyModePage = document.getElementById('story-mode-page');
        this.addNovelButton = document.getElementById('add-novel-button');
        this.novelListContainer = document.getElementById('novel-list-container');


        this.novelButton = document.getElementById('novel-button');
        this.novelInterface = document.getElementById('novel-interface');
        this.novelBookshelfButton = document.getElementById('novel-bookshelf-button');
        this.novelTocButton = document.getElementById('novel-toc-button');
        this.novelContentArea = document.getElementById('novel-content-area');
        this.novelContentDisplay = document.getElementById('novel-content-area');
        this.novelBookshelfPage = document.getElementById('novel-bookshelf-page');
        this.novelTocPage = document.getElementById('novel-toc-page');
        this.novelBookshelfCloseButton = document.querySelector('#novel-bookshelf-page .novel-close-button');
        this.novelTocCloseButton = document.querySelector('#novel-toc-page .novel-close-button');
        this.novelBookshelfListContainer = document.getElementById('novel-bookshelf-list-container');
        this.novelTocListContainer = document.getElementById('novel-toc-list-container');

        this.imageViewerPage = document.getElementById('image-viewer-page');
        this.imageViewerContent = document.getElementById('image-viewer-content');

        this.novelaiApiKeySettings = document.getElementById('novelai-api-key-settings');
        this.novelaiModelSettings = document.getElementById('novelai-model-settings');
        this.novelaiArtistChainSettings = document.getElementById('novelai-artist-chain-settings');
        this.novelaiDefaultPositivePromptSettings = document.getElementById('novelai-default-positive-prompt-settings');
        this.novelaiDefaultNegativePromptSettings = document.getElementById('novelai-default-negative-prompt-settings');
        this.novelaiLastPromptDisplay = document.getElementById('novelai-last-prompt-display');
        this.novelaiWidthSettings = document.getElementById('novelai-width-settings');
        this.novelaiHeightSettings = document.getElementById('novelai-height-settings');
        this.novelaiStepsSettings = document.getElementById('novelai-steps-settings');
        this.novelaiScaleSettings = document.getElementById('novelai-scale-settings');
        this.novelaiCfgRescaleSettings = document.getElementById('novelai-cfg-rescale-settings');
        this.novelaiSamplerSettings = document.getElementById('novelai-sampler-settings');
        this.novelaiNoiseScheduleSettings = document.getElementById('novelai-noise-schedule-settings');
        this.novelaiSeedSettings = document.getElementById('novelai-seed-settings');


        this.roleplayRulesTextarea = document.getElementById('roleplay-rules-textarea');
        this.publicInfoTextarea = document.getElementById('public-info-textarea');

    }
};