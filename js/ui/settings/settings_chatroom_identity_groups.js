const settingsChatroomIdentityGroupsModule = {
  init: () => {
    elementsModule.addIdentityGroupButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsChatroomIdentityGroupsModule.addGroup();
    });
    
    eventBus.on('UI_UPDATE_GLOBAL', () => {
        if (stateModule.activeSettingPage === 'identity-groups-page') {
            settingsChatroomIdentityGroupsModule.renderPage();
        }
    });
  },

  renderPage: () => {
    const container = elementsModule.identityGroupsListContainer;
    if (!container) return;
    container.innerHTML = '';

    let identityGroups = stateModule.currentChatroomDetails.config.identityGroups;
    if (!Array.isArray(identityGroups)) {
        identityGroups = [];
    }
    
    if (identityGroups.length === 0) {
      container.innerHTML = '<p style="text-align: center;">暂无身份组。</p>';
      return;
    }

    identityGroups.forEach((group, index) => {
      const groupElement = settingsChatroomIdentityGroupsModule._createIdentityGroupItem(group, index);
      container.appendChild(groupElement);
    });
  },

  _createIdentityGroupItem: (group, index) => {
    const groupItem = document.createElement('div');
    groupItem.className = 'api-key-group-item';
    groupItem.style.position = 'relative'; 

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-api-key-group-button std-button';
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', () => {
      settingsChatroomIdentityGroupsModule.deleteGroup(index);
    });
    groupItem.appendChild(deleteButton);

    const title = document.createElement('h3');
    title.textContent = group.name;
    title.style.margin = '0 0 10px 0';
    title.style.color = '#e0c2a3';
    groupItem.appendChild(title);

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-with-button-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-input';
    input.placeholder = '输入角色名后添加';
    input.style.marginBottom = '0';
    
    const addButton = document.createElement('div');
    addButton.className = 'std-button enter-action-button';
    addButton.textContent = '添加';
    
    const handleAdd = () => {
        const name = input.value.trim();
        if (name) {
            settingsChatroomIdentityGroupsModule._addMemberToGroup(index, name);
            input.value = '';
        }
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    });
    
    addButton.addEventListener('click', handleAdd);

    inputGroup.appendChild(input);
    inputGroup.appendChild(addButton);
    groupItem.appendChild(inputGroup);

    const tagContainer = document.createElement('div');
    tagContainer.className = 'tag-input-container';
    
    if (Array.isArray(group.members)) {
        group.members.forEach(member => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.textContent = member;

            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-delete-button';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsChatroomIdentityGroupsModule._removeMemberFromGroup(index, member);
            });
            
            tagElement.appendChild(removeBtn);
            tagContainer.appendChild(tagElement);
        });
    }
    
    groupItem.appendChild(tagContainer);

    return groupItem;
  },

  _updateGroupMembers: (groupIndex, newMembersList) => {
    const chatroomName = stateModule.currentChatroomDetails.config.name;
    const currentGroups = commonUtilsModule._shengmoDeepCopy(stateModule.currentChatroomDetails.config.identityGroups || []);
    
    if (currentGroups[groupIndex]) {
        currentGroups[groupIndex].members = newMembersList;
        transactionManagerModule.dispatch('UPDATE_CHATROOM', {
            chatroomName: chatroomName,
            updates: { identityGroups: currentGroups }
        }).then(() => {
            settingsChatroomIdentityGroupsModule.renderPage();
        });
    }
  },

  _addMemberToGroup: (groupIndex, memberName) => {
    let identityGroups = stateModule.currentChatroomDetails.config.identityGroups;
    if (!Array.isArray(identityGroups) || !identityGroups[groupIndex]) return;
    
    const currentMembers = identityGroups[groupIndex].members || [];
    if (!currentMembers.includes(memberName)) {
        const newMembers = [...currentMembers, memberName];
        settingsChatroomIdentityGroupsModule._updateGroupMembers(groupIndex, newMembers);
    }
  },

  _removeMemberFromGroup: (groupIndex, memberName) => {
    let identityGroups = stateModule.currentChatroomDetails.config.identityGroups;
    if (!Array.isArray(identityGroups) || !identityGroups[groupIndex]) return;
    
    const currentMembers = identityGroups[groupIndex].members || [];
    const newMembers = currentMembers.filter(m => m !== memberName);
    settingsChatroomIdentityGroupsModule._updateGroupMembers(groupIndex, newMembers);
  },

  addGroup: () => {
    const groupName = prompt("请输入新身份组名称:");
    if (!groupName || !groupName.trim()) return;

    const chatroomName = stateModule.currentChatroomDetails.config.name;
    let currentGroups = stateModule.currentChatroomDetails.config.identityGroups;
    if (!Array.isArray(currentGroups)) {
        currentGroups = [];
    }
    
    if (currentGroups.some(g => g.name === groupName.trim())) {
        alert("身份组名称已存在！");
        return;
    }

    const newGroups = [...currentGroups, { name: groupName.trim(), members: [] }];

    transactionManagerModule.dispatch('UPDATE_CHATROOM', {
      chatroomName: chatroomName,
      updates: {
        identityGroups: newGroups
      }
    }).then(() => {
        settingsChatroomIdentityGroupsModule.renderPage();
    });
  },

  deleteGroup: (index) => {
    if (!confirm("确定要删除此身份组吗？")) return;

    const chatroomName = stateModule.currentChatroomDetails.config.name;
    let currentGroups = stateModule.currentChatroomDetails.config.identityGroups;
    if (!Array.isArray(currentGroups)) {
        currentGroups = [];
    }
    
    const newGroups = currentGroups.filter((_, i) => i !== index);

    transactionManagerModule.dispatch('UPDATE_CHATROOM', {
      chatroomName: chatroomName,
      updates: {
        identityGroups: newGroups
      }
    }).then(() => {
        settingsChatroomIdentityGroupsModule.renderPage();
    });
  }
};