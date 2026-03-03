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
    const apiGroup = settingsUiHelpersModule.createSettingItem(container, {
      id: 'novelai-api-group',
      type: 'div'
    });
    apiGroup.classList.add('settings-group', 'novelai-api');

    const sourceRadio = settingsUiHelpersModule.createSettingItem(apiGroup, {
      id: 'novelai-api-source-settings',
      label: 'API 源',
      type: 'radioGroup',
      configPath: 'config.novelaiApiSource',
      name: 'novelai-api-source',
      options: [
        { value: "official", text: "官方 API" },
        { value: "proxy", text: "中转 API" }
      ]
    });

    const apiKeyInput = settingsUiHelpersModule.createSettingItem(apiGroup, {
      id: 'novelai-api-key-settings',
      label: 'NovelAI API Key (官方)',
      type: 'text',
      configPath: 'config.novelaiApiKey'
    });

    const proxyUrlInput = settingsUiHelpersModule.createSettingItem(apiGroup, {
      id: 'novelai-proxy-url-settings',
      label: '中转地址',
      type: 'text',
      configPath: 'config.novelaiProxyUrl'
    });

    const proxyTokenInput = settingsUiHelpersModule.createSettingItem(apiGroup, {
      id: 'novelai-proxy-token-settings',
      label: '中转 Token',
      type: 'text',
      configPath: 'config.novelaiProxyToken'
    });

    const updateVisibility = (source) => {
        if (source === 'official') {
            if(apiKeyInput) apiKeyInput.parentElement.style.display = 'block';
            if(proxyUrlInput) proxyUrlInput.parentElement.style.display = 'none';
            if(proxyTokenInput) proxyTokenInput.parentElement.style.display = 'none';
        } else {
            if(apiKeyInput) apiKeyInput.parentElement.style.display = 'none';
            if(proxyUrlInput) proxyUrlInput.parentElement.style.display = 'block';
            if(proxyTokenInput) proxyTokenInput.parentElement.style.display = 'block';
        }
    };

    sourceRadio.querySelectorAll('input').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) updateVisibility(radio.value);
        });
    });
    
    // Initial visibility check
    setTimeout(() => {
        updateVisibility(stateModule.config.novelaiApiSource || 'official');
    }, 0);

    const mappingsGroup = settingsUiHelpersModule.createSettingItem(container, {
        id: 'novelai-mappings-group',
        type: 'div'
    });
    mappingsGroup.classList.add('settings-group', 'novelai-mappings');

    settingsUiHelpersModule.createTagInput(mappingsGroup, {
        label: '模板映射 (格式: 中文[英文])',
        containerId: 'novelai-template-mappings-container',
        inputId: 'novelai-template-mappings-input',
        addButtonId: 'add-novelai-template-mapping-button',
        configPath: 'config.novelaiTemplateMappings',
        type: 'novelaiTemplateMappings'
    });

    settingsNovelaiModule.updateMappingsList();

    const promptsGroup = settingsUiHelpersModule.createSettingItem(container, {
      id: 'novelai-prompts-group',
      type: 'div'
    });
    promptsGroup.classList.add('settings-group', 'novelai-prompts');
    settingsUiHelpersModule.createSettingItem(promptsGroup, {
      id: 'novelai-artist-chain-settings',
      label: '艺术家链',
      type: 'text',
      configPath: 'config.novelaiArtistChain',
      autocomplete: 'off'
    });
    settingsUiHelpersModule.createSettingItem(promptsGroup, {
      id: 'novelai-default-positive-prompt-settings',
      label: '默认正面提示词',
      type: 'textarea',
      rows: 4,
      configPath: 'config.novelaiDefaultPositivePrompt'
    });
    settingsUiHelpersModule.createSettingItem(promptsGroup, {
      id: 'novelai-default-negative-prompt-settings',
      label: '默认负面提示词',
      type: 'textarea',
      rows: 4,
      configPath: 'config.novelaiDefaultNegativePrompt'
    });
    settingsUiHelpersModule.createSettingItem(promptsGroup, {
      id: 'novelai-last-prompt-display',
      label: '上次发送的主要绘图提示词',
      type: 'textarea',
      rows: 4,
      readonly: true
    });
    const paramsGroup = settingsUiHelpersModule.createSettingItem(container, {
      id: 'novelai-params-group',
      type: 'div'
    });
    paramsGroup.classList.add('settings-group', 'novelai-params');
    const paramItems = [{
      id: 'novelai-scale-settings',
      label: '引导系数 (Scale)',
      type: 'number',
      configPath: 'config.novelaiScale',
      step: 0.1
    }, {
      id: 'novelai-cfg-rescale-settings',
      label: 'CFG 重调 (CFG Rescale / cfg)',
      type: 'number',
      configPath: 'config.novelaiCfgRescale',
      step: 0.01
    }, {
      id: 'novelai-sampler-settings',
      label: '采样器 (Sampler)',
      type: 'select',
      configPath: 'config.novelaiSampler',
      options: ["k_euler", "k_euler_ancestral", "k_dpmpp_2s_ancestral", "k_dpmpp_2m", "k_dpm_2", "ddim_v3"]
    }, {
      id: 'novelai-noise-schedule-settings',
      label: '噪点调度 (Noise Schedule)',
      type: 'select',
      configPath: 'config.novelaiNoiseSchedule',
      options: ["native", "karras", "exponential", "polyexponential"]
    }];
    paramItems.forEach(item => settingsUiHelpersModule.createSettingItem(paramsGroup, item));
    settingsNovelaiModule.loadNovelAiSettings();
  },
  loadNovelAiSettings: () => {
    const idsToConfigKeys = {
      "novelai-api-source-settings": "novelaiApiSource",
      "novelai-api-key-settings": "novelaiApiKey",
      "novelai-proxy-url-settings": "novelaiProxyUrl",
      "novelai-proxy-token-settings": "novelaiProxyToken",
      "novelai-artist-chain-settings": "novelaiArtistChain",
      "novelai-default-positive-prompt-settings": "novelaiDefaultPositivePrompt",
      "novelai-default-negative-prompt-settings": "novelaiDefaultNegativePrompt",
      "novelai-scale-settings": "novelaiScale",
      "novelai-cfg-rescale-settings": "novelaiCfgRescale",
      "novelai-sampler-settings": "novelaiSampler",
      "novelai-noise-schedule-settings": "novelaiNoiseSchedule"
    };
    for (const id in idsToConfigKeys) {
      const element = document.getElementById(id);
      const configKey = idsToConfigKeys[id];
      if (element && configKey) {
        if (id === 'novelai-api-source-settings') {
            settingsUiHelpersModule.loadDynamicSetting(element, `config.${configKey}`, true);
        } else {
            settingsUiHelpersModule.loadDynamicSetting(element, `config.${configKey}`);
        }
      }
    }
    settingsNovelaiModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
  },
  updateLastNaiPromptDisplay: (promptText) => {
    const displayElement = document.getElementById('novelai-last-prompt-display');
    if (displayElement) {
      displayElement.value = promptText || "";
      displayElement.scrollTop = 0;
    }
  },
  updateMappingsList: () => {
    const container = document.getElementById('novelai-template-mappings-container');
    if (container) {
        const currentMappings = stateModule.config.novelaiTemplateMappings || [];
        settingsUiHelpersModule.renderTagList(
            container,
            currentMappings,
            'novelaiTemplateMappings',
            'config.novelaiTemplateMappings'
        );
    }
  }
};