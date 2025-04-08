const uiChatModule = {
    ROLE_STATE_DEFAULT: '默',
    ROLE_STATE_ACTIVE: '活',
    ROLE_STATE_USER_CONTROL: '用',
    ROLE_STATE_UPDATE: '更',
    CHARACTER_SETTINGS_SEPARATOR: '\n--- CHARACTER_SETTINGS_START ---\n',
    _generateMessageId: () => {
        return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    },
    _parseAIResponse: (textContentString, roleName, roleType) => {
        let parserJsCode = '';
        const chatroomDetails = stateModule.currentChatroomDetails;
        let sectionType = (roleType === 'role' || roleType === 'temporary_role') ? 'general' : roleName;
        let useOverrideParser = false;

        if (chatroomDetails && chatroomDetails.config && chatroomDetails.config.overrideSettings && chatroomDetails.config.overrideSettings[sectionType]) {
            const overrideSection = chatroomDetails.config.overrideSettings[sectionType];
            if (overrideSection.enabled && overrideSection.responseSchemaParserJs && overrideSection.responseSchemaParserJs.trim() !== '') {
                parserJsCode = overrideSection.responseSchemaParserJs;
                useOverrideParser = true;
            }
        }

        if (!useOverrideParser) {
            if (roleType === 'tool' && stateModule.config.toolSettings[roleName]) {
                parserJsCode = stateModule.config.toolSettings[roleName].responseSchemaParserJs || '';
            } else if (roleType === 'role' || roleType === 'temporary_role') {
                parserJsCode = stateModule.config.responseSchemaParserJs || '';
            }
        }

        let parsedResult = null;
        let parserError = null;

        if (typeof textContentString !== 'string' || textContentString.trim() === '') {
            return { parsedResult: null, parserError: "No valid text content", rawText: textContentString };
        }

        if (parserJsCode) {
            try {
                const responseJsonMock = {
                    candidates: [{
                        content: {
                            parts: [{
                                text: textContentString
                            }]
                        }
                    }]
                };
                const parserFunction = new Function('responseJson', parserJsCode);
                parsedResult = parserFunction(responseJsonMock);
                if (parsedResult && typeof parsedResult === 'object' && parsedResult.error) {
                    parserError = parsedResult.error;
                    parsedResult = null;
                } else if (parsedResult === null || parsedResult === undefined) {
                    parserError = 'Parser returned null/undefined';
                    parsedResult = null;
                }
            } catch (e) {
                 parserError = `Error executing parser: ${e.message}`;
                 parsedResult = null;
            }
        } else {
             parserError = `Parser not defined for ${roleName}`;
             parsedResult = null;
             try {
                 const regexMatch = textContentString.match(/\{[\s\S]*\}/);
                 if (regexMatch && regexMatch[0]) {
                     parsedResult = JSON.parse(regexMatch[0]);
                     parserError = null;
                 } else {
                     parserError += " and could not extract fallback JSON.";
                 }
             } catch(fallbackError){
                  parserError += ` and fallback JSON parsing failed: ${fallbackError.message}`;
                  parsedResult = null;
             }
        }

        if (parserError && parsedResult === null && (roleType === 'role' || roleType === 'temporary_role')) {
             parsedResult = { formattedText: textContentString, nextRoleToAct: null };
             parserError = null;
        }

        return { parsedResult, parserError, rawText: textContentString };
    },
     _formatCharacterUpdateMasterDisplay: (parsedResult) => {
        if (!parsedResult || typeof parsedResult !== 'object') {
            return "[无法格式化角色更新：无效的解析结果]";
        }
        return parsedResult.formattedUpdate || "[角色更新：缺少 formattedUpdate 字段]";
     },
     _getFormattedDisplayText: (parsedResult, roleType, roleName, parserError) => {
        if (parserError && !parsedResult) {
            return `[${roleName} 解析错误: ${parserError}]`;
        }
        if (!parsedResult) {
             return "[无法格式化: 无解析结果]";
        }
        if (roleType === 'role' || roleType === 'temporary_role') {
             return parsedResult.formattedText || (typeof parsedResult === 'string' ? parsedResult : "[角色/临时角色: 无有效文本]");
        } else if (roleType === 'tool') {
            if (roleName === 'writingMaster') {
                 return parsedResult.description || (typeof parsedResult === 'string' ? parsedResult : "[写作大师: 无描述]");
            } else if (roleName === 'gameHost') {
                 return '';
            } else if (roleName === 'drawingMaster') {
                 return "[图片绘制]";
            } else if (roleName === 'characterUpdateMaster') {
                 return parsedResult.formattedUpdate || "[角色更新: 无格式化文本]";
            } else if (roleName === 'privateAssistant') {
                 return parsedResult.responseContent || "[私人助理: 无响应内容]";
            } else {
                return parsedResult.text || (typeof parsedResult === 'string' ? JSON.stringify(parsedResult) : JSON.stringify(parsedResult)) || `[未知工具: ${roleName}]`;
            }
        } else {
            return "[未知角色类型]";
        }
    },
    _appendMessageAndScroll: (messageObject) => {
        const messageElement = uiChatModule.displayChatMessageElement(messageObject);
        if (!messageElement) {
            _logAndDisplayError("Failed to create message element from object: " + JSON.stringify(messageObject), '_appendMessageAndScroll');
            return null;
        }
        elementsModule.chatArea.appendChild(messageElement);
        updateChatContextCache();
        return messageElement;
    },
    _handlePostResponseActions: async (messageContainer, roleName, roleType, parsedResult, parserError, targetRoleName = null) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (roleName === 'gameHost') {
            if (messageContainer) {
                const messageId = messageContainer.dataset.messageId;
                const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
                if (messageObject) {
                     uiChatModule._renderGameHostContent(messageContainer, messageObject.activeView || 'time');
                }
            }
            if (!parserError && parsedResult && chatroomDetails) {
                 const updatedCharName = parsedResult.processedCharacterInfo?.characterName;
                 if (updatedCharName) {
                     const charInfo = parsedResult.processedCharacterInfo;
                     const formatItemsToText = (items) => Array.isArray(items) ? items.join(', ') : (items || '无');
                     let charDetailText = '';
                     charDetailText += `Demeanor: ${formatItemsToText(charInfo.demeanorItems)}\n`;
                     charDetailText += `Outerwear: ${formatItemsToText(charInfo.outerwearItems)}\n`;
                     charDetailText += `Underwear: ${formatItemsToText(charInfo.underwearItems)}\n`;
                     charDetailText += `Accessories: ${formatItemsToText(charInfo.accessories)}\n`;
                     charDetailText += `Short Status: ${formatItemsToText(charInfo.shortTermStatusItems)}\n`;
                     charDetailText += `Long Status: ${formatItemsToText(charInfo.longTermStatusItems)}\n`;
                     charDetailText += `Pose: ${formatItemsToText(charInfo.actionPoseItems)}\n`;
                     charDetailText += `Action: ${formatItemsToText(charInfo.currentActionItems)}\n`;
                     charDetailText += `Other Status: ${formatItemsToText(charInfo.otherCharacterStatusItems)}`;
                     if (!chatroomDetails.config.roleDetailedStates) chatroomDetails.config.roleDetailedStates = {};
                     chatroomDetails.config.roleDetailedStates[updatedCharName] = `${updatedCharName}：\n${charDetailText.trim()}`;
                     apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
                    const roleData = chatroomDetails.roles.find(r => r.name === updatedCharName);
                    const drawingTemplate = roleData?.drawingTemplate;
                    const drawingMasterEnabled = stateModule.config.toolSettings.drawingMaster?.enabled;
                    if (drawingTemplate && drawingTemplate.trim() !== '' && drawingMasterEnabled) {
                         await updateChatContextCache();
                         apiModule.triggerRoleResponse('drawingMaster', updatedCharName);
                    }
                }
                const addRoles = parsedResult.addRoles || [];
                const removeRoles = parsedResult.removeRoles || [];
                let roleStatesChanged = false;
                if (Array.isArray(addRoles)) {
                     for (const nameToAdd of addRoles) {
                         try {
                             if (typeof nameToAdd !== 'string' || nameToAdd.trim() === '') continue;
                             const trimmedName = nameToAdd.trim();
                             if (trimmedName === "管理员") continue;
                             const roleStates = chatroomDetails.config.roleStates || {};
                             if (roleStates[trimmedName] !== undefined) {
                                 await uiChatModule.selectRoleState(trimmedName, uiChatModule.ROLE_STATE_ACTIVE);
                                 roleStatesChanged = true;
                             const isPermanent = chatroomDetails.roles.some(r => r.name === trimmedName);
                             if (isPermanent) {
                                 if (!chatroomDetails.config.roleVisibility) {
                                     chatroomDetails.config.roleVisibility = {};
                                 }
                                 if (chatroomDetails.config.roleVisibility[trimmedName] !== true) {
                                     chatroomDetails.config.roleVisibility[trimmedName] = true;
                                     apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
                                     uiChatModule.updateRoleButtonsList();
                                     if (document.getElementById('role-list-page')?.classList.contains('active')) {
                                         uiSettingsModule.updateChatroomRolePage();
                                     }
                                 }
                             }
                             } else {
                                  const added = await uiChatModule.addTemporaryRole(trimmedName);
                                  if (added) {
                                      await uiChatModule.selectRoleState(trimmedName, uiChatModule.ROLE_STATE_ACTIVE);
                                      uiChatModule.updateRoleButtonsList();
                                      roleStatesChanged = true;
                                  }
                             }
                         } catch (addError) {
                             _logAndDisplayError(`Error adding/activating role '${nameToAdd}' from game host: ${addError.message}`, '_handlePostResponseActions');
                         }
                     }
                }
                 if (Array.isArray(removeRoles)) {
                     for (const nameToRemove of removeRoles) {
                         try {
                             if (typeof nameToRemove !== 'string' || nameToRemove.trim() === '') continue;
                             const trimmedName = nameToRemove.trim();
                             if (trimmedName === "管理员") continue;
                             const roleStates = chatroomDetails.config.roleStates || {};
                             if (roleStates[trimmedName] !== undefined) {
                                 const isPermanent = chatroomDetails.roles.some(r => r.name === trimmedName);
                                 if (isPermanent) {
                                     await uiChatModule.selectRoleState(trimmedName, uiChatModule.ROLE_STATE_DEFAULT);
                                 } else {
                                      await uiChatModule.deleteTemporaryRole(trimmedName, false);
                                 }
                                 roleStatesChanged = true;
                             }
                         } catch (removeError) {
                             _logAndDisplayError(`Error removing/deactivating role '${nameToRemove}' from game host: ${removeError.message}`, '_handlePostResponseActions');
                         }
                     }
                 }
                 let nextRoleToAct = parsedResult?.nextRoleToAct;
                 if (roleStatesChanged || nextRoleToAct) {
                     await updateChatContextCache();
                 }
                 if (nextRoleToAct && chatroomDetails && chatroomDetails.config.roleStates) {
                     const targetRoleState = chatroomDetails.config.roleStates[nextRoleToAct];
                     if (targetRoleState !== undefined) {
                         if (targetRoleState === uiChatModule.ROLE_STATE_ACTIVE) {
                             apiModule.triggerRoleResponse(nextRoleToAct);
                         } else if (targetRoleState === uiChatModule.ROLE_STATE_USER_CONTROL) {
                             uiChatModule.setPauseState(true);
                             uiChatModule._removePendingActionButton();
                             uiChatModule._createPendingActionButton(nextRoleToAct);
                         }
                     } else {
                         _logAndDisplayError(`Role ${roleName} specified next role ${nextRoleToAct}, but it was not found in the room's role states.`, '_handlePostResponseActions');
                     }
                 }
            }
        } else if ((roleType === 'role' || roleType === 'temporary_role') && !parserError) {
             let nextRoleToAct = parsedResult?.nextRoleToAct;
             let shouldTriggerGameHost = stateModule.config.toolSettings.gameHost?.enabled;
             if (shouldTriggerGameHost || nextRoleToAct) {
                 await updateChatContextCache();
             }
             if (shouldTriggerGameHost) {
                 apiModule.triggerRoleResponse('gameHost');
             }
            if (nextRoleToAct && chatroomDetails && chatroomDetails.config.roleStates) {
                 const targetRoleState = chatroomDetails.config.roleStates[nextRoleToAct];
                 if (targetRoleState !== undefined) {
                     if (targetRoleState === uiChatModule.ROLE_STATE_ACTIVE) {
                         apiModule.triggerRoleResponse(nextRoleToAct);
                     } else if (targetRoleState === uiChatModule.ROLE_STATE_USER_CONTROL) {
                         uiChatModule.setPauseState(true);
                         uiChatModule._removePendingActionButton();
                         uiChatModule._createPendingActionButton(nextRoleToAct);
                     }
                 } else {
                     _logAndDisplayError(`Role ${roleName} specified next role ${nextRoleToAct}, but it was not found in the room's role states.`, '_handlePostResponseActions');
                 }
            }
        } else if (roleName === 'drawingMaster' && parsedResult && !parserError) {
            const rawJsonText = messageContainer?.dataset?.rawJsonText || JSON.stringify(parsedResult || {});
            try {
                 const naiPayload = await apiModule._prepareNovelAiPayload(parsedResult, rawJsonText);
                 if (naiPayload) {
                     const messageId = messageContainer ? messageContainer.dataset.messageId : null;
                     apiModule.addNaiRequestToQueue(naiPayload, messageId);
                 }
            } catch (e) {
                 _logAndDisplayError(`Error preparing or queuing NovelAI request: ${e.message}`, '_handlePostResponseActions');
            }
         } else if (roleName === 'characterUpdateMaster' && parsedResult && !parserError) {
             const characterNameMatch = parsedResult.formattedUpdate?.match(/--- 更新后记忆 \((.*?)\) ---/);
             const characterName = characterNameMatch ? characterNameMatch[1] : null;
             if (characterName && chatroomDetails && chatroomDetails.config.roleDetailedStates) {
             } else if (!characterName) {
                  _logAndDisplayError(`CharacterUpdateMaster failed to find target character name in formattedUpdate`, '_handlePostResponseActions');
             }
         }
        uiChatModule.updateChatroomHistoryDisplay();
        uiChatModule.triggerDebouncedHistorySave();
    },
    displayAIResponse: (responseData, roleName, targetRoleName = null) => {
        const timestamp = Date.now();
        let roleType = 'unknown';
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (roleName && toolNameMap.hasOwnProperty(roleName)) {
            roleType = 'tool';
        } else if (chatroomDetails && roleName && chatroomDetails.config?.roleStates && (roleName in chatroomDetails.config.roleStates)) {
             const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
             roleType = isPermanent ? 'role' : 'temporary_role';
        }
        if (roleType === 'unknown') {
             _logAndDisplayError(`Could not determine role type for ${roleName} in displayAIResponse.`, 'displayAIResponse');
             return;
        }

        let messageObject;
        let messageContainer = null;
        let parsedResult = null;
        let parserError = null;
        let rawJson = responseData.text_content || '';
        if (responseData.error) {
            _logAndDisplayError(`Backend error for ${roleName}: ${responseData.error}`, 'displayAIResponse');
             return;
        } else if (roleName !== 'drawingMaster') {
            const msgId = uiChatModule._generateMessageId();
            const parseOutput = uiChatModule._parseAIResponse(rawJson, roleName, roleType);
            parsedResult = parseOutput.parsedResult;
            parserError = parseOutput.parserError;

            if (roleName === 'privateAssistant' && parserError) {
                 _logAndDisplayError(`Parser error for privateAssistant (will be retried): ${parserError}`, 'displayAIResponse');
                 return;
            }
            const formattedTextForHistory = uiChatModule._getFormattedDisplayText(parsedResult, roleType, roleName, parserError);
            messageObject = {
                id: msgId,
                timestamp: timestamp,
                sourceType: 'ai',
                roleName: roleName,
                roleType: roleType,
                targetRoleName: targetRoleName,
                speechActionText: formattedTextForHistory,
                rawJson: rawJson,
                parsedResult: parsedResult,
                displayMode: 'formatted',
                parserError: parserError,
                activeView: roleName === 'gameHost' ? 'time' : undefined
            };
            stateModule.currentChatHistoryData.push(messageObject);
            messageContainer = uiChatModule._appendMessageAndScroll(messageObject);
        } else {
             const parseOutput = uiChatModule._parseAIResponse(rawJson, roleName, roleType);
             parsedResult = parseOutput.parsedResult;
             parserError = parseOutput.parserError;
             if (parserError && parsedResult === null) {
                 _logAndDisplayError(`Drawing Master response parsing error: ${parserError}`, 'displayAIResponse');
             }
             apiModule._prepareNovelAiPayload(parsedResult, rawJson).then(naiPayload => {
                 if (naiPayload) {
                     apiModule.addNaiRequestToQueue(naiPayload);
                 }
             }).catch(e => {
                  _logAndDisplayError(`Error preparing or queuing NovelAI request: ${e.message}`, 'displayAIResponse');
             });
             return;
        }
        uiChatModule._handlePostResponseActions(messageContainer, roleName, roleType, parsedResult, parserError, targetRoleName);
    },
    formatStateObjectToText: (stateObj) => {
        if (!stateObj || typeof stateObj !== 'object') return '[Invalid state object]';
        let text = '';
        for (const key in stateObj) {
            if (stateObj.hasOwnProperty(key)) {
                 let value = stateObj[key];
                 if (typeof value === 'object' && value !== null) {
                      try { value = JSON.stringify(value); } catch(e) { value = '[Cannot serialize object]'; }
                 }
                 text += `${key}: ${value}\n`;
            }
        }
        return text.trim() || '[Empty state object]';
    },
    _createRoleNameButtonElement: (roleName, sourceType, messageContainer) => {
        const roleNameButton = document.createElement('div');
        roleNameButton.className = 'std-button role-name-button-above-bubble';
        let buttonText = '';
        if (roleName === 'privateAssistant') { buttonText = '‍💼'; }
        else if (roleName === 'characterUpdateMaster') { buttonText = '📇'; }
        else if (roleName === 'gameHost') { buttonText = '🎲'; }
        else if (roleName === 'drawingMaster') { buttonText = '🎨'; }
        else if (roleName === 'writingMaster') { buttonText = '🖋️'; }
        else if (roleName === '管理员') { buttonText = '📏'; }
        else {
            const bottomButton = uiChatModule.findBottomRoleButton(roleName);
            buttonText = bottomButton ? bottomButton.textContent : (roleName ? roleName.charAt(0).toUpperCase() : (sourceType === 'user' ? 'U' : 'AI'));
        }
        roleNameButton.textContent = buttonText;
        return roleNameButton;
    },
    _createMessageActionsElement: (sourceType, roleType, roleName, messageContainer) => {
        const messageActionsContainer = document.createElement('div');
        messageActionsContainer.className = 'message-actions-container';
        if (sourceType === 'ai') {
            const toggleButton = document.createElement('div');
            toggleButton.className = 'std-button message-action-button toggle-raw-button';
            toggleButton.textContent = '🔄';
            messageActionsContainer.appendChild(toggleButton);

            const messageId = messageContainer.dataset.messageId;
            const hasImage = stateModule.tempImageUrls[messageId];
            if (roleName === 'drawingMaster' && hasImage) {
                const redrawButton = document.createElement('div');
                redrawButton.className = 'std-button message-action-button redraw-button';
                redrawButton.textContent = '🖌️';
                messageActionsContainer.appendChild(redrawButton);
            }
            if (roleName === 'characterUpdateMaster') {
                const saveButton = document.createElement('div');
                saveButton.className = 'std-button message-action-button save-character-update-button';
                saveButton.textContent = '💾';
                messageActionsContainer.appendChild(saveButton);
            }
        }
        const deleteButton = document.createElement('div');
        deleteButton.className = 'std-button message-action-button delete-button';
        deleteButton.textContent = '✕';
        messageActionsContainer.appendChild(deleteButton);
        return messageActionsContainer;
    },
    _handleGameHostViewChange: (event) => {
         const button = event.currentTarget;
         const messageContainer = button.closest('.message-container');
         const viewToShow = button.dataset.view;
         if (!messageContainer || !viewToShow) return;
         const messageId = messageContainer.dataset.messageId;
         const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
         if (!messageObject) return;
         messageObject.activeView = viewToShow;
         uiChatModule._renderGameHostContent(messageContainer, viewToShow);
         uiChatModule.triggerDebouncedHistorySave();
    },
     _createValueBlock: (value) => {
         if (value === null || value === undefined || value === '' || value === '无') return '';
         const span = document.createElement('span');
         span.className = 'value-block';
         span.textContent = String(value);
         return span.outerHTML;
     },
    _formatGameHostContent: (parsedResult, view) => {
        const createBlock = uiChatModule._createValueBlock;
        let content = '';
        if (!parsedResult || typeof parsedResult !== 'object' || !parsedResult.processedSceneContext || !parsedResult.processedCharacterInfo) {
            return createBlock('[Invalid Data Format]');
        }
        const scene = parsedResult.processedSceneContext;
        const charInfo = parsedResult.processedCharacterInfo;
        const icons = {
             map: '🗺️', people: '👥', name: '✨', demeanor: '😐', clothing: '👕', underwear: '👙',
             accessories: '💍', pose: '🤸', statusLong: '⚕️', statusShort: '🩹', action: '⚡',
             sceneOther: 'ℹ️', charOther: '📝'
        };

        const renderItems = (items, icon = '') => {
            if (!Array.isArray(items) || items.length === 0) return '';
            let itemHTML = '';
            items.forEach(item => { itemHTML += createBlock(item); });
            return `<div>${icon ? `<span class="icon">${icon}</span>` : ''}${itemHTML}</div>`;
        };

        switch (view) {
            case 'time':
                content = renderItems(scene.timeItems, '');
                break;
            case 'location':
                content += renderItems(scene.locationItems, icons.map);
                content += renderItems(scene.characterPositionItems, icons.people);
                content += renderItems(scene.otherSceneInfoItems, icons.sceneOther);
                break;
            case 'character':
                 if (!charInfo) {
                     content = `<div>${createBlock('[Character Info Unavailable]')}</div>`;
                     break;
                 }
                 content += `<div><span class="icon">${icons.name}</span>${createBlock(charInfo.characterName || '[Unknown Name]')}</div>`;
                 content += renderItems(charInfo.demeanorItems, icons.demeanor);
                 content += renderItems(charInfo.outerwearItems, icons.clothing);
                 content += renderItems(charInfo.underwearItems, icons.underwear);
                 content += renderItems(charInfo.accessories, icons.accessories);
                 content += renderItems(charInfo.actionPoseItems, icons.pose);
                 content += renderItems(charInfo.shortTermStatusItems, icons.statusShort);
                 content += renderItems(charInfo.longTermStatusItems, icons.statusLong);
                 content += renderItems(charInfo.currentActionItems, icons.action);
                 content += renderItems(charInfo.otherCharacterStatusItems, icons.charOther);
                 break;
            default:
                content = `<div>${createBlock('[Unknown View]')}</div>`;
        }
        return content || `<div>${createBlock('[No relevant data]')}</div>`;
    },
    _renderGameHostContent: (messageContainer, viewToShow) => {
         const contentDiv = messageContainer.querySelector('.game-host-content');
         const controlsDiv = messageContainer.querySelector('.game-host-controls');

         if (!contentDiv || !controlsDiv) return;
         const messageId = messageContainer.dataset.messageId;
         const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
         if (!messageObject || messageObject.parserError || !messageObject.parsedResult?.processedSceneContext || !messageObject.parsedResult?.processedCharacterInfo) {
              contentDiv.innerHTML = uiChatModule._createValueBlock(messageObject?.parserError ? `[Parse Error: ${messageObject.parserError}]` : "[Cannot load data]");
              controlsDiv.querySelectorAll('.game-host-view-button').forEach(btn => btn.classList.remove('active'));
              return;
         }

         const formattedContent = uiChatModule._formatGameHostContent(messageObject.parsedResult, viewToShow);
         contentDiv.innerHTML = formattedContent;
         messageContainer.dataset.activeView = viewToShow;


         controlsDiv.querySelectorAll('.game-host-view-button').forEach(btn => {
             btn.classList.toggle('active', btn.dataset.view === viewToShow);
         });
    },
    showImageViewer: (imageSrc) => {
        if (!imageSrc || !elementsModule.imageViewerPage || !elementsModule.imageViewerContent) {
            return;
        }
        elementsModule.imageViewerContent.src = imageSrc;
        elementsModule.imageViewerPage.classList.add('active');
    },
    hideImageViewer: () => {
        if (!elementsModule.imageViewerPage || !elementsModule.imageViewerContent) {
             return;
        }
        elementsModule.imageViewerPage.classList.remove('active');
        elementsModule.imageViewerContent.src = '';
    },
    handleSetBackgroundClick: (event) => {
         const button = event.target.closest('.set-background-button');
         if (!button) return;
         const msgCont = button.closest('.message-container');
         if (!msgCont) return;
         const messageId = msgCont.dataset.messageId;
         const imageUrl = stateModule.tempImageUrls[messageId];
         const activeRoomName = stateModule.config.activeChatRoomName;
         if (!activeRoomName) {
             _logAndDisplayError("Cannot set background, no active chatroom.", "handleSetBackgroundClick");
             return;
         }
         if (imageUrl) {
             apiModule.setBackgroundImage(activeRoomName, imageUrl);
             uiChatModule.hideAllMessageActions();
         } else if (!imageUrl) {
              _logAndDisplayError("Cannot set background, image URL not found.", "handleSetBackgroundClick");
         }
    },
    handleDownloadImageLongPress: (event) => {
         const button = event.target.closest('.set-background-button');
         if (!button) return;
         const msgCont = button.closest('.message-container');
         if (!msgCont) return;
         const messageId = msgCont.dataset.messageId;
         const imageUrl = stateModule.tempImageUrls[messageId];
         if (imageUrl) {
             const a = document.createElement('a');
             a.href = imageUrl;
             a.download = `nai-image-${messageId}.png`;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             uiChatModule.hideAllMessageActions();
         } else {
              _logAndDisplayError("Cannot download, image URL not found.", "handleDownloadImageLongPress");
         }
    },
    handleRedrawClick: async (msgCont) => {
        const messageId = msgCont.dataset.messageId;
        if (!messageId) return;
        const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
        if (!messageObject || messageObject.roleName !== 'drawingMaster') {
            _logAndDisplayError(`Cannot redraw: Message ${messageId} not found or not a Drawing Master message.`, 'handleRedrawClick');
            return;
        }
        const rawJson = messageObject.rawJson;
        if (!rawJson) {
             _logAndDisplayError(`Cannot redraw: Raw JSON not found for message ${messageId}.`, 'handleRedrawClick');
             return;
        }
        const { parsedResult, parserError } = uiChatModule._parseAIResponse(rawJson, 'drawingMaster', 'tool');
        if (parserError) {
             _logAndDisplayError(`Failed to re-parse for redraw: ${parserError}`, 'handleRedrawClick');
             return;
        }
        try {
            const naiPayload = await apiModule._prepareNovelAiPayload(parsedResult, rawJson);
            if (naiPayload) {
                apiModule.addNaiRequestToQueue(naiPayload, messageId);
            }
        } catch (e) {
            _logAndDisplayError(`Error preparing redraw request: ${e.message}`, 'handleRedrawClick');
        } finally {
            uiChatModule.hideAllMessageActions();
        }
    },
    displayChatMessageElement: (messageObject) => {
        if (!messageObject || !messageObject.id) {
            return null;
        }
        const {
            id, timestamp, sourceType, roleName, roleType, targetRoleName,
            speechActionText, rawJson, parsedResult, displayMode, parserError, activeView, naiPayloadSource
        } = messageObject;
        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container`;
        messageContainer.dataset.messageId = id;
        messageContainer.dataset.displayMode = displayMode || 'formatted';
        messageContainer.dataset.roleName = roleName || '';
        if (targetRoleName) messageContainer.dataset.targetRoleName = targetRoleName;
        messageContainer.dataset.sourceType = sourceType;
        messageContainer.dataset.roleType = roleType;
        const currentActiveView = activeView || (roleName === 'gameHost' ? 'time' : undefined);
        if (currentActiveView) messageContainer.dataset.activeView = currentActiveView;
        if (naiPayloadSource && typeof naiPayloadSource === 'object') messageContainer.dataset.naiPayloadSource = JSON.stringify(naiPayloadSource);
        else if (naiPayloadSource) messageContainer.dataset.naiPayloadSource = naiPayloadSource;
        if (rawJson) messageContainer.dataset.rawJsonText = rawJson;
        const roleNameButton = uiChatModule._createRoleNameButtonElement(roleName, sourceType, messageContainer);
        messageContainer.appendChild(roleNameButton);
        const messageDiv = document.createElement('div');
        messageDiv.className = sourceType === 'user' ? 'user-message' : 'ai-response';
        const isGameHost = roleName === 'gameHost' && sourceType === 'ai';
        const isDrawingMaster = roleName === 'drawingMaster' && sourceType === 'ai';
        const isPrivateAssistant = roleName === 'privateAssistant' && sourceType === 'ai';
        const isCharacterUpdateMaster = roleName === 'characterUpdateMaster' && sourceType === 'ai';
        const isStandardRole = (roleType === 'role' || roleType === 'temporary_role') && sourceType === 'ai';
        let hasImage = false;
        let formattedTextToDisplay = speechActionText;
        if (parsedResult) {
             if (isStandardRole && parsedResult.formattedText) formattedTextToDisplay = parsedResult.formattedText;
             else if (isCharacterUpdateMaster && parsedResult.formattedUpdate) formattedTextToDisplay = parsedResult.formattedUpdate;
             else if (isPrivateAssistant && parsedResult.responseContent) formattedTextToDisplay = parsedResult.responseContent;
        }
        if (isGameHost) {
             messageDiv.innerHTML = '';
             const controlsDiv = document.createElement('div');
             controlsDiv.className = 'game-host-controls';
             ['time', 'location', 'character'].forEach(view => {
                 const btn = document.createElement('div');
                 btn.className = 'std-button game-host-view-button';
                 btn.dataset.view = view;
                 btn.textContent = view === 'time' ? '🕒' : (view === 'location' ? '📍' : '👤');
                 btn.addEventListener('click', uiChatModule._handleGameHostViewChange);
                 controlsDiv.appendChild(btn);
             });
             messageDiv.appendChild(controlsDiv);
             const contentDiv = document.createElement('div');
             contentDiv.className = 'game-host-content';
             messageDiv.appendChild(contentDiv);
             const rawDiv = document.createElement('div');
             rawDiv.className = 'game-host-raw';
             rawDiv.style.display = 'none';
             rawDiv.textContent = rawJson || '';
             messageDiv.appendChild(rawDiv);
             if (displayMode === 'raw') {
                 controlsDiv.style.display = 'none';
                 contentDiv.style.display = 'none';
                 rawDiv.style.display = 'block';
             } else {
                 uiChatModule._renderGameHostContent(messageContainer, currentActiveView);
             }
        } else if (isDrawingMaster) {
             const imageUrl = stateModule.tempImageUrls[id];
             if (imageUrl) {
                 const img = document.createElement('img');
                 img.src = imageUrl;
                 img.alt = formattedTextToDisplay || "[AI Generated Image]";
                 img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                 messageDiv.innerHTML = '';
                 messageDiv.appendChild(img);
                 hasImage = true;
             } else {
                 messageDiv.textContent = formattedTextToDisplay || "[Image Loading or Error]";
             }
        } else if (displayMode === 'raw' && sourceType === 'ai') {
             messageDiv.textContent = rawJson || '';
        } else {
             messageDiv.textContent = formattedTextToDisplay;
        }
        messageContainer.appendChild(messageDiv);
        const messageActionsContainer = uiChatModule._createMessageActionsElement(sourceType, roleType, roleName, messageContainer);
        if (hasImage && messageActionsContainer) {
             let backgroundButton = messageActionsContainer.querySelector('.set-background-button');
             if (!backgroundButton) {
                 backgroundButton = document.createElement('div');
                 backgroundButton.className = 'std-button message-action-button set-background-button';
                 backgroundButton.textContent = '🖼️';
                 const redrawBtn = messageActionsContainer.querySelector('.redraw-button');
                 if(redrawBtn) {
                      messageActionsContainer.insertBefore(backgroundButton, redrawBtn);
                 } else {
                      const deleteBtn = messageActionsContainer.querySelector('.delete-button');
                      if(deleteBtn) {
                          messageActionsContainer.insertBefore(backgroundButton, deleteBtn);
                      } else {
                           messageActionsContainer.appendChild(backgroundButton);
                      }
                 }
             }
        }
        messageContainer.appendChild(messageActionsContainer);
        return messageContainer;
    },
     toggleRawJsonDisplay: (msgCont) => {
         const messageId = msgCont.dataset.messageId;
         if (msgCont.dataset.sourceType !== 'ai' || !messageId) return;
         const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
         if (messageIndex === -1) {
             _logAndDisplayError(`Cannot find message data for ID ${messageId} during toggleRawJsonDisplay.`, 'toggleRawJsonDisplay');
             return;
         }
         const messageObject = stateModule.currentChatHistoryData[messageIndex];
         const roleName = messageObject.roleName;
         const isGameHost = roleName === 'gameHost';
         const isDrawingMaster = roleName === 'drawingMaster';
         const div = msgCont.querySelector('.ai-response');
         if (!div) return;
         const currentMode = messageObject.displayMode;
         const rawTextContent = messageObject.rawJson || '';
         if (currentMode === 'formatted') {
             messageObject.displayMode = 'raw';
             msgCont.dataset.displayMode = 'raw';
             if (isGameHost) {
                  const controlsDiv = div.querySelector('.game-host-controls');
                  const contentDiv = div.querySelector('.game-host-content');
                  const rawDiv = div.querySelector('.game-host-raw');
                  if (controlsDiv) controlsDiv.style.display = 'none';
                  if (contentDiv) contentDiv.style.display = 'none';
                  if (rawDiv) {
                      rawDiv.textContent = rawTextContent;
                      rawDiv.style.display = 'block';
                  }
             } else {
                 div.textContent = rawTextContent;
             }
         } else {
             messageObject.displayMode = 'formatted';
             msgCont.dataset.displayMode = 'formatted';
             const parsedResult = messageObject.parsedResult;
             const parserError = messageObject.parserError;
             const formattedText = uiChatModule._getFormattedDisplayText(parsedResult, messageObject.roleType, roleName, parserError);
             if (isGameHost) {
                  const controlsDiv = div.querySelector('.game-host-controls');
                  const contentDiv = div.querySelector('.game-host-content');
                  const rawDiv = div.querySelector('.game-host-raw');
                  if (controlsDiv) controlsDiv.style.display = 'flex';
                  if (contentDiv) contentDiv.style.display = '';
                  if (rawDiv) rawDiv.style.display = 'none';
                  uiChatModule._renderGameHostContent(msgCont, messageObject.activeView || 'time');
             } else if (isDrawingMaster) {
                  const imageUrl = stateModule.tempImageUrls[messageId];
                  if (imageUrl) {
                      const img = document.createElement('img');
                      img.src = imageUrl;
                      img.alt = formattedText || "[AI Generated Image]";
                      img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                      div.innerHTML = '';
                      div.appendChild(img);
                  } else {
                      div.textContent = formattedText || "[Image Loading or Error]";
                  }
             } else {
                   div.textContent = formattedText;
             }
         }
         updateChatContextCache();
         uiChatModule.triggerDebouncedHistorySave();
     },
    findBottomRoleButton: (roleName) => {
        if (!roleName) return null;
        const btns = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container > .std-button');
        for (const btn of btns) {
            if (btn.dataset.roleName === roleName) return btn;
        }
        return null;
    },
    toggleMessageActions: (msgCont) => {
        const ac = msgCont.querySelector('.message-actions-container');
        if (ac) {
            if (stateModule.activeMessageActions === msgCont) {
                ac.classList.remove('active');
                stateModule.activeMessageActions = null;
            } else {
                uiChatModule.hideAllMessageActions();
                ac.classList.add('active');
                stateModule.activeMessageActions = msgCont;
            }
        }
    },
    hideAllMessageActions: () => {
        if (stateModule.activeMessageActions) {
            const ac = stateModule.activeMessageActions.querySelector('.message-actions-container');
            if (ac) ac.classList.remove('active');
            stateModule.activeMessageActions = null;
        }
    },
    toggleMessageEditMode: (msgCont) => {
        const div = msgCont.querySelector('.user-message') || msgCont.querySelector('.ai-response');
        const roleName = msgCont.dataset.roleName;
        const isGameHost = roleName === 'gameHost';
        const isCharacterUpdateMaster = roleName === 'characterUpdateMaster';
        const displayMode = msgCont.dataset.displayMode;
        if (!div) return;
        let targetElement = div;
        let isEditingRaw = false;
        if (isGameHost && displayMode !== 'raw') {
             return;
        } else if (isGameHost && displayMode === 'raw') {
             targetElement = msgCont.querySelector('.game-host-raw');
             if (!targetElement) targetElement = div;
             isEditingRaw = true;
        } else if (roleName === 'drawingMaster' && displayMode === 'formatted') {
             return;
        } else if (displayMode === 'raw' && msgCont.dataset.sourceType === 'ai') {
             isEditingRaw = true;
        }
        const isEditing = targetElement.getAttribute('contenteditable') === 'true';
        const messageId = msgCont.dataset.messageId;
        if (isEditing) {
            targetElement.removeAttribute('contenteditable');
            targetElement.style.backgroundColor = '';
             if (targetElement._blurHandler) targetElement.removeEventListener('blur', targetElement._blurHandler);
             if (targetElement._keydownHandler) targetElement.removeEventListener('keydown', targetElement._keydownHandler);
             delete targetElement._blurHandler;
             delete targetElement._keydownHandler;
            if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
            uiChatModule.saveEditedMessage(msgCont);
        } else {
             const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
             if (messageIndex === -1) {
                 targetElement.textContent = "[Cannot load content for editing]";
                 _logAndDisplayError(`Cannot find message data for ID ${messageId} during toggleMessageEditMode.`, 'toggleMessageEditMode');
                 return;
             }
            const messageObject = stateModule.currentChatHistoryData[messageIndex];
            uiChatModule.hideAllMessageActions();
            let editText = '';
            if (isEditingRaw) {
                editText = messageObject.rawJson || '';
            } else if (isCharacterUpdateMaster) {
                 editText = messageObject.parsedResult?.formattedUpdate || messageObject.speechActionText || '';
            } else {
                 editText = messageObject.speechActionText || '';
            }

            targetElement.innerText = editText;
            targetElement.setAttribute('contenteditable', 'true');
            targetElement.style.backgroundColor = '#FFFFFF';
            targetElement.focus();
            try { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(targetElement); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); } catch(e) {}
            const blurH = () => uiChatModule.saveEditedMessage(msgCont);
            const keydownH = (e) => uiChatModule.handleEnterKeyInEditMode(e, msgCont);
            if (targetElement._blurHandler) targetElement.removeEventListener('blur', targetElement._blurHandler);
            if (targetElement._keydownHandler) targetElement.removeEventListener('keydown', targetElement._keydownHandler);
            targetElement.addEventListener('blur', blurH);
            targetElement.addEventListener('keydown', keydownH);
            targetElement._blurHandler = blurH;
            targetElement._keydownHandler = keydownH;
            stateModule.editingMessageContainer = msgCont;
        }
    },
    handleEnterKeyInEditMode: (e, msgCont) => {
    },
    saveEditedMessage: (msgCont) => {
        if (!msgCont) return;
        const roleName = msgCont.dataset.roleName;
        const roleType = msgCont.dataset.roleType;
        const sourceType = msgCont.dataset.sourceType;
        const isGameHost = roleName === 'gameHost';
        const isCharacterUpdateMaster = roleName === 'characterUpdateMaster';
        const isPrivateAssistant = roleName === 'privateAssistant';
        const displayMode = msgCont.dataset.displayMode;
        let targetElement;
        let wasEditingRaw = false;
        if (isGameHost && displayMode !== 'raw') {
            return;
        } else if (isGameHost && displayMode === 'raw') {
            targetElement = msgCont.querySelector('.game-host-raw');
            wasEditingRaw = true;
        } else if (displayMode === 'raw' && sourceType === 'ai') {
            targetElement = msgCont.querySelector('.ai-response');
            wasEditingRaw = true;
        } else {
            targetElement = msgCont.querySelector('.user-message') || msgCont.querySelector('.ai-response');
        }
        if (!targetElement || targetElement.getAttribute('contenteditable') !== 'true') {
            if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
            return;
        }
        const newText = targetElement.innerText;
        const messageId = msgCont.dataset.messageId;
        let changed = false;
        const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) {
            targetElement.removeAttribute('contenteditable');
            targetElement.style.backgroundColor = '';
            if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
            _logAndDisplayError(`Failed to save edit: Cannot find message ID ${messageId}`, 'saveEditedMessage');
            return;
        }
        const messageObject = stateModule.currentChatHistoryData[messageIndex];
        if (wasEditingRaw) {
            const currentRaw = messageObject.rawJson || '';
            if (currentRaw !== newText) {
                messageObject.rawJson = newText;
                const { parsedResult, parserError } = uiChatModule._parseAIResponse(newText, roleName, roleType);
                messageObject.parsedResult = parsedResult;
                messageObject.parserError = parserError;
                messageObject.speechActionText = uiChatModule._getFormattedDisplayText(parsedResult, roleType, roleName, parserError);
                messageObject.displayMode = 'formatted';
                msgCont.dataset.displayMode = 'formatted';
                changed = true;
            }
        } else {
             let currentDisplayValue = '';
              if (isCharacterUpdateMaster) {
                  currentDisplayValue = messageObject.parsedResult?.formattedUpdate || messageObject.speechActionText || '';
              } else if (isPrivateAssistant) {
                   currentDisplayValue = messageObject.parsedResult?.responseContent || messageObject.speechActionText || '';
              }
              else {
                  currentDisplayValue = messageObject.speechActionText || '';
              }
              if (currentDisplayValue !== newText) {
                  messageObject.speechActionText = newText;
                  if (isCharacterUpdateMaster && messageObject.parsedResult) {
                      messageObject.parsedResult.formattedUpdate = newText;
                  } else if (isPrivateAssistant && messageObject.parsedResult) {
                      messageObject.parsedResult.responseContent = newText;
                  } else if (roleType === 'role' || roleType === 'temporary_role') {
                        if(messageObject.parsedResult) messageObject.parsedResult.formattedText = newText;
                  } else if (roleName === 'writingMaster') {
                       if(messageObject.parsedResult) messageObject.parsedResult.description = newText;
                  }
                  targetElement.textContent = messageObject.speechActionText;
                  changed = true;
              }
        }
        targetElement.removeAttribute('contenteditable');
        targetElement.style.backgroundColor = '';
        if (targetElement._blurHandler) targetElement.removeEventListener('blur', targetElement._blurHandler);
        if (targetElement._keydownHandler) targetElement.removeEventListener('keydown', targetElement._keydownHandler);
        delete targetElement._blurHandler;
        delete targetElement._keydownHandler;
        if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
        if (changed && wasEditingRaw) {
             const mainDiv = msgCont.querySelector('.ai-response');
             if (isGameHost) {
                 const controlsDiv = mainDiv.querySelector('.game-host-controls');
                 const rawDiv = mainDiv.querySelector('.game-host-raw');
                 if (controlsDiv) controlsDiv.style.display = 'flex';
                 if (rawDiv) rawDiv.style.display = 'none';
                 uiChatModule._renderGameHostContent(msgCont, messageObject.activeView || 'time');
             } else if (roleName === 'drawingMaster') {
                  const imageUrl = stateModule.tempImageUrls[messageId];
                  if (imageUrl) {
                      const img = document.createElement('img'); img.src = imageUrl; img.alt = messageObject.speechActionText;
                      img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                      mainDiv.innerHTML = ''; mainDiv.appendChild(img);
                  } else { mainDiv.textContent = messageObject.speechActionText || "[Image Loading or Error]"; }
             } else {
                  mainDiv.textContent = messageObject.speechActionText;
             }
        }
        if (changed) {
            updateChatContextCache();
            uiChatModule.updateChatroomHistoryDisplay();
            uiChatModule.triggerDebouncedHistorySave();
        }
    },
    deleteMessage: (msgCont) => {
        const messageId = msgCont.dataset.messageId;
        if (!messageId) {
             return;
        }
        const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
         if (messageIndex > -1) {
             stateModule.currentChatHistoryData.splice(messageIndex, 1);
         }
        msgCont.remove();
        if (stateModule.tempImageUrls[messageId]) {
             delete stateModule.tempImageUrls[messageId];
             const imgIndex = stateModule.displayedImageOrder.indexOf(messageId);
             if (imgIndex > -1) stateModule.displayedImageOrder.splice(imgIndex, 1);
             stateModule.displayedImageCount--;
        }
        updateChatContextCache();
        uiChatModule.updateChatroomHistoryDisplay();
        uiChatModule.triggerDebouncedHistorySave();
    },
    deleteMessageAndBelow: (msgCont) => {
         const messageId = msgCont.dataset.messageId;
         if (!messageId) {
             return;
         }
         const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
         if (messageIndex === -1) {
             return;
         }
         const messagesToRemove = stateModule.currentChatHistoryData.slice(messageIndex);
         const messageIdsToRemove = messagesToRemove.map(msg => msg.id);
         const allMessageElements = Array.from(elementsModule.chatArea.children);
         for (let i = allMessageElements.length - 1; i >= 0; i--) {
             const el = allMessageElements[i];
             const elId = el.dataset.messageId;
             if (messageIdsToRemove.includes(elId)) {
                 el.remove();
             }
         }
         messagesToRemove.forEach(msg => {
             if (stateModule.tempImageUrls[msg.id]) {
                 delete stateModule.tempImageUrls[msg.id];
                 const imgIndex = stateModule.displayedImageOrder.indexOf(msg.id);
                 if (imgIndex > -1) stateModule.displayedImageOrder.splice(imgIndex, 1);
                 stateModule.displayedImageCount--;
             }
         });
         stateModule.currentChatHistoryData.splice(messageIndex);
         updateChatContextCache();
         uiChatModule.updateChatroomHistoryDisplay();
         uiChatModule.triggerDebouncedHistorySave();
    },
    clearChatArea: () => {
        elementsModule.chatArea.innerHTML = '';
        stateModule.currentChatHistoryData = [];
        stateModule.tempImageUrls = {};
        stateModule.displayedImageCount = 0;
        stateModule.displayedImageOrder = [];
        uiChatModule._removePendingActionButton();
    },
    triggerDebouncedHistorySave: () => {
        clearTimeout(stateModule.historySaveDebounceTimer);
        stateModule.historySaveDebounceTimer = setTimeout(() => {
            uiChatModule.saveChatHistoryToServer();
        }, stateModule.historySaveDebounceDelay);
    },
    saveChatHistoryToServer: async () => {
        const roomName = stateModule.config.activeChatRoomName;
        if (!roomName) return;
        const historyToSave = stateModule.currentChatHistoryData.map(msg => {
             let savedParsedResult = null;
             if (msg.parsedResult && typeof msg.parsedResult === 'object') {
                try {
                    savedParsedResult = JSON.stringify(msg.parsedResult);
                } catch (e) {
                     savedParsedResult = JSON.stringify({ error: `Serialization failed: ${e.message}` });
                     _logAndDisplayError(`Failed to stringify parsedResult for msg ${msg.id}: ${e.message}`, 'saveChatHistoryToServer');
                }
             } else if (msg.parsedResult) {
                 savedParsedResult = String(msg.parsedResult);
             }
            const savedMsg = {
                id: msg.id,
                timestamp: msg.timestamp,
                sourceType: msg.sourceType,
                roleName: msg.roleName,
                roleType: msg.roleType,
                targetRoleName: msg.targetRoleName,
                speechActionText: msg.speechActionText,
                rawJson: msg.rawJson,
                displayMode: msg.displayMode,
                parserError: msg.parserError,
                activeView: msg.activeView,
                parsedResult: savedParsedResult,
                naiPayloadSource: msg.naiPayloadSource ? JSON.stringify(msg.naiPayloadSource) : null
             };

             if (savedMsg.naiPayloadSource === 'null') delete savedMsg.naiPayloadSource;
             if (savedMsg.parsedResult === null || savedMsg.parsedResult === 'null') delete savedMsg.parsedResult;
            return savedMsg;
        });
        try {
            const response = await fetch(`/history/${encodeURIComponent(roomName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyToSave)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to save history: ${response.status} ${errorData.error || ''}`);
            }
        } catch (error) {
            _logAndDisplayError(`Error saving history for ${roomName}: ${error.message}`, 'saveChatHistoryToServer');
        }
    },
    loadChatHistory: async (roomName) => {
        uiChatModule.clearChatArea();
        if (!roomName) return;
        let historyData = [];
        try {
            const response = await fetch(`/history/${encodeURIComponent(roomName)}`);
            if (response.ok) {
                historyData = await response.json();
            } else if (response.status !== 404) {
                throw new Error(`Failed to load history: ${response.status}`);
            }
        } catch (error) {
             _logAndDisplayError(`Error loading history for ${roomName}: ${error.message}`, 'loadChatHistory');
        }
        stateModule.currentChatHistoryData = [];
        const frag = document.createDocumentFragment();
        historyData.forEach(msg => {
             if (!msg || typeof msg !== 'object') {
                 return;
             }
             let parsedResult = null;
             if (msg.parsedResult && typeof msg.parsedResult === 'string') {
                try {
                    parsedResult = JSON.parse(msg.parsedResult);
                } catch (e) {
                    parsedResult = { error: `Failed to parse stored parsedResult: ${e.message}` };
                    msg.parserError = msg.parserError || `Failed to parse stored parsedResult: ${e.message}`;
                    msg.displayMode = 'formatted';
                    msg.speechActionText = `[Load Parse Error: ${e.message}]`;
                }
             } else if (msg.parsedResult !== undefined && msg.parsedResult !== null) {
                 parsedResult = msg.parsedResult;
             }
             let naiPayloadSource = null;
              if (msg.naiPayloadSource && typeof msg.naiPayloadSource === 'string') {
                  try {
                      naiPayloadSource = JSON.parse(msg.naiPayloadSource);
                  } catch (e) {
                       _logAndDisplayError(`Failed to parse naiPayloadSource for msg ${msg.id}: ${e.message}`, 'loadChatHistory');
                  }
              } else if (msg.naiPayloadSource) {
                   naiPayloadSource = msg.naiPayloadSource;
              }

             const messageObject = {
                id: msg.id || uiChatModule._generateMessageId(),
                timestamp: msg.timestamp || Date.now(),
                sourceType: msg.sourceType,
                roleName: msg.roleName,
                roleType: msg.roleType,
                targetRoleName: msg.targetRoleName,
                speechActionText: msg.speechActionText,
                rawJson: msg.rawJson,
                parsedResult: parsedResult,
                displayMode: msg.displayMode || 'formatted',
                parserError: msg.parserError,
                activeView: msg.activeView || (msg.roleName === 'gameHost' ? 'time' : undefined),
                naiPayloadSource: naiPayloadSource
             };
             if (messageObject.roleName === 'drawingMaster' && messageObject.sourceType === 'ai' && !messageObject.parserError && !naiPayloadSource && parsedResult) {
                  messageObject.naiPayloadSource = parsedResult;
             }

            stateModule.currentChatHistoryData.push(messageObject);
            const el = uiChatModule.displayChatMessageElement(messageObject);
            if (el) frag.appendChild(el);
        });
        elementsModule.chatArea.appendChild(frag);
        if (elementsModule.chatArea.scrollHeight > elementsModule.chatArea.clientHeight) {
             elementsModule.chatArea.scrollTop = elementsModule.chatArea.scrollHeight;
        }
        await updateChatContextCache();
        uiChatModule.updateChatroomHistoryDisplay();
    },
    updateChatroomHistoryDisplay: () => {
        let historyText = "";
        const lines = [];
        stateModule.currentChatHistoryData.forEach(messageObject => {
             const roleType = messageObject.roleType;
             const roleName = messageObject.roleName;
             let displayContent = messageObject.speechActionText || '';
             if (messageObject.parsedResult) {
                 if ((roleType === 'role' || roleType === 'temporary_role') && messageObject.parsedResult.formattedText) {
                     displayContent = messageObject.parsedResult.formattedText;
                 } else if (roleName === 'characterUpdateMaster' && messageObject.parsedResult.formattedUpdate) {
                     displayContent = messageObject.parsedResult.formattedUpdate;
                 } else if (roleName === 'privateAssistant' && messageObject.parsedResult.responseContent) {
                      displayContent = messageObject.parsedResult.responseContent;
                 }
             }
             if (roleType === 'role' || roleType === 'temporary_role' || (roleType === 'tool' && roleName === 'privateAssistant')) {
                 const actorName = roleName || (messageObject.sourceType === 'user' ? 'User' : 'AI');
                 let content = (displayContent || '').trim();
                 if (content && content !== "[图片绘制]") {
                    if(roleName === 'privateAssistant') {
                        lines.push(content);
                    } else {
                        lines.push(`${actorName}：\n${content}`);
                    }
                 }
             } else if (roleName === 'gameHost' && messageObject.sourceType === 'ai' && messageObject.parsedResult && !messageObject.parserError) {

             }
        });
        historyText = lines.join('\n');
        if (elementsModule.chatroomHistoryDisplay) {
            elementsModule.chatroomHistoryDisplay.value = historyText;
        }
    },
    getLatestRoleStateText: (name) => {
        if (stateModule.chatContextCache) {
             return stateModule.chatContextCache.roleDetailedStates[name] || `[${name} state not in cache]`;
        }
        return `[${name} state unavailable - cache empty]`;
    },
    toggleRunPause: function() {
        const wasPaused = stateModule.config.isRunPaused;
        stateModule.config.isRunPaused = !stateModule.config.isRunPaused;
        elementsModule.runPauseButton.textContent = stateModule.config.isRunPaused ? '▶' : '◼';
        const triggerList = elementsModule.activeRoleTriggerList;
        if (triggerList) triggerList.style.display = 'none';
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
        if (wasPaused && !stateModule.config.isRunPaused) {
            const chatroomDetails = stateModule.currentChatroomDetails;
            if (chatroomDetails && chatroomDetails.config?.roleStates) {
                const roleStates = chatroomDetails.config.roleStates;
                const activeRoles = Object.entries(roleStates)
                    .filter(([name, state]) => state === uiChatModule.ROLE_STATE_ACTIVE)
                    .map(([name, state]) => name);
                if (activeRoles.length === 1) {
                    apiModule.triggerRoleResponse(activeRoles[0]);
                } else if (activeRoles.length > 1) {
                    uiChatModule.showActiveRoleTriggerList(activeRoles);
                }
            }
            const gameHostEnabled = stateModule.config.toolSettings.gameHost?.enabled;
            const lastActorName = stateModule.chatContextCache?.lastActor;
            const roleStates = stateModule.currentChatroomDetails?.config?.roleStates;
            if (gameHostEnabled && lastActorName && roleStates) {
                const lastActorState = roleStates[lastActorName];
                if (lastActorState === uiChatModule.ROLE_STATE_USER_CONTROL) {
                    apiModule.triggerRoleResponse('gameHost');
                }
            }
            const lastMessage = stateModule.currentChatHistoryData[stateModule.currentChatHistoryData.length - 1];
            if (lastMessage && lastMessage.sourceType === 'user') {
                 let text = lastMessage.speechActionText;
                 if(lastMessage.parsedResult?.formattedText) text = lastMessage.parsedResult.formattedText;
                 const writingMasterEnabled = stateModule.config.toolSettings.writingMaster?.enabled;
                 if (text && writingMasterEnabled) {
                     const keywords = ['看', '听', '闻', '模', '尝'];
                     const containsKeyword = keywords.some(keyword => text.includes(keyword));
                     if (containsKeyword) {
                          apiModule.triggerRoleResponse('writingMaster');
                     }
                 }
            }
        }
        if (stateModule.config.isRunPaused) {
            uiChatModule._removePendingActionButton();
        }
    },
    showActiveRoleTriggerList: (activeRoleNames) => {
        const listContainer = elementsModule.activeRoleTriggerList;
        if (!listContainer) return;
        listContainer.innerHTML = '';
        activeRoleNames.forEach(roleName => {
            const button = document.createElement('div');
            button.className = 'active-role-trigger-button';
            button.textContent = roleName;
            button.dataset.roleName = roleName;
            button.addEventListener('click', () => {
                listContainer.style.display = 'none';
                apiModule.triggerRoleResponse(roleName);
            });
            listContainer.appendChild(button);
        });
        listContainer.style.display = 'flex';
    },
    setPauseState: function(shouldPause) {
        if (shouldPause && !stateModule.config.isRunPaused) {
            uiChatModule.toggleRunPause();
        } else if (!shouldPause && stateModule.config.isRunPaused) {
            uiChatModule.toggleRunPause();
        }
    },
    toggleRoleList: () => {
        stateModule.config.isRoleListVisible = !stateModule.config.isRoleListVisible;
        elementsModule.roleButtonsListContainer.style.display = stateModule.config.isRoleListVisible ? 'flex' : 'none';
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
        if (!stateModule.config.isRoleListVisible) {
            uiChatModule.hideRoleStateButtons();
        }
    },
    handleRoleDefaultStateLongPress: (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config || !chatroomDetails.config.roleVisibility) {
            return;
        }
        const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
        if (!isPermanent || roleName === "管理员") return;

        chatroomDetails.config.roleVisibility[roleName] = false;
        apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
        uiChatModule.updateRoleButtonsList();

        const settingsRoleListPageActive = document.getElementById('role-list-page')?.classList.contains('active');
        if (settingsRoleListPageActive) {
             const checkbox = elementsModule.roleListContainer.querySelector(`.role-visibility-checkbox[data-role-name="${roleName}"]`);
             if (checkbox) {
                 checkbox.checked = false;
             }
        }
        uiChatModule.hideRoleStateButtons();
    },
    updateRoleButtonsList: () => {
        const frag = document.createDocumentFragment();
        const chatroomDetails = stateModule.currentChatroomDetails;
        const usedChars = new Set();
        const roleDataForButtons = [];
        if (chatroomDetails && chatroomDetails.config?.roleStates) {
            const roleStates = chatroomDetails.config.roleStates;
            const roleVisibility = chatroomDetails.config.roleVisibility || {};
            const permanentRoles = new Set(chatroomDetails.roles.map(r => r.name));
            const allRoleNames = Object.keys(roleStates);
            const sortedRoleNames = allRoleNames.sort((a, b) => {
                const isTempA = !permanentRoles.has(a);
                const isTempB = !permanentRoles.has(b);
                if (isTempA && !isTempB) return -1;
                if (!isTempA && isTempB) return 1;
                if (a === "管理员") return -1;
                if (b === "管理员") return 1;
                return a.localeCompare(b);
            });
            sortedRoleNames.forEach(name => {
                 if (name === "管理员") return;
                 const isPermanent = permanentRoles.has(name);
                 const isVisible = roleVisibility[name] ?? true;
                 if (isPermanent && !isVisible) {
                     return;
                 }
                 const isTemporary = !isPermanent;
                 const char1 = name.charAt(0).toUpperCase();
                 let charToUse = null;
                 if (!usedChars.has(char1)) {
                     charToUse = char1; usedChars.add(char1);
                 } else {
                     const charL = name.charAt(name.length - 1).toUpperCase();
                     if (!usedChars.has(charL)) { charToUse = charL; usedChars.add(charL); }
                     else {
                         let fallbackChar = name.charAt(0).toUpperCase() + '2';
                         let i = 2;
                         while (usedChars.has(fallbackChar)) { fallbackChar = name.charAt(0).toUpperCase() + ++i; }
                         charToUse = fallbackChar; usedChars.add(fallbackChar);
                     }
                 }
                 roleDataForButtons.push({ name, char: charToUse, isTemporary });
            });
            roleDataForButtons.forEach(({ name, char, isTemporary }) => {
                const cont = document.createElement('div'); cont.className = 'role-button-container';
                const btn = document.createElement('div'); btn.className = 'std-button'; btn.textContent = char; btn.dataset.roleName = name;
                if (isTemporary) {
                    btn.style.backgroundColor = 'white';
                    btn.style.color = '#3a3a3a';
                    btn.style.borderColor = '#3a3a3a';
                }
                cont.appendChild(btn);
                const statesDiv = document.createElement('div'); statesDiv.className = 'role-state-buttons'; statesDiv.dataset.roleName = name;
                const statesToShow = [uiChatModule.ROLE_STATE_DEFAULT, uiChatModule.ROLE_STATE_ACTIVE, uiChatModule.ROLE_STATE_USER_CONTROL, uiChatModule.ROLE_STATE_UPDATE];
                statesToShow.forEach(s => {
                    const sBtn = document.createElement('div'); sBtn.className = 'std-button role-state-button';
                    sBtn.textContent = s;
                    sBtn.dataset.roleName = name;
                    sBtn.dataset.state = s;
                    statesDiv.appendChild(sBtn);
                });
                cont.appendChild(statesDiv);
                frag.appendChild(cont);
            });
        }
        elementsModule.roleButtonsListContainer.innerHTML = '';
        elementsModule.roleButtonsListContainer.appendChild(frag);
        const roleButtonContainers = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container');
        roleButtonContainers.forEach(container => {
            const mainButton = container.querySelector('.std-button:not(.role-state-button)');
            const stateButtons = container.querySelectorAll('.role-state-button');
            const roleName = mainButton.dataset.roleName;
            const roleInfo = roleDataForButtons.find(r => r.name === roleName);
            const roleIsTemporary = roleInfo ? roleInfo.isTemporary : false;
            const isPermanent = !roleIsTemporary;
            const mainShortPress = () => uiChatModule.toggleRoleStateButtons(roleName);
            const mainLongPress = () => {
                if (!elementsModule.settingsPanel.classList.contains('active')) {
                    uiSettingsModule.toggleSettings();
                }
                uiSettingsModule.showRoleDetailPage(roleName);
                uiChatModule.hideRoleStateButtons();
                if (stateModule.config.isRoleListVisible) uiChatModule.toggleRoleList();
                 uiChatModule.hideRoleStateButtons();
            };
            if (mainButton) eventListenersModule._setupLongPressListener(mainButton, mainShortPress, mainLongPress, false);
            stateButtons.forEach(sBtn => {
                const state = sBtn.dataset.state;
                const isDisabled = sBtn.classList.contains('edit-disabled');
                const stateShortPress = isDisabled ? null : () => uiChatModule.selectRoleState(roleName, state);
                let stateLongPress = null;
                if (!isDisabled && state === uiChatModule.ROLE_STATE_USER_CONTROL) {
                    stateLongPress = () => {
                        uiChatModule.createAndEditMessageForRole(roleName);
                        uiChatModule.hideRoleStateButtons();
                    };
                } else if (!isDisabled && state === uiChatModule.ROLE_STATE_DEFAULT && roleIsTemporary) {
                     stateLongPress = () => uiChatModule.deleteTemporaryRole(roleName, true);
                } else if (!isDisabled && state === uiChatModule.ROLE_STATE_DEFAULT && isPermanent) {
                     stateLongPress = () => uiChatModule.handleRoleDefaultStateLongPress(roleName);
                } else if (!isDisabled && state === uiChatModule.ROLE_STATE_ACTIVE) {
                     stateLongPress = () => uiChatModule.handleActivateButtonLongPress(roleName);
                }
                if (sBtn) eventListenersModule._setupLongPressListener(sBtn, stateShortPress, stateLongPress, false);
            });
        });
        roleDataForButtons.forEach(({ name }) => {
            uiChatModule.updateRoleStateButtonVisual(name);
        });
    },
    toggleRoleStateButtons: (name) => {
        const div = document.querySelector(`.role-state-buttons[data-role-name="${name}"]`);
        if (div) {
            if (stateModule.activeRoleStateButtons === name) {
                div.classList.remove('active');
                stateModule.activeRoleStateButtons = null;
            } else {
                uiChatModule.hideRoleStateButtons();
                div.classList.add('active');
                stateModule.activeRoleStateButtons = name;
            }
        }
    },
    hideRoleStateButtons: () => {
        document.querySelectorAll('.role-state-buttons.active').forEach(el => el.classList.remove('active'));
        stateModule.activeRoleStateButtons = null;
        const triggerList = elementsModule.activeRoleTriggerList;
        if (triggerList) triggerList.style.display = 'none';
    },
    selectRoleState: async (name, state) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config.roleStates) return;
        const currentStates = chatroomDetails.config.roleStates;
        if (state === uiChatModule.ROLE_STATE_UPDATE) {
            const isPermanent = chatroomDetails.roles.some(r => r.name === name);
            if (!isPermanent) {
                const newRoleData = { name: name, setting: "", memory: "", drawingTemplate: "" };
                const createSuccess = await apiModule.createRole(chatroomDetails.config.name, newRoleData);
                if (createSuccess) {
                    await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
                    uiChatModule.updateRoleButtonsList();
                    uiSettingsModule.updateChatroomRolePage();
                    await updateChatContextCache();
                    apiModule.triggerCharacterUpdateForRole(name);
                } else {
                    _logAndDisplayError(`Failed to convert temporary role ${name} to permanent before update.`, "selectRoleState");
                    alert(`创建永久角色文件失败，无法更新角色 ${name}`);
                }
            } else {
                await updateChatContextCache();
                apiModule.triggerCharacterUpdateForRole(name);
            }
        } else {
            currentStates[name] = state;
            const updatePayload = { roleStates: currentStates };
            if (!chatroomDetails.config.roleDetailedStates) chatroomDetails.config.roleDetailedStates = {};
            updatePayload.roleDetailedStates = chatroomDetails.config.roleDetailedStates;
            if (!chatroomDetails.config.roleVisibility) chatroomDetails.config.roleVisibility = {};
            updatePayload.roleVisibility = chatroomDetails.config.roleVisibility;
            const success = await apiModule.updateChatroomConfig(chatroomDetails.config.name, updatePayload);
            if (success) {
                uiChatModule.updateRoleStateButtonVisual(name);
                await updateChatContextCache();
            } else {
                 await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
                 uiChatModule.updateRoleStateButtonVisual(name);
                 _logAndDisplayError(`Failed to save state change for role ${name}`, "selectRoleState");
                 alert(`保存角色 ${name} 状态失败`);
            }
        }
        uiChatModule.hideRoleStateButtons();
    },

    handleDefaultStateLongPress: async (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || roleName === "管理员") return;
        const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
        if (!isPermanent) return;

        const newStates = { ...chatroomDetails.config.roleStates };
        delete newStates[roleName];
        const updatePayload = { roleStates: newStates };
        if (chatroomDetails.config.roleDetailedStates && roleName in chatroomDetails.config.roleDetailedStates) {
            const newDetailedStates = { ...chatroomDetails.config.roleDetailedStates };
            delete newDetailedStates[roleName];
            updatePayload.roleDetailedStates = newDetailedStates;
        }
        if (chatroomDetails.config.roleVisibility && roleName in chatroomDetails.config.roleVisibility) {
             const newVisibility = { ...chatroomDetails.config.roleVisibility };
             delete newVisibility[roleName];
             updatePayload.roleVisibility = newVisibility;
        }

        const success = await apiModule.updateChatroomConfig(chatroomDetails.config.name, updatePayload);
        if (success) {
            chatroomDetails.config.roleStates = newStates;
            if (updatePayload.roleDetailedStates) {
                chatroomDetails.config.roleDetailedStates = updatePayload.roleDetailedStates;
            }
            if (updatePayload.roleVisibility) {
                 chatroomDetails.config.roleVisibility = updatePayload.roleVisibility;
            }
            uiChatModule.updateRoleButtonsList();
            uiSettingsModule.updateChatroomRolePage();
            await updateChatContextCache();
        } else {
            _logAndDisplayError(`Failed to remove role ${roleName} from states`, "handleDefaultStateLongPress");
            alert(`移除角色 ${roleName} 失败`);
        }
        uiChatModule.hideRoleStateButtons();
    },
    updateRoleStateButtonVisual: (name) => {
        const div = document.querySelector(`.role-state-buttons[data-role-name="${name}"]`);
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (div && chatroomDetails && chatroomDetails.config.roleStates) {
            const currentState = chatroomDetails.config.roleStates[name] || uiChatModule.ROLE_STATE_DEFAULT;
            div.childNodes.forEach(btn => {
                if (btn.classList?.contains('role-state-button')) {
                    btn.classList.remove('role-state-active');
                    if (btn.dataset.state === currentState) {
                        btn.classList.add('role-state-active');
                    }
                }
            });
        }
    },
    createAndEditMessageForRole: (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) { _logAndDisplayError("请先选择一个激活的聊天室。", "createAndEditMessageForRole"); return; }
        const roleState = chatroomDetails.config.roleStates?.[roleName];
        if (roleState === undefined) {
             _logAndDisplayError(`角色 "${roleName}" 不在当前聊天室。`, "createAndEditMessageForRole"); return;
        }
        const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
        const roleType = isPermanent ? 'role' : 'temporary_role';
        const msgId = uiChatModule._generateMessageId();
        const timestamp = Date.now();
        const messageObject = {
            id: msgId,
            timestamp: timestamp,
            sourceType: 'user',
            roleName: roleName,
            roleType: roleType,
            targetRoleName: null,
            speechActionText: '',
            rawJson: null,
            parsedResult: null,
            displayMode: 'formatted',
            parserError: null
        };
        stateModule.currentChatHistoryData.push(messageObject);
        const msgCont = uiChatModule._appendMessageAndScroll(messageObject);
        if(msgCont) {
            uiChatModule.toggleMessageEditMode(msgCont);
        }
    },
    createAdminMessage: () => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
             _logAndDisplayError("请先选择一个激活的聊天室。", "createAdminMessage"); return;
        }
        const adminRoleName = '管理员';
        const msgId = uiChatModule._generateMessageId();
        const timestamp = Date.now();
        const messageObject = {
            id: msgId,
            timestamp: timestamp,
            sourceType: 'user',
            roleName: adminRoleName,
            roleType: 'temporary_role',
            targetRoleName: null,
            speechActionText: '',
            rawJson: null,
            parsedResult: null,
            displayMode: 'formatted',
            parserError: null
        };
        stateModule.currentChatHistoryData.push(messageObject);
        const msgCont = uiChatModule._appendMessageAndScroll(messageObject);
        if(msgCont) {
            uiChatModule.toggleMessageEditMode(msgCont);
        }
    },
    addTemporaryRole: async (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
             _logAndDisplayError("添加失败：没有激活的聊天室。", 'addTemporaryRole');
             return false;
        }
        if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
            _logAndDisplayError("添加失败：名称不能为空。", 'addTemporaryRole');
            return false;
        }
        const trimmedName = roleName.trim();
        if (Object.keys(chatroomDetails.config.roleStates || {}).includes(trimmedName)) {
            _logAndDisplayError(`添加失败：名称 "${trimmedName}" 已存在于当前聊天室。`, 'addTemporaryRole');
            return false;
        }
        const newStates = { ...chatroomDetails.config.roleStates, [trimmedName]: uiChatModule.ROLE_STATE_ACTIVE };
        const updatePayload = { roleStates: newStates };
        if (!chatroomDetails.config.roleDetailedStates) chatroomDetails.config.roleDetailedStates = {};
        updatePayload.roleDetailedStates = { ...chatroomDetails.config.roleDetailedStates, [trimmedName]: "" };
        if (!chatroomDetails.config.roleVisibility) chatroomDetails.config.roleVisibility = {};
        updatePayload.roleVisibility = { ...chatroomDetails.config.roleVisibility };
        const success = await apiModule.updateChatroomConfig(chatroomDetails.config.name, updatePayload);
        if (success) {
             chatroomDetails.config.roleStates = newStates;
             chatroomDetails.config.roleDetailedStates = updatePayload.roleDetailedStates;
             chatroomDetails.config.roleVisibility = updatePayload.roleVisibility;
             return true;
        } else {
             _logAndDisplayError(`Failed to add temporary role ${trimmedName} via API`, 'addTemporaryRole');
             return false;
        }
    },
    deleteTemporaryRole: async (roleName, confirmDeletion = true) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
            _logAndDisplayError("删除失败：没有激活的聊天室。", 'deleteTemporaryRole');
            return false;
        }
        if (roleName === "管理员") {
            _logAndDisplayError("不能删除管理员角色。", 'deleteTemporaryRole');
            return false;
        }
        const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
        if (isPermanent) {
            _logAndDisplayError(`删除失败：角色 "${roleName}" 不是临时角色。`, 'deleteTemporaryRole');
            return false;
        }
        if (!chatroomDetails.config.roleStates || !(roleName in chatroomDetails.config.roleStates)) {
            _logAndDisplayError(`删除失败：临时角色 "${roleName}" 不存在于状态中。`, 'deleteTemporaryRole');
            return false;
        }
        if (confirmDeletion) {
        }

        const newStates = { ...chatroomDetails.config.roleStates };
        delete newStates[roleName];
        const updatePayload = { roleStates: newStates };
        if (chatroomDetails.config.roleDetailedStates && roleName in chatroomDetails.config.roleDetailedStates) {
            const newDetailedStates = { ...chatroomDetails.config.roleDetailedStates };
            delete newDetailedStates[roleName];
            updatePayload.roleDetailedStates = newDetailedStates;
        }
        if (chatroomDetails.config.roleVisibility && roleName in chatroomDetails.config.roleVisibility) {
             const newVisibility = { ...chatroomDetails.config.roleVisibility };
             delete newVisibility[roleName];
             updatePayload.roleVisibility = newVisibility;
        }
        const success = await apiModule.updateChatroomConfig(chatroomDetails.config.name, updatePayload);
        if (success) {
            chatroomDetails.config.roleStates = newStates;
            if (updatePayload.roleDetailedStates) {
                chatroomDetails.config.roleDetailedStates = updatePayload.roleDetailedStates;
            }
            if (updatePayload.roleVisibility) {
                 chatroomDetails.config.roleVisibility = updatePayload.roleVisibility;
            }
            uiChatModule.updateRoleButtonsList();
            uiSettingsModule.updateChatroomRolePage();
            await updateChatContextCache();
            return true;
        } else {
            _logAndDisplayError(`Failed to delete temporary role ${roleName} via API`, 'deleteTemporaryRole');
            return false;
        }
    },
    handleNovelAiResponse: (responseData, originalDrawingMasterData, rawJsonText, targetMessageId = null) => {
        if (responseData.error) {
             _logAndDisplayError(`NovelAI Error: ${responseData.error}`, 'handleNovelAiResponse');
             return;
        }
        if (!responseData.imageDataUrl) {
             _logAndDisplayError("[NovelAI returned unknown response or no image data]", 'handleNovelAiResponse');
             return;
        }
        const imageUrl = responseData.imageDataUrl;
        if (targetMessageId) {
             const msgCont = document.querySelector(`.message-container[data-message-id="${targetMessageId}"]`);
             if (msgCont) {
                 const imgElement = msgCont.querySelector('.ai-response img');
                 if (imgElement) {
                     stateModule.tempImageUrls[targetMessageId] = imageUrl;
                     imgElement.src = imageUrl;
                 } else {
                      _logAndDisplayError(`Image element not found in message ${targetMessageId} for replacement.`, 'handleNovelAiResponse');
                 }
                 const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === targetMessageId);
                 if (messageIndex > -1) {
                     stateModule.currentChatHistoryData[messageIndex].timestamp = Date.now();
                     stateModule.currentChatHistoryData[messageIndex].naiPayloadSource = originalDrawingMasterData || null;
                     stateModule.currentChatHistoryData[messageIndex].rawJson = rawJsonText || JSON.stringify(originalDrawingMasterData || {});
                 }
                 uiChatModule.triggerDebouncedHistorySave();
             } else {
                  _logAndDisplayError(`Could not find target message ${targetMessageId} for redraw.`, 'handleNovelAiResponse');
             }
        } else {
             const msgId = uiChatModule._generateMessageId();
             const timestamp = Date.now();
             const roleName = 'drawingMaster';
             const roleType = 'tool';
             const messageObject = {
                id: msgId,
                timestamp: timestamp,
                sourceType: 'ai',
                roleName: roleName,
                roleType: roleType,
                targetRoleName: null,
                speechActionText: "[图片绘制]",
                rawJson: rawJsonText || JSON.stringify(originalDrawingMasterData || {}),
                parsedResult: originalDrawingMasterData || null,
                displayMode: 'formatted',
                parserError: null,
                naiPayloadSource: originalDrawingMasterData || null
             };
             stateModule.tempImageUrls[msgId] = imageUrl;
             stateModule.displayedImageCount++;
             stateModule.displayedImageOrder.push(msgId);
             const MAX_IMAGES = 20;
             if (stateModule.displayedImageCount > MAX_IMAGES) {
                const oldestMsgId = stateModule.displayedImageOrder.shift();
                delete stateModule.tempImageUrls[oldestMsgId];
                stateModule.displayedImageCount--;
             }
            stateModule.currentChatHistoryData.push(messageObject);
            const messageContainer = uiChatModule._appendMessageAndScroll(messageObject);
            if (messageContainer) {
                 const actionsContainer = messageContainer.querySelector('.message-actions-container');
                 if (actionsContainer) {
                     let bgButton = actionsContainer.querySelector('.set-background-button');
                     if (!bgButton) {
                         bgButton = document.createElement('div');
                         bgButton.className = 'std-button message-action-button set-background-button';
                         bgButton.textContent = '🖼️';
                         bgButton._interactionListenersAttached = true;
                         eventListenersModule._setupLongPressListener(
                             bgButton,
                             () => uiChatModule.handleSetBackgroundClick({ target: bgButton }),
                             () => uiChatModule.handleDownloadImageLongPress({ target: bgButton }),
                             false
                         );
                         const redrawBtn = actionsContainer.querySelector('.redraw-button');
                          if(redrawBtn) {
                               actionsContainer.insertBefore(bgButton, redrawBtn);
                          } else {
                               const deleteBtn = actionsContainer.querySelector('.delete-button');
                               if(deleteBtn) {
                                   actionsContainer.insertBefore(bgButton, deleteBtn);
                               } else {
                                    actionsContainer.appendChild(bgButton);
                               }
                          }
                     }
                 }
            }
            uiChatModule.triggerDebouncedHistorySave();
        }
    },
    saveCharacterUpdate: async (messageContainer) => {
        if (!messageContainer) return;
        const messageId = messageContainer.dataset.messageId;
        const chatroomDetails = stateModule.currentChatroomDetails;
        const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1 || stateModule.currentChatHistoryData[messageIndex].roleName !== 'characterUpdateMaster') {
             _logAndDisplayError(`Cannot save character update: Message ${messageId} not found or not a character update message.`, 'saveCharacterUpdate');
            return;
        }
        const messageObject = stateModule.currentChatHistoryData[messageIndex];
        const parsedResult = messageObject.parsedResult;
        if (!parsedResult || messageObject.parserError || !parsedResult.formattedUpdate) {
             _logAndDisplayError(`Cannot save character update: Parsed result for message ${messageId} is invalid, contains errors, or lacks formattedUpdate.`, 'saveCharacterUpdate');
             return;
        }
        const targetRoleName = messageObject.targetRoleName;
        if (!chatroomDetails || !targetRoleName) {
             _logAndDisplayError(`Cannot save character update: Active chatroom details or target role name is missing.`, 'saveCharacterUpdate');
            return;
        }
        const roleIndex = chatroomDetails.roles.findIndex(r => r.name === targetRoleName);
        if (roleIndex === -1) {
            _logAndDisplayError(`Cannot save character update: Target role ${targetRoleName} not found in chatroom roles (might be temporary).`, 'saveCharacterUpdate');
             alert(`无法保存：目标角色 ${targetRoleName} 是临时角色或已被删除。`);
            return;
        }
        const roleToUpdate = chatroomDetails.roles[roleIndex];
        const formattedUpdateString = parsedResult.formattedUpdate;
        const parts = formattedUpdateString.split(uiChatModule.CHARACTER_SETTINGS_SEPARATOR);
        if (parts.length === 2) {
             let newMemoryPart = parts[0].replace(/^---\s*更新后记忆.*?---\s*\n?/, '').trim();
             let newSettingString = parts[1].replace(/^---\s*更新后设定.*?---\s*\n?/, '').trim();
             const currentMemory = roleToUpdate.memory || '';
             const combinedMemory = currentMemory ? `${currentMemory}\n${newMemoryPart}` : newMemoryPart;

             const updatedRoleData = {
                 ...roleToUpdate,
                 memory: combinedMemory,
                 setting: newSettingString
             };
             const success = await apiModule.updateRole(chatroomDetails.config.name, targetRoleName, updatedRoleData);
             if(success) {
                 Object.assign(roleToUpdate, updatedRoleData);
                 uiChatModule.hideAllMessageActions();
                 const roleDetailOpen = document.getElementById('role-detail-page')?.classList.contains('active');
                 if (roleDetailOpen && stateModule.currentRole === targetRoleName) {
                    uiSettingsModule.loadRoleSettings(targetRoleName, roleToUpdate, false);
                 }
             } else {
                  _logAndDisplayError(`Failed to save character update for ${targetRoleName} via API`, 'saveCharacterUpdate');
                  alert(`保存角色 ${targetRoleName} 更新失败。`);
             }
        } else {
             _logAndDisplayError(`Output format error for CharacterUpdateMaster message ${messageId}, cannot save. Formatted string: ${formattedUpdateString}`, 'saveCharacterUpdate');
        }
    },
    showLoadingSpinner: () => {
        if (elementsModule.loadingSpinner) {
            elementsModule.loadingSpinner.style.display = 'block';
            elementsModule.loadingSpinner.classList.add('spinning');
        }
    },
    hideLoadingSpinner: () => {
        if (elementsModule.loadingSpinner) {
            elementsModule.loadingSpinner.style.display = 'none';
            elementsModule.loadingSpinner.classList.remove('spinning');
        }
    },
    showRetryIndicator: () => {
        const spinner = elementsModule.loadingSpinner;
        if (spinner) {
            spinner.classList.add('retry-indicator');
            setTimeout(() => {
                spinner.classList.remove('retry-indicator');
            }, 200);
        }
    },
    _createPendingActionButton: (roleName) => {
        const container = elementsModule.pendingActionButtonContainer;
        if (!container) return;
        uiChatModule._removePendingActionButton();
        const button = document.createElement('div');
        button.className = 'std-button';
        button.textContent = '💬';
        button.dataset.roleName = roleName;
        button.addEventListener('click', () => {
            uiChatModule.createAndEditMessageForRole(roleName);
            uiChatModule._removePendingActionButton();
        });
        container.appendChild(button);
    },
    _removePendingActionButton: () => {
        const container = elementsModule.pendingActionButtonContainer;
        if (container) {
            container.innerHTML = '';
        }
    },
    handleActivateButtonLongPress: (roleName) => {
        if (stateModule.config.isRunPaused) {
            uiChatModule.toggleRunPause();
        }
        apiModule.triggerRoleResponse(roleName);
        uiChatModule.hideRoleStateButtons();
    },
};