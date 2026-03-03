const settingsChatroomCurrentModule = {
  init: () => {},

  renderCurrentChatroomSettingsPage: (container) => {
    container.innerHTML = '';

    const createPartitionButton = settingsUiHelpersModule.createSettingItem(container, {
      id: 'create-new-partition-button',
      label: '新建聊天室分区',
      type: 'button'
    });
    createPartitionButton.addEventListener('click', () => {
      if (stateModule.isCooldownActive) return;
      const partitionName = prompt("请输入新分区的名称:", "初始");
      if (partitionName && partitionName.trim()) {
        const chatroomName = stateModule.currentChatroomDetails.config.name;
        transactionManagerModule.dispatch('CREATE_PARTITION', {
          chatroomName,
          partitionName: partitionName.trim()
        });
      }
    });

    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (!activePartition) {
      const noPartitionWarning = document.createElement('p');
      noPartitionWarning.textContent = '当前聊天室没有激活的分区。请新建一个分区。';
      noPartitionWarning.style.textAlign = 'center';
      container.appendChild(noPartitionWarning);
      return;
    }

    settingsChatroomCurrentModule._renderRoleAliasesSection(container);

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'roleplay-rules-textarea',
      label: '扮演规则 (当前分区)',
      type: 'textarea',
      rows: 4,
      configPath: `currentChatroomDetails.partitions.${stateModule.activePartitionId}.roleplayRules`
    });

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'script-textarea',
      label: '剧本 (分区)',
      type: 'textarea',
      rows: 6,
      configPath: `currentChatroomDetails.partitions.${stateModule.activePartitionId}.script`
    });

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'public-info-textarea',
      label: '公共信息 (聊天室全局)',
      type: 'textarea',
      rows: 4,
      configPath: 'currentChatroomDetails.config.publicInfo'
    });

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'chatroom-user-setting',
      label: '用户 (聊天室全局)',
      type: 'text',
      configPath: 'currentChatroomDetails.config.user'
    });

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'partition-name-setting',
      label: '当前分区名称',
      type: 'text',
      configPath: `currentChatroomDetails.partitions.${stateModule.activePartitionId}.name`
    });

    const exportPartitionButton = settingsUiHelpersModule.createSettingItem(container, {
      id: 'export-partition-button',
      label: '导出分区 (HTML)',
      type: 'button',
      style: { marginTop: '20px', backgroundColor: '#2c3e50', borderColor: '#34495e' }
    });
    exportPartitionButton.addEventListener('click', () => {
      if (stateModule.isCooldownActive) return;
      settingsChatroomCurrentModule._exportPartitionAsHtml();
    });

    settingsChatroomCurrentModule.loadCurrentChatroomSettings();
  },

  loadCurrentChatroomSettings: () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config) return;

    const partitionId = stateModule.activePartitionId;
    if (!partitionId) return;

    const activePartition = chatroomDetails.partitions.get(partitionId);

    const roleplayRulesTextarea = document.getElementById('roleplay-rules-textarea');
    if (roleplayRulesTextarea) settingsUiHelpersModule.loadDynamicSetting(roleplayRulesTextarea, `currentChatroomDetails.partitions.${partitionId}.roleplayRules`);

    const roleAliases = settingsUiHelpersModule._getNestedState(`currentChatroomDetails.partitions.${partitionId}.roleAliases`) || [];
    settingsUiHelpersModule.renderTagList(document.getElementById('partition-role-aliases-container'), roleAliases, 'roleAliases', `currentChatroomDetails.partitions.${partitionId}.roleAliases`);

    const scriptTextarea = document.getElementById('script-textarea');
    if (scriptTextarea) {
      settingsUiHelpersModule.loadDynamicSetting(scriptTextarea, `currentChatroomDetails.partitions.${stateModule.activePartitionId}.script`);
    }

    const publicInfoTextarea = document.getElementById('public-info-textarea');
    if (publicInfoTextarea) settingsUiHelpersModule.loadDynamicSetting(publicInfoTextarea, 'currentChatroomDetails.config.publicInfo');

    const userSettingInput = document.getElementById('chatroom-user-setting');
    if (userSettingInput) settingsUiHelpersModule.loadDynamicSetting(userSettingInput, 'currentChatroomDetails.config.user');

    const partitionNameInput = document.getElementById('partition-name-setting');
    if (partitionNameInput) settingsUiHelpersModule.loadDynamicSetting(partitionNameInput, `currentChatroomDetails.partitions.${partitionId}.name`);

    const allowDrawingCheckbox = document.getElementById('allow-drawing-for-user-roles-checkbox');
    if (allowDrawingCheckbox) settingsUiHelpersModule.loadDynamicSetting(allowDrawingCheckbox, 'currentChatroomDetails.config.allowDrawingForUserRoles');

  },

  _handleManualAddRoleAlias: () => {
    const inputElement = document.getElementById('partition-role-aliases-input');
    if (!inputElement) return;

    const roleInput = inputElement.value.trim();
    if (!roleInput) return;

    const regex = /(.+?)[（\(](.+?)[）\)]$/;
    const match = roleInput.match(regex);
    let newName, newAlias;

    if (match) {
      newName = match[1].trim();
      newAlias = match[2].trim();
    } else {
      newName = roleInput;
      newAlias = "";
    }

    settingsChatroomCurrentModule._addRoleAliasWithSync(newName, newAlias);

    inputElement.value = '';
    inputElement.focus();
  },

  _addRoleAliasWithSync: (roleName, roleAlias) => {
    const currentPartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!currentPartition) return;

    let partitionsToUpdate = [currentPartition];
    if (currentPartition.allowCrossPartitionHistoryAccess) {
      partitionsToUpdate = Array.from(stateModule.currentChatroomDetails.partitions.values())
        .filter(p => p.allowCrossPartitionHistoryAccess);
    }

    const promises = partitionsToUpdate.map(p => {
      const configPath = `currentChatroomDetails.partitions.${p.id}.roleAliases`;
      const currentAliases = settingsUiHelpersModule._getNestedState(configPath) || [];
      if (!currentAliases.some(alias => alias.name === roleName)) {
        const newAliases = [...currentAliases, {
          name: roleName,
          alias: roleAlias,
          state: '活'
        }];
        return transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
          chatroomName: stateModule.currentChatroomDetails.config.name,
          partitionId: p.id,
          updates: {
            roleAliases: newAliases
          }
        });
      }
      return Promise.resolve();
    });
  },

  _renderRoleAliasesSection: (container) => {
    const configPath = `currentChatroomDetails.partitions.${stateModule.activePartitionId}.roleAliases`;
    const currentTags = settingsUiHelpersModule._getNestedState(configPath) || [];

    const tagContainerWrapper = settingsUiHelpersModule.createSettingItem(container, {
      id: 'partition-role-aliases-container-wrapper',
      label: '加载角色 (分区)',
      type: 'div'
    });
    tagContainerWrapper.innerHTML = '';

    const tagContainer = document.createElement('div');
    tagContainer.id = 'partition-role-aliases-container';
    tagContainer.className = 'tag-input-container';
    tagContainerWrapper.appendChild(tagContainer);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'role-alias-input-wrapper';

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-with-button-container';
    inputGroup.style.flexGrow = '1';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'partition-role-aliases-input';
    input.className = 'settings-input';
    input.placeholder = '输入角色名(别名) 或从列表选择';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!stateModule.isCooldownActive) {
          settingsChatroomCurrentModule._handleManualAddRoleAlias();
        }
      }
    });

    const dropdownButton = document.createElement('div');
    dropdownButton.className = 'std-button';
    dropdownButton.textContent = '▼';
    dropdownButton.style.width = 'auto';
    dropdownButton.style.padding = '0 10px';
    dropdownButton.id = 'role-alias-dropdown-button';

    const addButton = document.createElement('div');
    addButton.id = 'add-partition-role-alias-button';
    addButton.className = 'std-button enter-action-button';
    addButton.textContent = '添加';
    addButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
        settingsChatroomCurrentModule._handleManualAddRoleAlias();
      }
    });

    inputGroup.appendChild(input);
    inputGroup.appendChild(dropdownButton);
    inputGroup.appendChild(addButton);

    const dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'role-alias-dropdown-menu';
    dropdownMenu.className = 'role-alias-dropdown-menu';

    inputWrapper.appendChild(inputGroup);
    inputWrapper.appendChild(dropdownMenu);
    tagContainerWrapper.appendChild(inputWrapper);

    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsChatroomCurrentModule._toggleRoleAliasDropdown(dropdownMenu);
    });
    document.addEventListener('click', (e) => {
      if (!inputWrapper.contains(e.target)) {
        dropdownMenu.classList.remove('active');
      }
    });

    settingsUiHelpersModule.renderTagList(tagContainer, currentTags, 'roleAliases', configPath);
  },

  _toggleRoleAliasDropdown: (menu) => {
    if (menu.classList.contains('active')) {
      menu.classList.remove('active');
      return;
    }

    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (!activePartition) return;

    const allChatroomRoles = chatroomDetails.roles.map(r => r.name);
    const loadedRoleNames = new Set((activePartition.roleAliases || []).map(a => a.name));
    const availableRoles = allChatroomRoles.filter(name => !loadedRoleNames.has(name));

    menu.innerHTML = '';
    if (availableRoles.length > 0) {
      availableRoles.forEach(roleName => {
        const item = document.createElement('div');
        item.className = 'role-alias-dropdown-item';
        item.textContent = roleName;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          settingsChatroomCurrentModule._addRoleAliasWithSync(roleName, '');
          settingsChatroomCurrentModule._toggleRoleAliasDropdown(menu);
        });
        menu.appendChild(item);
      });
    } else {
      const noRolesItem = document.createElement('div');
      noRolesItem.className = 'role-alias-dropdown-item';
      noRolesItem.textContent = '无更多角色可添加';
      noRolesItem.style.fontStyle = 'italic';
      noRolesItem.style.color = '#888';
      menu.appendChild(noRolesItem);
    }
    menu.classList.add('active');
  },

  _exportPartitionAsHtml: async () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const partitionId = stateModule.activePartitionId;
    const partition = chatroomDetails?.partitions?.get(partitionId);

    if (!chatroomDetails || !partition) {
      alert("无法获取当前分区信息。");
      return;
    }

    const loadingOverlay = document.getElementById('global-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
      const cssFiles = ['style_vars.css', 'style_layout.css', 'style_chat.css', 'style_settings.css', 'style_novel.css'];
      let cssContent = "";
      for (const file of cssFiles) {
        try {
          const response = await fetch(`/css/${file}`);
          if (response.ok) {
            cssContent += await response.text() + "\n";
          }
        } catch (e) {
          console.warn(`Failed to fetch CSS file ${file}:`, e);
        }
      }

      const compressImageToBase64 = async (url, quality = 0.8) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    const dataUrl = canvas.toDataURL('image/webp', quality);
                    resolve(dataUrl);
                } catch (e) {
                    console.warn("Canvas compression failed (maybe tainted), falling back.", e);
                    resolve(url);
                }
            };
            img.onerror = async () => {
                console.warn("Image load failed for compression, attempting fallback to raw base64.");
                if (url.startsWith('data:')) {
                    resolve(url);
                    return;
                }
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => resolve(url);
                    reader.readAsDataURL(blob);
                } catch (e) {
                    resolve(url);
                }
            };
            img.src = url;
        });
      };

      let bgStyle = "";
      if (chatroomDetails.config.backgroundImageFilename) {
        let bgUrl = chatroomDetails.config.backgroundImageFilename;
        if (!bgUrl.startsWith('data:')) {
          bgUrl = `/chatrooms/${encodeURIComponent(chatroomDetails.config.name)}/${encodeURIComponent(bgUrl)}`;
        }
        const compressedBg = await compressImageToBase64(bgUrl, 0.8);
        bgStyle = `body { background-image: url('${compressedBg}'); background-size: cover; background-attachment: fixed; background-position: center; }`;
      }

      const originalContainer = stateModule.partitionDOMCache.get(partitionId);
      if (!originalContainer) throw new Error("Partition DOM not found in cache.");

      const clonedContainer = originalContainer.cloneNode(true);
      clonedContainer.style.display = 'flex';
      clonedContainer.style.flexDirection = 'column';
      clonedContainer.id = 'chat-export-container';

      const selectorsToRemove = [
        '.message-actions-container',
        '.universal-message-editor',
        '.delete-button',
        '.redraw-button',
        '.set-background-button',
        '.save-character-update-button',
        '.save-event-record-button',
        '.save-to-script-button',
        '.save-knowledge-record-button'
      ];
      selectorsToRemove.forEach(sel => clonedContainer.querySelectorAll(sel).forEach(el => el.remove()));

      clonedContainer.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

      const messageContainers = clonedContainer.querySelectorAll('.message-container');
      
      for (const msgCont of messageContainers) {
        const messageId = msgCont.dataset.messageId;
        const messageObject = partition.history.find(m => m.id === messageId);

        if (messageObject) {
          const contentDiv = msgCont.querySelector('.game-host-content');
          const controlsDiv = msgCont.querySelector('.game-host-controls');

          if (contentDiv && controlsDiv) {
            contentDiv.innerHTML = ''; 

            const views = [
              { id: 'time', label: 'time' },
              { id: 'location', label: 'location' },
              { id: 'goals', label: 'goals' },
              { id: 'character', label: 'character' },
              { id: 'imageView', label: 'imageView' }
            ];

            let activeViewId = messageObject.activeView || 'time';
            const hasImage = stateModule.drawingMasterImageCache.has(messageId) || !!messageObject.drawingMasterContext;
            
            controlsDiv.innerHTML = '';
            
            for (const view of views) {
                const contentHTML = uiChatToolSpecificModule._formatStatusDisplayContent(null, view.id, messageObject);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contentHTML;
                const textContent = tempDiv.textContent.trim();
                
                let keep = false;
                if (view.id === 'imageView' && hasImage) keep = true;
                else if (view.id !== 'imageView' && textContent && !textContent.includes('[No relevant data]') && !textContent.includes('[状态信息不可用]')) keep = true;
                
                if (keep) {
                    const imgs = tempDiv.querySelectorAll('img');
                    for (const img of imgs) {
                        if (img.src) {
                            const compressedSrc = await compressImageToBase64(img.src, 0.8);
                            img.src = compressedSrc;
                        }
                    }
                    const finalContentHTML = tempDiv.innerHTML;

                    const pane = document.createElement('div');
                    pane.className = `view-pane view-${view.id}`;
                    pane.innerHTML = finalContentHTML;
                    pane.style.display = (view.id === activeViewId) ? 'block' : 'none';
                    contentDiv.appendChild(pane);

                    const btn = document.createElement('div');
                    btn.className = `std-button game-host-view-button ${view.id === activeViewId ? 'active' : ''}`;
                    btn.dataset.view = view.id;
                    const icons = { time: '🕒', location: '📍', goals: '🎯', character: '👤', imageView: '🎨' };
                    btn.textContent = icons[view.id] || view.id;
                    controlsDiv.appendChild(btn);
                }
            }
            
            if (!contentDiv.querySelector(`.view-pane.view-${activeViewId}`) && contentDiv.firstChild) {
                contentDiv.firstChild.style.display = 'block';
                const firstViewClass = contentDiv.firstChild.className.match(/view-(\w+)/);
                if (firstViewClass) {
                    const newActiveId = firstViewClass[1];
                    const btn = controlsDiv.querySelector(`.game-host-view-button[data-view="${newActiveId}"]`);
                    if (btn) btn.classList.add('active');
                }
            }
          }
        }
      }

      const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>绳墨导出 - ${partition.name}</title>
    <style>
        ${cssContent}
        ${bgStyle}
        body { margin: 0; padding: 0; min-height: 100vh; overflow-y: auto; background-color: #121212; color: #c0c0c0; }
        #chat-export-container { padding-bottom: 50px; max-width: 800px; margin: 0 auto; }
        .message-container { max-width: 100%; margin: 10px 0; }
        #chat-area::-webkit-scrollbar { display: none; }
        .view-pane { animation: fadeIn 0.2s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    <div id="chat-export-container">
        ${clonedContainer.innerHTML}
    </div>
    <script>
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.game-host-view-button');
            if (btn) {
                const container = btn.closest('.game-host-controls').parentElement.querySelector('.game-host-content');
                const controls = btn.parentElement;
                const view = btn.dataset.view;
                
                controls.querySelectorAll('.game-host-view-button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
                
                if (container) {
                    container.querySelectorAll('.view-pane').forEach(p => p.style.display = 'none');
                    const targetPane = container.querySelector('.view-pane.view-' + view);
                    if (targetPane) targetPane.style.display = 'block';
                }
            }
        });
    </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chatroomDetails.config.name}_${partition.name}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Export failed:", e);
      alert("导出失败: " + e.message);
    } finally {
      if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
  }

};