const settingsChatroomDirModule = {
  init: () => {
    elementsModule.addChatroomButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsChatroomDirModule.addChatroomFromSettings();
    });
    elementsModule.chatroomListContainer.addEventListener('change', (event) => {
      if (stateModule.isCooldownActive) return;
      const targetRadio = event.target;
      if (targetRadio.type === 'radio' && targetRadio.name === 'activeChatroom') {
        settingsChatroomDirModule.switchActiveChatroom(targetRadio.value);
      }
    });
    elementsModule.chatroomListContainer.addEventListener('click', (event) => {
      if (stateModule.isCooldownActive) return;
      const roomItem = event.target.closest('.chatroom-item');
      if (!roomItem) return;
      const roomName = roomItem.dataset.roomName;
      if (event.target.closest('label')) {
        const radio = roomItem.querySelector('input[type="radio"]');
        if (!radio.checked) {
          settingsChatroomDirModule.switchActiveChatroom(roomName);
        }
        settingsPageManagerModule.showChatroomDetailPage(roomName);
      } else if (event.target.classList.contains('item-rename')) {
        settingsChatroomDirModule.renameChatroomFromList(roomName);
      } else if (event.target.classList.contains('item-export')) {
        window.location.href = '/export-chatroom-zip/' + encodeURIComponent(roomName);
      } else if (event.target.classList.contains('item-delete')) {
        settingsChatroomDirModule.deleteChatroomFromList(roomName);
      }
    });
    elementsModule.importChatroomButton.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsChatroomDirModule.importChatroomFromSettings();
    });
    elementsModule.importChatroomFile.addEventListener('change', settingsChatroomDirModule.handleImportChatroomFile);
    eventBus.on('UI_UPDATE_GLOBAL', () => {
      settingsChatroomDirModule.updateChatroomList();
    });
  },
  _createChatroomListItem: (roomName) => {
    const item = document.createElement('div');
    item.className = 'chatroom-item';
    item.dataset.roomName = roomName;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'activeChatroom';
    radio.value = roomName;
    radio.id = `chatroom-${roomName.replace(/\s+/g, '_')}`;
    if (roomName === stateModule.config.activeChatRoomName) radio.checked = true;

    const label = document.createElement('label');
    label.textContent = roomName;
    label.setAttribute('for', radio.id);

    item.appendChild(radio);
    item.appendChild(label);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    const renameButton = document.createElement('div');
    renameButton.className = 'std-button item-rename';
    renameButton.textContent = '✎';
    renameButton.style.width = '28px';
    renameButton.style.height = '28px';
    const exportButton = document.createElement('div');
    exportButton.className = 'std-button item-export';
    exportButton.textContent = '📥';
    exportButton.style.width = '28px';
    exportButton.style.height = '28px';
    const deleteButton = document.createElement('div');
    deleteButton.className = 'std-button item-delete';
    deleteButton.textContent = '✕';
    deleteButton.style.width = '28px';
    deleteButton.style.height = '28px';
    actionsDiv.appendChild(renameButton);
    actionsDiv.appendChild(exportButton);
    actionsDiv.appendChild(deleteButton);
    item.appendChild(actionsDiv);

    return item;
  },
  updateChatroomList: () => {
    const frag = document.createDocumentFragment();
    const rooms = stateModule.config.chatRoomOrder;
    rooms.forEach(roomName => {
      frag.appendChild(settingsChatroomDirModule._createChatroomListItem(roomName));
    });
    elementsModule.chatroomListContainer.innerHTML = '';
    elementsModule.chatroomListContainer.appendChild(frag);
  },
  switchActiveChatroom: (name) => {
    transactionManagerModule.dispatch('SWITCH_CHATROOM', {
      newChatroomName: name
    });
  },
  addChatroomFromSettings: () => {
    const name = prompt("请输入新聊天室名称:");
    if (!name || name.trim() === "") return;
    transactionManagerModule.dispatch('CREATE_CHATROOM', {
      name: name.trim()
    });
  },
  renameChatroomFromList: (oldName) => {
    const newName = prompt(`输入聊天室 "${oldName}" 的新名称:`, oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    transactionManagerModule.dispatch('RENAME_CHATROOM', {
      oldName,
      newName: newName.trim()
    });
  },
  deleteChatroomFromList: (nameToDelete) => {
    if (!confirm(`确定要删除聊天室 "${nameToDelete}" 吗？此操作不可恢复！`)) {
      return;
    }
    transactionManagerModule.dispatch('DELETE_CHATROOM', {
      chatroomName: nameToDelete
    });
  },
  importChatroomFromSettings: () => {
    elementsModule.importChatroomFile.click();
  },
  handleImportChatroomFile: async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const validExtensions = ['.zip', '.png', '.jpg', '.jpeg', '.webp'];
    const fileNameLower = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileNameLower.endsWith(ext))) {
      alert('请选择一个图片卡或 .zip 文件进行导入。');
      event.target.value = null;
      return;
    }
    const formData = new FormData();
    formData.append('chatroom_zip', file);
    const result = await apiServiceModule.performApiCall('/import-chatroom-zip', 'POST', formData, {}, null, true);
    if (result.success) {
      alert("聊天室导入成功！");
      if (result.changes) incrementalUpdateHandlerModule.processChanges(result.changes);
    } else {
      alert(`导入聊天室失败: ${result.error.message}`);
    }
    event.target.value = null;
  }
};