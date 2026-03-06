const settingsNovelaiModule = {
  init: () => {
    eventBus.on('UI_UPDATE_GLOBAL', () => {
        if (stateModule.activeSettingPage === 'novelai-settings-page') {
            settingsNovelaiModule.updateMappingsList();
        }
    });
  },
  renderNovelAiSettingsPage: (container) => {
    container.innerHTML = '';
    const apiGroup = settingsUiHelpersModule.createSettingItem(container, { id: 'novelai-api-group', type: 'div' });
    apiGroup.classList.add('settings-group', 'novelai-api');

    const sourceRadio = settingsUiHelpersModule.createSettingItem(apiGroup, {
      id: 'novelai-api-source-settings', label: 'API 源', type: 'radioGroup', configPath: 'config.novelaiApiSource',
      name: 'novelai-api-source', options: [{ value: "official", text: "官方 API" }, { value: "proxy", text: "中转 API" }]
    });

    const inputs = {
      'novelai-api-key-settings': settingsUiHelpersModule.createSettingItem(apiGroup, { id: 'novelai-api-key-settings', label: 'NovelAI API Key', type: 'text', configPath: 'config.novelaiApiKey' }),
      'novelai-proxy-url-settings': settingsUiHelpersModule.createSettingItem(apiGroup, { id: 'novelai-proxy-url-settings', label: '中转地址', type: 'text', configPath: 'config.novelaiProxyUrl' }),
      'novelai-proxy-token-settings': settingsUiHelpersModule.createSettingItem(apiGroup, { id: 'novelai-proxy-token-settings', label: '中转 Token', type: 'text', configPath: 'config.novelaiProxyToken' })
    };

    const updateVis = (src) => {
        inputs['novelai-api-key-settings'].parentElement.style.display = src === 'official' ? 'block' : 'none';
        inputs['novelai-proxy-url-settings'].parentElement.style.display = src === 'official' ? 'none' : 'block';
        inputs['novelai-proxy-token-settings'].parentElement.style.display = src === 'official' ? 'none' : 'block';
    };

    sourceRadio.querySelectorAll('input').forEach(r => r.addEventListener('change', () => r.checked && updateVis(r.value)));
    setTimeout(() => updateVis(stateModule.config.novelaiApiSource), 0);

    const mappingsGroup = settingsUiHelpersModule.createSettingItem(container, { id: 'novelai-mappings-group', type: 'div' });
    mappingsGroup.classList.add('settings-group', 'novelai-mappings');
    settingsUiHelpersModule.createTagInput(mappingsGroup, {
        label: '模板映射 (格式: 中文[英文])', containerId: 'novelai-template-mappings-container',
        inputId: 'novelai-template-mappings-input', addButtonId: 'add-novelai-template-mapping-button',
        configPath: 'config.novelaiTemplateMappings', type: 'novelaiTemplateMappings'
    });
    settingsNovelaiModule.updateMappingsList();

    const promptsGroup = settingsUiHelpersModule.createSettingItem(container, { id: 'novelai-prompts-group', type: 'div' });
    promptsGroup.classList.add('settings-group', 'novelai-prompts');
    [
      { id: 'novelai-artist-chain-settings', label: '艺术家链', type: 'text', configPath: 'config.novelaiArtistChain' },
      { id: 'novelai-default-positive-prompt-settings', label: '默认正面提示词', type: 'textarea', rows: 4, configPath: 'config.novelaiDefaultPositivePrompt' },
      { id: 'novelai-default-negative-prompt-settings', label: '默认负面提示词', type: 'textarea', rows: 4, configPath: 'config.novelaiDefaultNegativePrompt' },
      { id: 'novelai-last-prompt-display', label: '上次发送的提示词', type: 'textarea', rows: 4, readonly: true }
    ].forEach(i => settingsUiHelpersModule.createSettingItem(promptsGroup, i));

    const paramsGroup = settingsUiHelpersModule.createSettingItem(container, { id: 'novelai-params-group', type: 'div' });
    paramsGroup.classList.add('settings-group', 'novelai-params');
    [
      { id: 'novelai-scale-settings', label: 'Scale', type: 'number', configPath: 'config.novelaiScale', step: 0.1 },
      { id: 'novelai-cfg-rescale-settings', label: 'CFG Rescale', type: 'number', configPath: 'config.novelaiCfgRescale', step: 0.01 },
      { id: 'novelai-sampler-settings', label: 'Sampler', type: 'select', configPath: 'config.novelaiSampler', options: ["k_euler", "k_euler_ancestral", "k_dpmpp_2s_ancestral", "k_dpmpp_2m", "k_dpm_2", "ddim_v3"] },
      { id: 'novelai-noise-schedule-settings', label: 'Noise Schedule', type: 'select', configPath: 'config.novelaiNoiseSchedule', options: ["native", "karras", "exponential", "polyexponential"] }
    ].forEach(i => settingsUiHelpersModule.createSettingItem(paramsGroup, i));

    settingsNovelaiModule.loadNovelAiSettings();
  },

  loadNovelAiSettings: () => {
    const map = {
      "novelai-api-source-settings": "novelaiApiSource", "novelai-api-key-settings": "novelaiApiKey",
      "novelai-proxy-url-settings": "novelaiProxyUrl", "novelai-proxy-token-settings": "novelaiProxyToken",
      "novelai-artist-chain-settings": "novelaiArtistChain", "novelai-default-positive-prompt-settings": "novelaiDefaultPositivePrompt",
      "novelai-default-negative-prompt-settings": "novelaiDefaultNegativePrompt", "novelai-scale-settings": "novelaiScale",
      "novelai-cfg-rescale-settings": "novelaiCfgRescale", "novelai-sampler-settings": "novelaiSampler", "novelai-noise-schedule-settings": "novelaiNoiseSchedule"
    };
    Object.entries(map).forEach(([id, key]) => {
      settingsUiHelpersModule.loadDynamicSetting(document.getElementById(id), `config.${key}`, id === 'novelai-api-source-settings');
    });
    settingsNovelaiModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
  },

  updateLastNaiPromptDisplay: (promptText) => {
    const el = document.getElementById('novelai-last-prompt-display');
    el.value = promptText;
    el.scrollTop = 0;
  },

  updateMappingsList: () => {
    settingsUiHelpersModule.renderTagList(document.getElementById('novelai-template-mappings-container'), stateModule.config.novelaiTemplateMappings, 'novelaiTemplateMappings', 'config.novelaiTemplateMappings');
  }
};