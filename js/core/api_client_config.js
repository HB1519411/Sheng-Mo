const apiClientConfigModule = {
  loadInitialData: async () => {
    const result = await apiServiceModule.performApiCall('/load-initial-data', 'GET');
    if (result.success && result.data) {
      stateManager.commit('SET_INITIAL_DATA', result.data);
    }
    return result;
  },
  updateConfigFieldsAsync: async (updates) => {
    return await apiServiceModule.performApiCall('/update-config-fields', 'POST', {
      updates
    });
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
            clothingGuide: { label: "穿着指南", value: config.clothingGuide || '' },
            sharedDatabaseInstruction: { label: "共享数据库指令", value: config.sharedDatabaseInstruction || '' },
            mainPrompt: { label: "主提示词", value: config.mainPrompt || '' },
            responseSchemaJson: { label: "Response Schema (JSON)", value: config.responseSchemaJson || '' },
            responseSchemaParserJs: { label: "Response Schema Parser (JS)", value: config.responseSchemaParserJs || '' }
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
        toolSettings: {
          label: "工具设置",
          items: {} 
        }
      }
    };

    if (config.toolSettings) {
      Object.keys(config.toolSettings).forEach(toolName => {
        const toolConfig = config.toolSettings[toolName];
        const toolLabel = toolNameMap[toolName] || toolName;
        
        data.groups.toolSettings.items[toolName] = {
          label: toolLabel,
          value: {
            enabled: toolConfig.enabled,
            model_selection_type: toolConfig.model_selection_type || 'primary',
            responseSchemaJson: toolConfig.responseSchemaJson || '',
            responseSchemaParserJs: toolConfig.responseSchemaParserJs || '',
            toolDatabaseInstruction: toolConfig.toolDatabaseInstruction || '',
            mainPrompt: toolConfig.mainPrompt || ''
          }
        };

        if (toolName === 'drawingMaster' && toolConfig.novelContent) {
            data.groups.toolSettings.items[toolName].value.novelContent = toolConfig.novelContent;
        }
        if (['scriptCreationMaster', 'characterCreationMaster', 'knowledgeRecordingMaster'].includes(toolName)) {
            data.groups.toolSettings.items[toolName].value.originalNovelLength = toolConfig.originalNovelLength;
        }
      });
    }

    return data;
  },

  downloadExportData: (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
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
          if (!importedData || typeof importedData !== 'object') {
            throw new Error("Invalid file format: Not an object.");
          }
          
          let normalizedData = { version: 3, groups: {} };
          
          if (importedData.version === 3 && importedData.groups) {
             normalizedData = importedData;
          } else if (importedData.version === 2) {
             normalizedData.groups.globalSettings = {
                 label: "通用配置",
                 items: {
                     systemInstruction: { label: "系统指令", value: importedData.globalSettings?.systemInstruction },
                     promptPresetTurns: { label: "对话轮次预设", value: importedData.globalSettings?.promptPresetTurns },
                     sharedDatabaseInstruction: { label: "共享数据库指令", value: importedData.sharedChatroomSettings?.sharedDatabaseInstruction },
                     mainPrompt: { label: "主提示词", value: importedData.sharedChatroomSettings?.mainPrompt },
                     responseSchemaJson: { label: "Response Schema (JSON)", value: importedData.sharedChatroomSettings?.responseSchemaJson },
                     responseSchemaParserJs: { label: "Response Schema Parser (JS)", value: importedData.sharedChatroomSettings?.responseSchemaParserJs }
                 }
             };
             
             if (importedData.toolSettings) {
                 normalizedData.groups.toolSettings = { label: "工具设置", items: {} };
                 Object.keys(importedData.toolSettings).forEach(toolName => {
                     const toolLabel = toolNameMap[toolName] || toolName;
                     normalizedData.groups.toolSettings.items[toolName] = {
                         label: toolLabel,
                         value: importedData.toolSettings[toolName]
                     };
                 });
             }
          } else {
              normalizedData.groups.globalSettings = {
                  label: "通用配置",
                  items: {
                      systemInstruction: { label: "系统指令", value: importedData.systemInstruction },
                      promptPresetTurns: { label: "对话轮次预设", value: importedData.promptPresetTurns }
                  }
              };
          }
          
          resolve(normalizedData);
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
        if (value !== undefined && value !== null) {
            updatesToDispatch[path] = value;
        }
    };

    if (data.groups.globalSettings?.items) {
        const gs = data.groups.globalSettings.items;
        setUpdate('systemInstruction', gs.systemInstruction?.value);
        setUpdate('promptPresetTurns', gs.promptPresetTurns?.value);
        setUpdate('generalModelSelectionType', gs.generalModelSelectionType?.value);
        setUpdate('originalNovelLength', gs.originalNovelLength?.value);
        setUpdate('clothingGuide', gs.clothingGuide?.value);
        setUpdate('sharedDatabaseInstruction', gs.sharedDatabaseInstruction?.value);
        setUpdate('mainPrompt', gs.mainPrompt?.value);
        setUpdate('responseSchemaJson', gs.responseSchemaJson?.value);
        setUpdate('responseSchemaParserJs', gs.responseSchemaParserJs?.value);
    }

    if (data.groups.novelaiSettings?.items) {
        const ns = data.groups.novelaiSettings.items;
        setUpdate('novelaiArtistChain', ns.novelaiArtistChain?.value);
        setUpdate('novelaiDefaultPositivePrompt', ns.novelaiDefaultPositivePrompt?.value);
        setUpdate('novelaiDefaultNegativePrompt', ns.novelaiDefaultNegativePrompt?.value);
        setUpdate('novelaiTemplateMappings', ns.novelaiTemplateMappings?.value);
    }

    if (data.groups.toolSettings?.items) {
        Object.keys(data.groups.toolSettings.items).forEach(toolName => {
            const toolData = data.groups.toolSettings.items[toolName].value;
            if (toolData) {
                if (stateModule.config.toolSettings[toolName]) {
                    setUpdate(`toolSettings.${toolName}.enabled`, toolData.enabled);
                    setUpdate(`toolSettings.${toolName}.model_selection_type`, toolData.model_selection_type);
                    setUpdate(`toolSettings.${toolName}.responseSchemaJson`, toolData.responseSchemaJson);
                    setUpdate(`toolSettings.${toolName}.responseSchemaParserJs`, toolData.responseSchemaParserJs);
                    setUpdate(`toolSettings.${toolName}.toolDatabaseInstruction`, toolData.toolDatabaseInstruction);
                    setUpdate(`toolSettings.${toolName}.mainPrompt`, toolData.mainPrompt);
                    
                    setUpdate(`toolSettings.${toolName}.novelContent`, toolData.novelContent);
                    setUpdate(`toolSettings.${toolName}.originalNovelLength`, toolData.originalNovelLength);
                }
            }
        });
    }

    if (Object.keys(updatesToDispatch).length > 0) {
        transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
          updates: updatesToDispatch
        });
    }
  },

  triggerNovelSummarization: async (novelId, startIndex = 0) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.novels || !chatroomDetails.config) {
      _logAndDisplayError("无法开始总结：缺少聊天室或小说数据。", 'apiClientConfigModule.triggerNovelSummarization');
      return;
    }
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData || !novelData.toc || novelData.toc.length === 0) {
      _logAndDisplayError("无法开始总结：小说没有目录。", 'apiClientConfigModule.triggerNovelSummarization');
      return;
    }
    const toolEnabled = stateModule.config.toolSettings?.novelSummaryMaster?.enabled;
    if (!toolEnabled) {
      _logAndDisplayError("无法开始总结：小说总结大师工具未启用。", 'apiClientConfigModule.triggerNovelSummarization');
      return;
    }
    stateModule.summaryConsecutiveFailures = 0;
    const tasks = [];
    for (let index = startIndex; index < novelData.toc.length; index++) {
      const tocEntry = novelData.toc[index];
      if (!tocEntry || tocEntry.summary) {
        continue;
      }
      tasks.push({
        novelId: novelId,
        chapterTitle: tocEntry.title,
        tocEntryIndex: index,
        tocEntry: tocEntry,
        initiatorMessageId: `summary-${novelId}-${index}`,
        retryCount: 0
      });
    }
    if (tasks.length === 0) {
      _logAndDisplayError("从选定位置开始的所有章节都已有总结，无需操作。", 'info');
      return;
    }
    stateModule.summaryGenerationQueue.push(...tasks);
    if (!stateModule.isSummaryProcessing) {
      apiClientConfigModule.processSummaryQueue();
    }
  },

  deleteChapterSummary: async (novelId, tocEntryIndex, chapterTitle) => {
    try {
      const result = await apiClientChatroomsModule.updateNovelTocEntry({
        chatroomName: stateModule.currentChatroomDetails.config.name,
        novelId: novelId,
        tocIndex: tocEntryIndex,
        tocUpdates: {
          summary: "",
          structure: [],
          scriptFormat: null
        }
      });
      if (result.success && result.changes) {
        incrementalUpdateHandlerModule.processChanges(result.changes);
        _logAndDisplayError(`章节 "${chapterTitle}" 的总结已删除。`, 'success');
      } else {
        _logAndDisplayError(`删除章节 "${chapterTitle}" 的总结失败。`, 'apiClientConfigModule.deleteChapterSummary');
      }
    } catch (e) {
      _logAndDisplayError(`删除总结时发生错误: ${e.message}`, 'apiClientConfigModule.deleteChapterSummary');
    }
  },

  processSummaryQueue: async () => {
    if (stateModule.isSummaryProcessing || stateModule.summaryGenerationQueue.length === 0) {
      return;
    }
    stateModule.isSummaryProcessing = true;
    const task = stateModule.summaryGenerationQueue.shift();
    if (task) {
      stateModule.activeSummaryRequests++;
      apiClientConfigModule._processSingleSummaryTask(task);
    }
  },

  _processSingleSummaryTask: async (task) => {
    const {
      novelId,
      chapterTitle,
      tocEntry,
      tocEntryIndex,
      initiatorMessageId,
      retryCount
    } = task;
    const summaryContext = {
      novelId,
      chapterTitle,
      tocEntryIndex,
      tocEntry,
      initiatorMessageId
    };

    try {
      let targetPartitionId = stateModule.activePartitionId;
      const partitions = Array.from(stateModule.currentChatroomDetails.partitions.values());
      const novelPartition = partitions.find(p => p.name === "小说");
      if (novelPartition) {
        targetPartitionId = novelPartition.id;
      }

      const result = await apiMainTriggerModule._sendGeminiRequestWithRetry(targetPartitionId, 'novelSummaryMaster', 'tool', null, null, summaryContext);

      if (result.success) {
        const {
          parsedResult,
          parserError
        } = chatParsingModule._parseAIResponse(result.data.text_content, 'novelSummaryMaster', 'tool', result.data.responseSchemaParserJs);

        if (parserError) {
          throw new Error(`Parser error for chapter "${chapterTitle}": ${parserError}`);
        }

        if (parsedResult) {
          const shortSummary = parsedResult.shortSummary;
          const detailedSummary = parsedResult.detailedSummary;
          
          if (shortSummary && detailedSummary) {
              const newTitle = `(${tocEntryIndex + 1}) ${shortSummary}`;
              
              const updateResult = await apiClientChatroomsModule.updateNovelTocEntry({
                chatroomName: stateModule.currentChatroomDetails.config.name,
                novelId: novelId,
                tocIndex: tocEntryIndex,
                tocUpdates: {
                  title: newTitle,
                  summary: detailedSummary,
                  structure: [],
                  scriptFormat: null
                }
              });
              if (updateResult.success) {
                if (updateResult.changes) {
                    incrementalUpdateHandlerModule.processChanges(updateResult.changes);
                }
                stateModule.summaryConsecutiveFailures = 0;
              } else {
                throw new Error('Failed to save summary to backend.');
              }
          }
        }
      } else {
        throw result.error || new Error("Unknown API error");
      }
    } catch (error) {
      _logAndDisplayError(`为章节 "${chapterTitle}" 生成总结时出错 (尝试 ${retryCount + 1}/3): ${error.message}`, 'apiClientConfigModule._processSingleSummaryTask');
      task.retryCount += 1;
      if (task.retryCount < 3) {
        _logAndDisplayError(`将在稍后重试章节 "${chapterTitle}"。`, 'warn');
        stateModule.summaryGenerationQueue.unshift(task);
      } else {
        _logAndDisplayError(`章节 "${chapterTitle}" 已达到最大重试次数，将跳过。`, 'error');
        stateModule.summaryConsecutiveFailures += 1;
        if (stateModule.summaryConsecutiveFailures >= 3) {
          _logAndDisplayError("已连续失败3个章节，自动终止小说总结任务。", 'error');
          stateModule.summaryGenerationQueue = [];
        }
      }
    } finally {
      stateModule.activeSummaryRequests--;
      stateModule.isSummaryProcessing = false;
      apiClientConfigModule.processSummaryQueue();
    }
  }
};