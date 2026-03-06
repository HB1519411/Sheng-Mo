const settingsPromptPresetsModule = {
  init: () => {
    elementsModule.presetModalCancelBtn.addEventListener('click', () => settingsPromptPresetsModule.hidePresetSelectionModal());
  },
  
  showPresetSelectionModal: (mode, data, callback) => {
    const modal = elementsModule.presetSelectionModalOverlay;
    const listContainer = elementsModule.presetModalListContainer;
    elementsModule.presetModalTitle.textContent = mode === 'export' ? '选择要导出的预设项' : '选择要导入的预设项';
    listContainer.innerHTML = '';
    
    Object.entries(data.groups).forEach(([groupKey, group]) => {
      if (!Object.keys(group.items).length) return;
      
      const groupDiv = document.createElement('div');
      groupDiv.className = 'preset-group';
      
      const groupTitleDiv = document.createElement('div');
      groupTitleDiv.className = 'preset-group-title';
      const groupCheckbox = document.createElement('input');
      groupCheckbox.type = 'checkbox';
      groupCheckbox.id = `preset-group-${groupKey}`;
      groupCheckbox.checked = true;
      groupTitleDiv.append(groupCheckbox, Object.assign(document.createElement('label'), { htmlFor: groupCheckbox.id, textContent: group.label }));
      groupDiv.appendChild(groupTitleDiv);
      
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'preset-items-container';
      
      Object.entries(group.items).forEach(([itemKey, item]) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'preset-item';
        const itemCheckbox = document.createElement('input');
        itemCheckbox.type = 'checkbox';
        itemCheckbox.id = `preset-item-${groupKey}-${itemKey}`;
        itemCheckbox.checked = true;
        Object.assign(itemCheckbox.dataset, { group: groupKey, key: itemKey });
        
        itemDiv.append(itemCheckbox, Object.assign(document.createElement('label'), { htmlFor: itemCheckbox.id, textContent: item.label }));
        itemsContainer.appendChild(itemDiv);
        
        itemCheckbox.addEventListener('change', () => {
          const all = Array.from(itemsContainer.querySelectorAll('input[type="checkbox"]'));
          groupCheckbox.checked = all.every(cb => cb.checked);
          groupCheckbox.indeterminate = !groupCheckbox.checked && all.some(cb => cb.checked);
        });
      });
      
      groupCheckbox.addEventListener('change', (e) => itemsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked));
      groupDiv.appendChild(itemsContainer);
      listContainer.appendChild(groupDiv);
    });
    
    const newConfirmBtn = elementsModule.presetModalConfirmBtn.cloneNode(true);
    elementsModule.presetModalConfirmBtn.parentNode.replaceChild(newConfirmBtn, elementsModule.presetModalConfirmBtn);
    elementsModule.presetModalConfirmBtn = newConfirmBtn;
    
    newConfirmBtn.addEventListener('click', () => {
      const selectedData = { version: 3, groups: {} };
      const checked = listContainer.querySelectorAll('.preset-item input[type="checkbox"]:checked');
      if (!checked.length) return alert("请至少选择一项！");
      
      checked.forEach(cb => {
        const { group, key } = cb.dataset;
        if (!selectedData.groups[group]) selectedData.groups[group] = { label: data.groups[group].label, items: {} };
        selectedData.groups[group].items[key] = data.groups[group].items[key];
      });
      callback(selectedData);
      settingsPromptPresetsModule.hidePresetSelectionModal();
    });
    
    modal.classList.add('active');
  },
  
  hidePresetSelectionModal: () => elementsModule.presetSelectionModalOverlay.classList.remove('active'),

  renderGeneralConfigPage: (container) => {
    container.innerHTML = '';
    const sel = settingsUiHelpersModule.createSettingItem(container, {
      id: 'general-model-selection-type', label: '模型选择 (角色/临时角色)', type: 'radioGroup', configPath: 'config.generalModelSelectionType',
      options: [{ value: "primary", text: "主要" }, { value: "secondary", text: "辅助" }, { value: "tertiary", text: "备用" }]
    });
    settingsUiHelpersModule.loadDynamicSetting(sel, 'config.generalModelSelectionType', true);
    
    ['originalNovelLength', 'clothingGuide', 'responseSchemaJson', 'responseSchemaParserJs', 'sharedDatabaseInstruction', 'mainPrompt'].forEach(k => {
      const type = k === 'originalNovelLength' ? 'number' : 'textarea';
      const el = settingsUiHelpersModule.createSettingItem(container, {
        id: `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}-settings`, label: k, type, rows: 5, configPath: `config.${k}`, step: 1
      });
      settingsUiHelpersModule.loadDynamicSetting(el, `config.${k}`);
    });
  },

  renderPromptPresetPage: (container) => {
    container.innerHTML = '';
    const sysEl = settingsUiHelpersModule.createSettingItem(container, {
      id: 'system-instruction-preset-settings', label: 'System Instruction (全局)', type: 'textarea', rows: 8, configPath: 'config.systemInstruction'
    });
    settingsUiHelpersModule.loadDynamicSetting(sysEl, 'config.systemInstruction');

    const turnsGroup = document.createElement('div');
    turnsGroup.className = 'settings-group';
    turnsGroup.innerHTML = '<label class="settings-label">对话轮次预设</label>';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'prompt-preset-actions';
    settingsUiHelpersModule.createSettingItem(actionsDiv, { id: 'add-prompt-user-turn-button', label: '添加 U', type: 'button' })
      .addEventListener('click', () => !stateModule.isCooldownActive && settingsPromptPresetsModule.addPromptPresetTurn('user'));
    settingsUiHelpersModule.createSettingItem(actionsDiv, { id: 'add-prompt-model-turn-button', label: '添加 M', type: 'button' })
      .addEventListener('click', () => !stateModule.isCooldownActive && settingsPromptPresetsModule.addPromptPresetTurn('model'));
    turnsGroup.appendChild(actionsDiv);

    const listContainer = settingsUiHelpersModule.createSettingItem(turnsGroup, { id: 'prompt-preset-list-container', type: 'div' });
    listContainer.style.marginTop = 'var(--margin-medium)';

    const fileActionsDiv = document.createElement('div');
    fileActionsDiv.className = 'prompt-preset-actions';
    fileActionsDiv.style.marginTop = '15px';
    
    settingsUiHelpersModule.createSettingItem(fileActionsDiv, { id: 'export-prompt-presets-button', label: '导出预设', type: 'button' })
      .addEventListener('click', () => {
        if (!stateModule.isCooldownActive) {
          const exportData = apiClientConfigModule.getExportableData();
          settingsPromptPresetsModule.showPresetSelectionModal('export', exportData, apiClientConfigModule.downloadExportData);
        }
      });

    const importFileHidden = document.createElement('input');
    importFileHidden.type = 'file';
    importFileHidden.id = 'import-prompt-presets-file';
    importFileHidden.style.display = 'none';
    importFileHidden.accept = '.json';
    importFileHidden.addEventListener('change', settingsPromptPresetsModule.handleImportPromptPresets);
    fileActionsDiv.appendChild(importFileHidden);
    
    settingsUiHelpersModule.createSettingItem(fileActionsDiv, { id: 'import-prompt-presets-button', label: '导入预设', type: 'button' })
      .addEventListener('click', () => !stateModule.isCooldownActive && importFileHidden.click());
      
    turnsGroup.appendChild(fileActionsDiv);
    container.appendChild(turnsGroup);
    settingsPromptPresetsModule.renderPromptPresetsList();
  },

  loadPromptPresetSettings: () => {
    settingsUiHelpersModule.loadDynamicSetting(document.getElementById('system-instruction-preset-settings'), 'config.systemInstruction');
    settingsPromptPresetsModule.renderPromptPresetsList();
  },

  renderPromptPresetsList: () => {
    const container = document.getElementById('prompt-preset-list-container');
    container.innerHTML = '';
    
    stateModule.config.promptPresetTurns.forEach((turn, index) => {
      const item = document.createElement('div');
      item.className = 'prompt-preset-item';
      
      const roleLabel = document.createElement('span');
      roleLabel.className = 'preset-role-label';
      roleLabel.textContent = turn.role === 'user' ? 'U' : 'M';
      
      const textarea = document.createElement('textarea');
      textarea.className = 'preset-instruction-textarea';
      textarea.value = turn.instruction;
      textarea.addEventListener('change', (e) => settingsUiHelpersModule._handleStateUpdate(`config.promptPresetTurns[${index}].instruction`, e.target.value));
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      
      const makeBtn = (text, onClick, disabled) => {
        const btn = document.createElement('div');
        btn.className = 'std-button';
        btn.textContent = text;
        if (disabled) {
            btn.style.opacity = '0.5';
            btn.disabled = true;
        } else {
            btn.addEventListener('click', onClick);
        }
        return btn;
      };

      actionsDiv.append(
        makeBtn('↑', () => settingsPromptPresetsModule.movePromptPresetTurn(index, -1), index === 0),
        makeBtn('↓', () => settingsPromptPresetsModule.movePromptPresetTurn(index, 1), index === (stateModule.config.promptPresetTurns.length - 1)),
        makeBtn('✕', () => settingsPromptPresetsModule.deletePromptPresetTurn(index))
      );

      item.append(roleLabel, textarea, actionsDiv);
      container.appendChild(item);
    });
  },

  addPromptPresetTurn: (role) => {
    const newTurns = [...stateModule.config.promptPresetTurns, { role, instruction: "" }];
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { 'promptPresetTurns': newTurns } })
      .then(() => settingsPromptPresetsModule.renderPromptPresetsList());
  },

  movePromptPresetTurn: (index, direction) => {
    const newIndex = index + direction;
    const turns = stateModule.config.promptPresetTurns;
    if (newIndex < 0 || newIndex >= turns.length) return;
    
    const newTurns = [...turns];
    newTurns.splice(newIndex, 0, newTurns.splice(index, 1)[0]);
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { 'promptPresetTurns': newTurns } })
      .then(() => settingsPromptPresetsModule.renderPromptPresetsList());
  },

  deletePromptPresetTurn: (index) => {
    const newTurns = stateModule.config.promptPresetTurns.filter((_, i) => i !== index);
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { 'promptPresetTurns': newTurns } })
      .then(() => settingsPromptPresetsModule.renderPromptPresetsList());
  },

  handleImportPromptPresets: (event) => {
    const file = event.target.files[0];
    if (file) {
      apiClientConfigModule.parseImportFile(file).then(data => {
        settingsPromptPresetsModule.showPresetSelectionModal('import', data, (selectedData) => {
          apiClientConfigModule.applyImportData(selectedData);
          alert("预设导入成功！");
        });
      }).catch(err => alert(`文件解析失败: ${err.message}`));
    }
    event.target.value = null;
  }
};