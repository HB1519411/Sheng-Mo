const commonUtilsModule = {
  _shengmoDeepCopy: (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Map) {
      const newMap = new Map();
      obj.forEach((value, key) => {
        newMap.set(commonUtilsModule._shengmoDeepCopy(key), commonUtilsModule._shengmoDeepCopy(value));
      });
      return newMap;
    }
    if (obj instanceof Set) {
      const newSet = new Set();
      obj.forEach(value => {
        newSet.add(commonUtilsModule._shengmoDeepCopy(value));
      });
      return newSet;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => commonUtilsModule._shengmoDeepCopy(item));
    }
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = commonUtilsModule._shengmoDeepCopy(obj[key]);
      }
    }
    return newObj;
  },

  isStandardTimeFormat: (timeString) => {
    if (typeof timeString !== 'string') return false;
    const regex = /^-?\d{4}-\d{2}-\d{2}$/;
    return regex.test(timeString);
  },

  calculateAgeAndMemoryGap: (memoryArray, worldInfo) => {
    const worldInfoDateStr = (worldInfo || '').match(/-?\d{4}-\d{2}-\d{2}/)?.[0] || null;
    if (!worldInfoDateStr) {
      return {
        age: '[无法计算]',
        memoryGapDays: null
      };
    }
    
    const parseDate = (dateStr) => {
        const parts = dateStr.split('-');
        if (dateStr.startsWith('-')) {
            return { year: -parseInt(parts[1]), month: parseInt(parts[2]), day: parseInt(parts[3]) };
        }
        return { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
    };

    const currentDate = parseDate(worldInfoDateStr);

    const validDates = (memoryArray || [])
      .map(item => (item.time || '').match(/-?\d{4}-\d{2}-\d{2}/)?.[0])
      .filter(Boolean);

    if (validDates.length === 0) {
      return {
        age: '[无法计算]',
        memoryGapDays: null
      };
    }

    validDates.sort((a, b) => {
        const dateA = parseDate(a);
        const dateB = parseDate(b);
        if(dateA.year !== dateB.year) return dateA.year - dateB.year;
        if(dateA.month !== dateB.month) return dateA.month - dateB.month;
        return dateA.day - dateB.day;
    });
    
    const earliestDateStr = validDates[0];
    const latestDateStr = validDates[validDates.length - 1];
    
    const birthDate = parseDate(earliestDateStr);
    let age = currentDate.year - birthDate.year;
    if (currentDate.month < birthDate.month || (currentDate.month === birthDate.month && currentDate.day < birthDate.day)) {
        age--;
    }

    const latestDate = parseDate(latestDateStr);
    
    const toDays = (date) => date.year * 365.25 + date.month * 30.44 + date.day;
    const memoryGapDays = Math.floor(toDays(currentDate) - toDays(latestDate));

    return {
      age: `${age}岁`,
      memoryGapDays: memoryGapDays >= 0 ? memoryGapDays : null
    };
  },

  _stripHistoryTimeAndLocation: (formattedHistory) => {
    if (!formattedHistory || typeof formattedHistory !== 'string') {
      return '';
    }
    const lines = formattedHistory.split('\n');
    const processedLines = [];
    for (const line of lines) {
      if (line.startsWith('Date: ') || line.startsWith('Location: ')) {
        continue;
      }
      const timePrefixRegex = /^\d{2}:\d{2}\s*/;
      const cleanedLine = line.replace(timePrefixRegex, '');
      processedLines.push(cleanedLine);
    }
    return processedLines.join('\n').trim();
  },

  _formatPartitionHistory: (historyArray, options = {}) => {
    const {
      includeDateTime = true, includeLocation = true
    } = options;
    if (!historyArray || historyArray.length === 0) return "";

    const formattedBlocks = [];
    let previousOutputLocation = null;

    for (let i = 0; i < historyArray.length; i++) {
      const messageObject = historyArray[i];
      if (messageObject.status === 'pending') continue;

      const {
        roleName,
        statusProcessingSystemResult,
        parsedResult
      } = messageObject;

      let blockForThisMessage = [];
      let currentContextTime = "";
      let currentContextLocation = null;

      if (statusProcessingSystemResult && typeof statusProcessingSystemResult === 'object' && statusProcessingSystemResult.processedSceneContext) {
        const context = statusProcessingSystemResult.processedSceneContext;
        let foundTime = null,
          foundLocation = null;
        if (context.timeItems && Array.isArray(context.timeItems)) {
          for (const item of context.timeItems) {
            if (typeof item === 'string' && /^\d{2}:\d{2}$/.test(item.trim())) {
              foundTime = item.trim();
            }
          }
        }
        if (context.locationItems && Array.isArray(context.locationItems) && context.locationItems.length > 0) {
          foundLocation = context.locationItems.map(s => (s || '').trim()).filter(Boolean).join(', ');
        }
        if (foundTime) currentContextTime = foundTime;
        if (foundLocation) currentContextLocation = foundLocation;
      }

      if (includeLocation && currentContextLocation && currentContextLocation !== previousOutputLocation) {
        blockForThisMessage.push(`Location: ${currentContextLocation}`);
        previousOutputLocation = currentContextLocation;
      }

      let contentText = '';
      if (messageObject.sourceType === 'ai' && (messageObject.roleType === 'role' || messageObject.roleType === 'temporary_role') && parsedResult && Array.isArray(parsedResult.processedTurnActions)) {
        const actions = parsedResult.processedTurnActions;
        const relevantActions = actions.filter(action => action.isIncluded === true);
        contentText = relevantActions.map(action => (action.content || '').trim()).filter(Boolean).join('\n');
      } else {
        contentText = messageObject.speechActionText || '';
      }

      if (contentText) {
        const displayName = uiChatUtilsModule.getDisplayName(roleName, stateModule.activePartitionId);
        const timePrefix = includeDateTime && currentContextTime ? `${currentContextTime} ` : '';
        const messageLineContent = `${timePrefix}${displayName}：${contentText.includes('\n') ? '\n' : ''}${contentText}`;
        blockForThisMessage.push(messageLineContent);
      }
      if (blockForThisMessage.length > 0) {
        formattedBlocks.push(blockForThisMessage.join('\n'));
      }
    }
    return formattedBlocks.join('\n\n');
  },

  _calculateLastActor: (historyArray) => {
    if (!historyArray || !Array.isArray(historyArray)) {
      return null;
    }
    for (let i = historyArray.length - 1; i >= 0; i--) {
      const message = historyArray[i];
      if (message && message.status !== 'pending' && message.roleName && typeof message.roleName === 'string' && message.roleName.trim() !== '') {
        return message.roleName;
      }
    }
    return null;
  },

  _areObjectsNumericallyEquivalentAndOrderInsensitive: (obj1, obj2) => {
    if (obj1 === null && obj2 === null) return true;
    if (obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!obj2.hasOwnProperty(key)) return false;
      if (typeof obj1[key] === 'string' && typeof obj2[key] === 'string') {
        if (obj1[key] !== obj2[key]) return false;
      } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
        if (!commonUtilsModule._areObjectsNumericallyEquivalentAndOrderInsensitive(obj1[key], obj2[key])) return false;
      } else {
        if (obj1[key] !== obj2[key]) return false;
      }
    }
    return true;
  },

  _getChapterContentSnippet: (novelId, tocEntry, tocIndex) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !novelId || !tocEntry) {
      return '[内容片段无法获取: 缺少数据]';
    }
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData || !novelData.toc || tocIndex < 0 || tocIndex >= novelData.toc.length) {
      return '[内容片段无法获取: 小说或章节数据缺失]';
    }
    return novelData.toc[tocIndex].content || '[章节内容为空或无法提取]';
  }
};