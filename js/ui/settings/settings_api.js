const settingsApiModule = {
  init: () => {},
  renderApiSettingsPage: (container) => {
    container.innerHTML = '';

    const connectionModeGroup = document.createElement('div');
    connectionModeGroup.className = 'settings-group proxy-settings';
    const modeRadio = settingsUiHelpersModule.createSettingItem(connectionModeGroup, {
      id: 'api-connection-mode-settings',
      label: '连接方式',
      type: 'radioGroup',
      configPath: 'config.apiConnectionMode',
      name: 'api-connection-mode',
      options: [
        { value: "direct", text: "直连模式" },
        { value: "proxy", text: "中转代理" }
      ]
    });
    container.appendChild(connectionModeGroup);

    const apiKeyGroup = document.createElement('div');
    apiKeyGroup.className = 'settings-group api-settings';
    const apiKeyGroupsContainer = settingsUiHelpersModule.createSettingItem(apiKeyGroup, {
      id: 'api-key-groups-container',
      type: 'div'
    });
    apiKeyGroupsContainer.addEventListener('input', () => settingsApiModule._collectAndSetApiGroups(apiKeyGroupsContainer));
    apiKeyGroupsContainer.addEventListener('change', () => settingsApiModule._collectAndSetApiGroups(apiKeyGroupsContainer));
    const addApiKeyGroupButton = settingsUiHelpersModule.createSettingItem(apiKeyGroup, {
      id: 'add-api-key-group-button',
      label: '添加密钥组',
      type: 'button',
    });
    addApiKeyGroupButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) {
        settingsApiModule.addApiKeyGroupElement(apiKeyGroupsContainer);
      }
    });
    container.appendChild(apiKeyGroup);

    const proxySettingsGroup = document.createElement('div');
    proxySettingsGroup.className = 'settings-group proxy-settings';
    
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'frontend-proxy-enabled-settings',
      label: '启用前端路径',
      type: 'checkbox',
      configPath: 'config.frontend_proxy_enabled'
    });

    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'use-backup-proxy-only-settings',
      label: '仅使用备用代理 (跳过默认)',
      type: 'checkbox',
      configPath: 'config.useBackupProxyOnly'
    });

    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'proxy-url-settings',
      label: '默认中转代理一 地址',
      type: 'text',
      configPath: 'config.proxy_url',
      placeholder: '例如: http://127.0.0.1:7861'
    });
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'proxy-api-key-settings',
      label: '默认中转代理一 API 密钥',
      type: 'text',
      configPath: 'config.proxy_api_key'
    });
    
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'proxy-url-2-settings',
      label: '默认中转代理二 地址',
      type: 'text',
      configPath: 'config.proxy_url_2',
      placeholder: '例如: http://127.0.0.1:7863'
    });
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'proxy-api-key-2-settings',
      label: '默认中转代理二 API 密钥',
      type: 'text',
      configPath: 'config.proxy_api_key_2'
    });
    
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'backup-proxy-url-settings',
      label: '备用中转代理地址',
      type: 'text',
      configPath: 'config.backup_proxy_url',
      placeholder: '例如: http://127.0.0.1:7862'
    });
    
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, {
      id: 'backup-proxy-api-key-settings',
      label: '备用中转代理 API 密钥',
      type: 'text',
      configPath: 'config.backup_proxy_api_key'
    });
    container.appendChild(proxySettingsGroup);

    const updateVisibility = (mode) => {
        const isProxy = mode === 'proxy';
        apiKeyGroup.style.display = isProxy ? 'none' : 'block';
        proxySettingsGroup.style.display = isProxy ? 'block' : 'none';
    };

    modeRadio.querySelectorAll('input').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) updateVisibility(radio.value);
        });
    });

    setTimeout(() => {
        updateVisibility(stateModule.config.apiConnectionMode || 'direct');
    }, 0);

    const modelSelectionGroup = document.createElement('div');
    modelSelectionGroup.className = 'settings-group api-settings';
    settingsUiHelpersModule.createSettingItem(modelSelectionGroup, {
      id: 'primary-model-select-settings',
      label: '主要模型',
      type: 'select',
      configPath: 'config.primary_model_id',
      options: [{
        value: "",
        text: "请点击 拉取模型列表",
        disabled: true,
        selected: true
      }]
    });
    settingsUiHelpersModule.createSettingItem(modelSelectionGroup, {
      id: 'secondary-model-select-settings',
      label: '辅助模型',
      type: 'select',
      configPath: 'config.secondary_model_id',
      options: [{
        value: "",
        text: "请点击 拉取模型列表",
        disabled: true,
        selected: true
      }]
    });
    settingsUiHelpersModule.createSettingItem(modelSelectionGroup, {
      id: 'tertiary-model-select-settings',
      label: '备用模型',
      type: 'select',
      configPath: 'config.tertiary_model_id',
      options: [{
        value: "",
        text: "请点击 拉取模型列表",
        disabled: true,
        selected: true
      }]
    });
    const fetchModelsButton = settingsUiHelpersModule.createSettingItem(modelSelectionGroup, {
      id: 'fetch-models-button',
      label: '拉取模型列表',
      type: 'button',
    });
    fetchModelsButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) apiClientGeminiModelsModule.fetchModels();
    });
    container.appendChild(modelSelectionGroup);

    const debugSettingsGroup = document.createElement('div');
    debugSettingsGroup.className = 'settings-group debug-settings';
    settingsUiHelpersModule.createSettingItem(debugSettingsGroup, {
      id: 'debug-mode-settings',
      label: '调试模式 (后端打印请求和响应)',
      type: 'checkbox',
      configPath: 'config.debugMode'
    });
    container.appendChild(debugSettingsGroup);

    const sendingSettingsGroup = document.createElement('div');
    sendingSettingsGroup.className = 'settings-group sending-settings';
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, {
      id: 'temperature-settings',
      label: 'Temperature',
      type: 'number',
      configPath: 'config.temperature',
      step: 0.1
    });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, {
      id: 'top-p-settings',
      label: 'Top P',
      type: 'number',
      configPath: 'config.topP',
      step: 0.01
    });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, {
      id: 'top-k-settings',
      label: 'Top K',
      type: 'number',
      configPath: 'config.topK'
    });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, {
      id: 'max-output-tokens-settings',
      label: 'Max Output Tokens',
      type: 'number',
      configPath: 'config.maxOutputTokens'
    });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, {
      id: 'response-mime-type-settings',
      label: 'Response Mime Type',
      type: 'select',
      configPath: 'config.responseMimeType',
      options: [{
        value: "text/plain",
        text: "text/plain"
      }, {
        value: "application/json",
        text: "application/json"
      }]
    });
    container.appendChild(sendingSettingsGroup);
    
    settingsApiModule.loadApiKeysSetting(apiKeyGroupsContainer);
    settingsApiModule.loadModelSelectionSettings();
    settingsApiModule.loadProxySettings();
    settingsApiModule.loadSendingSettings();
    settingsApiModule.loadDebugModeSetting();
  },
  loadApiKeysSetting: (container) => {
    if (!container) container = document.getElementById('api-key-groups-container');
    if (!container) return;
    container.innerHTML = '';
    const groupsTextArray = stateModule.config.apiKeyGroupsText || [];
    if (groupsTextArray.length === 0) {
      settingsApiModule.addApiKeyGroupElement(container);
    } else {
      groupsTextArray.forEach(groupText => {
        settingsApiModule.addApiKeyGroupElement(container, groupText);
      });
    }
  },
  addApiKeyGroupElement: (container, groupText = "") => {
    if (!container) return;
    const groupItem = document.createElement('div');
    groupItem.className = 'api-key-group-item';
    const textarea = document.createElement('textarea');
    textarea.className = 'settings-textarea';
    textarea.value = groupText;
    textarea.placeholder = "第一行: 标识符 (例如 GoogleAccount1)\n后续行: API密钥1\nAPI密钥2\n...";
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-api-key-group-button std-button';
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', () => {
      groupItem.remove();
      settingsApiModule._collectAndSetApiGroups(container);
    });
    groupItem.appendChild(textarea);
    groupItem.appendChild(deleteButton);
    container.appendChild(groupItem);
  },
  _collectAndSetApiGroups: (container) => {
    if (!container) container = document.getElementById('api-key-groups-container');
    if (!container) return;
    const groupTextareas = container.querySelectorAll('.api-key-group-item textarea');
    const groupsTextArray = Array.from(groupTextareas).map(textarea => textarea.value);
    const updates = {
      'apiKeyGroupsText': groupsTextArray
    };
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
      updates
    });
  },
  _populateModelSelect: (selectElement, savedModelId) => {
    if (!selectElement) return;
    const currentOptions = Array.from(selectElement.options).map(opt => opt.value);
    selectElement.innerHTML = '';
    let placeholderSet = false;
    if (stateModule.availableModels.length === 0) {
      if (savedModelId) {
        const savedOption = new Option(`${savedModelId} (Saved)`, savedModelId, true, true);
        selectElement.add(savedOption);
      } else {
        const option = new Option("请点击 拉取模型列表", "", true, true);
        option.disabled = true;
        selectElement.add(option);
      }
      placeholderSet = true;
    } else {
      const placeholder = new Option("选择一个模型", "", true, true);
      placeholder.disabled = true;
      selectElement.add(placeholder);
      stateModule.availableModels.forEach(model => {
        const option = new Option(model.name, model.id);
        selectElement.add(option);
      });
    }
    if (savedModelId && !stateModule.availableModels.some(m => m.id === savedModelId) && !placeholderSet && !currentOptions.includes(savedModelId)) {
      const savedOption = new Option(`${savedModelId} (Saved)`, savedModelId, false, false);
      selectElement.add(savedOption, 1);
      selectElement.value = savedModelId;
    } else if (savedModelId) {
      selectElement.value = savedModelId;
    } else if (selectElement.options.length > 0 && !savedModelId) {
      selectElement.selectedIndex = 0;
    }
  },
  loadModelSelectionSettings: () => {
    const primarySelect = document.getElementById('primary-model-select-settings');
    const secondarySelect = document.getElementById('secondary-model-select-settings');
    const tertiarySelect = document.getElementById('tertiary-model-select-settings');
    settingsApiModule._populateModelSelect(primarySelect, stateModule.config.primary_model_id);
    settingsApiModule._populateModelSelect(secondarySelect, stateModule.config.secondary_model_id);
    settingsApiModule._populateModelSelect(tertiarySelect, stateModule.config.tertiary_model_id);
  },
  loadProxySettings: (container) => {
    const modeRadio = document.getElementById('api-connection-mode-settings');
    const frontendProxyEnabledCheckbox = document.getElementById('frontend-proxy-enabled-settings');
    const useBackupProxyOnlyCheckbox = document.getElementById('use-backup-proxy-only-settings');
    const proxyUrlInput = document.getElementById('proxy-url-settings');
    const proxyApiKeyInput = document.getElementById('proxy-api-key-settings');
    const proxyUrlInput2 = document.getElementById('proxy-url-2-settings');
    const proxyApiKeyInput2 = document.getElementById('proxy-api-key-2-settings');
    const backupProxyUrlInput = document.getElementById('backup-proxy-url-settings');
    const backupProxyApiKeyInput = document.getElementById('backup-proxy-api-key-settings');
    
    if (modeRadio) settingsUiHelpersModule.loadDynamicSetting(modeRadio, 'config.apiConnectionMode', true);
    if (frontendProxyEnabledCheckbox) settingsUiHelpersModule.loadDynamicSetting(frontendProxyEnabledCheckbox, 'config.frontend_proxy_enabled');
    if (useBackupProxyOnlyCheckbox) settingsUiHelpersModule.loadDynamicSetting(useBackupProxyOnlyCheckbox, 'config.useBackupProxyOnly');
    if (proxyUrlInput) settingsUiHelpersModule.loadDynamicSetting(proxyUrlInput, 'config.proxy_url');
    if (proxyApiKeyInput) settingsUiHelpersModule.loadDynamicSetting(proxyApiKeyInput, 'config.proxy_api_key');
    if (proxyUrlInput2) settingsUiHelpersModule.loadDynamicSetting(proxyUrlInput2, 'config.proxy_url_2');
    if (proxyApiKeyInput2) settingsUiHelpersModule.loadDynamicSetting(proxyApiKeyInput2, 'config.proxy_api_key_2');
    if (backupProxyUrlInput) settingsUiHelpersModule.loadDynamicSetting(backupProxyUrlInput, 'config.backup_proxy_url');
    if (backupProxyApiKeyInput) settingsUiHelpersModule.loadDynamicSetting(backupProxyApiKeyInput, 'config.backup_proxy_api_key');
  },
  loadSendingSettings: (container) => {
    const keys = ['temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType'];
    keys.forEach(key => {
      const elementId = `${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}-settings`;
      const el = document.getElementById(elementId);
      if (el) {
        settingsUiHelpersModule.loadDynamicSetting(el, `config.${key}`);
      }
    });
  },
  loadDebugModeSetting: (container) => {
    const debugModeCheckbox = document.getElementById('debug-mode-settings');
    if (debugModeCheckbox) settingsUiHelpersModule.loadDynamicSetting(debugModeCheckbox, 'config.debugMode');
  },
};