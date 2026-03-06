const settingsApiModule = {
  init: () => {
    eventBus.on('API_GROUP_STATS_UPDATED', (stats) => {
      document.querySelectorAll('.api-key-group-item').forEach(item => {
        const lines = item.querySelector('textarea').value.split('\n').map(l => l.trim()).filter(Boolean);
        const statsDisplay = item.querySelector('.fail-stats-display');
        if (lines.length && stats[lines[0]] !== undefined) {
          statsDisplay.textContent = `连续失败: ${stats[lines[0]]} 次`;
        }
      });
    });
  },

  renderApiSettingsPage: (container) => {
    container.innerHTML = '';

    const rateLimitGroup = document.createElement('div');
    rateLimitGroup.className = 'settings-group rate-limit-settings';
    settingsUiHelpersModule.createSettingItem(rateLimitGroup, {
      id: 'rate-limit-settings', label: '默认频率限制 (次/分钟)', type: 'number', configPath: 'config.rateLimitPerMinute', min: 1
    });
    container.appendChild(rateLimitGroup);

    const apiKeyGroup = document.createElement('div');
    apiKeyGroup.className = 'settings-group api-settings';
    const apiKeyGroupsContainer = settingsUiHelpersModule.createSettingItem(apiKeyGroup, { id: 'api-key-groups-container', type: 'div' });
    apiKeyGroupsContainer.addEventListener('change', () => settingsApiModule._collectAndSetApiGroups(apiKeyGroupsContainer));
    
    settingsUiHelpersModule.createSettingItem(apiKeyGroup, { id: 'add-api-key-group-button', label: '添加密钥组通道', type: 'button' })
      .addEventListener('click', () => !stateModule.isCooldownActive && settingsApiModule.addApiKeyGroupElement(apiKeyGroupsContainer));
    container.appendChild(apiKeyGroup);

    const proxySettingsGroup = document.createElement('div');
    proxySettingsGroup.className = 'settings-group proxy-settings';
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, { id: 'frontend-proxy-enabled-settings', label: '启用前端路径 (请求由浏览器发出)', type: 'checkbox', configPath: 'config.frontend_proxy_enabled' });
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, { id: 'use-backup-proxy-only-settings', label: '仅使用备用代理 (跳过全部密钥组)', type: 'checkbox', configPath: 'config.useBackupProxyOnly' });
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, { id: 'backup-proxy-url-settings', label: '备用兜底代理地址', type: 'text', configPath: 'config.backup_proxy_url', placeholder: '例如: http://127.0.0.1:7862' });
    settingsUiHelpersModule.createSettingItem(proxySettingsGroup, { id: 'backup-proxy-api-key-settings', label: '备用代理 API 密钥', type: 'text', configPath: 'config.backup_proxy_api_key' });
    container.appendChild(proxySettingsGroup);

    if (!document.getElementById('available-models-list')) {
      const datalist = document.createElement('datalist');
      datalist.id = 'available-models-list';
      document.body.appendChild(datalist);
    }

    const modelSelectionGroup = document.createElement('div');
    modelSelectionGroup.className = 'settings-group api-settings';
    ['primary', 'secondary', 'tertiary'].forEach(level => {
      const input = settingsUiHelpersModule.createSettingItem(modelSelectionGroup, {
        id: `${level}-model-select-settings`, label: `${level === 'primary' ? '主要' : level === 'secondary' ? '辅助' : '备用'}模型`,
        type: 'text', configPath: `config.${level}_model_id`, placeholder: '选择或输入模型名称...'
      });
      input.setAttribute('list', 'available-models-list');
    });
    
    settingsUiHelpersModule.createSettingItem(modelSelectionGroup, { id: 'fetch-models-button', label: '从第一组密钥拉取模型列表', type: 'button' })
      .addEventListener('click', () => !stateModule.isCooldownActive && apiClientGeminiModelsModule.fetchModels());
    container.appendChild(modelSelectionGroup);

    const debugSettingsGroup = document.createElement('div');
    debugSettingsGroup.className = 'settings-group debug-settings';
    settingsUiHelpersModule.createSettingItem(debugSettingsGroup, { id: 'debug-mode-settings', label: '调试模式 (后端打印请求和响应)', type: 'checkbox', configPath: 'config.debugMode' });
    container.appendChild(debugSettingsGroup);

    const sendingSettingsGroup = document.createElement('div');
    sendingSettingsGroup.className = 'settings-group sending-settings';
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, { id: 'temperature-settings', label: 'Temperature', type: 'number', configPath: 'config.temperature', step: 0.1 });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, { id: 'top-p-settings', label: 'Top P', type: 'number', configPath: 'config.topP', step: 0.01 });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, { id: 'top-k-settings', label: 'Top K', type: 'number', configPath: 'config.topK' });
    settingsUiHelpersModule.createSettingItem(sendingSettingsGroup, { id: 'max-output-tokens-settings', label: 'Max Output Tokens', type: 'number', configPath: 'config.maxOutputTokens' });
    container.appendChild(sendingSettingsGroup);
    
    settingsApiModule.loadApiKeysSetting(apiKeyGroupsContainer);
    settingsApiModule.loadModelSelectionSettings();
    settingsApiModule.loadProxySettings();
    settingsApiModule.loadSendingSettings();
    settingsUiHelpersModule.loadDynamicSetting(document.getElementById('debug-mode-settings'), 'config.debugMode');
    settingsUiHelpersModule.loadDynamicSetting(document.getElementById('rate-limit-settings'), 'config.rateLimitPerMinute');
  },

  loadApiKeysSetting: (container) => {
    container.innerHTML = '';
    const groups = stateModule.config.apiKeyGroupsText;
    (groups.length ? groups : [""]).forEach(text => settingsApiModule.addApiKeyGroupElement(container, text));
  },

  addApiKeyGroupElement: (container, groupText = "") => {
    const groupItem = document.createElement('div');
    groupItem.className = 'api-key-group-item';
    
    const statsDisplay = document.createElement('div');
    statsDisplay.className = 'fail-stats-display';
    statsDisplay.style.cssText = 'color: #d99; font-size: 0.85em; margin-bottom: 5px; font-weight: bold;';
    statsDisplay.textContent = '连续失败: 0 次';
    groupItem.appendChild(statsDisplay);
    
    const textarea = document.createElement('textarea');
    textarea.className = 'settings-textarea';
    textarea.value = groupText;
    textarea.placeholder = "第一行: 标识符 (如 Google-1)\n第二行: API类型 (gemini/openai/claude/deepseek)\n第三行: 地址 (填写'官方'或具体中转URL)\n第四行: API密钥";
    
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
    const groupsTextArray = Array.from(container.querySelectorAll('.api-key-group-item textarea')).map(t => t.value);
    transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { 'apiKeyGroupsText': groupsTextArray } });
  },

  loadModelSelectionSettings: () => {
    ['primary', 'secondary', 'tertiary'].forEach(l => 
      settingsUiHelpersModule.loadDynamicSetting(document.getElementById(`${l}-model-select-settings`), `config.${l}_model_id`)
    );
  },

  loadProxySettings: () => {
    ['frontend-proxy-enabled-settings', 'use-backup-proxy-only-settings', 'backup-proxy-url-settings', 'backup-proxy-api-key-settings'].forEach(id => {
      const key = id.replace(/-/g, '_').replace('_settings', '');
      settingsUiHelpersModule.loadDynamicSetting(document.getElementById(id), `config.${key}`);
    });
  },

  loadSendingSettings: () => {
    ['temperature', 'topP', 'topK', 'maxOutputTokens'].forEach(key => 
      settingsUiHelpersModule.loadDynamicSetting(document.getElementById(`${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}-settings`), `config.${key}`)
    );
  }
};