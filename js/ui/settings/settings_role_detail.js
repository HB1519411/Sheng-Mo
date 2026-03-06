const settingsRoleDetailModule = {
  init: () => {
    elementsModule.roleDrawingTemplateSettings.addEventListener('change', (e) => {
      const roleName = stateModule.currentRole;
      const newValue = e.target.value;
      const chatroomName = stateModule.currentChatroomDetails.config.name;
      const roleData = stateModule.currentChatroomDetails.roles.find(r => r.name === roleName);
      if (roleData && roleData.drawingTemplate !== newValue) {
        transactionManagerModule.dispatch('UPDATE_ROLE_FIELDS', {
          chatroomName: chatroomName,
          roleName: roleName,
          updates: {
            drawingTemplate: newValue
          }
        });
      }
    });
    elementsModule.exportRoleButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsRoleDetailModule.exportRoleFromSettings();
    });
    elementsModule.editRoleSettingButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-setting-detail-page', stateModule.currentRole);
    });
    elementsModule.editRoleMemoryButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-memory-list-page', stateModule.currentRole);
    });
    elementsModule.editRolePublicInfoButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-public-info-list-page', stateModule.currentRole);
    });
  },
  showRoleDetailPage: (roleName) => {
    stateModule.currentRole = roleName;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);
    const isPermanentDefinedRole = !!roleData;
    const displayName = uiChatUtilsModule.getDisplayName(roleName, stateModule.activePartitionId);
    elementsModule.roleDetailHeaderTitle.textContent = `角色详情 - ${displayName}`;

    if (isPermanentDefinedRole) {
      elementsModule.roleDrawingTemplateSettings.value = roleData.drawingTemplate || '';
    } else {
      elementsModule.roleDrawingTemplateSettings.value = '[非永久定义角色无全局模板]';
    }
    
    const isReadOnly = !isPermanentDefinedRole || roleName === "用户";

    elementsModule.roleDrawingTemplateSettings.readOnly = isReadOnly;
    elementsModule.roleDrawingTemplateSettings.style.cursor = isReadOnly ? 'not-allowed' : 'auto';
    elementsModule.roleDrawingTemplateSettings.style.opacity = isReadOnly ? 0.7 : 1;

    let wrapper = document.getElementById('role-drawing-enabled-wrapper');
    if (wrapper) wrapper.remove();
    
    elementsModule.editRoleSettingButton.style.display = isReadOnly ? 'none' : 'block';
    elementsModule.editRoleMemoryButton.style.display = isReadOnly ? 'none' : 'block';
    elementsModule.editRolePublicInfoButton.style.display = isReadOnly ? 'none' : 'block';
    
    if (!isReadOnly) {
        const container = elementsModule.exportRoleButton.parentElement;
        const checkboxElement = settingsUiHelpersModule.createSettingItem(
            container, {
                id: 'role-drawing-enabled-settings',
                label: '启用绘图',
                type: 'checkbox',
                configPath: `currentChatroomDetails.roles[${chatroomDetails.roles.indexOf(roleData)}].isDrawingEnabled`
            }
        );
        checkboxElement.parentElement.id = 'role-drawing-enabled-wrapper';
        settingsUiHelpersModule.loadDynamicSetting(checkboxElement, checkboxElement.dataset.configPath);
        container.insertBefore(checkboxElement.parentElement, elementsModule.exportRoleButton);
    }
    elementsModule.exportRoleButton.style.display = isReadOnly ? 'none' : 'block';
  },

  exportRoleFromSettings: () => {
    const roleName = stateModule.currentRole;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);

    const blob = new Blob([JSON.stringify(roleData, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roleName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};