default_config = {
    "version": 1,
    "temperature": "1.0",
    "topP": "0.9",
    "topK": "40",
    "maxOutputTokens": "2048",
    "responseMimeType": "application/json",
    "promptPresetTurns": [],
    "primary_model_id": "",
    "secondary_model_id": "",
    "tertiary_model_id": "",
    "apiConnectionMode": "direct",
    "frontend_proxy_enabled": False,
    "useBackupProxyOnly": False,
    "proxy_url": "",
    "proxy_api_key": "",
    "proxy_url_2": "",
    "proxy_api_key_2": "",
    "backup_proxy_url": "",
    "backup_proxy_api_key": "",
    "responseSchemaJson": "",
    "responseSchemaParserJs": "",
    "sharedDatabaseInstruction": "",
    "mainPrompt": "",
    "clothingGuide": "",
    "toolSettings": {
        "drawingMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": "", "novelContent": ""},
        "statusProcessingSystem": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "gameHost": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "characterUpdateMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "privateAssistant": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "novelSummaryMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "characterCreationMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": "", "originalNovelLength": 10000},
        "scriptCreationMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": "", "originalNovelLength": 10000},
        "plotSummaryMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
        "knowledgeRecordingMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": "", "originalNovelLength": 10000},
        "closeUpMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""}
    },
    "activeChatRoomName": None,
    "chatRoomOrder": [],
    "isRunPaused": True,
    "isRoleListVisible": False,
    "originalNovelLength": 1,
    "novelaiApiSource": "official",
    "novelaiProxyUrl": "",
    "novelaiProxyToken": "",
    "novelaiModel": "nai-diffusion-4-5-full",
    "novelaiArtistChain": "",
    "novelaiDefaultPositivePrompt": "",
    "novelaiDefaultNegativePrompt": "",
    "novelaiWidth": 832,
    "novelaiHeight": 1216,
    "novelaiSteps": 28,
    "novelaiScale": 5.0,
    "novelaiCfgRescale": 0.0,
    "novelaiSampler": "k_euler",
    "novelaiNoiseSchedule": "native",
    "novelaiSeed": 0,
    "systemInstruction": "",
    "activePartitionIdByChatroom": {},
    "generalModelSelectionType": "primary",
    "debugMode": False,
    "apiKeyGroupsText": [],
    "novelaiApiKey": "",
    "novelaiTemplateMappings": []
}

SECRETS_KEYS = [
    "apiKeyGroupsText",
    "novelaiApiKey",
    "novelaiProxyToken",
    "proxy_api_key",
    "proxy_api_key_2",
    "backup_proxy_api_key",
    "proxy_url",
    "proxy_url_2",
    "backup_proxy_url",
    "novelaiProxyUrl"
]

ROLEPLAY_KEYS = [
    "systemInstruction",
    "mainPrompt",
    "responseSchemaJson",
    "responseSchemaParserJs",
    "sharedDatabaseInstruction",
    "clothingGuide"
]

PRESETS_KEYS = [
    "promptPresetTurns",
    "novelaiTemplateMappings",
    "novelaiArtistChain",
    "novelaiDefaultPositivePrompt",
    "novelaiDefaultNegativePrompt"
]

default_chatroom_config = {
    "version": 1,
    "name": "",
    "publicInfo": "",
    "user": "",
    "backgroundImageFilename": None,
    "partitionsOrder": [],
    "activePartitionId": None,
    "identityGroups": [],
    "overrideSettings": {
        "general": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "sharedDatabaseInstruction": "", "mainPrompt": ""},
        "drawingMaster": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": "", "novelContent": ""},
        "statusProcessingSystem": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""},
        "gameHost": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""},
        "characterUpdateMaster": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""},
        "privateAssistant": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""},
        "novelSummaryMaster": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""},
        "closeUpMaster": {"enabled": False, "model_selection_type": "primary", "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "mainPrompt": ""}
    }
}

default_partition_config = {
    "version": 1,
    "id": "",
    "name": "Default Partition",
    "roleplayRules": "",
    "roleAliases": [],
    "script": "",
    "activeNovelIds": [],
    "novelCurrentChapterIndices": {},
    "history": [],
    "currentNovelId": None,
    "lastViewedNovelId": None,
    "isSwitchable": False,
    "autoTriggerNextCharacter": False,
    "allowCrossPartitionHistoryAccess": False
}


default_role_config = {
    "name": "",
    "memory": [],
    "publicInfo": [],
    "drawingTemplate": "",
    "isDrawingEnabled": True,
    "mbti": "",
    "bigFiveOpenness": "",
    "bigFiveConscientiousness": "",
    "bigFiveExtraversion": "",
    "bigFiveAgreeableness": "",
    "bigFiveNeuroticism": "",
    "archetypes": [],
    "keywords": [],
    "otherInfo": ""
}

default_event_record = {
    "id": "",
    "involvedCharacters": [],
    "time": "",
    "content": ""
}

default_events_file = {
    "events": []
}