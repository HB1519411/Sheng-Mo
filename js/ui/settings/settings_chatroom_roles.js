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

    elementsModule.importRoleButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsChatroomRolesModule.importRoleFromSettings();
    });
    elementsModule.importRoleFile.addEventListener('change', settingsChatroomRolesModule.handleImportRoleFile);
    elementsModule.addChatroomRoleButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsChatroomRolesModule.addChatroomRole();
    });
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
    container.innerHTML = '';

    const allRoleNamesFromFiles = new Set(chatroomDetails.roles.map(r => r.name));
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
    const newRoleName = prompt("请输入新角色名称:");
    if (newRoleName && newRoleName.trim() !== "") {
      const trimmedName = newRoleName.trim();
      const nameExists = chatroomDetails.roles.some(r => r.name === trimmedName);
      if (nameExists) {
        alert(`角色名称 "${trimmedName}" 已存在于当前聊天室。`);
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
    const newName = prompt(`输入角色 "${oldName}" 的新名称:`, oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    const trimmedNewName = newName.trim();

    const roleData = chatroomDetails.roles.find(r => r.name === oldName);

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
    if (roleName === "用户" || !confirm(`确定要删除角色 "${roleName}" 吗？`)) return;

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
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roomName = chatroomDetails.config.name;
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        let importedRoleData = JSON.parse(e.target.result);
        let importName = importedRoleData.name;
        let finalName = importName;
        const existingNames = chatroomDetails.roles.map(r => r.name);
        while (existingNames.includes(finalName)) {
          finalName = prompt(`名称 "${finalName}" 在此聊天室已存在。请输入新的角色名称：`, `${importName}_1`);
          if (!finalName || finalName.trim() === "") {
            return;
          }
          finalName = finalName.trim();
        }
        const newRole = {
          ...defaultRoleData,
          ...importedRoleData,
          name: finalName
        };

        transactionManagerModule.dispatch('CREATE_ROLE', {
          chatroomName: roomName,
          roleData: newRole
        });
      } catch (err) {
        alert(`解析角色文件失败: ${err.message}`);
        throw err;
      } finally {
        event.target.value = null;
      }
    };
    reader.readAsText(file);
  },

  handleRoleVisibilityChange: (roleName, isVisible) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
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