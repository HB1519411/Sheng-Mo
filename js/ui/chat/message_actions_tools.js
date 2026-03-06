const messageActionsToolsModule = {
  saveEventRecord: async (msgCont, overrideCharacters = null) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    const actions = messageData.processedTurnActions;
    let sharedDate = messageActionsImplModule._getLatestDateFromHistory(stateModule.activePartitionId);
    if (!sharedDate) {
      const result = await apiClientChatroomsModule.getPredictedDate(stateModule.currentChatroomDetails.config.name, stateModule.activePartitionId);
      if (!result.success || !result.data.date) throw new Error("获取世界时间失败，拒绝保存事件记录。");
      sharedDate = result.data.date;
    }

    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    let involvedCharacters;
    if (overrideCharacters !== null && Array.isArray(overrideCharacters)) {
      involvedCharacters = overrideCharacters;
    } else {
      involvedCharacters = activePartition.roleAliases
        .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE)
        .map(alias => alias.name);
    }

    const eventSummaries = [];
    const eventDetailsList = [];

    actions.forEach(action => {
      const content = action.content;
      if (content.startsWith('【事件记录】')) {
        const summaryMatch = content.match(/摘要: (.*)/);
        const summary = summaryMatch[1].trim();
        const detailsMatch = content.match(/细节:\n([\s\S]*)/);
        const details = detailsMatch ? detailsMatch[1].trim() : '';

        eventSummaries.push(summary);
        if (details) {
          eventDetailsList.push(details);
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
    }
  },

  saveEventRecordWithManualInput: (msgCont) => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const currentInvolved = activePartition.roleAliases
      .filter(alias => alias.state === roleManagementUiModule.ROLE_STATE_ACTIVE)
      .map(alias => alias.name).join(', ');

    const userInput = prompt("手动输入参与角色 (用逗号分隔):", currentInvolved);
    if (userInput === null) return;

    const manualCharacters = userInput.split(',').map(name => name.trim()).filter(Boolean);
    messageActionsToolsModule.saveEventRecord(msgCont, manualCharacters);
  },

  savePrivateAssistantToScript: (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    const contentToAppend = messageData.processedTurnActions.map(a => a.content).join('\n\n');
    const currentPartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);

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
        updates: { script: newScript }
      });
    });

    messageActionsImplModule.deleteMessage(msgCont);
    stateModule.activeMessageActions = null;
  },

  saveKnowledgeRecord: async (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    const actions = messageData.processedTurnActions;

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

        await apiClientChatroomsModule.addKnowledgeEntry(category, entryData);
      }
    }
    messageActionsImplModule.deleteMessage(msgCont);
    stateModule.activeMessageActions = null;
  },

  triggerDrawingMaster: (msgCont) => {
    let targetMessageId = msgCont.dataset.messageId;
    let targetRoleName = msgCont.dataset.roleName;

    if (targetRoleName === '用户') {
      const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
      const currentIndex = activePartition.history.findIndex(m => m.id === targetMessageId);
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevMsg = activePartition.history[i];
        if (prevMsg.roleName !== '用户') {
          targetMessageId = prevMsg.id;
          targetRoleName = prevMsg.roleName;
          break;
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
      const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
      const currentIndex = activePartition.history.findIndex(m => m.id === targetMessageId);
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevMsg = activePartition.history[i];
        if (prevMsg.roleName !== '用户') {
          targetMessageId = prevMsg.id;
          targetRoleName = prevMsg.roleName;
          break;
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
    let roleName = msgCont.dataset.roleName;
    
    if (roleName === '用户') {
        const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
        const currentIndex = activePartition.history.findIndex(m => m.id === messageId);
        for (let i = currentIndex - 1; i >= 0; i--) {
            const prevMsg = activePartition.history[i];
            if (prevMsg.roleName && prevMsg.roleName !== '用户') {
                roleName = prevMsg.roleName;
                break;
            }
        }
    }

    const displayName = uiChatUtilsModule.getDisplayName(roleName, stateModule.activePartitionId) || '未知角色';

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
    messageActionsImplModule.hideAllMessageActions();
  }
};