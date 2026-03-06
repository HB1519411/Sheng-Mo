const settingsEventsListModule = {
  currentEditingEventItem: null,
  init: () => {
    document.getElementById('add-event-button').addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsEventsListModule.addEventItem();
    });
  },

  renderPage: async () => {
    document.getElementById('events-list-header-title').textContent = `事件记录 - ${stateModule.currentChatroomDetails.config.name}`;
    
    document.getElementById('add-event-item-form').style.display = 'block';
    document.getElementById('new-event-time').value = '';
    document.getElementById('new-event-characters').value = '';
    document.getElementById('new-event-content').value = '';

    settingsEventsListModule.renderEventList(stateModule.currentChatroomDetails.events);
    settingsEventsListModule.currentEditingEventItem = null;
  },

  renderEventList: (eventsArray) => {
    const container = document.getElementById('events-list-container');
    container.innerHTML = '';
    
    const dateToNumber = (dateStr) => {
        if (!commonUtilsModule.isStandardTimeFormat(dateStr)) return Infinity;
        const parts = dateStr.replace(/^-/, '').split('-');
        return (dateStr.startsWith('-') ? -1 : 1) * (parseInt(parts[0], 10) * 10000 + parseInt(parts[1], 10) * 100 + parseInt(parts[2], 10));
    };

    [...eventsArray].sort((a, b) => dateToNumber(b.time) - dateToNumber(a.time))
      .forEach(item => container.appendChild(settingsEventsListModule._createEventItemDOM(item)));
  },

  _createEventItemDOM: (item) => {
    const div = Object.assign(document.createElement('div'), { className: 'memory-item' });
    div.dataset.eventId = item.id;
    
    const topRow = Object.assign(document.createElement('div'), { className: 'memory-item-top-row' });
    const timeSpan = Object.assign(document.createElement('span'), { className: 'memory-item-time', textContent: `${item.time}${item.isPinned ? ' 📌' : ''}` });
    const actions = Object.assign(document.createElement('div'), { className: 'item-actions' });
    const delBtn = Object.assign(document.createElement('div'), { className: 'std-button item-delete', textContent: '✕' });
    delBtn.onclick = (e) => { e.stopPropagation(); settingsEventsListModule.removeEventItem(item.id); };
    actions.appendChild(delBtn);
    topRow.append(timeSpan, actions);
    
    const charsSpan = Object.assign(document.createElement('span'), { className: 'memory-item-content', textContent: `角色: ${item.involvedCharacters.join(', ')}` });
    Object.assign(charsSpan.style, { fontStyle: 'italic', color: '#aaa' });
    
    const contentSpan = Object.assign(document.createElement('span'), { className: 'memory-item-content event-main-content', textContent: item.content });
    contentSpan.onclick = () => { if (!settingsEventsListModule.currentEditingEventItem) settingsEventsListModule.editEventItem(item, div); };
    
    div.append(topRow, charsSpan, contentSpan);
    return div;
  },

  addEventItem: () => {
    const time = document.getElementById('new-event-time').value.trim();
    const content = document.getElementById('new-event-content').value.trim();
    if (!time || !content) return alert("时间和内容不能为空");

    transactionManagerModule.dispatch('addEvent', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      eventData: {
        id: uiChatUtilsModule._generateMessageId(),
        time,
        involvedCharacters: document.getElementById('new-event-characters').value.trim().split(',').map(s => s.trim()).filter(Boolean),
        content
      }
    }).then(() => settingsEventsListModule.renderPage());
  },

  editEventItem: (item, div) => {
    settingsEventsListModule.currentEditingEventItem = item;
    div.innerHTML = '';
    
    const topRow = Object.assign(document.createElement('div'), { className: 'memory-item-top-row memory-item-edit-top-row' });
    const timeInput = Object.assign(document.createElement('input'), { type: 'text', className: 'settings-input time-input', value: item.time });
    const actions = Object.assign(document.createElement('div'), { className: 'item-actions' });
    const saveBtn = Object.assign(document.createElement('div'), { className: 'std-button save-btn', textContent: '💾' });
    const cancelBtn = Object.assign(document.createElement('div'), { className: 'std-button cancel-btn', textContent: '✕' });
    actions.append(saveBtn, cancelBtn);
    topRow.append(timeInput, actions);
    
    const charsInput = Object.assign(document.createElement('input'), { type: 'text', className: 'settings-input chars-input', value: item.involvedCharacters.join(', ') });
    charsInput.style.marginBottom = '5px';
    
    const contentInput = Object.assign(document.createElement('textarea'), { className: 'settings-textarea memory-item-content-edit content-input', placeholder: '事件概要', value: item.content });
    const detailsInput = Object.assign(document.createElement('textarea'), { className: 'settings-textarea memory-item-content-edit details-input', placeholder: '详细记录', value: item.details });
    detailsInput.style.marginTop = '10px';
    
    const pinDiv = Object.assign(document.createElement('div'), { style: 'margin-top:10px;' });
    const pinCb = Object.assign(document.createElement('input'), { type: 'checkbox', id: `pinned-${item.id}`, checked: !!item.isPinned });
    const pinLbl = Object.assign(document.createElement('label'), { htmlFor: `pinned-${item.id}`, textContent: '固定', style: 'margin-left:5px;color:#ccc;' });
    pinDiv.append(pinCb, pinLbl);
    
    div.append(topRow, charsInput, contentInput, detailsInput, pinDiv);

    saveBtn.onclick = (e) => {
      e.stopPropagation();
      const newTime = timeInput.value.trim();
      const newContent = contentInput.value.trim();
      if (!newTime || !newContent) return alert("时间和内容不能为空");

      transactionManagerModule.dispatch('updateEvent', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        eventId: item.id,
        eventData: {
          ...item,
          time: newTime,
          involvedCharacters: charsInput.value.trim().split(',').map(s => s.trim()).filter(Boolean),
          content: newContent,
          details: detailsInput.value.trim(),
          isPinned: pinCb.checked
        }
      }).then(() => settingsEventsListModule.renderPage());
    };

    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      settingsEventsListModule.renderPage();
    };

    const autoResize = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
    [contentInput, detailsInput].forEach(t => {
      t.addEventListener('input', () => autoResize(t));
      requestAnimationFrame(() => autoResize(t));
    });
    
    requestAnimationFrame(() => div.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  },

  removeEventItem: (eventId) => {
    transactionManagerModule.dispatch('deleteEvent', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      eventId
    }).then(() => settingsEventsListModule.renderPage());
  }
};