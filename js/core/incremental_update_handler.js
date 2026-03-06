const incrementalUpdateHandlerModule = {
  processChanges: (changes) => {
    const oldActiveChatroomName = stateModule.config.activeChatRoomName;
    const oldActivePartitionId = stateModule.activePartitionId;
    
    let hasHistoryChange = false;
    let hasBackgroundChange = false;
    let hasComponentChange = false;

    changes.forEach(change => {
      const { type, payload } = change;
      
      stateManager.commit(type, payload);

      if (type === 'CREATE_PARTITION') {
        const newId = payload.partition.id;
        if (!stateModule.partitionDOMCache.has(newId)) {
          const container = document.createElement('div');
          container.dataset.partitionId = newId;
          container.style.display = 'none';
          elementsModule.chatArea.appendChild(container);
          stateModule.partitionDOMCache.set(newId, container);
        }
      }

      if (['ADD_HISTORY_MESSAGE', 'UPDATE_HISTORY_MESSAGE', 'DELETE_HISTORY_MESSAGE', 'UPDATE_PARTITION_HISTORY'].includes(type)) {
        hasHistoryChange = true;
        eventBus.emit('HISTORY_CHANGED', { type, payload });
      }
      if (['SET_BACKGROUND', 'DELETE_BACKGROUND'].includes(type)) {
        hasBackgroundChange = true;
      }
      if (['UPDATE_PARTITION', 'DELETE_PARTITION', 'CREATE_PARTITION', 'DELETE_ROLE', 'UPSERT_ROLE', 'UPDATE_ROLE', 'CREATE_NOVEL', 'DELETE_NOVEL', 'UPSERT_ROLE_MEMORY', 'UPSERT_EVENT'].includes(type)) {
        hasComponentChange = true;
      }
    });

    const newActiveChatroomName = stateModule.config.activeChatRoomName;
    if (oldActiveChatroomName !== newActiveChatroomName) {
      transactionManagerModule.dispatch('SWITCH_CHATROOM', { newChatroomName: newActiveChatroomName });
      return; 
    }

    if (oldActivePartitionId !== stateModule.activePartitionId) {
      eventBus.emit('PARTITION_SWITCHED', { newPartitionId: stateModule.activePartitionId });
    }

    if (hasBackgroundChange) eventBus.emit('UI_REFRESH_CHATROOM_BACKGROUND');
    if (hasComponentChange) eventBus.emit('UI_REFRESH_CHATROOM_COMPONENTS');

    const globalChangeTypes = ['CREATE_CHATROOM', 'DELETE_CHATROOM', 'RENAME_CHATROOM', 'UPDATE_GLOBAL_CONFIG', 'RESET_ALL', 'CREATE_KNOWLEDGE_GROUP', 'DELETE_KNOWLEDGE_GROUP', 'ADD_KNOWLEDGE_ENTRY', 'UPDATE_KNOWLEDGE_ENTRY', 'DELETE_KNOWLEDGE_ENTRY', 'RENAME_KNOWLEDGE_GROUP'];
    if (changes.some(c => globalChangeTypes.includes(c.type))) {
      eventBus.emit('UI_UPDATE_GLOBAL');
    }
  }
};