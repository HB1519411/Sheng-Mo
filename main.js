const mainModule = {
    debounceTimer: null,
    debounceDelay: 1500,

    debounce: (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    },

    triggerDebouncedSave: () => {
        clearTimeout(mainModule.debounceTimer);
        mainModule.debounceTimer = setTimeout(() => {
            configModule.autoSaveConfig();
        }, mainModule.debounceDelay);
    }
};


const initializationModule = {

    _initializeApiSettingsUI: () => {
        uiSettingsModule.loadApiKeysSetting();
        uiSettingsModule.updateApiKeyFailureCountsDisplay();
        const googleKeys = apiKeyManager.getApiKeys();
        if (googleKeys.length > 0) {
             apiModule.fetchModels().then(() => {
                 uiSettingsModule.loadSettingValue('primaryModel');
                 uiSettingsModule.loadSettingValue('secondaryModel');
             });
        } else {
             elementsModule.primaryModelSelectSettings.innerHTML = '<option value="" disabled selected>请输入 API 密钥</option>';
             elementsModule.secondaryModelSelectSettings.innerHTML = '<option value="" disabled selected>请输入 API 密钥</option>';
        }
    },

    _initializeNovelAiSettingsUI: () => {
        uiSettingsModule.loadNovelAiSettings();
        uiSettingsModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
    },

    _initializeGeneralSettingsUI: () => {
        ['temperature', 'topP', 'topK', 'maxOutputTokens', 'systemInstruction',
         'responseSchemaJson', 'responseSchemaParserJs', 'responseMimeType',
         'user1Instruction', 'user2Instruction', 'model1Instruction', 'model2Instruction', 'user3Instruction',
         'referenceTextLength'
        ].forEach(key => uiSettingsModule.loadSettingValue(key));
    },

    _initializeToolSettingsUI: () => {
        ['drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster'].forEach(toolName => {
            uiSettingsModule.loadGodSettings(toolName);
        });
    },

    _initializeRoleListUI: () => {
        uiSettingsModule.updateRoleList();
    },

    _initializeNovelListUI: () => {
        uiSettingsModule.updateNovelList();
    },


    _initializeChatroomUI: () => {

        stateModule.config.chatRooms.forEach(room => {
            if (!Array.isArray(room.roles)) room.roles = [];
            const currentTemporaryRoles = stateModule.config.temporaryRoles || ["管理员"];
            room.roles = [...new Set([...room.roles, ...currentTemporaryRoles])];
            if (typeof room.roleplayRules !== 'string') room.roleplayRules = "";
            if (typeof room.publicInfo !== 'string') room.publicInfo = "";
            if (typeof room.backgroundImagePath !== 'string' && room.backgroundImagePath !== null) room.backgroundImagePath = null;
        });

        stateModule.config.chatRooms = stateModule.config.chatRooms.filter(room => room && room.name);
        uiSettingsModule.updateChatroomList();

        let initialChatroom = null;
        if (stateModule.config.activeChatRoomName && stateModule.config.chatRooms.some(r => r.name === stateModule.config.activeChatRoomName)) {
             initialChatroom = stateModule.config.activeChatRoomName;
        } else if (stateModule.config.chatRooms.length > 0) {
             initialChatroom = stateModule.config.chatRooms[0].name;
             stateModule.config.activeChatRoomName = initialChatroom;
        }

        if (initialChatroom) {
             uiChatModule.loadChatHistory(initialChatroom);
             const radio = document.getElementById(`chatroom-${initialChatroom}`);
             if (radio) radio.checked = true;
        } else {
             uiChatModule.clearChatArea();
             stateModule.config.activeChatRoomName = null;
        }
        uiChatModule.updateChatroomHistoryDisplay();
         updateChatContextCache();
         uiSettingsModule.updateWorldInfoDisplay();
    },

    _initializeTopToolbarUI: () => {
        elementsModule.runPauseButton.textContent = stateModule.config.isRunPaused ? '▶' : '◼';
        elementsModule.roleButtonsListContainer.style.display = stateModule.config.isRoleListVisible ? 'flex' : 'none';
        uiChatModule.updateRoleButtonsList();
    },

    _initializeErrorLogUI: () => {
        uiSettingsModule.displayErrorLog(stateModule.config.errorLogs);
    },

    _initializeNovelInterfaceUI: () => {
        elementsModule.novelInterface.classList.remove('active');
        stateModule.isNovelInterfaceVisible = false;
        uiSettingsModule.novelUI_hideAllNovelPages();
        stateModule.novelPageStack = [];
        stateModule.activeNovelPage = null;
        stateModule.currentNovelId = null;
        if (!stateModule.config.novelCurrentSegmentIds) {
            stateModule.config.novelCurrentSegmentIds = {};
        }
        stateModule.currentTocIndexByNovel = {};

        let shouldLoadNovel = false;
        if (stateModule.config.lastViewedNovelId) {
            const activeRoomName = stateModule.config.activeChatRoomName;
            const activeRoom = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
            const isAssociated = activeRoom?.associatedNovelIds?.includes(stateModule.config.lastViewedNovelId);
            const novelExists = stateModule.config.novels.some(n => n.id === stateModule.config.lastViewedNovelId);

            if (isAssociated && novelExists) {
                stateModule.currentNovelId = stateModule.config.lastViewedNovelId;
                shouldLoadNovel = true;
            } else {
                 stateModule.config.lastViewedNovelId = null;
            }
        }

        if (shouldLoadNovel) {

        } else if (elementsModule.novelContentDisplay) {
             elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
             elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
        }
    },

    _initializeBackground: () => {
        const activeRoomName = stateModule.config.activeChatRoomName;
        let backgroundPath = null;
        if (activeRoomName) {
            const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
            backgroundPath = room?.backgroundImagePath;
        }
        if (backgroundPath && elementsModule.chatContainer) {
            elementsModule.chatContainer.style.backgroundImage = `url(${backgroundPath}?t=${Date.now()})`;
        } else if (elementsModule.chatContainer) {
            elementsModule.chatContainer.style.backgroundImage = '';
        }
    },

    initializeConfig: () => {
        initializationModule._initializeApiSettingsUI();
        initializationModule._initializeNovelAiSettingsUI();
        initializationModule._initializeGeneralSettingsUI();
        initializationModule._initializeToolSettingsUI();
        initializationModule._initializeRoleListUI();
        initializationModule._initializeNovelListUI();
        initializationModule._initializeChatroomUI();
        initializationModule._initializeTopToolbarUI();
        initializationModule._initializeErrorLogUI();
        initializationModule._initializeNovelInterfaceUI();
        initializationModule._initializeBackground();

        uiSettingsModule.hideAllSettingPages();
        elementsModule.settingsPanel.classList.remove('active');
        stateModule.pageStack = [];

    },
};

const eventListenersModule = {
    _longPressTimeout: null,
    _isLongPress: false,
    _longPressDelay: 500,
    _pressStartTime: 0,
    _longPressTargetElement: null,

    _isFullscreen: () => {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    },

    _requestFullscreen: () => {
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    },

    _exitFullscreen: () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    },

    _toggleFullscreen: () => {
        if (eventListenersModule._isFullscreen()) {
            eventListenersModule._exitFullscreen();
        } else {
            eventListenersModule._requestFullscreen();
        }
    },

    _setupLongPressListener: (element, shortPressAction, longPressAction, allowScroll = false) => {
        let pressStartX, pressStartY, isScrolling = false, moved = false;

        const handlePressStart = (event) => {
            eventListenersModule._pressStartTime = Date.now();
            eventListenersModule._isLongPress = false;
            eventListenersModule._longPressTargetElement = element;
            isScrolling = false;
            moved = false;

            const touch = event.touches ? event.touches[0] : event;
            pressStartX = touch.clientX;
            pressStartY = touch.clientY;

            clearTimeout(eventListenersModule._longPressTimeout);
            eventListenersModule._longPressTimeout = setTimeout(() => {
                if (!isScrolling && !moved) {
                    eventListenersModule._isLongPress = true;
                    if (longPressAction) longPressAction();
                    eventListenersModule._longPressTargetElement = null;
                }
            }, eventListenersModule._longPressDelay);

            if (!allowScroll && event.type === 'touchstart') {
                event.preventDefault();
            }
        };

         const handleMove = (event) => {
            if (!eventListenersModule._longPressTargetElement || eventListenersModule._isLongPress) return;

            const touch = event.touches ? event.touches[0] : event;
            const deltaX = Math.abs(touch.clientX - pressStartX);
            const deltaY = Math.abs(touch.clientY - pressStartY);
            const SCROLL_THRESHOLD = 10;
            moved = true;

            if (deltaY > SCROLL_THRESHOLD && deltaY > deltaX * 1.5) {
                isScrolling = true;
                clearTimeout(eventListenersModule._longPressTimeout);
            }
             else if (deltaX > SCROLL_THRESHOLD && deltaX > deltaY * 1.5) {
                isScrolling = true;
                clearTimeout(eventListenersModule._longPressTimeout);
             }
        };

        const handlePressEnd = (event, isTouchEvent) => {
            const wasTarget = (element === eventListenersModule._longPressTargetElement);
            clearTimeout(eventListenersModule._longPressTimeout);

            if (wasTarget && !eventListenersModule._isLongPress && !isScrolling && !moved) {
                if (shortPressAction) shortPressAction();
                if (isTouchEvent) {
                    event.preventDefault();
                }
            }


            eventListenersModule._isLongPress = false;
            eventListenersModule._longPressTargetElement = null;
            isScrolling = false;
            moved = false;
        };

        const handlePressLeave = (event) => {
            if (element === eventListenersModule._longPressTargetElement && !isScrolling) {
                clearTimeout(eventListenersModule._longPressTimeout);

            }
        };

        const handlePressCancel = (event) => {
             clearTimeout(eventListenersModule._longPressTimeout);
             eventListenersModule._pressStartTime = 0;
             eventListenersModule._isLongPress = false;
             eventListenersModule._longPressTargetElement = null;
             isScrolling = false;
             moved = false;
        };


        const touchPassiveOption = allowScroll ? { passive: true } : { passive: false };
        element.removeEventListener('mousedown', handlePressStart);
        element.removeEventListener('mouseup', handlePressEnd);
        element.removeEventListener('mouseleave', handlePressLeave);
        element.removeEventListener('touchstart', handlePressStart);
        element.removeEventListener('touchmove', handleMove);
        element.removeEventListener('touchend', handlePressEnd);
        element.removeEventListener('touchcancel', handlePressCancel);

        element.addEventListener('mousedown', handlePressStart);
        element.addEventListener('mouseup', (e) => handlePressEnd(e, false));
        element.addEventListener('mouseleave', handlePressLeave);
        element.addEventListener('touchstart', handlePressStart, touchPassiveOption);
        element.addEventListener('touchmove', handleMove, { passive: true });
        element.addEventListener('touchend', (e) => handlePressEnd(e, true));
        element.addEventListener('touchcancel', handlePressCancel);
    },


    setupEventListeners: () => {

        eventListenersModule._setupLongPressListener(
            elementsModule.settingsIcon,
            () => uiSettingsModule.toggleSettings(),
            () => eventListenersModule._toggleFullscreen(),
            false
        );

        eventListenersModule._setupLongPressListener(
             elementsModule.roleButton,
             () => uiChatModule.toggleRoleList(),
             () => {
                 if (!elementsModule.settingsPanel.classList.contains('active')) {
                      uiSettingsModule.toggleSettings();
                 }
                 uiSettingsModule.showSection('role-list-page');
                 if (stateModule.config.isRoleListVisible) uiChatModule.toggleRoleList();
             },
             false
        );


        elementsModule.settingsMenuItems.forEach(item => item.addEventListener('click', () => uiSettingsModule.showSection(item.dataset.target)));
        elementsModule.roleSettingsMenuItems.forEach(item => item.addEventListener('click', () => uiSettingsModule.showSection(item.dataset.target)));
        elementsModule.chatRoomSettingsMenuItems.forEach(item => item.addEventListener('click', () => uiSettingsModule.showSection(item.dataset.target)));
        elementsModule.chatroomDetailSettingsMenuItems.forEach(item => item.addEventListener('click', () => uiSettingsModule.showSection(item.dataset.target)));
        elementsModule.closeButtons.forEach(button => button.addEventListener('click', () => uiSettingsModule.closeCurrentSection(button.closest('.setting-page-template').id)));
        if (elementsModule.storyModeMenuItem) {
            elementsModule.storyModeMenuItem.addEventListener('click', () => uiSettingsModule.showSection(elementsModule.storyModeMenuItem.dataset.target));
        }


        elementsModule.clearErrorLogButton.addEventListener('click', uiSettingsModule.clearErrorLogDisplay);
        elementsModule.copyErrorLogButton.addEventListener('click', uiSettingsModule.copyErrorLog);
        elementsModule.clearAllConfigButton.addEventListener('click', uiSettingsModule.clearAllConfiguration);
        elementsModule.exportConfigButton.addEventListener('click', () => { window.location.href = '/export-full-config-zip'; });
        elementsModule.importConfigButton.addEventListener('click', () => { elementsModule.importConfigFile.click(); });
        elementsModule.importConfigFile.addEventListener('change', uiSettingsModule.handleImportConfig);


        elementsModule.apiKeyTextareaSettings.addEventListener('change', uiSettingsModule.saveApiKeysSetting);
        elementsModule.primaryModelSelectSettings.addEventListener('change', uiSettingsModule.savePrimaryModelSetting);
        elementsModule.secondaryModelSelectSettings.addEventListener('change', uiSettingsModule.saveSecondaryModelSetting);


        ['temperature', 'topP', 'topK', 'maxOutputTokens', 'systemInstruction', 'responseSchemaJson', 'responseSchemaParserJs', 'responseMimeType', 'user1Instruction', 'user2Instruction', 'model1Instruction', 'model2Instruction', 'user3Instruction'].forEach(key => {
            const el = elementsModule[`${key}Settings`];
            if (el) el.addEventListener('change', () => {
                stateModule.config[key] = el.value;
                mainModule.triggerDebouncedSave();
            });
        });
         if (elementsModule.referenceTextLengthSettings) {
             elementsModule.referenceTextLengthSettings.addEventListener('change', uiSettingsModule.saveReferenceTextLengthSetting);
         }


        const novelaiKeys = [
            "novelaiApiKey", "novelaiModel", "novelaiArtistChain",
            "novelaiDefaultPositivePrompt", "novelaiDefaultNegativePrompt",
            "novelaiWidth", "novelaiHeight", "novelaiSteps", "novelaiScale",
            "novelaiCfgRescale", "novelaiSampler", "novelaiNoiseSchedule", "novelaiSeed"
        ];
        novelaiKeys.forEach(key => {
            const el = elementsModule[`${key}Settings`];
            if (el) {
                const changeHandler = () => { uiSettingsModule.saveNovelAiSetting(key); };
                el.addEventListener('change', changeHandler);
                if (el.type === 'number' || el.tagName === 'TEXTAREA' || el.type === 'password' || el.type === 'text') {
                    el.addEventListener('input', changeHandler);
                }
            }
        });


        elementsModule.toolListMenuItems.forEach(item => item.addEventListener('click', () => uiSettingsModule.showSection(item.dataset.target)));
        ['drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster'].forEach(godName => {
            const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'user2Instruction', 'enabled', 'display'];
            settings.forEach(settingType => {
                const elId = `${godName}${settingType.charAt(0).toUpperCase() + settingType.slice(1)}Settings`;
                const el = elementsModule[elId];
                if (el) el.addEventListener('change', () => uiSettingsModule.saveGodSettings(godName));
            });
        });


        elementsModule.roleInstructionTextarea.addEventListener('change', () => { if (stateModule.currentRole) uiSettingsModule.saveRoleSettings(stateModule.currentRole); });
        elementsModule.roleMemoryTextarea.addEventListener('change', () => { if (stateModule.currentRole) uiSettingsModule.saveRoleSettings(stateModule.currentRole); });
        elementsModule.roleDrawingTemplateSettings.addEventListener('change', () => { if (stateModule.currentRole) uiSettingsModule.saveRoleSettings(stateModule.currentRole); });
        elementsModule.addRoleButton.addEventListener('click', uiSettingsModule.addRole);
        elementsModule.roleListContainer.addEventListener('click', (event) => {
             const targetButton = event.target.closest('.item-actions > .std-button');
             if (!targetButton) return;

             const roleItem = targetButton.closest('.role-item');
             if (!roleItem) return;
             const roleName = roleItem.dataset.roleName;

             if (targetButton.classList.contains('item-rename')) {
                 event.stopPropagation();
                 uiSettingsModule.renameRole(roleName);
             } else if (targetButton.classList.contains('item-delete')) {
                 event.stopPropagation();
                 uiSettingsModule.deleteRole(roleName);
             }
         });
        if (elementsModule.exportRoleButton) elementsModule.exportRoleButton.addEventListener('click', uiSettingsModule.exportRole);
        if (elementsModule.importRoleButton) elementsModule.importRoleButton.addEventListener('click', uiSettingsModule.importRole);
        if (elementsModule.importRoleFile) elementsModule.importRoleFile.addEventListener('change', uiSettingsModule.handleImportRoleFile);


        elementsModule.addChatroomButton.addEventListener('click', uiSettingsModule.addChatroom);
        elementsModule.clearChatroomHistoryButton.addEventListener('click', uiSettingsModule.clearCurrentChatroomHistory);
        elementsModule.chatroomListContainer.addEventListener('click', (event) => {
             const targetButton = event.target.closest('.item-actions > .std-button');

             const targetRadio = event.target.closest('input[type="radio"]');
             const targetLabel = event.target.closest('label');
             const roomItem = event.target.closest('.chatroom-item');

             if (targetButton && roomItem) {
                 const roomName = roomItem.dataset.roomName;
                 if (targetButton.classList.contains('item-rename')) {
                     event.stopPropagation();
                     apiModule.renameChatroom(roomName);
                 } else if (targetButton.classList.contains('item-delete')) {
                     event.stopPropagation();
                     apiModule.deleteChatroom(roomName);
                 }
             } else if ((targetRadio || targetLabel) && roomItem) {

             }
         });
        if (elementsModule.exportChatroomButton) elementsModule.exportChatroomButton.addEventListener('click', uiSettingsModule.exportChatroom);
        if (elementsModule.importChatroomButton) elementsModule.importChatroomButton.addEventListener('click', uiSettingsModule.importChatroom);
        if (elementsModule.importChatroomFile) elementsModule.importChatroomFile.addEventListener('change', uiSettingsModule.handleImportChatroomFile);


        elementsModule.addNovelButton.addEventListener('click', uiSettingsModule.addNovel);
        elementsModule.novelListContainer.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.item-actions > .std-button');
            if (!targetButton) return;

            const novelItem = targetButton.closest('.novel-item');
            if (!novelItem) return;

            const novelId = novelItem.dataset.novelId;
            const novelName = novelItem.querySelector('.novel-name')?.textContent;

            if (targetButton.classList.contains('item-rename')) {
                 event.stopPropagation();
                 uiSettingsModule.renameNovel(novelId, novelName);
            } else if (targetButton.classList.contains('item-delete')) {
                 event.stopPropagation();
                 uiSettingsModule.deleteNovel(novelId, novelName);
            }
        });


        elementsModule.runPauseButton.addEventListener('click', uiChatModule.toggleRunPause);

        if (elementsModule.ruleButton) {
            elementsModule.ruleButton.addEventListener('click', () => {
                if (stateModule.config.activeChatRoomName) {
                    if (!elementsModule.settingsPanel.classList.contains('active')) {
                        uiSettingsModule.toggleSettings();
                    }
                    uiSettingsModule.showSection('current-chatroom-settings-page');
                }
            });
        }
        if (elementsModule.roleplayRulesTextarea) {
            elementsModule.roleplayRulesTextarea.addEventListener('change', uiSettingsModule.saveRoleplayRulesSetting);
            elementsModule.roleplayRulesTextarea.addEventListener('input', uiSettingsModule.saveRoleplayRulesSetting);
        }
        if (elementsModule.publicInfoTextarea) {
            elementsModule.publicInfoTextarea.addEventListener('change', uiSettingsModule.savePublicInfoSetting);
            elementsModule.publicInfoTextarea.addEventListener('input', uiSettingsModule.savePublicInfoSetting);
        }


        eventListenersModule._setupLongPressListener(
            elementsModule.addAdminButton,
            () => uiChatModule.createAdminMessage(),
            () => {
                const name = prompt("请输入新临时角色名称:");
                if (name && name.trim()) {
                    const added = uiChatModule.addTemporaryRole(name.trim());
                    if (added) {
                        uiChatModule.updateRoleButtonsList();
                        updateChatContextCache();
                        mainModule.triggerDebouncedSave();
                        if (document.getElementById('chatroom-role-page').classList.contains('active') && stateModule.currentChatRoom) {
                           const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                           if (room) uiSettingsModule.updateChatroomRolePage(room);
                        }
                    }
                }
            },
            false
        );


        const handleNameButtonPressStart = (event) => {
            const nameBtn = event.target.closest('.role-name-button-above-bubble');
            if (!nameBtn) return;
            const msgContainer = nameBtn.closest('.message-container');
            eventListenersModule._setupLongPressListener(
                nameBtn,
                () => uiChatModule.toggleMessageActions(msgContainer),
                () => {
                    uiChatModule.toggleMessageEditMode(msgContainer);
                    uiChatModule.hideAllMessageActions();
                },
                false
            );
            nameBtn.dispatchEvent(new MouseEvent(event.type, event));
        };


        elementsModule.chatArea.addEventListener('mousedown', (event) => {
             const nameBtn = event.target.closest('.role-name-button-above-bubble');
             if (nameBtn && !nameBtn._longPressAttached) {
                const msgContainer = nameBtn.closest('.message-container');
                eventListenersModule._setupLongPressListener(nameBtn, () => uiChatModule.toggleMessageActions(msgContainer), () => { uiChatModule.toggleMessageEditMode(msgContainer); uiChatModule.hideAllMessageActions(); }, false);
                nameBtn._longPressAttached = true;
             }
        }, true);

        elementsModule.chatArea.addEventListener('touchstart', (event) => {
             const nameBtn = event.target.closest('.role-name-button-above-bubble');
             if (nameBtn && !nameBtn._longPressAttached) {
                const msgContainer = nameBtn.closest('.message-container');
                eventListenersModule._setupLongPressListener(nameBtn, () => uiChatModule.toggleMessageActions(msgContainer), () => { uiChatModule.toggleMessageEditMode(msgContainer); uiChatModule.hideAllMessageActions(); }, false);
                nameBtn._longPressAttached = true;
             }
        }, { passive: false, capture: true });


        elementsModule.chatArea.addEventListener('click', async (event) => {
            const msgContainer = event.target.closest('.message-container');
            if (!msgContainer) {
                 if (stateModule.activeMessageActions) { uiChatModule.hideAllMessageActions(); }
                 return;
            }

            if (event.target.tagName === 'IMG') {
                 return;
            }

            const actionBtn = event.target.closest('.message-action-button');
            const nameBtn = event.target.closest('.role-name-button-above-bubble');

            if (actionBtn) {
                event.stopPropagation();
                 if (actionBtn.classList.contains('toggle-raw-button')) {
                     uiChatModule.toggleRawJsonDisplay(msgContainer);
                 } else if (actionBtn.classList.contains('save-character-update-button')) {
                    const messageId = msgContainer.dataset.messageId;
                    const messageIndex = stateModule.currentChatHistoryData.findIndex(msg => msg.id === messageId);

                    if (messageIndex === -1) {
                        _logAndDisplayError(`保存更新失败: 找不到消息 ID ${messageId}`, 'ChatAreaClick-SaveUpdate');
                        uiChatModule.hideAllMessageActions();
                        return;
                    }

                    const messageObject = stateModule.currentChatHistoryData[messageIndex];
                    const fullDisplayText = messageObject.speechActionText;
                    const parsedResult = messageObject.parsedResult;

                    if (!fullDisplayText || typeof fullDisplayText !== 'string' || !parsedResult || typeof parsedResult !== 'object') {
                        _logAndDisplayError("保存更新失败: 缺少必要的显示文本或解析结果。", "ChatAreaClick-SaveUpdate");
                        uiChatModule.hideAllMessageActions();
                        return;
                    }

                    const characterName = parsedResult.updatedCharacterMemory?.characterName || parsedResult.updatedCharacterSettings?.characterName;
                    if (!characterName) {
                        _logAndDisplayError("保存更新失败: 无法从解析结果中确定目标角色名称。", "ChatAreaClick-SaveUpdate");
                        uiChatModule.hideAllMessageActions();
                        return;
                    }

                    const parts = fullDisplayText.split(uiChatModule.CHARACTER_SETTINGS_SEPARATOR);
                    if (parts.length !== 2) {
                        _logAndDisplayError("保存更新失败: 文本格式不正确，无法分割记忆和设定。", "ChatAreaClick-SaveUpdate");
                        uiChatModule.hideAllMessageActions();
                        return;
                    }

                    let memoryString = parts[0].replace(/^---\s*更新后记忆.*?---\s*\n?/, '').trim();
                    let settingString = parts[1].replace(/^---\s*更新后设定.*?---\s*\n?/, '').trim();

                    try {
                        const currentRoleData = await roleDataManager.getRoleData(characterName);
                        const existingDrawingTemplate = currentRoleData?.drawingTemplate || "";

                        const dataToSave = {
                            name: characterName,
                            setting: settingString,
                            memory: memoryString,
                            drawingTemplate: existingDrawingTemplate
                        };

                        const success = await roleDataManager.saveRoleData(characterName, dataToSave);

                        if (success) {

                        } else {
                            _logAndDisplayError(`保存角色 ${characterName} 的更新失败 (saveRoleData 返回 false)。`, 'ChatAreaClick-SaveUpdate');
                        }
                    } catch (e) {
                        _logAndDisplayError(`保存更新时发生错误: ${e.message}`, 'ChatAreaClick-SaveUpdate');
                    } finally {
                        uiChatModule.hideAllMessageActions();
                    }
                 } else if (actionBtn.classList.contains('redraw-button')) {
                     uiChatModule.handleRedrawClick(msgContainer);
                 }
            } else if (!nameBtn) {
                 if (stateModule.activeMessageActions) { uiChatModule.hideAllMessageActions(); }
            }

        });


        elementsModule.chatArea.addEventListener('mousedown', (event) => {
             const bgBtn = event.target.closest('.set-background-button');
             if (bgBtn && !bgBtn._longPressAttached) {
                 eventListenersModule._setupLongPressListener(bgBtn, () => uiChatModule.handleSetBackgroundClick(event), () => uiChatModule.handleDownloadImageLongPress(event), false);
                 bgBtn._longPressAttached = true;
             }
        }, true);
        elementsModule.chatArea.addEventListener('touchstart', (event) => {
             const bgBtn = event.target.closest('.set-background-button');
             if (bgBtn && !bgBtn._longPressAttached) {
                 eventListenersModule._setupLongPressListener(bgBtn, () => uiChatModule.handleSetBackgroundClick(event), () => uiChatModule.handleDownloadImageLongPress(event), false);
                 bgBtn._longPressAttached = true;
             }
        }, { passive: false, capture: true });


        elementsModule.chatArea.addEventListener('mousedown', (event) => {
             const deleteBtn = event.target.closest('.delete-button');
             if (deleteBtn && !deleteBtn._longPressAttached) {
                 const msgContainer = deleteBtn.closest('.message-container');
                 eventListenersModule._setupLongPressListener(deleteBtn, () => uiChatModule.deleteMessage(msgContainer), () => { if (confirm("确定要删除此消息及其之后的所有消息吗？")) { uiChatModule.deleteMessageAndBelow(msgContainer); } uiChatModule.hideAllMessageActions(); }, false);
                 deleteBtn._longPressAttached = true;
             }
        }, true);
         elementsModule.chatArea.addEventListener('touchstart', (event) => {
             const deleteBtn = event.target.closest('.delete-button');
             if (deleteBtn && !deleteBtn._longPressAttached) {
                 const msgContainer = deleteBtn.closest('.message-container');
                 eventListenersModule._setupLongPressListener(deleteBtn, () => uiChatModule.deleteMessage(msgContainer), () => { if (confirm("确定要删除此消息及其之后的所有消息吗？")) { uiChatModule.deleteMessageAndBelow(msgContainer); } uiChatModule.hideAllMessageActions(); }, false);
                 deleteBtn._longPressAttached = true;
             }
        }, { passive: false, capture: true });


        if (elementsModule.imageViewerPage) {
            elementsModule.imageViewerPage.addEventListener('click', uiChatModule.hideImageViewer);
        }


        elementsModule.novelButton.addEventListener('click', uiSettingsModule.novelUI_toggleNovelInterface);
        elementsModule.novelBookshelfButton.addEventListener('click', () => uiSettingsModule.novelUI_showNovelSection('novel-bookshelf-page'));
        elementsModule.novelTocButton.addEventListener('click', () => uiSettingsModule.novelUI_showNovelSection('novel-toc-page'));
        if(elementsModule.novelBookshelfCloseButton) {
            elementsModule.novelBookshelfCloseButton.addEventListener('click', () => uiSettingsModule.novelUI_closeCurrentNovelSection('novel-bookshelf-page'));
        }
        if(elementsModule.novelTocCloseButton) {
            elementsModule.novelTocCloseButton.addEventListener('click', () => uiSettingsModule.novelUI_closeCurrentNovelSection('novel-toc-page'));
        }

        if (elementsModule.novelBookshelfListContainer) {
            elementsModule.novelBookshelfListContainer.addEventListener('change', (event) => {
                const target = event.target;
                const item = target.closest('.novel-bookshelf-item');
                if (!item) return;
                const novelId = item.dataset.novelId;

                if (target.type === 'radio' && target.name === 'currentNovelSelection') {
                    uiSettingsModule.novelUI_handleNovelSelection(novelId);
                } else if (target.type === 'checkbox' && target.classList.contains('novel-activation-checkbox')) {
                    const isChecked = target.checked;
                    uiSettingsModule.novelUI_handleNovelActivation(novelId, isChecked);
                }
            });

             elementsModule.novelBookshelfListContainer.addEventListener('click', (event) => {
                 const label = event.target.closest('label');
                 const item = event.target.closest('.novel-bookshelf-item');
                 if (label && item) {
                     const radio = item.querySelector('input[type="radio"]');
                     if (radio && !radio.checked) {
                         radio.checked = true;
                         radio.dispatchEvent(new Event('change', { bubbles: true }));
                     }
                 }
             });
        }

         if (elementsModule.novelContentDisplay) {
             elementsModule.novelContentDisplay.addEventListener('scroll', uiSettingsModule.novelUI_saveScrollPosition, { passive: true });
         } else {
              _logAndDisplayError("Error setting up novel scroll listener: elementsModule.novelContentDisplay is null/undefined.", "setupEventListeners");
         }

        if(elementsModule.novelTocListContainer) {
             elementsModule.novelTocListContainer.addEventListener('click', (event) => {
                 const tocItem = event.target.closest('.novel-toc-item');
                 if (tocItem && tocItem.dataset.targetSegmentId !== undefined) {
                     uiSettingsModule.novelUI_handleTocJump(event);
                 }
             });
        }

        document.addEventListener('click', (event) => {
             const isInsideSettings = elementsModule.settingsPanel.contains(event.target);
             const isInsideNovel = elementsModule.novelInterface.contains(event.target);
             const isImageViewer = elementsModule.imageViewerPage?.contains(event.target);
             const isSettingsIcon = elementsModule.settingsIcon.contains(event.target);
             const isNovelButton = elementsModule.novelButton.contains(event.target);
             const isMessageAction = event.target.closest('.message-action-button');
             const isItemAction = event.target.closest('.item-actions > .std-button');
             const isRoleStatePopup = event.target.closest('.role-state-buttons');
             const isNovelSubPageCloseButton = event.target.closest('.novel-close-button');
             const isTopRoleButton = event.target.closest('#role-buttons-list-container .std-button');
             const isStateButton = event.target.closest('.role-state-buttons .std-button');
             const isRuleButton = elementsModule.ruleButton?.contains(event.target);
             const isNameButton = event.target.closest('.role-name-button-above-bubble');

              if (stateModule.isNovelInterfaceVisible && !isInsideNovel && !isNovelButton && !isSettingsIcon && !isMessageAction && !isItemAction && !isRoleStatePopup && !isNovelSubPageCloseButton && !isImageViewer && !isRuleButton) {
                 uiSettingsModule.novelUI_toggleNovelInterface();
             }

            if (stateModule.config.isRoleListVisible &&
                !elementsModule.roleButtonsListContainer.contains(event.target) &&
                !elementsModule.roleButton.contains(event.target) &&
                !isTopRoleButton &&
                !isRoleStatePopup &&
                !isStateButton)
            {
                uiChatModule.toggleRoleList();
            } else if (stateModule.activeRoleStateButtons) {
                const activeStatesDiv = document.querySelector(`.role-state-buttons.active[data-role-name="${stateModule.activeRoleStateButtons}"]`);

                let correspondingRoleBtn = null;
                 const allRoleBtns = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container > .std-button');
                 allRoleBtns.forEach(b => {
                     if (b.dataset.roleName === stateModule.activeRoleStateButtons) correspondingRoleBtn = b;
                 });

                if (activeStatesDiv && !activeStatesDiv.contains(event.target) && event.target !== correspondingRoleBtn && !isStateButton) {
                    uiChatModule.hideRoleStateButtons();
                }
            }

            if (stateModule.editingMessageContainer && !stateModule.editingMessageContainer.contains(event.target)) {
                 uiChatModule.saveEditedMessage(stateModule.editingMessageContainer);
            }

             if (stateModule.activeMessageActions && !stateModule.activeMessageActions.contains(event.target) && !isMessageAction && !isNameButton ) {
                uiChatModule.hideAllMessageActions();
             }

        }, true);

    }
};

const initializationModule_ui = {
    initializeUI: async () => {
        elementsModule.init();
        eventListenersModule.setupEventListeners();

        try {
            await configModule.loadConfig();
            roleDataManager.clearCache();
            initializationModule.initializeConfig();
        } catch (error) {
            _logAndDisplayError(`Initialization failed: ${error.message}`, 'initializeUI', 'N/A', 'N/A', error);
            Object.assign(stateModule.config, JSON.parse(JSON.stringify(defaultConfig)));
            initializationModule.initializeConfig();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { initializationModule_ui.initializeUI(); });