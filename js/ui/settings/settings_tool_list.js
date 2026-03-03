const settingsToolListModule = {
  init: () => {
    elementsModule.toolListMenuItems.forEach(item => item.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection(item.dataset.target);
    }));
  },
  renderToolSettingsPage: (container, toolName) => {
    container.innerHTML = '';
    const toolDisplayName = toolNameMap[toolName] || toolName;

    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-enabled-settings`,
      label: '启用',
      type: 'checkbox',
      configPath: `config.toolSettings.${toolName}.enabled`
    });

    const modelSelectionElement = settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-model-selection-type`,
      label: `模型选择 (${toolDisplayName})`,
      type: 'radioGroup',
      configPath: `config.toolSettings.${toolName}.model_selection_type`,
      name: `${toolName}-model-selection-type`,
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

    if (toolName === 'scriptCreationMaster' || toolName === 'characterCreationMaster' || toolName === 'knowledgeRecordingMaster') {
      settingsUiHelpersModule.createSettingItem(container, {
        id: `${toolName}-original-novel-length-settings`,
        label: `原著小说章节数 (${toolDisplayName})`,
        type: 'number',
        configPath: `config.toolSettings.${toolName}.originalNovelLength`,
        step: 1
      });
    }

    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-response-schema-json-settings`,
      label: 'Response Schema (JSON)',
      type: 'textarea',
      rows: 5,
      configPath: `config.toolSettings.${toolName}.responseSchemaJson`
    });
    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-response-schema-parser-js-settings`,
      label: 'Response Schema Parser (JS)',
      type: 'textarea',
      rows: 5,
      configPath: `config.toolSettings.${toolName}.responseSchemaParserJs`
    });
    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-tool-database-instruction-settings`,
      label: '数据库',
      type: 'textarea',
      rows: 5,
      configPath: `config.toolSettings.${toolName}.toolDatabaseInstruction`
    });
    settingsUiHelpersModule.createSettingItem(container, {
      id: `${toolName}-main-prompt-settings`,
      label: '主提示词',
      type: 'textarea',
      rows: 8,
      configPath: `config.toolSettings.${toolName}.mainPrompt`
    });

    if (toolName === 'drawingMaster') {
      settingsUiHelpersModule.createSettingItem(container, {
        id: `drawingMaster-novel-content-settings`,
        label: '原著小说 (绘图大师)',
        type: 'textarea',
        rows: 8,
        configPath: `config.toolSettings.drawingMaster.novelContent`
      });
    }

    settingsToolListModule.loadSingleToolSettings(toolName, container);
  },

  loadSingleToolSettings: (toolName, container) => {
    if (!container) {
      const pageElement = document.getElementById(`${toolName}-page`);
      if (pageElement) container = pageElement.querySelector('.settings-group.god-settings');
    }
    if (!container) return;

    const keysWithSettingsSuffix = ['enabled', 'responseSchemaJson', 'responseSchemaParserJs', 'toolDatabaseInstruction', 'mainPrompt'];

    keysWithSettingsSuffix.forEach(key => {
      const kebabCaseKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
      const elementId = `${toolName}-${kebabCaseKey}-settings`;
      const element = container.querySelector(`#${elementId}`);
      if (element) {
        settingsUiHelpersModule.loadDynamicSetting(element, `config.toolSettings.${toolName}.${key}`);
      }
    });

    const modelSelectionElementId = `${toolName}-model-selection-type`;
    const modelSelectionElement = container.querySelector(`#${modelSelectionElementId}`);
    if (modelSelectionElement) {
      settingsUiHelpersModule.loadDynamicSetting(modelSelectionElement, `config.toolSettings.${toolName}.model_selection_type`, true);
    }

    if (toolName === 'drawingMaster') {
      const novelContentElement = container.querySelector(`#drawingMaster-novel-content-settings`);
      if (novelContentElement) {
        settingsUiHelpersModule.loadDynamicSetting(novelContentElement, `config.toolSettings.drawingMaster.novelContent`);
      }
    }
    if (toolName === 'scriptCreationMaster' || toolName === 'characterCreationMaster' || toolName === 'knowledgeRecordingMaster') {
      const novelLengthElement = container.querySelector(`#${toolName}-original-novel-length-settings`);
      if (novelLengthElement) {
        settingsUiHelpersModule.loadDynamicSetting(novelLengthElement, `config.toolSettings.${toolName}.originalNovelLength`);
      }
    }
  },

  loadGodSettings: (godName) => {
    const pageElementId = `${godName}-page`;
    const pageElement = document.getElementById(pageElementId);
    if (pageElement) {
      const contentArea = pageElement.querySelector('.settings-section');
      if (contentArea) {
        let settingsGroup = contentArea.querySelector('.settings-group.god-settings');
        if (!settingsGroup) {
          settingsGroup = document.createElement('div');
          settingsGroup.className = 'settings-group god-settings';
          contentArea.appendChild(settingsGroup);
        }
        settingsToolListModule.renderToolSettingsPage(settingsGroup, godName);
      }
    }
  },
};