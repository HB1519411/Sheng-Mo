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
        drawingMaster: { responseSchemaJson: '', responseSchemaParserJs: '', toolDatabaseInstruction: '', enabled: false, model: '', mainPrompt: '' },
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
    referenceTextLength: 10000,
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
const API_KEY_INDEX_STORAGE_KEY = 'geminiChatApiKeyIndex';
const API_KEY_FAILURES_STORAGE_KEY = 'geminiChatApiKeyFailures';
const MAX_RETRIES = 5;
const REQUEST_TIMEOUT_MS = 60000;


const apiKeyManager = {
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
        const keysJson = apiKeyManager._getLocalStorageItem(API_KEYS_STORAGE_KEY);
        try {
            const keys = keysJson ? JSON.parse(keysJson) : [];
            return Array.isArray(keys) ? keys : [];
        } catch (e) {
            return [];
        }
    },
    setApiKeys: (keys) => {
        if (!Array.isArray(keys)) return;
        apiKeyManager._setLocalStorageItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
        apiKeyManager.setCurrentApiKeyIndex(0);

        const currentFailures = apiKeyManager._getApiKeyFailures();
        const newFailures = {};
        keys.forEach(key => {
            newFailures[key] = currentFailures[key] || 0;
        });
        apiKeyManager._setApiKeyFailures(newFailures);
    },
    getCurrentApiKeyIndex: () => {
        const index = parseInt(apiKeyManager._getLocalStorageItem(API_KEY_INDEX_STORAGE_KEY), 10);
        return !isNaN(index) && index >= 0 ? index : 0;
    },
    setCurrentApiKeyIndex: (index) => {
        if (!isNaN(index) && index >= 0) {
            apiKeyManager._setLocalStorageItem(API_KEY_INDEX_STORAGE_KEY, String(index));
        }
    },
    getNaiApiKey: () => {
        return apiKeyManager._getLocalStorageItem(NAI_API_KEY_STORAGE_KEY) || '';
    },
    setNaiApiKey: (key) => {
        apiKeyManager._setLocalStorageItem(NAI_API_KEY_STORAGE_KEY, key || '');
    },
    getNextApiKey: () => {
        const keys = apiKeyManager.getApiKeys();
        if (keys.length === 0) {
            throw new Error("No API keys entered in settings.");
        }
        const currentIndex = apiKeyManager.getCurrentApiKeyIndex();
        const nextIndex = (currentIndex % keys.length);
        const apiKey = keys[nextIndex];
        apiKeyManager.setCurrentApiKeyIndex(nextIndex + 1);
        return apiKey;
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

    let stack = errorObj?.stack;
    if (!stack && errorObj instanceof Error) {
        stack = errorObj.toString();
    }

    console.error(`--- ERROR START ---`);
    console.error(`Message: ${message}`);
    console.error(`Source: ${source}`);
    console.error(`Line: ${lineno}, Column: ${colno}`);
    if (stack) {
        console.error(`Stack: ${stack}`);
        if (!fullMessage.includes(stack.split('\n')[0])) {
             fullMessage += `\nStack: ${stack}`;
        }
    } else {
        console.error(`Stack: Not Available`);
    }
    console.error(`--- ERROR END ---`);


    if (typeof uiSettingsModule !== 'undefined' && uiSettingsModule.displayErrorLog) {

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
             }
        });


        Object.assign(stateModule.config, loadedConfig);
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


function getNovelReferenceTextForPayload() {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config) return "[无激活聊天室数据]";

    const activeNovelIds = chatroomDetails.config.activeNovelIds || [];
    const novelDefs = chatroomDetails.novels || [];
    const novelCurrentSegmentIds = chatroomDetails.config.novelCurrentSegmentIds || {};

    if (activeNovelIds.length === 0) return "[当前聊天室无激活小说]";

    const totalTargetChars = stateModule.config.referenceTextLength || defaultConfig.referenceTextLength;
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
         return "[无法生成小说参考文本，请检查激活状态和内容加载情况]";
    }

    return textSnippets.join('\n\n');
}

const placeholderModule = {

    _replacePlaceholdersInString: (text, context, excludePlaceholders = []) => {
        if (typeof text !== 'string') return text;

        function wrapWithTag(tagName, content) {
            const safeContent = content || '';
            return `<${tagName}>\n${tagName}:\n${safeContent}\n</${tagName}>`;
        }

        const cachedContext = context?.cachedContext;
        if (!cachedContext) return text;


        let novelReferenceText = "[参考文本未生成]";
        if (!excludePlaceholders.includes('{{参考文本}}') && text.includes('{{参考文本}}')) {
            novelReferenceText = getNovelReferenceTextForPayload();
        }

        let rawMainPromptText = context.mainPrompt || '[主提示词为空]';

        let processedMainPromptText = rawMainPromptText;
        if (!excludePlaceholders.includes('{{主提示词}}') && text.includes('{{主提示词}}')) {
            processedMainPromptText = placeholderModule._replacePlaceholdersInString(
                rawMainPromptText,
                context,
                [...excludePlaceholders, '{{数据库}}', '{{主提示词}}']
            );
        }


        let roleplayRuleText = stateModule.currentChatroomDetails?.config?.roleplayRules || '[扮演规则为空]';
        let publicInfoText = stateModule.currentChatroomDetails?.config?.publicInfo || '[公共信息为空]';
        let latestMessageContentText = cachedContext?.latestMessageContent || '[无最新消息]';

        let roleSettingValue = '[未设定]';
        let roleMemoryValue = '[未设定]';
        let currentRoleDetailedStateValue = '[无详细状态]';
        let roleNameValue = context.currentRoleNameForPayload || '[未知角色]';

        const isCharacterUpdater = context.roleType === 'tool' && context.currentRoleNameForPayload === 'characterUpdateMaster';
        const targetRoleName = context.targetRoleNameForTool;
        const targetRoleData = context.targetRoleData;
        const currentRoleData = context.roleData;

        if (isCharacterUpdater) {
            roleNameValue = toolNameMap['characterUpdateMaster'];
            if (targetRoleName && targetRoleData) {
                roleSettingValue = targetRoleData.setting || `[${targetRoleName} 设定未获取]`;
                roleMemoryValue = targetRoleData.memory || `[${targetRoleName} 记忆未获取]`;
                currentRoleDetailedStateValue = cachedContext?.roleDetailedStates?.[targetRoleName] || `[${targetRoleName} 无详细状态]`;
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
        const joinedSettings = rawNonSilentRoleSettingsValue ? rawNonSilentRoleSettingsValue.split('\n\n').join('\n---\n') : '[无激活角色设定]';
        const rawNonSilentRoleDetailedStatesValue = cachedContext?.nonSilentRoleDetailedStatesValue;
        const joinedDetailedStates = rawNonSilentRoleDetailedStatesValue ? rawNonSilentRoleDetailedStatesValue.split('\n\n').join('\n---\n') : '[无激活角色详细状态]';

        const wrappedReferenceText = wrapWithTag('ReferenceText', novelReferenceText);
        const wrappedRoleplayRule = wrapWithTag('RoleplayRules', roleplayRuleText);
        const wrappedPublicInfo = wrapWithTag('PublicInfo', publicInfoText);
        const wrappedMainPrompt = wrapWithTag('MainPrompt', processedMainPromptText);
        const wrappedLatestMessage = wrapWithTag('LatestMessage', latestMessageContentText);


        const replacements = {
            '{{角色名称}}': roleNameValue,
            '{{角色名称集}}': cachedContext?.nonSilentRolesValue || '[无激活角色]',
            '{{最新角色}}': cachedContext?.lastActor || '[最近行动者未知]',
            '{{角色设定}}': wrapWithTag('CharacterSetting', roleSettingValue),
            '{{角色记忆}}': wrapWithTag('CharacterMemory', roleMemoryValue),
            '{{角色状态}}': wrapWithTag('CharacterState', currentRoleDetailedStateValue),
            '{{消息记录}}': wrapWithTag('History', rawFormattedHistory),
            '{{最新消息}}': wrappedLatestMessage,
            '{{角色设定集}}': wrapWithTag('CharacterSettingsCollection', joinedSettings),
            '{{角色状态集}}': wrapWithTag('CharacterStatesCollection', joinedDetailedStates),
            '{{世界信息}}': wrapWithTag('WorldInfo', cachedContext?.worldInfo || '[世界信息未获取]'),
            '{{参考文本}}': wrappedReferenceText,
            '{{扮演规则}}': wrappedRoleplayRule,
            '{{公共信息}}': wrappedPublicInfo,
            '{{主提示词}}': wrappedMainPrompt,
        };


        let replacedString = text;
        for (const placeholder in replacements) {
             if (excludePlaceholders.includes(placeholder)) continue;
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

        if (!lastMessageProcessedForCache && speechActionText && speechActionText.trim() !== '' && speechActionText !== "[Generating Image]") {
            newCache.latestMessageContent = speechActionText;
            lastMessageProcessedForCache = true;
        }

        if (!lastActorFound && (roleType === 'role' || roleType === 'temporary_role')) {
            newCache.lastActor = roleName;
            lastActorFound = true;
        }

        if (roleType === 'role' || roleType === 'temporary_role') {
            const trimmedText = (speechActionText || '').trim();
            if (trimmedText && speechActionText !== "[Generating Image]") {
                historyLines.unshift(`${roleName}：\n${trimmedText}`);
            }
        }

        if (roleName === 'gameHost' && sourceType === 'ai') {
            const jsonData = parsedResult;

            if (jsonData && typeof jsonData === 'object') {
                if (!latestGameHostMessageData) {
                    latestGameHostMessageData = jsonData;
                    if (jsonData.sceneContext) {
                        newCache.worldInfo = _formatObjectToCustomString(jsonData.sceneContext || {});
                    } else {
                        newCache.worldInfo = "[场景信息未提供]";
                    }
                }

                if (jsonData.updatedCharacterInfo) {
                    const charName = jsonData.updatedCharacterInfo.characterName;
                    if (charName) {
                         newCache.roleDetailedStates[charName] = _formatObjectToCustomString(jsonData.updatedCharacterInfo || {});
                         if (!(charName in newCache.roleStates)) {
                              newCache.roleStates[charName] = uiChatModule.ROLE_STATE_DEFAULT;
                         }
                    }
                }

                 if (jsonData.actionOutcome?.statement) {
                      const statement = jsonData.actionOutcome.statement;
                      if (statement && typeof statement === 'string' && statement.trim() !== '') {
                         historyLines.unshift(`[结果]: ${statement.trim()}`);
                      }
                 }
            } else if (messageObject.parserError && !latestGameHostMessageData) {
                 newCache.worldInfo = `[游戏主持人响应解析错误: ${messageObject.parserError}]`;
            } else if (!latestGameHostMessageData) {
                 newCache.worldInfo = `[游戏主持人响应 ${id} 的解析结果无效]`;
            }
        } else if (roleName === 'characterUpdateMaster' && sourceType === 'ai' && parsedResult && !messageObject.parserError) {
            const targetRoleName = messageObject.targetRoleName;
            const characterName = parsedResult.updatedCharacterMemory?.characterName || parsedResult.updatedCharacterSettings?.characterName;
            if (targetRoleName && targetRoleName === characterName) {
                 newCache.roleDetailedStates[targetRoleName] = uiChatModule._formatCharacterUpdateMasterDisplay(parsedResult);
            } else if (characterName) {
                 newCache.roleDetailedStates[characterName] = uiChatModule._formatCharacterUpdateMasterDisplay(parsedResult);
            }
        }
    }


    newCache.formattedHistory = historyLines.join('\n');


    const nonSilentRoleNames = Object.entries(newCache.roleStates)
        .filter(([name, state]) => [uiChatModule.ROLE_STATE_ACTIVE, uiChatModule.ROLE_STATE_USER_CONTROL].includes(state || uiChatModule.ROLE_STATE_DEFAULT))
        .map(([name, state]) => name);

    newCache.nonSilentRolesValue = nonSilentRoleNames.join(',') || '[无激活角色]';

    newCache.nonSilentRoleSettingsValue = nonSilentRoleNames.map(rName => {
        const roleData = allRolesInRoom.find(r => r.name === rName);
        return roleData?.setting || `[${rName} 设定未获取或为临时角色]`;
    }).join('\n\n') || '[无激活角色设定]';

    newCache.nonSilentRoleDetailedStatesValue = nonSilentRoleNames.map(rName =>
         newCache.roleDetailedStates[rName] || `[${rName} 无详细状态]`
    ).join('\n\n') || '[无激活角色详细状态]';


    stateModule.chatContextCache = newCache;
    if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
}


const _prepareRoleOrToolContext = async (roleName, roleType, targetRoleNameForTool = null) => {
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


    if (roleType === 'role' || roleType === 'temporary_role') {
        if (!chatroomDetails) {
            throw new Error("无法准备角色 API 请求：无激活聊天室数据。");
        }

        roleData = chatroomDetails.roles.find(r => r.name === roleName);

        modelToUse = stateModule.config.model;
        if (!modelToUse) { throw new Error("请在通用配置中选择一个模型。"); }
        databaseInstruction = stateModule.config.sharedDatabaseInstruction || '';
        specificResponseSchema = stateModule.config.responseSchemaJson || null;
        specificResponseSchemaParserJs = stateModule.config.responseSchemaParserJs || '';
        mainPrompt = stateModule.config.mainPrompt || '';

    } else if (roleType === 'tool') {
        const toolSettings = stateModule.config.toolSettings[roleName];
        if (!toolSettings || !toolSettings.enabled) {
            return null;
        }
        modelToUse = toolSettings.model;
        if (!modelToUse) { throw new Error(`请在工具 ${toolNameMap[roleName]} 的设置中选择一个模型。`); }
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

    _sendGeminiRequestWithRetry: async (roleName, roleType, targetRoleNameForTool = null) => {
        let lastError = null;
        let context = null;
        let finalPayload = null;

        try {
            context = await _prepareRoleOrToolContext(roleName, roleType, targetRoleNameForTool);
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


            let apiKey;
            try {
                apiKey = apiKeyManager.getNextApiKey();
            } catch(e) {
                lastError = e;
                break;
            }
            if (!apiKey) {
                 lastError = new Error("Failed to get an API key.");
                 break;
            }

            const result = await _performApiCall(apiKey, finalPayload, roleName, targetRoleNameForTool);

            if (!result.success) {
                lastError = new Error(`${result.errorType}: ${result.detail}`);
                apiKeyManager.incrementApiKeyFailure(apiKey);
                if (typeof uiChatModule !== 'undefined' && uiChatModule.showRetryIndicator) {
                     uiChatModule.showRetryIndicator();
                }
                if (attempt === MAX_RETRIES) break; else continue;
            }

            if (!result.data || typeof result.data.text_content !== 'string') {
                lastError = new Error('API response missing text_content');
                apiKeyManager.incrementApiKeyFailure(apiKey);
                if (typeof uiChatModule !== 'undefined' && uiChatModule.showRetryIndicator) {
                     uiChatModule.showRetryIndicator();
                }
                 if (attempt === MAX_RETRIES) break; else continue;
            }

            const { parsedResult, parserError } = uiChatModule._parseAIResponse(result.data.text_content, roleName, roleType);

             if (parserError && (roleName === 'privateAssistant' || roleName === 'characterUpdateMaster')) {
                 lastError = new Error(`Parsing error (Attempt ${attempt}/${MAX_RETRIES}): ${parserError}`);
                 apiKeyManager.incrementApiKeyFailure(apiKey);
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
                      console.warn("uiChatModule.displayAIResponse not available to display successful response.");
                 }
                 return;
            }
        }


        _logAndDisplayError(`Gemini request ultimately failed (Role: ${roleName}): ${lastError?.message || 'Unknown error'}`, '_sendGeminiRequestWithRetry');
    },

    _prepareNovelAiPayload: async (parsedDrawingMasterData, rawJsonText) => {
         if (!parsedDrawingMasterData || typeof parsedDrawingMasterData !== 'object' || !parsedDrawingMasterData.generalTags || !parsedDrawingMasterData.characterTagSets) {
             throw new Error("Invalid Drawing Master data, cannot prepare NAI Payload.");
         }

         const naiApiKey = apiKeyManager.getNaiApiKey();
         if (!naiApiKey) {
             throw new Error("NovelAI API Key is not set.");
         }

         const generalTags = parsedDrawingMasterData.generalTags;
         const characterTagSets = parsedDrawingMasterData.characterTagSets || [];
         const numCharacters = characterTagSets.length;

         let promptParts = [];

         let generalPromptPart = [];
         if (stateModule.config.novelaiDefaultPositivePrompt) generalPromptPart.push(stateModule.config.novelaiDefaultPositivePrompt);
         if (numCharacters > 0) generalPromptPart.push(`${numCharacters}character${numCharacters > 1 ? 's' : ''}`);
         if (stateModule.config.novelaiArtistChain) generalPromptPart.push(stateModule.config.novelaiArtistChain);
         if (generalTags.background && generalTags.background !== '0') generalPromptPart.push(generalTags.background);
         if (generalTags.time && generalTags.time !== '0') generalPromptPart.push(generalTags.time);
         if (generalTags.nsfw && generalTags.nsfw !== '0') generalPromptPart.push(generalTags.nsfw);

         promptParts.push(generalPromptPart.join(', ').trim());

         let mainDrawingPromptContentForDisplay = "";

         const chatroomDetails = stateModule.currentChatroomDetails;
         if (!chatroomDetails) { throw new Error("Cannot get current chatroom details."); }

         const characterPromises = characterTagSets.map(async charSet => {
             let charPromptPart = [];
             const charName = charSet.characterName;
             const roleData = chatroomDetails.roles.find(r => r.name === charName);
             const drawingTemplate = roleData?.drawingTemplate || '';

             if (charSet.subject && charSet.subject !== '0') charPromptPart.push(charSet.subject);
             if (drawingTemplate) charPromptPart.push(drawingTemplate);

             const tagKeys = ["focus", "actions", "expressions", "traits", "clothing", "props"];
             tagKeys.forEach(key => {
                 if (charSet[key] && charSet[key] !== '0') {
                     charPromptPart.push(charSet[key]);
                 }
             });

             const characterPromptString = charPromptPart.join(', ').trim();
             return { name: charName, prompt: characterPromptString };
         });

         const characterResults = await Promise.all(characterPromises);

         characterResults.forEach(result => {
             promptParts.push(result.prompt);
             if (mainDrawingPromptContentForDisplay) mainDrawingPromptContentForDisplay += " | ";
             mainDrawingPromptContentForDisplay += `${result.name}: ${result.prompt}`;
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
                    console.warn("uiChatModule.handleNovelAiResponse not available for NAI success");
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
        let allModelSelects = document.querySelectorAll('.settings-select[id$="-model-select-settings"], select[id$="-model-settings"]');
        const modelSelects = Array.from(allModelSelects).filter(sel => sel.id !== 'novelai-model-settings');
        stateModule.availableModels = [];

        const setOptions = (selectElement, message) => {
            selectElement.innerHTML = `<option value="" disabled selected>${message}</option>`;
        };

        modelSelects.forEach(sel => setOptions(sel, 'Loading...'));


        let allKeys = [];
        try {
            allKeys = apiKeyManager.getApiKeys();
        } catch (e) {
            _logAndDisplayError(`Error getting API key list: ${e.message}`, 'fetchModels');
            modelSelects.forEach(sel => setOptions(sel, 'Key Error'));
            return;
        }

        if (allKeys.length === 0) {
            _logAndDisplayError("No API keys configured, cannot load model list.", 'fetchModels');
            modelSelects.forEach(sel => setOptions(sel, 'No API Key'));
            return;
        }

        let success = false;
        let lastError = null;
        const maxAttempts = allKeys.length;

        apiKeyManager.setCurrentApiKeyIndex(0);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let apiKey;
            try {
                 apiKey = apiKeyManager.getNextApiKey();
            } catch (e) {
                lastError = e;
                _logAndDisplayError(`Error getting API key #${attempt + 1}: ${e.message}`, 'fetchModels');
                continue;
            }

            if (!apiKey) {
                 lastError = new Error("Got an empty API key.");
                 _logAndDisplayError(`Attempt ${attempt + 1}/${maxAttempts}: Got an empty API key.`, 'fetchModels');
                 continue;
            }

            try {
                const response = await fetch(`/models?key=${apiKey}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    lastError = new Error(`Model list load failed (Key ${apiKey.substring(0, 4)}..., Attempt ${attempt + 1}/${maxAttempts}): ${response.status} ${errorText}`);
                    _logAndDisplayError(lastError.message, 'fetchModels');
                    apiKeyManager.incrementApiKeyFailure(apiKey);
                    continue;
                }

                const data = await response.json();

                if (data.models && Array.isArray(data.models)) {
                    data.models.forEach(model => {
                       if (model.name && model.supportedGenerationMethods?.includes('generateContent')) {
                           const modelId = model.name.startsWith('models/') ? model.name.substring(7) : model.name;
                           stateModule.availableModels.push({ id: modelId, name: model.displayName || modelId });
                       }
                    });
                    stateModule.availableModels.sort((a, b) => a.name.localeCompare(b.name));

                    modelSelects.forEach(selectElement => {
                         selectElement.innerHTML = '';
                         let currentSavedValue = null;


                         if (selectElement.id === 'chatroom-model-select-settings') {
                             currentSavedValue = stateModule.config.model || '';
                         } else {
                             const toolMatch = selectElement.id.match(/^(.*)-model-settings$/);
                             if (toolMatch) {
                                const toolName = toolMatch[1].replace(/-(\w)/g, (match, p1) => p1.toUpperCase());
                                if(stateModule.config.toolSettings[toolName]) {
                                    currentSavedValue = stateModule.config.toolSettings[toolName].model || '';
                                }
                             }
                         }

                         let valueFound = false;
                         stateModule.availableModels.forEach(model => {
                             const option = new Option(model.name, model.id);
                             selectElement.add(option);
                             if (currentSavedValue === model.id) {
                                 option.selected = true;
                                 valueFound = true;
                             }
                         });

                         if (!valueFound && selectElement.options.length > 0) {
                              selectElement.selectedIndex = 0;

                         } else if (selectElement.options.length === 0) {
                              setOptions(selectElement, 'No models available');
                         }
                    });


                    success = true;
                    break;
                } else {
                     lastError = new Error("Invalid model list response format (no models array)");
                     _logAndDisplayError(lastError.message, 'fetchModels');
                     apiKeyManager.incrementApiKeyFailure(apiKey);
                     continue;
                }

            } catch (error) {
                lastError = error;
                _logAndDisplayError(`Network or processing error fetching models (Key ${apiKey.substring(0, 4)}..., Attempt ${attempt + 1}/${maxAttempts}): ${error.message}`, 'fetchModels');
                apiKeyManager.incrementApiKeyFailure(apiKey);
                continue;
            }
        }

        if (!success) {
            _logAndDisplayError(`All API key attempts failed to load model list. Last error: ${lastError?.message || 'Unknown error'}`, 'fetchModels');
            modelSelects.forEach(sel => setOptions(sel, 'Load Failed'));
        }


        if (success && typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    sendSingleMessageForRoleImpl: async (roleName, roleType, targetRoleNameForTool = null) => {
        await apiModule._sendGeminiRequestWithRetry(roleName, roleType, targetRoleNameForTool);
    },

    triggerRoleResponse: (roleName) => {
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
                apiModule._triggerRoleResponseInternal(roleName, roleType);
             });
        } else {
             apiModule._triggerRoleResponseInternal(roleName, roleType);
        }
    },

    _triggerRoleResponseInternal: (roleName, roleType) => {
        apiModule.sendSingleMessageForRoleImpl(roleName, roleType);
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
                alert("提示导入成功");
            } catch (error) {
                _logAndDisplayError(`Failed to import prompt presets: ${error.message}`, 'importPromptPresets');
                alert(`Failed to import prompt presets: ${error.message}`);
            }
        };
        reader.onerror = () => {
            _logAndDisplayError('Error reading file.', 'importPromptPresets');
            alert('Error reading file.');
        };
        reader.readAsText(file);
    },

};
