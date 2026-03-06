const transactionManagerModule = {
  actions: {},

  _getResourceId(action, payload) {
    if (!payload) return 'global';
    if (action.includes('CONFIG')) return 'global_config';
    if (payload.chatroomName) return `chatroom-${payload.chatroomName}`;
    return 'global';
  },

  async _executeTransaction(action, payload, resolve, reject) {
    const resourceId = this._getResourceId(action, payload);

    try {
      const result = await this.actions[action](payload);
      
      if (result && result.success === false) {
        throw new Error(result.error?.message || `Transaction '${action}' failed without error message.`);
      }

      if (result && result.changes) {
        incrementalUpdateHandlerModule.processChanges(result.changes);
      }
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this._processNextInQueue(resourceId);
    }
  },

  async _processNextInQueue(resourceId) {
    const queue = stateModule.transactionQueues.get(resourceId);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      this._executeTransaction(next.action, next.payload, next.resolve, next.reject);
    } else {
      stateModule.lockedResources.delete(resourceId);
      if (queue) stateModule.transactionQueues.delete(resourceId);
    }
  },

  dispatch(action, payload) {
    return new Promise((resolve, reject) => {
      const resourceId = this._getResourceId(action, payload);
      
      if (!stateModule.transactionQueues.has(resourceId)) {
        stateModule.transactionQueues.set(resourceId, []);
      }
      
      const queue = stateModule.transactionQueues.get(resourceId);

      if (stateModule.lockedResources.has(resourceId)) {
        queue.push({ action, payload, resolve, reject });
      } else {
        stateModule.lockedResources.add(resourceId);
        this._executeTransaction(action, payload, resolve, reject);
      }
    });
  },

  init: function() {
    this.actions = {
      SAVE_GLOBAL_CONFIG: () => apiClientConfigModule.updateConfigFieldsAsync(stateModule.config),
      UPDATE_GLOBAL_CONFIG: (p) => apiClientConfigModule.updateConfigFieldsAsync(p),
      UPDATE_CONFIG_FIELDS: (p) => apiClientConfigModule.updateConfigFieldsAsync(p.updates),
      
      SWITCH_CHATROOM: async (p) => {
        stateModule.isSwitchingChatroom = true;
        document.getElementById('global-loading-overlay')?.classList.add('active');
        partitionRendererModule.clearAllPartitionCaches();

        const res = await apiClientConfigModule.updateConfigFieldsAsync({ 'activeChatRoomName': p.newChatroomName });
        if (res.success && res.changes) incrementalUpdateHandlerModule.processChanges(res.changes);

        const loadRes = await apiClientConfigModule.loadInitialData();
        if (loadRes.success) {
          eventBus.emit('GLOBAL_STATE_FULL_UPDATE', loadRes.data);
          eventBus.emit('UI_REFRESH_CHATROOM_BACKGROUND');
          eventBus.emit('UI_REFRESH_CHATROOM_COMPONENTS');
        }
        
        stateModule.isSwitchingChatroom = false;
        document.getElementById('global-loading-overlay')?.classList.remove('active');
        return loadRes;
      },

      SWITCH_ACTIVE_PARTITION: async (p) => {
        const room = stateModule.currentChatroomDetails.config.name;
        return await apiClientConfigModule.updateConfigFieldsAsync({ [`activePartitionIdByChatroom.${room}`]: p.partitionId });
      },

      CREATE_CHATROOM: apiClientChatroomsModule.createChatroom,
      DELETE_CHATROOM: apiClientChatroomsModule.deleteChatroom,
      RENAME_CHATROOM: apiClientChatroomsModule.renameChatroom,
      UPDATE_CHATROOM: apiClientChatroomsModule.updateChatroom,
      CREATE_PARTITION: apiClientChatroomsModule.createPartition,
      DELETE_PARTITION: apiClientChatroomsModule.deletePartition,
      UPDATE_PARTITION_FIELDS: apiClientChatroomsModule.updatePartitionFields,
      ADD_HISTORY_MESSAGE: apiClientChatroomsModule.addHistoryMessage,
      UPDATE_HISTORY_MESSAGE: apiClientChatroomsModule.updateHistoryMessage,
      DELETE_HISTORY_MESSAGE: apiClientChatroomsModule.deleteHistoryMessage,
      DELETE_HISTORY_FROM: apiClientChatroomsModule.deleteHistoryFrom,
      CREATE_ROLE: apiClientChatroomsModule.createRole,
      UPDATE_ROLE_FIELDS: apiClientChatroomsModule.updateRoleFields,
      UPDATE_ROLE_MEMORY_ONLY: apiClientChatroomsModule.updateRoleMemoryOnly,
      DELETE_ROLE: apiClientChatroomsModule.deleteRole,
      ADD_ROLE_MEMORY: apiClientChatroomsModule.addRoleMemory,
      UPDATE_ROLE_MEMORY: apiClientChatroomsModule.updateRoleMemory,
      DELETE_ROLE_MEMORY: apiClientChatroomsModule.deleteRoleMemory,
      ADD_ROLE_PUBLIC_INFO: apiClientChatroomsModule.addRolePublicInfo,
      UPDATE_ROLE_PUBLIC_INFO: apiClientChatroomsModule.updateRolePublicInfo,
      DELETE_ROLE_PUBLIC_INFO: apiClientChatroomsModule.deleteRolePublicInfo,
      CREATE_NOVEL: apiClientChatroomsModule.createNovel,
      UPDATE_NOVEL: apiClientChatroomsModule.updateNovel,
      UPDATE_NOVEL_TOC_ENTRY: apiClientChatroomsModule.updateNovelTocEntry,
      DELETE_NOVEL: apiClientChatroomsModule.deleteNovel,
      REPLACE_NOVEL_CONTENT: apiClientChatroomsModule.replaceNovelContent,
      SET_BACKGROUND: apiClientChatroomsModule.setBackground,
      DELETE_BACKGROUND: apiClientChatroomsModule.deleteBackground,
      addEvent: apiClientChatroomsModule.addEvent,
      updateEvent: apiClientChatroomsModule.updateEvent,
      deleteEvent: apiClientChatroomsModule.deleteEvent,
    };
  }
};