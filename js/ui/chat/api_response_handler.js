const apiResponseHandlerModule = {
  init: () => {
    eventBus.on('API_SUCCESS', (result) => {
      const { data, context, initiatorMessageId, roleName, roleType, targetRoleNameForTool, summaryContext } = result;
      if (roleName === 'novelSummaryMaster') return;

      const partitionContainer = stateModule.partitionDOMCache.get(context.partitionId);
      const placeholderElement = partitionContainer?.querySelector(`.message-container[data-message-id="${initiatorMessageId}"]`);

      const { parsedResult, parserError, rawText } = chatParsingModule._parseAIResponse(data.text_content, roleName, roleType, data.responseSchemaParserJs);

      const needsPlaceholder = ['role', 'temporary_role', 'gameHost', 'characterUpdateMaster', 'characterCreationMaster', 'scriptCreationMaster', 'privateAssistant', 'plotSummaryMaster', 'knowledgeRecordingMaster'].includes(roleType === 'tool' ? roleName : roleType);
      if (needsPlaceholder && !placeholderElement) return;

      apiResponseHandlerModule._handlePostResponseActions(context.partitionId, placeholderElement, roleName, roleType, parsedResult, parserError, targetRoleNameForTool, summaryContext, initiatorMessageId, rawText, data.worldTime);
    });
  },

  _handlePostResponseActions: async (partitionId, placeholderElement, roleName, roleType, parsedResult, parserError, targetRoleNameForTool, summaryContext, initiatorMessageId, rawTextContent, worldTime) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partition = chatroomDetails?.partitions?.get(partitionId);
    if (!partition) {
      throw new Error(`Partition not found during API response handling: ${partitionId}`);
    }

    if (!parserError && parsedResult?.processedTurnActions) {
      const isRole = roleType === 'role' || roleType === 'temporary_role';
      const actionFocus = parsedResult.actionFocus || '互动';
      parsedResult.processedTurnActions.forEach(action => {
        action.isIncluded = isRole ? (actionFocus === '交流' ? action.type === 'speech' : (action.type === 'speech' || action.type === 'action')) : true;
      });
    }

    if (roleName === 'statusProcessingSystem') {
      const messageToUpdateId = summaryContext?.initiatorMessageId?.split('_')[0];
      const messageObject = partition.history.find(msg => msg.id === messageToUpdateId);
      if (!messageObject) throw new Error(`Target message for SPS update not found: ${messageToUpdateId}`);

      if (!parserError && parsedResult) {
        const sourceMessageAlias = uiChatUtilsModule.getDisplayName(summaryContext?.triggeringCharacterName, partitionId);
        parsedResult.processedCharacterInfo.characterName = sourceMessageAlias;
        const existingCharInfo = messageObject.statusProcessingSystemResult?.processedCharacterInfo || {};
        
        messageObject.statusProcessingSystemResult = {
          processedSceneContext: messageObject.statusProcessingSystemResult?.processedSceneContext,
          processedCharacterInfo: {
            ...parsedResult.processedCharacterInfo,
            internalGoalItems: existingCharInfo.internalGoalItems || parsedResult.processedCharacterInfo.internalGoalItems
          }
        };
        delete messageObject.statusProcessingSystemError;
      } else {
        messageObject.statusProcessingSystemError = parserError || "Unknown SPS error";
      }

      await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: chatroomDetails.config.name,
        partitionId, messageId: messageToUpdateId, updates: messageObject
      });

      const originalCharName = summaryContext?.triggeringCharacterName;
      if (!parserError && originalCharName) {
        const roleData = chatroomDetails.roles.find(r => r.name === originalCharName);
        const roleAlias = (partition.roleAliases || []).find(a => a.name === originalCharName);
        if (roleData?.isDrawingEnabled && roleData.drawingTemplate && stateModule.config.toolSettings.drawingMaster?.enabled && ['活', '用'].includes(roleAlias?.state)) {
          apiMainTriggerModule.triggerRoleResponse(partitionId, 'drawingMaster', originalCharName, {
            initiatorMessageId: `${messageToUpdateId}_dm`,
            spsResult: messageObject.statusProcessingSystemResult,
            triggeringCharacterName: originalCharName
          }, false);
        }
      }
      return;
    }

    if (roleName === 'drawingMaster' || roleName === 'closeUpMaster') {
      const messageToUpdateId = summaryContext?.initiatorMessageId?.split('_')[0];
      const sourceMessageObject = partition.history.find(msg => msg.id === messageToUpdateId);
      if (!sourceMessageObject) throw new Error(`Source message for drawing update not found: ${messageToUpdateId}`);

      const updates = {
        drawingMasterContext: { originalParsedData: parsedResult, triggeringCharacterName: summaryContext.triggeringCharacterName }
      };
      if (parserError) updates.drawingMasterError = { code: "DM_PARSE_ERROR", message: parserError };

      await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: chatroomDetails.config.name,
        partitionId, messageId: messageToUpdateId, updates
      });

      if (!parserError) {
        try {
          const naiPayload = await apiClientNovelaiModule._prepareNovelAiPayload(parsedResult);
          if (naiPayload) apiClientNovelaiModule.addNaiRequestToQueue(naiPayload, messageToUpdateId, partitionId);
        } catch (e) {
          transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
            chatroomName: chatroomDetails.config.name,
            partitionId, messageId: messageToUpdateId,
            updates: { drawingMasterError: { code: "NAI_PREPARE_ERROR", message: e.message } }
          });
        }
      }
      return;
    }

    if (roleName === 'characterUpdateMaster' && !parserError && parsedResult?.originalData?.generatedMemory?.characterName) {
      const rawName = parsedResult.originalData.generatedMemory.characterName;
      const uniqueName = uiChatUtilsModule.getUniqueName(rawName, partitionId);
      if (uniqueName && uniqueName !== rawName) {
        parsedResult.originalData.generatedMemory.characterName = uniqueName;
        parsedResult.processedTurnActions?.forEach(action => {
          if (action.content?.startsWith('【角色更新目标】:')) action.content = action.content.replace(rawName, uniqueName);
        });
      }
    }

    const messageObject = {
      id: initiatorMessageId,
      timestamp: Date.now(),
      sourceType: 'ai',
      roleName, roleType,
      targetRoleName: targetRoleNameForTool,
      status: 'completed',
      parsedResult: (!parserError && parsedResult) ? parsedResult : null,
      speechActionText: chatParsingModule._getSpeechActionTextForHistory(parsedResult, roleType, roleName, parserError, targetRoleNameForTool),
      calculatedWorldTime: worldTime,
      processedTurnActions: parsedResult?.processedTurnActions
    };

    if ((roleType === 'role' || roleType === 'temporary_role') && !parserError) {
      if (parsedResult.processedCharacterInfo) {
        parsedResult.processedCharacterInfo.characterName = uiChatUtilsModule.getDisplayName(roleName, partitionId);
      }
      messageObject.statusProcessingSystemResult = {
        processedSceneContext: parsedResult.processedSceneContext,
        processedCharacterInfo: parsedResult.processedCharacterInfo
      };
    }

    if (!parserError && ['role', 'temporary_role', 'gameHost', 'characterUpdateMaster', 'characterCreationMaster', 'scriptCreationMaster', 'privateAssistant'].includes(roleType === 'tool' ? roleName : roleType)) {
      uiChatUtilsModule.playBeep();
    }

    const newElement = messageBubbleFactoryModule.createMessageBubble(messageObject, partitionId);
    if (placeholderElement && newElement) placeholderElement.replaceWith(newElement);
    else if (newElement) stateModule.partitionDOMCache.get(partitionId)?.appendChild(newElement);

    await transactionManagerModule.dispatch('ADD_HISTORY_MESSAGE', {
      chatroomName: chatroomDetails.config.name,
      partitionId, message: messageObject
    });

    if ((roleType === 'role' || roleType === 'temporary_role') && !parserError) {
      const roleData = chatroomDetails.roles.find(r => r.name === roleName);
      const roleAlias = (partition.roleAliases || []).find(a => a.name === roleName);
      
      if (roleData?.isDrawingEnabled && roleData.drawingTemplate && stateModule.config.toolSettings.drawingMaster?.enabled && ['活', '用'].includes(roleAlias?.state)) {
        apiMainTriggerModule.triggerRoleResponse(partitionId, 'drawingMaster', roleName, {
          initiatorMessageId: `${initiatorMessageId}_dm`,
          spsResult: messageObject.statusProcessingSystemResult,
          triggeringCharacterName: roleName
        }, true);
      }

      if (partition.autoTriggerNextCharacter && parsedResult?.nextCharacter) {
        const nextCharName = uiChatUtilsModule.getUniqueName(parsedResult.nextCharacter, partitionId);
        const nextRoleState = (partition.roleAliases || []).find(a => a.name === nextCharName)?.state;
        if (nextRoleState === '活') {
          stateModule.lastAutoSwitchTimestamp = Date.now();
          apiMainTriggerModule.triggerRoleResponse(partitionId, nextCharName, null, null, true);
        }
      }
    }
  }
};