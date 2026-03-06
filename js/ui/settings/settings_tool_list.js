const settingsToolListModule = {
  init: () => {
    elementsModule.toolListMenuItems.forEach(item => item.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection(item.dataset.target);
    }));
  },

  renderToolSettingsPage: (container, toolName) => {
    container.innerHTML = '';
    const displayName = toolNameMap[toolName] || toolName;

    settingsUiHelpersModule.createSettingItem(container, { id: `${toolName}-enabled-settings`, label: '启用', type: 'checkbox', configPath: `config.toolSettings.${toolName}.enabled` });
    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-model-selection-type`, label: `模型选择 (${displayName})`, type: 'radioGroup', configPath: `config.toolSettings.${toolName}.model_selection_type`,
      name: `${toolName}-model-selection-type`, options: [{ value: "primary", text: "主要" }, { value: "secondary", text: "辅助" }, { value: "tertiary", text: "备用" }]
    });

    if (['scriptCreationMaster', 'characterCreationMaster', 'knowledgeRecordingMaster'].includes(toolName)) {
      settingsUiHelpersModule.createSettingItem(container, { id: `${toolName}-original-novel-length-settings`, label: `原著小说章节数`, type: 'number', configPath: `config.toolSettings.${toolName}.originalNovelLength`, step: 1 });
    }

    ['responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'mainPrompt'].forEach(k => {
      settingsUiHelpersModule.createSettingItem(container, { id: `${toolName}-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}-settings`, label: k, type: 'textarea', rows: k.includes('Prompt') ? 8 : 5, configPath: `config.toolSettings.${toolName}.${k}` });
    });

    if (toolName === 'drawingMaster') {
      settingsUiHelpersModule.createSettingItem(container, { id: `drawingMaster-novel-content-settings`, label: '原著小说 (绘图大师)', type: 'textarea', rows: 8, configPath: `config.drawingMaster_novelContent` });
    }

    settingsToolListModule.loadSingleToolSettings(toolName, container);
  },

  loadSingleToolSettings: (toolName, container) => {
    ['enabled', 'responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'mainPrompt'].forEach(key => {
      settingsUiHelpersModule.loadDynamicSetting(container.querySelector(`#${toolName}-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}-settings`), `config.toolSettings.${toolName}.${key}`);
    });

    settingsUiHelpersModule.loadDynamicSetting(container.querySelector(`#${toolName}-model-selection-type`), `config.toolSettings.${toolName}.model_selection_type`, true);

    if (toolName === 'drawingMaster') {
      settingsUiHelpersModule.loadDynamicSetting(container.querySelector(`#drawingMaster-novel-content-settings`), `config.drawingMaster_novelContent`);
    }
    if (['scriptCreationMaster', 'characterCreationMaster', 'knowledgeRecordingMaster'].includes(toolName)) {
      settingsUiHelpersModule.loadDynamicSetting(container.querySelector(`#${toolName}-original-novel-length-settings`), `config.toolSettings.${toolName}.originalNovelLength`);
    }
  },

  loadGodSettings: (godName) => {
    const contentArea = document.getElementById(`${godName}-page`).querySelector('.settings-section');
    let group = contentArea.querySelector('.settings-group.god-settings');
    if (!group) {
      group = document.createElement('div');
      group.className = 'settings-group god-settings';
      contentArea.appendChild(group);
    }
    settingsToolListModule.renderToolSettingsPage(group, godName);
  }
};