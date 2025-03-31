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
        if (roleType === 'tool') {
            parserJsCode = stateModule.config.toolSettings[roleName]?.responseSchemaParserJs || '';
        } else {
            parserJsCode = stateModule.config.responseSchemaParserJs || '';
        }

        let parsedResult = null;
        let parserError = null;
        let dataToParse = null;
        if (typeof textContentString !== 'string' || textContentString.trim() === '') {
            return { parsedResult: null, parserError: "无有效文本内容", rawText: textContentString };
        }

        try {
            dataToParse = JSON.parse(textContentString);
        } catch (e) {
            return { parsedResult: null, parserError: `解析JSON失败: ${e.message}`, rawText: textContentString };
        }

        if (!dataToParse) {
             return { parsedResult: null, parserError: "解析JSON后为空", rawText: textContentString };
        }

        if (parserJsCode) {
            try {

                const responseJsonMock = { candidates: [{ content: { parts: [dataToParse] } }] };
                const parserFunction = new Function('responseJson', parserJsCode);
                parsedResult = parserFunction(responseJsonMock);
                if (parsedResult && typeof parsedResult === 'object' && parsedResult.error) {
                    parserError = parsedResult.error;

                    if (roleType !== 'tool' || (roleName !== 'gameHost' && roleName !== 'drawingMaster' && roleName !== 'characterUpdateMaster')) {
                       parsedResult = { turnActions: [{ type: 'action', content: textContentString }] };
                    } else {
                       parsedResult = null;
                    }
                } else if (parsedResult === null || parsedResult === undefined) {
                    parserError = '解析器返回空值';
                    if (roleType !== 'tool' || (roleName !== 'gameHost' && roleName !== 'drawingMaster' && roleName !== 'characterUpdateMaster')) {
                       parsedResult = { turnActions: [{ type: 'action', content: textContentString }] };
                    } else {
                       parsedResult = null;
                    }
                }
            } catch (e) {
                 parserError = `执行解析器时出错: ${e.message}`;
                 if (roleType !== 'tool' || (roleName !== 'gameHost' && roleName !== 'drawingMaster' && roleName !== 'characterUpdateMaster')) {
                     parsedResult = { turnActions: [{ type: 'action', content: textContentString }] };
                 } else {
                     parsedResult = null;
                 }
            }
        } else {
             if (roleType === 'role' || roleType === 'temporary_role') {
                  parsedResult = { turnActions: [{ type: 'action', content: textContentString }] };
                  parserError = '角色/临时角色 未定义解析器';
             } else if (roleType === 'tool' && (roleName === 'gameHost' || roleName === 'drawingMaster' || roleName === 'characterUpdateMaster')) {
                  parsedResult = dataToParse;
                  parserError = null;
             }
             else {
                 parsedResult = textContentString;
                 parserError = `工具 ${toolNameMap[roleName] || roleName} 未定义解析器`;
             }
        }

        return { parsedResult, parserError, rawText: textContentString };
    },

     _formatCharacterUpdateMasterDisplay: (parsedResult) => {
        if (!parsedResult || typeof parsedResult !== 'object') {
            return "[无法格式化角色更新：无效的解析结果]";
        }

        let memoryString = `--- 更新后记忆 (${parsedResult.updatedCharacterMemory?.characterName || '未知角色'}) ---\n`;
        if (Array.isArray(parsedResult.updatedCharacterMemory?.memoryEntries)) {
            parsedResult.updatedCharacterMemory.memoryEntries.forEach(entry => {
                memoryString += `[${entry.contextOrDate || '未知时间'}]: ${entry.description || '无描述'}\n`;
            });
        } else {
            memoryString += "[无记忆条目]\n";
        }

        let settingString = `--- 更新后设定 (${parsedResult.updatedCharacterSettings?.characterName || '未知角色'} @ ${parsedResult.updatedCharacterSettings?.updateTime || '未知时间'}) ---\n`;
        const settings = parsedResult.updatedCharacterSettings;
        if (settings && typeof settings === 'object') {
             settingString += `角色名称: ${settings.characterName || '未提供'}\n`;
             settingString += `更新时间: ${settings.updateTime || '未提供'}\n`;

            if (settings.baseInfo) {
                settingString += "[基础信息]\n";
                settingString += `  性别: ${settings.baseInfo.gender || '未提供'}\n`;
                settingString += `  身份: ${settings.baseInfo.identity || '未提供'}\n`;
                settingString += `  年龄: ${settings.baseInfo.age || '未提供'}\n`;
                if (settings.baseInfo.extra) settingString += `  额外: ${settings.baseInfo.extra}\n`;
            }
            if (settings.present) {
                settingString += "[当前特征]\n";
                if (Array.isArray(settings.present.personality)) {
                    settingString += "  性格:\n";
                    settings.present.personality.forEach(p => {
                        const examples = p.examples || {};
                        settingString += `    - ${p.traitName || '未知特质'}: ${examples.dialogue || ''} / [${examples.action || ''}] / (${examples.choice || ''})\n`;
                    });
                }
                if (Array.isArray(settings.present.physicalFeatures)) {
                    settingString += "  外貌特征:\n";
                    settings.present.physicalFeatures.forEach(f => settingString += `    - ${f}\n`);
                }
            }
            if (Array.isArray(settings.socialConnections)) {
                settingString += "[社交关系]\n";
                settings.socialConnections.forEach(c => {
                    settingString += `  - ${c.name || '未知姓名'}:\n`;
                    settingString += `    关系看法: ${c.relationship || '未提供'}\n`;
                    settingString += `    了解信息: ${c.fullUnderstanding || '未提供'}\n`;
                });
            }
            if (settings.supplementaryInfo) {
                settingString += "[补充信息]\n";
                settingString += `  ${settings.supplementaryInfo}\n`;
            }
        } else {
            settingString += "[无设定信息]\n";
        }

        return memoryString.trim() + uiChatModule.CHARACTER_SETTINGS_SEPARATOR + settingString.trim();
     },

     _getFormattedDisplayText: (parsedResult, roleType, roleName, parserError) => {
        if (parserError && !parsedResult) {
            return `[解析错误: ${parserError}]`;
        }
        if (!parsedResult) {
             return "[无法格式化：无解析结果]";
        }

        if (roleType === 'role' || roleType === 'temporary_role') {
            if (!parsedResult.turnActions || !Array.isArray(parsedResult.turnActions)) {
                 return parsedResult.text || (typeof parsedResult === 'string' ? parsedResult : "[角色/临时角色 无有效行动]");
            }
            return parsedResult.turnActions.map(action => {
                if (action.type === 'speech') {
                    return `“${action.content || ''}”`;
                } else if (action.type === 'action') {
                    return action.content || '';
                }
                return action.content || '';
            }).join('\n');
        } else if (roleType === 'tool') {
            if (roleName === 'writingMaster') {
                 return parsedResult.description || (typeof parsedResult === 'string' ? parsedResult : "[写作大师 无描述]");
            } else if (roleName === 'gameHost') {

                return '';
            } else if (roleName === 'drawingMaster') {
                 return "[生成图片]";
            } else if (roleName === 'characterUpdateMaster') {
                 return uiChatModule._formatCharacterUpdateMasterDisplay(parsedResult);
            }
            else {
                return parsedResult.text || (typeof parsedResult === 'string' ? parsedResult : JSON.stringify(parsedResult)) || "[未知工具]";
            }
        } else {
            return "[未知扮演类型]";
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

        if (roleType === 'tool' && roleName !== 'drawingMaster' && stateModule.config.toolSettings[roleName] && !stateModule.config.toolSettings[roleName].display) {
             if (messageContainer) {
                 messageContainer.style.display = 'none';
             }
        }

        if (roleName === 'gameHost') {
            if (messageContainer) {
                const messageId = messageContainer.dataset.messageId;
                const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
                if (messageObject) {
                     uiChatModule._renderGameHostContent(messageContainer, messageObject.activeView || 'time');
                }
            }

            let nextRoleToAct = null;
            let rolesToAdd = [];
            let rolesToRemove = [];
            let needsUIUpdate = false;
            let activateWritingMaster = false;

            if (parsedResult && typeof parsedResult === 'object') {
                 nextRoleToAct = parsedResult.nextRoleToAct || null;
                 rolesToAdd = Array.isArray(parsedResult.addRoles) ? parsedResult.addRoles : [];
                 rolesToRemove = Array.isArray(parsedResult.removeRoles) ? parsedResult.removeRoles : [];
                 activateWritingMaster = parsedResult.gameAnalysis?.writingMasterControl === 'activate';

                 const activeRoomName = stateModule.config.activeChatRoomName;
                 const room = activeRoomName ? stateModule.config.chatRooms.find(r => r.name === activeRoomName) : null;

                 if (rolesToAdd.length > 0 && room) {
                     rolesToAdd.forEach(roleNameToAdd => {
                         if (!roleNameToAdd || typeof roleNameToAdd !== 'string') return;
                         const trimmedName = roleNameToAdd.trim();
                         if (!trimmedName) return;

                         const isPermanent = stateModule.config.roles.includes(trimmedName);
                         const isTemporary = stateModule.config.temporaryRoles.includes(trimmedName);

                         if (isPermanent) {
                             if (!room.roles.includes(trimmedName)) {
                                 room.roles.push(trimmedName);
                                 needsUIUpdate = true;
                             }
                             if (stateModule.config.roleStates[trimmedName] !== '活') {
                                stateModule.config.roleStates[trimmedName] = '活';
                                needsUIUpdate = true;
                             }
                         } else if (isTemporary) {
                             if (stateModule.config.roleStates[trimmedName] !== '活') {
                                stateModule.config.roleStates[trimmedName] = '活';
                                needsUIUpdate = true;
                             }
                         } else {
                             if(uiChatModule.addTemporaryRole(trimmedName)) {
                                needsUIUpdate = true;
                             }
                         }
                     });
                 }

                 if (rolesToRemove.length > 0) {
                     rolesToRemove.forEach(roleNameToRemove => {
                         if (!roleNameToRemove || typeof roleNameToRemove !== 'string') return;
                         const trimmedName = roleNameToRemove.trim();
                         if (!trimmedName) return;

                         const isPermanent = stateModule.config.roles.includes(trimmedName);
                         const isTemporary = stateModule.config.temporaryRoles.includes(trimmedName);

                         if (isPermanent) {
                              if (stateModule.config.roleStates[trimmedName] !== '默') {
                                 stateModule.config.roleStates[trimmedName] = '默';
                                 needsUIUpdate = true;
                              }
                         } else if (isTemporary) {
                             if(uiChatModule.deleteTemporaryRole(trimmedName)) {
                                needsUIUpdate = true;
                             }
                         }
                     });
                 }
            }

            if (activateWritingMaster) {
                 apiModule.triggerRoleResponse('writingMaster');
            }

            if (nextRoleToAct) {
                 const targetRoleState = stateModule.config.roleStates[nextRoleToAct];
                 const activeChatroom = stateModule.config.chatRooms.find(room => room.name === stateModule.config.activeChatRoomName);
                 const isRoleValid = (stateModule.config.roles.includes(nextRoleToAct) || stateModule.config.temporaryRoles.includes(nextRoleToAct)) && activeChatroom && activeChatroom.roles.includes(nextRoleToAct);

                 if (isRoleValid) {
                     if (targetRoleState === uiChatModule.ROLE_STATE_ACTIVE) {
                         apiModule.triggerRoleResponse(nextRoleToAct);
                     } else if (targetRoleState === uiChatModule.ROLE_STATE_USER_CONTROL) {
                         uiChatModule.setPauseState(true);
                         uiChatModule._createPlaceholderMessageForRole(nextRoleToAct);
                     }
                 } else {

                 }
            }

            if (needsUIUpdate) {
                uiChatModule.updateRoleButtonsList();
                updateChatContextCache();
                if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                }
                if (document.getElementById('chatroom-role-page')?.classList.contains('active') && stateModule.currentChatRoom) {
                   const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                   if (room) uiSettingsModule.updateChatroomRolePage(room);
                }
            }

        } else if ((roleType === 'role' || roleType === 'temporary_role')) {
            apiModule.triggerRoleResponse('gameHost');

            if (roleType === 'role') {
                 const roleData = await roleDataManager.getRoleData(roleName);
                 const drawingTemplate = roleData?.drawingTemplate;
                 if (drawingTemplate && stateModule.config.toolSettings.drawingMaster?.enabled) {
                     apiModule.triggerRoleResponse('drawingMaster');
                 }
            }
        } else if (roleName === 'drawingMaster' && parsedResult) {
            const rawJsonText = messageContainer?.dataset?.rawJsonText || JSON.stringify(parsedResult);
            try {
                 const naiPayload = await apiModule._prepareNovelAiPayload(parsedResult, rawJsonText);
                 if (naiPayload) {
                     const messageId = messageContainer ? messageContainer.dataset.messageId : null;
                     apiModule.addNaiRequestToQueue(naiPayload, messageId);
                 }
            } catch (e) {
                 _logAndDisplayError(`Error preparing or queuing NovelAI request: ${e.message}`, '_handlePostResponseActions');
            }
         }

        uiChatModule.updateChatroomHistoryDisplay();
        uiChatModule.triggerDebouncedHistorySave();
    },

    displayAIResponse: (responseData, roleName, targetRoleName = null) => {

        const timestamp = Date.now();
        let roleType = 'role';
        if (roleName && toolNameMap.hasOwnProperty(roleName)) { roleType = 'tool'; }
        else if (roleName && stateModule.config.temporaryRoles.includes(roleName)) { roleType = 'temporary_role'; }

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
            const formattedText = uiChatModule._getFormattedDisplayText(parsedResult, roleType, roleName, parserError);

            messageObject = {
                id: msgId,
                timestamp: timestamp,
                sourceType: 'ai',
                roleName: roleName,
                roleType: roleType,
                targetRoleName: targetRoleName,
                speechActionText: formattedText,
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
        if (!stateObj || typeof stateObj !== 'object') return '[状态对象无效]';
        let text = '';
        for (const key in stateObj) {
            if (stateObj.hasOwnProperty(key)) {
                 let value = stateObj[key];
                 if (typeof value === 'object' && value !== null) {
                      try { value = JSON.stringify(value); } catch(e) { value = '[无法序列化对象]'; }
                 }
                 text += `${key}: ${value}\n`;
            }
        }
        return text.trim() || '[状态对象为空]';
    },

    _createRoleNameButtonElement: (roleName, sourceType, messageContainer) => {
        const roleNameButton = document.createElement('div');
        roleNameButton.className = 'std-button role-name-button-above-bubble';
        let buttonText = '';

        if (roleName === 'characterUpdateMaster') { buttonText = '📇'; }
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

            if (roleName === 'characterUpdateMaster') {
                const saveButton = document.createElement('div');
                saveButton.className = 'std-button message-action-button save-character-update-button';
                saveButton.textContent = '💾';
                messageActionsContainer.appendChild(saveButton);
            }

            const messageId = messageContainer.dataset.messageId;
            const hasImage = stateModule.tempImageUrls[messageId];
            if (roleName === 'drawingMaster' && hasImage) {
                const redrawButton = document.createElement('div');
                redrawButton.className = 'std-button message-action-button redraw-button';
                redrawButton.textContent = '🖌️';
                messageActionsContainer.appendChild(redrawButton);
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
         if (value === null || value === undefined || value === '') return '';
         const span = document.createElement('span');
         span.className = 'value-block';
         span.textContent = String(value);
         return span.outerHTML;
     },

    _formatGameHostContent: (parsedResult, view) => {
        const createBlock = uiChatModule._createValueBlock;
        let content = '';

        if (!parsedResult || typeof parsedResult !== 'object') {
            return createBlock('[数据无效]');
        }

        const sceneContext = parsedResult.sceneContext;
        const characterInfo = parsedResult.updatedCharacterInfo;
        const icons = {
             map: '🗺️', people: '👥', name: '✨', demeanor: '😐', clothing: '👕', underwear: '👙',
             accessories: '💍', pose: '🤸', statusLong: '⚕️', statusShort: '🩹', action: '⚡'
        };

        const filterDefaults = (val) => val !== '无' && val !== '未设定' && val !== '';

        switch (view) {
            case 'time':
                content = `<div>${createBlock(sceneContext?.time || '[时间不可用]')}</div>`;
                break;
            case 'location':
                let locLine = `<div><span class="icon">${icons.map}</span>${createBlock(sceneContext?.location || '[未知地点]')}</div>`;
                let posLines = '';
                if (Array.isArray(sceneContext?.characterPositions)) {
                    posLines = sceneContext.characterPositions.map(p =>
                        `<div>${createBlock(`${p.name || '未知'}: ${p.relativePosition || '未知'}`)}</div>`
                    ).join('');
                } else {
                    posLines = `<div>${createBlock('[位置不可用]')}</div>`;
                }
                content = locLine + posLines;
                break;
            case 'character':
                if (!characterInfo) {
                    content = `<div>${createBlock('[角色信息不可用]')}</div>`;
                    break;
                }
                content += `<div><span class="icon">${icons.name}</span>${createBlock(characterInfo.characterName || '[未知名称]')}</div>`;
                if (characterInfo.demeanor) content += `<div><span class="icon">${icons.demeanor}</span>${createBlock(characterInfo.demeanor)}</div>`;

                let clothingItems = [];
                if (characterInfo.clothing?.outerwear) {
                     Object.values(characterInfo.clothing.outerwear).filter(filterDefaults).forEach(item => clothingItems.push(createBlock(item)));
                }
                if (clothingItems.length > 0) content += `<div><span class="icon">${icons.clothing}</span>${clothingItems.join(' ')}</div>`;

                let underwearItems = [];
                 if (characterInfo.clothing?.underwear) {
                     Object.values(characterInfo.clothing.underwear).filter(filterDefaults).forEach(item => underwearItems.push(createBlock(item)));
                 }
                 if (underwearItems.length > 0) content += `<div><span class="icon">${icons.underwear}</span>${underwearItems.join(' ')}</div>`;

                let accessoriesItems = [];
                if (Array.isArray(characterInfo.accessories)) {
                     characterInfo.accessories.filter(filterDefaults).forEach(item => accessoriesItems.push(createBlock(item)));
                }
                 if (accessoriesItems.length > 0) content += `<div><span class="icon">${icons.accessories}</span>${accessoriesItems.join(' ')}</div>`;

                let poseItems = [];
                if (Array.isArray(characterInfo.actionPose)) {
                    characterInfo.actionPose.filter(filterDefaults).forEach(item => poseItems.push(createBlock(item)));
                }
                if (poseItems.length > 0) content += `<div><span class="icon">${icons.pose}</span>${poseItems.join(' ')}</div>`;

                if (characterInfo.shortTermStatus) content += `<div><span class="icon">${icons.statusShort}</span>${createBlock(characterInfo.shortTermStatus)}</div>`;
                if (characterInfo.longTermStatus) content += `<div><span class="icon">${icons.statusLong}</span>${createBlock(characterInfo.longTermStatus)}</div>`;
                if (characterInfo.currentAction) content += `<div><span class="icon">${icons.action}</span>${createBlock(characterInfo.currentAction)}</div>`;

                break;
            default:
                content = `<div>${createBlock('[未知视图]')}</div>`;
        }
        return content;
    },

    _renderGameHostContent: (messageContainer, viewToShow) => {
         const contentDiv = messageContainer.querySelector('.game-host-content');
         const controlsDiv = messageContainer.querySelector('.game-host-controls');
         const statementDiv = messageContainer.querySelector('.game-host-statement');
         const editButton = messageContainer.querySelector('.edit-button');

         if (!contentDiv || !controlsDiv) return;

         const messageId = messageContainer.dataset.messageId;
         const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);

         if (!messageObject || messageObject.parserError) {
              contentDiv.innerHTML = uiChatModule._createValueBlock(messageObject?.parserError ? `[解析错误: ${messageObject.parserError}]` : "[无法加载数据]");
              if(statementDiv) statementDiv.style.display = 'none';

              controlsDiv.querySelectorAll('.game-host-view-button').forEach(btn => btn.classList.remove('active'));
              return;
         }

         contentDiv.innerHTML = uiChatModule._formatGameHostContent(messageObject.parsedResult, viewToShow);
         messageContainer.dataset.activeView = viewToShow;

         const isTimeView = viewToShow === 'time';

         if (statementDiv) {
              if (isTimeView) {
                  const statementText = messageObject.parsedResult?.actionOutcome?.statement || "";
                  statementDiv.textContent = statementText;
                  statementDiv.style.display = 'block';
              } else {
                  statementDiv.style.display = 'none';
              }
         }

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
             _logAndDisplayError("无法设置背景，没有激活的聊天室。", "handleSetBackgroundClick");
             return;
         }

         if (imageUrl) {
             apiModule.setBackgroundImage(activeRoomName, imageUrl);
             uiChatModule.hideAllMessageActions();
         } else if (!imageUrl) {
              _logAndDisplayError("无法设置背景，图片 URL 未找到。", "handleSetBackgroundClick");
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
              _logAndDisplayError("无法下载，图片 URL 未找到。", "handleDownloadImageLongPress");
         }
    },

    handleRedrawClick: async (msgCont) => {
        const messageId = msgCont.dataset.messageId;
        if (!messageId) return;

        const messageObject = stateModule.currentChatHistoryData.find(msg => msg.id === messageId);
        if (!messageObject || !messageObject.naiPayloadSource || messageObject.roleName !== 'drawingMaster') {
            _logAndDisplayError(`无法重绘：找不到消息 ${messageId} 的绘图大师原始数据。`, 'handleRedrawClick');
            return;
        }

        try {
            const naiPayload = await apiModule._prepareNovelAiPayload(messageObject.naiPayloadSource, messageObject.rawJson);
            if (naiPayload) {
                apiModule.addNaiRequestToQueue(naiPayload, messageId);
            }
        } catch (e) {
            _logAndDisplayError(`准备重绘请求时出错: ${e.message}`, 'handleRedrawClick');
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
        if (naiPayloadSource) messageContainer.dataset.naiPayloadSource = JSON.stringify(naiPayloadSource);
        if (rawJson) messageContainer.dataset.rawJsonText = rawJson;

        const isEmptyUserMsg = messageObject.sourceType === 'user' && (messageObject.speechActionText || '').trim() === '';
        if (isEmptyUserMsg) {
            messageContainer.classList.add('empty-user-message');
        }

        const roleNameButton = uiChatModule._createRoleNameButtonElement(roleName, sourceType, messageContainer);
        messageContainer.appendChild(roleNameButton);

        const messageDiv = document.createElement('div');
        messageDiv.className = sourceType === 'user' ? 'user-message' : 'ai-response';
        const isGameHost = roleName === 'gameHost' && sourceType === 'ai';
        const isDrawingMaster = roleName === 'drawingMaster' && sourceType === 'ai';

        let hasImage = false;
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

             const statementDiv = document.createElement('div');
             statementDiv.className = 'game-host-statement';
             statementDiv.style.marginTop = '3px';
             statementDiv.style.paddingTop = '3px';
             statementDiv.style.borderTop = '1px solid #c0a080';
             messageDiv.appendChild(statementDiv);

             const rawDiv = document.createElement('div');
             rawDiv.className = 'game-host-raw';
             rawDiv.style.display = 'none';
             rawDiv.textContent = rawJson || '';
             messageDiv.appendChild(rawDiv);

             if (displayMode === 'raw') {
                 controlsDiv.style.display = 'none';
                 contentDiv.style.display = 'none';
                 statementDiv.style.display = 'none';
                 rawDiv.style.display = 'block';
             } else {
                 uiChatModule._renderGameHostContent(messageContainer, currentActiveView);
             }
        } else if (isDrawingMaster) {
             const imageUrl = stateModule.tempImageUrls[id];
             if (imageUrl) {
                 const img = document.createElement('img');
                 img.src = imageUrl;
                 img.alt = speechActionText || "[AI 生成图片]";
                 img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                 messageDiv.innerHTML = '';
                 messageDiv.appendChild(img);
                 hasImage = true;
             } else {
                 messageDiv.textContent = speechActionText || "[图片加载中或错误]";
             }
        } else if (displayMode === 'raw' && sourceType === 'ai') {
             messageDiv.textContent = rawJson || '';
        } else {
             messageDiv.textContent = speechActionText;
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

        if (isDrawingMaster && displayMode === 'formatted') {

        }

        if (sourceType === 'ai' && stateModule.config.toolSettings[roleName] && !stateModule.config.toolSettings[roleName].display && !isDrawingMaster) {
             messageContainer.style.display = 'none';
        }
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
         const editButton = msgCont.querySelector('.edit-button');
         if (!div) return;

         const currentMode = messageObject.displayMode;
         const rawTextContent = messageObject.rawJson || '';

         if (currentMode === 'formatted') {
             messageObject.displayMode = 'raw';
             msgCont.dataset.displayMode = 'raw';
             if (isGameHost) {
                  const controlsDiv = div.querySelector('.game-host-controls');
                  const contentDiv = div.querySelector('.game-host-content');
                  const statementDiv = div.querySelector('.game-host-statement');
                  const rawDiv = div.querySelector('.game-host-raw');
                  if (controlsDiv) controlsDiv.style.display = 'none';
                  if (contentDiv) contentDiv.style.display = 'none';
                  if (statementDiv) statementDiv.style.display = 'none';
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
                  const rawDiv = div.querySelector('.game-host-raw');
                  if (controlsDiv) controlsDiv.style.display = 'flex';
                  if (rawDiv) rawDiv.style.display = 'none';
                  uiChatModule._renderGameHostContent(msgCont, messageObject.activeView || 'time');
             } else if (isDrawingMaster) {
                  const imageUrl = stateModule.tempImageUrls[messageId];
                  if (imageUrl) {
                      const img = document.createElement('img');
                      img.src = imageUrl;
                      img.alt = formattedText || "[AI 生成图片]";
                      img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                      div.innerHTML = '';
                      div.appendChild(img);
                  } else {
                      div.textContent = formattedText || "[图片加载中或错误]";
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
            const stateDiv = btn.nextElementSibling;
            if (stateDiv && stateDiv.classList.contains('role-state-buttons') && stateDiv.dataset.roleName === roleName) return btn;
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
        const activeView = msgCont.dataset.activeView;
        const displayMode = msgCont.dataset.displayMode;

        if (!div) return;

        let targetElement = div;
        if (isGameHost && displayMode !== 'raw') {
            if(activeView !== 'time') return;
            const statementDiv = msgCont.querySelector('.game-host-statement');
            if (!statementDiv) return;
            targetElement = statementDiv;
        } else if (isGameHost && displayMode === 'raw') {
             targetElement = msgCont.querySelector('.game-host-raw');
             if (!targetElement) targetElement = div;
        } else if (roleName === 'drawingMaster' && displayMode === 'formatted') {
             return;
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
                 targetElement.textContent = "[无法加载编辑内容]";
                 _logAndDisplayError(`Cannot find message data for ID ${messageId} during toggleMessageEditMode.`, 'toggleMessageEditMode');
                 return;
             }
            const messageObject = stateModule.currentChatHistoryData[messageIndex];

            uiChatModule.hideAllMessageActions();
            const mode = messageObject.displayMode;
            let editText = '';

            if (isGameHost && mode !== 'raw') {
                 editText = messageObject.parsedResult?.actionOutcome?.statement || '';
            } else if (mode === 'raw' && messageObject.sourceType === 'ai') {
                 editText = messageObject.rawJson || '';
                 if (isGameHost) {
                    targetElement = msgCont.querySelector('.game-host-raw');
                    if (!targetElement) targetElement = div;
                 }
            } else {
                 editText = messageObject.speechActionText || '';
                 if (editText === "[生成图片]") {
                      editText = messageObject.rawJson || "";
                      messageObject.displayMode = 'raw';
                      msgCont.dataset.displayMode = 'raw';
                      targetElement = div;
                 }
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
        const isGameHost = roleName === 'gameHost';
        const displayMode = msgCont.dataset.displayMode;
        let targetElement;

        if (isGameHost && displayMode !== 'raw') {
             targetElement = msgCont.querySelector('.game-host-statement');
        } else if (isGameHost && displayMode === 'raw') {
             targetElement = msgCont.querySelector('.game-host-raw');
        }
        else {
            targetElement = msgCont.querySelector('.user-message') || msgCont.querySelector('.ai-response');
        }

        if (!targetElement || targetElement.getAttribute('contenteditable') !== 'true') {
             if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
             return;
        }

        const newTxt = targetElement.innerText;
        const messageId = msgCont.dataset.messageId;
        let changed = false;

        const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);
         if (messageIndex === -1) {
             targetElement.removeAttribute('contenteditable');
             targetElement.style.backgroundColor = '';
             if (stateModule.editingMessageContainer === msgCont) stateModule.editingMessageContainer = null;
             _logAndDisplayError(`保存编辑失败: 找不到消息ID ${messageId}`, 'saveEditedMessage');
             return;
         }
        const messageObject = stateModule.currentChatHistoryData[messageIndex];
        const mode = messageObject.displayMode;
        const wasRaw = mode === 'raw';

        if (isGameHost && mode !== 'raw') {
            if (messageObject.parsedResult?.actionOutcome) {
                 const oldStatement = messageObject.parsedResult.actionOutcome.statement || '';
                 if (oldStatement !== newTxt) {
                     messageObject.parsedResult.actionOutcome.statement = newTxt;
                     changed = true;
                     targetElement.textContent = newTxt;
                 }
            } else {
                changed = false;
            }
        } else if (mode === 'raw' && messageObject.sourceType === 'ai') {
             const currentRaw = messageObject.rawJson || '';
             if (currentRaw !== newTxt) {
                 messageObject.rawJson = newTxt;
                 const { parsedResult, parserError } = uiChatModule._parseAIResponse(newTxt, messageObject.roleName, messageObject.roleType);
                 messageObject.parsedResult = parsedResult;
                 messageObject.parserError = parserError;
                 messageObject.speechActionText = uiChatModule._getFormattedDisplayText(parsedResult, messageObject.roleType, roleName, parserError);
                 changed = true;
             }
        } else {
            const previousSpeechActionText = messageObject.speechActionText;
            if (previousSpeechActionText !== newTxt) {
                messageObject.speechActionText = newTxt;
                targetElement.textContent = newTxt;
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

        if (changed && wasRaw) {
             messageObject.displayMode = 'formatted';
             msgCont.dataset.displayMode = 'formatted';
             const mainDiv = msgCont.querySelector('.ai-response');
             if (roleName === 'drawingMaster') {
                const imageUrl = stateModule.tempImageUrls[messageId];
                if (imageUrl) {
                    const img = document.createElement('img'); img.src = imageUrl; img.alt = messageObject.speechActionText;
                    img.addEventListener('click', (event) => uiChatModule.showImageViewer(event.target.src));
                    mainDiv.innerHTML = ''; mainDiv.appendChild(img);
                } else { mainDiv.textContent = messageObject.speechActionText || "[图片加载中或错误]"; }
             } else if (isGameHost) {
                const controlsDiv = mainDiv.querySelector('.game-host-controls');
                const rawDiv = mainDiv.querySelector('.game-host-raw');
                if (controlsDiv) controlsDiv.style.display = 'flex';
                if (rawDiv) rawDiv.style.display = 'none';
                uiChatModule._renderGameHostContent(msgCont, messageObject.activeView || 'time');
             } else {
                 mainDiv.textContent = messageObject.speechActionText;
             }
        }

        const isNowEmptyUserMsg = messageObject.sourceType === 'user' && (messageObject.speechActionText || '').trim() === '';
        msgCont.classList.toggle('empty-user-message', isNowEmptyUserMsg);

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
             let savedParsedResult;
             try {
                 savedParsedResult = msg.parsedResult ? JSON.stringify(msg.parsedResult) : null;
             } catch (e) {
                  savedParsedResult = JSON.stringify({ error: `Serialization failed: ${e.message}` });
                  _logAndDisplayError(`Failed to stringify parsedResult for msg ${msg.id}: ${e.message}`, 'saveChatHistoryToServer');
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

             if (msg.roleName === 'drawingMaster' && msg.sourceType === 'ai' && msg.speechActionText === '[生成图片]' && !msg.parserError) {
                 delete savedMsg.parsedResult;
             }
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
                    msg.speechActionText = `[加载时解析错误: ${e.message}]`;
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

             if (messageObject.roleName === 'drawingMaster' && messageObject.sourceType === 'ai' && !messageObject.parserError && !naiPayloadSource) {
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
             if (roleType === 'role' || roleType === 'temporary_role') {
                 const actorName = roleName || (messageObject.sourceType === 'user' ? 'User' : 'AI');
                 let content = (messageObject.speechActionText || '').trim();
                 if (content && content !== "[生成图片]") {
                    lines.push(`${actorName}：\n${content}`);
                 }
             } else if (roleName === 'gameHost' && messageObject.sourceType === 'ai') {
                 const statement = messageObject.parsedResult?.actionOutcome?.statement;
                 if (statement && typeof statement === 'string' && statement.trim() !== '') {
                     lines.push(`[结果]: ${statement.trim()}`);
                 }
             }
        });
        historyText = lines.join('\n');
        if (elementsModule.chatroomHistoryDisplay) {
            elementsModule.chatroomHistoryDisplay.value = historyText;
        }
    },

    getLatestRoleStateText: (name) => {
        if (stateModule.chatContextCache) {
             return stateModule.chatContextCache.roleStates[name] || `[${name} 状态未在缓存中]`;
        }
        return `[${name} 状态未获取 - 缓存为空]`;
    },

    toggleRunPause: function() {
        const wasPaused = stateModule.config.isRunPaused;
        stateModule.config.isRunPaused = !stateModule.config.isRunPaused;
        elementsModule.runPauseButton.textContent = stateModule.config.isRunPaused ? '▶' : '◼';
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }

        if (wasPaused && !stateModule.config.isRunPaused) {
            if (stateModule.config.toolSettings.gameHost?.enabled) {
                apiModule.triggerRoleResponse('gameHost');
            }

            const lastMessage = stateModule.currentChatHistoryData.length > 0 ? stateModule.currentChatHistoryData[stateModule.currentChatHistoryData.length - 1] : null;

            if (lastMessage && lastMessage.roleType === 'role') {
                const roleName = lastMessage.roleName;
                roleDataManager.getRoleData(roleName).then(roleData => {
                    if (roleData && roleData.drawingTemplate && stateModule.config.toolSettings.drawingMaster?.enabled) {
                        apiModule.triggerRoleResponse('drawingMaster');
                    }
                }).catch(error => {
                    _logAndDisplayError(`Error checking drawing template for ${roleName} on resume: ${error.message}`, 'toggleRunPause');
                });
            }
        }
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

    updateRoleButtonsList: () => {
        const frag = document.createDocumentFragment();
        const activeRoomName = stateModule.config.activeChatRoomName;
        const usedChars = new Set();
        const roleData = [];

        if (activeRoomName) {
            const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
            if (room && Array.isArray(room.roles)) {
                const rolesInRoom = room.roles.filter(name =>
                    stateModule.config.roles.includes(name) || stateModule.config.temporaryRoles.includes(name)
                ).sort((a, b) => {
                    const aIsTemp = stateModule.config.temporaryRoles.includes(a);
                    const bIsTemp = stateModule.config.temporaryRoles.includes(b);
                    if (aIsTemp && !bIsTemp) return -1;
                    if (!aIsTemp && bIsTemp) return 1;
                    if (a === "管理员") return -1;
                    if (b === "管理员") return 1;
                    return a.localeCompare(b);
                });

                rolesInRoom.forEach(name => {
                    if (!name) return;
                    const char1 = name.charAt(0).toUpperCase();
                    let charToUse = null;
                    if (name === "管理员") {
                         charToUse = '📏';
                    } else if (!usedChars.has(char1)) {
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
                    roleData.push({ name, char: charToUse });
                });

                roleData.forEach(({ name, char }) => {
                    const isTemporary = stateModule.config.temporaryRoles.includes(name);
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
        }
        elementsModule.roleButtonsListContainer.innerHTML = '';
        elementsModule.roleButtonsListContainer.appendChild(frag);

        const roleButtonContainers = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container');
        roleButtonContainers.forEach(container => {
            const mainButton = container.querySelector('.std-button');
            const stateButtons = container.querySelectorAll('.role-state-button');
            const roleName = mainButton.dataset.roleName;

            const mainShortPress = () => uiChatModule.toggleRoleStateButtons(roleName);
            const mainLongPress = () => {
                if (stateModule.config.roles.includes(roleName)) {
                     if (!elementsModule.settingsPanel.classList.contains('active')) {
                         uiSettingsModule.toggleSettings();
                     }
                     uiSettingsModule.showRoleDetailPage(roleName);
                     uiChatModule.hideRoleStateButtons();
                     if (stateModule.config.isRoleListVisible) uiChatModule.toggleRoleList();
                } else if (roleName !== "管理员" && stateModule.config.temporaryRoles.includes(roleName)) {
                     const deleted = uiChatModule.deleteTemporaryRole(roleName);
                     if (deleted) {
                         uiChatModule.updateRoleButtonsList();
                         mainModule.triggerDebouncedSave();
                     }
                     uiChatModule.hideRoleStateButtons();
                }
            };
            if (mainButton) eventListenersModule._setupLongPressListener(mainButton, mainShortPress, mainLongPress, true);

            stateButtons.forEach(sBtn => {
                const state = sBtn.dataset.state;
                const stateShortPress = () => uiChatModule.selectRoleState(roleName, state);
                let stateLongPress = null;
                if (state === uiChatModule.ROLE_STATE_USER_CONTROL) {
                    stateLongPress = () => {
                        uiChatModule.createAndEditMessageForRole(roleName);
                        uiChatModule.hideRoleStateButtons();
                    };
                } else if (state === uiChatModule.ROLE_STATE_DEFAULT) {
                     stateLongPress = () => uiChatModule.handleDefaultStateLongPress(roleName);
                }
                if (sBtn) eventListenersModule._setupLongPressListener(sBtn, stateShortPress, stateLongPress, true);
            });
        });

        roleData.forEach(({ name }) => {
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
    },

    selectRoleState: (name, state) => {
        if (state === uiChatModule.ROLE_STATE_UPDATE) {
             if (name === "管理员") {
                 return;
             }
             apiModule.triggerCharacterUpdateForRole(name);

        } else {
            stateModule.config.roleStates[name] = state;
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
            uiChatModule.updateRoleStateButtonVisual(name);
            updateChatContextCache();
        }
        uiChatModule.hideRoleStateButtons();
    },

    handleDefaultStateLongPress: (roleName) => {
        if (!stateModule.config.roles.includes(roleName)) {
            return;
        }
        const activeRoomName = stateModule.config.activeChatRoomName;
        if (!activeRoomName) {
            return;
        }
        uiSettingsModule.updateChatroomRoles(activeRoomName, roleName, false);
        uiChatModule.updateRoleButtonsList();
        updateChatContextCache();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
        uiChatModule.hideRoleStateButtons();
    },

    updateRoleStateButtonVisual: (name) => {
        const div = document.querySelector(`.role-state-buttons[data-role-name="${name}"]`);
        if (div) {
            const currentState = stateModule.config.roleStates[name] || uiChatModule.ROLE_STATE_DEFAULT;
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
        const roomName = stateModule.config.activeChatRoomName;
        if (!roomName) { _logAndDisplayError("请先选择一个激活的聊天室。", "createAndEditMessageForRole"); return; }
        const room = stateModule.config.chatRooms.find(r => r.name === roomName);
        const isTemporaryRole = stateModule.config.temporaryRoles.includes(roleName);
        const isRole = stateModule.config.roles.includes(roleName);

        if (!isTemporaryRole && !isRole) {
             _logAndDisplayError(`角色或临时角色 "${roleName}" 定义不存在。`, "createAndEditMessageForRole"); return;
        }
         if (!room || !Array.isArray(room.roles) || !room.roles.includes(roleName)) {
             _logAndDisplayError(`"${roleName}" 不在当前聊天室或聊天室无效。`, "createAndEditMessageForRole"); return;
         }
        const msgId = uiChatModule._generateMessageId();
        const timestamp = Date.now();
        const roleType = isTemporaryRole ? 'temporary_role' : 'role';
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

    _createPlaceholderMessageForRole: (roleName) => {
        const roomName = stateModule.config.activeChatRoomName;
        if (!roomName) { _logAndDisplayError("请先选择一个激活的聊天室。", "_createPlaceholderMessageForRole"); return; }
        const room = stateModule.config.chatRooms.find(r => r.name === roomName);
        const isTemporaryRole = stateModule.config.temporaryRoles.includes(roleName);
        const isRole = stateModule.config.roles.includes(roleName);

        if (!isTemporaryRole && !isRole) {
             _logAndDisplayError(`角色或临时角色 "${roleName}" 定义不存在。`, "_createPlaceholderMessageForRole"); return;
        }
         if (!room || !Array.isArray(room.roles) || !room.roles.includes(roleName)) {
             _logAndDisplayError(`"${roleName}" 不在当前聊天室或聊天室无效。`, "_createPlaceholderMessageForRole"); return;
         }
        const msgId = uiChatModule._generateMessageId();
        const timestamp = Date.now();
        const roleType = isTemporaryRole ? 'temporary_role' : 'role';
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

    },

    createAdminMessage: () => {
        const roomName = stateModule.config.activeChatRoomName;
        if (!roomName) {
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

    addTemporaryRole: (roleName) => {
        if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
            _logAndDisplayError("添加失败：名称不能为空。", 'addTemporaryRole');
            return false;
        }
        const trimmedName = roleName.trim();
        if (stateModule.config.roles.includes(trimmedName) || stateModule.config.temporaryRoles.includes(trimmedName)) {
            _logAndDisplayError(`添加失败：名称 "${trimmedName}" 已存在。`, 'addTemporaryRole');
            return false;
        }
        stateModule.config.temporaryRoles.push(trimmedName);
        stateModule.config.roleStates[trimmedName] = uiChatModule.ROLE_STATE_ACTIVE;

        const activeRoomName = stateModule.config.activeChatRoomName;
        if(activeRoomName) {
            const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
            if(room && Array.isArray(room.roles)) {
                if (!room.roles.includes(trimmedName)) {
                     room.roles.push(trimmedName);
                }
            }
        }

        return true;
    },

    deleteTemporaryRole: (roleName) => {
         if (roleName === "管理员") {
             _logAndDisplayError("不能删除管理员角色。", 'deleteTemporaryRole');
             return false;
         }
         const index = stateModule.config.temporaryRoles.indexOf(roleName);
         if (index === -1) {
             _logAndDisplayError(`删除失败：临时角色 "${roleName}" 不存在。`, 'deleteTemporaryRole');
             return false;
         }
         stateModule.config.temporaryRoles.splice(index, 1);
         delete stateModule.config.roleStates[roleName];

         const activeRoomName = stateModule.config.activeChatRoomName;
         if(activeRoomName) {
             const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
             if(room && Array.isArray(room.roles)) {
                 const roomIndex = room.roles.indexOf(roleName);
                 if (roomIndex > -1) {
                     room.roles.splice(roomIndex, 1);
                 }
             }
         }

         return true;
    },

    handleNovelAiResponse: (responseData, originalDrawingMasterData, rawJsonText, targetMessageId = null) => {

        if (responseData.error) {
             _logAndDisplayError(`NovelAI 错误: ${responseData.error}`, 'handleNovelAiResponse');
             return;
        }

        if (!responseData.imageDataUrl) {
             _logAndDisplayError("[NovelAI 返回了未知响应或无图片数据]", 'handleNovelAiResponse');
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
                      _logAndDisplayError(`在消息 ${targetMessageId} 中未找到图片元素以进行替换。`, 'handleNovelAiResponse');
                 }

                 const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === targetMessageId);
                 if (messageIndex > -1) {
                     stateModule.currentChatHistoryData[messageIndex].timestamp = Date.now();
                     stateModule.currentChatHistoryData[messageIndex].naiPayloadSource = originalDrawingMasterData || null;
                     stateModule.currentChatHistoryData[messageIndex].rawJson = rawJsonText || JSON.stringify(originalDrawingMasterData || {});
                 }
                 uiChatModule.triggerDebouncedHistorySave();
             } else {
                  _logAndDisplayError(`无法找到用于重绘的目标消息 ${targetMessageId}。`, 'handleNovelAiResponse');
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
                speechActionText: "[生成图片]",
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
                         const redrawBtn = actionsContainer.querySelector('.redraw-button');
                          if(redrawBtn) {
                               actionsContainer.insertBefore(bgButton, redrawBtn);
                          } else {
                               const deleteBtn = actionsContainer.querySelector('.delete-button');
                               if(deleteBtn) {
                                   actionsContainer.insertBefore(backgroundButton, deleteBtn);
                               } else {
                                    actionsContainer.appendChild(backgroundButton);
                               }
                          }
                     }
                 }
            }
            uiChatModule.triggerDebouncedHistorySave();
        }
    }
};