const messageActionsToolsModule = {
  saveEventRecord: async (msgCont, overrideCharacters = null) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    if (!messageData) {
      _logAndDisplayError('无法获取消息或动作数据。', 'saveEventRecord');
      return;
    }

    const actions = messageData.processedTurnActions;
    let sharedDate = messageActionsImplModule._getLatestDateFromHistory(stateModule.activePartitionId);
    if (!sharedDate) {
      const result = await apiClientChatroomsModule.getPredictedDate(stateModule.currentChatroomDetails.config.name, stateModule.activePartitionId);
      if (result.success && result.data.date) {
        sharedDate = result.data.date;
      } else {
        sharedDate = '日期未知';
      }
    }

    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!activePartition) return;

    let involvedCharacters;
    if (overrideCharacters !== null && Array.isArray(overrideCharacters)) {
      involvedCharacters = involvedCharacters;
    } else {
      involvedCharacters = (activePartition.roleAliases || [])
        .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE)
        .map(alias => alias.name);
    }

    const eventSummaries = [];
    const eventDetailsList = [];

    actions.forEach(action => {
      const content = action.content;
      if (content.startsWith('【事件记录】')) {
        const summaryMatch = content.match(/摘要: (.*)/);
        const summary = summaryMatch ? summaryMatch[1].trim() : '';
        const detailsMatch = content.match(/细节:\n([\s\S]*)/);
        const details = detailsMatch ? detailsMatch[1].trim() : '';

        if (summary) {
          eventSummaries.push(summary);
          if (details) {
            eventDetailsList.push(details);
          }
        }
      }
    });

    if (eventSummaries.length > 0) {
      const combinedSummary = eventSummaries.join('\n\n');
      const combinedDetails = eventDetailsList.join('\n\n');

      const eventData = {
        id: uiChatUtilsModule._generateMessageId(),
        time: sharedDate,
        content: combinedSummary,
        details: combinedDetails,
        involvedCharacters: involvedCharacters
      };
      const result = await transactionManagerModule.dispatch('addEvent', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        eventData: eventData
      });
      if (result.success) {
        messageActionsImplModule.deleteMessage(msgCont);
        stateModule.activeMessageActions = null;
      }
    } else {
      _logAndDisplayError("未找到有效的事件记录块或保存失败。", "saveEventRecord");
    }
  },

  saveEventRecordWithManualInput: (msgCont) => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!activePartition) return;

    const currentInvolved = (activePartition.roleAliases || [])
      .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE)
      .map(alias => alias.name).join(', ');

    const userInput = prompt("手动输入参与角色 (用逗号分隔):", currentInvolved);
    if (userInput === null) return;

    const manualCharacters = userInput.split(',').map(name => name.trim()).filter(Boolean);
    messageActionsToolsModule.saveEventRecord(msgCont, manualCharacters);
  },

  savePrivateAssistantToScript: (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    if (!messageData) {
      _logAndDisplayError('无法获取消息或动作数据。', 'messageActionsToolsModule.savePrivateAssistantToScript');
      return;
    }

    const contentToAppend = messageData.processedTurnActions.map(a => a.content).join('\n\n');

    if (!contentToAppend.trim()) {
      _logAndDisplayError('没有可保存的内容。', 'messageActionsToolsModule.savePrivateAssistantToScript');
      return;
    }

    const currentPartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!currentPartition) return;

    let partitionsToUpdate = [currentPartition];
    if (currentPartition.allowCrossPartitionHistoryAccess) {
      partitionsToUpdate = Array.from(stateModule.currentChatroomDetails.partitions.values()).filter(p => p.allowCrossPartitionHistoryAccess);
    }

    const chatroomName = stateModule.currentChatroomDetails.config.name;

    partitionsToUpdate.forEach(p => {
      const existingScript = p.script || "";
      const newScript = existingScript ? (existingScript + "\n\n" + contentToAppend) : contentToAppend;

      transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: chatroomName,
        partitionId: p.id,
        updates: {
          script: newScript
        }
      });
    });

    messageActionsImplModule.deleteMessage(msgCont);
    stateModule.activeMessageActions = null;
  },

  saveKnowledgeRecord: async (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    if (!messageData) {
      _logAndDisplayError('无法获取消息或动作数据。', 'saveKnowledgeRecord');
      return;
    }

    const actions = messageData.processedTurnActions;
    let successCount = 0;

    for (const action of actions) {
      const content = action.content;
      const nameMatch = content.match(/【知识条目: (.*?)】/);
      const categoryMatch = content.match(/分类: (.*)/);
      const aliasMatch = content.match(/别名: (.*)/);
      const notesMatch = content.match(/内容: ([\s\S]*)/);

      if (nameMatch && categoryMatch && notesMatch) {
        const name = nameMatch[1].trim();
        const category = categoryMatch[1].trim();
        const notes = notesMatch[1].trim();
        const synonyms = aliasMatch ? aliasMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

        const entryData = {
          name: name,
          keywords: synonyms,
          content: notes,
        };

        const result = await apiClientChatroomsModule.addKnowledgeEntry(category, entryData);
        if (result.success) {
          successCount++;
        } else {
          _logAndDisplayError(`保存条目 "${name}" 失败: ${result.error?.message}`, 'saveKnowledgeRecord');
        }
      }
    }

    if (successCount > 0) {
      messageActionsImplModule.deleteMessage(msgCont);
      stateModule.activeMessageActions = null;
    } else {
      alert('Failed to save any knowledge entries. See error log for details.');
    }
  },

  triggerDrawingMaster: (msgCont) => {
    let targetMessageId = msgCont.dataset.messageId;
    let targetRoleName = msgCont.dataset.roleName;

    if (targetRoleName === '用户') {
      const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
      if (!activePartition || !activePartition.history) return;
      const currentIndex = activePartition.history.findIndex(m => m.id === targetMessageId);
      if (currentIndex > -1) {
        for (let i = currentIndex - 1; i >= 0; i--) {
          const prevMsg = activePartition.history[i];
          if (prevMsg.roleName !== '用户') {
            targetMessageId = prevMsg.id;
            targetRoleName = prevMsg.roleName;
            break;
          }
        }
      }
    }

    const summaryContextForDM = {
      initiatorMessageId: `${targetMessageId}_dm`,
      triggeringCharacterName: targetRoleName
    };
    apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'drawingMaster', targetRoleName, summaryContextForDM, false);
    messageActionsImplModule.hideAllMessageActions();
  },

  triggerCloseUpMaster: (msgCont) => {
    let targetMessageId = msgCont.dataset.messageId;
    let targetRoleName = msgCont.dataset.roleName;

    if (targetRoleName === '用户') {
      const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
      if (!activePartition || !activePartition.history) return;
      const currentIndex = activePartition.history.findIndex(m => m.id === targetMessageId);
      if (currentIndex > -1) {
        for (let i = currentIndex - 1; i >= 0; i--) {
          const prevMsg = activePartition.history[i];
          if (prevMsg.roleName !== '用户') {
            targetMessageId = prevMsg.id;
            targetRoleName = prevMsg.roleName;
            break;
          }
        }
      }
    }

    const summaryContextForCU = {
      initiatorMessageId: `${targetMessageId}_cu`,
      triggeringCharacterName: targetRoleName
    };
    apiMainTriggerModule.triggerRoleResponse(stateModule.activePartitionId, 'closeUpMaster', targetRoleName, summaryContextForCU, false);
    messageActionsImplModule.hideAllMessageActions();
  },

  setBackgroundFromMessage: (msgCont) => {
    const messageId = msgCont.dataset.messageId;
    const imageDataUrl = stateModule.drawingMasterImageCache.get(messageId);
    if (!imageDataUrl) {
      _logAndDisplayError('No cached image data URL found for this message.', 'messageActionsToolsModule.setBackgroundFromMessage');
      return;
    }
    const chatroomName = stateModule.currentChatroomDetails.config.name;
    transactionManagerModule.dispatch('SET_BACKGROUND', {
      chatroomName,
      imageData: imageDataUrl
    });
    messageActionsImplModule.hideAllMessageActions();
  },

  downloadImage: (msgCont) => {
    const messageId = msgCont.dataset.messageId;
    const imageDataUrl = stateModule.drawingMasterImageCache.get(messageId);
    if (!imageDataUrl) {
      _logAndDisplayError('No cached image data URL found for this message to download.', 'downloadImage');
      return;
    }

    let roleName = msgCont.dataset.roleName;
    if (roleName === '用户') {
        const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
        if (activePartition && activePartition.history) {
            const currentIndex = activePartition.history.findIndex(m => m.id === messageId);
            if (currentIndex > -1) {
                for (let i = currentIndex - 1; i >= 0; i--) {
                    const prevMsg = activePartition.history[i];
                    if (prevMsg.roleName && prevMsg.roleName !== '用户') {
                        roleName = prevMsg.roleName;
                        break;
                    }
                }
            }
        }
    }

    const displayName = uiChatUtilsModule.getDisplayName(roleName, stateModule.activePartitionId) || '未知角色';

    try {
      fetch(imageDataUrl)
        .then(res => res.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${displayName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        });
    } catch (e) {
      _logAndDisplayError(`Error creating blob for download: ${e.message}`, 'downloadImage');
    }
    messageActionsImplModule.hideAllMessageActions();
  }
};