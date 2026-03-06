const apiClientConfigModule = {
  loadInitialData: async () => {
    const result = await apiServiceModule.performApiCall('/load-initial-data', 'GET');
    if (result.success && result.data) {
      stateManager.commit('SET_INITIAL_DATA', result.data);
    }
    return result;
  },
  updateConfigFieldsAsync: async (updates) => {
    return await apiServiceModule.performApiCall('/update-config-fields', 'POST', { updates });
  },

  getExportableData: () => {
    const config = stateModule.config;
    const data = {
      version: 3,
      groups: {
        globalSettings: {
          label: "通用配置",
          items: {
            systemInstruction: { label: "系统指令", value: config.systemInstruction || '' },
            promptPresetTurns: { label: "对话轮次预设", value: config.promptPresetTurns || [] },
            generalModelSelectionType: { label: "通用模型选择", value: config.generalModelSelectionType || 'primary' },
            originalNovelLength: { label: "全局原著小说章节数", value: config.originalNovelLength || 1 },
            rateLimitPerMinute: { label: "全局频率限制", value: config.rateLimitPerMinute || "8" },
            clothingGuide: { label: "穿着指南", value: config.clothingGuide || '' },
            sharedDatabaseInstruction: { label: "共享数据库指令", value: config.sharedDatabaseInstruction || '' },
            mainPrompt: { label: "主提示词", value: config.mainPrompt || '' }
          }
        },
        novelaiSettings: {
          label: "NovelAI (绘图) 设置",
          items: {
            novelaiArtistChain: { label: "艺术家链", value: config.novelaiArtistChain || '' },
            novelaiDefaultPositivePrompt: { label: "默认正面提示词", value: config.novelaiDefaultPositivePrompt || '' },
            novelaiDefaultNegativePrompt: { label: "默认负面提示词", value: config.novelaiDefaultNegativePrompt || '' },
            novelaiTemplateMappings: { label: "模板映射", value: config.novelaiTemplateMappings || [] }
          }
        },
        toolSettings: { label: "工具设置", items: {} }
      }
    };

    if (config.toolSettings) {
      Object.keys(config.toolSettings).forEach(toolName => {
        const toolConfig = config.toolSettings[toolName];
        data.groups.toolSettings.items[toolName] = {
          label: toolNameMap[toolName] || toolName,
          value: {
            enabled: toolConfig.enabled,
            model_selection_type: toolConfig.model_selection_type || 'primary',
            responseSchemaJson: toolConfig.responseSchemaJson || '',
            responseSchemaParserJs: toolConfig.responseSchemaParserJs || '',
            toolDatabaseInstruction: toolConfig.toolDatabaseInstruction || '',
            mainPrompt: toolConfig.mainPrompt || ''
          }
        };
        if (toolName === 'drawingMaster' && config.drawingMaster_novelContent) {
            data.groups.toolSettings.items[toolName].value.novelContent = config.drawingMaster_novelContent;
        }
        if (['scriptCreationMaster', 'characterCreationMaster', 'knowledgeRecordingMaster'].includes(toolName)) {
            data.groups.toolSettings.items[toolName].value.originalNovelLength = toolConfig.originalNovelLength;
        }
      });
    }
    return data;
  },

  downloadExportData: (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '预设文件.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  parseImportFile: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (importedData.version !== 3 || !importedData.groups) {
            throw new Error("Invalid format or version.");
          }
          resolve(importedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  },

  applyImportData: (data) => {
    let updatesToDispatch = {};
    const setUpdate = (path, value) => {
        if (value !== undefined && value !== null) updatesToDispatch[path] = value;
    };

    if (data.groups.globalSettings) {
        const gs = data.groups.globalSettings.items;
        setUpdate('systemInstruction', gs.systemInstruction.value);
        setUpdate('promptPresetTurns', gs.promptPresetTurns.value);
        setUpdate('generalModelSelectionType', gs.generalModelSelectionType.value);
        setUpdate('originalNovelLength', gs.originalNovelLength.value);
        setUpdate('rateLimitPerMinute', gs.rateLimitPerMinute.value);
        setUpdate('clothingGuide', gs.clothingGuide.value);
        setUpdate('sharedDatabaseInstruction', gs.sharedDatabaseInstruction.value);
        setUpdate('mainPrompt', gs.mainPrompt.value);
    }

    if (data.groups.novelaiSettings) {
        const ns = data.groups.novelaiSettings.items;
        setUpdate('novelaiArtistChain', ns.novelaiArtistChain.value);
        setUpdate('novelaiDefaultPositivePrompt', ns.novelaiDefaultPositivePrompt.value);
        setUpdate('novelaiDefaultNegativePrompt', ns.novelaiDefaultNegativePrompt.value);
        setUpdate('novelaiTemplateMappings', ns.novelaiTemplateMappings.value);
    }

    if (data.groups.toolSettings) {
        Object.keys(data.groups.toolSettings.items).forEach(toolName => {
            const toolData = data.groups.toolSettings.items[toolName].value;
            if (toolData && stateModule.config.toolSettings[toolName]) {
                setUpdate(`toolSettings.${toolName}.enabled`, toolData.enabled);
                setUpdate(`toolSettings.${toolName}.model_selection_type`, toolData.model_selection_type);
                setUpdate(`toolSettings.${toolName}.responseSchemaJson`, toolData.responseSchemaJson);
                setUpdate(`toolSettings.${toolName}.responseSchemaParserJs`, toolData.responseSchemaParserJs);
                setUpdate(`toolSettings.${toolName}.toolDatabaseInstruction`, toolData.toolDatabaseInstruction);
                setUpdate(`toolSettings.${toolName}.mainPrompt`, toolData.mainPrompt);
                
                if (toolName === 'drawingMaster') setUpdate(`drawingMaster_novelContent`, toolData.novelContent);
                if (['scriptCreationMaster', 'characterCreationMaster', 'knowledgeRecordingMaster'].includes(toolName)) {
                    setUpdate(`toolSettings.${toolName}.originalNovelLength`, toolData.originalNovelLength);
                }
            }
        });
    }

    if (Object.keys(updatesToDispatch).length > 0) {
        transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: updatesToDispatch });
    }
  },

  triggerNovelSummarization: async (novelId, startIndex = 0) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    
    if (!stateModule.config.toolSettings.novelSummaryMaster.enabled) {
      alert("小说总结大师工具未启用");
      return;
    }
    
    stateModule.summaryConsecutiveFailures = 0;
    const tasks = [];
    
    for (let index = startIndex; index < novelData.toc.length; index++) {
      const tocEntry = novelData.toc[index];
      if (!tocEntry || tocEntry.summary) continue;
      
      tasks.push({
        novelId,
        chapterTitle: tocEntry.title,
        tocEntryIndex: index,
        tocEntry,
        initiatorMessageId: `summary-${novelId}-${index}`,
        retryCount: 0
      });
    }
    
    if (tasks.length === 0) {
      alert("所选章节已全部包含总结");
      return;
    }
    
    stateModule.summaryGenerationQueue.push(...tasks);
    if (!stateModule.isSummaryProcessing) apiClientConfigModule.processSummaryQueue();
  },

  deleteChapterSummary: async (novelId, tocEntryIndex, chapterTitle) => {
    const result = await apiClientChatroomsModule.updateNovelTocEntry({
        chatroomName: stateModule.currentChatroomDetails.config.name,
        novelId,
        tocIndex: tocEntryIndex,
        tocUpdates: { summary: "", structure: [], scriptFormat: null }
    });
    if (result.success && result.changes) {
        incrementalUpdateHandlerModule.processChanges(result.changes);
    } else {
        alert(`删除章节 "${chapterTitle}" 的总结失败`);
    }
  },

  processSummaryQueue: async () => {
    if (stateModule.isSummaryProcessing || stateModule.summaryGenerationQueue.length === 0) return;
    stateModule.isSummaryProcessing = true;
    const task = stateModule.summaryGenerationQueue.shift();
    if (task) {
      stateModule.activeSummaryRequests++;
      apiClientConfigModule._processSingleSummaryTask(task);
    }
  },

  _processSingleSummaryTask: async (task) => {
    const { novelId, chapterTitle, tocEntryIndex, initiatorMessageId } = task;
    
    try {
      let targetPartitionId = stateModule.activePartitionId;
      const partitions = Array.from(stateModule.currentChatroomDetails.partitions.values());
      const novelPartition = partitions.find(p => p.name === "小说");
      if (novelPartition) targetPartitionId = novelPartition.id;

      const result = await apiMainTriggerModule._sendGeminiRequestWithRetry(
          targetPartitionId, 'novelSummaryMaster', 'tool', null, null, 
          { novelId, chapterTitle, tocEntryIndex, initiatorMessageId }
      );

      if (result.success) {
        const { parsedResult } = chatParsingModule._parseAIResponse(result.data.text_content, 'novelSummaryMaster', 'tool', result.data.responseSchemaParserJs);
        if (parsedResult.shortSummary && parsedResult.detailedSummary) {
            const updateResult = await apiClientChatroomsModule.updateNovelTocEntry({
                chatroomName: stateModule.currentChatroomDetails.config.name,
                novelId,
                tocIndex: tocEntryIndex,
                tocUpdates: {
                    title: `(${tocEntryIndex + 1}) ${parsedResult.shortSummary}`,
                    summary: parsedResult.detailedSummary,
                    structure: [],
                    scriptFormat: null
                }
            });
            if (updateResult.success && updateResult.changes) {
                incrementalUpdateHandlerModule.processChanges(updateResult.changes);
            }
        }
      }
    } catch (error) {
      alert("章节总结失败: " + error.message);
      stateModule.summaryGenerationQueue = [];
    } finally {
      stateModule.activeSummaryRequests--;
      stateModule.isSummaryProcessing = false;
      apiClientConfigModule.processSummaryQueue();
    }
  }
};