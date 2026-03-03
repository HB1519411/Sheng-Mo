const apiResponseHandlerModule = {
  init: () => {
    eventBus.on('API_SUCCESS', (result) => {
      const {
        data,
        context,
        initiatorMessageId,
        roleName,
        roleType,
        targetRoleNameForTool,
        summaryContext
      } = result;
      if (roleName === 'novelSummaryMaster') {
        return;
      }

      const partitionContainer = stateModule.partitionDOMCache.get(context.partitionId);
      const placeholderElement = partitionContainer ? partitionContainer.querySelector(`.message-container[data-message-id="${initiatorMessageId}"]`) : null;

      const {
        parsedResult,
        parserError,
        rawText
      } = chatParsingModule._parseAIResponse(data.text_content, roleName, roleType, data.responseSchemaParserJs);

      if ((roleType === 'role' || roleType === 'temporary_role' || roleName === 'gameHost' || roleName === 'characterUpdateMaster' || roleName === 'characterCreationMaster' || roleName === 'scriptCreationMaster' || roleName === 'privateAssistant' || roleName === 'plotSummaryMaster' || roleName === 'knowledgeRecordingMaster') && !placeholderElement) {
        _logAndDisplayError(`Placeholder for messageId ${initiatorMessageId} not found. Discarding response for ${roleName}.`, 'apiResponseHandlerModule.onApiSuccess');
        return;
      }

      apiResponseHandlerModule._handlePostResponseActions(context.partitionId, placeholderElement, roleName, roleType, parsedResult, parserError, targetRoleNameForTool, summaryContext, initiatorMessageId, rawText, data.worldTime);
    });
  },

  _handlePostResponseActions: async function(partitionId, placeholderElement, roleName, roleType, parsedResult, parserError, targetRoleNameForTool = null, summaryContext = null, initiatorMessageId, rawTextContent = null, worldTime = null) {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partition = chatroomDetails?.partitions?.get(partitionId);
    if (!partition) {
      _logAndDisplayError(`_handlePostResponseActions aborted for ${roleName}: Partition not found.`, 'apiResponseHandlerModule._handlePostResponseActions');
      if (placeholderElement) placeholderElement.remove();
      return;
    }

    if (!parserError && parsedResult && Array.isArray(parsedResult.processedTurnActions)) {
      if (roleType === 'role' || roleType === 'temporary_role') {
        const actionFocus = parsedResult.actionFocus || '互动';
        parsedResult.processedTurnActions.forEach(action => {
          if (actionFocus === '交流') {
            action.isIncluded = (action.type === 'speech');
          } else {
            action.isIncluded = (action.type === 'speech' || action.type === 'action');
          }
        });
      } else if (roleType === 'tool') {
        parsedResult.processedTurnActions.forEach(action => {
          action.isIncluded = true;
        });
      }
    }

    let messageObject = null;

    if (roleName === 'statusProcessingSystem') {
      const messageToUpdateId = summaryContext?.initiatorMessageId.split('_')[0];
      const messageIndex = messageToUpdateId ? partition.history.findIndex(msg => msg.id === messageToUpdateId) : -1;

      if (messageIndex === -1) {
        _logAndDisplayError(`_handlePostResponseActions for SPS failed: Could not find original message with ID ${messageToUpdateId} to attach status to.`, 'apiResponseHandlerModule._handlePostResponseActions');
        return;
      }
      messageObject = partition.history[messageIndex];

      if (!parserError && parsedResult && typeof parsedResult === 'object') {
        const sourceMessageRoleName = summaryContext?.triggeringCharacterName;
        const sourceMessageAlias = uiChatUtilsModule.getDisplayName(sourceMessageRoleName, partitionId);
        parsedResult.processedCharacterInfo.characterName = sourceMessageAlias;
        
        const existingResult = messageObject.statusProcessingSystemResult || {};
        const existingCharInfo = existingResult.processedCharacterInfo || {};

        const mergedCharacterInfo = {
            ...parsedResult.processedCharacterInfo,
            internalGoalItems: existingCharInfo.internalGoalItems || parsedResult.processedCharacterInfo.internalGoalItems
        };

        messageObject.statusProcessingSystemResult = {
            processedSceneContext: existingResult.processedSceneContext,
            processedCharacterInfo: mergedCharacterInfo
        };
        
        delete messageObject.statusProcessingSystemError;
      } else {
        messageObject.statusProcessingSystemError = parserError || "Unknown SPS processing error";
      }

      await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: chatroomDetails.config.name,
        partitionId: partitionId,
        messageId: messageToUpdateId,
        updates: messageObject
      }).then(() => {
        const charInfo = messageObject.statusProcessingSystemResult?.processedCharacterInfo;
        const originalCharName = summaryContext?.triggeringCharacterName;

        if (charInfo && originalCharName && !parserError) {
          const roleData = chatroomDetails.roles.find(r => r.name === originalCharName);
          const drawingTemplate = roleData?.drawingTemplate;
          const isDrawingEnabledForRole = roleData?.isDrawingEnabled === true;
          const drawingMasterEnabled = stateModule.config.toolSettings.drawingMaster?.enabled;
          const roleAlias = (partition.roleAliases || []).find(a => a.name === originalCharName);
          const sourceRoleState = roleAlias ? roleAlias.state : undefined;

          let canTriggerDrawing = false;
          if (isDrawingEnabledForRole && (sourceRoleState === roleManagementUiModule.ROLE_STATE_ACTIVE || sourceRoleState === roleManagementUiModule.ROLE_STATE_USER_CONTROL)) {
            canTriggerDrawing = true;
          }

          if (canTriggerDrawing && drawingTemplate && drawingTemplate.trim() !== '' && drawingMasterEnabled) {
            const summaryContextForDM = {
              initiatorMessageId: `${messageToUpdateId}_dm`,
              spsResult: messageObject.statusProcessingSystemResult,
              triggeringCharacterName: originalCharName
            };
            apiMainTriggerModule.triggerRoleResponse(partitionId, 'drawingMaster', originalCharName, summaryContextForDM, false);
          }
        }
      });

      return;
    }

    if (roleName === 'drawingMaster' || roleName === 'closeUpMaster') {
      let drawingMasterError = null;
      if (parserError) {
        drawingMasterError = {
          code: "DM_PARSE_ERROR",
          message: parserError
        };
      }

      const messageToUpdateId = summaryContext?.initiatorMessageId.split('_')[0];
      const messageIndex = messageToUpdateId ? partition.history.findIndex(msg => msg.id === messageToUpdateId) : -1;

      if (messageIndex === -1) {
        _logAndDisplayError(`Drawing/Close-Up Master response cannot find source message with ID ${messageToUpdateId}.`, 'apiResponseHandlerModule._handlePostResponseActions');
        return;
      }

      const sourceMessageObject = partition.history[messageIndex];
      sourceMessageObject.drawingMasterContext = {
        originalParsedData: parsedResult,
        triggeringCharacterName: summaryContext.triggeringCharacterName
      };

      if (drawingMasterError) {
        sourceMessageObject.drawingMasterError = drawingMasterError;
        await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
          chatroomName: chatroomDetails.config.name,
          partitionId: partitionId,
          messageId: messageToUpdateId,
          updates: {
            drawingMasterContext: sourceMessageObject.drawingMasterContext,
            drawingMasterError: sourceMessageObject.drawingMasterError
          }
        });
        return;
      }

      await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: chatroomDetails.config.name,
        partitionId: partitionId,
        messageId: messageToUpdateId,
        updates: {
          drawingMasterContext: sourceMessageObject.drawingMasterContext
        }
      });

      try {
        const naiPayload = await apiClientNovelaiModule._prepareNovelAiPayload(parsedResult);
        if (naiPayload) {
          apiClientNovelaiModule.addNaiRequestToQueue(naiPayload, messageToUpdateId, partitionId);
        }
      } catch (e) {
        _logAndDisplayError(`Error preparing or queuing NAI for DM after response: ${e.message}`, 'apiResponseHandlerModule._handlePostResponseActions');
        const errorUpdate = {
          drawingMasterError: {
            code: "NAI_PREPARE_ERROR",
            message: e.message
          }
        };
        await transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
          chatroomName: chatroomDetails.config.name,
          partitionId: partitionId,
          messageId: messageToUpdateId,
          updates: errorUpdate
        });
      }
      return;
    }

    if (roleName === 'plotSummaryMaster') {
      if (parserError) {
        _logAndDisplayError(`Plot Summary Master failed to parse: ${parserError}`, 'apiResponseHandlerModule._handlePostResponseActions');
        if (placeholderElement) placeholderElement.remove();
        return;
      }
    }

    if (roleName === 'characterUpdateMaster') {
      if (!parserError && parsedResult && parsedResult.originalData && parsedResult.originalData.generatedMemory) {
        const rawName = parsedResult.originalData.generatedMemory.characterName;
        if (rawName) {
          const uniqueName = uiChatUtilsModule.getUniqueName(rawName, partitionId);
          if (uniqueName && uniqueName !== rawName) {
            parsedResult.originalData.generatedMemory.characterName = uniqueName;
            if (Array.isArray(parsedResult.processedTurnActions)) {
              parsedResult.processedTurnActions.forEach(action => {
                if (action.content && action.content.startsWith('【角色更新目标】:')) {
                  action.content = action.content.replace(rawName, uniqueName);
                }
              });
            }
          }
        }
      }
    }

    messageObject = {
      id: initiatorMessageId,
      timestamp: Date.now(),
      sourceType: 'ai',
      roleName: roleName,
      roleType: roleType,
      targetRoleName: targetRoleNameForTool,
      status: 'completed',
      parsedResult: (!parserError && parsedResult) ? parsedResult : null,
      speechActionText: chatParsingModule._getSpeechActionTextForHistory(parsedResult, roleType, roleName, parserError, targetRoleNameForTool),
      calculatedWorldTime: worldTime
    };

    if (parsedResult && parsedResult.processedTurnActions) {
      messageObject.processedTurnActions = parsedResult.processedTurnActions;
    }

    if ((roleType === 'role' || roleType === 'temporary_role') && !parserError) {
      const currentRoleAlias = uiChatUtilsModule.getDisplayName(roleName, partitionId);
      if (parsedResult.processedCharacterInfo) {
        parsedResult.processedCharacterInfo.characterName = currentRoleAlias;
      }

      messageObject.statusProcessingSystemResult = {
        processedSceneContext: parsedResult.processedSceneContext,
        processedCharacterInfo: parsedResult.processedCharacterInfo
      };
      
      messageObject.godsEyeAnalysisResult = null;
      delete messageObject.statusProcessingSystemError;
    } else if (roleType === 'role' || roleType === 'temporary_role') {
      _logAndDisplayError(`Live role '${roleName}' response was missing state info. Parser Error: ${parserError}`, 'apiResponseHandlerModule._handlePostResponseActions');
    }

    const rolesToNotify = ['role', 'temporary_role', 'gameHost', 'characterUpdateMaster', 'characterCreationMaster', 'scriptCreationMaster', 'privateAssistant'];
    if (!parserError && ((rolesToNotify.includes(roleType)) || rolesToNotify.includes(roleName))) {
      uiChatUtilsModule.playBeep();
    }

    const newElement = messageBubbleFactoryModule.createMessageBubble(messageObject, partitionId);
    if (placeholderElement && newElement) {
      placeholderElement.replaceWith(newElement);
    } else if (newElement) {
      const partitionContainer = stateModule.partitionDOMCache.get(partitionId);
      if (partitionContainer) {
        partitionContainer.appendChild(newElement);
      }
    }

    await transactionManagerModule.dispatch('ADD_HISTORY_MESSAGE', {
      chatroomName: chatroomDetails.config.name,
      partitionId: partitionId,
      message: messageObject
    }).then(() => {
      const currentPartition = stateModule.currentChatroomDetails?.partitions?.get(partitionId);
      
      if ((roleType === 'role' || roleType === 'temporary_role') && !parserError) {
        const roleData = chatroomDetails.roles.find(r => r.name === roleName);
        const drawingTemplate = roleData?.drawingTemplate;
        const isDrawingEnabledForRole = roleData?.isDrawingEnabled === true;
        const drawingMasterEnabled = stateModule.config.toolSettings.drawingMaster?.enabled;
        const roleAlias = (currentPartition.roleAliases || []).find(a => a.name === roleName);
        const sourceRoleState = roleAlias ? roleAlias.state : undefined;

        let canTriggerDrawing = false;
        if (isDrawingEnabledForRole && (sourceRoleState === roleManagementUiModule.ROLE_STATE_ACTIVE || sourceRoleState === roleManagementUiModule.ROLE_STATE_USER_CONTROL)) {
          canTriggerDrawing = true;
        }

        if (canTriggerDrawing && drawingTemplate && drawingTemplate.trim() !== '' && drawingMasterEnabled) {
          const summaryContextForDM = {
            initiatorMessageId: `${initiatorMessageId}_dm`,
            spsResult: messageObject.statusProcessingSystemResult,
            triggeringCharacterName: roleName
          };
          apiMainTriggerModule.triggerRoleResponse(partitionId, 'drawingMaster', roleName, summaryContextForDM, true);
        }

        if (currentPartition && currentPartition.autoTriggerNextCharacter && parsedResult && parsedResult.nextCharacter) {
          const nextCharacterAlias = parsedResult.nextCharacter;
          const nextCharacterOriginalName = uiChatUtilsModule.getUniqueName(nextCharacterAlias, partitionId);
          const nextCharacterRoleAlias = (currentPartition.roleAliases || []).find(a => a.name === nextCharacterOriginalName);
          const nextCharacterRoleState = nextCharacterRoleAlias ? nextCharacterRoleAlias.state : undefined;

          if (nextCharacterRoleState === roleManagementUiModule.ROLE_STATE_ACTIVE) {
            stateModule.lastAutoSwitchTimestamp = Date.now();
            apiMainTriggerModule.triggerRoleResponse(partitionId, nextCharacterOriginalName, null, null, true);
          }
        }
      }
    });
  },
};