const defaultConfig = {
    temperature: '1.0',
    topP: '0.9',
    topK: '40',
    maxOutputTokens: '2048',
    responseMimeType: 'application/json',
    promptPresetTurns: [],
    model: "",
    responseSchemaJson: "",
    responseSchemaParserJs: "",
    sharedDatabaseInstruction: "",
    mainPrompt: "",
    toolSettings: {
        drawingMaster: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '', novelContent: '' },
        gameHost: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '' },
        writingMaster: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '' },
        characterUpdateMaster: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '' },
        privateAssistant: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '' },
    },
    activeChatRoomName: null,
    chatRoomOrder: [],
    isRunPaused: true,
    isRoleListVisible: false,
    lastViewedNovelId: null,
    originalNovelLength: 10000,
    novelaiModel: "nai-diffusion-3",
    novelaiArtistChain: "",
    novelaiDefaultPositivePrompt: "",
    novelaiDefaultNegativePrompt: "",
    novelaiWidth: 1024,
    novelaiHeight: 1024,
    novelaiSteps: 28,
    novelaiScale: 5.0,
    novelaiCfgRescale: 0.0,
    novelaiSampler: "k_euler",
    novelaiNoiseSchedule: "native",
    novelaiSeed: 0,
    systemInstruction: ""
};

const defaultChatroomOverrideSettings = {
    general: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        sharedDatabaseInstruction: "",
        mainPrompt: ""
    },
    drawingMaster: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        toolDatabaseInstruction: "",
        mainPrompt: "",
        novelContent: ""
    },
    gameHost: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        toolDatabaseInstruction: "",
        mainPrompt: ""
    },
    writingMaster: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        toolDatabaseInstruction: "",
        mainPrompt: ""
    },
    characterUpdateMaster: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        toolDatabaseInstruction: "",
        mainPrompt: ""
    },
    privateAssistant: {
        enabled: false,
        model: "",
        responseSchemaJson: "",
        responseSchemaParserJs: "",
        toolDatabaseInstruction: "",
        mainPrompt: ""
    }
};

const stateModule = {
    config: JSON.parse(JSON.stringify(defaultConfig)),
    currentChatroomDetails: null,
    activeSettingPage: null,
    pageStack: [],
    activeMessageActions: null,
    editingMessageContainer: null,
    currentRole: null,
    activeRoleStateButtons: null,
    availableModels: [],
    chatContextCache: null,
    currentChatHistoryData: [],
    isNovelInterfaceVisible: false,
    activeNovelPage: null,
    novelPageStack: [],
    currentNovelId: null,
    currentTocIndexByNovel: {},
    isNovelLoading: false,
    scrollUpdateTimer: null,
    naiRequestQueue: [],
    isNaiProcessing: false,
    tempImageUrls: {},
    displayedImageCount: 0,
    displayedImageOrder: [],
    lastNaiPrompt: "",
    historySaveDebounceTimer: null,
    historySaveDebounceDelay: 2500,
    chatroomConfigSaveTimers: {},
    chatroomConfigSaveDelay: 1500,
    activeProxyRequestsCount: 0,
    isCooldownActive: false,
    cooldownTimer: null,
};
const API_KEYS_STORAGE_KEY = 'geminiChatApiKeys';
const NAI_API_KEY_STORAGE_KEY = 'geminiChatNaiApiKey';
const API_KEY_FAILURES_STORAGE_KEY = 'geminiChatApiKeyFailures';
const MAX_RETRIES = 5;
const REQUEST_TIMEOUT_MS = 60000;

const apiKeyManager = {
    _allKeys: [],
    _activeKeys: [],
    _silentKeys: [],
    _silentCapacity: 0,

    _getLocalStorageItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            _logAndDisplayError(`Failed to read from localStorage (key: ${key}): ${e.message}`, 'apiKeyManager');
            return null;
        }
    },
    _setLocalStorageItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            _logAndDisplayError(`Failed to write to localStorage (key: ${key}): ${e.message}`, 'apiKeyManager');
        }
    },
    getApiKeys: () => {
        return [...apiKeyManager._allKeys];
    },
    setApiKeys: (keys) => {
        if (!Array.isArray(keys)) return;
        apiKeyManager._allKeys = [...keys];
        apiKeyManager._activeKeys = [...keys];
        apiKeyManager._silentKeys = [];
        apiKeyManager._silentCapacity = Math.floor(keys.length / 2);
        apiKeyManager._setLocalStorageItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));

        const currentFailures = apiKeyManager._getApiKeyFailures();
        const newFailures = {};
        keys.forEach(key => {
            newFailures[key] = currentFailures[key] || 0;
        });
        apiKeyManager._setApiKeyFailures(newFailures);
    },
    loadApiKeysFromStorage: () => {
        const keysJson = apiKeyManager._getLocalStorageItem(API_KEYS_STORAGE_KEY);
        let keys = [];
        try {
            keys = keysJson ? JSON.parse(keysJson) : [];
            if (!Array.isArray(keys)) keys = [];
        } catch (e) {
            keys = [];
        }
        apiKeyManager.setApiKeys(keys);
    },
    getNaiApiKey: () => {
        return apiKeyManager._getLocalStorageItem(NAI_API_KEY_STORAGE_KEY) || '';
    },
    setNaiApiKey: (key) => {
        apiKeyManager._setLocalStorageItem(NAI_API_KEY_STORAGE_KEY, key || '');
    },
    selectApiKey: () => {
        if (apiKeyManager._activeKeys.length === 0) {
            if (apiKeyManager._silentKeys.length === 0) {
                throw new Error("No API keys available in active or silent pool.");
            }
            apiKeyManager._activeKeys = apiKeyManager._silentKeys.map(item => item.key);
            apiKeyManager._silentKeys = [];
        }

        const failures = apiKeyManager._getApiKeyFailures();
        let minFailures = Infinity;
        let candidates = [];

        apiKeyManager._activeKeys.forEach(key => {
            const failCount = failures[key] || 0;
            if (failCount < minFailures) {
                minFailures = failCount;
                candidates = [key];
            } else if (failCount === minFailures) {
                candidates.push(key);
            }
        });

        if (candidates.length === 0) {
             if (apiKeyManager._activeKeys.length > 0) {
                 candidates = [...apiKeyManager._activeKeys];
             } else {
                 throw new Error("Could not select a candidate API key.");
             }
        }

        const randomIndex = Math.floor(Math.random() * candidates.length);
        return candidates[randomIndex];
    },
    markApiKeyUsed: (usedKey) => {
        const activeIndex = apiKeyManager._activeKeys.indexOf(usedKey);
        if (activeIndex !== -1) {
            apiKeyManager._activeKeys.splice(activeIndex, 1);
        }

        apiKeyManager._silentKeys = apiKeyManager._silentKeys.filter(item => item.key !== usedKey);
        apiKeyManager._silentKeys.push({ key: usedKey, timestamp: Date.now() });

        while (apiKeyManager._silentKeys.length > apiKeyManager._silentCapacity) {
            const oldestEntry = apiKeyManager._silentKeys.shift();
            if (oldestEntry) {
                 apiKeyManager._activeKeys.push(oldestEntry.key);
            }
        }
    },
    _getApiKeyFailures: () => {
        const failuresJson = apiKeyManager._getLocalStorageItem(API_KEY_FAILURES_STORAGE_KEY);
        try {
            const failures = failuresJson ? JSON.parse(failuresJson) : {};
            return typeof failures === 'object' && failures !== null ? failures : {};
        } catch (e) {
            return {};
        }
    },
    _setApiKeyFailures: (failures) => {
        if (typeof failures === 'object' && failures !== null) {
            apiKeyManager._setLocalStorageItem(API_KEY_FAILURES_STORAGE_KEY, JSON.stringify(failures));
        }
    },
    incrementApiKeyFailure: (apiKey) => {
        if (!apiKey) return;
        const failures = apiKeyManager._getApiKeyFailures();
        failures[apiKey] = (failures[apiKey] || 0) + 1;
        apiKeyManager._setApiKeyFailures(failures);
        if (typeof uiSettingsModule !== 'undefined' && uiSettingsModule.updateApiKeyFailureCountsDisplay) {
            uiSettingsModule.updateApiKeyFailureCountsDisplay();
        }
    },
    getApiKeyFailureCounts: () => {
        return apiKeyManager._getApiKeyFailures();
    }
};
const _logAndDisplayError = (message, source = 'UnknownSource', lineno = 'N/A', colno = 'N/A', errorObj = null) => {
    const timestamp = new Date().toLocaleString();
    let fullMessage = `[${source} @ ${timestamp}] ${message}`;
    if (lineno !== 'N/A') fullMessage += ` (Line: ${lineno}, Col: ${colno})`;
    console.error(fullMessage, errorObj);

    if (typeof elementsModule !== 'undefined' && elementsModule.errorLogDisplay) {
        const currentLog = elementsModule.errorLogDisplay.value;
        const separator = currentLog ? '\n------------------------------\n' : '';
        elementsModule.errorLogDisplay.value += separator + fullMessage;
        elementsModule.errorLogDisplay.scrollTop = elementsModule.errorLogDisplay.scrollHeight;
    }
};

window.onerror = (message, source, lineno, colno, error) => {
    _logAndDisplayError(message, source, lineno, colno, error);
    return true;
};
window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let source = 'Promise';
    let errorObj = reason;
    if (reason instanceof Error) {
        message = reason.message;
        source = reason.stack ? reason.stack.split('\n')[1] || source : source;
    } else if (typeof reason === 'string') {
        message = reason;
    } else {
        try { message = JSON.stringify(reason); } catch { message = 'Non-serializable reason'; }
    }
    _logAndDisplayError(message, source, 'N/A', 'N/A', errorObj);
});

const configModule = {
    autoSaveConfig: () => {
        const configToSave = { ...stateModule.config };
        delete configToSave.isRunPaused;
        delete configToSave.errorLogs;
        delete configToSave.availableChatrooms;
        delete configToSave.currentChatroomDetails;

        fetch('/autosave-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configToSave)
        }).then(response => {
             if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status} for autosave`);
             }
         }).catch(error => {
             _logAndDisplayError(`Auto-save failed: ${error.message}`, 'autoSaveConfig');
         });
    },
    loadConfig: async () => {
        let loadedConfig;
        try {
            const response = await fetch('/load-config');
            if (response.ok) {
                 loadedConfig = await response.json();
                 if (!loadedConfig || typeof loadedConfig !== 'object') {
                     throw new Error("Loaded config is not a valid object.");
                 }
            } else {
                 throw new Error(`Failed to load config: ${response.status}. Using default.`);
            }
        } catch (error) {
             _logAndDisplayError(error.message, 'loadConfig');
             loadedConfig = JSON.parse(JSON.stringify(defaultConfig));
        }

        Object.keys(defaultConfig).forEach(key => {
             if (!(key in loadedConfig)) {
                 loadedConfig[key] = JSON.parse(JSON.stringify(defaultConfig[key]));
             } else if (key === 'toolSettings') {
                 Object.keys(defaultConfig.toolSettings).forEach(toolKey => {
                      if (!(toolKey in loadedConfig.toolSettings)) {
                          loadedConfig.toolSettings[toolKey] = JSON.parse(JSON.stringify(defaultConfig.toolSettings[toolKey]));
                      } else {
                          Object.keys(defaultConfig.toolSettings[toolKey]).forEach(subKey => {
                               if (!(subKey in loadedConfig.toolSettings[toolKey])) {
                                   loadedConfig.toolSettings[toolKey][subKey] = JSON.parse(JSON.stringify(defaultConfig.toolSettings[toolKey][subKey]));
                               }
                          });
                      }
                 });
             }
        });

        Object.assign(stateModule.config, loadedConfig);
        apiKeyManager.loadApiKeysFromStorage();
        stateModule.config.isRunPaused = true;
        stateModule.currentChatroomDetails = null;
        if (stateModule.config.activeChatRoomName) {
             await apiModule.fetchChatroomDetails(stateModule.config.activeChatRoomName);
        } else {
             updateChatContextCache();
        }
    }
};

const toolNameMap = {
    drawingMaster: "绘图大师",
    gameHost: "游戏主持人",
    writingMaster: "写作大师",
    characterUpdateMaster: "角色更新大师",
    privateAssistant: "私人助理"
};
function _formatObjectToCustomString(obj, indentLevel = 0) {
    let result = '';
    const indent = '  '.repeat(indentLevel);
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj)) {
        return '[Internal Error: Array passed directly]';
    }
    const keys = Object.keys(obj);
    keys.forEach((key) => {
        const value = obj[key];
        if (result !== '') result += '\n';
        result += `${indent}${key}`;
        if (Array.isArray(value)) {
            if (value.length > 0) {
                if (value.every(item => typeof item !== 'object' || item === null)) {
                    value.forEach(item => {
                        result += `\n${indent}  - ${item}`;
                    });
                } else {
                    value.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            const nestedObjectString = _formatObjectToCustomString(item, indentLevel + 1);
                            result += `\n${nestedObjectString}`;
                        } else {
                            result += `\n${indent}  - ${item}`;
                        }
                    });
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            const nestedString = _formatObjectToCustomString(value, indentLevel + 1);
            result += `\n${nestedString}`;
        } else {
            result += `: ${value}`;
        }
    });
    return result;
}

function getOriginalNovelTextForPayload() {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config) return "[无激活聊天室数据]";
    const activeNovelIds = chatroomDetails.config.activeNovelIds || [];
    const novelDefs = chatroomDetails.novels || [];
    const novelCurrentSegmentIds = chatroomDetails.config.novelCurrentSegmentIds || {};
    if (activeNovelIds.length === 0) return "[当前聊天室无激活小说]";
    const totalTargetChars = stateModule.config.originalNovelLength || defaultConfig.originalNovelLength;
    const perNovelChars = activeNovelIds.length > 0 ? Math.floor(totalTargetChars / activeNovelIds.length) : 0;
    if (perNovelChars <= 0) return "[字符分配不足]";
    const textSnippets = [];
    let missingContentNovels = [];
    for (const novelId of activeNovelIds) {
        const novelData = novelDefs.find(n => n.id === novelId);
        const novelName = novelData?.name || `小说 ${novelId.substring(0, 4)}`;
        if (!novelData || !novelData.segments || novelData.segments.length === 0) {
            missingContentNovels.push(novelName);
            continue;
        }
        const segments = novelData.segments;
        const numSegments = segments.length;
        let currentSegmentId = parseInt(novelCurrentSegmentIds[novelId], 10);
        if (isNaN(currentSegmentId) || currentSegmentId < 0 || currentSegmentId >= numSegments) {
            currentSegmentId = 0;
        }
        let charsCollected = 0;
        let currentSnippetSegments = [];
        const avgSegmentLength = segments.reduce((sum, seg) => sum + (seg.content ? seg.content.length : 0), 0) / numSegments || 200;
        const targetSegmentCount = Math.max(1, Math.ceil(perNovelChars / avgSegmentLength));
        const segmentsBefore = Math.floor(targetSegmentCount / 5);
        const segmentsAfter = targetSegmentCount - segmentsBefore -1;
        let startIdx = Math.max(0, currentSegmentId - segmentsBefore);
        let endIdx = Math.min(numSegments - 1, currentSegmentId + segmentsAfter);
        for (let i = startIdx; i <= endIdx; i++) {
             const segment = segments[i];
             if (segment && segment.content) {
                 currentSnippetSegments.push(segment.content);
                 charsCollected += segment.content.length;
             }
        }
        while (charsCollected < perNovelChars && (startIdx > 0 || endIdx < numSegments - 1)) {
             let added = false;
             if (startIdx > 0) {
                 startIdx--;
                 const segment = segments[startIdx];
                 if (segment && segment.content) {
                     currentSnippetSegments.unshift(segment.content);
                     charsCollected += segment.content.length;
                     added = true;
                 }
             }
             if (charsCollected < perNovelChars && endIdx < numSegments - 1) {
                 endIdx++;
                 const segment = segments[endIdx];
                  if (segment && segment.content) {
                     currentSnippetSegments.push(segment.content);
                     charsCollected += segment.content.length;
                     added = true;
                 }
             }
             if (!added) break;
        }
        let snippetText = currentSnippetSegments.join('\n');
        if (snippetText) {
             textSnippets.push(`--- ${novelName} (片段开始) ---\n${snippetText}\n--- ${novelName} (片段结束) ---`);
        }
    }
    if (missingContentNovels.length > 0) {
        const missingWarning = `\n\n[警告：以下激活小说内容未加载，无法包含：${missingContentNovels.join(', ')}]`;
        return textSnippets.join('\n\n') + missingWarning;
    } else if (textSnippets.length === 0) {
         return "[无法生成小说原著小说，请检查激活状态和内容加载情况]";
    }
    return textSnippets.join('\n\n');
}
const placeholderModule = {
    _replacePlaceholdersInString: (text, context, excludePlaceholders = []) => {
        if (typeof text !== 'string') return text;

        const localExcludePlaceholders = [...excludePlaceholders];

        function wrapWithTag(tagName, content) {
            const safeContent = content || '';
            return `<${tagName}>\n${tagName}:\n${safeContent}\n</${tagName}>`;
        }
        function wrapWithDynamicTag(tagName, roleName, content) {
            const safeContent = content || '';
            const dynamicTagName = `${roleName}_${tagName}`;
            return `<${dynamicTagName}>\n${dynamicTagName}:\n${safeContent}\n</${dynamicTagName}>`;
        }

        const cachedContext = context?.cachedContext;
        if (!cachedContext) return text;

        let novelOriginalNovel = "[原著小说未生成]";
        if (!localExcludePlaceholders.includes('{{原著小说}}') && text.includes('{{原著小说}}')) {
            if (context?.currentRoleNameForPayload === 'drawingMaster') {
                const details = stateModule.currentChatroomDetails;
                const globalConfig = stateModule.config.toolSettings.drawingMaster;
                let overrideEnabled = false;
                let overrideContent = '';
                if (details && details.config && details.config.overrideSettings && details.config.overrideSettings.drawingMaster) {
                    const overrideSettings = details.config.overrideSettings.drawingMaster;
                    if (overrideSettings.enabled) {
                        overrideEnabled = true;
                        overrideContent = overrideSettings.novelContent || '';
                    }
                }
                if (overrideEnabled) {
                    novelOriginalNovel = overrideContent || '[绘图大师原著小说(覆盖)为空]';
                } else {
                    novelOriginalNovel = globalConfig?.novelContent || '[绘图大师原著小说(全局)为空]';
                }
            } else {
                novelOriginalNovel = getOriginalNovelTextForPayload();
            }
        }

        let rawMainPromptText = context.mainPrompt || '[主提示词为空]';
        let processedMainPromptText = rawMainPromptText;
        if (!localExcludePlaceholders.includes('{{主提示词}}') && text.includes('{{主提示词}}')) {
            processedMainPromptText = placeholderModule._replacePlaceholdersInString(
                rawMainPromptText,
                context,
                [...localExcludePlaceholders, '{{数据库}}', '{{主提示词}}']
            );
        }

        let roleplayRuleText = stateModule.currentChatroomDetails?.config?.roleplayRules || '[扮演规则为空]';
        let publicInfoText = stateModule.currentChatroomDetails?.config?.publicInfo || '[公共信息为空]';
        let userValue = stateModule.currentChatroomDetails?.config?.user || '[user未设置]';
        let latestMessageContentText = cachedContext?.latestMessageContent || '[无最新消息]';
        let roleSettingValue = '[未设定]';
        let roleMemoryValue = '[未设定]';
        let currentRoleDetailedStateValue = '[无详细状态]';
        let roleNameValue = context.currentRoleNameForPayload || '[未知角色]';
        const isCharacterUpdater = context.roleType === 'tool' && context.currentRoleNameForPayload === 'characterUpdateMaster';
        const targetRoleNameValue = context.targetRoleNameForTool || '[无目标角色]';
        const targetRoleData = context.targetRoleData;
        const currentRoleData = context.roleData;
        if (isCharacterUpdater) {
            roleNameValue = toolNameMap['characterUpdateMaster'];
            if (targetRoleNameValue !== '[无目标角色]' && targetRoleData) {
                roleSettingValue = targetRoleData.setting || `[${targetRoleNameValue} 设定未获取]`;
                roleMemoryValue = targetRoleData.memory || `[${targetRoleNameValue} 记忆未获取]`;
                currentRoleDetailedStateValue = cachedContext?.roleDetailedStates?.[targetRoleNameValue] || `[${targetRoleNameValue} 无详细状态]`;
            } else {
                roleSettingValue = '[无目标角色设定]';
                roleMemoryValue = '[无目标角色记忆]';
                currentRoleDetailedStateValue = '[无目标角色详细状态]';
            }
        } else if (context.roleType === 'tool') {
            roleNameValue = toolNameMap[context.currentRoleNameForPayload] || context.currentRoleNameForPayload;
            roleSettingValue = '[工具无设定]';
            roleMemoryValue = '[工具无记忆]';
            currentRoleDetailedStateValue = cachedContext?.roleDetailedStates?.[context.currentRoleNameForPayload] || '[工具无详细状态]';
        } else {
            if (currentRoleData) {
                 roleSettingValue = currentRoleData.setting || '[设定未获取]';
                 roleMemoryValue = currentRoleData.memory || '[记忆未获取]';
                 currentRoleDetailedStateValue = cachedContext?.roleDetailedStates?.[context.currentRoleNameForPayload] || `[${context.currentRoleNameForPayload} 无详细状态]`;
                 roleNameValue = context.currentRoleNameForPayload;
            } else {
                 currentRoleDetailedStateValue = cachedContext?.roleDetailedStates?.[context.currentRoleNameForPayload] || `[${context.currentRoleNameForPayload} 无详细状态]`;
                 roleNameValue = context.currentRoleNameForPayload;
                 roleSettingValue = '[临时角色无设定]';
                 roleMemoryValue = '[临时角色无记忆]';
            }
        }
        let rawFormattedHistory = cachedContext?.formattedHistory || '';
        const rawNonSilentRoleSettingsValue = cachedContext?.nonSilentRoleSettingsValue;
        const rawNonSilentRoleDetailedStatesValue = cachedContext?.nonSilentRoleDetailedStatesValue;
        const wrappedOriginalNovel = wrapWithTag('OriginalNovel', novelOriginalNovel);
        const wrappedRoleplayRule = wrapWithTag('RoleplayRules', roleplayRuleText);
        const wrappedPublicInfo = wrapWithTag('PublicInfo', publicInfoText);
        const wrappedMainPrompt = wrapWithTag('MainPrompt', processedMainPromptText);
        const wrappedLatestMessage = wrapWithTag('LatestMessage', latestMessageContentText);
        const wrappedHistory = wrapWithTag('History', rawFormattedHistory);
        const wrappedSettingsCollection = wrapWithTag('CharacterSettingsCollection', rawNonSilentRoleSettingsValue);
        const wrappedStatesCollection = wrapWithTag('CharacterStatesCollection', rawNonSilentRoleDetailedStatesValue);
        const wrappedWorldInfo = wrapWithTag('WorldInfo', cachedContext?.worldInfo || '[世界信息未获取]');
        const triggeringCharacterNameValue = context?.triggeringCharacterName || '[触发绘图的角色未知]';

        const replacements = {
            '{{角色名称}}': roleNameValue,
            '{{目标角色名称}}': targetRoleNameValue,
            '{{角色名称集}}': cachedContext?.nonSilentRolesValue || '[无激活角色]',
            '{{最新角色}}': cachedContext?.lastActor || '[最近行动者未知]',
            '{{角色设定}}': wrapWithDynamicTag('Setting', roleNameValue, roleSettingValue),
            '{{角色记忆}}': wrapWithDynamicTag('Memory', roleNameValue, roleMemoryValue),
            '{{角色状态}}': wrapWithDynamicTag('State', roleNameValue, currentRoleDetailedStateValue),
            '{{消息记录}}': wrappedHistory,
            '{{最新消息}}': wrappedLatestMessage,
            '{{角色设定集}}': wrappedSettingsCollection,
            '{{角色状态集}}': wrappedStatesCollection,
            '{{世界信息}}': wrappedWorldInfo,
            '{{原著小说}}': wrappedOriginalNovel,
            '{{扮演规则}}': wrappedRoleplayRule,
            '{{公共信息}}': wrappedPublicInfo,
            '{{主提示词}}': wrappedMainPrompt,
            '{{绘图角色}}': triggeringCharacterNameValue,
            '{{user}}': userValue,
        };

        let replacedString = text;
        for (const placeholder in replacements) {
             if (localExcludePlaceholders.includes(placeholder)) continue;
             if (placeholder === '{{数据库}}') continue;
            const replacementValue = replacements[placeholder];
             const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
            replacedString = replacedString.replace(regex, replacementValue);
        }
        return replacedString;
    },

    replacePlaceholders: async (payload, context) => {
        if (!context || !context.cachedContext) {
            _logAndDisplayError("Placeholder replacement error: Context or cachedContext is missing.", "replacePlaceholders");
            return payload;
        }
        const databaseInstruction = context.databaseInstruction || "";

        const resolvedDatabaseContent = placeholderModule._replacePlaceholdersInString(
            databaseInstruction,
            context,
            ['{{数据库}}', '{{主提示词}}']
        );

        let finalDatabaseReplacement = "";
        if (resolvedDatabaseContent && resolvedDatabaseContent.trim() !== "") {
            finalDatabaseReplacement = `<Database>\n${resolvedDatabaseContent}\n</Database>`;
        }

        function recursiveReplace(obj) {
            if (typeof obj === 'string') {
                let replacedString = obj;
                if (replacedString.includes('{{数据库}}')) {
                     const dbRegex = new RegExp('{{数据库}}'.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                     replacedString = replacedString.replace(dbRegex, finalDatabaseReplacement);
                }

                replacedString = placeholderModule._replacePlaceholdersInString(
                    replacedString,
                    context,
                    ['{{数据库}}']
                );
                return replacedString;
            } else if (typeof obj === 'object' && obj !== null) {
                if (Array.isArray(obj)) {
                    return obj.map(item => recursiveReplace(item));
                } else {
                    const newObj = {};
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            newObj[key] = recursiveReplace(obj[key]);
                        }
                    }
                    return newObj;
                }
            }
            return obj;
        }
        const finalPayload = recursiveReplace(payload);
        return finalPayload;
    }
};

async function updateChatContextCache() {
    const newCache = {
        roleStates: {},
        roleDetailedStates: {},
        worldInfo: '[世界信息未获取]',
        lastActor: '[最近行动者未知]',
        nonSilentRolesValue: '[无激活角色]',
        nonSilentRoleSettingsValue: '[无激活角色设定]',
        nonSilentRoleDetailedStatesValue: '[无激活角色详细状态]',
        formattedHistory: '',
        latestMessageContent: '[无消息记录]',
    };
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config || !chatroomDetails.roles) {
        stateModule.chatContextCache = newCache;
        if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
        return;
    }
    const roomConfig = chatroomDetails.config;
    const allRolesInRoom = chatroomDetails.roles;
    const roleStatesConfig = roomConfig.roleStates || {};
    const roleDetailedStatesConfig = roomConfig.roleDetailedStates || {};
    for (const roleName in roleStatesConfig) {
        newCache.roleStates[roleName] = roleStatesConfig[roleName] || uiChatModule.ROLE_STATE_DEFAULT;
    }
    for (const roleName in roleDetailedStatesConfig) {
        newCache.roleDetailedStates[roleName] = roleDetailedStatesConfig[roleName] || "";
    }
    const currentHistory = stateModule.currentChatHistoryData;
    if (!currentHistory || currentHistory.length === 0) {
        stateModule.chatContextCache = newCache;
        if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
        return;
    }
    const historyLines = [];
    let latestGameHostMessageData = null;
    let lastActorFound = false;
    let lastMessageProcessedForCache = false;
    for (let i = currentHistory.length - 1; i >= 0; i--) {
        const messageObject = currentHistory[i];
        const { id, roleName, roleType, sourceType, speechActionText, rawJson, parsedResult } = messageObject;
        let displayContent = speechActionText || '';
        if (roleName === 'characterUpdateMaster' && parsedResult?.formattedUpdate) {
             displayContent = parsedResult.formattedUpdate;
        } else if (roleName === 'privateAssistant' && parsedResult?.responseContent) {
             displayContent = `私人助理：\n${parsedResult.responseContent}`;
        } else if ((roleType === 'role' || roleType === 'temporary_role') && parsedResult?.formattedText) {
             displayContent = parsedResult.formattedText;
        }
        if (!lastMessageProcessedForCache && displayContent && displayContent.trim() !== '' && displayContent !== "[Generating Image]" && displayContent !== "[图片绘制]") {
            newCache.latestMessageContent = displayContent;
            lastMessageProcessedForCache = true;
        }
        if (!lastActorFound && (roleType === 'role' || roleType === 'temporary_role')) {
            newCache.lastActor = roleName;
            lastActorFound = true;
        }
        if (roleType === 'role' || roleType === 'temporary_role') {
             const trimmedText = (displayContent || '').trim();
            if (trimmedText && trimmedText !== "[Generating Image]" && trimmedText !== "[图片绘制]") {
                historyLines.unshift(`${roleName}：\n${trimmedText}`);
            }
        } else if (roleType === 'tool' && roleName === 'privateAssistant' && parsedResult?.responseContent) {
             const trimmedText = (displayContent || '').trim();
             if (trimmedText) {
                  historyLines.unshift(trimmedText);
             }
        }
        if (roleName === 'gameHost' && sourceType === 'ai') {
            if (parsedResult && !messageObject.parserError && parsedResult.processedSceneContext && parsedResult.processedCharacterInfo) {
                if (!latestGameHostMessageData) {
                     latestGameHostMessageData = parsedResult;
                     let sceneText = '';
                     const sceneContext = parsedResult.processedSceneContext;
                     if (sceneContext.timeItems && sceneContext.timeItems.length > 0) {
                         sceneText += `Time: ${sceneContext.timeItems.join(', ')}\n`;
                     } else {
                         sceneText += `Time: [Not specified]\n`;
                     }
                     if (sceneContext.locationItems && sceneContext.locationItems.length > 0) {
                         sceneText += `Location: ${sceneContext.locationItems.join(', ')}\n`;
                     } else {
                         sceneText += `Location: [Not specified]\n`;
                     }
                     if (sceneContext.characterPositionItems && sceneContext.characterPositionItems.length > 0) {
                         sceneText += `Positions:\n  ${sceneContext.characterPositionItems.join('\n  ')}\n`;
                     }
                     if (sceneContext.otherSceneInfoItems && sceneContext.otherSceneInfoItems.length > 0) {
                         sceneText += `Other: ${sceneContext.otherSceneInfoItems.join(', ')}`;
                     }
                     newCache.worldInfo = sceneText.trim();
                 }
                 const charName = parsedResult.processedCharacterInfo.characterName;
                 if (charName) {
                      let charDetailText = '';
                      const charInfo = parsedResult.processedCharacterInfo;

                      const formatItemsToText = (items) => Array.isArray(items) ? items.join(', ') : (items || '无');
                      charDetailText += `Demeanor: ${formatItemsToText(charInfo.demeanorItems)}\n`;
                      charDetailText += `Outerwear: ${formatItemsToText(charInfo.outerwearItems)}\n`;
                      charDetailText += `Underwear: ${formatItemsToText(charInfo.underwearItems)}\n`;
                      charDetailText += `Accessories: ${formatItemsToText(charInfo.accessories)}\n`;
                      charDetailText += `Short Status: ${formatItemsToText(charInfo.shortTermStatusItems)}\n`;
                      charDetailText += `Long Status: ${formatItemsToText(charInfo.longTermStatusItems)}\n`;
                      charDetailText += `Pose: ${formatItemsToText(charInfo.actionPoseItems)}\n`;
                      charDetailText += `Action: ${formatItemsToText(charInfo.currentActionItems)}\n`;
                      charDetailText += `Other Status: ${formatItemsToText(charInfo.otherCharacterStatusItems)}`;

                      newCache.roleDetailedStates[charName] = charDetailText.trim();
                      if (!(charName in newCache.roleStates)) {
                           newCache.roleStates[charName] = uiChatModule.ROLE_STATE_DEFAULT;
                      }
                 }
            } else if (messageObject.parserError && !latestGameHostMessageData) {
                newCache.worldInfo = `[游戏主持人响应解析错误: ${messageObject.parserError}]`;
            } else if (!latestGameHostMessageData) {
                 newCache.worldInfo = `[游戏主持人响应 ${id} 的解析结果无效]`;
            }
        } else if (roleName === 'characterUpdateMaster' && sourceType === 'ai' && parsedResult?.formattedUpdate && !messageObject.parserError) {
             const targetRoleName = messageObject.targetRoleName;
             const characterNameMatch = parsedResult.formattedUpdate.match(/--- 更新后记忆 \((.*?)\) ---/);
             const characterName = characterNameMatch ? characterNameMatch[1] : null;
             if (targetRoleName && characterName && targetRoleName === characterName) {
                  newCache.roleDetailedStates[targetRoleName] = parsedResult.formattedUpdate;
             } else if (characterName) {
                  newCache.roleDetailedStates[characterName] = parsedResult.formattedUpdate;
             }
        }
    }

    newCache.formattedHistory = historyLines.join('\n---\n');

    const nonSilentRoleNames = Object.entries(newCache.roleStates)
        .filter(([name, state]) => [uiChatModule.ROLE_STATE_ACTIVE, uiChatModule.ROLE_STATE_USER_CONTROL].includes(state || uiChatModule.ROLE_STATE_DEFAULT))
        .map(([name, state]) => name);
    newCache.nonSilentRolesValue = nonSilentRoleNames.join(',') || '[无激活角色]';
    newCache.nonSilentRoleSettingsValue = nonSilentRoleNames.map(rName => {
        const roleData = allRolesInRoom.find(r => r.name === rName);
        const settingContent = roleData?.setting || `[${rName} 设定未获取或为临时角色]`;
        const tagName = `${rName}_Setting`;
        return `<${tagName}>\n${tagName}:\n${settingContent}\n</${tagName}>`;
    }).join('\n---\n') || '[无激活角色设定]';
    newCache.nonSilentRoleDetailedStatesValue = nonSilentRoleNames.map(rName => {
        const stateContent = newCache.roleDetailedStates[rName] || `[${rName} 无详细状态]`;
        const tagName = `${rName}_State`;
        return `<${tagName}>\n${tagName}:\n${stateContent}\n</${tagName}>`;
    }).join('\n---\n') || '[无激活角色详细状态]';

    stateModule.chatContextCache = newCache;
    if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
}

const _prepareRoleOrToolContext = async (roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    let modelToUse = '';
    let specificResponseSchema = null;
    let specificResponseSchemaParserJs = '';
    let databaseInstruction = '';
    let mainPrompt = '';
    let roleData = null;
    let targetRoleData = null;

    if (!stateModule.chatContextCache) {
        await updateChatContextCache();
        if (!stateModule.chatContextCache) {
             _logAndDisplayError("无法准备 API 请求：上下文缓存为空。", '_prepareRoleOrToolContext');
             return null;
        }
    }

    const overrideSettings = chatroomDetails?.config?.overrideSettings;
    let useOverride = false;
    let overrideSection = null;
    let sectionType = null;

    if (roleType === 'role' || roleType === 'temporary_role') {
        sectionType = 'general';
        if (overrideSettings && overrideSettings.general && overrideSettings.general.enabled) {
            useOverride = true;
            overrideSection = overrideSettings.general;
        }
        modelToUse = stateModule.config.model;
        databaseInstruction = stateModule.config.sharedDatabaseInstruction || '';
        specificResponseSchema = stateModule.config.responseSchemaJson || null;
        specificResponseSchemaParserJs = stateModule.config.responseSchemaParserJs || '';
        mainPrompt = stateModule.config.mainPrompt || '';

        if (chatroomDetails) {
            roleData = chatroomDetails.roles.find(r => r.name === roleName);
        }
    } else if (roleType === 'tool') {
        sectionType = roleName;
        const toolSettings = stateModule.config.toolSettings[roleName];
        if (!toolSettings || !toolSettings.enabled) {
            return null;
        }

        if (overrideSettings && overrideSettings[roleName] && overrideSettings[roleName].enabled) {
            useOverride = true;
            overrideSection = overrideSettings[roleName];
        }

        modelToUse = toolSettings.model;
        databaseInstruction = toolSettings.toolDatabaseInstruction || '';
        specificResponseSchema = toolSettings.responseSchemaJson || null;
        specificResponseSchemaParserJs = toolSettings.responseSchemaParserJs || '';
        mainPrompt = toolSettings.mainPrompt || '';

        if (targetRoleNameForTool) {
             if (!chatroomDetails) {
                 _logAndDisplayError(`无法准备工具目标角色 ${targetRoleNameForTool} 的数据：无激活聊天室数据。`, '_prepareRoleOrToolContext');
                 return null;
             }
             targetRoleData = chatroomDetails.roles.find(r => r.name === targetRoleNameForTool);
             if (!targetRoleData) {
                 _logAndDisplayError(`无法找到工具 ${roleName} 的目标角色 ${targetRoleNameForTool} 的定义数据。`, '_prepareRoleOrToolContext');
             }
        }
    } else {
        throw new Error(`未知的 roleType: ${roleType} for ${roleName}`);
    }

    if (useOverride && overrideSection) {
        modelToUse = overrideSection.model || modelToUse;
        specificResponseSchema = overrideSection.responseSchemaJson || specificResponseSchema;
        specificResponseSchemaParserJs = overrideSection.responseSchemaParserJs || specificResponseSchemaParserJs;
        databaseInstruction = overrideSection.toolDatabaseInstruction || overrideSection.sharedDatabaseInstruction || databaseInstruction;
        mainPrompt = overrideSection.mainPrompt || mainPrompt;
    }

    if (!modelToUse) {
         const sourceMsg = useOverride ? `聊天室覆盖配置 (${sectionType})` : (roleType === 'tool' ? `工具 ${toolNameMap[roleName]}` : '通用配置');
         throw new Error(`请在 ${sourceMsg} 中选择一个模型。`);
    }

    const context = {
        modelName: modelToUse,
        systemInstruction: stateModule.config.systemInstruction || '',
        responseSchema: specificResponseSchema,
        responseSchemaParserJs: specificResponseSchemaParserJs,
        responseMimeType: stateModule.config.responseMimeType,
        temperature: stateModule.config.temperature,
        topP: stateModule.config.topP,
        topK: stateModule.config.topK,
        maxOutputTokens: stateModule.config.maxOutputTokens,
        currentRoleNameForPayload: roleName,
        targetRoleNameForTool: targetRoleNameForTool,
        promptPresetTurns: JSON.parse(JSON.stringify(stateModule.config.promptPresetTurns || [])),
        roleType: roleType,
        databaseInstruction: databaseInstruction,
        mainPrompt: mainPrompt,
        roleData: roleData,
        targetRoleData: targetRoleData,
        cachedContext: stateModule.chatContextCache
    };
    if (triggeringCharacterName) {
        context.triggeringCharacterName = triggeringCharacterName;
    }
    return context;
};

const _buildApiPayload = async (context) => {
    const basePayload = {
        model: context.modelName,
        generationConfig: {
            temperature: parseFloat(context.temperature) || 1.0,
            topP: parseFloat(context.topP) || 0.9,
            topK: parseInt(context.topK) || 40,
            maxOutputTokens: parseInt(context.maxOutputTokens) || 2048,
            responseMimeType: context.responseMimeType || 'application/json',
        },
        safetySettings: [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
        ]
    };

    const systemInstructionText = context.systemInstruction || '';
    basePayload.systemInstruction = systemInstructionText;

    if (context.responseSchema) {
        let schemaObj = context.responseSchema;
        if (typeof schemaObj === 'string' && schemaObj.trim().startsWith('{')) {
             try { schemaObj = JSON.parse(schemaObj); } catch(e) { schemaObj = null; _logAndDisplayError(`Invalid JSON in responseSchema for ${context.currentRoleNameForPayload}: ${e.message}`, '_buildApiPayload'); }
        }
        if (typeof schemaObj === 'object' && schemaObj !== null) {
            basePayload.generationConfig.responseSchema = schemaObj;
        }
    }

    basePayload.contents = (context.promptPresetTurns || []).map(turn => ({
         role: turn.role,
         parts: [{ text: turn.instruction || "" }]
    }));
    if (context.targetRoleNameForTool) {
        basePayload.targetRoleNameForTool = context.targetRoleNameForTool;
    }
    if (context.triggeringCharacterName) {
         basePayload.triggeringCharacterName = context.triggeringCharacterName;
    }

    const finalPayload = await placeholderModule.replacePlaceholders(
        basePayload,
        context
    );

    if (finalPayload.systemInstruction && typeof finalPayload.systemInstruction === 'string') {
         finalPayload.systemInstruction = {"parts": [{"text": finalPayload.systemInstruction}]};
    } else if (!finalPayload.systemInstruction) {
         delete finalPayload.systemInstruction;
    }

    if (!finalPayload.contents || finalPayload.contents.length === 0) {
         finalPayload.contents = [{ role: "user", parts: [{ text: "Continue" }] }];
    }
    return finalPayload;
};

const _performApiCall = async (apiKey, payload, roleName, targetRoleNameForTool = null, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const requestPayload = { ...payload, apiKey: apiKey };
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
    let result = null;
    stateModule.activeProxyRequestsCount++;
    if (stateModule.activeProxyRequestsCount === 1 && typeof uiChatModule !== 'undefined') {
        uiChatModule.showLoadingSpinner();
    }
    try {
        const response = await fetch('/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: abortController.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            let detail = errorText;
             try {
                 const errorJson = JSON.parse(errorText);
                 detail = errorJson?.error?.message || errorText;
             } catch(e){}
             result = { success: false, errorType: 'apiError', detail: `API Error! Status: ${response.status}, Details: ${detail}` };
        } else {
            const data = await response.json();
            result = { success: true, data: data };
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            result = { success: false, errorType: 'timeout', detail: 'Request timed out' };
        } else {
            result = { success: false, errorType: 'fetchError', detail: `Network request failed: ${error.message}` };
        }
    } finally {
        stateModule.activeProxyRequestsCount--;
        if (stateModule.activeProxyRequestsCount === 0 && typeof uiChatModule !== 'undefined') {
            uiChatModule.hideLoadingSpinner();
        }
    }
    return result;
};
const apiModule = {
    _sendGeminiRequestWithRetry: async (roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null) => {
        let lastError = null;
        let context = null;
        let finalPayload = null;
        let apiKeyUsed = null;

        try {
            context = await _prepareRoleOrToolContext(roleName, roleType, targetRoleNameForTool, triggeringCharacterName);
            if (!context) {
                if (roleType === 'tool' && !stateModule.config.toolSettings[roleName]?.enabled) {
                     return;
                }
                throw new Error(`Could not prepare context for ${roleName} (maybe disabled or misconfigured)`);
            }
            finalPayload = await _buildApiPayload(context);
            if (!finalPayload) {
                throw new Error("Failed to build final API Payload.");
            }
        } catch (e) {
            _logAndDisplayError(`Error preparing context or payload for ${roleName}: ${e.message}`, '_sendGeminiRequestWithRetry');
            return;
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            if (stateModule.config.isRunPaused && (context.roleType === 'role' || context.roleType === 'temporary_role')) {
                lastError = new Error(`Request aborted for role '${roleName}' (Attempt ${attempt}/${MAX_RETRIES}) due to pause state`);
                _logAndDisplayError(`Retry aborted for role '${roleName}' (Attempt ${attempt}/${MAX_RETRIES}) because run is paused.`, '_sendGeminiRequestWithRetry');
                break;
            }

            try {
                apiKeyUsed = apiKeyManager.selectApiKey();
            } catch(e) {
                lastError = e;
                break;
            }

            if (!apiKeyUsed) {
                 lastError = new Error("Failed to select an API key.");
                 break;
            }

            const result = await _performApiCall(apiKeyUsed, finalPayload, roleName, targetRoleNameForTool);
            apiKeyManager.markApiKeyUsed(apiKeyUsed);

            if (!result.success) {
                lastError = new Error(`${result.errorType}: ${result.detail}`);
                apiKeyManager.incrementApiKeyFailure(apiKeyUsed);
                if (typeof uiChatModule !== 'undefined' && uiChatModule.showRetryIndicator) {
                     uiChatModule.showRetryIndicator();
                }
                if (attempt === MAX_RETRIES) break; else continue;
            }

            if (!result.data || typeof result.data.text_content !== 'string') {
                lastError = new Error('API response missing text_content');
                apiKeyManager.incrementApiKeyFailure(apiKeyUsed);
                if (typeof uiChatModule !== 'undefined' && uiChatModule.showRetryIndicator) {
                     uiChatModule.showRetryIndicator();
                }
                 if (attempt === MAX_RETRIES) break; else continue;
            }

            const { parsedResult, parserError } = uiChatModule._parseAIResponse(result.data.text_content, roleName, roleType, context.responseSchemaParserJs);
             if (parserError && (roleName === 'privateAssistant' || roleName === 'characterUpdateMaster')) {
                 lastError = new Error(`Parsing error (Attempt ${attempt}/${MAX_RETRIES}): ${parserError}`);
                 apiKeyManager.incrementApiKeyFailure(apiKeyUsed);
                 if (typeof uiChatModule !== 'undefined' && uiChatModule.showRetryIndicator) {
                      uiChatModule.showRetryIndicator();
                 }
                 if (attempt === MAX_RETRIES) break; else continue;
             } else if (parserError) {
                 lastError = new Error(`Parsing error (Attempt ${attempt}/${MAX_RETRIES}): ${parserError}`);
             }

            if (!parserError || (roleName !== 'privateAssistant' && roleName !== 'characterUpdateMaster')) {
                 if (typeof uiChatModule !== 'undefined' && uiChatModule.displayAIResponse) {
                 uiChatModule.displayAIResponse(result.data, roleName, targetRoleNameForTool);
                 } else {
                 }
                 return;
            }
        }

        _logAndDisplayError(`Gemini request ultimately failed (Role: ${roleName}): ${lastError?.message || 'Unknown error'}`, '_sendGeminiRequestWithRetry');
    },
    _prepareNovelAiPayload: async (parsedDrawingMasterData, rawJsonText) => {
         if (!parsedDrawingMasterData || typeof parsedDrawingMasterData !== 'object' || !parsedDrawingMasterData.generalTagsString || !parsedDrawingMasterData.characterTags) {
             throw new Error("Invalid Drawing Master data (new format), cannot prepare NAI Payload.");
         }
         const naiApiKey = apiKeyManager.getNaiApiKey();
         if (!naiApiKey) {
             throw new Error("NovelAI API Key is not set.");
         }
         const generalTagsString = parsedDrawingMasterData.generalTagsString || "";
         const characterTagSets = parsedDrawingMasterData.characterTags || [];
         const numCharacters = characterTagSets.length;
         let promptParts = [];
         let generalPromptPart = [];
         if (stateModule.config.novelaiDefaultPositivePrompt) generalPromptPart.push(stateModule.config.novelaiDefaultPositivePrompt);
         if (numCharacters > 0) generalPromptPart.push(`${numCharacters}character${numCharacters > 1 ? 's' : ''}`);
         if (stateModule.config.novelaiArtistChain) generalPromptPart.push(stateModule.config.novelaiArtistChain);
         if (generalTagsString) generalPromptPart.push(generalTagsString);
         promptParts.push(generalPromptPart.filter(p=>p).join(', ').trim());
         let mainDrawingPromptContentForDisplay = "";
         const chatroomDetails = stateModule.currentChatroomDetails;
         if (!chatroomDetails) { throw new Error("Cannot get current chatroom details."); }
         const characterPromises = characterTagSets.map(async charSet => {
             let charPromptPart = [];
             const charName = charSet.characterName;
             const roleData = chatroomDetails.roles.find(r => r.name === charName);
             const drawingTemplate = roleData?.drawingTemplate || '';
             if (drawingTemplate) charPromptPart.push(drawingTemplate);
             if (charSet.tagsString) charPromptPart.push(charSet.tagsString);
             const characterPromptString = charPromptPart.filter(p=>p).join(', ').trim();
             return { name: charName, prompt: characterPromptString };
         });
         const characterResults = await Promise.all(characterPromises);
         characterResults.forEach(result => {
             if(result.prompt) promptParts.push(result.prompt);
             if (mainDrawingPromptContentForDisplay) mainDrawingPromptContentForDisplay += " | ";
             mainDrawingPromptContentForDisplay += `${result.name}: ${result.prompt || '[No Tags]'}`;
         });
         let finalPrompt = promptParts.map(p => p.replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '')).filter(p => p).join(' | ');
         let cleanedPrompt = finalPrompt;
         cleanedPrompt = cleanedPrompt.replace(/,\s*0\s*,/g, ',');
         cleanedPrompt = cleanedPrompt.replace(/^0\s*,/g, '');
         cleanedPrompt = cleanedPrompt.replace(/,\s*0\s*$/g, '');
         cleanedPrompt = cleanedPrompt.replace(/^\s*0\s*$/g, '');
         cleanedPrompt = cleanedPrompt.replace(/,\s*,/g, ',');
         cleanedPrompt = cleanedPrompt.replace(/^,\s*/, '').replace(/,\s*$/, '');
         finalPrompt = cleanedPrompt.trim();
         const finalNegativePrompt = stateModule.config.novelaiDefaultNegativePrompt || "";
         let seed = parseInt(stateModule.config.novelaiSeed) || 0;
         if (seed === 0) {
             seed = Math.floor(Math.random() * 10000000000);
         }
         const model = stateModule.config.novelaiModel;
         const isV4 = model.startsWith("nai-diffusion-4");
         const finalParameters = {
             params_version: 3,
             width: parseInt(stateModule.config.novelaiWidth) || 1024,
             height: parseInt(stateModule.config.novelaiHeight) || 1024,
             scale: parseFloat(stateModule.config.novelaiScale) || 5.0,
             sampler: stateModule.config.novelaiSampler || "k_euler",
             steps: parseInt(stateModule.config.novelaiSteps) || 28,
             seed: seed,
             n_samples: 1,
             ucPreset: 3,
             qualityToggle: true,
             dynamic_thresholding: false,
             controlnet_strength: 1,
             legacy: false,
             add_original_image: false,
             cfg_rescale: parseFloat(stateModule.config.novelaiCfgRescale) || 0.0,
             noise_schedule: stateModule.config.novelaiNoiseSchedule || "native",
             skip_cfg_above_sigma: null,
             legacy_v3_extend: false,
         };
         let finalRequestBody = {
             model: model,
             action: "generate",
             parameters: finalParameters
         };
         if (isV4) {
             finalParameters.v4_prompt = {
                 caption: { base_caption: finalPrompt, char_captions: [] },
                 use_coords: false,
                 use_order: true
             };
             finalParameters.v4_negative_prompt = {
                 caption: { base_caption: finalNegativePrompt, char_captions: [] }
             };
         } else {
             finalRequestBody.input = finalPrompt;
             finalParameters.negative_prompt = finalNegativePrompt;
         }
         stateModule.lastNaiPrompt = finalPrompt;
         if (typeof uiSettingsModule !== 'undefined' && uiSettingsModule.updateLastNaiPromptDisplay) {
             uiSettingsModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
         }
         return {
             nai_api_key: naiApiKey,
             parameters: finalRequestBody,
             originalDrawingMasterData: parsedDrawingMasterData,
             rawJsonText: rawJsonText
         };
    },
    addNaiRequestToQueue: (requestData, targetMessageId = null) => {
        const queueItem = { ...requestData, targetMessageId };
        if (stateModule.naiRequestQueue.length >= 3) {
             stateModule.naiRequestQueue.shift();
        }
        stateModule.naiRequestQueue.push(queueItem);
        if (!stateModule.isNaiProcessing) {
            apiModule.processNaiQueue();
        }
    },
    processNaiQueue: async () => {
        if (stateModule.isNaiProcessing || stateModule.naiRequestQueue.length === 0) {
            return;
        }
        stateModule.isNaiProcessing = true;
        const requestData = stateModule.naiRequestQueue.shift();
        const { nai_api_key, parameters, originalDrawingMasterData, rawJsonText, targetMessageId } = requestData;
        let lastError = null;
        let success = false;
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
        let responseData = null;
        try {
            const response = await fetch('/novelai-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nai_api_key, parameters }),
                signal: abortController.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`NAI Proxy Error! Status: ${response.status}, Detail: ${errorText}`);
            }
            responseData = await response.json();
            if (responseData && responseData.imageDataUrl) {
                if (typeof uiChatModule !== 'undefined' && uiChatModule.handleNovelAiResponse) {
                    uiChatModule.handleNovelAiResponse(responseData, originalDrawingMasterData, rawJsonText, targetMessageId);
                } else {
                }
                success = true;
            } else {
                lastError = new Error('NAI response missing valid imageDataUrl');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                lastError = new Error(`NAI request timed out`);
            } else {
                lastError = new Error(`NAI request failed: ${error.message}`);
            }
        }

        if (!success && lastError) {
             _logAndDisplayError(`NAI request failed: ${lastError.message}`, 'processNaiQueue', 'N/A', 'N/A', lastError);
             if (typeof uiChatModule !== 'undefined' && uiChatModule.handleNovelAiResponse) {
                  uiChatModule.handleNovelAiResponse({ error: lastError.message }, originalDrawingMasterData, rawJsonText, targetMessageId);
             }
        }
        stateModule.isNaiProcessing = false;
        if(stateModule.naiRequestQueue.length > 0) {
             setTimeout(() => apiModule.processNaiQueue(), 1000);
        }
    },
    fetchModels: async () => {
        const setAllOptions = (message, isError = false) => {
            const allSelects = document.querySelectorAll('.settings-select[id*="-model-"]');
            allSelects.forEach(selectElement => {
                 if (selectElement.id !== 'novelai-model-settings') {
                     selectElement.innerHTML = `<option value="" disabled selected>${message}</option>`;
                     selectElement.style.borderColor = isError ? 'red' : '';
                 }
            });
        };

        setAllOptions('正在拉取...');

        let allKeys = apiKeyManager.getApiKeys();
        if (allKeys.length === 0) {
            _logAndDisplayError("No API keys configured, cannot load model list.", 'fetchModels');
            setAllOptions('无API密钥', true);
            alert('请先在API设置中输入至少一个谷歌API密钥！');
            return;
        }

        let success = false;
        let lastError = null;
        let loadedModels = [];
        const maxAttempts = allKeys.length;
        let attemptedKeys = 0;

        while(attemptedKeys < maxAttempts && !success) {
             let apiKey;
             try {
                  apiKey = apiKeyManager.selectApiKey();
             } catch (e) {
                 lastError = e;
                 _logAndDisplayError(`Error selecting API key (attempt ${attemptedKeys + 1}): ${e.message}`, 'fetchModels');
                 attemptedKeys++;
                 continue;
             }

             if (!apiKey) {
                  lastError = new Error("Got an empty API key.");
                  _logAndDisplayError(`Attempt ${attemptedKeys + 1}/${maxAttempts}: Got an empty API key.`, 'fetchModels');
                  attemptedKeys++;
                  continue;
             }

             try {
                const response = await fetch(`/models?key=${apiKey}`);
                apiKeyManager.markApiKeyUsed(apiKey);

                if (!response.ok) {
                    const errorText = await response.text();
                    lastError = new Error(`Model list load failed (Key ${apiKey.substring(0, 4)}..., Attempt ${attemptedKeys + 1}/${maxAttempts}): ${response.status} ${errorText}`);
                    _logAndDisplayError(lastError.message, 'fetchModels');
                    apiKeyManager.incrementApiKeyFailure(apiKey);
                    attemptedKeys++;
                    continue;
                }

                const data = await response.json();
                if (data.models && Array.isArray(data.models)) {
                    loadedModels = [];
                    data.models.forEach(model => {
                       if (model.name && model.supportedGenerationMethods?.includes('generateContent')) {
                           const modelId = model.name.startsWith('models/') ? model.name.substring(7) : model.name;
                           loadedModels.push({ id: modelId, name: model.displayName || modelId });
                       }
                    });
                    loadedModels.sort((a, b) => a.name.localeCompare(b.name));
                    stateModule.availableModels = loadedModels;
                    success = true;
                } else {
                     lastError = new Error("Invalid model list response format (no models array)");
                     _logAndDisplayError(lastError.message, 'fetchModels');
                     apiKeyManager.incrementApiKeyFailure(apiKey);
                     attemptedKeys++;
                     continue;
                }
            } catch (error) {
                apiKeyManager.markApiKeyUsed(apiKey);
                lastError = error;
                _logAndDisplayError(`Network or processing error fetching models (Key ${apiKey.substring(0, 4)}..., Attempt ${attemptedKeys + 1}/${maxAttempts}): ${error.message}`, 'fetchModels');
                apiKeyManager.incrementApiKeyFailure(apiKey);
                attemptedKeys++;
                continue;
            }
        }

        if (success) {
            const allSelects = document.querySelectorAll('.settings-select[id*="-model-"]');
            allSelects.forEach(selectElement => {
                 if (selectElement.id !== 'novelai-model-settings') {
                    const previouslySelectedValue = selectElement.value;
                    const previouslySelectedText = selectElement.options[selectElement.selectedIndex]?.text || "";

                    selectElement.innerHTML = '';
                    selectElement.style.borderColor = '';

                    let valueToSelect = previouslySelectedValue;
                    let valueFoundInNewList = false;

                    stateModule.availableModels.forEach(model => {
                         const option = new Option(model.name, model.id);
                         selectElement.add(option);
                         if (model.id === valueToSelect) {
                             valueFoundInNewList = true;
                         }
                    });

                    if (!valueFoundInNewList && previouslySelectedValue) {
                         const oldOption = new Option(previouslySelectedText || `(旧) ${previouslySelectedValue}`, previouslySelectedValue);
                         selectElement.add(oldOption, 0);
                         valueToSelect = previouslySelectedValue;
                    } else if (!valueFoundInNewList && !previouslySelectedValue && selectElement.options.length > 0) {
                         valueToSelect = selectElement.options[0].value;
                    }

                    if (selectElement.options.length === 0) {
                         selectElement.innerHTML = '<option value="" disabled selected>无可用模型</option>';
                    } else {
                         selectElement.value = valueToSelect;
                    }
                 }
            });
            alert('模型列表拉取成功！');
        } else {
            _logAndDisplayError(`All API key attempts failed to load model list. Last error: ${lastError?.message || 'Unknown error'}`, 'fetchModels');
            setAllOptions('拉取失败', true);
            alert(`拉取模型列表失败！\n${lastError?.message || '未知错误'}`);
        }
    },
    sendSingleMessageForRoleImpl: async (roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null) => {
        await apiModule._sendGeminiRequestWithRetry(roleName, roleType, targetRoleNameForTool, triggeringCharacterName);
    },
    triggerRoleResponse: (roleName, triggeringCharacterName = null) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config) return;
        let roleType = 'unknown';
        let roleConfig = chatroomDetails.config.roleStates ? chatroomDetails.config.roleStates[roleName] : undefined;
        let toolConfig = null;
        if (toolNameMap.hasOwnProperty(roleName)) {
             roleType = 'tool';
             toolConfig = stateModule.config.toolSettings[roleName];
             if (!toolConfig || !toolConfig.enabled) return;
        } else {
             const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
             if (roleConfig !== undefined) {
                 roleType = isPermanent ? 'role' : 'temporary_role';
                 if (![uiChatModule.ROLE_STATE_ACTIVE, uiChatModule.ROLE_STATE_USER_CONTROL].includes(roleConfig || uiChatModule.ROLE_STATE_DEFAULT)) {
                     return;
                 }
             } else {
                  return;
             }
        }
        if (stateModule.config.isRunPaused && (roleType === 'role' || roleType === 'temporary_role')) {
            return;
        }

        if (!stateModule.chatContextCache) {
             updateChatContextCache().then(() => {
                if (!stateModule.chatContextCache) {
                    _logAndDisplayError("无法触发响应：上下文缓存为空。", 'triggerRoleResponse');
                    return;
                }
                apiModule._triggerRoleResponseInternal(roleName, roleType, triggeringCharacterName);
             });
        } else {
             apiModule._triggerRoleResponseInternal(roleName, roleType, triggeringCharacterName);
        }
    },
    _triggerRoleResponseInternal: (roleName, roleType, triggeringCharacterName = null) => {
        apiModule.sendSingleMessageForRoleImpl(roleName, roleType, null, triggeringCharacterName);
    },
    triggerCharacterUpdateForRole: (targetRoleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config?.roleStates || !(targetRoleName in chatroomDetails.config.roleStates)) {
             _logAndDisplayError(`无法更新角色 ${targetRoleName}：不在当前聊天室中。`, 'triggerCharacterUpdateForRole');
            return;
        }
        const toolName = 'characterUpdateMaster';
        if (!stateModule.config.toolSettings[toolName]?.enabled) {
             return;
        }
        apiModule.sendSingleMessageForRoleImpl(toolName, 'tool', targetRoleName);
    },
    addChatroom: async (name) => {
        if (!name || name.trim() === "") {
             _logAndDisplayError("Chatroom name cannot be empty.", "addChatroom");
             return null;
        }
        try {
            const response = await fetch('/create-chatroom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatroom_name: name })
            });
            const result = await response.json();
            if (!response.ok) {
                 throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }
            stateModule.config.chatRoomOrder.push(name);
            if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();
            return name;
        } catch (error) {
            _logAndDisplayError(`Failed to create chatroom '${name}': ${error.message}`, 'addChatroom');
            return null;
        }
    },
    renameChatroom: async (oldName, newName) => {
         if (!oldName || !newName || oldName === newName || newName.trim() === "") {
             _logAndDisplayError("Invalid names for rename.", 'renameChatroom');
             return false;
         }
         try {
             const response = await fetch(`/rename-chatroom/${encodeURIComponent(oldName)}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ new_name: newName })
             });
             const result = await response.json();
             if (!response.ok) {
                 throw new Error(result.error || `HTTP error! Status: ${response.status}`);
             }
             const index = stateModule.config.chatRoomOrder.indexOf(oldName);
             if (index > -1) {
                 stateModule.config.chatRoomOrder[index] = newName;
             } else {
                  stateModule.config.chatRoomOrder.push(newName);
             }
             if (stateModule.config.activeChatRoomName === oldName) {
                 stateModule.config.activeChatRoomName = newName;
             }
             if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();
             return true;
         } catch (error) {
             _logAndDisplayError(`Failed to rename chatroom '${oldName}' to '${newName}': ${error.message}`, 'renameChatroom');
             return false;
         }
    },
    deleteChatroom: async (name) => {
        if (!name) return false;
        try {
             const response = await fetch(`/delete-chatroom/${encodeURIComponent(name)}`, {
                 method: 'DELETE'
             });
             const result = await response.json();
             if (!response.ok) {
                 throw new Error(result.error || `HTTP error! Status: ${response.status}`);
             }
             stateModule.config.chatRoomOrder = stateModule.config.chatRoomOrder.filter(n => n !== name);
             if (stateModule.config.activeChatRoomName === name) {
                 stateModule.config.activeChatRoomName = stateModule.config.chatRoomOrder.length > 0 ? stateModule.config.chatRoomOrder[0] : null;
                 stateModule.currentChatroomDetails = null;
             }
             if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();
             return true;
        } catch (error) {
             _logAndDisplayError(`Failed to delete chatroom '${name}': ${error.message}`, 'deleteChatroom');
             return false;
        }
    },
    fetchChatroomDetails: async (roomName) => {
         if (!roomName) {
             stateModule.currentChatroomDetails = null;
             updateChatContextCache();
             return;
         }
         try {
             const response = await fetch(`/chatroom-details/${encodeURIComponent(roomName)}`);
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
             }
             const details = await response.json();
             if (details.config && !details.config.roleDetailedStates) {
                 details.config.roleDetailedStates = {};
             }
             if (details.config && !details.config.overrideSettings) {
                details.config.overrideSettings = JSON.parse(JSON.stringify(defaultChatroomOverrideSettings));
                _logAndDisplayError(`Chatroom ${roomName} config missing overrideSettings, added default. Consider re-exporting/importing if this persists.`, 'fetchChatroomDetails');
             } else if (details.config && details.config.overrideSettings) {

                 let updated = false;
                 const currentOverrides = details.config.overrideSettings;
                 const defaultKeys = Object.keys(defaultChatroomOverrideSettings);
                 const currentKeys = Object.keys(currentOverrides);

                 defaultKeys.forEach(key => {
                     if (!currentOverrides[key]) {
                         currentOverrides[key] = JSON.parse(JSON.stringify(defaultChatroomOverrideSettings[key]));
                         updated = true;
                     } else {
                          const defaultSectionKeys = Object.keys(defaultChatroomOverrideSettings[key]);
                          const currentSectionKeys = Object.keys(currentOverrides[key]);
                          defaultSectionKeys.forEach(subKey => {
                              if (!(subKey in currentOverrides[key])) {
                                 currentOverrides[key][subKey] = defaultChatroomOverrideSettings[key][subKey];
                                 updated = true;
                              }
                          });
                     }
                 });
                 if(updated) {
                      _logAndDisplayError(`Chatroom ${roomName} overrideSettings structure updated.`, 'fetchChatroomDetails');

                 }
             }


             stateModule.currentChatroomDetails = details;
             updateChatContextCache();
         } catch (error) {
              _logAndDisplayError(`Failed to fetch details for chatroom '${roomName}': ${error.message}`, 'fetchChatroomDetails');
              stateModule.currentChatroomDetails = null;
              updateChatContextCache();
              if (stateModule.config.activeChatRoomName === roomName) {
                  stateModule.config.activeChatRoomName = stateModule.config.chatRoomOrder.length > 0 ? stateModule.config.chatRoomOrder[0] : null;
                  if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();
              }
         }
    },
    updateChatroomConfig: async (roomName, configData) => {
         if (!roomName || !configData) return false;
         try {
             const response = await fetch(`/update-chatroom-config/${encodeURIComponent(roomName)}`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(configData)
             });
             const result = await response.json();
             if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
             }
             return true;
         } catch (error) {
              _logAndDisplayError(`Failed to update config for chatroom '${roomName}': ${error.message}`, 'updateChatroomConfig');
              return false;
         }
    },
    triggerDebouncedChatroomConfigSave: (roomName) => {
         if (!roomName || !stateModule.currentChatroomDetails || stateModule.currentChatroomDetails.config.name !== roomName) return;
         clearTimeout(stateModule.chatroomConfigSaveTimers[roomName]);
         stateModule.chatroomConfigSaveTimers[roomName] = setTimeout(async () => {
             const configToSave = { ...stateModule.currentChatroomDetails.config };
             delete configToSave.name;
             await apiModule.updateChatroomConfig(roomName, configToSave);
         }, stateModule.chatroomConfigSaveDelay);
    },
     createRole: async (roomName, roleData) => {
         if (!roomName || !roleData || !roleData.name) return false;
         try {
             const response = await fetch(`/roles/${encodeURIComponent(roomName)}`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(roleData)
             });
             const result = await response.json();
             if (!response.ok) {
                 throw new Error(result.error || `HTTP error! Status: ${response.status}`);
             }
             return true;
         } catch (error) {
             _logAndDisplayError(`Failed to create role '${roleData.name}' in '${roomName}': ${error.message}`, 'createRole');
             return false;
         }
     },
     updateRole: async (roomName, roleName, roleData) => {
          if (!roomName || !roleName || !roleData) return false;
          try {
              const response = await fetch(`/roles/${encodeURIComponent(roomName)}/${encodeURIComponent(roleName)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(roleData)
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
              }
              return true;
          } catch (error) {
              _logAndDisplayError(`Failed to update role '${roleName}' in '${roomName}': ${error.message}`, 'updateRole');
              return false;
          }
     },
     deleteRole: async (roomName, roleName) => {
          if (!roomName || !roleName) return false;
          try {
              const response = await fetch(`/roles/${encodeURIComponent(roomName)}/${encodeURIComponent(roleName)}`, {
                  method: 'DELETE'
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
              }
              return true;
          } catch (error) {
              _logAndDisplayError(`Failed to delete role '${roleName}' from '${roomName}': ${error.message}`, 'deleteRole');
              return false;
          }
     },
     createNovel: async (roomName, novelData) => {
          if (!roomName || !novelData || !novelData.id) return false;
          try {
              const response = await fetch(`/novels/${encodeURIComponent(roomName)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(novelData)
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
              }
              return true;
          } catch (error) {
              _logAndDisplayError(`Failed to create novel '${novelData.name}' in '${roomName}': ${error.message}`, 'createNovel');
              return false;
          }
     },
     updateNovel: async (roomName, novelId, novelData) => {
          if (!roomName || !novelId || !novelData) return false;
          try {
              const response = await fetch(`/novels/${encodeURIComponent(roomName)}/${encodeURIComponent(novelId)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(novelData)
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
              }
              return true;
          } catch (error) {
              _logAndDisplayError(`Failed to update novel '${novelId}' in '${roomName}': ${error.message}`, 'updateNovel');
              return false;
          }
     },
     deleteNovel: async (roomName, novelId) => {
          if (!roomName || !novelId) return false;
          try {
              const response = await fetch(`/novels/${encodeURIComponent(roomName)}/${encodeURIComponent(novelId)}`, {
                  method: 'DELETE'
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! Status: ${response.status}`);
              }
              return true;
          } catch (error) {
              _logAndDisplayError(`Failed to delete novel '${novelId}' from '${roomName}': ${error.message}`, 'deleteNovel');
              return false;
          }
     },

    setBackgroundImage: async (roomName, imageDataUrl) => {
         if (!roomName || !imageDataUrl) {
             _logAndDisplayError("Missing roomName or imageDataUrl for setBackgroundImage", "setBackgroundImage");
             return;
         }
         try {
              const response = await fetch(`/background/${encodeURIComponent(roomName)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageDataUrl: imageDataUrl })
              });
              if (!response.ok) {
                   const errorData = await response.json().catch(() => ({}));
                   throw new Error(`Failed to set background: ${response.status} ${errorData.error || ''}`);
              }
              const result = await response.json();
              if (stateModule.currentChatroomDetails && stateModule.currentChatroomDetails.config.name === roomName) {
                   stateModule.currentChatroomDetails.config.backgroundImageFilename = result.path.split('/').pop();
                   if (elementsModule.chatContainer) {
                       elementsModule.chatContainer.style.backgroundImage = `url(${result.path}?t=${Date.now()})`;
                   }
              }
         } catch (error) {
              _logAndDisplayError(error.message, "setBackgroundImage");
         }
    },
    removeBackgroundImage: async (roomName) => {
         if (!roomName) return;
         try {
              const response = await fetch(`/background/${encodeURIComponent(roomName)}`, { method: 'DELETE' });
              if (!response.ok && response.status !== 404) {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(`Failed to delete background: ${response.status} ${errorData.error || ''}`);
              }
              if (stateModule.currentChatroomDetails && stateModule.currentChatroomDetails.config.name === roomName) {
                  stateModule.currentChatroomDetails.config.backgroundImageFilename = null;
                   if (elementsModule.chatContainer) {
                       elementsModule.chatContainer.style.backgroundImage = '';
                   }
              }
         } catch (error) {
              _logAndDisplayError(error.message, "removeBackgroundImage");
         }
    },
    exportPromptPresets: () => {
        const dataToExport = {
            version: 2,
            globalSettings: {
                systemInstruction: stateModule.config.systemInstruction || '',
                promptPresetTurns: stateModule.config.promptPresetTurns || []
            },
            sharedChatroomSettings: {
                model: stateModule.config.model || '',
                responseSchemaJson: stateModule.config.responseSchemaJson || '',
                responseSchemaParserJs: stateModule.config.responseSchemaParserJs || '',
                sharedDatabaseInstruction: stateModule.config.sharedDatabaseInstruction || '',
                mainPrompt: stateModule.config.mainPrompt || '',
            },
            toolSettings: {}
        };
        Object.keys(stateModule.config.toolSettings).forEach(toolName => {
            const toolConfig = stateModule.config.toolSettings[toolName];
            if (toolConfig) {
                 dataToExport.toolSettings[toolName] = {
                     model: toolConfig.model || '',
                     responseSchemaJson: toolConfig.responseSchemaJson || '',
                     responseSchemaParserJs: toolConfig.responseSchemaParserJs || '',
                     toolDatabaseInstruction: toolConfig.toolDatabaseInstruction || '',
                     mainPrompt: toolConfig.mainPrompt || ''
                 };
                 if (toolName === 'drawingMaster') {
                     dataToExport.toolSettings[toolName].novelContent = toolConfig.novelContent || '';
                 }
            }
        });
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompt_presets_extended.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    importPromptPresets: (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || typeof importedData !== 'object') {
                    throw new Error("Invalid file format: Not an object.");
                }

                if (importedData.version === 2) {
                    if (importedData.globalSettings) {
                        stateModule.config.systemInstruction = importedData.globalSettings.systemInstruction || '';
                        stateModule.config.promptPresetTurns = Array.isArray(importedData.globalSettings.promptPresetTurns) ? importedData.globalSettings.promptPresetTurns : [];
                    } else {
                         stateModule.config.systemInstruction = '';
                         stateModule.config.promptPresetTurns = [];
                    }
                    if (importedData.sharedChatroomSettings) {
                         stateModule.config.model = importedData.sharedChatroomSettings.model || '';
                         stateModule.config.responseSchemaJson = importedData.sharedChatroomSettings.responseSchemaJson || '';
                         stateModule.config.responseSchemaParserJs = importedData.sharedChatroomSettings.responseSchemaParserJs || '';
                         stateModule.config.sharedDatabaseInstruction = importedData.sharedChatroomSettings.sharedDatabaseInstruction || '';
                         stateModule.config.mainPrompt = importedData.sharedChatroomSettings.mainPrompt || '';
                    } else {
                         stateModule.config.model = '';
                         stateModule.config.responseSchemaJson = '';
                         stateModule.config.responseSchemaParserJs = '';
                         stateModule.config.sharedDatabaseInstruction = '';
                         stateModule.config.mainPrompt = '';
                    }
                    if (importedData.toolSettings && typeof importedData.toolSettings === 'object') {
                        Object.keys(importedData.toolSettings).forEach(toolName => {
                             if (stateModule.config.toolSettings[toolName]) {
                                 const importedTool = importedData.toolSettings[toolName];
                                 if (importedTool && typeof importedTool === 'object') {
                                     stateModule.config.toolSettings[toolName].model = importedTool.model || '';
                                     stateModule.config.toolSettings[toolName].responseSchemaJson = importedTool.responseSchemaJson || '';
                                     stateModule.config.toolSettings[toolName].responseSchemaParserJs = importedTool.responseSchemaParserJs || '';
                                     stateModule.config.toolSettings[toolName].toolDatabaseInstruction = importedTool.toolDatabaseInstruction || '';
                                     stateModule.config.toolSettings[toolName].mainPrompt = importedTool.mainPrompt || '';
                                      if (toolName === 'drawingMaster' && importedTool.novelContent) {
                                          stateModule.config.toolSettings.drawingMaster.novelContent = importedTool.novelContent;
                                      }
                                 }
                             }
                        });
                    }
                } else {
                     stateModule.config.systemInstruction = importedData.systemInstruction || '';
                     stateModule.config.promptPresetTurns = Array.isArray(importedData.promptPresetTurns) ? importedData.promptPresetTurns : [];
                     _logAndDisplayError("Imported data is V1 format. Only systemInstruction and promptPresetTurns were imported.", 'importPromptPresets');
                }
                if (typeof uiSettingsModule !== 'undefined') {
                    uiSettingsModule.loadPromptPresetSettings();
                    uiSettingsModule.renderPromptPresetsList();
                    uiSettingsModule.loadChatroomModelSetting();
                    uiSettingsModule.loadSettingValue('responseSchemaJson');
                    uiSettingsModule.loadSettingValue('responseSchemaParserJs');
                    uiSettingsModule.loadSettingValue('sharedDatabaseInstruction');
                    uiSettingsModule.loadChatroomMainPromptSetting();
                    ['drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster', 'privateAssistant'].forEach(toolName => {
                        uiSettingsModule.loadGodSettings(toolName);
                    });
                }
                if (typeof mainModule !== 'undefined') {
                    mainModule.triggerDebouncedSave();
                }

            } catch (error) {
                _logAndDisplayError(`Failed to import prompt presets: ${error.message}`, 'importPromptPresets');

            }
        };
        reader.onerror = () => {
            _logAndDisplayError('Error reading file.', 'importPromptPresets');

        };
        reader.readAsText(file);
    },
};