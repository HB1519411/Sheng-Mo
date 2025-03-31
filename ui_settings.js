const uiSettingsModule = {

    toggleSettings: () => {
        elementsModule.settingsPanel.classList.toggle('active');
        if (elementsModule.settingsPanel.classList.contains('active')) {
             uiSettingsModule.hideAllSettingPages();
             uiSettingsModule.showSection('settings-main-page');
             stateModule.pageStack = ['settings-main-page'];

             if (stateModule.isNovelInterfaceVisible) {
                 uiSettingsModule.novelUI_toggleNovelInterface();
             }
        } else {
            uiSettingsModule.hideAllSettingPages();
            stateModule.pageStack = [];
        }
    },

    showSection: (sectionId) => {
        uiSettingsModule.hideAllSettingPages();
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
            sectionElement.classList.add('active');
            stateModule.activeSettingPage = sectionId;

            if (sectionId !== 'settings-main-page') {
                 if (stateModule.pageStack[stateModule.pageStack.length - 1] !== sectionId) {
                    stateModule.pageStack.push(sectionId);
                 }
            } else {
                 stateModule.pageStack = ['settings-main-page'];
            }

            if (sectionId === 'chatroom-novel-page' && stateModule.currentChatRoom) {
                const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                if (room) uiSettingsModule.updateChatroomNovelPage(room);
            } else if (sectionId === 'chatroom-role-page' && stateModule.currentChatRoom) {
                 const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                 if (room) uiSettingsModule.updateChatroomRolePage(room);
            } else if (sectionId === 'role-list-page') {
                uiSettingsModule.updateRoleList();
            } else if (sectionId === 'chat-room-directory-page') {
                uiSettingsModule.updateChatroomList();
            } else if (sectionId === 'story-mode-page') {
                uiSettingsModule.updateNovelList();
            } else if (sectionId === 'current-chatroom-settings-page') {
                uiSettingsModule.updateWorldInfoDisplay();
                 if (typeof uiChatModule !== 'undefined') {
                     uiChatModule.updateChatroomHistoryDisplay();
                 }
                 uiSettingsModule.loadRoleplayRulesSetting();
                 uiSettingsModule.loadPublicInfoSetting();
            } else if (sectionId === 'general-config-page') {
                 uiSettingsModule.loadReferenceTextLengthSetting();
            } else if (sectionId.endsWith('-master-page')) {
                 const toolName = sectionId.replace('-page', '');
                 const camelCaseToolName = toolName.replace(/-(\w)/g, (match, p1) => p1.toUpperCase());
                 uiSettingsModule.loadGodSettings(camelCaseToolName);
            } else if (sectionId === 'novelai-settings-page') {
                uiSettingsModule.loadNovelAiSettings();
                uiSettingsModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
            } else if (sectionId === 'api-settings-page') {
                 uiSettingsModule.loadApiKeysSetting();
                 uiSettingsModule.updateApiKeyFailureCountsDisplay();
            }

        } else {
             uiSettingsModule.showSection('settings-main-page');
             stateModule.pageStack = ['settings-main-page'];
        }
    },

    hideAllSettingPages: () => {
        elementsModule.settingPages.forEach(page => page.classList.remove('active'));
        stateModule.activeSettingPage = null;
    },

    closeCurrentSection: (sectionId) => {
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
            sectionElement.classList.remove('active');

            if (stateModule.pageStack[stateModule.pageStack.length - 1] === sectionId) {
                stateModule.pageStack.pop();
            } else {
                 const index = stateModule.pageStack.indexOf(sectionId);
                 if (index > -1) {
                     stateModule.pageStack.splice(index, 1);
                 }
                 const currentPageId = stateModule.pageStack[stateModule.pageStack.length - 1];
                 if (currentPageId) {
                     const currentPageElement = document.getElementById(currentPageId);
                     if (currentPageElement && !currentPageElement.classList.contains('active')) {
                         currentPageElement.classList.add('active');
                         stateModule.activeSettingPage = currentPageId;
                     }
                     return;
                 }
            }

            if (stateModule.pageStack.length > 0) {
                const previousPageId = stateModule.pageStack[stateModule.pageStack.length - 1];
                uiSettingsModule.showSection(previousPageId);
            } else {
                 if (elementsModule.settingsPanel.classList.contains('active')) {
                    uiSettingsModule.showSection('settings-main-page');
                    stateModule.pageStack = ['settings-main-page'];
                 } else {
                     stateModule.activeSettingPage = null;
                 }
            }
        }
    },

    loadApiKeysSetting: () => {
        elementsModule.apiKeyTextareaSettings.value = apiKeyManager.getApiKeys().join('\n');
    },

    saveApiKeysSetting: () => {
        const keys = elementsModule.apiKeyTextareaSettings.value.trim().split('\n').map(key => key.trim()).filter(key => key);
        apiKeyManager.setApiKeys(keys);
        apiModule.fetchModels();
        uiSettingsModule.updateApiKeyFailureCountsDisplay();
    },

    updateApiKeyFailureCountsDisplay: () => {
        const displayElement = elementsModule.apiKeyFailureCountsDisplay;
        if (!displayElement) return;

        const failures = apiKeyManager.getApiKeyFailureCounts();
        const currentKeys = apiKeyManager.getApiKeys();
        displayElement.innerHTML = '';

        if (currentKeys.length === 0) {
            displayElement.innerHTML = '<div>无 API 密钥</div>';
            return;
        }

        currentKeys.forEach(key => {
            const count = failures[key] || 0;
            const keyDiv = document.createElement('div');
            const keyPrefixSpan = document.createElement('span');
            keyPrefixSpan.className = 'key-prefix';
            keyPrefixSpan.textContent = key.substring(0, 8) + '...:';
            const countSpan = document.createElement('span');
            countSpan.className = 'fail-count';
            countSpan.textContent = `${count} 次失败`;

            keyDiv.appendChild(keyPrefixSpan);
            keyDiv.appendChild(countSpan);
            displayElement.appendChild(keyDiv);
        });
    },

    savePrimaryModelSetting: () => {
        const selectedModel = elementsModule.primaryModelSelectSettings.value;
        if (selectedModel) {
            stateModule.config.primaryModel = selectedModel;
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
        }
    },

    saveSecondaryModelSetting: () => {
        const selectedModel = elementsModule.secondaryModelSelectSettings.value;
        if (selectedModel) {
            stateModule.config.secondaryModel = selectedModel;
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
        }
    },

    setPrimaryModel: (modelName) => {
        if (elementsModule.primaryModelSelectSettings) {
            elementsModule.primaryModelSelectSettings.value = modelName;
        }
        stateModule.config.primaryModel = modelName;
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    setSecondaryModel: (modelName) => {
        if (elementsModule.secondaryModelSelectSettings) {
            elementsModule.secondaryModelSelectSettings.value = modelName;
        }
        stateModule.config.secondaryModel = modelName;
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    loadSettingValue: (settingKey) => {
        const element = elementsModule[`${settingKey}Settings`];
        if (element) {
             if (settingKey === 'primaryModel' || settingKey === 'secondaryModel') {
                 const modelValue = stateModule.config[settingKey] || '';
                 if (element.options.length <= 1 && element.options[0]?.disabled) {
                      stateModule.config[settingKey] = modelValue;
                 } else {
                     element.value = modelValue;
                     if (!element.value && element.options.length > 0) {
                         element.selectedIndex = 0;
                         stateModule.config[settingKey] = element.value;
                     }
                 }
            } else if (settingKey === 'referenceTextLength') {
                 element.value = stateModule.config.referenceTextLength || defaultConfig.referenceTextLength;
             } else if (settingKey === 'novelaiApiKey') {
                 element.value = apiKeyManager.getNaiApiKey();
             } else if (settingKey !== 'apiKeys' && settingKey !== 'currentApiKeyIndex') {
                 element.value = stateModule.config[settingKey] || '';
             }
        }
    },

    _createRoleListItem: (roleName) => {
        const roleItem = document.createElement('div');
        roleItem.className = 'role-item';
        roleItem.dataset.roleName = roleName;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = roleName;
        nameSpan.addEventListener('click', () => {
            uiSettingsModule.showRoleDetailPage(roleName);
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const renameButton = document.createElement('div');
        renameButton.className = 'std-button item-rename';
        renameButton.textContent = '✎';
        renameButton.style.width = '28px';
        renameButton.style.height = '28px';

        const deleteButton = document.createElement('div');
        deleteButton.className = 'std-button item-delete';
        deleteButton.textContent = '✕';
        deleteButton.style.width = '28px';
        deleteButton.style.height = '28px';

        actionsDiv.appendChild(renameButton);
        actionsDiv.appendChild(deleteButton);

        roleItem.appendChild(nameSpan);
        roleItem.appendChild(actionsDiv);

        return roleItem;
    },

    updateRoleList: () => {
        const fragment = document.createDocumentFragment();
        const sortedRoles = [...stateModule.config.roles].sort();
        sortedRoles.forEach(roleName => {
            fragment.appendChild(uiSettingsModule._createRoleListItem(roleName));
        });
        elementsModule.roleListContainer.innerHTML = '';
        elementsModule.roleListContainer.appendChild(fragment);
    },

    showRoleDetailPage: async (roleName) => {
        if (!stateModule.config.roles.includes(roleName)) {
            uiSettingsModule.showSection('role-list-page');
            _logAndDisplayError(`角色 "${roleName}" 不存在。`, 'showRoleDetailPage');
            return;
        }
        stateModule.currentRole = roleName;
        elementsModule.roleDetailHeaderTitle.textContent = `角色详情 - ${roleName}`;

        const roleData = await roleDataManager.getRoleData(roleName);
        if (roleData) {
            uiSettingsModule.loadRoleSettings(roleData);
            uiSettingsModule.showSection('role-detail-page');
        } else {
            _logAndDisplayError(`无法加载角色 "${roleName}" 的数据。`, 'showRoleDetailPage');
            elementsModule.roleInstructionTextarea.value = '';
            elementsModule.roleMemoryTextarea.value = '';
            elementsModule.roleDrawingTemplateSettings.value = '';
            elementsModule.roleStateTextarea.value = '[状态未获取]';
            uiSettingsModule.showSection('role-detail-page');
        }
    },

    loadRoleSettings: (roleData) => {
        if (!roleData) return;
        elementsModule.roleInstructionTextarea.value = roleData.setting || '';
        elementsModule.roleMemoryTextarea.value = roleData.memory || '';
        elementsModule.roleDrawingTemplateSettings.value = roleData.drawingTemplate || '';
        const roleState = stateModule.chatContextCache?.roleStates?.[roleData.name] || '[状态未获取]';
        elementsModule.roleStateTextarea.value = roleState;
    },

    saveRoleSettings: async (roleName) => {
        if (!stateModule.currentRole || stateModule.currentRole !== roleName) return;
        const roleData = {
            name: roleName,
            setting: elementsModule.roleInstructionTextarea.value,
            memory: elementsModule.roleMemoryTextarea.value,
            drawingTemplate: elementsModule.roleDrawingTemplateSettings.value
        };
        await roleDataManager.saveRoleData(roleName, roleData);
        updateChatContextCache();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    deleteRole: async (roleName) => {
        if (confirm(`确定要删除角色 ${roleName} 吗? 这将从所有聊天室和配置中移除该角色，并删除其数据文件。`)) {
            const deletedFromFileSystem = await roleDataManager.deleteRole(roleName);
            if (!deletedFromFileSystem) {
                 _logAndDisplayError(`删除角色文件 ${roleName}.json 失败，操作中止。`, 'deleteRole');
                 return;
            }

            stateModule.config.roles = stateModule.config.roles.filter(role => role !== roleName);
            delete stateModule.config.roleStates[roleName];

            stateModule.config.chatRooms.forEach(chatroom => {
                if (Array.isArray(chatroom.roles)) {
                    chatroom.roles = chatroom.roles.filter(role => role !== roleName);
                }
            });

             stateModule.currentChatHistoryData = stateModule.currentChatHistoryData.filter(msg => msg.roleName !== roleName);
             if(stateModule.config.activeChatRoomName) {
                 await uiChatModule.saveChatHistoryToServer();
             }

            uiSettingsModule.updateRoleList();
            if (typeof uiChatModule !== 'undefined' && uiChatModule.updateRoleButtonsList) {
                uiChatModule.updateRoleButtonsList();
            }
            if (stateModule.currentRole === roleName) {
                stateModule.currentRole = null;
                uiSettingsModule.closeCurrentSection('role-detail-page');
            }
            await updateChatContextCache();
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
        }
    },

    renameRole: async (oldName) => {
        const newName = prompt(`输入角色 "${oldName}" 的新名称:`, oldName);
        if (!newName || newName.trim() === "" || newName === oldName) {
            return;
        }
        if (stateModule.config.roles.includes(newName) || stateModule.config.temporaryRoles.includes(newName)) {
            _logAndDisplayError(`名称 "${newName}" 已存在 (作为角色或临时角色)。`, 'renameRole');
            return;
        }

        const index = stateModule.config.roles.indexOf(oldName);
        if (index === -1) {
            _logAndDisplayError(`无法找到要重命名的角色: ${oldName}`, 'renameRole');
            return;
        }

        const renamedInFileSystem = await roleDataManager.renameRole(oldName, newName);
        if (!renamedInFileSystem) {
             _logAndDisplayError(`重命名角色文件失败，操作中止。`, 'renameRole');
             return;
        }

        stateModule.config.roles[index] = newName;

        if (stateModule.config.roleStates.hasOwnProperty(oldName)) {
            stateModule.config.roleStates[newName] = stateModule.config.roleStates[oldName];
            delete stateModule.config.roleStates[oldName];
        } else {
            stateModule.config.roleStates[newName] = uiChatModule.ROLE_STATE_DEFAULT;
        }

        stateModule.config.chatRooms.forEach(room => {
            if (Array.isArray(room.roles)) {
                const roleIndex = room.roles.indexOf(oldName);
                if (roleIndex > -1) {
                    room.roles[roleIndex] = newName;
                }
            }
        });

        stateModule.currentChatHistoryData.forEach(msg => {
            if (msg.roleName === oldName) msg.roleName = newName;
            if (msg.targetRoleName === oldName) msg.targetRoleName = newName;
        });
        if (stateModule.config.activeChatRoomName) {
             await uiChatModule.saveChatHistoryToServer();
        }

        if (stateModule.currentRole === oldName) {
            stateModule.currentRole = newName;
            if (document.getElementById('role-detail-page').classList.contains('active')) {
                 elementsModule.roleDetailHeaderTitle.textContent = `角色详情 - ${newName}`;
                 const roleData = await roleDataManager.getRoleData(newName);
                 if(roleData) uiSettingsModule.loadRoleSettings(roleData);
            }
        }

        uiSettingsModule.updateRoleList();
        if (typeof uiChatModule !== 'undefined') {
             uiChatModule.updateRoleButtonsList();
             if (stateModule.config.activeChatRoomName) {
                 await uiChatModule.loadChatHistory(stateModule.config.activeChatRoomName);
             }
        }
        await updateChatContextCache();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    addRole: async () => {
        const newRole = prompt("请输入新角色名称:");
        if (newRole && newRole.trim() !== "" && !stateModule.config.roles.includes(newRole) && !stateModule.config.temporaryRoles.includes(newRole)) {
            const initialData = { name: newRole, setting: "", memory: "", drawingTemplate: "" };
            const saved = await roleDataManager.saveRoleData(newRole, initialData);
            if (saved) {
                stateModule.config.roles.push(newRole);
                stateModule.config.roleStates[newRole] = uiChatModule.ROLE_STATE_DEFAULT;
                uiSettingsModule.updateRoleList();
                 stateModule.config.chatRooms.forEach(room => {
                     if (Array.isArray(room.roles)) {
                          if(!room.roles.includes(newRole)) room.roles.push(newRole);
                     } else {
                         room.roles = [...stateModule.config.temporaryRoles, newRole];
                     }
                 });
                 if (typeof uiChatModule !== 'undefined') {
                    uiChatModule.updateRoleButtonsList();
                 }
                 await updateChatContextCache();
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                     mainModule.triggerDebouncedSave();
                 }
            } else {
                 _logAndDisplayError(`创建角色文件 ${newRole}.json 失败。`, 'addRole');
            }
        } else if (newRole) {
            _logAndDisplayError(`角色名称 "${newRole}" 无效或已存在。`, 'addRole');
        }
    },

    updateWorldInfoDisplay: () => {
        const worldInfo = stateModule.chatContextCache?.worldInfo || "[世界信息未获取]";
        if (elementsModule.worldInfoDisplay) {
            elementsModule.worldInfoDisplay.value = worldInfo;
            elementsModule.worldInfoDisplay.scrollTop = 0;
        }
    },

    loadReferenceTextLengthSetting: () => {
        if (elementsModule.referenceTextLengthSettings) {
            elementsModule.referenceTextLengthSettings.value = stateModule.config.referenceTextLength || defaultConfig.referenceTextLength;
        }
    },

    saveReferenceTextLengthSetting: () => {
        if (elementsModule.referenceTextLengthSettings) {
             const value = parseInt(elementsModule.referenceTextLengthSettings.value);
             if (!isNaN(value) && value > 0) {
                 stateModule.config.referenceTextLength = value;
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                 }
             } else {
                 stateModule.config.referenceTextLength = defaultConfig.referenceTextLength;
                 elementsModule.referenceTextLengthSettings.value = stateModule.config.referenceTextLength;
                 _logAndDisplayError("请输入有效的正整数作为字符数。已重置为默认值。", "saveReferenceTextLengthSetting");
             }
        }
    },

    loadNovelAiSettings: () => {
        uiSettingsModule.loadSettingValue('novelaiApiKey');
        const keys = [
            "novelaiModel", "novelaiArtistChain",
            "novelaiDefaultPositivePrompt", "novelaiDefaultNegativePrompt",
            "novelaiWidth", "novelaiHeight", "novelaiSteps", "novelaiScale",
            "novelaiCfgRescale", "novelaiSampler", "novelaiNoiseSchedule", "novelaiSeed"
        ];
        keys.forEach(key => {
            const elementKey = `${key}Settings`;
            const element = elementsModule[elementKey];
            if (element) {
                if (element.type === 'number') {
                    element.value = Number(stateModule.config[key] ?? defaultConfig[key]);
                } else {
                    element.value = stateModule.config[key] ?? defaultConfig[key];
                }
            }
        });
    },

    saveNovelAiSetting: (key) => {
         const elementKey = `${key}Settings`;
         const element = elementsModule[elementKey];
         if (element) {
             let value = element.value;
             if (key === 'novelaiApiKey') {
                 apiKeyManager.setNaiApiKey(value);
             } else {
                 if (element.type === 'number') {
                     value = Number(value);
                     const min = parseFloat(element.min);
                     const max = parseFloat(element.max);
                     if (!isNaN(min) && value < min) value = min;
                     if (!isNaN(max) && value > max) value = max;
                 }
                 stateModule.config[key] = value;
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                 }
             }
         }
    },

    updateLastNaiPromptDisplay: (promptText) => {
         if (elementsModule.novelaiLastPromptDisplay) {
             elementsModule.novelaiLastPromptDisplay.value = promptText || "";
             elementsModule.novelaiLastPromptDisplay.scrollTop = 0;
         }
    },

    _createChatroomListItem: (room) => {
        const item = document.createElement('div');
        item.className = 'chatroom-item';
        item.dataset.roomName = room.name;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'activeChatroom';
        radio.value = room.name;
        radio.id = `chatroom-${room.name}`;
        if (room.name === stateModule.config.activeChatRoomName) radio.checked = true;
        radio.addEventListener('change', () => {
            if (radio.checked) {
                if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
                    uiChatModule.saveChatHistoryToServer();
                }
                uiSettingsModule.switchActiveChatroom(room.name);
            }
        });

        const label = document.createElement('label');
        label.textContent = room.name;
        label.setAttribute('for', `chatroom-${room.name}`);
         label.addEventListener('click', (e) => {
             if (!radio.checked) {
                  if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
                      uiChatModule.saveChatHistoryToServer();
                  }
                  radio.checked = true;
                  uiSettingsModule.switchActiveChatroom(room.name);
             }
             uiSettingsModule.showChatroomDetailPage(room.name);
         });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const renameButton = document.createElement('div');
        renameButton.className = 'std-button item-rename';
        renameButton.textContent = '✎';
        renameButton.style.width = '28px';
        renameButton.style.height = '28px';

        const deleteButton = document.createElement('div');
        deleteButton.className = 'std-button item-delete';
        deleteButton.textContent = '✕';
        deleteButton.style.width = '28px';
        deleteButton.style.height = '28px';

        actionsDiv.appendChild(renameButton);
        actionsDiv.appendChild(deleteButton);

        item.appendChild(radio);
        item.appendChild(label);
        item.appendChild(actionsDiv);
        return item;
    },

    updateChatroomList: () => {
        const frag = document.createDocumentFragment();
        const rooms = [...stateModule.config.chatRooms].sort((a, b) => a.name.localeCompare(b.name));
        rooms.forEach(room => {
            if (!room || !room.name) return;
            frag.appendChild(uiSettingsModule._createChatroomListItem(room));
        });
        elementsModule.chatroomListContainer.innerHTML = '';
        elementsModule.chatroomListContainer.appendChild(frag);
    },

    switchActiveChatroom: (name) => {
        stateModule.config.activeChatRoomName = name;
        const room = stateModule.config.chatRooms.find(r => r.name === name);
        const backgroundPath = room?.backgroundImagePath;

        if (typeof uiChatModule !== 'undefined') {
            uiChatModule.loadChatHistory(name);
            uiChatModule.updateRoleButtonsList();
            uiChatModule.updateChatroomHistoryDisplay();
        }
        const radio = document.getElementById(`chatroom-${name}`);
        if (radio && !radio.checked) radio.checked = true;

        updateChatContextCache();
        uiSettingsModule.updateWorldInfoDisplay();

        stateModule.currentNovelId = null;
        if (elementsModule.novelContentDisplay) {
             elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
             elementsModule.novelContentDisplay.scrollTop = 0;
             elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
        }

        if(stateModule.isNovelInterfaceVisible) {
            if (stateModule.activeNovelPage === 'novel-bookshelf-page') {
                uiSettingsModule.novelUI_updateBookshelfPage();
            }
            if (stateModule.activeNovelPage === 'novel-toc-page' && elementsModule.novelTocListContainer) {
                 elementsModule.novelTocListContainer.innerHTML = '';
            }
        }
        if (elementsModule.roleplayRulesTextarea) {
            uiSettingsModule.loadRoleplayRulesSetting();
        }
        if (elementsModule.publicInfoTextarea) {
            uiSettingsModule.loadPublicInfoSetting();
        }
        if (elementsModule.chatContainer) {
            elementsModule.chatContainer.style.backgroundImage = backgroundPath ? `url(${backgroundPath}?t=${Date.now()})` : '';
        }
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
           mainModule.triggerDebouncedSave();
        }
    },

    showChatroomDetailPage: (name) => {
        if (!stateModule.config.chatRooms.some(r => r.name === name)) {
            uiSettingsModule.showSection('chat-room-directory-page');
            _logAndDisplayError(`聊天室 "${name}" 不存在。`, 'showChatroomDetailPage');
            return;
        }
        stateModule.currentChatRoom = name;
        elementsModule.chatroomDetailHeaderTitle.textContent = `聊天室详情 - ${name}`;
        uiSettingsModule.loadChatroomDetails(name);
        uiSettingsModule.showSection('chat-room-detail-page');
    },

    addChatroom: () => {
         if (typeof apiModule !== 'undefined' && apiModule.addChatroom) {
             apiModule.addChatroom();
         }
    },

    loadChatroomDetails: function(name) {
        const room = stateModule.config.chatRooms.find(r => r.name === name);
        if (!room) return;

        if (document.getElementById('chatroom-role-page').classList.contains('active')) {
            uiSettingsModule.updateChatroomRolePage(room);
        }
        if (document.getElementById('chatroom-novel-page').classList.contains('active')) {
             uiSettingsModule.updateChatroomNovelPage(room);
        }
        if (document.getElementById('current-chatroom-settings-page').classList.contains('active')) {
             if (typeof uiChatModule !== 'undefined' && uiChatModule.updateChatroomHistoryDisplay) {
                 uiChatModule.updateChatroomHistoryDisplay();
             }
             uiSettingsModule.updateWorldInfoDisplay();
             uiSettingsModule.loadRoleplayRulesSetting();
             uiSettingsModule.loadPublicInfoSetting();
        }
    },

    updateChatroomRolePage: function(room) {
        const frag = document.createDocumentFragment();

        const availableRoles = [...stateModule.config.roles].sort();
        const availableTemporaryRoles = [...stateModule.config.temporaryRoles].sort();

        const allAvailableSorted = [...availableRoles, ...availableTemporaryRoles].sort((a, b) => {
            const aIsTemp = availableTemporaryRoles.includes(a);
            const bIsTemp = availableTemporaryRoles.includes(b);
            if (aIsTemp && !bIsTemp) return 1;
            if (!aIsTemp && bIsTemp) return -1;
             if (a === "管理员") return -1;
             if (b === "管理员") return 1;
            return a.localeCompare(b);
        });

        elementsModule.chatroomRoleListContainer.innerHTML = '';

        if(allAvailableSorted.length === 0){
             const noRolesMsg = document.createElement('p');
             noRolesMsg.textContent = '暂无可用角色或临时角色。';
             noRolesMsg.style.textAlign = 'center';
             frag.appendChild(noRolesMsg);
        } else {
            allAvailableSorted.forEach(name => {
                const isTemporary = availableTemporaryRoles.includes(name);
                const item = document.createElement('div');
                item.className = 'chatroom-role-item';
                const label = document.createElement('label');
                label.textContent = name + (isTemporary ? " (临时)" : "");
                label.htmlFor = `role-checkbox-${room.name}-${name}`;
                label.style.flexGrow = '1';

                const check = document.createElement('input');
                check.type = 'checkbox';
                check.value = name;
                check.id = `role-checkbox-${room.name}-${name}`;
                const roomRoles = room && Array.isArray(room.roles) ? room.roles : [];
                check.checked = roomRoles.includes(name);
                if (isTemporary) {
                    check.disabled = true;
                    check.style.cursor = 'not-allowed';
                    label.style.cursor = 'not-allowed';
                    label.style.opacity = 0.6;
                    check.checked = true;
                } else {
                    check.addEventListener('change', async () => {
                        uiSettingsModule.updateChatroomRoles(room.name, name, check.checked);
                        if (typeof uiChatModule !== 'undefined' && uiChatModule.updateRoleButtonsList) {
                            uiChatModule.updateRoleButtonsList();
                        }
                        await updateChatContextCache();
                        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                           mainModule.triggerDebouncedSave();
                        }
                    });

                    label.addEventListener('click', (e) => {
                         e.preventDefault();
                         check.checked = !check.checked;
                         check.dispatchEvent(new Event('change'));
                    });
                }

                item.appendChild(label);
                item.appendChild(check);
                frag.appendChild(item);
            });
        }
        elementsModule.chatroomRoleListContainer.appendChild(frag);
    },

    updateChatroomRoles: function(roomName, roleName, isChecked) {
        const room = stateModule.config.chatRooms.find(r => r.name === roomName);
        if (room) {
            if (!Array.isArray(room.roles)) room.roles = [...stateModule.config.temporaryRoles];
            const idx = room.roles.indexOf(roleName);
            if (isChecked && idx === -1) room.roles.push(roleName);
            else if (!isChecked && idx > -1 && !stateModule.config.temporaryRoles.includes(roleName)) {
                 room.roles.splice(idx, 1);
            }

            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }
        }
    },

    renameChatroom: (oldName) => {
        if (typeof apiModule !== 'undefined' && apiModule.renameChatroom) {
            apiModule.renameChatroom(oldName);
        }
    },

    deleteChatroom: function(name) {
         if (typeof apiModule !== 'undefined' && apiModule.deleteChatroom) {
             apiModule.deleteChatroom(name);
         }
    },

    clearCurrentChatroomHistory: async () => {
        const activeChatroomName = stateModule.config.activeChatRoomName;
        if (!activeChatroomName) {
             return;
        }
        if (confirm(`确定要清空聊天室 "${activeChatroomName}" 的消息记录吗？此操作不可恢复。\n警告：这将同时删除所有用户定义的临时角色！\n注意：扮演规则和公共信息不会被删除。`)) {
             if (typeof uiChatModule !== 'undefined') {
                 uiChatModule.clearChatArea();
             }

             try {
                 const response = await fetch(`/history/${encodeURIComponent(activeChatroomName)}`, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify([])
                 });
                 if (!response.ok) {
                     throw new Error(`Failed to clear history file: ${response.status}`);
                 }
             } catch (error) {
                 _logAndDisplayError(`清空历史记录文件失败: ${error.message}`, 'clearCurrentChatroomHistory');
             }

             const userDefinedTemporaryRoles = stateModule.config.temporaryRoles.filter(r => r !== "管理员");
             if(userDefinedTemporaryRoles.length > 0) {
                 stateModule.config.temporaryRoles = ["管理员"];
                 userDefinedTemporaryRoles.forEach(roleName => {
                     delete stateModule.config.roleStates[roleName];
                 });

                 stateModule.config.chatRooms.forEach(room => {
                      if (Array.isArray(room.roles)) {
                          room.roles = room.roles.filter(r => !userDefinedTemporaryRoles.includes(r));
                      }
                 });
                 if (typeof uiChatModule !== 'undefined') {
                    uiChatModule.updateRoleButtonsList();
                 }
             }

             if (typeof uiChatModule !== 'undefined') {
                 uiChatModule.updateChatroomHistoryDisplay();

             }
              stateModule.chatContextCache = null;
              await updateChatContextCache();
              uiSettingsModule.updateWorldInfoDisplay();
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
             }

        }
    },

    loadGodSettings: (godName) => {
        const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'user2Instruction', 'enabled', 'display'];
        settings.forEach(type => {
            const camelCaseType = type.charAt(0).toUpperCase() + type.slice(1);
            const elId = `${godName}${camelCaseType}Settings`;
            const el = elementsModule[elId];
            if (el) {
                const toolConfig = stateModule.config.toolSettings[godName];
                const val = toolConfig ? toolConfig[type] : undefined;
                if (el.type === 'checkbox') {
                    el.checked = val ?? (type === 'display');
                } else {
                    el.value = val || '';
                }
            }
        });
    },

    saveGodSettings: (godName) => {
        if (!stateModule.config.toolSettings[godName]) {
            stateModule.config.toolSettings[godName] = {};
        }
        const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'user2Instruction', 'enabled', 'display'];
        settings.forEach(type => {
            const camelCaseType = type.charAt(0).toUpperCase() + type.slice(1);
            const elId = `${godName}${camelCaseType}Settings`;
            const el = elementsModule[elId];
            if (el) {
                stateModule.config.toolSettings[godName][type] = (el.type === 'checkbox') ? el.checked : el.value;
            }
        });
        updateChatContextCache();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    displayErrorLog: (errorMessages) => {
         if (Array.isArray(errorMessages)) {
             if(elementsModule.errorLogDisplay) {
                 elementsModule.errorLogDisplay.value = errorMessages.join('\n--------------------\n');
                 elementsModule.errorLogDisplay.scrollTop = elementsModule.errorLogDisplay.scrollHeight;
             }
         } else if (elementsModule.errorLogDisplay) {
              elementsModule.errorLogDisplay.value = "错误日志格式无效。";
         }
    },

    clearErrorLogDisplay: () => {
        stateModule.config.errorLogs = [];
        if (elementsModule.errorLogDisplay) {
            elementsModule.errorLogDisplay.value = '';
        }
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
           mainModule.triggerDebouncedSave();
        }
    },

    copyErrorLog: () => {
        const errorLogText = elementsModule.errorLogDisplay.value;
        if (navigator.clipboard && errorLogText) {
            navigator.clipboard.writeText(errorLogText).then(() => {

            }).catch(err => {
                _logAndDisplayError('无法复制错误日志到剪贴板: ' + err, 'copyErrorLog');
            });
        } else if (!errorLogText) {

        } else {
             _logAndDisplayError('浏览器不支持剪贴板 API 或日志为空', 'copyErrorLog');
        }
    },

    clearAllConfiguration: async () => {
         if (confirm("【！！高危警告！！】\n\n您确定要清除所有配置、历史记录、角色、小说和图片吗？\n\n此操作将完全重置应用程序，所有数据将丢失且无法恢复！\n\n请再次确认是否要执行此操作？")) {
             try {
                 const response = await fetch('/clear-all-config', { method: 'POST' });
                 const result = await response.json();
                 if (!response.ok) {
                     throw new Error(result.error || `HTTP error! status: ${response.status}`);
                 }
                 alert("所有配置已清除！应用程序将重新加载。");

                 location.reload();
             } catch (error) {
                 _logAndDisplayError(`清除全部配置失败: ${error.message}`, 'clearAllConfiguration');
                 alert(`清除全部配置失败: ${error.message}`);
             }
         }
    },

    exportConfiguration: () => {
        if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
            uiChatModule.saveChatHistoryToServer();
        }
        window.location.href = '/export-full-config-zip';
    },

    importConfiguration: () => {
        elementsModule.importConfigFile.click();
    },

    handleImportConfig: async (event) => {
         const file = event.target.files[0];
         if (!file) return;
         if (!file.name.toLowerCase().endsWith('.zip')) {
              _logAndDisplayError('请选择一个 .zip 文件进行导入。', 'handleImportConfig');
              alert('请选择一个 .zip 文件进行导入。');
              event.target.value = null;
              return;
         }

         const formData = new FormData();
         formData.append('config_zip', file);

         try {
              const response = await fetch('/import-full-config-zip', {
                  method: 'POST',
                  body: formData,
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! status: ${response.status}`);
              }

              alert(result.message || "配置导入成功！");

              await configModule.loadConfig();
              roleDataManager.clearCache();
              initializationModule.initializeConfig();

         } catch (error) {
              _logAndDisplayError(`导入配置失败: ${error.message}`, 'handleImportConfig');
              alert(`导入配置失败: ${error.message}`);
         } finally {
             event.target.value = null;
         }
    },

    addNovel: async () => {
        const name = prompt("请输入新小说名称:");
        if (!name || name.trim() === "") {
             return;
        }

        if (stateModule.config.novels.some(n => n.name === name)) {
            _logAndDisplayError(`小说名称 "${name}" 已存在。`, 'addNovel');
            return;
        }

        const text = prompt(`请在此粘贴小说《${name}》的内容:`);
        if (text === null) {
            return;
        }
        if (!text) {
            _logAndDisplayError("小说内容不能为空。", 'addNovel');
            return;
        }

        try {
             const newNovelMeta = await apiModule.saveNovel(name, text);

             stateModule.config.novels.push({
                 id: newNovelMeta.id,
                 name: newNovelMeta.name,
                 filename: newNovelMeta.filename
             });
             uiSettingsModule.updateNovelList();

             if (document.getElementById('chatroom-novel-page').classList.contains('active') && stateModule.currentChatRoom) {
                const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                if (room) uiSettingsModule.updateChatroomNovelPage(room);
             }
             if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                 uiSettingsModule.novelUI_updateBookshelfPage();
             }
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
             }
        } catch (error) {
             _logAndDisplayError(`添加小说失败: ${error.message}`, 'addNovel');
        }

    },

    renameNovel: (novelId, currentName) => {
         const newName = prompt(`输入小说 "${currentName}" 的新名称:`, currentName);
         if (!newName || newName.trim() === "" || newName === currentName) {
             return;
         }
         if (stateModule.config.novels.some(n => n.name === newName && n.id !== novelId)) {
             _logAndDisplayError(`小说名称 "${newName}" 已存在。`, 'renameNovel');
             return;
         }

         const novel = stateModule.config.novels.find(n => n.id === novelId);
         if (novel) {
             novel.name = newName;

             uiSettingsModule.updateNovelList();

             if (document.getElementById('chatroom-novel-page').classList.contains('active') && stateModule.currentChatRoom) {
                 const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                 if (room) uiSettingsModule.updateChatroomNovelPage(room);
             }

             if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                 uiSettingsModule.novelUI_updateBookshelfPage();
             }
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
             }
         } else {
             _logAndDisplayError(`无法找到要重命名的小说，ID: ${novelId}`, 'renameNovel');
         }
     },

    deleteNovel: async (novelId, novelName) => {
        if (confirm(`确定要删除小说 "${novelName}" 吗？这将同时删除小说文件，无法恢复。`)) {

            const novelIndex = stateModule.config.novels.findIndex(n => n.id === novelId);
            if (novelIndex === -1) {
                _logAndDisplayError("未在配置中找到该小说，无法删除。", "deleteNovel");
                return;
            }

            try {
                 await apiModule.deleteNovelFile(novelId);
            } catch (error) {
                _logAndDisplayError(`删除小说文件失败: ${error.message}`, 'deleteNovel');
                return;
            }

            stateModule.config.novels.splice(novelIndex, 1);
            delete stateModule.config.novelCurrentSegmentIds[novelId];
            delete stateModule.novelContentCache[novelId];
            delete stateModule.currentTocIndexByNovel[novelId];
            if (elementsModule.novelContentDisplay?.dataset.novelId === novelId) {
                elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
            }

            stateModule.config.chatRooms.forEach(room => {
                if (Array.isArray(room.associatedNovelIds)) {
                     room.associatedNovelIds = room.associatedNovelIds.filter(id => id !== novelId);
                 }
                 if (stateModule.config.activeNovelIdsInChatroom[room.name]) {
                     stateModule.config.activeNovelIdsInChatroom[room.name] = stateModule.config.activeNovelIdsInChatroom[room.name].filter(id => id !== novelId);
                 }
             });

            if (stateModule.currentNovelId === novelId) {
                stateModule.currentNovelId = null;
                stateModule.config.lastViewedNovelId = null;
                if (elementsModule.novelContentDisplay) {
                    elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
                    elementsModule.novelContentDisplay.scrollTop = 0;
                    elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
                }
            }

            uiSettingsModule.updateNovelList();

            if (document.getElementById('chatroom-novel-page').classList.contains('active') && stateModule.currentChatRoom) {
                 const room = stateModule.config.chatRooms.find(r => r.name === stateModule.currentChatRoom);
                 if (room) uiSettingsModule.updateChatroomNovelPage(room);
             }

             if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                 uiSettingsModule.novelUI_updateBookshelfPage();
             }
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
             }

        }
    },

    _createNovelListItem: (novel) => {
        const item = document.createElement('div');
        item.className = 'novel-item';
        item.dataset.novelId = novel.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'novel-name';
        nameSpan.textContent = novel.name;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const renameButton = document.createElement('div');
        renameButton.className = 'std-button item-rename';
        renameButton.textContent = '✎';
        renameButton.style.width = '28px';
        renameButton.style.height = '28px';

        const deleteButton = document.createElement('div');
        deleteButton.className = 'std-button item-delete';
        deleteButton.textContent = '✕';
        deleteButton.style.width = '28px';
        deleteButton.style.height = '28px';

        actionsDiv.appendChild(renameButton);
        actionsDiv.appendChild(deleteButton);

        item.appendChild(nameSpan);
        item.appendChild(actionsDiv);

        return item;
    },

    updateNovelList: () => {
        const fragment = document.createDocumentFragment();
        const sortedNovels = [...stateModule.config.novels].sort((a, b) => a.name.localeCompare(b.name));
        sortedNovels.forEach(novel => {
            if(novel && novel.id && novel.name && novel.filename) {
               fragment.appendChild(uiSettingsModule._createNovelListItem(novel));
            }
        });
        elementsModule.novelListContainer.innerHTML = '';
        elementsModule.novelListContainer.appendChild(fragment);
    },

    updateChatroomNovelPage: (room) => {
        const frag = document.createDocumentFragment();
        const novels = [...stateModule.config.novels].sort((a, b) => a.name.localeCompare(b.name));
        const associatedIds = new Set(room.associatedNovelIds || []);

        elementsModule.chatroomNovelListContainer.innerHTML = '';

        if (novels.length === 0) {
            const noNovelsMsg = document.createElement('p');
            noNovelsMsg.textContent = '暂无可用小说。请先在“剧情模式”中添加小说。';
            noNovelsMsg.style.textAlign = 'center';
            frag.appendChild(noNovelsMsg);
        } else {
            novels.forEach(novel => {
                 if(!novel || !novel.id || !novel.name || !novel.filename) return;
                 const item = document.createElement('div');
                 item.className = 'chatroom-novel-item';

                 const label = document.createElement('label');
                 label.textContent = novel.name;
                 label.htmlFor = `novel-checkbox-${room.name}-${novel.id}`;

                 const check = document.createElement('input');
                 check.type = 'checkbox';
                 check.value = novel.id;
                 check.id = `novel-checkbox-${room.name}-${novel.id}`;
                 check.checked = associatedIds.has(novel.id);

                 check.addEventListener('change', () => {
                     uiSettingsModule.updateChatroomNovels(room.name, novel.id, check.checked);
                 });

                 label.addEventListener('click', (e) => {
                      e.preventDefault();
                      check.checked = !check.checked;
                      check.dispatchEvent(new Event('change'));
                 });

                 item.appendChild(label);
                 item.appendChild(check);
                 frag.appendChild(item);
            });
        }
        elementsModule.chatroomNovelListContainer.appendChild(frag);
    },

    updateChatroomNovels: (roomName, novelId, isChecked) => {
        const room = stateModule.config.chatRooms.find(r => r.name === roomName);
        if (room) {
            if (!Array.isArray(room.associatedNovelIds)) {
                room.associatedNovelIds = [];
            }
            const index = room.associatedNovelIds.indexOf(novelId);
            if (isChecked && index === -1) {
                room.associatedNovelIds.push(novelId);
            } else if (!isChecked && index > -1) {
                room.associatedNovelIds.splice(index, 1);

                if (stateModule.config.activeNovelIdsInChatroom[roomName]) {
                     const activeIndex = stateModule.config.activeNovelIdsInChatroom[roomName].indexOf(novelId);
                     if (activeIndex > -1) {
                         stateModule.config.activeNovelIdsInChatroom[roomName].splice(activeIndex, 1);
                     }
                 }
            }

             if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page' && stateModule.config.activeChatRoomName === roomName) {
                 uiSettingsModule.novelUI_updateBookshelfPage();
             }
             updateChatContextCache();
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
             }
        }
    },

    novelUI_toggleNovelInterface: () => {
        stateModule.isNovelInterfaceVisible = !stateModule.isNovelInterfaceVisible;
        elementsModule.novelInterface.classList.toggle('active', stateModule.isNovelInterfaceVisible);

        if (stateModule.isNovelInterfaceVisible) {
            if (elementsModule.settingsPanel.classList.contains('active')) {
                uiSettingsModule.toggleSettings();
            }
            uiSettingsModule.novelUI_hideAllNovelPages();
            stateModule.novelPageStack = [];
            stateModule.activeNovelPage = null;

            const displayArea = elementsModule.novelContentDisplay;
            const currentlyDisplayedNovelId = displayArea?.dataset.novelId;

            if (stateModule.currentNovelId && currentlyDisplayedNovelId === stateModule.currentNovelId) {

            } else if (stateModule.currentNovelId) {
                 const activeRoom = stateModule.config.chatRooms.find(r => r.name === stateModule.config.activeChatRoomName);
                 const isAssociated = activeRoom?.associatedNovelIds?.includes(stateModule.currentNovelId);
                 if (isAssociated) {
                     uiSettingsModule.novelUI_loadAndDisplayNovelContent(stateModule.currentNovelId);
                 } else {
                     stateModule.currentNovelId = null;
                     stateModule.config.lastViewedNovelId = null;
                     if (displayArea) {
                         displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
                         displayArea.removeAttribute('data-novel-id');
                     }
                 }
            } else {
                if (displayArea) {
                     displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
                     displayArea.removeAttribute('data-novel-id');
                }
            }
        } else {
            uiSettingsModule.novelUI_hideAllNovelPages();
            stateModule.novelPageStack = [];
            stateModule.activeNovelPage = null;

        }
    },

    novelUI_hideAllNovelPages: () => {
        if (elementsModule.novelBookshelfPage) elementsModule.novelBookshelfPage.classList.remove('active');
        if (elementsModule.novelTocPage) elementsModule.novelTocPage.classList.remove('active');
        stateModule.activeNovelPage = null;
    },

    novelUI_showNovelSection: (pageId) => {
        uiSettingsModule.novelUI_hideAllNovelPages();
        let pageElement = null;
        if (pageId === 'novel-bookshelf-page') {
            pageElement = elementsModule.novelBookshelfPage;
            uiSettingsModule.novelUI_updateBookshelfPage();
        } else if (pageId === 'novel-toc-page') {
            pageElement = elementsModule.novelTocPage;
             uiSettingsModule.novelUI_updateTocPage();
        }

        if (pageElement) {
            pageElement.classList.add('active');
            stateModule.activeNovelPage = pageId;
            if (stateModule.novelPageStack[stateModule.novelPageStack.length - 1] !== pageId) {
                stateModule.novelPageStack.push(pageId);
            }
        } else {
            stateModule.novelPageStack = [];
            stateModule.activeNovelPage = null;
        }
    },

    novelUI_closeCurrentNovelSection: (pageId) => {
        let pageElement = null;
        if (pageId === 'novel-bookshelf-page') pageElement = elementsModule.novelBookshelfPage;
        else if (pageId === 'novel-toc-page') pageElement = elementsModule.novelTocPage;

        if (pageElement) {
            pageElement.classList.remove('active');

            if (stateModule.novelPageStack[stateModule.novelPageStack.length - 1] === pageId) {
                stateModule.novelPageStack.pop();
            } else {
                 const index = stateModule.novelPageStack.indexOf(pageId);
                 if (index > -1) stateModule.novelPageStack.splice(index, 1);
            }

            if (stateModule.novelPageStack.length > 0) {
                const previousPageId = stateModule.novelPageStack[stateModule.novelPageStack.length - 1];
                uiSettingsModule.novelUI_showNovelSection(previousPageId);
            } else {
                stateModule.activeNovelPage = null;
            }
        }
    },

    novelUI_updateBookshelfPage: () => {
        const container = elementsModule.novelBookshelfListContainer;
        if (!container) return;
        container.innerHTML = '';

        const currentChatroomName = stateModule.config.activeChatRoomName;
        if (!currentChatroomName) {
            container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室</p>';
            return;
        }

        const room = stateModule.config.chatRooms.find(r => r.name === currentChatroomName);
        if (!room || !Array.isArray(room.associatedNovelIds) || room.associatedNovelIds.length === 0) {
            container.innerHTML = '<p style="text-align: center;">当前聊天室未关联小说<br>(请在 设置 -> 聊天室设置 -> 聊天室详情 -> 聊天室小说 中关联)</p>';
            return;
        }

        const activeIdsInRoom = new Set(stateModule.config.activeNovelIdsInChatroom[currentChatroomName] || []);
        const fragment = document.createDocumentFragment();

        const associatedNovels = room.associatedNovelIds
            .map(id => stateModule.config.novels.find(n => n.id === id))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (associatedNovels.length === 0) {
             container.innerHTML = '<p style="text-align: center;">关联的小说似乎已被删除</p>';
             return;
        }

        associatedNovels.forEach(novel => {
             if (!novel || !novel.id || !novel.name || !novel.filename) return;
            const item = document.createElement('div');
            item.className = 'novel-bookshelf-item';
            item.dataset.novelId = novel.id;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'currentNovelSelection';
            radio.value = novel.id;
            radio.id = `novel-select-${currentChatroomName}-${novel.id}`;
            radio.checked = stateModule.currentNovelId === novel.id;

            const label = document.createElement('label');
            label.textContent = novel.name;
            label.htmlFor = radio.id;
             label.style.cursor = 'pointer';
            if (stateModule.currentNovelId === novel.id) {
                label.style.fontWeight = 'bold';
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'novel-activation-checkbox';
            checkbox.value = novel.id;
            checkbox.id = `novel-activate-${currentChatroomName}-${novel.id}`;
            checkbox.checked = activeIdsInRoom.has(novel.id);

            item.appendChild(radio);
            item.appendChild(label);
            item.appendChild(checkbox);
            fragment.appendChild(item);
        });

        container.appendChild(fragment);
    },

    novelUI_handleNovelSelection: (novelId) => {
        if (stateModule.currentNovelId !== novelId) {
            stateModule.currentNovelId = novelId;
            stateModule.config.lastViewedNovelId = novelId;
            if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
            }

             uiSettingsModule.novelUI_updateBookshelfPage();
             uiSettingsModule.novelUI_loadAndDisplayNovelContent(novelId);
        } else {
            const displayArea = elementsModule.novelContentDisplay;
             if (displayArea?.dataset.novelId !== novelId) {
                  uiSettingsModule.novelUI_loadAndDisplayNovelContent(novelId);
             }
        }

         uiSettingsModule.novelUI_closeCurrentNovelSection('novel-bookshelf-page');
    },

    novelUI_handleNovelActivation: (novelId, isChecked) => {
        const currentChatroomName = stateModule.config.activeChatRoomName;
        if (!currentChatroomName) return;

        if (!stateModule.config.activeNovelIdsInChatroom[currentChatroomName]) {
            stateModule.config.activeNovelIdsInChatroom[currentChatroomName] = [];
        }

        const activeIds = stateModule.config.activeNovelIdsInChatroom[currentChatroomName];
        const index = activeIds.indexOf(novelId);

        if (isChecked && index === -1) {
            activeIds.push(novelId);
        } else if (!isChecked && index > -1) {
            activeIds.splice(index, 1);
        }

        updateChatContextCache();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
           mainModule.triggerDebouncedSave();
        }
    },

    novelUI_loadAndDisplayNovelContent: async (novelId) => {
        const displayArea = elementsModule.novelContentDisplay;
        if (!displayArea || stateModule.isNovelLoading) return;

        const novelMeta = stateModule.config.novels.find(n => n.id === novelId);
        if (!novelMeta || !novelMeta.filename) {
            displayArea.innerHTML = '';
            displayArea.removeAttribute('data-novel-id');
            stateModule.currentNovelId = null;
            stateModule.config.lastViewedNovelId = null;
            _logAndDisplayError("无法找到小说元数据或文件名", 'novelUI_loadAndDisplayNovelContent');
            return;
        }

        stateModule.isNovelLoading = true;
        displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">正在加载...</p>';

        let novelData = stateModule.novelContentCache[novelId];
        if (!novelData || !novelData.segments || !novelData.toc) {
             try {
                novelData = await apiModule.fetchNovelStructuredContent(novelMeta.filename);
                if (!novelData || !Array.isArray(novelData.segments) || !Array.isArray(novelData.toc)) {
                    throw new Error("API 返回的结构化数据无效。");
                }
                stateModule.novelContentCache[novelId] = novelData;
             } catch (error) {
                 delete stateModule.novelContentCache[novelId];
                 stateModule.currentNovelId = null;
                 stateModule.config.lastViewedNovelId = null;
                 stateModule.isNovelLoading = false;
                 _logAndDisplayError(`加载小说内容失败: ${error.message}`, 'novelUI_loadAndDisplayNovelContent');
                 displayArea.innerHTML = `<p style="text-align: center; color: red;">加载失败</p>`;
                 displayArea.removeAttribute('data-novel-id');
                 return;
             }
        }

        const fragment = document.createDocumentFragment();
        const tocMap = new Map();
        novelData.toc.forEach((item, index) => {
            if (item && item.segmentId !== undefined && !tocMap.has(item.segmentId)) {
                tocMap.set(item.segmentId, { index: index, title: item.title });
            }
        });

        novelData.segments.forEach(segment => {
            if (segment && segment.id !== undefined && segment.content !== undefined) {
                if (tocMap.has(segment.id)) {
                    const tocEntry = tocMap.get(segment.id);
                    const markerId = `novel-chapter-marker-${novelId}-${tocEntry.index}`;
                    const marker = document.createElement('span');
                    marker.className = 'novel-chapter-marker';
                    marker.id = markerId;
                    marker.dataset.segmentId = segment.id;
                    marker.textContent = tocEntry.title.replace(/</g, "<").replace(/>/g, ">");
                    fragment.appendChild(marker);
                    fragment.appendChild(document.createElement('br'));
                }

                const segmentSpan = document.createElement('span');
                segmentSpan.className = 'novel-segment';
                segmentSpan.dataset.segmentId = segment.id;
                segmentSpan.textContent = segment.content.replace(/</g, "<").replace(/>/g, ">");
                fragment.appendChild(segmentSpan);
                fragment.appendChild(document.createTextNode('\n'));
            }
        });

        displayArea.innerHTML = '';
        displayArea.appendChild(fragment);
        displayArea.dataset.novelId = novelId;

        setTimeout(() => {
            const savedSegmentId = stateModule.config.novelCurrentSegmentIds[novelId];
            let targetElement = null;
            if (savedSegmentId !== undefined) {
                 targetElement = displayArea.querySelector(`.novel-segment[data-segment-id="${savedSegmentId}"]`);
                 if (!targetElement) {
                     targetElement = displayArea.querySelector(`.novel-chapter-marker[data-segment-id="${savedSegmentId}"]`);
                 }
            }
            if (targetElement) {
                 targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
            } else {
                 displayArea.scrollTop = 0;
                 stateModule.config.novelCurrentSegmentIds[novelId] = 0;
                 stateModule.currentTocIndexByNovel[novelId] = 0;
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                 }
            }
        }, 50);
        stateModule.isNovelLoading = false;

    },

    novelUI_updateTocPage: () => {
        const container = elementsModule.novelTocListContainer;
        const novelId = stateModule.currentNovelId;
        if (!container || !novelId) {
            if(container) container.innerHTML = '<p style="text-align: center;">请先在书目中选择一本小说</p>';
            return;
        }

        container.innerHTML = '';
        const novelData = stateModule.novelContentCache[novelId];

        if (!novelData || !novelData.toc || novelData.toc.length === 0) {
             if (!stateModule.isNovelLoading && !novelData) {
                 container.innerHTML = '<p style="text-align: center;">正在加载小说数据...</p>';
                 uiSettingsModule.novelUI_loadAndDisplayNovelContent(novelId).then(() => {
                      setTimeout(uiSettingsModule.novelUI_updateTocPage, 100);
                 }).catch(e => {
                      if(container) container.innerHTML = '<p style="text-align: center; color: red;">加载失败</p>';
                 });
             } else if (novelData && (!novelData.toc || novelData.toc.length === 0)){
                  container.innerHTML = '<p style="text-align: center;">未找到章节信息</p>';
             } else {
                  container.innerHTML = '<p style="text-align: center;">内容加载中，请稍候...</p>';
             }
            return;
        }

        const fragment = document.createDocumentFragment();
        novelData.toc.forEach((tocItem, index) => {
            if (tocItem && tocItem.segmentId !== undefined && tocItem.title !== undefined) {
                const tocElement = document.createElement('div');
                tocElement.className = 'novel-toc-item';
                tocElement.textContent = tocItem.title.replace(/</g, "<").replace(/>/g, ">");
                tocElement.dataset.targetSegmentId = tocItem.segmentId;
                tocElement.addEventListener('click', uiSettingsModule.novelUI_handleTocJump);
                fragment.appendChild(tocElement);
            }
        });

        container.appendChild(fragment);

         const currentTocIndex = stateModule.currentTocIndexByNovel[novelId];
         if (currentTocIndex !== undefined && currentTocIndex !== null && novelData.toc[currentTocIndex]) {
              const targetSegmentId = novelData.toc[currentTocIndex].segmentId;
              if (targetSegmentId !== undefined) {
                 setTimeout(() => {
                    const targetTocElement = container.querySelector(`.novel-toc-item[data-target-segment-id="${targetSegmentId}"]`);
                    if (targetTocElement) {
                        targetTocElement.scrollIntoView({ block: 'center', behavior: 'auto' });
                    }
                 }, 50);
             }
         }
    },

    novelUI_handleTocJump: (event) => {
        const targetSegmentId = event.currentTarget.dataset.targetSegmentId;
        const novelId = stateModule.currentNovelId;
        if (targetSegmentId === undefined || !novelId) return;

        const displayArea = elementsModule.novelContentDisplay;
        let targetElement = displayArea.querySelector(`.novel-chapter-marker[data-segment-id="${targetSegmentId}"]`);
        if (!targetElement) {
             targetElement = displayArea.querySelector(`.novel-segment[data-segment-id="${targetSegmentId}"]`);
        }

        if (targetElement && displayArea) {
             targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
             stateModule.config.novelCurrentSegmentIds[novelId] = parseInt(targetSegmentId, 10);
             const tocIndex = stateModule.novelContentCache[novelId]?.toc.findIndex(item => item.segmentId === parseInt(targetSegmentId, 10));
             if (tocIndex !== undefined && tocIndex !== -1) {
                 stateModule.currentTocIndexByNovel[novelId] = tocIndex;
             }
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                mainModule.triggerDebouncedSave();
             }
        }

        uiSettingsModule.novelUI_closeCurrentNovelSection('novel-toc-page');
    },


    novelUI_saveScrollPosition: () => {
         clearTimeout(stateModule.scrollUpdateTimer);
         stateModule.scrollUpdateTimer = setTimeout(() => {
             const currentNovelId = stateModule.currentNovelId;
             const displayArea = elementsModule.novelContentDisplay;

             if (currentNovelId && displayArea && displayArea.dataset.novelId === currentNovelId && stateModule.isNovelInterfaceVisible && !stateModule.activeNovelPage && stateModule.config.novelCurrentSegmentIds) {

                 let topSegmentId = 0;
                 const segments = displayArea.querySelectorAll('.novel-segment, .novel-chapter-marker[data-segment-id]');
                 const viewportTop = displayArea.scrollTop;
                 const viewportBottom = viewportTop + displayArea.clientHeight;

                 for (let i = 0; i < segments.length; i++) {
                      const segmentElement = segments[i];
                      const elementTop = segmentElement.offsetTop;
                      const elementBottom = elementTop + segmentElement.offsetHeight;

                      if (elementTop >= viewportTop || elementBottom > viewportTop) {
                           topSegmentId = parseInt(segmentElement.dataset.segmentId, 10);
                           break;
                      }
                 }
                 if (isNaN(topSegmentId)) topSegmentId = 0;

                 if(stateModule.config.novelCurrentSegmentIds[currentNovelId] !== topSegmentId) {
                    stateModule.config.novelCurrentSegmentIds[currentNovelId] = topSegmentId;
                    if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                        mainModule.triggerDebouncedSave();
                    }
                 }

                 const novelData = stateModule.novelContentCache[currentNovelId];
                 let currentTocIndex = 0;
                 if (novelData && novelData.toc && novelData.toc.length > 0) {
                    let foundTocIndex = -1;
                    for(let i = novelData.toc.length - 1; i >= 0; i--) {
                        if (novelData.toc[i].segmentId <= topSegmentId) {
                            foundTocIndex = i;
                            break;
                        }
                    }
                    if (foundTocIndex !== -1) {
                         currentTocIndex = foundTocIndex;
                    }
                 }
                 stateModule.currentTocIndexByNovel[currentNovelId] = currentTocIndex;

             }
         }, 250);
    },

    _triggerDownload: (filename, data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    exportRole: async () => {
        const roleName = stateModule.currentRole;
        if (!roleName) {
            _logAndDisplayError("没有当前选定的角色可导出。", 'exportRole');
            return;
        }
        if (!stateModule.config.roles.includes(roleName)) {
            _logAndDisplayError(`角色 "${roleName}" 不存在于配置中。`, 'exportRole');
            return;
        }

        const roleData = await roleDataManager.getRoleData(roleName);
        if (!roleData) {
            _logAndDisplayError(`无法获取角色 "${roleName}" 的数据进行导出。`, 'exportRole');
            return;
        }

        uiSettingsModule._triggerDownload(`role_${roleName}.json`, roleData);
    },

    importRole: () => {
        elementsModule.importRoleFile.click();
    },

    handleImportRoleFile: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(e) {
            let importedRoleData;
            try {
                importedRoleData = JSON.parse(e.target.result);
            } catch (err) {
                 _logAndDisplayError(`导入角色失败: 文件不是有效的 JSON. ${err.message}`, 'handleImportRoleFile');
                 event.target.value = null;
                 return;
            }

            if (!importedRoleData || typeof importedRoleData !== 'object' || !importedRoleData.name || typeof importedRoleData.name !== 'string') {
                _logAndDisplayError("导入的文件格式无效，缺少 'name' 字段。", 'handleImportRoleFile');
                 event.target.value = null;
                 return;
            }

            let importName = importedRoleData.name;
            let finalName = importName;

            while (stateModule.config.roles.includes(finalName) || stateModule.config.temporaryRoles.includes(finalName)) {
                finalName = prompt(`名称 "${finalName}" 已存在。请输入新的角色名称：`, `${importName}_imported`);
                if (!finalName || finalName.trim() === "") {
                    event.target.value = null;
                    return;
                }
                finalName = finalName.trim();
            }

            const dataToSave = {
                name: finalName,
                setting: importedRoleData.setting || '',
                memory: importedRoleData.memory || '',
                drawingTemplate: importedRoleData.drawingTemplate || ''
            };

            const saved = await roleDataManager.saveRoleData(finalName, dataToSave);
            if (saved) {
                stateModule.config.roles.push(finalName);
                stateModule.config.roleStates[finalName] = uiChatModule.ROLE_STATE_DEFAULT;

                stateModule.config.chatRooms.forEach(room => {
                    if (Array.isArray(room.roles) && !room.roles.includes(finalName)) {
                        room.roles.push(finalName);
                    }
                });

                uiSettingsModule.updateRoleList();
                if (typeof uiChatModule !== 'undefined') {
                    uiChatModule.updateRoleButtonsList();
                }
                await updateChatContextCache();
                if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                   mainModule.triggerDebouncedSave();
                }

                if (document.getElementById('role-detail-page').classList.contains('active') && stateModule.currentRole === importName) {
                    uiSettingsModule.showRoleDetailPage(finalName);
                }
            } else {
                 _logAndDisplayError(`保存导入的角色数据失败: ${finalName}`, 'handleImportRoleFile');
            }
            event.target.value = null;
        };
        reader.onerror = function(e) {
            event.target.value = null;
            _logAndDisplayError("读取文件时出错。", 'handleImportRoleFile');
        };
        reader.readAsText(file);
    },

    exportChatroom: () => {
         const roomName = stateModule.currentChatRoom;
         if (!roomName) {
             _logAndDisplayError("没有当前选定的聊天室可导出。", 'exportChatroom');
             return;
         }
         window.location.href = '/export-chatroom-zip/' + encodeURIComponent(roomName);
    },

    importChatroom: () => {
        elementsModule.importChatroomFile.click();
    },

    handleImportChatroomFile: async (event) => {
         const file = event.target.files[0];
         if (!file) return;
         if (!file.name.toLowerCase().endsWith('.zip')) {
              _logAndDisplayError('请选择一个 .zip 文件进行导入。', 'handleImportChatroomFile');
              event.target.value = null;
              return;
         }

         const formData = new FormData();
         formData.append('chatroom_zip', file);

         try {
              const response = await fetch('/import-chatroom-zip', {
                  method: 'POST',
                  body: formData,
              });
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.error || `HTTP error! status: ${response.status}`);
              }

              alert(result.message || "聊天室导入成功！");

              await configModule.loadConfig();
              roleDataManager.clearCache();
              initializationModule.initializeConfig();

         } catch (error) {
              _logAndDisplayError(`导入聊天室失败: ${error.message}`, 'handleImportChatroomFile');
              alert(`导入聊天室失败: ${error.message}`);
         } finally {
             event.target.value = null;
         }
    },

    loadRoleplayRulesSetting: () => {
        const activeRoomName = stateModule.config.activeChatRoomName;
        const textarea = elementsModule.roleplayRulesTextarea;
        if (textarea) {
            if (activeRoomName) {
                 const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
                 textarea.value = room?.roleplayRules || "";
                 textarea.disabled = false;
            } else {
                 textarea.value = "";
                 textarea.disabled = true;
            }
        }
    },

    saveRoleplayRulesSetting: () => {
        const activeRoomName = stateModule.config.activeChatRoomName;
        const textarea = elementsModule.roleplayRulesTextarea;
        if (activeRoomName && textarea) {
             const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
             if (room) {
                 room.roleplayRules = textarea.value;
                 updateChatContextCache();
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                 }
             }
        }
    },

    loadPublicInfoSetting: () => {
        const activeRoomName = stateModule.config.activeChatRoomName;
        const textarea = elementsModule.publicInfoTextarea;
        if (textarea) {
            if (activeRoomName) {
                const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
                textarea.value = room?.publicInfo || "";
                textarea.disabled = false;
            } else {
                textarea.value = "";
                textarea.disabled = true;
            }
        }
    },

    savePublicInfoSetting: () => {
        const activeRoomName = stateModule.config.activeChatRoomName;
        const textarea = elementsModule.publicInfoTextarea;
        if (activeRoomName && textarea) {
            const room = stateModule.config.chatRooms.find(r => r.name === activeRoomName);
            if (room) {
                room.publicInfo = textarea.value;
                updateChatContextCache();
                if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                }
            }
        }
    },

};