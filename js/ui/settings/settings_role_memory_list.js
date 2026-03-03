const settingsRoleMemoryListModule = {
  currentEditingMemoryItem: null,
  init: () => {
    const page = elementsModule.roleMemoryListPage;
    if (!page) return;

    if (elementsModule.addMemoryButton) {
      elementsModule.addMemoryButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsRoleMemoryListModule.addMemoryItem();
      });
    }
  },

  renderPage: (roleName) => {
    stateModule.currentRole = roleName;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);

    if (elementsModule.roleMemoryListHeaderTitle) {
      elementsModule.roleMemoryListHeaderTitle.textContent = `角色记忆 - ${roleName}`;
    }

    const isPermanentDefinedRole = !!roleData;
    const isReadOnly = !isPermanentDefinedRole || roleName === "用户";

    if (elementsModule.addMemoryItemForm) {
      elementsModule.addMemoryItemForm.style.display = isReadOnly ? 'none' : 'block';
    }
    if (elementsModule.newMemoryTimeInput) elementsModule.newMemoryTimeInput.value = '';
    if (elementsModule.newMemoryContentTextarea) elementsModule.newMemoryContentTextarea.value = '';

    settingsRoleMemoryListModule.renderMemoryList(roleData?.memory || [], isReadOnly);
    settingsRoleMemoryListModule.currentEditingMemoryItem = null;
  },

  renderMemoryList: (memoryArray, isReadOnly) => {
    const container = elementsModule.roleMemoryListContainer;
    if (!container) {
      return;
    }
    container.innerHTML = '';
    
    const dateToNumber = (dateStr) => {
        if (!dateStr || !commonUtilsModule.isStandardTimeFormat(dateStr)) return Infinity;
        const parts = dateStr.replace(/^-/, '').split('-');
        const sign = dateStr.startsWith('-') ? -1 : 1;
        return sign * (parseInt(parts[0], 10) * 10000 + parseInt(parts[1], 10) * 100 + parseInt(parts[2], 10));
    };

    const sortedMemory = [...memoryArray].sort((a, b) => {
      const isAStandard = commonUtilsModule.isStandardTimeFormat(a.time);
      const isBStandard = commonUtilsModule.isStandardTimeFormat(b.time);
      const timeA = a.time || "";
      const timeB = b.time || "";

      if (isAStandard && !isBStandard) return 1;
      if (!isAStandard && isBStandard) return -1;
      if (!isAStandard && !isBStandard) {
        return timeA.localeCompare(timeB);
      }
      return dateToNumber(timeB) - dateToNumber(timeA);
    });

    sortedMemory.forEach((item) => {
      const memoryItemDiv = settingsRoleMemoryListModule._createMemoryItemDOM(item, isReadOnly);
      container.appendChild(memoryItemDiv);
    });
  },

  _createMemoryItemDOM: (item, isReadOnly) => {
    const memoryItemDiv = document.createElement('div');
    memoryItemDiv.className = 'memory-item';
    memoryItemDiv.dataset.memoryId = item.id;

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'memory-item-time';
    timeSpan.textContent = item.time || 'N/A';
    if (item.isPinned) {
        timeSpan.textContent += ' 📌';
    }
    topRowDiv.appendChild(timeSpan);

    if (!isReadOnly) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      const deleteButton = document.createElement('div');
      deleteButton.className = 'std-button item-delete';
      deleteButton.textContent = '✕';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsRoleMemoryListModule.removeMemoryItem(item.id);
      });
      actionsDiv.appendChild(deleteButton);
      topRowDiv.appendChild(actionsDiv);
    }
    memoryItemDiv.appendChild(topRowDiv);
    const contentSpan = document.createElement('span');
    contentSpan.className = 'memory-item-content';
    contentSpan.textContent = item.content || '';
    contentSpan.addEventListener('click', () => {
      if (!isReadOnly && !settingsRoleMemoryListModule.currentEditingMemoryItem) {
        settingsRoleMemoryListModule.editMemoryItem(item, memoryItemDiv);
      }
    });
    memoryItemDiv.appendChild(contentSpan);
    return memoryItemDiv;
  },

  addMemoryItem: () => {
    const roleName = stateModule.currentRole;
    if (!roleName || roleName === "用户") return;

    const time = elementsModule.newMemoryTimeInput.value.trim();
    const content = elementsModule.newMemoryContentTextarea.value.trim();
    if (!time || !content) {
      alert("时间和内容不能为空");
      return;
    }

    const newItem = {
      id: uiChatUtilsModule._generateMessageId(),
      time,
      content
    };
    transactionManagerModule.dispatch('ADD_ROLE_MEMORY', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      roleName,
      memoryItem: newItem
    }).then(() => settingsRoleMemoryListModule.renderPage(roleName));
  },

  editMemoryItem: (itemToEdit, itemDiv) => {
    settingsRoleMemoryListModule.currentEditingMemoryItem = itemToEdit;
    itemDiv.innerHTML = '';

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row memory-item-edit-top-row';

    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'settings-input';
    timeInput.value = itemToEdit.time;
    timeInput.style.width = '120px';
    topRowDiv.appendChild(timeInput);

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
      const newTime = timeInput.value.trim();
      const newContent = contentTextarea.value.trim();
      if (!newTime || !newContent) {
        alert("时间和内容不能为空");
        return;
      }

      const updatedItem = {
        ...itemToEdit,
        time: newTime,
        content: newContent,
        details: detailsTextarea.value.trim(),
        isPinned: pinnedCheckbox.checked
      };
      settingsRoleMemoryListModule.currentEditingMemoryItem = null;
      transactionManagerModule.dispatch('UPDATE_ROLE_MEMORY', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        roleName: stateModule.currentRole,
        memoryId: itemToEdit.id,
        memoryItem: updatedItem
      }).then(() => settingsRoleMemoryListModule.renderPage(stateModule.currentRole));
    });

    cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsRoleMemoryListModule.currentEditingMemoryItem = null;
      settingsRoleMemoryListModule.renderPage(stateModule.currentRole);
    });

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);
    topRowDiv.appendChild(actionsDiv);
    itemDiv.appendChild(topRowDiv);

    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'settings-textarea memory-item-content-edit';
    contentTextarea.value = itemToEdit.content;
    contentTextarea.placeholder = '记忆概要 (用于索引)';
    itemDiv.appendChild(contentTextarea);
    
    const detailsTextarea = document.createElement('textarea');
    detailsTextarea.className = 'settings-textarea memory-item-content-edit';
    detailsTextarea.value = itemToEdit.details || '';
    detailsTextarea.placeholder = '详细记录 (非必须，用于详细回顾)';
    detailsTextarea.style.marginTop = '10px';
    itemDiv.appendChild(detailsTextarea);

    const pinnedDiv = document.createElement('div');
    pinnedDiv.style.marginTop = '10px';
    const pinnedCheckbox = document.createElement('input');
    pinnedCheckbox.type = 'checkbox';
    pinnedCheckbox.id = `pinned-memory-${itemToEdit.id}`;
    pinnedCheckbox.checked = !!itemToEdit.isPinned;
    const pinnedLabel = document.createElement('label');
    pinnedLabel.htmlFor = `pinned-memory-${itemToEdit.id}`;
    pinnedLabel.textContent = ' 固定 (无视记录条数限制)';
    pinnedLabel.style.marginLeft = '5px';
    pinnedLabel.style.color = '#ccc';
    pinnedDiv.appendChild(pinnedCheckbox);
    pinnedDiv.appendChild(pinnedLabel);
    itemDiv.appendChild(pinnedDiv);
    
    const autoResize = (el) => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };
    contentTextarea.addEventListener('input', () => autoResize(contentTextarea));
    detailsTextarea.addEventListener('input', () => autoResize(detailsTextarea));

    requestAnimationFrame(() => {
        itemDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        contentTextarea.focus();
        autoResize(contentTextarea);
        autoResize(detailsTextarea);
    });
  },

  removeMemoryItem: (memoryIdToRemove) => {
    const roleName = stateModule.currentRole;
    transactionManagerModule.dispatch('DELETE_ROLE_MEMORY', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      roleName,
      memoryId: memoryIdToRemove
    }).then(() => settingsRoleMemoryListModule.renderPage(roleName));
  }
};