const settingsKnowledgeBaseEntriesModule = {
  currentGroupName: null,
  currentEditingEntryItem: null,

  init: () => {
    const page = document.getElementById('knowledge-base-entries-page');
    if (!page) return;

    const addButton = document.getElementById('add-knowledge-entry-button');
    if (addButton) {
      addButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsKnowledgeBaseEntriesModule.addEntry();
      });
    }
    eventBus.on('UI_UPDATE_GLOBAL', () => {
      if (stateModule.activeSettingPage === 'knowledge-base-entries-page' && settingsKnowledgeBaseEntriesModule.currentGroupName) {
        settingsKnowledgeBaseEntriesModule.renderPage(settingsKnowledgeBaseEntriesModule.currentGroupName);
      }
    });
  },

  renderPage: async (groupName) => {
    settingsKnowledgeBaseEntriesModule.currentGroupName = groupName;

    const headerTitle = document.getElementById('knowledge-base-entries-header-title');
    if (headerTitle) {
      headerTitle.textContent = `知识条目 - ${groupName}`;
    }

    const form = document.getElementById('add-knowledge-entry-form');
    if (form) {
      form.style.display = 'block';
      document.getElementById('new-knowledge-entry-name').value = '';
      document.getElementById('new-knowledge-entry-keywords').value = '';
      document.getElementById('new-knowledge-entry-content').value = '';
    }

    const result = await apiClientChatroomsModule.getKnowledgeGroupEntries(groupName);
    if (result.success) {
      settingsKnowledgeBaseEntriesModule.renderEntryList(result.data);
    } else {
      _logAndDisplayError(`Failed to fetch entries for ${groupName}: ${result.error?.message}`, 'settingsKnowledgeBaseEntriesModule.renderPage');
    }
    settingsKnowledgeBaseEntriesModule.currentEditingEntryItem = null;
  },

  renderEntryList: (entriesArray) => {
    const container = document.getElementById('knowledge-entries-list-container');
    if (!container) return;
    container.innerHTML = '';

    entriesArray.forEach(item => {
      const entryItemDiv = settingsKnowledgeBaseEntriesModule._createEntryItemDOM(item);
      container.appendChild(entryItemDiv);
    });
  },

  _createEntryItemDOM: (item) => {
    const entryItemDiv = document.createElement('div');
    entryItemDiv.className = 'memory-item';
    entryItemDiv.dataset.entryId = item.id;

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'memory-item-time';
    nameSpan.textContent = item.name;
    topRowDiv.appendChild(nameSpan);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    const deleteButton = document.createElement('div');
    deleteButton.className = 'std-button item-delete';
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsKnowledgeBaseEntriesModule.removeEntry(item.id);
    });
    actionsDiv.appendChild(deleteButton);
    topRowDiv.appendChild(actionsDiv);
    entryItemDiv.appendChild(topRowDiv);

    const keywordsSpan = document.createElement('span');
    keywordsSpan.className = 'memory-item-content';
    keywordsSpan.style.fontStyle = 'italic';
    keywordsSpan.style.color = '#aaa';
    keywordsSpan.textContent = `关键词: ${(item.keywords || []).join(', ')}`;
    entryItemDiv.appendChild(keywordsSpan);

    const contentSpan = document.createElement('span');
    contentSpan.className = 'memory-item-content';
    contentSpan.textContent = item.content || '';
    contentSpan.addEventListener('click', () => {
      if (!settingsKnowledgeBaseEntriesModule.currentEditingEntryItem) {
        settingsKnowledgeBaseEntriesModule.editEntry(item, entryItemDiv);
      }
    });
    entryItemDiv.appendChild(contentSpan);

    return entryItemDiv;
  },

  addEntry: async () => {
    if (!settingsKnowledgeBaseEntriesModule.currentGroupName) return;

    const name = document.getElementById('new-knowledge-entry-name').value.trim();
    const keywords = document.getElementById('new-knowledge-entry-keywords').value.trim().split(',').map(s => s.trim()).filter(Boolean);
    const content = document.getElementById('new-knowledge-entry-content').value.trim();

    if (!name || !content) {
      alert("名称和内容不能为空");
      return;
    }

    const newItem = {
      name,
      keywords,
      content
    };

    const result = await apiClientChatroomsModule.addKnowledgeEntry(settingsKnowledgeBaseEntriesModule.currentGroupName, newItem);
    if (result.success && result.changes) {
      incrementalUpdateHandlerModule.processChanges(result.changes);
    }
  },

  editEntry: (itemToEdit, itemDiv) => {
    settingsKnowledgeBaseEntriesModule.currentEditingEntryItem = itemToEdit;
    itemDiv.innerHTML = '';

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row memory-item-edit-top-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'settings-input';
    nameInput.value = itemToEdit.name;
    topRowDiv.appendChild(nameInput);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const saveButton = document.createElement('div');
    saveButton.className = 'std-button';
    saveButton.textContent = '💾';

    const cancelButton = document.createElement('div');
    cancelButton.className = 'std-button';
    cancelButton.textContent = '✕';

    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const updatedItem = {
        ...itemToEdit,
        name: nameInput.value.trim(),
        keywords: keywordsInput.value.trim().split(',').map(s => s.trim()).filter(Boolean),
        content: contentTextarea.value.trim()
      };
      if (!updatedItem.name || !updatedItem.content) {
        alert("名称和内容不能为空");
        return;
      }
      const result = await apiClientChatroomsModule.updateKnowledgeEntry(settingsKnowledgeBaseEntriesModule.currentGroupName, itemToEdit.id, updatedItem);
      if (result.success && result.changes) {
        settingsKnowledgeBaseEntriesModule.currentEditingEntryItem = null;
        incrementalUpdateHandlerModule.processChanges(result.changes);
      }
    });

    cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsKnowledgeBaseEntriesModule.currentEditingEntryItem = null;
      settingsKnowledgeBaseEntriesModule.renderPage(settingsKnowledgeBaseEntriesModule.currentGroupName);
    });

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);
    topRowDiv.appendChild(actionsDiv);
    itemDiv.appendChild(topRowDiv);

    const keywordsInput = document.createElement('input');
    keywordsInput.type = 'text';
    keywordsInput.className = 'settings-input';
    keywordsInput.value = (itemToEdit.keywords || []).join(', ');
    keywordsInput.style.marginBottom = '5px';
    itemDiv.appendChild(keywordsInput);

    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'settings-textarea memory-item-content-edit';
    contentTextarea.value = itemToEdit.content;
    itemDiv.appendChild(contentTextarea);
    
    const autoResize = () => {
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = contentTextarea.scrollHeight + 'px';
    };
    contentTextarea.addEventListener('input', autoResize);

    requestAnimationFrame(() => {
        contentTextarea.focus();
        autoResize();
    });
  },

  removeEntry: async (entryId) => {
    if (!settingsKnowledgeBaseEntriesModule.currentGroupName) return;
    const result = await apiClientChatroomsModule.deleteKnowledgeEntry(settingsKnowledgeBaseEntriesModule.currentGroupName, entryId);
    if (result.success && result.changes) {
      incrementalUpdateHandlerModule.processChanges(result.changes);
    }
  }
};