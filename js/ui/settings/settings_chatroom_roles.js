const settingsChatroomRolesModule = {
  init: () => {
    elementsModule.roleListContainer.addEventListener('click', (event) => {
      if (stateModule.isCooldownActive) return;
      const targetButton = event.target.closest('.item-actions > .std-button');
      if (!targetButton || targetButton.classList.contains('edit-disabled')) return;
      const roleItem = targetButton.closest('.role-item');
      if (!roleItem) return;
      const roleName = roleItem.dataset.roleName;
      if (targetButton.classList.contains('item-rename')) {
        event.stopPropagation();
        settingsChatroomRolesModule.renameChatroomRole(roleName);
      } else if (targetButton.classList.contains('item-delete')) {
        event.stopPropagation();
        settingsChatroomRolesModule.deleteChatroomRole(roleName);
      }
    });

    if (elementsModule.importRoleButton) {
      elementsModule.importRoleButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsChatroomRolesModule.importRoleFromSettings();
      });
    }
    if (elementsModule.importRoleFile) {
      elementsModule.importRoleFile.addEventListener('change', settingsChatroomRolesModule.handleImportRoleFile);
    }
    if (elementsModule.addChatroomRoleButton) {
      elementsModule.addChatroomRoleButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsChatroomRolesModule.addChatroomRole();
      });
    }
  },
  _createChatroomRoleListItem: (roleName) => {
    const roleItem = document.createElement('div');
    roleItem.className = 'role-item';
    roleItem.dataset.roleName = roleName;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = roleName;
    nameSpan.style.marginLeft = '0';
    nameSpan.addEventListener('click', () => {
      settingsPageManagerModule.showSection('role-detail-page', roleName);
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    if (roleName !== '用户') {
      const renameButton = document.createElement('div');
      renameButton.className = 'std-button item-rename';
      renameButton.textContent = '✎';
      renameButton.style.width = '28px';
      renameButton.style.height = '28px';
      const deleteButton = document.createElement('div');
      deleteButton.className = 'std-button item-delete';
      deleteButton.textContent = '✕';
      deleteButton.style.width = '28px';
      deleteButton.style.height = '28px';
      actionsDiv.appendChild(renameButton);
      actionsDiv.appendChild(deleteButton);
    }
    roleItem.appendChild(nameSpan);
    roleItem.appendChild(actionsDiv);
    return roleItem;
  },

  updateChatroomRolePage: () => {
    const container = elementsModule.roleListContainer;
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!container) return;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
      container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室。</p>';
      return;
    }
    container.innerHTML = '';

    const allRoleNamesFromFiles = new Set((chatroomDetails.roles || []).map(r => r.name));
    allRoleNamesFromFiles.add("用户");

    const displayableRoles = Array.from(allRoleNamesFromFiles);

    displayableRoles.sort((a, b) => {
      if (a === "用户") return -1;
      if (b === "用户") return 1;
      return a.localeCompare(b);
    });

    if (displayableRoles.length === 0) {
      const noRolesMsg = document.createElement('p');
      noRolesMsg.textContent = '此聊天室没有角色。';
      noRolesMsg.style.textAlign = 'center';
      container.appendChild(noRolesMsg);
    } else {
      const frag = document.createDocumentFragment();
      displayableRoles.forEach(roleName => {
        const listItem = settingsChatroomRolesModule._createChatroomRoleListItem(roleName);
        frag.appendChild(listItem);
      });
      container.appendChild(frag);
    }
  },

  addChatroomRole: () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) return;
    const newRoleName = prompt("请输入新角色名称:");
    if (newRoleName && newRoleName.trim() !== "") {
      const trimmedName = newRoleName.trim();
      const nameExists = chatroomDetails.roles.some(r => r.name === trimmedName);
      if (nameExists) {
        _logAndDisplayError(`角色名称 "${trimmedName}" 已存在于当前聊天室。`, 'settingsChatroomRolesModule.addChatroomRole');
        return;
      }
      const newRoleData = {
        ...defaultRoleData,
        name: trimmedName
      };
      transactionManagerModule.dispatch('CREATE_ROLE', {
        chatroomName: chatroomDetails.config.name,
        roleData: newRoleData
      });
    }
  },

  renameChatroomRole: (oldName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || oldName === "用户") return;

    const newName = prompt(`输入角色 "${oldName}" 的新名称:`, oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    const trimmedNewName = newName.trim();

    const roleData = chatroomDetails.roles.find(r => r.name === oldName);
    if (!roleData) return;

    const updatedRoleData = {
      ...roleData,
      name: trimmedNewName
    };
    transactionManagerModule.dispatch('UPDATE_ROLE_FIELDS', {
      chatroomName: chatroomDetails.config.name,
      roleName: oldName,
      updates: updatedRoleData
    });
  },

  deleteChatroomRole: (roleName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || roleName === "用户" || !confirm(`确定要删除角色 "${roleName}" 吗？`)) return;

    transactionManagerModule.dispatch('DELETE_ROLE', {
      chatroomName: chatroomDetails.config.name,
      roleName
    });
  },

  importRoleFromSettings: () => {
    elementsModule.importRoleFile.click();
  },

  handleImportRoleFile: (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
      _logAndDisplayError("请先选择一个聊天室来导入角色。", 'settingsChatroomRolesModule.handleImportRoleFile');
      event.target.value = null;
      return;
    }
    const roomName = chatroomDetails.config.name;
    const reader = new FileReader();
    reader.onload = async function(e) {
      let importedRoleData;
      try {
        importedRoleData = JSON.parse(e.target.result);
      } catch (err) {
        _logAndDisplayError(`导入角色失败: 文件不是有效的 JSON. ${err.message}`, 'settingsChatroomRolesModule.handleImportRoleFile');
        event.target.value = null;
        return;
      }
      if (!importedRoleData || typeof importedRoleData !== 'object' || !importedRoleData.name || typeof importedRoleData.name !== 'string') {
        _logAndDisplayError("导入的文件格式无效，缺少 'name' 字段。", 'settingsChatroomRolesModule.handleImportRoleFile');
        event.target.value = null;
        return;
      }
      let importName = importedRoleData.name;
      let finalName = importName;
      const existingNames = chatroomDetails.roles.map(r => r.name);
      while (existingNames.includes(finalName)) {
        finalName = prompt(`名称 "${finalName}" 在此聊天室已存在。请输入新的角色名称：`, `${importName}_1`);
        if (!finalName || finalName.trim() === "") {
          event.target.value = null;
          return;
        }
        finalName = finalName.trim();
      }
      const newRole = {
        ...defaultRoleData,
        ...importedRoleData,
        name: finalName
      };

      if (!Array.isArray(newRole.memory)) newRole.memory = [];
      if (!Array.isArray(newRole.archetypes)) newRole.archetypes = [];
      if (!Array.isArray(newRole.keywords)) newRole.keywords = [];

      transactionManagerModule.dispatch('CREATE_ROLE', {
        chatroomName: roomName,
        roleData: newRole
      });
      event.target.value = null;
    };
    reader.onerror = function(e) {
      event.target.value = null;
      _logAndDisplayError("读取文件时出错。", 'settingsChatroomRolesModule.handleImportRoleFile');
    };
    reader.readAsText(file);
  },

  handleRoleVisibilityChange: (roleName, isVisible) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config || !chatroomDetails.config.roleVisibility) {
      return;
    }
    const newVisibility = {
      ...chatroomDetails.config.roleVisibility,
      [roleName]: isVisible
    };
    transactionManagerModule.dispatch('UPDATE_CHATROOM', {
      chatroomName: chatroomDetails.config.name,
      updates: {
        roleVisibility: newVisibility
      }
    });
  }
};