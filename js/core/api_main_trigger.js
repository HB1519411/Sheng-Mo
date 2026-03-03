const apiMainTriggerModule = {
  _handleAutoPartitionSwitch: async (partitionId, roleName, isAutoChainRequest) => {},

  _sendGeminiRequestWithRetry: async (partitionId, roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null, summaryContext = null, isAutoChainRequest = false) => {
    let placeholderElement = null;
    let effectiveInitiatorMessageId = summaryContext?.initiatorMessageId || uiChatUtilsModule._generateMessageId();

    try {
      const triggerInfo = {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: partitionId,
        roleName: roleName,
        roleType: roleType,
        targetRoleNameForTool: targetRoleNameForTool,
        triggeringCharacterName: triggeringCharacterName,
        summaryContext: summaryContext
      };

      const rolesThatCreatePlaceholders = ['role', 'temporary_role', 'gameHost', 'characterUpdateMaster', 'characterCreationMaster', 'scriptCreationMaster', 'privateAssistant', 'plotSummaryMaster', 'knowledgeRecordingMaster'];
      const shouldCreatePlaceholder = rolesThatCreatePlaceholders.includes(roleType) || rolesThatCreatePlaceholders.includes(roleName);

      if (shouldCreatePlaceholder) {
        placeholderElement = partitionRendererModule.createPlaceholderElement(partitionId, roleName, roleType, targetRoleNameForTool, effectiveInitiatorMessageId);
        if (placeholderElement) {
          const partitionContainer = stateModule.partitionDOMCache.get(partitionId);
          if (partitionContainer) {
            partitionContainer.appendChild(placeholderElement);
          }
        }
      }

      stateModule.activeRequests.add(effectiveInitiatorMessageId);
      if (stateModule.activeRequests.size === 1) {
        partitionRendererModule.showLoadingSpinner();
      }

      const uiAbortController = new AbortController();
      stateModule.pendingRequests.set(effectiveInitiatorMessageId, uiAbortController);

      if (typeof partitionRendererModule !== 'undefined' && partitionRendererModule.updateMessageElementStatus) {
        if (roleName === 'statusProcessingSystem' && effectiveInitiatorMessageId) {
          partitionRendererModule.updateMessageElementStatus(effectiveInitiatorMessageId.split('_')[0], "[状态更新中...]");
        } else if ((roleName === 'drawingMaster' || roleName === 'closeUpMaster') && effectiveInitiatorMessageId) {
          partitionRendererModule.updateMessageElementStatus(effectiveInitiatorMessageId.split('_')[0], "[图片生成中...]", true);
        }
      }

      const backendResponse = await apiServiceModule.performApiCall('/trigger-ai-response', 'POST', triggerInfo, {}, uiAbortController.signal);
      
      if (uiAbortController.signal.aborted) {
        throw new Error('Cancelled by UI');
      }

      let result;

      if (backendResponse && backendResponse.is_frontend_proxy_request) {
        const { url, headers, body, responseSchemaParserJs, proxy_url_used } = backendResponse;
        
        let aiResponseJson;
        try {
            const frontendResponse = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: uiAbortController.signal
            });

            if (!frontendResponse.ok) {
                const errorText = await frontendResponse.text();
                throw new Error(`Frontend proxy request failed: ${frontendResponse.status} ${errorText}`);
            }
            aiResponseJson = await frontendResponse.json();
             result = {
                success: true,
                data: {
                    text_content: aiResponseJson?.candidates?.[0]?.content?.parts?.[0]?.text || null,
                    responseSchemaParserJs: responseSchemaParserJs
                }
            };
            if (!result.data.text_content) {
                throw new Error('Frontend proxy response invalid: No text content found.');
            }
        } catch (e) {
            console.warn("Primary proxy failed, falling back to backend for backup proxy...", e);
            const fallbackTriggerInfo = { 
                ...triggerInfo, 
                is_backup_fallback: true,
                failed_proxy_url: proxy_url_used
            };
            result = await apiServiceModule.performApiCall('/trigger-ai-response', 'POST', fallbackTriggerInfo, {}, uiAbortController.signal);
        }
      } else {
        result = backendResponse;
      }
      
      if (result && result.success) {
        const finalResult = {
          success: true,
          data: result.data,
          context: {
            partitionId: partitionId,
            responseSchemaParserJs: result.data?.responseSchemaParserJs,
          },
          initiatorMessageId: effectiveInitiatorMessageId,
        };
        eventBus.emit('API_SUCCESS', {
          ...finalResult,
          summaryContext,
          targetRoleNameForTool,
          roleName,
          roleType,
        });
        return finalResult;
      } else {
        throw result.error || new Error("Request failed without specific error");
      }
    } catch (e) {
      const isCancelled = e.name === 'AbortError' || e.message === 'Cancelled by UI' || e.code === 'REQUEST_ABORTED';
      const errorPayload = {
        code: isCancelled ? 'REQUEST_CANCELLED_BY_UI' : (e.code || "REQUEST_FAILED"),
        message: e.message || 'Unknown error'
      };

      eventBus.emit('API_ERROR', {
        error: errorPayload,
        initiatorMessageId: effectiveInitiatorMessageId,
        roleName,
        roleType,
        targetRoleNameForTool,
        summaryContext,
      });

      if (isCancelled) {
        _logAndDisplayError(`Request for ${roleName} (initiator: ${effectiveInitiatorMessageId}) was cancelled by UI.`, 'apiMainTriggerModule._sendGeminiRequestWithRetry');
        if (placeholderElement) {
          placeholderElement.remove();
        }
      } else {
        _logAndDisplayError(`Request ultimately failed (Role: ${roleName}): ${errorPayload.message}`, 'apiMainTriggerModule._sendGeminiRequestWithRetry');
        if (placeholderElement) {
          placeholderElement.remove();
        }
      }

      return {
        success: false,
        error: errorPayload,
        initiatorMessageId: effectiveInitiatorMessageId
      };
    } finally {
      if (effectiveInitiatorMessageId) {
        stateModule.pendingRequests.delete(effectiveInitiatorMessageId);
        stateModule.activeRequests.delete(effectiveInitiatorMessageId);
        if (stateModule.activeRequests.size === 0) {
          partitionRendererModule.hideLoadingSpinner();
        }
      }
    }
  },

  sendSingleMessageForRoleImpl: async (partitionId, roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null, summaryContext = null, isAutoChainRequest = false) => {
    if (!partitionId) {
      _logAndDisplayError("Cannot send message: Partition ID is missing.", "apiMainTriggerModule.sendSingleMessageForRoleImpl");
      return;
    }

    if (!summaryContext || !summaryContext.initiatorMessageId) {
      const rolesNeedingId = ['statusProcessingSystem', 'drawingMaster', 'closeUpMaster', 'novelSummaryMaster'];
      if(rolesNeedingId.includes(roleName)){
          _logAndDisplayError(`Cannot trigger ${roleName} for partition ${partitionId}: initiatorMessageId is missing in summaryContext. This is a critical error in flow logic.`, 'apiMainTriggerModule.sendSingleMessageForRoleImpl');
          return;
      }
    }
    await apiMainTriggerModule._sendGeminiRequestWithRetry(partitionId, roleName, roleType, targetRoleNameForTool, triggeringCharacterName, summaryContext, isAutoChainRequest);
  },

  triggerRoleResponse: (partitionId, roleName, triggeringCharacterName = null, passedSummaryContext = null, isAutoChainRequest = false) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config) return;
    const partition = chatroomDetails.partitions.get(partitionId);
    if (!partition) {
      _logAndDisplayError(`Cannot trigger response: Partition ${partitionId} not found.`, 'apiMainTriggerModule.triggerRoleResponse');
      return;
    }
    let roleType = 'unknown';
    let roleInAliases = (partition.roleAliases || []).find(alias => alias.name === roleName);
    let toolConfig = null;
    if (toolNameMap.hasOwnProperty(roleName)) {
      roleType = 'tool';
      toolConfig = stateModule.config.toolSettings[roleName];
      if (!toolConfig || !toolConfig.enabled) {
        if (roleName === 'drawingMaster' && triggeringCharacterName && chatroomDetails.roles.some(r => r.name === triggeringCharacterName && r.drawingTemplate)) {} else {
          return;
        }
      }
    } else {
      const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
      if (roleInAliases) {
        roleType = isPermanent ? 'role' : 'temporary_role';
      } else {
        return;
      }
    }

    let effectiveSummaryContext = passedSummaryContext || {};

    const isNewActionRequiringNewId = (roleType === 'role' || roleType === 'temporary_role' || ['gameHost', 'characterCreationMaster', 'characterUpdateMaster', 'scriptCreationMaster', 'privateAssistant', 'plotSummaryMaster', 'knowledgeRecordingMaster'].includes(roleName));

    if (isNewActionRequiringNewId) {
      effectiveSummaryContext.initiatorMessageId = uiChatUtilsModule._generateMessageId();
    } else if (!effectiveSummaryContext.initiatorMessageId) {
      _logAndDisplayError(`ID is missing for an action that requires an existing ID (e.g., status/drawing). Role: ${roleName}`, 'apiMainTriggerModule.triggerRoleResponse');
      return;
    }

    apiMainTriggerModule.sendSingleMessageForRoleImpl(partitionId, roleName, roleType, null, triggeringCharacterName, Object.keys(effectiveSummaryContext).length > 0 ? effectiveSummaryContext : null, isAutoChainRequest);
  },

  triggerCharacterUpdateForRole: (partitionId, targetRoleName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partition = chatroomDetails?.partitions?.get(partitionId);
    const roleInAliases = (partition?.roleAliases || []).some(alias => alias.name === targetRoleName);
    if (!partition || !roleInAliases) {
      _logAndDisplayError(`无法更新角色 ${targetRoleName}：不在分区 ${partitionId} 中。`, 'apiMainTriggerModule.triggerCharacterUpdateForRole');
      return;
    }
    const toolName = 'characterUpdateMaster';
    if (!stateModule.config.toolSettings[toolName]?.enabled) {
      return;
    }

    const summaryContext = {
      initiatorMessageId: uiChatUtilsModule._generateMessageId()
    };
    apiMainTriggerModule.sendSingleMessageForRoleImpl(partitionId, toolName, 'tool', null, targetRoleName, summaryContext, false);
  }
};