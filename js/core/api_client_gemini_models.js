const apiClientGeminiModelsModule = {
  fetchModels: async () => {
    const apiKeyGroups = stateModule.config.apiKeyGroupsText || [];
    if (apiKeyGroups.length === 0 || apiKeyGroups.every(g => g.trim().split('\n').length < 4)) {
      alert('请先在API设置中配置至少一个有效的密钥组！');
      return;
    }

    let apiType = 'gemini';
    let address = '官方';
    let firstKey = null;
    
    for (const groupText of apiKeyGroups) {
        const lines = groupText.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 4) {
            apiType = lines[1].toLowerCase();
            address = lines[2];
            firstKey = lines[3];
            break;
        }
    }

    const url = `/models?key=${encodeURIComponent(firstKey)}&type=${encodeURIComponent(apiType)}&address=${encodeURIComponent(address)}`;
    const responseData = await apiServiceModule.performApiCall(url, 'GET');

    const loadedModels = responseData.data.models.map(m => ({
        id: m.id,
        name: m.name || m.id
    }));
    
    loadedModels.sort((a, b) => a.name.localeCompare(b.name));
    stateModule.availableModels = loadedModels;

    let datalist = document.getElementById('available-models-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'available-models-list';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = '';
    stateModule.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        datalist.appendChild(option);
    });

    alert('模型列表拉取成功并已更新下拉候选项！');
  },
};