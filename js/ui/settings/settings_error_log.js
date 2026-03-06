const settingsErrorLogModule = {
  init: () => {
    elementsModule.copyErrorLogButton.addEventListener('click', () => !stateModule.isCooldownActive && settingsErrorLogModule.copyErrorLog());
    elementsModule.clearAllConfigButton.addEventListener('click', () => !stateModule.isCooldownActive && settingsErrorLogModule.clearAllConfiguration());
    elementsModule.exportConfigButton.addEventListener('click', () => !stateModule.isCooldownActive && (window.location.href = '/export-full-config-zip'));
    elementsModule.importConfigButton.addEventListener('click', () => !stateModule.isCooldownActive && elementsModule.importConfigFile.click());
    elementsModule.importConfigFile.addEventListener('change', settingsErrorLogModule.handleImportConfig);
  },

  copyErrorLog: () => {
    const logContent = elementsModule.errorLogDisplay.value;
    navigator.clipboard.writeText(logContent).catch(err => alert('复制失败，请手动复制。'));
  },

  clearAllConfiguration: async () => {
    if (!confirm("警告：此操作将删除所有配置、聊天室和历史记录，且无法恢复！确定要继续吗？")) return;
    const result = await apiServiceModule.performApiCall('/clear-all-config', 'POST');
    if (result.success) {
      alert(result.message || "配置已清空！");
      if (result.data) stateManager.commit('SET_INITIAL_DATA', result.data);
      window.location.reload();
    } else {
      alert(`清除失败: ${result.error?.message}`);
    }
  },

  handleImportConfig: async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
      alert('请选择一个 .zip 文件进行导入。');
      event.target.value = null;
      return;
    }
    const formData = new FormData();
    formData.append('config_zip', file);
    const result = await apiServiceModule.performApiCall('/import-full-config-zip', 'POST', formData, {}, null, true);
    if (result.success) {
      alert(result.message || "配置导入成功！");
      await apiClientConfigModule.loadInitialData();
    } else {
      alert(`导入失败: ${result.error?.message}`);
    }
    event.target.value = null;
  }
};