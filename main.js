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
    },

    handleModelSelectClick: (event) => {

    }
};


const initializationModule = {

    _initializeApiSettingsUI: () => {
        uiSettingsModule.loadApiKeysSetting();
        uiSettingsModule.updateApiKeyFailureCountsDisplay();
        const googleKeys = apiKeyManager.getApiKeys();
        const allSelects = document.querySelectorAll('.settings-select[id*="-model-"]');
        const defaultPlaceholder = googleKeys.length === 0 ? '请输入 API 密钥' : '请点击 拉取模型列表';
        allSelects.forEach(sel => {
            if (sel.id !== 'novelai-model-settings') {
                const placeholderOption = sel.querySelector('option[disabled][selected]');
                if (!placeholderOption) {
                    sel.innerHTML = `<option value="" disabled selected>${defaultPlaceholder}</option>`;
                } else {
                    placeholderOption.textContent = defaultPlaceholder;
                }
            }
        });
    },

    _initializeNovelAiSettingsUI: () => {
        uiSettingsModule.loadNovelAiSettings();
        uiSettingsModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
    },

    _initializeGeneralSettingsUI: () => {
        ['temperature', 'topP', 'topK', 'maxOutputTokens',
         'responseMimeType',
         'originalNovelLength',
        ].forEach(key => uiSettingsModule.loadSettingValue(key));

        uiSettingsModule.loadChatroomModelSetting();
        uiSettingsModule.loadSettingValue('responseSchemaJson');
        uiSettingsModule.loadSettingValue('responseSchemaParserJs');
        uiSettingsModule.loadSettingValue('sharedDatabaseInstruction');
        uiSettingsModule.loadChatroomMainPromptSetting();
    },

     _initializePromptPresetSettingsUI: () => {
        uiSettingsModule.loadPromptPresetSettings();
        uiSettingsModule.renderPromptPresetsList();
     },

    _initializeToolSettingsUI: () => {
        ['drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster', 'privateAssistant'].forEach(toolName => {
            uiSettingsModule.loadGodSettings(toolName);
        });
    },

    _initializeChatroomListUI: () => {
        uiSettingsModule.updateChatroomList();
    },

    _initializeTopToolbarUI: () => {
        elementsModule.runPauseButton.textContent = stateModule.config.isRunPaused ? '▶' : '◼';
        elementsModule.roleButtonsListContainer.style.display = stateModule.config.isRoleListVisible ? 'flex' : 'none';

    },

    _initializeErrorLogUI: () => {

        uiSettingsModule.displayErrorLog([]);
    },

    _initializeNovelInterfaceUI: () => {
        elementsModule.novelInterface.classList.remove('active');
        stateModule.isNovelInterfaceVisible = false;
        uiSettingsModule.novelUI_hideAllNovelPages();
        stateModule.novelPageStack = [];
        stateModule.activeNovelPage = null;
        stateModule.currentNovelId = null;

        stateModule.currentTocIndexByNovel = {};


        let shouldLoadNovel = false;
        const lastViewedNovelId = stateModule.config.lastViewedNovelId;
        const currentChatroomDetails = stateModule.currentChatroomDetails;

        if (lastViewedNovelId && currentChatroomDetails) {
            const novelExists = currentChatroomDetails.novels?.some(n => n.id === lastViewedNovelId);
            if (novelExists) {
                stateModule.currentNovelId = lastViewedNovelId;
                shouldLoadNovel = true;
            } else {
                 stateModule.config.lastViewedNovelId = null;
                 mainModule.triggerDebouncedSave();
            }
        }

        if (shouldLoadNovel) {

        } else if (elementsModule.novelContentDisplay) {
             elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
             elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
        }
    },

    _initializeBackground: () => {
        const backgroundFilename = stateModule.currentChatroomDetails?.config?.backgroundImageFilename;
        const activeRoomName = stateModule.config.activeChatRoomName;

        if (backgroundFilename && activeRoomName && elementsModule.chatContainer) {
             const bgUrl = `/chatrooms/${encodeURIComponent(activeRoomName)}/${encodeURIComponent(backgroundFilename)}?t=${Date.now()}`;
             elementsModule.chatContainer.style.backgroundImage = `url('${bgUrl}')`;
        } else if (elementsModule.chatContainer) {
            elementsModule.chatContainer.style.backgroundImage = '';
        }
    },

    _initializeChatroomSpecificUI: () => {

        if (stateModule.currentChatroomDetails) {

             if (!stateModule.currentChatroomDetails.config.overrideSettings) {
                 stateModule.currentChatroomDetails.config.overrideSettings = JSON.parse(JSON.stringify(defaultChatroomOverrideSettings));
                 _logAndDisplayError(`Chatroom ${stateModule.config.activeChatRoomName} config missing overrideSettings, added default.`, '_initializeChatroomSpecificUI');
             }
             if (!stateModule.currentChatroomDetails.config.roleVisibility) {
                  stateModule.currentChatroomDetails.config.roleVisibility = {};

                  const permanentRoles = new Set(stateModule.currentChatroomDetails.roles.map(r => r.name));
                  for (const roleName in stateModule.currentChatroomDetails.config.roleStates) {
                     if (permanentRoles.has(roleName)) {
                         stateModule.currentChatroomDetails.config.roleVisibility[roleName] = true;
                     }
                  }
                   _logAndDisplayError(`Chatroom ${stateModule.config.activeChatRoomName} config missing roleVisibility, initialized.`, '_initializeChatroomSpecificUI');
             }

            uiChatModule.loadChatHistory(stateModule.currentChatroomDetails.config.name);
            uiChatModule.updateRoleButtonsList();
            initializationModule._initializeBackground();
            initializationModule._initializeNovelInterfaceUI();
             if (document.getElementById('role-list-page').classList.contains('active')) {
                 uiSettingsModule.updateChatroomRolePage();
             }
             if (document.getElementById('story-mode-page').classList.contains('active')) {
                 uiSettingsModule.updateChatroomNovelPage();
             }
        } else {

            uiChatModule.clearChatArea();
            uiChatModule.updateRoleButtonsList();
            initializationModule._initializeBackground();
            initializationModule._initializeNovelInterfaceUI();
        }
        updateChatContextCache();
        uiSettingsModule.updateWorldInfoDisplay();
        uiSettingsModule.loadRoleplayRulesSetting();
        uiSettingsModule.loadPublicInfoSetting();
    },

    initializeConfig: async () => {

        await configModule.loadConfig();


        initializationModule._initializeApiSettingsUI();
        initializationModule._initializeNovelAiSettingsUI();
        initializationModule._initializeGeneralSettingsUI();
        initializationModule._initializePromptPresetSettingsUI();
        initializationModule._initializeToolSettingsUI();
        initializationModule._initializeTopToolbarUI();
        initializationModule._initializeErrorLogUI();
        initializationModule._initializeChatroomListUI();


        initializationModule._initializeChatroomSpecificUI();


        uiSettingsModule.hideAllSettingPages();
        elementsModule.settingsPanel.classList.remove('active');
        stateModule.pageStack = [];
    },
};

const eventListenersModule = {
    _longPressDelay: 200,
    _cooldownDuration: 200,

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

    _activateCooldown: () => {
        clearTimeout(stateModule.cooldownTimer);
        stateModule.isCooldownActive = true;
        stateModule.cooldownTimer = setTimeout(() => {
            stateModule.isCooldownActive = false;
            stateModule.cooldownTimer = null;
        }, eventListenersModule._cooldownDuration);
    },

    _setupLongPressListener: (element, shortPressAction, longPressAction, allowScroll = false) => {
        let startX, startY, startTime, isMoved = false;

        const handlePointerDown = (event) => {
            if (event.button !== 0 && event.pointerType === 'mouse') return;
            event.preventDefault();

            startX = event.clientX;
            startY = event.clientY;
            startTime = Date.now();
            isMoved = false;
            element.dataset.interactionActive = 'true';

            element.addEventListener('pointermove', handlePointerMove, { passive: true });
            element.addEventListener('pointerup', handlePointerUp);
            element.addEventListener('pointercancel', handlePointerEnd);
            element.addEventListener('pointerleave', handlePointerLeave);
        };

        const handlePointerMove = (event) => {
            if (element.dataset.interactionActive !== 'true') return;
            const deltaX = Math.abs(event.clientX - startX);
            const deltaY = Math.abs(event.clientY - startY);
            const MOVE_THRESHOLD = 10;
            if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
                isMoved = true;
                handlePointerEnd();
            }
        };

        const handlePointerUp = (event) => {
            if (element.dataset.interactionActive !== 'true') return;

            if (stateModule.isCooldownActive) {
                handlePointerEnd();
                event.preventDefault();
                return;
            }

            const duration = Date.now() - startTime;

            if (!isMoved) {
                if (duration >= eventListenersModule._longPressDelay && longPressAction) {
                    longPressAction();
                } else if (shortPressAction) {
                    shortPressAction();
                }
            }

            handlePointerEnd();
            event.preventDefault();
        };

         const handlePointerLeave = (event) => {
             const rect = element.getBoundingClientRect();
             const isOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
             if (element.dataset.interactionActive === 'true' && isOutside) {
                 handlePointerEnd();
             }
         };

        const handlePointerEnd = () => {
            if (element.dataset.interactionActive === 'true') {
                eventListenersModule._activateCooldown();
            }
            delete element.dataset.interactionActive;
            element.removeEventListener('pointermove', handlePointerMove);
            element.removeEventListener('pointerup', handlePointerUp);
            element.removeEventListener('pointercancel', handlePointerEnd);
            element.removeEventListener('pointerleave', handlePointerLeave);
            isMoved = false;
            startTime = 0;
        };

        element.removeEventListener('pointerdown', handlePointerDown);
        element.addEventListener('pointerdown', handlePointerDown);
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
                 stateModule.currentChatRoom = stateModule.config.activeChatRoomName;
                 uiSettingsModule.showSection('role-list-page');
                 if (stateModule.config.isRoleListVisible) uiChatModule.toggleRoleList();
             },
             false
        );


        elementsModule.settingsMenuItems.forEach(item => item.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.showSection(item.dataset.target); }));

        elementsModule.chatRoomSettingsMenuItems.forEach(item => item.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.showSection(item.dataset.target); }));
        elementsModule.chatroomDetailSettingsMenuItems.forEach(item => item.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.showSection(item.dataset.target); }));
        elementsModule.closeButtons.forEach(button => button.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.closeCurrentSection(button.closest('.setting-page-template').id); }));



        elementsModule.clearErrorLogButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.clearErrorLogDisplay(); });
        elementsModule.copyErrorLogButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.copyErrorLog(); });
        elementsModule.clearAllConfigButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.clearAllConfiguration(); });
        elementsModule.exportConfigButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) window.location.href = '/export-full-config-zip'; });
        elementsModule.importConfigButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) elementsModule.importConfigFile.click(); });
        elementsModule.importConfigFile.addEventListener('change', uiSettingsModule.handleImportConfig);


        elementsModule.apiKeyTextareaSettings.addEventListener('change', uiSettingsModule.saveApiKeysSetting);
        if(elementsModule.fetchModelsButton) {
             elementsModule.fetchModelsButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) apiModule.fetchModels(); });
        }


        ['temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType'
        ].forEach(key => {
            const el = elementsModule[`${key}Settings`];
            if (el) el.addEventListener('change', () => {
                stateModule.config[key] = el.value;
                mainModule.triggerDebouncedSave();
            });
        });
         if (elementsModule.originalNovelLengthSettings) {
             elementsModule.originalNovelLengthSettings.addEventListener('change', uiSettingsModule.saveOriginalNovelLengthSetting);
         }
         if (elementsModule.systemInstructionPresetSettings) {
            elementsModule.systemInstructionPresetSettings.addEventListener('change', () => uiSettingsModule.savePromptPresetSetting('systemInstruction'));
            elementsModule.systemInstructionPresetSettings.addEventListener('input', () => uiSettingsModule.savePromptPresetSetting('systemInstruction'));
         }

         if (elementsModule.addPromptUserTurnButton) {
             elementsModule.addPromptUserTurnButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.addPromptPresetTurn('user'); });
         }
         if (elementsModule.addPromptModelTurnButton) {
             elementsModule.addPromptModelTurnButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.addPromptPresetTurn('model'); });
         }
         if (elementsModule.exportPromptPresetsButton) {
             elementsModule.exportPromptPresetsButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) apiModule.exportPromptPresets(); });
         }
         if (elementsModule.importPromptPresetsButton) {
             elementsModule.importPromptPresetsButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) elementsModule.importPromptPresetsFile.click(); });
         }
         if (elementsModule.importPromptPresetsFile) {
             elementsModule.importPromptPresetsFile.addEventListener('change', uiSettingsModule.handleImportPromptPresets);
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

                if (key !== 'novelaiApiKey' && (el.type === 'number' || el.tagName === 'TEXTAREA' || el.type === 'text')) {
                    el.addEventListener('input', changeHandler);
                }
            }
        });


        elementsModule.toolListMenuItems.forEach(item => item.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.showSection(item.dataset.target); }));
        ['drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster', 'privateAssistant'].forEach(godName => {
            const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'enabled', 'model', 'mainPrompt'];
            settings.forEach(settingType => {
                 let elementIdSuffix = 'Settings';
                 if (settingType === 'toolDatabaseInstruction') {
                      elementIdSuffix = 'ToolDatabaseInstructionSettings';
                 } else if (settingType !== 'model'){
                      elementIdSuffix = `${settingType.charAt(0).toUpperCase() + settingType.slice(1)}Settings`;
                 } else {
                      elementIdSuffix = 'ModelSettings';
                 }
                const elId = `${godName}${elementIdSuffix}`;
                const el = elementsModule[elId];
                if (el) {
                    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
                         el.addEventListener('change', () => uiSettingsModule.saveGodSettings(godName));
                    } else {
                         el.addEventListener('input', () => uiSettingsModule.saveGodSettings(godName));
                         el.addEventListener('change', () => uiSettingsModule.saveGodSettings(godName));
                    }
                    if(settingType === 'mainPrompt') {
                         el.addEventListener('input', () => uiSettingsModule.saveToolMainPromptSetting(godName));
                         el.addEventListener('change', () => uiSettingsModule.saveToolMainPromptSetting(godName));
                    }
                }
            });
        });


        elementsModule.roleInstructionTextarea.addEventListener('change', uiSettingsModule.saveRoleSettings);
        elementsModule.roleMemoryTextarea.addEventListener('change', uiSettingsModule.saveRoleSettings);
        elementsModule.roleInstructionTextarea.addEventListener('input', uiSettingsModule.saveRoleSettings);
        elementsModule.roleMemoryTextarea.addEventListener('input', uiSettingsModule.saveRoleSettings);
        elementsModule.roleDrawingTemplateSettings.addEventListener('change', uiSettingsModule.saveRoleSettings);
        elementsModule.roleDrawingTemplateSettings.addEventListener('input', uiSettingsModule.saveRoleSettings);


        elementsModule.roleListContainer.addEventListener('click', (event) => {
             if (stateModule.isCooldownActive) return;
             const targetButton = event.target.closest('.item-actions > .std-button');
             if (!targetButton || targetButton.classList.contains('edit-disabled')) return;

             const roleItem = targetButton.closest('.role-item');
             if (!roleItem) return;
             const roleName = roleItem.dataset.roleName;

             if (targetButton.classList.contains('item-rename')) {
                 event.stopPropagation();
                 uiSettingsModule.renameChatroomRole(roleName);
             } else if (targetButton.classList.contains('item-delete')) {
                 event.stopPropagation();
                 uiSettingsModule.deleteChatroomRole(roleName);
             }
         });
        elementsModule.roleListContainer.addEventListener('change', (event) => {
             if (stateModule.isCooldownActive) return;
             const targetCheckbox = event.target.closest('.role-visibility-checkbox');
             if (targetCheckbox) {
                 const roleName = targetCheckbox.dataset.roleName;
                 const isVisible = targetCheckbox.checked;
                 uiSettingsModule.handleRoleVisibilityChange(roleName, isVisible);
             }
         });

        if (elementsModule.exportRoleButton) elementsModule.exportRoleButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.exportRole(); });
        if (elementsModule.importRoleButton) elementsModule.importRoleButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.importRole(); });
        if (elementsModule.importRoleFile) elementsModule.importRoleFile.addEventListener('change', uiSettingsModule.handleImportRoleFile);


        elementsModule.addChatroomButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.addChatroom(); });
        elementsModule.clearChatroomHistoryButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.clearCurrentChatroomHistory(); });
        elementsModule.chatroomListContainer.addEventListener('click', (event) => {
             if (stateModule.isCooldownActive) return;

             const targetRadio = event.target.closest('input[type="radio"]');
             const targetLabel = event.target.closest('label');
             const roomItem = event.target.closest('.chatroom-item');

             if ((targetRadio || targetLabel) && roomItem) {

             }
         });
        if (elementsModule.renameChatroomButton) elementsModule.renameChatroomButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.handleRenameChatroom(); });
        if (elementsModule.deleteChatroomButton) elementsModule.deleteChatroomButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.handleDeleteChatroom(); });
        if (elementsModule.exportChatroomButton) elementsModule.exportChatroomButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.exportChatroom(); });
        if (elementsModule.importChatroomButton) elementsModule.importChatroomButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.importChatroom(); });
        if (elementsModule.importChatroomFile) elementsModule.importChatroomFile.addEventListener('change', uiSettingsModule.handleImportChatroomFile);


        ['responseSchemaJson', 'responseSchemaParserJs', 'sharedDatabaseInstruction'].forEach(key => {
             const el = elementsModule[`${key}Settings`];
             if (el) {
                 el.addEventListener('change', () => uiSettingsModule.saveChatroomCommonSetting(key));
                 el.addEventListener('input', () => uiSettingsModule.saveChatroomCommonSetting(key));
             }
        });
        if (elementsModule.chatroomMainPromptSettings) {
             elementsModule.chatroomMainPromptSettings.addEventListener('change', uiSettingsModule.saveChatroomMainPromptSetting);
             elementsModule.chatroomMainPromptSettings.addEventListener('input', () => uiSettingsModule.saveChatroomMainPromptSetting);
        }


        elementsModule.novelListContainer.addEventListener('click', (event) => {
            if (stateModule.isCooldownActive) return;
            const novelItem = event.target.closest('.novel-item');
            if (!novelItem) return;
            const novelId = novelItem.dataset.novelId;
            const novelName = novelItem.querySelector('.novel-name')?.textContent;

            const targetButton = event.target.closest('.item-actions > .std-button');
            if (!targetButton) return;

            if (targetButton.classList.contains('item-rename')) {
                 event.stopPropagation();
                 uiSettingsModule.renameChatroomNovel(novelId, novelName);
            } else if (targetButton.classList.contains('item-delete')) {
                 event.stopPropagation();
                 uiSettingsModule.deleteChatroomNovel(novelId, novelName);
            }
        });


        eventListenersModule._setupLongPressListener(
            elementsModule.runPauseButton,
            () => uiChatModule.toggleRunPause(),
            () => {
                if (stateModule.config.toolSettings.privateAssistant?.enabled) {
                    apiModule.triggerRoleResponse('privateAssistant');
                } else {
                    _logAndDisplayError("Cannot trigger Private Assistant: Tool is not enabled in settings.", "runPauseButtonLongPress");
                }
            },
            false
        );

        if (elementsModule.ruleButton) {
            elementsModule.ruleButton.addEventListener('click', () => {
                if (stateModule.isCooldownActive) return;
                if (stateModule.config.activeChatRoomName) {
                    if (!elementsModule.settingsPanel.classList.contains('active')) {
                        uiSettingsModule.toggleSettings();
                    }
                    stateModule.currentChatRoom = stateModule.config.activeChatRoomName;
                    uiSettingsModule.showSection('current-chatroom-settings-page');
                } else {

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
            async () => {
                const name = prompt("请输入新临时角色名称:");
                if (name && name.trim() && stateModule.currentChatroomDetails) {
                    const added = await uiChatModule.addTemporaryRole(name.trim());
                    if (added) {
                        uiChatModule.updateRoleButtonsList();
                        updateChatContextCache();
                        if (document.getElementById('role-list-page')?.classList.contains('active')) {
                           uiSettingsModule.updateChatroomRolePage();
                        }

                    } else {
                         alert(`Failed to add temporary role '${name.trim()}'.`);
                    }
                } else if (!stateModule.currentChatroomDetails) {
                    alert("Please select a chatroom first.");
                }
            },
            false
        );

        elementsModule.chatArea.addEventListener('pointerdown', (event) => {
             if (stateModule.isCooldownActive) return;
             const nameBtn = event.target.closest('.role-name-button-above-bubble');
             if (nameBtn && !nameBtn._interactionListenersAttached) {
                const msgContainer = nameBtn.closest('.message-container');
                eventListenersModule._setupLongPressListener(
                    nameBtn,
                    () => uiChatModule.toggleMessageActions(msgContainer),
                    () => { uiChatModule.toggleMessageEditMode(msgContainer); uiChatModule.hideAllMessageActions(); },
                    false
                );
                nameBtn._interactionListenersAttached = true;
             }

             const bgBtn = event.target.closest('.set-background-button');
              if (bgBtn && !bgBtn._interactionListenersAttached) {
                  eventListenersModule._setupLongPressListener(
                      bgBtn,
                      () => uiChatModule.handleSetBackgroundClick(event),
                      () => uiChatModule.handleDownloadImageLongPress(event),
                      false
                  );
                  bgBtn._interactionListenersAttached = true;
              }

             const deleteBtn = event.target.closest('.delete-button');
              if (deleteBtn && !deleteBtn._interactionListenersAttached) {
                  const msgContainer = deleteBtn.closest('.message-container');
                  eventListenersModule._setupLongPressListener(
                      deleteBtn,
                      () => uiChatModule.deleteMessage(msgContainer),
                      () => { if (confirm("确定要删除此消息及其之后的所有消息吗？")) { uiChatModule.deleteMessageAndBelow(msgContainer); } uiChatModule.hideAllMessageActions(); },
                      false
                  );
                  deleteBtn._interactionListenersAttached = true;
              }
        }, true);


        elementsModule.chatArea.addEventListener('click', async (event) => {
            if (stateModule.isCooldownActive) return;
            const msgContainer = event.target.closest('.message-container');
            const actionBtn = event.target.closest('.message-action-button');
            const nameBtn = event.target.closest('.role-name-button-above-bubble');

            if (actionBtn) {
                event.stopPropagation();
                 if (actionBtn.classList.contains('toggle-raw-button')) {
                     uiChatModule.toggleRawJsonDisplay(msgContainer);
                 } else if (actionBtn.classList.contains('redraw-button')) {
                     uiChatModule.handleRedrawClick(msgContainer);
                 } else if (actionBtn.classList.contains('save-character-update-button')) {
                     uiChatModule.saveCharacterUpdate(msgContainer);
                 }
            } else if (!nameBtn && !actionBtn && !msgContainer?.contains(event.target) && stateModule.activeMessageActions) {
                 uiChatModule.hideAllMessageActions();
            } else if (msgContainer && !nameBtn && !actionBtn && event.target.closest('.ai-response') && event.target.closest('.ai-response').querySelector('.game-host-controls')?.contains(event.target)) {

            }
             else if (msgContainer && !nameBtn && !actionBtn && !event.target.closest('[contenteditable="true"]') && stateModule.activeMessageActions) {
                uiChatModule.hideAllMessageActions();
            } else if (!msgContainer && stateModule.activeMessageActions) {
                uiChatModule.hideAllMessageActions();
            }

        });


        if (elementsModule.imageViewerPage) {
            elementsModule.imageViewerPage.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiChatModule.hideImageViewer(); });
        }


        elementsModule.novelButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.novelUI_toggleNovelInterface(); });
        elementsModule.novelBookshelfButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.novelUI_showNovelSection('novel-bookshelf-page'); });
        elementsModule.novelTocButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.novelUI_showNovelSection('novel-toc-page'); });
        if(elementsModule.novelBookshelfCloseButton) {
            elementsModule.novelBookshelfCloseButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.novelUI_closeCurrentNovelSection('novel-bookshelf-page'); });
        }
        if(elementsModule.novelTocCloseButton) {
            elementsModule.novelTocCloseButton.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.novelUI_closeCurrentNovelSection('novel-toc-page'); });
        }

        if (elementsModule.novelBookshelfListContainer) {
            elementsModule.novelBookshelfListContainer.addEventListener('change', (event) => {
                if (stateModule.isCooldownActive) return;
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
                 if (stateModule.isCooldownActive) return;
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
                 if (stateModule.isCooldownActive) return;
                 const tocItem = event.target.closest('.novel-toc-item');
                 if (tocItem && tocItem.dataset.targetSegmentId !== undefined) {
                     uiSettingsModule.novelUI_handleTocJump(event);
                 }
             });
        }


        elementsModule.chatroomOverrideConfigMenuItems.forEach(item => item.addEventListener('click', () => { if (!stateModule.isCooldownActive) uiSettingsModule.showSection(item.dataset.target); }));

        const overrideSections = ['general', 'drawingMaster', 'gameHost', 'writingMaster', 'characterUpdateMaster', 'privateAssistant'];
        overrideSections.forEach(sectionType => {
            const capSection = sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
            const enabledCheckbox = elementsModule[`chatroomOverride${capSection}Enabled`];
            const modelSelect = elementsModule[`chatroomOverride${capSection}ModelSelect`];
            const schemaJson = elementsModule[`chatroomOverride${capSection}ResponseSchemaJson`];
            const schemaParser = elementsModule[`chatroomOverride${capSection}ResponseSchemaParserJs`];
            const mainPrompt = elementsModule[`chatroomOverride${capSection}MainPrompt`];
            let dbInstructionKey = '';
            let dbElement = null;
            if (sectionType === 'general') {
                 dbInstructionKey = 'sharedDatabaseInstruction';
                 dbElement = elementsModule.chatroomOverrideGeneralSharedDatabaseInstruction;
            } else {
                 dbInstructionKey = 'toolDatabaseInstruction';
                 dbElement = elementsModule[`chatroomOverride${capSection}ToolDatabaseInstruction`];
            }

            if (enabledCheckbox) enabledCheckbox.addEventListener('change', () => uiSettingsModule.saveChatroomOverrideEnabled(sectionType));

            if (schemaJson) {
                schemaJson.addEventListener('input', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'responseSchemaJson'));
                schemaJson.addEventListener('change', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'responseSchemaJson'));
            }
            if (schemaParser) {
                schemaParser.addEventListener('input', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'responseSchemaParserJs'));
                schemaParser.addEventListener('change', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'responseSchemaParserJs'));
            }
            if (dbElement) {
                dbElement.addEventListener('input', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, dbInstructionKey));
                dbElement.addEventListener('change', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, dbInstructionKey));
            }
            if (mainPrompt) {
                mainPrompt.addEventListener('input', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'mainPrompt'));
                mainPrompt.addEventListener('change', () => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'mainPrompt'));
            }
        });


        document.addEventListener('click', (event) => {
             if (stateModule.isCooldownActive) {
                 event.preventDefault();
                 event.stopPropagation();
                 return;
             }
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
             const isPresetAction = event.target.closest('.prompt-preset-actions > .settings-menu-item') || event.target.closest('.prompt-preset-item .item-actions > .std-button');
             const isChatroomMgmtButton = event.target.closest('#current-chatroom-settings-page .settings-menu-item');
             const isRunPauseButton = elementsModule.runPauseButton.contains(event.target);


              if (stateModule.isNovelInterfaceVisible && !isInsideNovel && !isNovelButton && !isSettingsIcon && !isMessageAction && !isItemAction && !isRoleStatePopup && !isNovelSubPageCloseButton && !isImageViewer && !isRuleButton && !isPresetAction && !isChatroomMgmtButton && !isRunPauseButton) {
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
                 const allRoleBtns = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container > .std-button:not(.role-state-button)');
                 allRoleBtns.forEach(b => {
                     if (b.dataset.roleName === stateModule.activeRoleStateButtons) correspondingRoleBtn = b;
                 });

                if (activeStatesDiv && !activeStatesDiv.contains(event.target) && event.target !== correspondingRoleBtn && !isStateButton) {
                    uiChatModule.hideRoleStateButtons();
                }
            }

            if (stateModule.editingMessageContainer &&
                !stateModule.editingMessageContainer.contains(event.target) &&
                !elementsModule.addAdminButton.contains(event.target))
            {
                 uiChatModule.saveEditedMessage(stateModule.editingMessageContainer);
            }

             if (stateModule.activeMessageActions && !stateModule.activeMessageActions.contains(event.target) && !isMessageAction && !isNameButton ) {
                uiChatModule.hideAllMessageActions();
             }

        }, true);

        document.querySelectorAll('.settings-select[id*="-model-"]').forEach(selectElement => {
             if (selectElement.id !== 'novelai-model-settings') {
                 selectElement.removeEventListener('change', uiSettingsModule.saveChatroomModelSetting);
                 selectElement.addEventListener('change', uiSettingsModule.saveChatroomModelSetting);

                 if(selectElement.id.startsWith('chatroom-override-')) {
                     const match = selectElement.id.match(/^chatroom-override-(general|drawingMaster|gameHost|writingMaster|characterUpdateMaster|privateAssistant)-model-select$/);
                     if(match) {
                         const sectionType = match[1];
                         selectElement.removeEventListener('change', (e) => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'model'));
                         selectElement.addEventListener('change', (e) => uiSettingsModule.saveChatroomOverrideSetting(sectionType, 'model'));
                     }
                 } else if (!selectElement.id.startsWith('chatroom-')) {
                     const toolMatch = selectElement.id.match(/^(.*)-model-settings$/);
                     if (toolMatch) {
                         const toolName = toolMatch[1].replace(/-(\w)/g, (match, p1) => p1.toUpperCase());
                         selectElement.removeEventListener('change', () => uiSettingsModule.saveToolModelSetting(toolName));
                         selectElement.addEventListener('change', () => uiSettingsModule.saveToolModelSetting(toolName));
                     }
                 }
             }
        });


    }
};

const initializationModule_ui = {
    initializeUI: async () => {
        elementsModule.init();
        eventListenersModule.setupEventListeners();

        try {
            await initializationModule.initializeConfig();
        } catch (error) {
            _logAndDisplayError(`Initialization failed: ${error.message}`, 'initializeUI', 'N/A', 'N/A', error);

            Object.assign(stateModule.config, JSON.parse(JSON.stringify(defaultConfig)));
            await initializationModule.initializeConfig();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { initializationModule_ui.initializeUI(); });