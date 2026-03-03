const settingsRoleDetailModule = {
  init: () => {
    if (elementsModule.roleDrawingTemplateSettings) {
      elementsModule.roleDrawingTemplateSettings.addEventListener('change', (e) => {
        const roleName = stateModule.currentRole;
        const newValue = e.target.value;
        const chatroomName = stateModule.currentChatroomDetails?.config?.name;
        if (roleName && chatroomName) {
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
        }
      });
    }
    if (elementsModule.exportRoleButton) {
      elementsModule.exportRoleButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsRoleDetailModule.exportRoleFromSettings();
      });
    }
    if (elementsModule.editRoleSettingButton) {
      elementsModule.editRoleSettingButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-setting-detail-page', stateModule.currentRole);
      });
    }
    if (elementsModule.editRoleMemoryButton) {
      elementsModule.editRoleMemoryButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-memory-list-page', stateModule.currentRole);
      });
    }
    if (elementsModule.editRolePublicInfoButton) {
      elementsModule.editRolePublicInfoButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsPageManagerModule.showSection('role-public-info-list-page', stateModule.currentRole);
      });
    }
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

    let existingContainer = document.querySelector('.settings-group.role-detail .settings-group');
    if (existingContainer && existingContainer.querySelector('#role-drawing-enabled-settings')) {
        existingContainer.remove();
    }
    
    if (elementsModule.editRoleSettingButton) {
      elementsModule.editRoleSettingButton.style.display = isReadOnly ? 'none' : 'block';
    }
    if (elementsModule.editRoleMemoryButton) {
      elementsModule.editRoleMemoryButton.style.display = isReadOnly ? 'none' : 'block';
    }
    if (elementsModule.editRolePublicInfoButton) {
      elementsModule.editRolePublicInfoButton.style.display = isReadOnly ? 'none' : 'block';
    }
    if (elementsModule.exportRoleButton) {
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
            settingsUiHelpersModule.loadDynamicSetting(checkboxElement, `currentChatroomDetails.roles[${chatroomDetails.roles.indexOf(roleData)}].isDrawingEnabled`);
            container.insertBefore(checkboxElement.parentElement, elementsModule.exportRoleButton);
        }
      elementsModule.exportRoleButton.style.display = isReadOnly ? 'none' : 'block';
    }
  },

  exportRoleFromSettings: () => {
    const roleName = stateModule.currentRole;
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!roleName || !chatroomDetails || !chatroomDetails.config?.name) {
      _logAndDisplayError("没有当前选定的角色或聊天室可导出。", 'settingsRoleDetailModule.exportRole');
      return;
    }
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);
    if (!roleData || roleName === "用户") {
      _logAndDisplayError(`无法导出角色 "${roleName}" (非永久角色或用户)。`, 'settingsRoleDetailModule.exportRole');
      return;
    }

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