const settingsChatroomOverrideGeneralManagerModule = {
  init: () => {},
  renderChatroomOverrideGeneralPage: (container) => {
    container.innerHTML = '';
    const sectionType = 'general';
    const enabledCheckbox = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${sectionType}-enabled`,
      label: `启用通用配置覆盖`,
      type: 'checkbox',
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.enabled`
    });
    const radioGroupElement = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${sectionType}-model-selection-type`,
      label: `模型选择 (角色/临时角色)`,
      type: 'radioGroup',
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.model_selection_type`,
      name: `chatroom-override-${sectionType}-model-selection-type`,
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
      id: `chatroom-override-${sectionType}-response-schema-json`,
      label: `Response Schema (JSON)`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.responseSchemaJson`
    });
    const schemaParser = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${sectionType}-response-schema-parser-js`,
      label: `Response Schema Parser (JS)`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.responseSchemaParserJs`
    });
    const dbInstruction = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${sectionType}-shared-database-instruction`,
      label: `数据库`,
      type: 'textarea',
      rows: 5,
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.sharedDatabaseInstruction`
    });
    const mainPrompt = settingsUiHelpersModule.createSettingItem(container, {
      id: `chatroom-override-${sectionType}-main-prompt`,
      label: `主提示词`,
      type: 'textarea',
      rows: 8,
      configPath: `currentChatroomDetails.config.overrideSettings.${sectionType}.mainPrompt`
    });
    const elementsToToggle = [radioGroupElement, schemaJson, schemaParser, dbInstruction, mainPrompt];
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
      settingsUiHelpersModule._handleStateUpdate(`currentChatroomDetails.config.overrideSettings.${sectionType}.enabled`, enabledCheckbox.checked, true);
    });
    settingsChatroomOverrideGeneralManagerModule.loadChatroomOverrideGeneralSettings();
    toggleInputs(stateModule.currentChatroomDetails?.config?.overrideSettings?.[sectionType]?.enabled || false);
  },
  loadChatroomOverrideGeneralSettings: () => {
    const sectionType = 'general';
    const settings = stateModule.currentChatroomDetails?.config?.overrideSettings?.[sectionType];
    if (!settings) return;
    const enabledCheckboxElement = document.getElementById(`chatroom-override-${sectionType}-enabled`);
    const radioGroupElement = document.getElementById(`chatroom-override-${sectionType}-model-selection-type`);
    const schemaJsonElement = document.getElementById(`chatroom-override-${sectionType}-response-schema-json`);
    const schemaParserElement = document.getElementById(`chatroom-override-${sectionType}-response-schema-parser-js`);
    const dbInstructionElement = document.getElementById(`chatroom-override-${sectionType}-shared-database-instruction`);
    const mainPromptElement = document.getElementById(`chatroom-override-${sectionType}-main-prompt`);

    if (enabledCheckboxElement) settingsUiHelpersModule.loadDynamicSetting(enabledCheckboxElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.enabled`);
    if (radioGroupElement) settingsUiHelpersModule.loadDynamicSetting(radioGroupElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.model_selection_type`, true);
    if (schemaJsonElement) settingsUiHelpersModule.loadDynamicSetting(schemaJsonElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.responseSchemaJson`);
    if (schemaParserElement) settingsUiHelpersModule.loadDynamicSetting(schemaParserElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.responseSchemaParserJs`);
    if (dbInstructionElement) settingsUiHelpersModule.loadDynamicSetting(dbInstructionElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.sharedDatabaseInstruction`);
    if (mainPromptElement) settingsUiHelpersModule.loadDynamicSetting(mainPromptElement, `currentChatroomDetails.config.overrideSettings.${sectionType}.mainPrompt`);
    const enabled = settings.enabled || false;
    const elementsToToggle = [
      radioGroupElement,
      schemaJsonElement,
      schemaParserElement,
      dbInstructionElement,
      mainPromptElement
    ];
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