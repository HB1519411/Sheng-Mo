const apiClientGeminiModelsModule = {
  fetchModels: async () => {
    const setAllOptionsPlaceholder = (message, isError = false) => {
      const allSelects = document.querySelectorAll('.settings-select[id*="-model-"]');
      allSelects.forEach(selectElement => {
        if (selectElement.id !== 'novelai-model-settings') {
          selectElement.style.borderColor = isError ? 'red' : '';
          const placeholderOption = selectElement.querySelector('option[value=""][disabled]');
          if (placeholderOption) {
            placeholderOption.textContent = message;
          } else {
            const option = new Option(message, "", true, true);
            option.disabled = true;
            selectElement.prepend(option);
            if (selectElement.value === "") selectElement.selectedIndex = 0;
          }
        }
      });
    };
    setAllOptionsPlaceholder('正在拉取...');
    const apiKeyGroups = stateModule.config.apiKeyGroupsText || [];
    if (apiKeyGroups.length === 0 || apiKeyGroups.every(g => g.trim().split('\n').slice(1).every(k => !k.trim()))) {
      _logAndDisplayError("No API keys configured in any group, cannot load model list.", 'apiClientGeminiModelsModule.fetchModels');
      setAllOptionsPlaceholder('无API密钥', true);
      alert('请先在API设置中配置至少一个API密钥！');
      return;
    }

    const firstKey = apiKeyGroups.flatMap(g => g.trim().split('\n').slice(1).filter(k => k.trim()))[0];
    if (!firstKey) {
      _logAndDisplayError("No valid API key found to fetch model list.", 'apiClientGeminiModelsModule.fetchModels');
      setAllOptionsPlaceholder('无有效API密钥', true);
      alert('未找到有效的API密钥来获取模型列表。');
      return;
    }

    const responseData = await apiServiceModule.performApiCall(`/models?key=${firstKey}`, 'GET');

    if (responseData.success && responseData.data && responseData.data.models && Array.isArray(responseData.data.models)) {
      const loadedModels = [];
      responseData.data.models.forEach(model => {
        if (model.name && model.supportedGenerationMethods?.includes('generateContent')) {
          const modelId = model.name.startsWith('models/') ? model.name.substring(7) : model.name;
          loadedModels.push({
            id: modelId,
            name: model.displayName || modelId
          });
        }
      });
      loadedModels.sort((a, b) => a.name.localeCompare(b.name));
      stateModule.availableModels = loadedModels;

      const allSelects = document.querySelectorAll('select[id*="-model-"], select[id*="-model-select"]');
      allSelects.forEach(selectElement => {
        if (selectElement.id !== 'novelai-model-settings') {
          const currentValue = selectElement.value;
          const existingOptions = Array.from(selectElement.options);
          selectElement.innerHTML = '';
          selectElement.style.borderColor = '';
          let currentValueFoundInNewList = false;
          stateModule.availableModels.forEach(model => {
            const option = new Option(model.name, model.id);
            selectElement.add(option);
            if (model.id === currentValue) {
              currentValueFoundInNewList = true;
            }
          });
          if (currentValue && !currentValueFoundInNewList) {
            const oldOptionData = existingOptions.find(opt => opt.value === currentValue);
            const optionText = oldOptionData ? oldOptionData.text : `(旧) ${currentValue}`;
            const option = new Option(optionText, currentValue);
            selectElement.add(option, 0);
          }
          selectElement.value = currentValue;
          if (selectElement.options.length === 0) {
            selectElement.innerHTML = '<option value="" disabled selected>无可用模型</option>';
          } else if (selectElement.value !== currentValue) {
            selectElement.value = "";
            const placeholderOption = new Option("请选择模型", "", true, true);
            placeholderOption.disabled = true;
            selectElement.prepend(placeholderOption);
          }
        }
      });
      alert('模型列表拉取成功！');
    } else {
      const errorMsg = responseData.error?.message || "Invalid model list response format";
      _logAndDisplayError(`Failed to load model list. Error: ${errorMsg}`, 'apiClientGeminiModelsModule.fetchModels');
      setAllOptionsPlaceholder('拉取失败', true);
      alert(`拉取模型列表失败！\n${errorMsg}`);
    }
  },
};