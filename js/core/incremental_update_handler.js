const incrementalUpdateHandlerModule = {
  processChanges: (changes) => {
    if (!Array.isArray(changes)) return;

    const historyChangeTypes = new Set(['ADD_HISTORY_MESSAGE', 'UPDATE_HISTORY_MESSAGE', 'DELETE_HISTORY_MESSAGE', 'UPDATE_PARTITION_HISTORY']);
    let hasHistoryChange = false;
    let hasBackgroundChange = false;
    let hasComponentChange = false;

    const oldActivePartitionId = stateModule.activePartitionId;
    const oldActiveChatroomName = stateModule.config.activeChatRoomName;

    changes.forEach(change => {
      const {
        type,
        payload
      } = change;
      if (mutations[type]) {
        stateManager.commit(type, payload);
        if (type === 'CREATE_PARTITION') {
          const newPartitionId = payload.partition.id;
          if (!stateModule.partitionDOMCache.has(newPartitionId)) {
            const partitionContainer = document.createElement('div');
            partitionContainer.dataset.partitionId = newPartitionId;
            partitionContainer.style.display = 'none';
            elementsModule.chatArea.appendChild(partitionContainer);
            stateModule.partitionDOMCache.set(newPartitionId, partitionContainer);
          }
        }
        if (historyChangeTypes.has(type)) {
          hasHistoryChange = true;
          eventBus.emit('HISTORY_CHANGED', {
            type: type,
            payload: payload
          });
        }
        if (type === 'SET_BACKGROUND' || type === 'DELETE_BACKGROUND') {
          hasBackgroundChange = true;
        }
        const componentChangeTypes = new Set(['UPDATE_PARTITION', 'DELETE_PARTITION', 'CREATE_PARTITION', 'DELETE_ROLE', 'UPSERT_ROLE', 'UPDATE_ROLE', 'CREATE_NOVEL', 'DELETE_NOVEL', 'UPSERT_ROLE_MEMORY', 'UPSERT_EVENT']);
        if (componentChangeTypes.has(type)) {
          hasComponentChange = true;
        }
        if (type === 'UPDATE_NOVEL_TOC') {
        }

      } else {
        _logAndDisplayError(`Unknown mutation type received from backend: ${type}`, 'incrementalUpdateHandler');
      }
    });

    const newActiveChatroomName = stateModule.config.activeChatRoomName;
    const newActivePartitionId = stateModule.activePartitionId;
    if (oldActiveChatroomName !== newActiveChatroomName) {
      transactionManagerModule.dispatch('SWITCH_CHATROOM', {
        newChatroomName: newActiveChatroomName
      });
      return;
    }

    if (oldActivePartitionId !== newActivePartitionId) {
      eventBus.emit('PARTITION_SWITCHED', {
        newPartitionId: newActivePartitionId
      });
    }

    if (hasBackgroundChange) {
      eventBus.emit('UI_REFRESH_CHATROOM_BACKGROUND');
    }
    if (hasComponentChange) {
      eventBus.emit('UI_REFRESH_CHATROOM_COMPONENTS');
    }

    const hasGlobalChanges = changes.some(c => ['CREATE_CHATROOM', 'DELETE_CHATROOM', 'RENAME_CHATROOM', 'UPDATE_GLOBAL_CONFIG', 'RESET_ALL', 'CREATE_KNOWLEDGE_GROUP', 'DELETE_KNOWLEDGE_GROUP', 'ADD_KNOWLEDGE_ENTRY', 'UPDATE_KNOWLEDGE_ENTRY', 'DELETE_KNOWLEDGE_ENTRY', 'RENAME_KNOWLEDGE_GROUP'].includes(c.type));
    if (hasGlobalChanges) {
      eventBus.emit('UI_UPDATE_GLOBAL');
    }
  }
};