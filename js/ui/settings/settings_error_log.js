const settingsErrorLogModule = {
  init: () => {
    elementsModule.copyErrorLogButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsErrorLogModule.copyErrorLog();
    });
    elementsModule.clearAllConfigButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsErrorLogModule.clearAllConfiguration();
    });
    elementsModule.exportConfigButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) window.location.href = '/export-full-config-zip';
    });
    elementsModule.importConfigButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) elementsModule.importConfigFile.click();
    });
    elementsModule.importConfigFile.addEventListener('change', settingsErrorLogModule.handleImportConfig);
  },

  copyErrorLog: () => {
    const logContent = elementsModule.errorLogDisplay?.value;
    if (logContent && navigator.clipboard) {
      navigator.clipboard.writeText(logContent).then(() => {}).catch(err => {
        _logAndDisplayError(`Failed to copy error log: ${err}`, 'settingsErrorLogModule.copyErrorLog');
        alert('Failed to copy error log. See console.');
      });
    } else if (!logContent) {
      _logAndDisplayError('Error log is empty, nothing to copy.', 'settingsErrorLogModule.copyErrorLog');
    } else {
      _logAndDisplayError('Clipboard API not available.', 'settingsErrorLogModule.copyErrorLog');
      alert('Clipboard API not available in this browser.');
    }
  },

  clearAllConfiguration: async () => {
    if (!confirm("警告：此操作将删除所有配置、聊天室和历史记录，且无法恢复！确定要继续吗？")) {
      return;
    }
    const result = await apiServiceModule.performApiCall('/clear-all-config', 'POST');
    if (result.success) {
      alert(result.message || "All configuration cleared successfully!");
      if (result.data) {
        stateManager.commit('SET_INITIAL_DATA', result.data);
      }
      window.location.reload();
    } else {
      _logAndDisplayError(`清除全部配置失败: ${result.error?.message}`, 'settingsErrorLogModule.clearAllConfiguration');
      alert(`清除全部配置失败: ${result.error?.message}`);
    }
  },

  handleImportConfig: async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      _logAndDisplayError('请选择一个 .zip 文件进行导入。', 'settingsErrorLogModule.handleImportConfig');
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
      _logAndDisplayError(`导入配置失败: ${result.error?.message}`, 'settingsErrorLogModule.handleImportConfig');
      alert(`导入配置失败: ${result.error?.message}`);
    }
    event.target.value = null;
  }
};