const settingsPromptPresetsModule = {
  init: () => {
      // 绑定模态框按钮事件
      if (elementsModule.presetModalCancelBtn) {
          elementsModule.presetModalCancelBtn.addEventListener('click', () => {
              settingsPromptPresetsModule.hidePresetSelectionModal();
          });
      }
  },
  
  // 显示预设选择模态框
  showPresetSelectionModal: (mode, data, callback) => {
      const modal = elementsModule.presetSelectionModalOverlay;
      const listContainer = elementsModule.presetModalListContainer;
      const confirmBtn = elementsModule.presetModalConfirmBtn;
      const title = elementsModule.presetModalTitle;
      
      if (!modal || !listContainer) return;
      
      listContainer.innerHTML = '';
      title.textContent = mode === 'export' ? '选择要导出的预设项' : '选择要导入的预设项';
      
      const groups = data.groups || {};
      
      // 遍历每个分组 (globalSettings, novelaiSettings, toolSettings)
      for (const groupKey in groups) {
          const group = groups[groupKey];
          if (!group.items || Object.keys(group.items).length === 0) continue;
          
          const groupDiv = document.createElement('div');
          groupDiv.className = 'preset-group';
          
          // 分组标题和全选/反选
          const groupTitleDiv = document.createElement('div');
          groupTitleDiv.className = 'preset-group-title';
          const groupCheckbox = document.createElement('input');
          groupCheckbox.type = 'checkbox';
          groupCheckbox.id = `preset-group-${groupKey}`;
          groupCheckbox.checked = true; // 默认全选
          
          const groupLabel = document.createElement('label');
          groupLabel.htmlFor = `preset-group-${groupKey}`;
          groupLabel.textContent = group.label;
          
          groupTitleDiv.appendChild(groupCheckbox);
          groupTitleDiv.appendChild(groupLabel);
          groupDiv.appendChild(groupTitleDiv);
          
          // 分组内的具体项
          const itemsContainer = document.createElement('div');
          itemsContainer.className = 'preset-items-container';
          
          const items = group.items;
          const itemKeys = Object.keys(items);
          
          itemKeys.forEach(itemKey => {
              const item = items[itemKey];
              // 导入模式下，如果该项没有值，则不显示 (或者置灰)
              // 这里简化处理：只要源数据里有这个key，就显示
              
              const itemDiv = document.createElement('div');
              itemDiv.className = 'preset-item';
              
              const itemCheckbox = document.createElement('input');
              itemCheckbox.type = 'checkbox';
              itemCheckbox.id = `preset-item-${groupKey}-${itemKey}`;
              itemCheckbox.checked = true;
              itemCheckbox.dataset.group = groupKey;
              itemCheckbox.dataset.key = itemKey;
              
              const itemLabel = document.createElement('label');
              itemLabel.htmlFor = `preset-item-${groupKey}-${itemKey}`;
              itemLabel.textContent = item.label;
              
              itemDiv.appendChild(itemCheckbox);
              itemDiv.appendChild(itemLabel);
              itemsContainer.appendChild(itemDiv);
              
              // 联动逻辑：子项变化影响组复选框状态
              itemCheckbox.addEventListener('change', () => {
                  const allInGroup = itemsContainer.querySelectorAll('input[type="checkbox"]');
                  const allChecked = Array.from(allInGroup).every(cb => cb.checked);
                  groupCheckbox.checked = allChecked;
                  groupCheckbox.indeterminate = !allChecked && Array.from(allInGroup).some(cb => cb.checked);
              });
          });
          
          // 联动逻辑：组复选框控制子项
          groupCheckbox.addEventListener('change', (e) => {
              const isChecked = e.target.checked;
              const childCheckboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
              childCheckboxes.forEach(cb => cb.checked = isChecked);
          });
          
          groupDiv.appendChild(itemsContainer);
          listContainer.appendChild(groupDiv);
      }
      
      // 绑定确认按钮事件
      // 移除旧的监听器以防重复绑定
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      elementsModule.presetModalConfirmBtn = newConfirmBtn;
      
      newConfirmBtn.addEventListener('click', () => {
          const selectedData = { version: 3, groups: {} };
          const checkboxes = listContainer.querySelectorAll('.preset-item input[type="checkbox"]:checked');
          
          if (checkboxes.length === 0) {
              alert("请至少选择一项！");
              return;
          }
          
          checkboxes.forEach(cb => {
              const gKey = cb.dataset.group;
              const iKey = cb.dataset.key;
              
              if (!selectedData.groups[gKey]) {
                  selectedData.groups[gKey] = { label: groups[gKey].label, items: {} };
              }
              selectedData.groups[gKey].items[iKey] = groups[gKey].items[iKey];
          });
          
          callback(selectedData);
          settingsPromptPresetsModule.hidePresetSelectionModal();
      });
      
      modal.classList.add('active');
  },
  
  hidePresetSelectionModal: () => {
      if (elementsModule.presetSelectionModalOverlay) {
          elementsModule.presetSelectionModalOverlay.classList.remove('active');
      }
  },

  renderGeneralConfigPage: (container) => {
    container.innerHTML = '';
    const generalModelSelectionTypeElement = settingsUiHelpersModule.createSettingItem(container, {
      id: 'general-model-selection-type',
      label: '模型选择 (角色/临时角色)',
      type: 'radioGroup',
      configPath: 'config.generalModelSelectionType',
      name: 'general-model-selection-type',
      options: [{
        value: "primary",
        text: "主要",
      }, {
        value: "secondary",
        text: "辅助",
      }, {
        value: "tertiary",
        text: "备用",
      }, ]
    });
    settingsUiHelpersModule.loadDynamicSetting(generalModelSelectionTypeElement, 'config.generalModelSelectionType', true);
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'original-novel-length-settings',
      label: '原著小说章节数',
      type: 'number',
      configPath: 'config.originalNovelLength',
      step: 1
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#original-novel-length-settings'), 'config.originalNovelLength');
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'clothing-guide-settings',
      label: '穿着指南',
      type: 'textarea',
      rows: 5,
      configPath: 'config.clothingGuide'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#clothing-guide-settings'), 'config.clothingGuide');
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'response-schema-json-settings',
      label: 'Response Schema (JSON)',
      type: 'textarea',
      rows: 5,
      configPath: 'config.responseSchemaJson'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#response-schema-json-settings'), 'config.responseSchemaJson');
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'response-schema-parser-js-settings',
      label: 'Response Schema Parser (JS)',
      type: 'textarea',
      rows: 5,
      configPath: 'config.responseSchemaParserJs'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#response-schema-parser-js-settings'), 'config.responseSchemaParserJs');
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'shared-database-instruction-settings',
      label: '数据库',
      type: 'textarea',
      rows: 5,
      configPath: 'config.sharedDatabaseInstruction'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#shared-database-instruction-settings'), 'config.sharedDatabaseInstruction');
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'chatroom-main-prompt-settings',
      label: '主提示词',
      type: 'textarea',
      rows: 8,
      configPath: 'config.mainPrompt'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#chatroom-main-prompt-settings'), 'config.mainPrompt');
  },
  renderPromptPresetPage: (container) => {
    container.innerHTML = '';
    settingsUiHelpersModule.createSettingItem(container, {
      id: 'system-instruction-preset-settings',
      label: 'System Instruction (全局)',
      type: 'textarea',
      rows: 8,
      configPath: 'config.systemInstruction'
    });
    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#system-instruction-preset-settings'), 'config.systemInstruction');
    const turnsGroup = document.createElement('div');
    turnsGroup.className = 'settings-group';
    const turnsLabel = document.createElement('label');
    turnsLabel.className = 'settings-label';
    turnsLabel.textContent = '对话轮次预设';
    turnsGroup.appendChild(turnsLabel);
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'prompt-preset-actions';
    const addUserBtn = settingsUiHelpersModule.createSettingItem(actionsDiv, {
      id: 'add-prompt-user-turn-button',
      label: '添加 U',
      type: 'button'
    });
    addUserBtn.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPromptPresetsModule.addPromptPresetTurn('user');
    });
    const addModelBtn = settingsUiHelpersModule.createSettingItem(actionsDiv, {
      id: 'add-prompt-model-turn-button',
      label: '添加 M',
      type: 'button'
    });
    addModelBtn.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPromptPresetsModule.addPromptPresetTurn('model');
    });
    turnsGroup.appendChild(actionsDiv);
    const listContainer = settingsUiHelpersModule.createSettingItem(turnsGroup, {
      id: 'prompt-preset-list-container',
      type: 'div'
    });
    listContainer.style.marginTop = 'var(--margin-medium)';
    const fileActionsDiv = document.createElement('div');
    fileActionsDiv.className = 'prompt-preset-actions';
    fileActionsDiv.style.marginTop = '15px';
    const exportBtn = settingsUiHelpersModule.createSettingItem(fileActionsDiv, {
      id: 'export-prompt-presets-button',
      label: '导出预设',
      type: 'button'
    });
    
    // 导出按钮事件
    exportBtn.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
          const exportData = apiClientConfigModule.getExportableData();
          settingsPromptPresetsModule.showPresetSelectionModal('export', exportData, (selectedData) => {
              apiClientConfigModule.downloadExportData(selectedData);
          });
      }
    });
    
    const importFileHidden = document.createElement('input');
    importFileHidden.type = 'file';
    importFileHidden.id = 'import-prompt-presets-file';
    importFileHidden.style.display = 'none';
    importFileHidden.accept = '.json';
    importFileHidden.addEventListener('change', settingsPromptPresetsModule.handleImportPromptPresets);
    fileActionsDiv.appendChild(importFileHidden);
    const importBtn = settingsUiHelpersModule.createSettingItem(fileActionsDiv, {
      id: 'import-prompt-presets-button',
      label: '导入预设',
      type: 'button'
    });
    importBtn.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) importFileHidden.click();
    });
    turnsGroup.appendChild(fileActionsDiv);
    container.appendChild(turnsGroup);
    settingsPromptPresetsModule.renderPromptPresetsList(listContainer);
  },
  loadPromptPresetSettings: () => {
    const systemInstructionElement = document.getElementById('system-instruction-preset-settings');
    if (systemInstructionElement) settingsUiHelpersModule.loadDynamicSetting(systemInstructionElement, 'config.systemInstruction');
    settingsPromptPresetsModule.renderPromptPresetsList();
  },
  renderPromptPresetsList: (container) => {
    if (!container) container = document.getElementById('prompt-preset-list-container');
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
      textarea.addEventListener('change', (e) => settingsUiHelpersModule._handleStateUpdate(`config.promptPresetTurns[${index}].instruction`, e.target.value));
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      const upButton = document.createElement('div');
      upButton.className = 'std-button preset-move-up';
      upButton.textContent = '↑';
      upButton.disabled = index === 0;
      if (index === 0) upButton.style.opacity = '0.5';
      upButton.addEventListener('click', () => settingsPromptPresetsModule.movePromptPresetTurn(index, -1));
      const downButton = document.createElement('div');
      downButton.className = 'std-button preset-move-down';
      downButton.textContent = '↓';
      downButton.disabled = index === turns.length - 1;
      if (index === turns.length - 1) downButton.style.opacity = '0.5';
      downButton.addEventListener('click', () => settingsPromptPresetsModule.movePromptPresetTurn(index, 1));
      const deleteButton = document.createElement('div');
      deleteButton.className = 'std-button preset-delete';
      deleteButton.textContent = '✕';
      deleteButton.addEventListener('click', () => settingsPromptPresetsModule.deletePromptPresetTurn(index));
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
    const currentTurns = stateModule.config.promptPresetTurns || [];
    const newTurns = [...currentTurns, {
      role: role,
      instruction: ""
    }];
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
      updates: {
        'promptPresetTurns': newTurns
      }
    }).then(() => {
      settingsPromptPresetsModule.renderPromptPresetsList();
    });
  },
  movePromptPresetTurn: (index, direction) => {
    const currentTurns = stateModule.config.promptPresetTurns;
    if (!currentTurns || index < 0 || index >= currentTurns.length) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentTurns.length) return;
    const newTurns = [...currentTurns];
    const itemToMove = newTurns.splice(index, 1)[0];
    newTurns.splice(newIndex, 0, itemToMove);
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
      updates: {
        'promptPresetTurns': newTurns
      }
    }).then(() => {
      settingsPromptPresetsModule.renderPromptPresetsList();
    });
  },
  deletePromptPresetTurn: (index) => {
    const currentTurns = stateModule.config.promptPresetTurns;
    if (currentTurns && currentTurns[index]) {
      const newTurns = currentTurns.filter((_, i) => i !== index);
      transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
        updates: {
          'promptPresetTurns': newTurns
        }
      }).then(() => {
        settingsPromptPresetsModule.renderPromptPresetsList();
      });
    }
  },
  handleImportPromptPresets: (event) => {
    const file = event.target.files[0];
    if (file && typeof apiClientConfigModule !== 'undefined') {
        apiClientConfigModule.parseImportFile(file).then(data => {
            settingsPromptPresetsModule.showPresetSelectionModal('import', data, (selectedData) => {
                apiClientConfigModule.applyImportData(selectedData);
                alert("预设导入成功！");
            });
        }).catch(err => {
            _logAndDisplayError(`Failed to parse import file: ${err.message}`, 'handleImportPromptPresets');
            alert(`文件解析失败: ${err.message}`);
        });
    }
    event.target.value = null;
  },
  loadGeneralModelSelectionTypeSetting: () => {
    const el = document.getElementById('general-model-selection-type');
    if (el) settingsUiHelpersModule.loadDynamicSetting(el, 'config.generalModelSelectionType', true);
  }
};