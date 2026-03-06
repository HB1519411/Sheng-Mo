const settingsRolePublicInfoListModule = {
  currentEditingPublicInfoItem: null,
  init: () => {
    elementsModule.addPublicInfoButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsRolePublicInfoListModule.addPublicInfoItem();
    });
  },

  renderPage: (roleName) => {
    stateModule.currentRole = roleName;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);

    elementsModule.rolePublicInfoListHeaderTitle.textContent = `角色公开信息 - ${roleName}`;

    const isPermanentDefinedRole = !!roleData;
    const isReadOnly = !isPermanentDefinedRole || roleName === "用户";

    elementsModule.addPublicInfoItemForm.style.display = isReadOnly ? 'none' : 'block';
    elementsModule.newPublicInfoKeywordInput.value = '';
    elementsModule.newPublicInfoContentTextarea.value = '';

    settingsRolePublicInfoListModule.renderPublicInfoList(roleData.publicInfo, isReadOnly);
    settingsRolePublicInfoListModule.currentEditingPublicInfoItem = null;
  },

  renderPublicInfoList: (publicInfoArray, isReadOnly) => {
    const container = elementsModule.rolePublicInfoListContainer;
    container.innerHTML = '';

    publicInfoArray.forEach((item, index) => {
      const publicInfoItemDiv = settingsRolePublicInfoListModule._createPublicInfoItemDOM(item, isReadOnly);
      container.appendChild(publicInfoItemDiv);
    });
  },

  _createPublicInfoItemDOM: (item, isReadOnly) => {
    const publicInfoItemDiv = document.createElement('div');
    publicInfoItemDiv.className = 'memory-item';
    publicInfoItemDiv.dataset.publicInfoId = item.id;
    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row';
    const keywordSpan = document.createElement('span');
    keywordSpan.className = 'memory-item-time';
    keywordSpan.textContent = item.keyword ? `关键词: ${item.keyword}` : `关键词: 无(全局可见)`;
    topRowDiv.appendChild(keywordSpan);
    if (!isReadOnly) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      const deleteButton = document.createElement('div');
      deleteButton.className = 'std-button item-delete';
      deleteButton.textContent = '✕';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsRolePublicInfoListModule.removePublicInfoItem(item.id);
      });
      actionsDiv.appendChild(deleteButton);
      topRowDiv.appendChild(actionsDiv);
    }
    publicInfoItemDiv.appendChild(topRowDiv);
    const contentSpan = document.createElement('span');
    contentSpan.className = 'memory-item-content';
    contentSpan.textContent = item.content;
    contentSpan.addEventListener('click', () => {
      if (!isReadOnly && !settingsRolePublicInfoListModule.currentEditingPublicInfoItem) {
        settingsRolePublicInfoListModule.editPublicInfoItem(item, publicInfoItemDiv);
      }
    });
    publicInfoItemDiv.appendChild(contentSpan);
    return publicInfoItemDiv;
  },

  addPublicInfoItem: () => {
    const roleName = stateModule.currentRole;
    const keyword = elementsModule.newPublicInfoKeywordInput.value.trim();
    const content = elementsModule.newPublicInfoContentTextarea.value.trim();

    if (!content) {
      alert("公开信息内容不能为空");
      return;
    }

    const newItem = {
      id: uiChatUtilsModule._generateMessageId(),
      keyword,
      content
    };
    transactionManagerModule.dispatch('ADD_ROLE_PUBLIC_INFO', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      roleName,
      infoItem: newItem
    }).then(() => settingsRolePublicInfoListModule.renderPage(roleName));
  },

  editPublicInfoItem: (itemToEdit, itemDiv) => {
    settingsRolePublicInfoListModule.currentEditingPublicInfoItem = itemToEdit;
    itemDiv.innerHTML = '';

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row memory-item-edit-top-row';

    const keywordInput = document.createElement('input');
    keywordInput.type = 'text';
    keywordInput.className = 'settings-input';
    keywordInput.value = itemToEdit.keyword;
    topRowDiv.appendChild(keywordInput);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const saveButton = document.createElement('div');
    saveButton.className = 'std-button';
    saveButton.textContent = '💾';
    saveButton.style.width = 'auto';
    saveButton.style.padding = '0 10px';

    const cancelButton = document.createElement('div');
    cancelButton.className = 'std-button';
    cancelButton.textContent = '✕';
    cancelButton.style.width = 'auto';
    cancelButton.style.padding = '0 10px';

    saveButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const newKeyword = keywordInput.value.trim();
      const newContent = contentTextarea.value.trim();
      if (!newContent) {
        alert("公开信息内容不能为空");
        return;
      }

      const updatedItem = {
        ...itemToEdit,
        keyword: newKeyword,
        content: newContent
      };
      settingsRolePublicInfoListModule.currentEditingPublicInfoItem = null;
      transactionManagerModule.dispatch('UPDATE_ROLE_PUBLIC_INFO', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        roleName: stateModule.currentRole,
        infoId: itemToEdit.id,
        infoItem: updatedItem
      }).then(() => settingsRolePublicInfoListModule.renderPage(stateModule.currentRole));
    });

    cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsRolePublicInfoListModule.currentEditingPublicInfoItem = null;
      settingsRolePublicInfoListModule.renderPage(stateModule.currentRole);
    });

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);
    topRowDiv.appendChild(actionsDiv);
    itemDiv.appendChild(topRowDiv);

    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'settings-textarea memory-item-content-edit';
    contentTextarea.value = itemToEdit.content;
    contentTextarea.style.height = '80vh';
    itemDiv.appendChild(contentTextarea);
    
    requestAnimationFrame(() => {
        itemDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        contentTextarea.focus();
    });
  },

  removePublicInfoItem: (infoIdToRemove) => {
    const roleName = stateModule.currentRole;
    transactionManagerModule.dispatch('DELETE_ROLE_PUBLIC_INFO', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      roleName,
      infoId: infoIdToRemove
    }).then(() => settingsRolePublicInfoListModule.renderPage(roleName));
  }
};