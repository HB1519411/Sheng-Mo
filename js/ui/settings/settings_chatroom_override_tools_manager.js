const settingsChatroomOverrideToolsManagerModule = {
  init: () => {},
  renderChatroomOverrideToolPage: (container, toolName) => {
    container.innerHTML = '';
    const toolDisplayName = toolNameMap[toolName] || toolName;
    const enabledCheckbox = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-enabled`,
      label: `启用${toolDisplayName}覆盖`,
      type: 'checkbox',
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.enabled`
    });
    const radioGroupElement = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-model-selection-type`,
      label: `模型选择`,
      type: 'radioGroup',
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.model_selection_type`,
      name: `chatroom-override-${toolName}-model-selection-type`,
      options: [{
        value: "primary",
        text: "主要"
      }, {
        value: "secondary",
        text: "辅助"
      }, {
        value: "tertiary",
        text: "备用"
      }, ],
      isChatroomOverride: true
    });
    const schemaJson = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-response-schema-json`,
      label: `Response Schema (JSON)`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.responseSchemaJson`
    });
    const schemaParser = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-response-schema-parser-js`,
      label: `Response Schema Parser (JS)`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.responseSchemaParserJs`
    });
    const dbInstruction = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-tool-database-instruction`,
      label: `数据库`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.toolDatabaseInstruction`
    });
    const mainPrompt = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${toolName}-main-prompt`,
      label: `主提示词`,
      type: 'textarea',
      rows: 8,
      configPath: `currentChatroomDetails.config.overrideSettings.${toolName}.mainPrompt`
    });
    const elementsToToggle = [radioGroupElement, schemaJson, schemaParser, dbInstruction, mainPrompt];
    if (toolName === 'drawingMaster') {
      const novelContent = settingsUiHelpersModule.createSettingItem(container, {
        id: `chatroom-override-drawingMaster-novel-content`,
        label: `原著小说 (绘图大师)`,
        type: 'textarea',
        rows: 8,
        configPath: `currentChatroomDetails.config.overrideSettings.drawingMaster.novelContent`
      });
      elementsToToggle.push(novelContent);
    }
    const toggleInputs = (enabled) => {
      elementsToToggle.forEach(el => {
        if (el) {
          const inputs = el.querySelectorAll('input, textarea, select');
          if (inputs.length > 0) {
            inputs.forEach(input => {
              input.disabled = !enabled;
              input.style.opacity = enabled ? 1 : 0.5;
            });
          } else {
            if (el.classList.contains('model-selection-group')) {
              const childInputs = el.querySelectorAll('input');
              childInputs.forEach(ci => ci.disabled = !enabled);
            } else {
              el.disabled = !enabled;
            }
            el.style.opacity = enabled ? 1 : 0.5;
          }
        }
      });
    };
    enabledCheckbox.addEventListener('change', () => {
      toggleInputs(enabledCheckbox.checked);
      settingsUiHelpersModule._handleStateUpdate(`currentChatroomDetails.config.overrideSettings.${toolName}.enabled`, enabledCheckbox.checked, true);
    });
    settingsChatroomOverrideToolsManagerModule.loadChatroomOverrideToolSettings(toolName);
    toggleInputs(stateModule.currentChatroomDetails?.config?.overrideSettings?.[toolName]?.enabled || false);
  },
  loadChatroomOverrideToolSettings: (toolName) => {
    const settings = stateModule.currentChatroomDetails?.config?.overrideSettings?.[toolName];
    if (!settings) return;
    const pageElement = document.getElementById(`chatroom-override-${toolName}-page`);
    if (!pageElement) return;

    const enabledCheckboxElement = document.getElementById(`chatroom-override-${toolName}-enabled`);
    const radioGroupElement = document.getElementById(`chatroom-override-${toolName}-model-selection-type`);
    const schemaJsonElement = document.getElementById(`chatroom-override-${toolName}-response-schema-json`);
    const schemaParserElement = document.getElementById(`chatroom-override-${toolName}-response-schema-parser-js`);
    const dbInstructionElement = document.getElementById(`chatroom-override-${toolName}-tool-database-instruction`);
    const mainPromptElement = document.getElementById(`chatroom-override-${toolName}-main-prompt`);

    if (enabledCheckboxElement) settingsUiHelpersModule.loadDynamicSetting(enabledCheckboxElement, `currentChatroomDetails.config.overrideSettings.${toolName}.enabled`);
    if (radioGroupElement) settingsUiHelpersModule.loadDynamicSetting(radioGroupElement, `currentChatroomDetails.config.overrideSettings.${toolName}.model_selection_type`, true);
    if (schemaJsonElement) settingsUiHelpersModule.loadDynamicSetting(schemaJsonElement, `currentChatroomDetails.config.overrideSettings.${toolName}.responseSchemaJson`);
    if (schemaParserElement) settingsUiHelpersModule.loadDynamicSetting(schemaParserElement, `currentChatroomDetails.config.overrideSettings.${toolName}.responseSchemaParserJs`);
    if (dbInstructionElement) settingsUiHelpersModule.loadDynamicSetting(dbInstructionElement, `currentChatroomDetails.config.overrideSettings.${toolName}.toolDatabaseInstruction`);
    if (mainPromptElement) settingsUiHelpersModule.loadDynamicSetting(mainPromptElement, `currentChatroomDetails.config.overrideSettings.${toolName}.mainPrompt`);
    if (toolName === 'drawingMaster') {
      const novelContentElement = document.getElementById(`chatroom-override-drawingMaster-novel-content`);
      if (novelContentElement) settingsUiHelpersModule.loadDynamicSetting(novelContentElement, `currentChatroomDetails.config.overrideSettings.drawingMaster.novelContent`);
    }
    const enabled = settings.enabled || false;
    const elementsToToggle = [
      radioGroupElement,
      schemaJsonElement,
      schemaParserElement,
      dbInstructionElement,
      mainPromptElement
    ];
    if (toolName === 'drawingMaster') {
      elementsToToggle.push(document.getElementById(`chatroom-override-drawingMaster-novel-content`));
    }
    elementsToToggle.forEach(el => {
      if (el) {
        const inputs = el.querySelectorAll('input, textarea, select');
        if (inputs.length > 0) {
          inputs.forEach(input => {
            input.disabled = !enabled;
            input.style.opacity = enabled ? 1 : 0.5;
          });
        } else {
          if (el.classList.contains('model-selection-group')) {
            const childInputs = el.querySelectorAll('input');
            childInputs.forEach(ci => ci.disabled = !enabled);
          } else {
            el.disabled = !enabled;
          }
          el.style.opacity = enabled ? 1 : 0.5;
        }
      }
    });
  },
};