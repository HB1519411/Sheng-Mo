const defaultConfig = {
  version: 1,
  temperature: '1.0',
  topP: '0.9',
  topK: '40',
  maxOutputTokens: '65536',
  rateLimitPerMinute: "8",
  promptPresetTurns: [],
  primary_model_id: "gemini-2.0-flash",
  secondary_model_id: "gemini-2.0-flash",
  tertiary_model_id: "gemini-2.0-flash",
  frontend_proxy_enabled: false,
  useBackupProxyOnly: false,
  backup_proxy_url: "",
  backup_proxy_api_key: "",
  sharedDatabaseInstruction: "",
  mainPrompt: "",
  clothingGuide: "",
  drawingMaster_novelContent: "",
  toolSettings: {
    drawingMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    statusProcessingSystem: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    gameHost: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    characterUpdateMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    privateAssistant: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    novelSummaryMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    characterCreationMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: '',
      originalNovelLength: 10000
    },
    scriptCreationMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: '',
      originalNovelLength: 10000
    },
    plotSummaryMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    },
    knowledgeRecordingMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: '',
      originalNovelLength: 10000
    },
    closeUpMaster: {
      responseSchemaJson: '',
      responseSchemaParserJs: '',
      toolDatabaseInstruction: '',
      enabled: false,
      model_selection_type: 'primary',
      mainPrompt: ''
    }
  },
  activeChatRoomName: null,
  chatRoomOrder: [],
  isRunPaused: true,
  isRoleListVisible: false,
  originalNovelLength: 1,
  novelaiApiSource: "official",
  novelaiProxyUrl: "",
  novelaiProxyToken: "",
  novelaiModel: "nai-diffusion-4-5-full",
  novelaiArtistChain: "",
  novelaiDefaultPositivePrompt: "",
  novelaiDefaultNegativePrompt: "",
  novelaiWidth: 832,
  novelaiHeight: 1216,
  novelaiSteps: 28,
  novelaiScale: 5.0,
  novelaiCfgRescale: 0.0,
  novelaiSampler: "k_euler",
  novelaiNoiseSchedule: "native",
  novelaiSeed: 0,
  systemInstruction: "",
  concurrencyLevel: 1,
  activePartitionIdByChatroom: {},
  generalModelSelectionType: "primary",
  debugMode: false,
  apiKeyGroupsText: [],
  novelaiApiKey: "",
  novelaiTemplateMappings: []
};
const defaultChatroomConfig = {
  version: 1,
  name: "",
  publicInfo: "",
  user: "",
  backgroundImageFilename: null,
  partitionsOrder: [],
  activePartitionId: null,
  identityGroups: []
};
const defaultPartitionConfig = {
  version: 1,
  id: "",
  name: "Default Partition",
  roleplayRules: "",
  roleAliases: [],
  script: "",
  activeNovelIds: [],
  novelCurrentChapterIndices: {},
  history: [],
  currentNovelId: null,
  lastViewedNovelId: null,
  isSwitchable: false,
  autoTriggerNextCharacter: false,
  allowCrossPartitionHistoryAccess: false,
};
const defaultRoleData = {
  name: "",
  memory: [],
  publicInfo: [],
  drawingTemplate: "",
  isDrawingEnabled: true,
  mbti: "",
  bigFiveOpenness: "",
  bigFiveConscientiousness: "",
  bigFiveExtraversion: "",
  bigFiveAgreeableness: "",
  bigFiveNeuroticism: "",
  archetypes: [],
  keywords: [],
  otherInfo: ""
};

const stateManager = (() => {
  const _state = {
    config: JSON.parse(JSON.stringify(defaultConfig)),
    currentChatroomDetails: {
      config: JSON.parse(JSON.stringify(defaultChatroomConfig)),
      roles: [],
      novels: [],
      partitions: new Map(),
      events: []
    },
    activeSettingPage: null,
    pageStack: [],
    activeMessageActions: null,
    editingMessageContainer: null,
    currentRole: null,
    activeRoleStateButtons: null,
    availableModels: [],
    activePartitionId: null,
    isNovelInterfaceVisible: false,
    activeNovelPage: null,
    novelPageStack: [],
    lastViewedNovelPageByPartition: new Map(),
    currentTocIndexByNovel: {},
    isNovelLoading: false,
    scrollUpdateTimer: null,
    novelSearchState: {
      query: '',
      lastMatchChapterIndex: -1,
      lastMatchIndexInContent: -1,
    },
    naiRequestQueue: [],
    isNaiProcessing: false,
    lastNaiPrompt: "",
    activeRequests: new Set(),
    isCooldownActive: false,
    cooldownTimer: null,
    isPartitionSwitchingCooldown: false,
    lastUserMessageContentForGameHost: null,
    isSummaryPageVisible: false,
    activeSummaryPage: null,
    summaryPageStack: [],
    summaryScrollUpdateTimer: null,
    summaryGenerationQueue: [],
    isSummaryProcessing: false,
    activeSummaryRequests: 0,
    MAX_SUMMARY_REQUESTS: 1,
    pendingRequests: new Map(),
    newMessagesInPartitions: new Set(),
    tempAttachedImagesByMessageId: new Map(),
    drawingMasterImageCache: new Map(),
    lastUserModificationTimestamp: 0,
    lastAutoSwitchTimestamp: 0,
    autoSwitchCooldownMs: 1000,
    isAutoSwitchingPartition: false,
    summaryConsecutiveFailures: 0,
    summaryCooldownTimer: null,
    isSwitchingChatroom: false,
    transactionQueues: new Map(),
    lockedResources: new Set(),
    partitionDOMCache: new Map(),
    partitionScrollPositions: new Map(),
  };

  const commit = (mutationName, payload) => {
    if (mutations[mutationName]) {
      mutations[mutationName](_state, payload);
      if (mutationName === 'SET_INITIAL_DATA') {
        eventBus.emit('STATE_UPDATED_FROM_SERVER', payload);
      }
    }
  };

  return {
    getRawState: () => _state,
    commit: commit
  };
})();

const stateModule = stateManager.getRawState();

window.shengmoAPI = {
  getState: () => JSON.parse(JSON.stringify(stateModule)),
};

const toolNameMap = {
  drawingMaster: "绘图大师",
  statusProcessingSystem: "状态处理系统",
  gameHost: "游戏主持人",
  characterUpdateMaster: "角色更新大师",
  privateAssistant: "私人助理",
  novelSummaryMaster: "小说总结大师",
  characterCreationMaster: "角色创建大师",
  scriptCreationMaster: "剧本创作大师",
  plotSummaryMaster: "情节总结大师",
  knowledgeRecordingMaster: "知识记录大师",
  closeUpMaster: "特写大师"
};