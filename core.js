const defaultConfig = {
    primaryModel: '',
    secondaryModel: '',
    temperature: '1.0',
    topP: '0.9',
    topK: '40',
    maxOutputTokens: '2048',
    systemInstruction: '',
    responseMimeType: 'application/json',
    user1Instruction: '',
    user2Instruction: '',
    model1Instruction: '',
    model2Instruction: '',
    user3Instruction: '',
    responseSchemaJson: '',
    responseSchemaParserJs: '',
    roles: [],
    temporaryRoles: ["管理员"],
    toolSettings: {
        drawingMaster: { responseSchemaJson: '', responseSchemaParserJs: '', user2Instruction: '', enabled: false, display: true },
        gameHost: { responseSchemaJson: '', responseSchemaParserJs: '', user2Instruction: '', enabled: false, display: true },
        writingMaster: { responseSchemaJson: '', responseSchemaParserJs: '', user2Instruction: '', enabled: false, display: true },
        characterUpdateMaster: { responseSchemaJson: '', responseSchemaParserJs: '', user2Instruction: '', enabled: false, display: true },
    },
    chatRooms: [
        {
            name: "默认",
            roles: ["管理员"],
            associatedNovelIds: [],
            roleplayRules: "",
            publicInfo: "",
            backgroundImagePath: null
        }
    ],
    activeChatRoomName: "默认",
    isRunPaused: true,
    isRoleListVisible: false,
    roleStates: {},
    errorLogs: [],
    novels: [],
    activeNovelIdsInChatroom: {},
    lastViewedNovelId: null,
    referenceTextLength: 10000,
    novelaiModel: "",
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
    novelCurrentSegmentIds: {},
};

const stateModule = {
    config: JSON.parse(JSON.stringify(defaultConfig)),
    activeSettingPage: null,
    pageStack: [],
    activeMessageActions: null,
    editingMessageContainer: null,
    currentRole: null,
    currentChatRoom: null,
    activeRoleStateButtons: null,
    availableModels: [],
    chatContextCache: null,
    currentChatHistoryData: [],
    isNovelInterfaceVisible: false,
    activeNovelPage: null,
    novelPageStack: [],
    currentNovelId: null,
    novelContentCache: {},
    currentTocIndexByNovel: {},
    isNovelLoading: false,
    scrollUpdateTimer: null,
    naiRequestQueue: [],
    isNaiProcessing: false,
    tempImageUrls: {},
    displayedImageCount: 0,
    displayedImageOrder: [],
    lastNaiPrompt: "",
    roleDataCache: {},
    historySaveDebounceTimer: null,
    historySaveDebounceDelay: 2500,
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
            throw new Error("未在设置中输入 API 密钥。");
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

    if (stateModule.config && Array.isArray(stateModule.config.errorLogs)) {
        while (stateModule.config.errorLogs.length >= 100) {
            stateModule.config.errorLogs.shift();
        }
        stateModule.config.errorLogs.push(fullMessage);
    }

    if (typeof uiSettingsModule !== 'undefined' && uiSettingsModule.displayErrorLog) {
        uiSettingsModule.displayErrorLog(stateModule.config.errorLogs);
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
        const response = await fetch('/load-config');
        let loadedConfig;
        if (response.ok) {
             loadedConfig = await response.json();
        } else {
             _logAndDisplayError(`Failed to load config: ${response.status}`, 'loadConfig');
             loadedConfig = JSON.parse(JSON.stringify(defaultConfig));
        }
        Object.assign(stateModule.config, loadedConfig);

    }
};

const roleDataManager = {
    _fetchRoleData: async (roleName) => {
        if (!roleName || typeof roleName !== 'string') {
            _logAndDisplayError(`Invalid role name provided to _fetchRoleData: ${roleName}`, '_fetchRoleData');
            return null;
        }
        if (stateModule.roleDataCache[roleName]) {
            return stateModule.roleDataCache[roleName];
        }
        try {
            const response = await fetch(`/roles/${encodeURIComponent(roleName)}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch role data for ${roleName}: ${response.status}`);
            }
            const data = await response.json();
            stateModule.roleDataCache[roleName] = data;
            return data;
        } catch (error) {
            _logAndDisplayError(error.message, '_fetchRoleData');
            return null;
        }
    },
    getRoleData: async (roleName) => {
        return await roleDataManager._fetchRoleData(roleName);
    },
    saveRoleData: async (roleName, data) => {
        if (!roleName || typeof roleName !== 'string' || !data || typeof data !== 'object') {
            _logAndDisplayError(`Invalid parameters for saveRoleData: roleName=${roleName}`, 'saveRoleData');
            return false;
        }
        try {
            const response = await fetch(`/roles/${encodeURIComponent(roleName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to save role data for ${roleName}: ${response.status} ${errorData.error || ''}`);
            }
            stateModule.roleDataCache[roleName] = data;
            updateChatContextCache();
            return true;
        } catch (error) {
            _logAndDisplayError(error.message, 'saveRoleData');
            return false;
        }
    },
    deleteRole: async (roleName) => {
        if (!roleName || typeof roleName !== 'string') {
            _logAndDisplayError(`Invalid role name for deleteRole: ${roleName}`, 'deleteRole');
            return false;
        }
        try {
            const response = await fetch(`/roles/${encodeURIComponent(roleName)}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 404) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to delete role file for ${roleName}: ${response.status} ${errorData.error || ''}`);
            }
            delete stateModule.roleDataCache[roleName];
            return true;
        } catch (error) {
            _logAndDisplayError(error.message, 'deleteRole');
            return false;
        }
    },
    renameRole: async (oldName, newName) => {
        if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
            _logAndDisplayError(`Invalid names for renameRole: old=${oldName}, new=${newName}`, 'renameRole');
            return false;
        }
        try {
            const response = await fetch(`/roles/${encodeURIComponent(oldName)}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: newName })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to rename role ${oldName} to ${newName}: ${response.status} ${errorData.error || ''}`);
            }
            delete stateModule.roleDataCache[oldName];
            return true;
        } catch (error) {
            _logAndDisplayError(error.message, 'renameRole');
            return false;
        }
    },
    clearCache: () => {
        stateModule.roleDataCache = {};
    }
};

const toolNameMap = {
    drawingMaster: "绘图大师",
    gameHost: "游戏主持人",
    writingMaster: "写作大师",
    characterUpdateMaster: "角色更新大师"
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

function placeholderPayloadNeedsNovelText(payload) {
    const payloadString = JSON.stringify(payload);
    return payloadString.includes('{{参考文本}}');
}

function placeholderPayloadNeedsRoleplayRule(payload) {
    const payloadString = JSON.stringify(payload);
    return payloadString.includes('{{扮演规则}}');
}

function placeholderPayloadNeedsPublicInfo(payload) {
    const payloadString = JSON.stringify(payload);
    return payloadString.includes('{{公共信息}}');
}

function getNovelReferenceTextForPayload() {
    const activeRoomName = stateModule.config.activeChatRoomName;
    if (!activeRoomName) return "[无激活聊天室]";

    const activeNovelIds = stateModule.config.activeNovelIdsInChatroom[activeRoomName] || [];
    if (activeNovelIds.length === 0) return "[当前聊天室无激活小说]";

    const totalTargetChars = stateModule.config.referenceTextLength || defaultConfig.referenceTextLength;
    const perNovelChars = activeNovelIds.length > 0 ? Math.floor(totalTargetChars / activeNovelIds.length) : 0;
    if (perNovelChars <= 0) return "[字符分配不足]";

    const textSnippets = [];
    let missingContentNovels = [];

    for (const novelId of activeNovelIds) {
        const novelData = stateModule.novelContentCache[novelId];
        const novelMeta = stateModule.config.novels.find(n => n.id === novelId);
        const novelName = novelMeta?.name || `小说 ${novelId.substring(0, 4)}`;

        if (!novelData || !novelData.segments || novelData.segments.length === 0) {
            missingContentNovels.push(novelName);
            continue;
        }

        const segments = novelData.segments;
        const numSegments = segments.length;
        let currentSegmentId = parseInt(stateModule.config.novelCurrentSegmentIds[novelId], 10);
        if (isNaN(currentSegmentId) || currentSegmentId < 0 || currentSegmentId >= numSegments) {
            currentSegmentId = 0;
        }

        let charsCollected = 0;
        let currentSnippetSegments = [];

        const avgSegmentLength = segments.reduce((sum, seg) => sum + seg.content.length, 0) / numSegments || 200;
        const targetSegmentCount = Math.max(1, Math.ceil(perNovelChars / avgSegmentLength));

        const segmentsBefore = Math.floor(targetSegmentCount / 3);
        const segmentsAfter = targetSegmentCount - segmentsBefore -1;

        let startIdx = Math.max(0, currentSegmentId - segmentsBefore);
        let endIdx = Math.min(numSegments - 1, currentSegmentId + segmentsAfter);

        for (let i = startIdx; i <= endIdx; i++) {
             const segment = segments[i];
             if (segment) {
                 currentSnippetSegments.push(segment.content);
                 charsCollected += segment.content.length;
             }
        }

        while (charsCollected < perNovelChars && (startIdx > 0 || endIdx < numSegments - 1)) {
             let added = false;
             if (startIdx > 0) {
                 startIdx--;
                 const segment = segments[startIdx];
                 if (segment) {
                     currentSnippetSegments.unshift(segment.content);
                     charsCollected += segment.content.length;
                     added = true;
                 }
             }
             if (charsCollected < perNovelChars && endIdx < numSegments - 1) {
                 endIdx++;
                 const segment = segments[endIdx];
                  if (segment) {
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
    replacePlaceholders: async (payload, roleName, roleType, cachedContext) => {
        if (!cachedContext) {
             return payload;
        }
        function wrapWithTag(tagName, content) {
            const safeContent = content || '';
            return `<${tagName}>\n${tagName}:\n${safeContent}\n</${tagName}>`;
        }
        let novelReferenceText = "";
        if (placeholderPayloadNeedsNovelText(payload)) {
            novelReferenceText = getNovelReferenceTextForPayload();
        }
        let roleplayRuleText = "";
        if (placeholderPayloadNeedsRoleplayRule(payload)) {
            const activeRoom = stateModule.config.chatRooms.find(r => r.name === stateModule.config.activeChatRoomName);
            roleplayRuleText = activeRoom?.roleplayRules || "";
        }
        let publicInfoText = "";
        if (placeholderPayloadNeedsPublicInfo(payload)) {
             const activeRoom = stateModule.config.chatRooms.find(r => r.name === stateModule.config.activeChatRoomName);
             publicInfoText = activeRoom?.publicInfo || "";
        }

        let roleSettingValue = '[未设定]';
        let roleMemoryValue = '[未设定]';
        let targetRoleSettingValue = '[未设定]';
        let targetRoleMemoryValue = '[未设定]';

        if (roleType === 'role') {
            const roleData = await roleDataManager.getRoleData(roleName);
            roleSettingValue = roleData?.setting || '[设定未获取]';
            roleMemoryValue = roleData?.memory || '[记忆未获取]';
        } else if (roleType === 'temporary_role') {
            roleSettingValue = `[临时角色 ${roleName}]`;
            roleMemoryValue = `[临时角色 ${roleName}]`;
        } else if (roleType === 'tool') {
             roleSettingValue = stateModule.config.systemInstruction || '[系统指令未设定]';
             roleMemoryValue = '[工具无记忆]';
             if (payload.targetRoleNameForTool) {
                 const targetName = payload.targetRoleNameForTool;
                 const targetRoleData = await roleDataManager.getRoleData(targetName);
                 targetRoleSettingValue = targetRoleData?.setting || `[目标角色 ${targetName} 设定未获取]`;
                 targetRoleMemoryValue = targetRoleData?.memory || `[目标角色 ${targetName} 记忆未获取]`;
                 roleSettingValue = targetRoleSettingValue;
                 roleMemoryValue = targetRoleMemoryValue;
             }
        }
        let rawFormattedHistory = cachedContext?.formattedHistory || '';
        const rawNonSilentRoleSettingsValue = cachedContext?.nonSilentRoleSettingsValue;
        const joinedSettings = rawNonSilentRoleSettingsValue
            ? rawNonSilentRoleSettingsValue.split('\n\n').join('\n---\n')
            : '[无激活角色设定]';

        const rawNonSilentRoleStatesValue = cachedContext?.nonSilentRoleStatesValue;
        const joinedStates = rawNonSilentRoleStatesValue
            ? rawNonSilentRoleStatesValue.split('\n\n').join('\n---\n')
            : '[无激活角色状态]';

        const wrappedReferenceText = novelReferenceText ? wrapWithTag('ReferenceText', novelReferenceText) : "";
        const wrappedRoleplayRule = roleplayRuleText ? wrapWithTag('RoleplayRules', roleplayRuleText) : "";
        const wrappedPublicInfo = publicInfoText ? wrapWithTag('PublicInfo', publicInfoText) : "";

        const replacements = {
            '{{角色名称}}': roleType === 'tool' ? (payload.targetRoleNameForTool || toolNameMap[roleName]) : roleName,
            '{{角色名称集}}': cachedContext?.nonSilentRolesValue || '[无激活角色]',
            '{{最近行动角色}}': cachedContext?.lastActor || '[最近行动者未知]',
            '{{角色设定}}': wrapWithTag('CharacterSetting', roleSettingValue),
            '{{角色记忆}}': wrapWithTag('CharacterMemory', roleMemoryValue),
            '{{角色状态}}': wrapWithTag('CharacterState', cachedContext?.roleStates?.[roleName] || `[${roleName} 状态未获取]`),
            '{{消息记录}}': rawFormattedHistory,
            '{{角色设定集}}': wrapWithTag('CharacterSettingsCollection', joinedSettings),
            '{{角色状态集}}': wrapWithTag('CharacterStatesCollection', joinedStates),
            '{{世界信息}}': wrapWithTag('WorldInfo', cachedContext?.worldInfo || '[世界信息未获取]'),
            '{{参考文本}}': wrappedReferenceText,
            '{{行动建议}}': wrapWithTag('ActionSuggestion', cachedContext?.actionSuggestion || '[行动建议未获取]'),
            '{{扮演规则}}': wrappedRoleplayRule,
            '{{公共信息}}': wrappedPublicInfo,
        };

        function recursiveReplace(obj) {
            if (typeof obj === 'string') {
                let replacedString = obj;
                for (const placeholder in replacements) {
                    const replacementValue = replacements[placeholder];
                    if (typeof replacedString.replaceAll === 'function') {
                        if (replacementValue !== "" || (placeholder !== '{{参考文本}}' && placeholder !== '{{扮演规则}}' && placeholder !== '{{公共信息}}')) {
                             replacedString = replacedString.replaceAll(placeholder, replacementValue);
                        } else if (placeholder === '{{参考文本}}' || placeholder === '{{扮演规则}}' || placeholder === '{{公共信息}}') {
                            const lines = replacedString.split('\n');
                            const filteredLines = lines.filter(line => !(line.trim() === placeholder));
                            replacedString = filteredLines.join('\n');
                        }
                    } else {
                         const regex = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                         if (replacementValue !== "" || (placeholder !== '{{参考文本}}' && placeholder !== '{{扮演规则}}' && placeholder !== '{{公共信息}}')) {
                             replacedString = replacedString.replace(regex, replacementValue);
                         } else if (placeholder === '{{参考文本}}' || placeholder === '{{扮演规则}}' || placeholder === '{{公共信息}}') {
                             replacedString = replacedString.replace(regex, '');
                         }
                    }
                }
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

        return recursiveReplace(payload);
    }
};

async function updateChatContextCache() {
    const newCache = {
        roleStates: {},
        worldInfo: '[世界信息未获取]',
        lastActor: '[最近行动者未知]',
        nonSilentRolesValue: '[无激活角色]',
        nonSilentRoleSettingsValue: '[无激活角色设定]',
        nonSilentRoleStatesValue: '[无激活角色状态]',
        formattedHistory: '',
        actionSuggestion: '[行动建议未获取]',
    };

    const currentHistory = stateModule.currentChatHistoryData;
    if (!currentHistory || currentHistory.length === 0) {
         Object.assign(newCache.roleStates, stateModule.config.roleStates || {});
        stateModule.chatContextCache = newCache;
        if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
        return;
    }

    const historyLines = [];
    let latestGameHostMessageData = null;

    let lastActorFound = false;
    let actionSuggestionFound = false;
    const foundStatesForRole = new Set();
    for (let i = currentHistory.length - 1; i >= 0; i--) {
        const messageObject = currentHistory[i];
        const { roleName, roleType, sourceType, speechActionText, rawJson, parsedResult } = messageObject;
        if (!lastActorFound && (roleType === 'role' || roleType === 'temporary_role')) {
            newCache.lastActor = roleName;
            lastActorFound = true;
        }
        if (roleType === 'role' || roleType === 'temporary_role') {
            const trimmedText = (speechActionText || '').trim();
            if (trimmedText && speechActionText !== "[生成图片]") {
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
                if (!actionSuggestionFound && latestGameHostMessageData === jsonData) {
                    if (jsonData.gameAnalysis?.nextActionAnalysis) {
                        newCache.actionSuggestion = jsonData.gameAnalysis.nextActionAnalysis;
                        actionSuggestionFound = true;
                    }
                }
                if (jsonData.updatedCharacterInfo) {
                    const charName = jsonData.updatedCharacterInfo.characterName;
                    if (charName && !foundStatesForRole.has(charName)) {

                         newCache.roleStates[charName] = _formatObjectToCustomString(jsonData.updatedCharacterInfo || {});
                         foundStatesForRole.add(charName);
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
                 newCache.worldInfo = `[游戏主持人响应 ${messageObject.id} 的解析结果无效]`;
            }
        }
    }

    for(const role in stateModule.config.roleStates) {
         if (!foundStatesForRole.has(role)) {
              newCache.roleStates[role] = `[${role} 状态未在最近的游戏主持人消息中更新]`;
         }
    }

    newCache.formattedHistory = historyLines.join('\n');
    const activeChatroomName = stateModule.config.activeChatRoomName;
    const activeChatroom = stateModule.config.chatRooms.find(room => room.name === activeChatroomName);
    if (activeChatroom && Array.isArray(activeChatroom.roles)) {
        const allRolesInRoom = activeChatroom.roles.filter(name =>
            stateModule.config.roles.includes(name) || stateModule.config.temporaryRoles.includes(name)
        );

        const nonSilentRoleNames = allRolesInRoom.filter(rName =>
            ['活', '用'].includes(stateModule.config.roleStates[rName])
        );

        newCache.nonSilentRolesValue = nonSilentRoleNames.join(',') || '[无激活角色]';

        const roleSettingsPromises = nonSilentRoleNames.map(async rName => {
            if (stateModule.config.roles.includes(rName)) {
                const roleData = await roleDataManager.getRoleData(rName);
                return roleData?.setting || `[${rName} 设定未获取]`;
            } else if (stateModule.config.temporaryRoles.includes(rName)) {
                return `[临时角色 ${rName}]`;
            }
            return `[未知类型角色 ${rName}]`;
        });

        const roleSettings = await Promise.all(roleSettingsPromises);
        newCache.nonSilentRoleSettingsValue = roleSettings.join('\n\n') || '[无激活角色设定]';

        newCache.nonSilentRoleStatesValue = nonSilentRoleNames.map(rName =>
             newCache.roleStates[rName] || `[${rName} 状态未获取]`
        ).join('\n\n') || '[无激活角色状态]';
    }

    stateModule.chatContextCache = newCache;
    if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateWorldInfoDisplay();
}

const _prepareRoleOrToolContext = (roleName, roleType, targetRoleNameForTool = null) => {
    let modelToUse = '';
    let specificUserInstruction = '';
    let specificResponseSchema = null;
    let specificResponseSchemaParserJs = '';

    if (!stateModule.chatContextCache) {
         _logAndDisplayError("无法准备 API 请求：上下文缓存为空。", '_prepareRoleOrToolContext');
         return null;
    }
    if (roleType === 'role' || roleType === 'temporary_role' || (roleType === 'tool' && (roleName === 'writingMaster' || roleName === 'characterUpdateMaster'))) {
        modelToUse = stateModule.config.primaryModel;
        if (!modelToUse) { throw new Error("请在 API 设置中选择一个主要模型。"); }
    } else if (roleType === 'tool' && (roleName === 'drawingMaster' || roleName === 'gameHost')) {
        modelToUse = stateModule.config.secondaryModel;
        if (!modelToUse) { throw new Error("请在 API 设置中选择一个次要模型。"); }
    } else {
         throw new Error(`无法确定模型：未知 roleType=${roleType} 或 roleName=${roleName}`);
    }

    if (roleType === 'tool') {
        const toolSettings = stateModule.config.toolSettings[roleName];
        if (!toolSettings || !toolSettings.enabled) {
            return null;
        }
        specificUserInstruction = toolSettings.user2Instruction || stateModule.config.user1Instruction || '';
        specificResponseSchema = toolSettings.responseSchemaJson || null;
        specificResponseSchemaParserJs = toolSettings.responseSchemaParserJs || '';
    } else if (roleType === 'role' || roleType === 'temporary_role') {
         const roleConfig = stateModule.config.roles.includes(roleName) || stateModule.config.temporaryRoles.includes(roleName);
         if (!roleConfig) {
              return null;
         }
        specificUserInstruction = stateModule.config.user2Instruction || stateModule.config.user1Instruction || '';
        specificResponseSchema = stateModule.config.responseSchemaJson || null;
        specificResponseSchemaParserJs = stateModule.config.responseSchemaParserJs || '';
    } else {
        throw new Error(`未知的 roleType: ${roleType} for ${roleName}`);
    }
    const context = {
        modelName: modelToUse,
        systemInstruction: stateModule.config.systemInstruction || '',
        userInstruction: specificUserInstruction,
        responseSchema: specificResponseSchema,
        responseSchemaParserJs: specificResponseSchemaParserJs,
        responseMimeType: stateModule.config.responseMimeType,
        temperature: stateModule.config.temperature,
        topP: stateModule.config.topP,
        topK: stateModule.config.topK,
        maxOutputTokens: stateModule.config.maxOutputTokens,
        currentRoleNameForPayload: roleName,
        targetRoleNameForTool: targetRoleNameForTool,
        contents: [],
        roleType: roleType,
        cachedContext: stateModule.chatContextCache
    };
    const addPart = (role, text) => {
         if (text) {
             const lastEntry = context.contents.length > 0 && context.contents[context.contents.length - 1].role === role ? context.contents[context.contents.length - 1] : null;
             if (lastEntry) {
                 lastEntry.parts.push({ text });
             } else {
                 context.contents.push({ role, parts: [{ text }] });
             }
         }
    };

    addPart("user", stateModule.config.user1Instruction);
    addPart("model", stateModule.config.model1Instruction);
    addPart("user", context.userInstruction);
    addPart("model", stateModule.config.model2Instruction);
    addPart("user", stateModule.config.user3Instruction);
    if (context.contents.length === 0 || !context.contents.some(c => c.role === 'user')) {
        addPart("user", "Continue");
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

    if (context.systemInstruction) {
        basePayload.systemInstruction = { "parts": [{"text": context.systemInstruction}] };
    }
    if (context.responseSchema) {
        let schemaObj = context.responseSchema;
        if (typeof schemaObj === 'string' && schemaObj.trim().startsWith('{')) {
             try { schemaObj = JSON.parse(schemaObj); } catch(e) { schemaObj = null; _logAndDisplayError(`Invalid JSON in responseSchema for ${context.currentRoleNameForPayload}: ${e.message}`, '_buildApiPayload'); }
        }
        if (typeof schemaObj === 'object' && schemaObj !== null) {
            basePayload.generationConfig.responseSchema = schemaObj;
        }
    }
    basePayload.contents = context.contents;

    if (context.targetRoleNameForTool) {
        basePayload.targetRoleNameForTool = context.targetRoleNameForTool;
    }

    await updateChatContextCache();
    const finalPayload = await placeholderModule.replacePlaceholders(
        basePayload,
        context.currentRoleNameForPayload,
        context.roleType,
        stateModule.chatContextCache
    );

    return finalPayload;

};

const _performApiCall = async (apiKey, payload, roleName, targetRoleNameForTool = null, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const requestPayload = { ...payload, apiKey: apiKey };
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

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
             return { success: false, errorType: 'apiError', detail: `API 错误! 状态: ${response.status}, 详情: ${detail}` };
        }

        const data = await response.json();
        return { success: true, data: data };

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { success: false, errorType: 'timeout', detail: '请求超时' };
        } else {
            return { success: false, errorType: 'fetchError', detail: `网络请求失败: ${error.message}` };
        }
    }
};

const apiModule = {

    _sendGeminiRequestWithRetry: async (roleName, roleType, targetRoleNameForTool = null) => {
        let lastError = null;
        let context = null;

        try {
            if (!stateModule.chatContextCache) {
                 await updateChatContextCache();
                 if (!stateModule.chatContextCache) {
                      throw new Error("上下文缓存为空且无法更新，API 请求中止。");
                 }
            }
            context = _prepareRoleOrToolContext(roleName, roleType, targetRoleNameForTool);
            if (!context) {
                if (roleType === 'tool' && !stateModule.config.toolSettings[roleName]?.enabled) {
                     return;
                }
                throw new Error(`无法为 ${roleName} 准备请求上下文 (可能已禁用或配置错误)`);
            }
        } catch (e) {
            _logAndDisplayError(`Error preparing context for ${roleName}: ${e.message}`, '_sendGeminiRequestWithRetry');
            return;
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            let apiKey;
            try {
                apiKey = apiKeyManager.getNextApiKey();
            } catch(e) {
                lastError = e;
                break;
            }
            if (!apiKey) {
                 lastError = new Error("无法获取 API 密钥。");
                 break;
            }

            let finalPayload;
            try {
                finalPayload = await _buildApiPayload(context);
                if (!finalPayload) {
                     throw new Error("构建 API Payload 失败。");
                }
            } catch(e) {
                 lastError = e;
                 if (attempt === MAX_RETRIES) break; else continue;
            }

            const result = await _performApiCall(apiKey, finalPayload, roleName, targetRoleNameForTool);

            if (!result.success) {
                lastError = new Error(`${result.errorType}: ${result.detail}`);
                apiKeyManager.incrementApiKeyFailure(apiKey);
                if (attempt === MAX_RETRIES) break; else continue;
            }

            if (!result.data || typeof result.data.text_content !== 'string') {
                lastError = new Error('API 响应中缺少 text_content');
                apiKeyManager.incrementApiKeyFailure(apiKey);
                 if (attempt === MAX_RETRIES) break; else continue;
            }

            const { parsedResult, parserError } = uiChatModule._parseAIResponse(result.data.text_content, roleName, roleType);

            if (parserError) {
                lastError = new Error(`解析错误 (尝试 ${attempt}/${MAX_RETRIES}): ${parserError}`);
                apiKeyManager.incrementApiKeyFailure(apiKey);
                if (attempt === MAX_RETRIES) break; else continue;
            } else {
                 if (typeof uiChatModule !== 'undefined' && uiChatModule.displayAIResponse) {
                     uiChatModule.displayAIResponse(result.data, roleName, targetRoleNameForTool);
                 } else {
                      console.warn("uiChatModule.displayAIResponse not available to display successful response.");
                 }
                 return;
            }
        }

        _logAndDisplayError(`Gemini 请求最终失败 (角色: ${roleName}): ${lastError?.message || '未知错误'}`, '_sendGeminiRequestWithRetry');
    },

    _prepareNovelAiPayload: async (parsedDrawingMasterData, rawJsonText) => {
         if (!parsedDrawingMasterData || typeof parsedDrawingMasterData !== 'object' || !parsedDrawingMasterData.generalTags || !parsedDrawingMasterData.characterTagSets) {
             throw new Error("无效的绘图大师数据，无法准备 NAI Payload。");
         }

         const naiApiKey = apiKeyManager.getNaiApiKey();
         if (!naiApiKey) {
             throw new Error("NovelAI API Key 未设置。");
         }

         const generalTags = parsedDrawingMasterData.generalTags;
         const characterTagSets = parsedDrawingMasterData.characterTagSets || [];
         const numCharacters = characterTagSets.length;

         let promptParts = [];

         let generalPromptPart = [];
         if (numCharacters > 0) generalPromptPart.push(`${numCharacters}character${numCharacters > 1 ? 's' : ''}`);
         if (stateModule.config.novelaiArtistChain) generalPromptPart.push(stateModule.config.novelaiArtistChain);
         if (generalTags.background && generalTags.background !== '0') generalPromptPart.push(generalTags.background);
         if (generalTags.time && generalTags.time !== '0') generalPromptPart.push(generalTags.time);
         if (stateModule.config.novelaiDefaultPositivePrompt) generalPromptPart.push(stateModule.config.novelaiDefaultPositivePrompt);
         if (generalTags.nsfw && generalTags.nsfw !== '0') generalPromptPart.push(generalTags.nsfw);

         promptParts.push(generalPromptPart.join(', ').trim());

         let mainDrawingPromptContentForDisplay = "";

         const characterPromises = characterTagSets.map(async charSet => {
             let charPromptPart = [];
             const charName = charSet.characterName;
             const roleData = await roleDataManager.getRoleData(charName);
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

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
                      break;
                 } else {
                      lastError = new Error('NAI 响应中未找到有效的 imageDataUrl');
                      if (attempt === MAX_RETRIES) break;
                 }

            } catch (error) {
                 clearTimeout(timeoutId);
                 if (error.name === 'AbortError') {
                     lastError = new Error(`NAI 请求超时 (尝试 ${attempt}/${MAX_RETRIES})`);
                 } else {
                     lastError = new Error(`NAI 请求失败 (尝试 ${attempt}/${MAX_RETRIES}): ${error.message}`);
                 }
                 if (attempt === MAX_RETRIES) break;
            }
        }

        if (!success && lastError) {
             _logAndDisplayError(`NAI 请求最终失败: ${lastError.message}`, 'processNaiQueue', 'N/A', 'N/A', lastError);
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
        let apiKey;
        try {
            apiKey = apiKeyManager.getNextApiKey();
        } catch (e) {
            _logAndDisplayError(e.message, 'fetchModels');
            apiKey = null;
        }

        const primarySelect = elementsModule.primaryModelSelectSettings;
        const secondarySelect = elementsModule.secondaryModelSelectSettings;
        stateModule.availableModels = [];

        const setOptions = (selectElement, message) => {
            selectElement.innerHTML = `<option value="" disabled selected>${message}</option>`;
        };

        if (!apiKey) {
            setOptions(primarySelect, '无 API 密钥');
            setOptions(secondarySelect, '无 API 密钥');
            return;
        }

        setOptions(primarySelect, '加载中...');
        setOptions(secondarySelect, '加载中...');
        try {
            const response = await fetch(`/models?key=${apiKey}`);
            if (!response.ok) {
                const errorText = await response.text();
                setOptions(primarySelect, '加载失败');
                setOptions(secondarySelect, '加载失败');
                throw new Error(`模型列表加载失败: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            primarySelect.innerHTML = '';
            secondarySelect.innerHTML = '';
            let primaryModelFound = false;
            let secondaryModelFound = false;

            if (data.models && Array.isArray(data.models)) {
                data.models.forEach(model => {
                    if (model.name && model.supportedGenerationMethods?.includes('generateContent')) {
                        const modelId = model.name.startsWith('models/') ? model.name.substring(7) : model.name;
                        stateModule.availableModels.push({ id: modelId, name: model.displayName || modelId });
                    }
                });
                stateModule.availableModels.sort((a, b) => a.name.localeCompare(b.name));

                const populateSelect = (selectElement, savedModel) => {
                    let modelFound = false;
                    stateModule.availableModels.forEach(model => {
                        const option = new Option(model.name, model.id);
                        selectElement.add(option);
                        if (savedModel === model.id) {
                            option.selected = true;
                            modelFound = true;
                        }
                    });

                    if (!modelFound && selectElement.options.length > 0) {
                         selectElement.selectedIndex = 0;
                         if (selectElement === primarySelect) stateModule.config.primaryModel = selectElement.value;
                         if (selectElement === secondarySelect) stateModule.config.secondaryModel = selectElement.value;
                         modelFound = true;
                    }
                    return modelFound;
                };

                primaryModelFound = populateSelect(primarySelect, stateModule.config.primaryModel);
                secondaryModelFound = populateSelect(secondarySelect, stateModule.config.secondaryModel);
                 if (primarySelect.options.length === 0) { setOptions(primarySelect, '无可用模型'); }
                 if (secondarySelect.options.length === 0) { setOptions(secondarySelect, '无可用模型'); }
            } else {
                setOptions(primarySelect, '加载失败');
                setOptions(secondarySelect, '加载失败');
            }
        } catch (error) {
            _logAndDisplayError(`Failed to fetch models: ${error.message}`, 'fetchModels');
            setOptions(primarySelect, '加载失败');
            setOptions(secondarySelect, '加载失败');
        }
    },
    sendSingleMessageForRoleImpl: async (roleName, roleType, targetRoleNameForTool = null) => {
        await apiModule._sendGeminiRequestWithRetry(roleName, roleType, targetRoleNameForTool);
    },

    triggerRoleResponse: (roleName) => {
        if (roleName === 'drawingMaster') {

        } else if (stateModule.config.isRunPaused) {
            return;
        }

        if (!stateModule.chatContextCache) {
             updateChatContextCache().then(() => {
                if (!stateModule.chatContextCache) {
                    _logAndDisplayError("无法触发响应：上下文缓存为空。", 'triggerRoleResponse');
                    return;
                }
                apiModule._triggerRoleResponseInternal(roleName);
             });
        } else {
             apiModule._triggerRoleResponseInternal(roleName);
        }
    },

    _triggerRoleResponseInternal: (roleName) => {
        let roleType = 'unknown';
        if (toolNameMap.hasOwnProperty(roleName)) {
             roleType = 'tool';
             if (!stateModule.config.toolSettings[roleName]?.enabled) {
                 return;
             }
        } else if (stateModule.config.roles.includes(roleName)) {
             roleType = 'role';
        } else if (stateModule.config.temporaryRoles.includes(roleName)) {
             roleType = 'temporary_role';
        } else {
             return;
        }

         const activeChatroom = stateModule.config.chatRooms.find(room => room.name === stateModule.config.activeChatRoomName);
         if (roleType !== 'tool' && (!activeChatroom || !activeChatroom.roles.includes(roleName))) {
             return;
         }
         if (roleType !== 'tool' && !['活', '用'].includes(stateModule.config.roleStates[roleName])) {
              return;
         }

        apiModule.sendSingleMessageForRoleImpl(roleName, roleType);
    },

    triggerCharacterUpdateForRole: (targetRoleName) => {
        if (!stateModule.config.roles.includes(targetRoleName)) {
            return;
        }
        const toolName = 'characterUpdateMaster';
        if (!stateModule.config.toolSettings[toolName]?.enabled) {
             return;
        }

        apiModule.sendSingleMessageForRoleImpl(toolName, 'tool', targetRoleName);
    },


    saveNovel: async (name, content) => {
        const response = await fetch('/novels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        });
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
             throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },

    deleteNovelFile: async (novelId) => {
        const response = await fetch(`/novels/${novelId}`, { method: 'DELETE' });
        if (!response.ok) {
            if (response.status === 404) {
                 return { message: "文件未找到或已被删除" };
            }
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },

    fetchNovelStructuredContent: async (filename) => {
        const response = await fetch(`/novels-structured/${filename}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },

     addChatroom: () => {
        const name = prompt("请输入新聊天室名称:");
        if (name && name.trim() !== "" && !stateModule.config.chatRooms.some(r => r.name === name)) {
            if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
                uiChatModule.saveChatHistoryToServer();
            }
            const allTemporaryRoles = stateModule.config.temporaryRoles || ["管理员"];
            const room = {
                name: name,
                roles: [...allTemporaryRoles],
                associatedNovelIds: [],
                roleplayRules: "",
                publicInfo: "",
                backgroundImagePath: null
             };
            stateModule.config.chatRooms.push(room);

            stateModule.config.activeNovelIdsInChatroom[name] = [];
            if (typeof uiSettingsModule !== 'undefined') {
                uiSettingsModule.updateChatroomList();
                uiSettingsModule.switchActiveChatroom(name);
            }
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
        } else if (name) {
            _logAndDisplayError(`聊天室名称 "${name}" 无效或已存在。`, 'addChatroom');
        }
    },

    renameChatroom: async (oldName) => {
         const newName = prompt(`输入聊天室 "${oldName}" 的新名称:`, oldName);
         if (!newName || newName.trim() === "" || newName === oldName) {
             return;
         }
         if (stateModule.config.chatRooms.some(r => r.name === newName)) {
             _logAndDisplayError(`聊天室名称 "${newName}" 已存在.`, 'renameChatroom');
             return;
         }

         const roomIndex = stateModule.config.chatRooms.findIndex(r => r.name === oldName);
         if (roomIndex === -1) {
             _logAndDisplayError(`无法找到要重命名的聊天室: ${oldName}`, 'renameChatroom');
             return;
         }
         const room = stateModule.config.chatRooms[roomIndex];

         const oldHistoryPath = `/history/${encodeURIComponent(oldName)}`;
         const newHistoryPath = `/history/${encodeURIComponent(newName)}`;
         const oldBgPath = room.backgroundImagePath;
         let newBgPath = null;

         try {

             const historyDataResponse = await fetch(oldHistoryPath);
             let historyData = [];
             if (historyDataResponse.ok) {
                 historyData = await historyDataResponse.json();
             } else if (historyDataResponse.status !== 404) {
                 throw new Error(`Failed to fetch old history: ${historyDataResponse.status}`);
             }


             const saveResponse = await fetch(newHistoryPath, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(historyData)
             });
             if (!saveResponse.ok) {
                 throw new Error(`Failed to save new history: ${saveResponse.status}`);
             }


             await fetch(oldHistoryPath, { method: 'DELETE' });


             if (oldBgPath) {
                 const oldBgFilename = oldBgPath.split('/').pop();
                 const ext = oldBgFilename.split('.').pop();
                 if (ext && oldBgFilename.startsWith(encodeURIComponent(oldName))) {
                     const newBgFilename = `${encodeURIComponent(newName)}.${ext}`;
                     const renameBgResponse = await fetch(`/background/${encodeURIComponent(oldName)}/rename`, {
                         method: 'PUT',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ newFilename: newBgFilename })
                     });
                     if (renameBgResponse.ok) {
                         newBgPath = `images/backgrounds/${newBgFilename}`;
                     } else {
                         console.warn(`Failed to rename background image for ${oldName}`);
                         await fetch(`/background/${encodeURIComponent(oldName)}`, { method: 'DELETE' });
                     }
                 } else {
                     await fetch(`/background/${encodeURIComponent(oldName)}`, { method: 'DELETE' });
                 }
             }


             room.name = newName;
             room.backgroundImagePath = newBgPath;


             if (stateModule.config.activeNovelIdsInChatroom.hasOwnProperty(oldName)) {
                 stateModule.config.activeNovelIdsInChatroom[newName] = stateModule.config.activeNovelIdsInChatroom[oldName];
                 delete stateModule.config.activeNovelIdsInChatroom[oldName];
             } else {
                 stateModule.config.activeNovelIdsInChatroom[newName] = [];
             }


             if (stateModule.config.activeChatRoomName === oldName) {
                 stateModule.config.activeChatRoomName = newName;
             }


             if (stateModule.currentChatRoom === oldName) {
                stateModule.currentChatRoom = newName;
                if(document.getElementById('chat-room-detail-page').classList.contains('active')) {
                     elementsModule.chatroomDetailHeaderTitle.textContent = `聊天室详情 - ${newName}`;
                }
             }

             roleDataManager.clearCache();


             if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateChatroomList();


             if (typeof uiChatModule !== 'undefined' && stateModule.config.activeChatRoomName === newName) {
                  uiChatModule.loadChatHistory(newName);
                  if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                     uiSettingsModule.novelUI_updateBookshelfPage();
                  }
             }
             await updateChatContextCache();
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
             }

         } catch (error) {
              _logAndDisplayError(`重命名聊天室失败: ${error.message}`, 'renameChatroom');

         }
    },

    deleteChatroom: async (name) => {
        if (confirm(`确定要删除聊天室 ${name} 吗? 这将同时删除其聊天记录、背景图及配置文件中的关联。`)) {
            if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
                await uiChatModule.saveChatHistoryToServer();
            }

            try {

                 await fetch(`/history/${encodeURIComponent(name)}`, { method: 'DELETE' });
                 await fetch(`/background/${encodeURIComponent(name)}`, { method: 'DELETE' });

            } catch (error) {
                 _logAndDisplayError(`删除聊天室文件时出错: ${error.message}`, 'deleteChatroom');

            }


            stateModule.config.chatRooms = stateModule.config.chatRooms.filter(r => r && r.name && r.name !== name);
            delete stateModule.config.activeNovelIdsInChatroom[name];

            let switchTo = null;
            if (stateModule.config.activeChatRoomName === name) {
                stateModule.config.activeChatRoomName = null;
                if(stateModule.config.chatRooms.length > 0) switchTo = stateModule.config.chatRooms[0].name;
            }
            stateModule.currentChatRoom = null;

            if (typeof uiSettingsModule !== 'undefined') uiSettingsModule.updateChatroomList();
            if (switchTo) {
                 uiSettingsModule.switchActiveChatroom(switchTo);
            } else {

                 if (typeof uiChatModule !== 'undefined') {
                     uiChatModule.clearChatArea();
                     uiChatModule.updateRoleButtonsList();
                     uiChatModule.updateChatroomHistoryDisplay();
                 }
                  stateModule.chatContextCache = null;
                  await updateChatContextCache();
                  uiSettingsModule.updateWorldInfoDisplay();

                 stateModule.currentNovelId = null;
                 if(stateModule.isNovelInterfaceVisible) {
                    if (elementsModule.novelContentDisplay) elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请先选择一个聊天室</p>';
                    if (stateModule.activeNovelPage === 'novel-bookshelf-page') uiSettingsModule.novelUI_updateBookshelfPage();
                 }
                 if (elementsModule.chatContainer) elementsModule.chatContainer.style.backgroundImage = '';
            }

             if (document.getElementById('chat-room-detail-page').classList.contains('active') && stateModule.currentChatRoom === null) {
                uiSettingsModule.closeCurrentSection('chat-room-detail-page');
             }
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
             }
        }
    },

     exportChatroom: () => {

         const roomName = stateModule.currentChatRoom;
         if (!roomName) {
             _logAndDisplayError("没有当前选定的聊天室可导出。", 'exportChatroom');
             return;
         }
          window.location.href = '/export-chatroom-zip/' + encodeURIComponent(roomName);
    },

    handleImportChatroomFile: async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.zip')) {
            _logAndDisplayError('请选择一个 .zip 文件进行导入。', 'handleImportChatroomFile');
            event.target.value = null;
            return;
        }

        const formData = new FormData();
        formData.append('chatroom_zip', file);

        try {
            const response = await fetch('/import-chatroom-zip', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            alert(result.message || "聊天室导入成功！");

            await configModule.loadConfig();
            roleDataManager.clearCache();
            initializationModule.initializeConfig();

        } catch (error) {
            _logAndDisplayError(`导入聊天室失败: ${error.message}`, 'handleImportChatroomFile');
            alert(`导入聊天室失败: ${error.message}`);
        } finally {
            event.target.value = null;
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
              const room = stateModule.config.chatRooms.find(r => r.name === roomName);
              if (room && result.path) {
                  room.backgroundImagePath = result.path;
                  if (stateModule.config.activeChatRoomName === roomName && elementsModule.chatContainer) {
                      elementsModule.chatContainer.style.backgroundImage = `url(${result.path}?t=${Date.now()})`;
                  }
                  if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                     mainModule.triggerDebouncedSave();
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
              const room = stateModule.config.chatRooms.find(r => r.name === roomName);
              if (room) {
                  room.backgroundImagePath = null;
                  if (stateModule.config.activeChatRoomName === roomName && elementsModule.chatContainer) {
                      elementsModule.chatContainer.style.backgroundImage = '';
                  }
                  if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                     mainModule.triggerDebouncedSave();
                  }
              }
         } catch (error) {
              _logAndDisplayError(error.message, "removeBackgroundImage");
         }
    },

};