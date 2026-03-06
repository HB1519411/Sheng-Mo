const messageActionsCharacterModule = {
  saveNewCharacter: async (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    const actions = messageData.processedTurnActions;
    let characterName = null;
    let publicInfoRawContent = "";
    let characterSettings = { mbti: '', bigFive: {}, archetypes: [], keywords: [] };
    let memoryEntries = [];

    actions.forEach(action => {
      const content = action.content;
      if (content.startsWith('【新建角色】')) {
        characterName = content.replace('【新建角色】', '').trim();
      } else if (content.startsWith('【公开信息】')) {
        publicInfoRawContent = content.replace('【公开信息】', '').trim();
      } else if (content.startsWith('【性格设定】')) {
        const mbtiMatch = content.match(/MBTI:\s*(.*)/);
        characterSettings.mbti = mbtiMatch[1].trim();

        const bfMatch = content.match(/大五人格:\s*O:(.*?), C:(.*?), E:(.*?), A:(.*?), N:(.*)/);
        characterSettings.bigFive = {
          openness: bfMatch[1].trim(),
          conscientiousness: bfMatch[2].trim(),
          extraversion: bfMatch[3].trim(),
          agreeableness: bfMatch[4].trim(),
          neuroticism: bfMatch[5].trim()
        };

        const archMatch = content.match(/原型:\s*(.*)/);
        characterSettings.archetypes = archMatch[1].split(',').map(s => s.trim()).filter(Boolean);

        const kwMatch = content.match(/关键词:\s*(.*)/);
        characterSettings.keywords = kwMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      } else if (content.startsWith('【初始记忆')) {
        const dateMatch = content.match(/【初始记忆\s*(.*?)】/);
        const date = dateMatch[1];

        const summaryMatch = content.match(/】\n(.*?)(?=\n详情:|$)/s);
        const summary = summaryMatch[1].trim();

        const detailLines = [];
        const detailsMatch = content.match(/详情:\n([\s\S]*)/);
        if (detailsMatch) {
          const rawDetails = detailsMatch[1].split('\n');
          rawDetails.forEach(line => {
            if (line.trim().startsWith('- ')) {
              detailLines.push(line.trim().substring(2));
            }
          });
        }

        memoryEntries.push({
          id: uiChatUtilsModule._generateMessageId(),
          time: date,
          content: summary + (detailLines.length > 0 ? '\n' + detailLines.join('\n') : '')
        });
      }
    });

    const chatroomName = stateModule.currentChatroomDetails.config.name;
    const existingRole = stateModule.currentChatroomDetails.roles.find(r => r.name === characterName);

    const roleData = {
      name: characterName,
      mbti: characterSettings.mbti,
      bigFiveOpenness: characterSettings.bigFive.openness,
      bigFiveConscientiousness: characterSettings.bigFive.conscientiousness,
      bigFiveExtraversion: characterSettings.bigFive.extraversion,
      bigFiveAgreeableness: characterSettings.bigFive.agreeableness,
      bigFiveNeuroticism: characterSettings.bigFive.neuroticism,
      archetypes: characterSettings.archetypes,
      keywords: characterSettings.keywords,
      memory: memoryEntries,
      publicInfo: []
    };

    roleData.publicInfo.push({
      id: uiChatUtilsModule._generateMessageId(),
      keyword: '',
      content: publicInfoRawContent
    });

    if (existingRole) {
      if (confirm(`角色 "${characterName}" 已存在。要覆盖其记忆和设定吗？`)) {
        await transactionManagerModule.dispatch('UPDATE_ROLE_FIELDS', {
          chatroomName: chatroomName,
          roleName: characterName,
          updates: roleData
        });
        messageActionsImplModule.deleteMessage(msgCont);
      }
    } else {
      await transactionManagerModule.dispatch('CREATE_ROLE', {
        chatroomName: chatroomName,
        roleData: roleData
      });
      messageActionsImplModule.deleteMessage(msgCont);
    }

    messageActionsImplModule.hideAllMessageActions();
  },

  saveCharacterUpdate: async (msgCont) => {
    const messageData = messageActionsImplModule._getMessageAndActions(msgCont);
    const actions = messageData.processedTurnActions;
    let targetRoleName = null;
    const newMemoryEntries = [];

    actions.forEach(action => {
      const content = action.content;
      if (content.startsWith('【角色更新目标】:')) {
        targetRoleName = content.replace('【角色更新目标】:', '').trim();
      } else if (content.startsWith('【新记忆】')) {
        const summaryMatch = content.match(/【新记忆】\n(.*?)(?=\n详情:|$)/s);
        const summary = summaryMatch[1].trim();
        const detailsMatch = content.match(/详情:\n([\s\S]*)/);
        const details = detailsMatch ? detailsMatch[1].trim() : '';

        newMemoryEntries.push({ summary, details });
      }
    });

    let sharedDate = messageActionsImplModule._getLatestDateFromHistory(stateModule.activePartitionId);
    if (!sharedDate) {
      const result = await apiClientChatroomsModule.getPredictedDate(stateModule.currentChatroomDetails.config.name, stateModule.activePartitionId);
      if (!result.success || !result.data.date) throw new Error("获取世界时间失败，拒绝保存角色更新。");
      sharedDate = result.data.date;
    }

    const chatroomName = stateModule.currentChatroomDetails.config.name;
    const roleDataToUpdate = stateModule.currentChatroomDetails.roles.find(r => r.name === targetRoleName);

    const combinedSummary = newMemoryEntries.map(e => e.summary).join('\n\n');
    const combinedDetails = newMemoryEntries.map(e => e.details).filter(Boolean).join('\n\n');

    let memoryList = roleDataToUpdate.memory;
    const existingMemoryIndex = memoryList.findIndex(mem => mem.time === sharedDate);
    if (existingMemoryIndex > -1) {
      const existing = memoryList[existingMemoryIndex];
      existing.content = `${existing.content}\n\n${combinedSummary}`.trim();
      if (combinedDetails) {
        existing.details = `${existing.details || ''}\n\n${combinedDetails}`.trim();
      }
    } else {
      memoryList.push({
        id: uiChatUtilsModule._generateMessageId(),
        time: sharedDate,
        content: combinedSummary,
        details: combinedDetails
      });
    }

    transactionManagerModule.dispatch('UPDATE_ROLE_FIELDS', {
      chatroomName,
      roleName: targetRoleName,
      updates: { memory: memoryList }
    });
    messageActionsImplModule.deleteMessage(msgCont);
    messageActionsImplModule.hideAllMessageActions();
  },

  _handleBulkSaveCharacterUpdates: () => {
    const messagesToSave = document.querySelectorAll('.message-container[data-role-name="characterUpdateMaster"], .message-container[data-role-name="characterCreationMaster"]');
    messagesToSave.forEach(msgCont => {
      const roleName = msgCont.dataset.roleName;
      if (roleName === 'characterCreationMaster') {
        messageActionsCharacterModule.saveNewCharacter(msgCont);
      } else if (roleName === 'characterUpdateMaster') {
        messageActionsCharacterModule.saveCharacterUpdate(msgCont);
      }
    });
    messageActionsImplModule.hideAllMessageActions();
  }
};