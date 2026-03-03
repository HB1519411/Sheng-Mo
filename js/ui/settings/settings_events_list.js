const settingsEventsListModule = {
  currentEditingEventItem: null,
  init: () => {
    const page = document.getElementById('events-list-page');
    if (!page) return;

    const addButton = document.getElementById('add-event-button');
    if (addButton) {
      addButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsEventsListModule.addEventItem();
      });
    }
  },

  renderPage: async () => {
    const chatroomName = stateModule.currentChatroomDetails?.config?.name;
    if (!chatroomName) return;

    const headerTitle = document.getElementById('events-list-header-title');
    if (headerTitle) {
      headerTitle.textContent = `事件记录 - ${chatroomName}`;
    }

    const form = document.getElementById('add-event-item-form');
    if (form) {
      form.style.display = 'block';
      document.getElementById('new-event-time').value = '';
      document.getElementById('new-event-characters').value = '';
      document.getElementById('new-event-content').value = '';
    }

    settingsEventsListModule.renderEventList(stateModule.currentChatroomDetails.events || []);
    settingsEventsListModule.currentEditingEventItem = null;
  },

  renderEventList: (eventsArray) => {
    const container = document.getElementById('events-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const dateToNumber = (dateStr) => {
        if (!dateStr || !commonUtilsModule.isStandardTimeFormat(dateStr)) return Infinity;
        const parts = dateStr.replace(/^-/, '').split('-');
        const sign = dateStr.startsWith('-') ? -1 : 1;
        return sign * (parseInt(parts[0], 10) * 10000 + parseInt(parts[1], 10) * 100 + parseInt(parts[2], 10));
    };

    const sortedEvents = [...eventsArray].sort((a, b) => dateToNumber(b.time || '') - dateToNumber(a.time || ''));

    sortedEvents.forEach((item) => {
      const eventItemDiv = settingsEventsListModule._createEventItemDOM(item);
      container.appendChild(eventItemDiv);
    });
  },

  _createEventItemDOM: (item) => {
    const eventItemDiv = document.createElement('div');
    eventItemDiv.className = 'memory-item';
    eventItemDiv.dataset.eventId = item.id;

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'memory-item-time';
    timeSpan.textContent = item.time || 'N/A';
    if (item.isPinned) {
        timeSpan.textContent += ' 📌';
    }
    topRowDiv.appendChild(timeSpan);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    const deleteButton = document.createElement('div');
    deleteButton.className = 'std-button item-delete';
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsEventsListModule.removeEventItem(item.id);
    });
    actionsDiv.appendChild(deleteButton);
    topRowDiv.appendChild(actionsDiv);
    eventItemDiv.appendChild(topRowDiv);

    const charactersSpan = document.createElement('span');
    charactersSpan.className = 'memory-item-content';
    charactersSpan.style.fontStyle = 'italic';
    charactersSpan.style.color = '#aaa';
    charactersSpan.textContent = `角色: ${(item.involvedCharacters || []).join(', ')}`;
    eventItemDiv.appendChild(charactersSpan);

    const contentSpan = document.createElement('span');
    contentSpan.className = 'memory-item-content';
    contentSpan.textContent = item.content || '';
    contentSpan.addEventListener('click', () => {
      if (!settingsEventsListModule.currentEditingEventItem) {
        settingsEventsListModule.editEventItem(item, eventItemDiv);
      }
    });
    eventItemDiv.appendChild(contentSpan);

    return eventItemDiv;
  },

  addEventItem: () => {
    const chatroomName = stateModule.currentChatroomDetails.config.name;
    const time = document.getElementById('new-event-time').value.trim();
    const characters = document.getElementById('new-event-characters').value.trim().split(',').map(s => s.trim()).filter(Boolean);
    const content = document.getElementById('new-event-content').value.trim();

    if (!time || !content) {
      alert("时间和内容不能为空");
      return;
    }

    const newItem = {
      id: uiChatUtilsModule._generateMessageId(),
      time,
      involvedCharacters: characters,
      content
    };
    transactionManagerModule.dispatch('addEvent', {
      chatroomName: chatroomName,
      eventData: newItem
    }).then(() => settingsEventsListModule.renderPage());
  },

  editEventItem: (itemToEdit, itemDiv) => {
    settingsEventsListModule.currentEditingEventItem = itemToEdit;
    itemDiv.innerHTML = '';

    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'memory-item-top-row memory-item-edit-top-row';
    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'settings-input';
    timeInput.value = itemToEdit.time;
    topRowDiv.appendChild(timeInput);
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    const saveButton = document.createElement('div');
    saveButton.className = 'std-button';
    saveButton.textContent = '💾';
    saveButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const updatedItem = {
        ...itemToEdit,
        time: timeInput.value.trim(),
        involvedCharacters: charactersInput.value.trim().split(',').map(s => s.trim()).filter(Boolean),
        content: contentTextarea.value.trim(),
        details: detailsTextarea.value.trim(),
        isPinned: pinnedCheckbox.checked
      };
      if (!updatedItem.time || !updatedItem.content) {
        alert("时间和内容不能为空");
        return;
      }
      settingsEventsListModule.currentEditingEventItem = null;
      transactionManagerModule.dispatch('updateEvent', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        eventId: itemToEdit.id,
        eventData: updatedItem
      }).then(() => settingsEventsListModule.renderPage());
    });
    const cancelButton = document.createElement('div');
    cancelButton.className = 'std-button';
    cancelButton.textContent = '✕';
    cancelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsEventsListModule.currentEditingEventItem = null;
      settingsEventsListModule.renderPage();
    });
    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);
    topRowDiv.appendChild(actionsDiv);
    itemDiv.appendChild(topRowDiv);

    const charactersInput = document.createElement('input');
    charactersInput.type = 'text';
    charactersInput.className = 'settings-input';
    charactersInput.value = (itemToEdit.involvedCharacters || []).join(', ');
    charactersInput.style.marginBottom = '5px';
    itemDiv.appendChild(charactersInput);

    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'settings-textarea memory-item-content-edit';
    contentTextarea.value = itemToEdit.content;
    contentTextarea.placeholder = '事件概要 (用于索引)';
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
    pinnedCheckbox.id = `pinned-event-${itemToEdit.id}`;
    pinnedCheckbox.checked = !!itemToEdit.isPinned;
    const pinnedLabel = document.createElement('label');
    pinnedLabel.htmlFor = `pinned-event-${itemToEdit.id}`;
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
        contentTextarea.focus();
        autoResize(contentTextarea);
        autoResize(detailsTextarea);
    });
  },

  removeEventItem: (eventId) => {
    const chatroomName = stateModule.currentChatroomDetails.config.name;
    transactionManagerModule.dispatch('deleteEvent', {
      chatroomName: chatroomName,
      eventId: eventId
    }).then(() => settingsEventsListModule.renderPage());
  }
};