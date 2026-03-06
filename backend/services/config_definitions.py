default_config = {
    "version": 1,
    "temperature": "1.0",
    "topP": "0.9",
    "topK": "40",
    "maxOutputTokens": "65536",
    "rateLimitPerMinute": "8",
    "promptPresetTurns": [],
    "primary_model_id": "gemini-2.0-flash",
    "secondary_model_id": "gemini-2.0-flash",
    "tertiary_model_id": "gemini-2.0-flash",
    "frontend_proxy_enabled": False,
    "useBackupProxyOnly": False,
    "backup_proxy_url": "",
    "backup_proxy_api_key": "",
    "responseSchemaJson": "",
    "responseSchemaParserJs": "",
    "sharedDatabaseInstruction": "",
    "mainPrompt": "",
    "clothingGuide": "",
    "drawingMaster_novelContent": "",
    "toolSettings": {
        "drawingMaster": {"responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model_selection_type": "primary", "mainPrompt": ""},
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
    "novelaiProxyUrl": "",
    "novelaiProxyToken": "",
    "novelaiTemplateMappings": [],
    "concurrencyLevel": 1
}

SECRETS_KEYS = [
    "apiKeyGroupsText",
    "novelaiApiKey",
    "novelaiProxyToken",
    "backup_proxy_api_key",
    "backup_proxy_url",
    "novelaiProxyUrl",
    "clothingGuide",
    "novelaiTemplateMappings",
    "novelaiArtistChain",
    "novelaiDefaultPositivePrompt",
    "novelaiDefaultNegativePrompt",
    "activeChatRoomName",
    "chatRoomOrder",
    "activePartitionIdByChatroom",
    "drawingMaster_novelContent"
]

ROLEPLAY_KEYS = [
    "systemInstruction",
    "mainPrompt",
    "responseSchemaJson",
    "responseSchemaParserJs",
    "sharedDatabaseInstruction"
]

PRESETS_KEYS = [
    "promptPresetTurns"
]

default_chatroom_config = {
    "version": 1,
    "name": "",
    "publicInfo": "",
    "user": "",
    "backgroundImageFilename": None,
    "partitionsOrder": [],
    "activePartitionId": None,
    "identityGroups": []
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