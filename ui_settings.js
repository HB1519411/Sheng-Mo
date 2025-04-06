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

    showSection: async (sectionId) => {
        uiSettingsModule.hideAllSettingPages();
        const sectionElement = document.getElementById(sectionId);
        if (!sectionElement) {
            uiSettingsModule.showSection('settings-main-page');
            stateModule.pageStack = ['settings-main-page'];
            return;
        }


        let requiresChatroomData = [
            'role-list-page', 'story-mode-page', 'current-chatroom-settings-page', 'chat-room-detail-page',
            'chatroom-override-config-menu-page', 'chatroom-override-general-page', 'chatroom-override-drawingMaster-page',
            'chatroom-override-gameHost-page', 'chatroom-override-writingMaster-page', 'chatroom-override-characterUpdateMaster-page',
            'chatroom-override-privateAssistant-page'
        ].includes(sectionId);

        let needsRefresh = false;
        if (requiresChatroomData && !stateModule.currentChatroomDetails && stateModule.config.activeChatRoomName) {
             await apiModule.fetchChatroomDetails(stateModule.config.activeChatRoomName);
             needsRefresh = true;
        } else if (requiresChatroomData && stateModule.currentChatroomDetails && stateModule.config.activeChatRoomName !== stateModule.currentChatroomDetails.config.name) {
             await apiModule.fetchChatroomDetails(stateModule.config.activeChatRoomName);
             needsRefresh = true;
        }

        if (requiresChatroomData && !stateModule.currentChatroomDetails) {
             _logAndDisplayError("Cannot show chatroom-specific section: No active chatroom or details failed to load.", "showSection");

             uiSettingsModule.showSection('chat-room-directory-page');
             return;
        }


        sectionElement.classList.add('active');
        stateModule.activeSettingPage = sectionId;

        if (sectionId !== 'settings-main-page') {
            if (stateModule.pageStack[stateModule.pageStack.length - 1] !== sectionId) {
                stateModule.pageStack.push(sectionId);
            }
        } else {
            stateModule.pageStack = ['settings-main-page'];
        }


        if (sectionId === 'role-list-page') {
            uiSettingsModule.updateChatroomRolePage();
        } else if (sectionId === 'story-mode-page') {
            uiSettingsModule.updateChatroomNovelPage();
        } else if (sectionId === 'chat-room-directory-page') {
            uiSettingsModule.updateChatroomList();
        } else if (sectionId === 'current-chatroom-settings-page') {
            uiSettingsModule.updateWorldInfoDisplay();
            if (typeof uiChatModule !== 'undefined') {
                uiChatModule.updateChatroomHistoryDisplay();
            }
            uiSettingsModule.loadRoleplayRulesSetting();
            uiSettingsModule.loadPublicInfoSetting();
        } else if (sectionId === 'general-config-page') {
            uiSettingsModule.loadOriginalNovelLengthSetting();
            uiSettingsModule.loadChatroomModelSetting();
            uiSettingsModule.loadSettingValue('responseSchemaJson');
            uiSettingsModule.loadSettingValue('responseSchemaParserJs');
            uiSettingsModule.loadSettingValue('sharedDatabaseInstruction');
            uiSettingsModule.loadChatroomMainPromptSetting();
        } else if (sectionId.endsWith('-master-page') && !sectionId.startsWith('chatroom-override-')) {
            const toolName = sectionId.replace('-page', '');
            const camelCaseToolName = toolName.replace(/-(\w)/g, (match, p1) => p1.toUpperCase());
            uiSettingsModule.loadGodSettings(camelCaseToolName);
        } else if (sectionId === 'novelai-settings-page') {
            uiSettingsModule.loadNovelAiSettings();
            uiSettingsModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
        } else if (sectionId === 'api-settings-page') {
            uiSettingsModule.loadApiKeysSetting();
            uiSettingsModule.updateApiKeyFailureCountsDisplay();
        } else if (sectionId === 'prompt-preset-page') {
            uiSettingsModule.loadPromptPresetSettings();
            uiSettingsModule.renderPromptPresetsList();
        } else if (sectionId === 'chatroom-override-general-page') {
            uiSettingsModule.loadChatroomOverrideGeneralSettings();
        } else if (sectionId.startsWith('chatroom-override-') && sectionId.endsWith('-page')) {
            const match = sectionId.match(/^chatroom-override-(.+)-page$/);
            if (match && match[1]) {
                const toolName = match[1];
                uiSettingsModule.loadChatroomOverrideToolSettings(toolName);
            }
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
        uiSettingsModule.updateApiKeyFailureCountsDisplay();
    },

    updateApiKeyFailureCountsDisplay: () => {
        const displayElement = elementsModule.apiKeyFailureCountsDisplay;
        if (!displayElement) return;

        const failures = apiKeyManager.getApiKeyFailureCounts();
        const currentKeys = apiKeyManager.getApiKeys();
        displayElement.innerHTML = '';

        if (currentKeys.length === 0) {
            displayElement.innerHTML = '<div>No API Keys</div>';
            return;
        }

        currentKeys.forEach(key => {
            const count = failures[key] || 0;
            const keyDiv = document.createElement('div');
            const keyPrefixSpan = document.createElement('span');
            keyPrefixSpan.className = 'key-prefix';
            const displayKey = key.length > 10 ? `...${key.slice(-10)}:` : `${key}:`;
            keyPrefixSpan.textContent = displayKey;
            const countSpan = document.createElement('span');
            countSpan.className = 'fail-count';
            countSpan.textContent = `${count} fails`;

            keyDiv.appendChild(keyPrefixSpan);
            keyDiv.appendChild(countSpan);
            displayElement.appendChild(keyDiv);
        });
    },

    loadSettingValue: (settingKey) => {
        let elementIdSuffix = 'Settings';
        const element = elementsModule[`${settingKey}${elementIdSuffix}`];

        if (element) {
            if (settingKey === 'originalNovelLength') {
                 element.value = stateModule.config.originalNovelLength || defaultConfig.originalNovelLength;
             } else if (['responseSchemaJson', 'responseSchemaParserJs', 'sharedDatabaseInstruction', 'mainPrompt'].includes(settingKey)) {
                 element.value = stateModule.config[settingKey] || '';
             } else if (settingKey === 'novelaiApiKey') {
                 element.value = apiKeyManager.getNaiApiKey();
             } else if (stateModule.config.hasOwnProperty(settingKey)) {
                  element.value = stateModule.config[settingKey] || '';
             }
        }
    },

    _createChatroomRoleListItem: (roleName, roleState, isTemporary) => {
        const roleItem = document.createElement('div');
        roleItem.className = 'role-item';
        roleItem.dataset.roleName = roleName;

        const isPermanent = !isTemporary && roleName !== "管理员";
        if (isPermanent) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'role-visibility-checkbox';
            checkbox.dataset.roleName = roleName;
            const chatroomDetails = stateModule.currentChatroomDetails;
            checkbox.checked = chatroomDetails?.config?.roleVisibility?.[roleName] ?? true;
            roleItem.appendChild(checkbox);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = roleName + (isTemporary ? " (临时)" : "");
        nameSpan.style.marginLeft = isPermanent ? '8px' : '0';
        nameSpan.addEventListener('click', () => {
            uiSettingsModule.showRoleDetailPage(roleName);
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        if (!isTemporary && roleName !== '管理员') {
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
        }

        roleItem.appendChild(nameSpan);
        roleItem.appendChild(actionsDiv);

        return roleItem;
    },

    updateChatroomRolePage: () => {
        const container = elementsModule.roleListContainer;
        const chatroomDetails = stateModule.currentChatroomDetails;

        if (!container) return;
        if (!chatroomDetails || !chatroomDetails.config) {
            container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室。</p>';
            return;
        }
        container.innerHTML = '';

        const addRoleButton = document.createElement('div');
        addRoleButton.id = 'add-chatroom-role-button';
        addRoleButton.className = 'settings-menu-item';
        addRoleButton.textContent = '十 添加角色';
        addRoleButton.addEventListener('click', () => uiSettingsModule.addChatroomRole());
        container.appendChild(addRoleButton);

        const roleStates = chatroomDetails.config.roleStates || {};
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

        if(sortedRoleNames.length === 0){
             const noRolesMsg = document.createElement('p');
             noRolesMsg.textContent = '暂无角色。';
             noRolesMsg.style.textAlign = 'center';
             container.appendChild(noRolesMsg);
        } else {
            const frag = document.createDocumentFragment();
            sortedRoleNames.forEach(roleName => {
                const isTemporary = !permanentRoles.has(roleName);
                frag.appendChild(uiSettingsModule._createChatroomRoleListItem(roleName, roleStates[roleName], isTemporary));
            });
            container.appendChild(frag);
        }
    },

    showRoleDetailPage: (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config || !chatroomDetails.config.roleStates || !(roleName in chatroomDetails.config.roleStates)) {
             _logAndDisplayError(`无法显示角色详情：未找到角色 "${roleName}" 或聊天室数据。`, 'showRoleDetailPage');
             uiSettingsModule.showSection('role-list-page');
             return;
        }

        stateModule.currentRole = roleName;
        const roleData = chatroomDetails.roles.find(r => r.name === roleName);
        const isTemporary = !roleData;

        elementsModule.roleDetailHeaderTitle.textContent = `角色详情 - ${roleName}` + (isTemporary ? " (临时)" : "");
        uiSettingsModule.loadRoleSettings(roleName, roleData, isTemporary);
        uiSettingsModule.showSection('role-detail-page');
    },

    loadRoleSettings: (roleName, roleData, isTemporary) => {
        elementsModule.roleInstructionTextarea.value = roleData?.setting || (isTemporary ? '[临时角色无设定]' : '');
        elementsModule.roleMemoryTextarea.value = roleData?.memory || (isTemporary ? '[临时角色无记忆]' : '');
        elementsModule.roleDrawingTemplateSettings.value = roleData?.drawingTemplate || (isTemporary ? '[临时角色无模板]' : '');

        const detailedState = stateModule.currentChatroomDetails?.config?.roleDetailedStates?.[roleName] || '';
        elementsModule.roleStateTextarea.value = detailedState;
        elementsModule.roleStateTextarea.readOnly = true;

        const isReadOnly = isTemporary || roleName === "管理员";
        [elementsModule.roleInstructionTextarea, elementsModule.roleMemoryTextarea, elementsModule.roleDrawingTemplateSettings].forEach(el => {
            el.readOnly = isReadOnly;
            el.style.cursor = isReadOnly ? 'not-allowed' : 'auto';
            el.style.opacity = isReadOnly ? 0.7 : 1;
        });

        if (elementsModule.exportRoleButton) elementsModule.exportRoleButton.style.display = isReadOnly ? 'none' : 'block';
        if (elementsModule.importRoleButton) elementsModule.importRoleButton.style.display = 'block';
    },

    saveRoleSettings: async () => {
        const roleName = stateModule.currentRole;
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !roleName) return;

        const roleData = chatroomDetails.roles.find(r => r.name === roleName);
        const isTemporary = !roleData;

        if (isTemporary || roleName === "管理员") return;

        const updatedRoleData = {
            name: roleName,
            setting: elementsModule.roleInstructionTextarea.value,
            memory: elementsModule.roleMemoryTextarea.value,
            drawingTemplate: elementsModule.roleDrawingTemplateSettings.value,
        };

        const success = await apiModule.updateRole(chatroomDetails.config.name, roleName, updatedRoleData);
        if (success) {

            const roleIndex = chatroomDetails.roles.findIndex(r => r.name === roleName);
            if (roleIndex > -1) {
                 Object.assign(chatroomDetails.roles[roleIndex], updatedRoleData);
            } else {
                 await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
            }
            updateChatContextCache();
        } else {
            _logAndDisplayError(`Failed to save settings for role ${roleName}`, 'saveRoleSettings');
            alert(`保存角色 ${roleName} 设置失败`);

             await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
             uiSettingsModule.loadRoleSettings(roleName, chatroomDetails.roles.find(r => r.name === roleName), false);
        }
    },

    deleteChatroomRole: async (roleName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || roleName === "管理员") return;

        const isPermanent = chatroomDetails.roles.some(r => r.name === roleName);
        let proceedToDelete = false;

        if (isPermanent) {

            proceedToDelete = true;
        } else {

            return;
        }

        if (proceedToDelete) {
            let success = false;
            if (isPermanent) {
                success = await apiModule.deleteRole(chatroomDetails.config.name, roleName);
            } else {

                delete chatroomDetails.config.roleStates[roleName];
                if (chatroomDetails.config.roleDetailedStates) {
                    delete chatroomDetails.config.roleDetailedStates[roleName];
                }
                success = await apiModule.updateChatroomConfig(chatroomDetails.config.name, {
                    roleStates: chatroomDetails.config.roleStates,
                    roleDetailedStates: chatroomDetails.config.roleDetailedStates || {}
                });
            }

            if (success) {
                await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
                uiSettingsModule.updateChatroomRolePage();
                if (typeof uiChatModule !== 'undefined' && uiChatModule.updateRoleButtonsList) {
                    uiChatModule.updateRoleButtonsList();
                }
                if (stateModule.currentRole === roleName) {
                    stateModule.currentRole = null;
                    uiSettingsModule.closeCurrentSection('role-detail-page');
                }
                updateChatContextCache();
                stateModule.currentChatHistoryData = stateModule.currentChatHistoryData.filter(msg => msg.roleName !== roleName);
                if (stateModule.config.activeChatRoomName) {
                    uiChatModule.saveChatHistoryToServer();
                }
            } else {
                _logAndDisplayError(`Failed to delete role ${roleName}`, 'deleteChatroomRole');
                alert(`删除角色 ${roleName} 失败`);
            }
        }
    },


    renameChatroomRole: async (oldName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) return;
        const roleData = chatroomDetails.roles.find(r => r.name === oldName);
        const isTemporary = !roleData;

        if (isTemporary || oldName === "管理员") return;

        const newName = prompt(`输入角色 "${oldName}" 的新名称:`, oldName);
        if (!newName || newName.trim() === "" || newName === oldName) {
            return;
        }
        const trimmedNewName = newName.trim();
        const nameExists = Object.keys(chatroomDetails.config.roleStates || {}).includes(trimmedNewName);

        if (nameExists) {
            _logAndDisplayError(`名称 "${trimmedNewName}" 已在此聊天室存在。`, 'renameChatroomRole');
            return;
        }

        const updatedRoleData = { ...roleData, name: trimmedNewName };
        const success = await apiModule.updateRole(chatroomDetails.config.name, oldName, updatedRoleData);

        if (success) {

            await apiModule.fetchChatroomDetails(chatroomDetails.config.name);

            stateModule.currentChatHistoryData.forEach(msg => {
                if (msg.roleName === oldName) msg.roleName = trimmedNewName;
                if (msg.targetRoleName === oldName) msg.targetRoleName = trimmedNewName;
            });
            if (stateModule.config.activeChatRoomName) {
                 uiChatModule.saveChatHistoryToServer();
            }

            if (stateModule.currentRole === oldName) {
                stateModule.currentRole = trimmedNewName;
                if (document.getElementById('role-detail-page').classList.contains('active')) {
                    elementsModule.roleDetailHeaderTitle.textContent = `角色详情 - ${trimmedNewName}`;
                    uiSettingsModule.loadRoleSettings(trimmedNewName, updatedRoleData, false);
                }
            }

            uiSettingsModule.updateChatroomRolePage();
            if (typeof uiChatModule !== 'undefined') {
                 uiChatModule.updateRoleButtonsList();
                 if (stateModule.config.activeChatRoomName === chatroomDetails.config.name) {
                 }
            }
            updateChatContextCache();
        } else {
             _logAndDisplayError(`Failed to rename role ${oldName} to ${trimmedNewName}`, 'renameChatroomRole');
             alert(`重命名角色失败`);
        }
    },

    addChatroomRole: async () => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) return;

        const newRoleName = prompt("请输入新角色名称:");
        if (newRoleName && newRoleName.trim() !== "") {
            const trimmedName = newRoleName.trim();
            const nameExists = Object.keys(chatroomDetails.config.roleStates || {}).includes(trimmedName);
            if(nameExists) {
                 _logAndDisplayError(`角色名称 "${trimmedName}" 已存在于当前聊天室。`, 'addChatroomRole');
                 return;
            }

            const newRoleData = {
                name: trimmedName,
                setting: "",
                memory: "",
                drawingTemplate: ""
            };

            const success = await apiModule.createRole(chatroomDetails.config.name, newRoleData);
            if (success) {

                 await apiModule.fetchChatroomDetails(chatroomDetails.config.name);
                 uiSettingsModule.updateChatroomRolePage();
                 if (typeof uiChatModule !== 'undefined') {
                     uiChatModule.updateRoleButtonsList();
                 }
                 updateChatContextCache();
            } else {

                 alert(`添加角色失败`);
            }
        } else if (newRoleName) {
            _logAndDisplayError(`角色名称 "${newRoleName}" 无效。`, 'addChatroomRole');
        }
    },

    updateWorldInfoDisplay: () => {
        const worldInfo = stateModule.chatContextCache?.worldInfo || "[世界信息未获取]";
        if (elementsModule.worldInfoDisplay) {
            elementsModule.worldInfoDisplay.value = worldInfo;
            elementsModule.worldInfoDisplay.scrollTop = 0;
        }
    },

    loadOriginalNovelLengthSetting: () => {
        if (elementsModule.originalNovelLengthSettings) {
            elementsModule.originalNovelLengthSettings.value = stateModule.config.originalNovelLength || defaultConfig.originalNovelLength;
        }
    },

    saveOriginalNovelLengthSetting: () => {
        if (elementsModule.originalNovelLengthSettings) {
             const value = parseInt(elementsModule.originalNovelLengthSettings.value);
             if (!isNaN(value) && value > 0) {
                 stateModule.config.originalNovelLength = value;
                 if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                    mainModule.triggerDebouncedSave();
                 }
             } else {
                 stateModule.config.originalNovelLength = defaultConfig.originalNovelLength;
                 elementsModule.originalNovelLengthSettings.value = stateModule.config.originalNovelLength;
                 _logAndDisplayError("Please enter a valid positive integer for character count. Reset to default.", "saveOriginalNovelLengthSetting");
             }
        }
    },

    loadNovelAiSettings: () => {
        const keys = [
            "novelaiModel", "novelaiArtistChain",
            "novelaiDefaultPositivePrompt", "novelaiDefaultNegativePrompt",
            "novelaiWidth", "novelaiHeight", "novelaiSteps", "novelaiScale",
            "novelaiCfgRescale", "novelaiSampler", "novelaiNoiseSchedule", "novelaiSeed"
        ];
        if (elementsModule.novelaiApiKeySettings) {
            elementsModule.novelaiApiKeySettings.value = apiKeyManager.getNaiApiKey();
        }
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

    _createChatroomListItem: (roomName) => {
        const item = document.createElement('div');
        item.className = 'chatroom-item';
        item.dataset.roomName = roomName;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'activeChatroom';
        radio.value = roomName;
        radio.id = `chatroom-${roomName}`;
        if (roomName === stateModule.config.activeChatRoomName) radio.checked = true;
        radio.addEventListener('change', () => {
            if (radio.checked) {
                uiSettingsModule.switchActiveChatroom(roomName);
            }
        });

        const label = document.createElement('label');
        label.textContent = roomName;
        label.setAttribute('for', `chatroom-${roomName}`);
         label.addEventListener('click', (e) => {
             if (!radio.checked) {
                  radio.checked = true;
                  uiSettingsModule.switchActiveChatroom(roomName);
             }
             uiSettingsModule.showChatroomDetailPage(roomName);
         });

        item.appendChild(radio);
        item.appendChild(label);

        return item;
    },

    updateChatroomList: () => {
        const frag = document.createDocumentFragment();
        const rooms = stateModule.config.chatRoomOrder || [];
        rooms.forEach(roomName => {
            frag.appendChild(uiSettingsModule._createChatroomListItem(roomName));
        });
        elementsModule.chatroomListContainer.innerHTML = '';
        elementsModule.chatroomListContainer.appendChild(frag);
    },

    switchActiveChatroom: async (name) => {
        if (stateModule.config.activeChatRoomName === name && stateModule.currentChatroomDetails) {
            return;
        }

        if (typeof uiChatModule !== 'undefined' && uiChatModule.saveChatHistoryToServer) {
             if(stateModule.config.activeChatRoomName) {
                 await uiChatModule.saveChatHistoryToServer();
             }
        }

        stateModule.config.activeChatRoomName = name;
        stateModule.currentChatroomDetails = null;
        if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();


        if (elementsModule.chatArea) elementsModule.chatArea.innerHTML = '<p style="text-align: center;">Loading...</p>';
        if (elementsModule.roleButtonsListContainer) elementsModule.roleButtonsListContainer.innerHTML = '';
        if (elementsModule.chatContainer) elementsModule.chatContainer.style.backgroundImage = '';


        await apiModule.fetchChatroomDetails(name);


        if (stateModule.currentChatroomDetails) {
            if (typeof uiChatModule !== 'undefined') {
                uiChatModule.loadChatHistory(name);
                uiChatModule.updateRoleButtonsList();
                uiChatModule.updateChatroomHistoryDisplay();
            }
            const radio = document.getElementById(`chatroom-${name}`);
            if (radio && !radio.checked) radio.checked = true;

            if (document.getElementById('general-config-page').classList.contains('active')) {
                uiSettingsModule.loadChatroomModelSetting();
                uiSettingsModule.loadSettingValue('responseSchemaJson');
                uiSettingsModule.loadSettingValue('responseSchemaParserJs');
                uiSettingsModule.loadSettingValue('sharedDatabaseInstruction');
                uiSettingsModule.loadChatroomMainPromptSetting();
            }
            if (document.getElementById('role-list-page').classList.contains('active')) {
                uiSettingsModule.updateChatroomRolePage();
            }
            if (document.getElementById('story-mode-page').classList.contains('active')) {
                uiSettingsModule.updateChatroomNovelPage();
            }
            if (document.getElementById('current-chatroom-settings-page').classList.contains('active')) {
                 uiSettingsModule.loadRoleplayRulesSetting();
                 uiSettingsModule.loadPublicInfoSetting();
            }

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

             const backgroundFilename = stateModule.currentChatroomDetails.config.backgroundImageFilename;
             if (backgroundFilename && elementsModule.chatContainer) {
                 const bgUrl = `/chatrooms/${encodeURIComponent(name)}/${encodeURIComponent(backgroundFilename)}?t=${Date.now()}`;
                 elementsModule.chatContainer.style.backgroundImage = `url('${bgUrl}')`;
             }

        } else {

             if (typeof uiChatModule !== 'undefined') {
                 uiChatModule.clearChatArea();
                 uiChatModule.updateRoleButtonsList();
             }

        }
    },

    showChatroomDetailPage: async (name) => {
         if (!stateModule.currentChatroomDetails || stateModule.currentChatroomDetails.config.name !== name) {
             await apiModule.fetchChatroomDetails(name);
         }

         if (!stateModule.currentChatroomDetails) {
             uiSettingsModule.showSection('chat-room-directory-page');
             _logAndDisplayError(`Chatroom "${name}" details could not be loaded.`, 'showChatroomDetailPage');
             return;
         }
        stateModule.currentChatRoom = name;
        elementsModule.chatroomDetailHeaderTitle.textContent = `聊天室详情 - ${name}`;

        uiSettingsModule.showSection('chat-room-detail-page');
    },

    addChatroom: async () => {
        const name = prompt("请输入新聊天室名称:");
        if (!name || name.trim() === "") return;
        const trimmedName = name.trim();

        const newName = await apiModule.addChatroom(trimmedName);
        if (newName) {
            uiSettingsModule.updateChatroomList();
            uiSettingsModule.switchActiveChatroom(newName);

        } else {
             alert(`Failed to create chatroom '${trimmedName}'. Check console for errors.`);
        }
    },


    handleRenameChatroom: async () => {
        const oldName = stateModule.currentChatRoom;
        if (!oldName) return;
        const newName = prompt(`输入聊天室 "${oldName}" 的新名称:`, oldName);
        if (!newName || newName.trim() === "" || newName === oldName) return;
        const trimmedNewName = newName.trim();

        const success = await apiModule.renameChatroom(oldName, trimmedNewName);
        if (success) {
             uiSettingsModule.updateChatroomList();

             if (stateModule.config.activeChatRoomName === trimmedNewName) {
                await uiSettingsModule.switchActiveChatroom(trimmedNewName);
             }
              if (document.getElementById('chat-room-detail-page')?.classList.contains('active')) {
                   elementsModule.chatroomDetailHeaderTitle.textContent = `聊天室详情 - ${trimmedNewName}`;
              }

        } else {
             alert(`Failed to rename chatroom. Check console for errors.`);
        }
    },

    handleDeleteChatroom: async () => {
         const nameToDelete = stateModule.currentChatRoom;
         if (!nameToDelete) return;

         const success = await apiModule.deleteChatroom(nameToDelete);
         if (success) {
              uiSettingsModule.updateChatroomList();
              if (stateModule.config.activeChatRoomName === null) {

                 if (typeof uiChatModule !== 'undefined') {
                     uiChatModule.clearChatArea();
                     uiChatModule.updateRoleButtonsList();
                 }
                 stateModule.currentChatroomDetails = null;
                 updateChatContextCache();
                 if (elementsModule.chatContainer) elementsModule.chatContainer.style.backgroundImage = '';
              } else {
                 await uiSettingsModule.switchActiveChatroom(stateModule.config.activeChatRoomName);
              }
              uiSettingsModule.closeCurrentSection('chat-room-detail-page');

         } else {
              alert(`Failed to delete chatroom '${nameToDelete}'. Check console.`);
         }

    },

    clearCurrentChatroomHistory: async () => {
        const activeChatroomName = stateModule.config.activeChatRoomName;
        if (!activeChatroomName || !stateModule.currentChatroomDetails) {
             return;
        }

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

         let rolesUpdated = false;
         const currentStates = stateModule.currentChatroomDetails.config.roleStates || {};
         const permanentRoles = new Set(stateModule.currentChatroomDetails.roles.map(r => r.name));
         const newStates = {};
         const newDetailedStates = { ...(stateModule.currentChatroomDetails.config.roleDetailedStates || {}) };

         for (const roleName in currentStates) {
             if (roleName === "管理员" || permanentRoles.has(roleName)) {
                 newStates[roleName] = currentStates[roleName];
             } else {
                  rolesUpdated = true;
                  delete newDetailedStates[roleName];
             }
         }

         let detailedStatesCleared = false;
         for (const roleName in newStates) {
             if (roleName !== "管理员" && permanentRoles.has(roleName)) {
                 if (newDetailedStates[roleName] !== undefined && newDetailedStates[roleName] !== "") {
                     newDetailedStates[roleName] = "";
                     detailedStatesCleared = true;
                 }
             }
         }

         if (rolesUpdated || detailedStatesCleared ) {
              const updateSuccess = await apiModule.updateChatroomConfig(activeChatroomName, { roleStates: newStates, roleDetailedStates: newDetailedStates });
              if (updateSuccess) {
                 stateModule.currentChatroomDetails.config.roleStates = newStates;
                 stateModule.currentChatroomDetails.config.roleDetailedStates = newDetailedStates;
                 if (typeof uiChatModule !== 'undefined') uiChatModule.updateRoleButtonsList();
                 uiSettingsModule.updateChatroomRolePage();
                 if (stateModule.currentRole && permanentRoles.has(stateModule.currentRole) && stateModule.currentRole !== "管理员") {
                    if (document.getElementById('role-detail-page')?.classList.contains('active')) {
                         uiSettingsModule.loadRoleSettings(stateModule.currentRole, stateModule.currentChatroomDetails.roles.find(r=>r.name===stateModule.currentRole), false);
                    }
                 }
              } else {
                  _logAndDisplayError("Failed to save updated role states after clearing history.", 'clearCurrentChatroomHistory');
              }
         }

         if (typeof uiChatModule !== 'undefined') {
             uiChatModule.updateChatroomHistoryDisplay();
         }
          await updateChatContextCache();
          uiSettingsModule.updateWorldInfoDisplay();
    },

    loadGodSettings: (godName) => {
        const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'enabled', 'model', 'mainPrompt'];
        const toolConfig = stateModule.config.toolSettings[godName];

        settings.forEach(type => {
            const camelCaseType = type.charAt(0).toUpperCase() + type.slice(1);
            let elementIdSuffix = 'Settings';
            let elId;
            if (type === 'toolDatabaseInstruction') {
                 elementIdSuffix = 'ToolDatabaseInstructionSettings';
                 elId = `${godName}${elementIdSuffix}`;
            } else if (type === 'model') {
                 elementIdSuffix = 'ModelSettings';
                 elId = `${godName}${elementIdSuffix}`;
            } else {
                 elementIdSuffix = `${camelCaseType}Settings`;
                 elId = `${godName}${elementIdSuffix}`;
            }
            const el = elementsModule[elId];

            if (el) {
                const val = toolConfig ? toolConfig[type] : undefined;
                if (el.type === 'checkbox') {
                    el.checked = val ?? false;
                } else if (el.tagName === 'SELECT') {
                    el.value = val || '';
                    if (!val && el.options.length > 0 && el.options[0].disabled) {

                    } else if (val && !el.querySelector(`option[value="${val}"]`)) {
                         const tempOption = new Option(`${val} (Saved)`, val, true, true);
                         el.add(tempOption, 0);
                    }
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
        const settings = ['responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'enabled', 'model', 'mainPrompt'];
        settings.forEach(type => {
            const camelCaseType = type.charAt(0).toUpperCase() + type.slice(1);
             let elementIdSuffix = 'Settings';
             if (type === 'toolDatabaseInstruction') {
                  elementIdSuffix = 'ToolDatabaseInstructionSettings';
             } else if (type === 'model') {
                  elementIdSuffix = 'ModelSettings';
             } else {
                  elementIdSuffix = `${camelCaseType}Settings`;
             }
            const elId = `${godName}${elementIdSuffix}`;
            const el = elementsModule[elId];
            if (el) {
                stateModule.config.toolSettings[godName][type] = (el.type === 'checkbox') ? el.checked : el.value;
            }
        });
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    displayErrorLog: (errorMessages) => {
         if (Array.isArray(errorMessages)) {

         } else if (elementsModule.errorLogDisplay) {

         }
    },

    clearErrorLogDisplay: () => {

        if (elementsModule.errorLogDisplay) {

        }

    },

    copyErrorLog: () => {

    },

    clearAllConfiguration: async () => {

         try {
             const response = await fetch('/clear-all-config', { method: 'POST' });
             const result = await response.json();
             if (!response.ok) {
                 throw new Error(result.error || `HTTP error! status: ${response.status}`);
             }


             location.reload();
         } catch (error) {
             _logAndDisplayError(`清除全部配置失败: ${error.message}`, 'clearAllConfiguration');
             alert(`清除全部配置失败: ${error.message}`);
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

              initializationModule.initializeConfig();

         } catch (error) {
              _logAndDisplayError(`导入配置失败: ${error.message}`, 'handleImportConfig');
              alert(`导入配置失败: ${error.message}`);
         } finally {
             event.target.value = null;
         }
    },

    addChatroomNovel: async () => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
            _logAndDisplayError("请先选择一个聊天室。", 'addChatroomNovel');
            return;
        }
        const roomName = chatroomDetails.config.name;

        const name = prompt("请输入新小说名称:");
        if (!name || name.trim() === "") return;
        const trimmedName = name.trim();

        const nameExists = chatroomDetails.novels.some(n => n.name === trimmedName);
        if (nameExists) {
            _logAndDisplayError(`小说名称 "${trimmedName}" 在当前聊天室已存在。`, 'addChatroomNovel');
            return;
        }

        const text = prompt(`请在此粘贴小说《${trimmedName}》的内容:`);
        if (text === null) return;
        if (!text) { _logAndDisplayError("小说内容不能为空。", 'addChatroomNovel'); return; }

        try {
            const processResponse = await fetch('/process-novel-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text })
            });
             if (!processResponse.ok) {
                 const errorData = await processResponse.json().catch(() => ({ error: `HTTP error! status: ${processResponse.status}` }));
                 throw new Error(errorData.error || `HTTP error! status: ${processResponse.status}`);
             }
            const processedData = await processResponse.json();

            const newNovel = {
                id: `novel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                name: trimmedName,
                segments: processedData.segments,
                toc: processedData.toc
            };

             const createSuccess = await apiModule.createNovel(roomName, newNovel);
             if (createSuccess) {
                  await apiModule.fetchChatroomDetails(roomName);
                  uiSettingsModule.updateChatroomNovelPage();
                  if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                      uiSettingsModule.novelUI_updateBookshelfPage();
                  }

             } else {
                  alert(`添加小说文件失败，请检查控制台。`);
             }
        } catch (error) {
             _logAndDisplayError(`添加小说失败: ${error.message}`, 'addChatroomNovel');

        }
    },

    renameChatroomNovel: async (novelId, currentName) => {
         const chatroomDetails = stateModule.currentChatroomDetails;
         if (!chatroomDetails) return;
         const roomName = chatroomDetails.config.name;

         const novelIndex = chatroomDetails.novels.findIndex(n => n.id === novelId);
         if (novelIndex === -1) {
             _logAndDisplayError(`无法找到要重命名的小说，ID: ${novelId}`, 'renameChatroomNovel');
             return;
         }
         const novelData = chatroomDetails.novels[novelIndex];

         const newName = prompt(`输入小说 "${currentName}" 的新名称:`, currentName);
         if (!newName || newName.trim() === "" || newName === currentName) return;
         const trimmedNewName = newName.trim();

         const nameExists = chatroomDetails.novels.some(n => n.name === trimmedNewName && n.id !== novelId);
         if (nameExists) {
             _logAndDisplayError(`小说名称 "${trimmedNewName}" 在当前聊天室已存在。`, 'renameChatroomNovel');
             return;
         }

         const updatedNovelData = { ...novelData, name: trimmedNewName };
         const success = await apiModule.updateNovel(roomName, novelId, updatedNovelData);

         if (success) {
             await apiModule.fetchChatroomDetails(roomName);
             uiSettingsModule.updateChatroomNovelPage();
             if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                 uiSettingsModule.novelUI_updateBookshelfPage();
             }

         } else {
              alert(`重命名小说失败，请检查控制台。`);
         }
     },

    deleteChatroomNovel: async (novelId, novelName) => {
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) return;
        const roomName = chatroomDetails.config.name;

        const novelIndex = chatroomDetails.novels.findIndex(n => n.id === novelId);
        if (novelIndex === -1) {
             _logAndDisplayError(`未在当前聊天室找到小说 "${novelName}"，无法删除。`, "deleteChatroomNovel");
             return;
        }


         const success = await apiModule.deleteNovel(roomName, novelId);
         if (success) {

              await apiModule.fetchChatroomDetails(roomName);

              if (stateModule.currentNovelId === novelId) {
                  stateModule.currentNovelId = null;
                  stateModule.config.lastViewedNovelId = null;
                  if (elementsModule.novelContentDisplay) {
                      elementsModule.novelContentDisplay.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
                      elementsModule.novelContentDisplay.scrollTop = 0;
                      elementsModule.novelContentDisplay.removeAttribute('data-novel-id');
                  }
                  if (typeof mainModule !== 'undefined') mainModule.triggerDebouncedSave();
              }

              uiSettingsModule.updateChatroomNovelPage();
              if (stateModule.isNovelInterfaceVisible && stateModule.activeNovelPage === 'novel-bookshelf-page') {
                  uiSettingsModule.novelUI_updateBookshelfPage();
              }

         } else {
              alert(`删除小说失败，请检查控制台。`);
         }

    },

    _createChatroomNovelListItem: (novel) => {
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

    updateChatroomNovelPage: () => {
        const container = elementsModule.novelListContainer;
        const chatroomDetails = stateModule.currentChatroomDetails;

        if (!container) return;
        if (!chatroomDetails) {
            container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室。</p>';
            return;
        }
        container.innerHTML = '';

        const addNovelButton = document.createElement('div');
        addNovelButton.id = 'add-chatroom-novel-button';
        addNovelButton.className = 'settings-menu-item';
        addNovelButton.textContent = '十 添加小说 (从剪贴板)';
        addNovelButton.addEventListener('click', uiSettingsModule.addChatroomNovel);
        container.appendChild(addNovelButton);

        const novels = chatroomDetails.novels || [];
        const sortedNovels = [...novels].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (sortedNovels.length === 0) {
            const noNovelsMsg = document.createElement('p');
            noNovelsMsg.textContent = '此聊天室暂无小说。';
            noNovelsMsg.style.textAlign = 'center';
            container.appendChild(noNovelsMsg);
        } else {
            const fragment = document.createDocumentFragment();
            sortedNovels.forEach(novel => {
                if(novel && novel.id && novel.name) {
                   fragment.appendChild(uiSettingsModule._createChatroomNovelListItem(novel));
                }
            });
            container.appendChild(fragment);
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
            const currentChatroomDetails = stateModule.currentChatroomDetails;

            if (stateModule.currentNovelId && currentlyDisplayedNovelId === stateModule.currentNovelId) {

            } else if (stateModule.currentNovelId && currentChatroomDetails) {
                 const isAssociated = currentChatroomDetails.novels?.some(n => n.id === stateModule.currentNovelId);
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

        const chatroomDetails = stateModule.currentChatroomDetails;

        if (!chatroomDetails || !chatroomDetails.config) {
            container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室</p>';
            return;
        }
        const currentChatroomName = chatroomDetails.config.name;
        const associatedNovels = chatroomDetails.novels || [];

        if (associatedNovels.length === 0) {
            container.innerHTML = '<p style="text-align: center;">当前聊天室无小说<br>(请在 设置 -> 聊天室设置 -> 聊天室详情 -> 聊天室小说 中添加)</p>';
            return;
        }

        const activeIdsInRoom = new Set(chatroomDetails.config.activeNovelIds || []);
        const fragment = document.createDocumentFragment();

        const sortedNovels = [...associatedNovels]
            .filter(Boolean)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (sortedNovels.length === 0) {
             container.innerHTML = '<p style="text-align: center;">关联的小说似乎已被删除</p>';
             return;
        }

        sortedNovels.forEach(novel => {
             if (!novel || !novel.id || !novel.name || !novel.segments || !novel.toc) return;
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
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails || !chatroomDetails.config) return;

        let activeIds = chatroomDetails.config.activeNovelIds || [];
        const index = activeIds.indexOf(novelId);

        if (isChecked && index === -1) {
            activeIds.push(novelId);
        } else if (!isChecked && index > -1) {
            activeIds.splice(index, 1);
        } else {
             return;
        }

        chatroomDetails.config.activeNovelIds = activeIds;
        apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
        updateChatContextCache();
    },

    novelUI_loadAndDisplayNovelContent: (novelId) => {
        const displayArea = elementsModule.novelContentDisplay;
        if (!displayArea || stateModule.isNovelLoading) return;

        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
             _logAndDisplayError("无法加载小说：未找到激活聊天室数据。", 'novelUI_loadAndDisplayNovelContent');
             return;
        }

        const novelData = chatroomDetails.novels.find(n => n.id === novelId);
        if (!novelData || !novelData.segments || !novelData.toc) {
            displayArea.innerHTML = '<p style="text-align: center; color: red;">无法加载小说数据</p>';
            displayArea.removeAttribute('data-novel-id');
            stateModule.currentNovelId = null;
            stateModule.config.lastViewedNovelId = null;
            _logAndDisplayError(`无法找到小说数据 ID: ${novelId}`, 'novelUI_loadAndDisplayNovelContent');
            return;
        }

        stateModule.isNovelLoading = true;
        displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">正在加载...</p>';

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
            const savedSegmentId = chatroomDetails.config.novelCurrentSegmentIds?.[novelId];
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
                 if (chatroomDetails.config.novelCurrentSegmentIds) {
                      chatroomDetails.config.novelCurrentSegmentIds[novelId] = 0;
                      apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
                 }
                 stateModule.currentTocIndexByNovel[novelId] = 0;

            }
        }, 50);
        stateModule.isNovelLoading = false;

    },

    novelUI_updateTocPage: () => {
        const container = elementsModule.novelTocListContainer;
        const novelId = stateModule.currentNovelId;
        const chatroomDetails = stateModule.currentChatroomDetails;

        if (!container) return;
        if (!chatroomDetails || !novelId) {
            container.innerHTML = '<p style="text-align: center;">请先在书目中选择一本小说</p>';
            return;
        }

        container.innerHTML = '';
        const novelData = chatroomDetails.novels.find(n => n.id === novelId);

        if (!novelData || !novelData.toc || novelData.toc.length === 0) {
             container.innerHTML = '<p style="text-align: center;">未找到章节信息</p>';
             return;
        }

        const currentTocIndex = stateModule.currentTocIndexByNovel[novelId];
        const fragment = document.createDocumentFragment();

        novelData.toc.forEach((tocItem, index) => {
            if (tocItem && tocItem.segmentId !== undefined && tocItem.title !== undefined) {
                const tocElement = document.createElement('div');
                tocElement.className = 'novel-toc-item';
                tocElement.textContent = tocItem.title.replace(/</g, "<").replace(/>/g, ">");
                tocElement.dataset.targetSegmentId = tocItem.segmentId;
                if (index === currentTocIndex) {
                    tocElement.classList.add('current-chapter');
                }
                tocElement.addEventListener('click', uiSettingsModule.novelUI_handleTocJump);
                fragment.appendChild(tocElement);
            }
        });

        container.appendChild(fragment);

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
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (targetSegmentId === undefined || !novelId || !chatroomDetails) return;

        const displayArea = elementsModule.novelContentDisplay;
        let targetElement = displayArea.querySelector(`.novel-chapter-marker[data-segment-id="${targetSegmentId}"]`);
        if (!targetElement) {
             targetElement = displayArea.querySelector(`.novel-segment[data-segment-id="${targetSegmentId}"]`);
        }

        if (targetElement && displayArea) {
             targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
             if (chatroomDetails.config.novelCurrentSegmentIds) {
                  chatroomDetails.config.novelCurrentSegmentIds[novelId] = parseInt(targetSegmentId, 10);
                  apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
             }
             const novelData = chatroomDetails.novels.find(n => n.id === novelId);
             const tocIndex = novelData?.toc.findIndex(item => item.segmentId === parseInt(targetSegmentId, 10));
             if (tocIndex !== undefined && tocIndex !== -1) {
                 stateModule.currentTocIndexByNovel[novelId] = tocIndex;
             }

        }

        uiSettingsModule.novelUI_closeCurrentNovelSection('novel-toc-page');
    },


    novelUI_saveScrollPosition: () => {
         clearTimeout(stateModule.scrollUpdateTimer);
         stateModule.scrollUpdateTimer = setTimeout(() => {
             const currentNovelId = stateModule.currentNovelId;
             const displayArea = elementsModule.novelContentDisplay;
             const chatroomDetails = stateModule.currentChatroomDetails;

             if (currentNovelId && displayArea && chatroomDetails && chatroomDetails.config && chatroomDetails.config.novelCurrentSegmentIds && displayArea.dataset.novelId === currentNovelId && stateModule.isNovelInterfaceVisible && !stateModule.activeNovelPage) {

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

                 if(chatroomDetails.config.novelCurrentSegmentIds[currentNovelId] !== topSegmentId) {
                    chatroomDetails.config.novelCurrentSegmentIds[currentNovelId] = topSegmentId;
                    apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
                 }

                 const novelData = chatroomDetails.novels.find(n => n.id === currentNovelId);
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

    exportRole: () => {
        const roleName = stateModule.currentRole;
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!roleName || !chatroomDetails) {
            _logAndDisplayError("没有当前选定的角色或聊天室可导出。", 'exportRole');
            return;
        }
        const roleData = chatroomDetails.roles.find(r => r.name === roleName);
        const isTemporary = !roleData;

        if (isTemporary || roleName === "管理员") {
            _logAndDisplayError(`无法导出角色 "${roleName}" (临时角色或管理员)。`, 'exportRole');
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
        const chatroomDetails = stateModule.currentChatroomDetails;
        if (!chatroomDetails) {
            _logAndDisplayError("请先选择一个聊天室来导入角色。", 'handleImportRoleFile');
            event.target.value = null;
            return;
        }
        const roomName = chatroomDetails.config.name;

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
            const existingNames = Object.keys(chatroomDetails.config.roleStates || {});

            while (existingNames.includes(finalName)) {
                finalName = prompt(`名称 "${finalName}" 在此聊天室已存在。请输入新的角色名称：`, `${importName}_imported`);
                if (!finalName || finalName.trim() === "") {
                    event.target.value = null;
                    return;
                }
                finalName = finalName.trim();
            }

            const newRole = {
                name: finalName,
                setting: importedRoleData.setting || '',
                memory: importedRoleData.memory || '',
                drawingTemplate: importedRoleData.drawingTemplate || '',
            };

            const success = await apiModule.createRole(roomName, newRole);
            if(success) {
                 await apiModule.fetchChatroomDetails(roomName);
                 uiSettingsModule.updateChatroomRolePage();
                 if (typeof uiChatModule !== 'undefined') {
                     uiChatModule.updateRoleButtonsList();
                 }
                 updateChatContextCache();

            } else {
                 alert(`Failed to import role '${finalName}'.`);
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
         const roomName = stateModule.config.activeChatRoomName;
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

              initializationModule.initializeConfig();
              uiSettingsModule.updateChatroomList();
              if (stateModule.config.activeChatRoomName) {
                  await uiSettingsModule.switchActiveChatroom(stateModule.config.activeChatRoomName);
              }


         } catch (error) {
              _logAndDisplayError(`导入聊天室失败: ${error.message}`, 'handleImportChatroomFile');
              alert(`导入聊天室失败: ${error.message}`);
         } finally {
             event.target.value = null;
         }
    },

    loadRoleplayRulesSetting: () => {
        const textarea = elementsModule.roleplayRulesTextarea;
        if (textarea) {
            const details = stateModule.currentChatroomDetails;
            if (details && details.config) {
                 textarea.value = details.config.roleplayRules || "";
                 textarea.disabled = false;
            } else {
                 textarea.value = "";
                 textarea.disabled = true;
            }
        }
    },

    saveRoleplayRulesSetting: () => {
        const textarea = elementsModule.roleplayRulesTextarea;
        const details = stateModule.currentChatroomDetails;
        if (details && details.config && textarea) {
             const newValue = textarea.value;
             if (details.config.roleplayRules !== newValue) {
                details.config.roleplayRules = newValue;
                apiModule.triggerDebouncedChatroomConfigSave(details.config.name);
                updateChatContextCache();
             }
        }
    },

    loadPublicInfoSetting: () => {
        const textarea = elementsModule.publicInfoTextarea;
        if (textarea) {
             const details = stateModule.currentChatroomDetails;
            if (details && details.config) {
                textarea.value = details.config.publicInfo || "";
                textarea.disabled = false;
            } else {
                textarea.value = "";
                textarea.disabled = true;
            }
        }
    },

    savePublicInfoSetting: () => {
        const textarea = elementsModule.publicInfoTextarea;
        const details = stateModule.currentChatroomDetails;
        if (details && details.config && textarea) {
            const newValue = textarea.value;
            if (details.config.publicInfo !== newValue) {
                details.config.publicInfo = newValue;
                apiModule.triggerDebouncedChatroomConfigSave(details.config.name);
                updateChatContextCache();
            }
        }
    },

    loadPromptPresetSettings: () => {
        if (elementsModule.systemInstructionPresetSettings) {
            elementsModule.systemInstructionPresetSettings.value = stateModule.config.systemInstruction || '';
        }

    },

    savePromptPresetSetting: (key) => {
         let element = null;
         if (key === 'systemInstruction') {
              element = elementsModule.systemInstructionPresetSettings;
         }
         if (element) {
              stateModule.config[key] = element.value;
              if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
              }
         }
    },

    renderPromptPresetsList: () => {
        const container = elementsModule.promptPresetListContainer;
        if (!container) return;
        container.innerHTML = '';
        const turns = stateModule.config.promptPresetTurns || [];

        turns.forEach((turn, index) => {
            const item = document.createElement('div');
            item.className = 'prompt-preset-item';
            item.dataset.index = index;

            const roleLabel = document.createElement('span');
            roleLabel.className = 'preset-role-label';
            roleLabel.textContent = turn.role === 'user' ? 'U' : 'M';

            const textarea = document.createElement('textarea');
            textarea.className = 'preset-instruction-textarea';
            textarea.value = turn.instruction || '';
            textarea.addEventListener('input', () => uiSettingsModule.updatePromptPresetTurn(index, textarea.value));
            textarea.addEventListener('change', () => uiSettingsModule.updatePromptPresetTurn(index, textarea.value));

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            const upButton = document.createElement('div');
            upButton.className = 'std-button preset-move-up';
            upButton.textContent = '↑';
            upButton.disabled = index === 0;
            if (index === 0) upButton.style.opacity = '0.5';
            upButton.addEventListener('click', () => uiSettingsModule.movePromptPresetTurn(index, -1));

            const downButton = document.createElement('div');
            downButton.className = 'std-button preset-move-down';
            downButton.textContent = '↓';
            downButton.disabled = index === turns.length - 1;
            if (index === turns.length - 1) downButton.style.opacity = '0.5';
            downButton.addEventListener('click', () => uiSettingsModule.movePromptPresetTurn(index, 1));

            const deleteButton = document.createElement('div');
            deleteButton.className = 'std-button preset-delete';
            deleteButton.textContent = '✕';
            deleteButton.addEventListener('click', () => uiSettingsModule.deletePromptPresetTurn(index));

            actionsDiv.appendChild(upButton);
            actionsDiv.appendChild(downButton);
            actionsDiv.appendChild(deleteButton);

            item.appendChild(roleLabel);
            item.appendChild(textarea);
            item.appendChild(actionsDiv);
            container.appendChild(item);
        });
    },

    addPromptPresetTurn: (role) => {
        if (!stateModule.config.promptPresetTurns) {
             stateModule.config.promptPresetTurns = [];
        }
        stateModule.config.promptPresetTurns.push({ role: role, instruction: "" });
        uiSettingsModule.renderPromptPresetsList();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    updatePromptPresetTurn: (index, instruction) => {
        if (stateModule.config.promptPresetTurns && stateModule.config.promptPresetTurns[index]) {
             stateModule.config.promptPresetTurns[index].instruction = instruction;
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
             }
        }
    },

    movePromptPresetTurn: (index, direction) => {
        const turns = stateModule.config.promptPresetTurns;
        if (!turns || index < 0 || index >= turns.length) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= turns.length) return;

        const itemToMove = turns.splice(index, 1)[0];
        turns.splice(newIndex, 0, itemToMove);

        uiSettingsModule.renderPromptPresetsList();
        if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
            mainModule.triggerDebouncedSave();
        }
    },

    deletePromptPresetTurn: (index) => {
         if (stateModule.config.promptPresetTurns && stateModule.config.promptPresetTurns[index]) {
             stateModule.config.promptPresetTurns.splice(index, 1);
             uiSettingsModule.renderPromptPresetsList();
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
             }
         }
    },

    handleImportPromptPresets: (event) => {
        const file = event.target.files[0];
        if (file) {
            apiModule.importPromptPresets(file);
        }
        event.target.value = null;
    },

    loadChatroomModelSetting: () => {
         const selectElement = elementsModule.chatroomModelSelectSettings;
         if (selectElement) {
             const savedValue = stateModule.config.model || '';
             selectElement.value = savedValue;
             if (!savedValue && selectElement.options.length > 0 && selectElement.options[0].disabled) {

             } else if (savedValue && !selectElement.querySelector(`option[value="${savedValue}"]`)) {
                  const tempOption = new Option(`${savedValue} (Saved)`, savedValue, true, true);
                  selectElement.add(tempOption, 0);
             }
         }
    },

    saveChatroomModelSetting: () => {
         const selectElement = elementsModule.chatroomModelSelectSettings;
         if (selectElement) {
              const selectedValue = selectElement.value;
              stateModule.config.model = selectedValue;
              if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                  mainModule.triggerDebouncedSave();
              }

              const tempOption = selectElement.querySelector(`option[value="${selectedValue}"]`);
              if (tempOption && tempOption.text.includes('(Saved)')) {
                   tempOption.text = selectedValue;
              }
         }
    },

    saveChatroomCommonSetting: (key) => {
         const element = elementsModule[`${key}Settings`];
         if (element) {
              stateModule.config[key] = element.value;
              if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                 mainModule.triggerDebouncedSave();
              }
         }
    },

    loadChatroomMainPromptSetting: () => {
        const element = elementsModule.chatroomMainPromptSettings;
        if (element) {
             element.value = stateModule.config.mainPrompt || '';
        }
    },

    saveChatroomMainPromptSetting: () => {
         const element = elementsModule.chatroomMainPromptSettings;
         if (element) {
              stateModule.config.mainPrompt = element.value;
              if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                  mainModule.triggerDebouncedSave();
              }
         }
    },

    saveToolModelSetting: (toolName) => {
        const selectElement = elementsModule[`${toolName}ModelSettings`];
        if (selectElement && stateModule.config.toolSettings[toolName]) {
             const selectedValue = selectElement.value;
             stateModule.config.toolSettings[toolName].model = selectedValue;
             if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                  mainModule.triggerDebouncedSave();
             }

             const tempOption = selectElement.querySelector(`option[value="${selectedValue}"]`);
             if (tempOption && tempOption.text.includes('(Saved)')) {
                  tempOption.text = selectedValue;
             }
        }
    },

    saveToolMainPromptSetting: (toolName) => {
         const textareaElement = elementsModule[`${toolName}MainPromptSettings`];
         if (textareaElement && stateModule.config.toolSettings[toolName]) {
              stateModule.config.toolSettings[toolName].mainPrompt = textareaElement.value;
              if (typeof mainModule !== 'undefined' && mainModule.triggerDebouncedSave) {
                  mainModule.triggerDebouncedSave();
              }
         }
    },

    _toggleOverrideSectionInputs: (sectionType, enabled) => {
        const keys = ['ModelSelect', 'ResponseSchemaJson', 'ResponseSchemaParserJs', 'MainPrompt'];
        let dbInstructionKey;
        if(sectionType === 'general') {
            dbInstructionKey = 'SharedDatabaseInstruction';
        } else {
            dbInstructionKey = 'ToolDatabaseInstruction';
        }
        keys.push(dbInstructionKey);

        keys.forEach(keySuffix => {
            const elementId = `chatroomOverride${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}${keySuffix}`;
            const element = elementsModule[elementId];
            if (element) {
                element.disabled = !enabled;
                element.style.opacity = enabled ? 1 : 0.5;
            }
        });
    },

    loadChatroomOverrideGeneralSettings: () => {
        const details = stateModule.currentChatroomDetails;
        if (!details || !details.config || !details.config.overrideSettings || !details.config.overrideSettings.general) {
             return;
        }
        const settings = details.config.overrideSettings.general;
        const enabledCheckbox = elementsModule.chatroomOverrideGeneralEnabled;
        const modelSelect = elementsModule.chatroomOverrideGeneralModelSelect;
        const schemaJson = elementsModule.chatroomOverrideGeneralResponseSchemaJson;
        const schemaParser = elementsModule.chatroomOverrideGeneralResponseSchemaParserJs;
        const sharedDb = elementsModule.chatroomOverrideGeneralSharedDatabaseInstruction;
        const mainPrompt = elementsModule.chatroomOverrideGeneralMainPrompt;

        enabledCheckbox.checked = settings.enabled || false;
        const savedValue = settings.model || '';
        modelSelect.value = savedValue;
         if (!savedValue && modelSelect.options.length > 0 && modelSelect.options[0].disabled) {

         } else if (savedValue && !modelSelect.querySelector(`option[value="${savedValue}"]`)) {
              const tempOption = new Option(`${savedValue} (Saved)`, savedValue, true, true);
              modelSelect.add(tempOption, 0);
         }
        schemaJson.value = settings.responseSchemaJson || '';
        schemaParser.value = settings.responseSchemaParserJs || '';
        sharedDb.value = settings.sharedDatabaseInstruction || '';
        mainPrompt.value = settings.mainPrompt || '';

        uiSettingsModule._toggleOverrideSectionInputs('general', enabledCheckbox.checked);
    },

    loadChatroomOverrideToolSettings: (toolName) => {
        const details = stateModule.currentChatroomDetails;
        if (!details || !details.config || !details.config.overrideSettings || !details.config.overrideSettings[toolName]) {
             return;
        }
        const settings = details.config.overrideSettings[toolName];
        const toolNameCapitalized = toolName.charAt(0).toUpperCase() + toolName.slice(1);

        const enabledCheckbox = elementsModule[`chatroomOverride${toolNameCapitalized}Enabled`];
        const modelSelect = elementsModule[`chatroomOverride${toolNameCapitalized}ModelSelect`];
        const schemaJson = elementsModule[`chatroomOverride${toolNameCapitalized}ResponseSchemaJson`];
        const schemaParser = elementsModule[`chatroomOverride${toolNameCapitalized}ResponseSchemaParserJs`];
        const toolDb = elementsModule[`chatroomOverride${toolNameCapitalized}ToolDatabaseInstruction`];
        const mainPrompt = elementsModule[`chatroomOverride${toolNameCapitalized}MainPrompt`];

        if(enabledCheckbox) enabledCheckbox.checked = settings.enabled || false;
        if(modelSelect) {
             const savedValue = settings.model || '';
             modelSelect.value = savedValue;
             if (!savedValue && modelSelect.options.length > 0 && modelSelect.options[0].disabled) {

             } else if (savedValue && !modelSelect.querySelector(`option[value="${savedValue}"]`)) {
                  const tempOption = new Option(`${savedValue} (Saved)`, savedValue, true, true);
                  modelSelect.add(tempOption, 0);
             }
        }
        if(schemaJson) schemaJson.value = settings.responseSchemaJson || '';
        if(schemaParser) schemaParser.value = settings.responseSchemaParserJs || '';
        if(toolDb) toolDb.value = settings.toolDatabaseInstruction || '';
        if(mainPrompt) mainPrompt.value = settings.mainPrompt || '';

        if(enabledCheckbox) uiSettingsModule._toggleOverrideSectionInputs(toolName, enabledCheckbox.checked);
    },

    saveChatroomOverrideEnabled: (sectionType) => {
        const details = stateModule.currentChatroomDetails;
        if (!details || !details.config || !details.config.overrideSettings || !details.config.overrideSettings[sectionType]) {
             return;
        }
        const enabledCheckbox = elementsModule[`chatroomOverride${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}Enabled`];
        if (!enabledCheckbox) return;

        const isEnabled = enabledCheckbox.checked;
        details.config.overrideSettings[sectionType].enabled = isEnabled;
        uiSettingsModule._toggleOverrideSectionInputs(sectionType, isEnabled);

        apiModule.triggerDebouncedChatroomConfigSave(details.config.name);
    },

    saveChatroomOverrideSetting: (sectionType, key) => {
        const details = stateModule.currentChatroomDetails;
        if (!details || !details.config || !details.config.overrideSettings || !details.config.overrideSettings[sectionType]) {
             return;
        }

        let elementKey = key.charAt(0).toUpperCase() + key.slice(1);
        if(key === 'sharedDatabaseInstruction' && sectionType === 'general') {
             elementKey = 'SharedDatabaseInstruction';
        } else if (key === 'toolDatabaseInstruction' && sectionType !== 'general') {
             elementKey = 'ToolDatabaseInstruction';
        } else if (key === 'model') {
             elementKey = 'ModelSelect';
        } else if (key === 'responseSchemaJson') {
             elementKey = 'ResponseSchemaJson';
        } else if (key === 'responseSchemaParserJs') {
             elementKey = 'ResponseSchemaParserJs';
        } else if (key === 'mainPrompt') {
             elementKey = 'MainPrompt';
        } else {

             return;
        }

        const element = elementsModule[`chatroomOverride${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}${elementKey}`];
        if (element) {
             let value = element.value;
             if (element.tagName === 'SELECT') {
                  value = element.value;

                   const tempOption = element.querySelector(`option[value="${value}"]`);
                   if (tempOption && tempOption.text.includes('(Saved)')) {
                        tempOption.text = value;
                   }
             }

             details.config.overrideSettings[sectionType][key] = value;
             apiModule.triggerDebouncedChatroomConfigSave(details.config.name);
        }
    },
    handleRoleVisibilityChange: (roleName, isVisible) => {
         const chatroomDetails = stateModule.currentChatroomDetails;
         if (!chatroomDetails || !chatroomDetails.config || !chatroomDetails.config.roleVisibility) {
             return;
         }
         chatroomDetails.config.roleVisibility[roleName] = isVisible;
         apiModule.triggerDebouncedChatroomConfigSave(chatroomDetails.config.name);
         if (typeof uiChatModule !== 'undefined') {
             uiChatModule.updateRoleButtonsList();
         }
     },
};