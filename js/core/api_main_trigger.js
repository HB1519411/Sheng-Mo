const apiMainTriggerModule = {
  _handleAutoPartitionSwitch: async (partitionId, roleName, isAutoChainRequest) => {},

  _sendGeminiRequestWithRetry: async (partitionId, roleName, roleType, targetRoleNameForTool = null, triggeringCharacterName = null, summaryContext = null, isAutoChainRequest = false) => {
    let placeholderElement = null;
    let effectiveInitiatorMessageId = summaryContext?.initiatorMessageId || uiChatUtilsModule._generateMessageId();

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

    try {
      const backendResponse = await apiServiceModule.performApiCall('/trigger-ai-response', 'POST', triggerInfo, {}, uiAbortController.signal);
      
      let result;

      if (backendResponse && backendResponse.is_frontend_proxy_request) {
        const { url, headers, body, responseSchemaParserJs, api_type } = backendResponse;
        
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
        const aiResponseJson = await frontendResponse.json();
        
        let textContent = null;
        if (api_type === 'openai' || api_type === 'deepseek') {
            textContent = aiResponseJson?.choices?.[0]?.message?.content;
        } else if (api_type === 'claude') {
            textContent = aiResponseJson?.content?.[0]?.text;
        } else {
            textContent = aiResponseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        }

          result = {
            success: true,
            data: {
                text_content: textContent || null,
                responseSchemaParserJs: responseSchemaParserJs
            }
        };
        if (!result.data.text_content) {
            throw new Error('Frontend proxy response invalid: No text content found.');
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
        if (placeholderElement) placeholderElement.remove();
      } else {
        if (placeholderElement) placeholderElement.remove();
        throw e; // Let the error explode loudly
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
    await apiMainTriggerModule._sendGeminiRequestWithRetry(partitionId, roleName, roleType, targetRoleNameForTool, triggeringCharacterName, summaryContext, isAutoChainRequest);
  },

  triggerRoleResponse: (partitionId, roleName, triggeringCharacterName = null, passedSummaryContext = null, isAutoChainRequest = false) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partition = chatroomDetails.partitions.get(partitionId);
    
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
    }

    apiMainTriggerModule.sendSingleMessageForRoleImpl(partitionId, roleName, roleType, null, triggeringCharacterName, Object.keys(effectiveSummaryContext).length > 0 ? effectiveSummaryContext : null, isAutoChainRequest);
  },

  triggerCharacterUpdateForRole: (partitionId, targetRoleName) => {
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