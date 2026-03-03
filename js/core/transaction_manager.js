const transactionManagerModule = {
  actions: {},

  _getResourceId(action, payload) {
    if (!payload) return null;

    let chatroomName = payload.chatroomName || payload.name || payload.oldName || payload.newChatroomName;

    if (action.includes('CONFIG_FIELDS') || action.includes('SAVE_GLOBAL_CONFIG') || action.includes('UPDATE_GLOBAL_CONFIG')) {
      return 'global_config';
    }

    if (chatroomName) {
      return `chatroom-${chatroomName}`;
    }

    if (action.includes('PARTITION') || action.includes('HISTORY') || action.includes('ROLE_STATES')) {
      const partition = stateModule.currentChatroomDetails.partitions.get(payload.partitionId);
      if (partition && stateModule.currentChatroomDetails.config.name) {
        return `chatroom-${stateModule.currentChatroomDetails.config.name}`;
      }
    }

    return null;
  },

  async _processNextInQueue(resourceId) {
    if (!resourceId) return;

    const queue = stateModule.transactionQueues.get(resourceId);
    if (queue && queue.length > 0) {
      const nextTask = queue.shift();
      await this._executeTransaction(nextTask.action, nextTask.payload, nextTask.resolve, nextTask.reject);
    } else {
      stateModule.lockedResources.delete(resourceId);
      if (queue) {
        stateModule.transactionQueues.delete(resourceId);
      }
    }
  },

  async _executeTransaction(action, payload, resolve, reject) {
    const resourceId = this._getResourceId(action, payload);
    if (stateModule.config.debugMode) {
      console.groupCollapsed(`%c[Transaction START] %c${action}`, 'color: #999;', 'color: #e0c2a3; font-weight: bold;');
      try {
        console.log('Payload:', JSON.parse(JSON.stringify(payload)));
      } catch (e) {
        console.log('Payload (Raw):', payload);
      }
      console.groupEnd();
    }
    try {
      if (this.actions[action]) {
        const result = await this.actions[action](payload);
        
        if (result && result.success) {
            if (result.changes) {
                incrementalUpdateHandlerModule.processChanges(result.changes);
            }
            if (action === 'UPDATE_GLOBAL_CONFIG' || action === 'UPDATE_CONFIG_FIELDS') {
                systemTriggersModule.updateModelToggleButtonVisual();
            }
            if (stateModule.config.debugMode) {
                console.log(`%c[Transaction SUCCESS] %c${action}`, 'color: #4CAF50;', 'font-weight: bold;');
            }
            resolve(result);
        } else if (result && result.success === false) {
          throw new Error(result.error?.message || `Action '${action}' failed without a specific error message.`);
        } else {
          if (stateModule.config.debugMode) {
            console.log(`%c[Transaction SKIPPED/VOID] %c${action}`, 'color: #9E9E9E;', 'font-weight: normal;');
          }
          resolve();
        }
      } else {
        throw new Error(`Action '${action}' not found in transaction manager.`);
      }
    } catch (e) {
      if (stateModule.config.debugMode) {
        console.groupCollapsed(`%c[Transaction FAILED] %c${action}`, 'color: #F44336;', 'font-weight: bold;');
        console.error('Error during execution:', e);
        console.groupEnd();
      }
      _logAndDisplayError(`Error during transaction execution for action '${action}': ${e.message}`, 'transactionManager._executeTransaction');
      reject(e);
    } finally {
      this._processNextInQueue(resourceId);
    }
  },

  dispatch(action, payload) {
    return new Promise((resolve, reject) => {
      const resourceId = this._getResourceId(action, payload);
      if (!resourceId) {
        if (stateModule.config.debugMode) {
          console.warn(`[Transaction WARN] Could not determine resource ID for action '${action}'. Executing without queue.`);
        }
        _logAndDisplayError(`Could not determine resource ID for action '${action}'. Executing without queue.`, 'transactionManager.dispatch');
        if (this.actions[action]) {
          this.actions[action](payload).then(resolve).catch(reject);
        } else {
          reject(new Error(`Action '${action}' not found.`));
        }
        return;
      }

      if (!stateModule.transactionQueues.has(resourceId)) {
        stateModule.transactionQueues.set(resourceId, []);
      }
      const queue = stateModule.transactionQueues.get(resourceId);

      if (stateModule.lockedResources.has(resourceId)) {
        queue.push({
          action,
          payload,
          resolve,
          reject
        });
      } else {
        stateModule.lockedResources.add(resourceId);
        this._executeTransaction(action, payload, resolve, reject);
      }
    });
  },

  init: function() {
    this.actions = {
      SAVE_GLOBAL_CONFIG: (payload) => {
        const updates = {};
        for (const key in stateModule.config) {
          updates[key] = stateModule.config[key];
        }
        return apiClientConfigModule.updateConfigFieldsAsync(updates);
      },
      UPDATE_GLOBAL_CONFIG: (payload) => {
        return apiClientConfigModule.updateConfigFieldsAsync(payload);
      },
      UPDATE_CONFIG_FIELDS: (payload) => {
        return apiClientConfigModule.updateConfigFieldsAsync(payload.updates);
      },
      SWITCH_CHATROOM: async (payload) => {
          const { newChatroomName } = payload;
          if (stateModule.config.activeChatRoomName === newChatroomName && !stateModule.isSwitchingChatroom) return;

          stateModule.isSwitchingChatroom = true;
          const loadingOverlay = document.getElementById('global-loading-overlay');
          if (loadingOverlay) loadingOverlay.classList.add('active');
          uiChatImageViewerModule.hideImageViewer();
          if (elementsModule.chatContainer) {
            elementsModule.chatContainer.style.backgroundImage = '';
          }
          
          partitionRendererModule.clearAllPartitionCaches();

          const updateResult = await apiClientConfigModule.updateConfigFieldsAsync({ 'activeChatRoomName': newChatroomName });

          if (!updateResult.success) {
              _logAndDisplayError(`Failed to update active chatroom on backend: ${updateResult.error?.message}`, 'SWITCH_CHATROOM');
              if (loadingOverlay) loadingOverlay.classList.remove('active');
              stateModule.isSwitchingChatroom = false;
              return updateResult;
          }
          
          if (updateResult.changes) {
              incrementalUpdateHandlerModule.processChanges(updateResult.changes);
          }

          const loadResult = await apiClientConfigModule.loadInitialData();

          if (loadResult.success) {
              eventBus.emit('GLOBAL_STATE_FULL_UPDATE', loadResult.data);
              eventBus.emit('UI_REFRESH_CHATROOM_BACKGROUND');
              eventBus.emit('UI_REFRESH_CHATROOM_COMPONENTS');
          } else {
              _logAndDisplayError(`Failed to load initial data after switching chatroom: ${loadResult.error?.message}`, 'SWITCH_CHATROOM');
              if (loadingOverlay) loadingOverlay.classList.remove('active');
              stateModule.isSwitchingChatroom = false;
          }
          
          return loadResult;
      },
      SWITCH_ACTIVE_PARTITION: async (payload) => {
        const {
          partitionId
        } = payload;
        const chatroomName = stateModule.currentChatroomDetails.config.name;
        const updates = {
          [`activePartitionIdByChatroom.${chatroomName}`]: partitionId
        };
        return await this.dispatch('UPDATE_CONFIG_FIELDS', {
          updates
        });
      },
      CREATE_CHATROOM: (payload) => {
        return apiClientChatroomsModule.createChatroom(payload);
      },
      DELETE_CHATROOM: (payload) => {
        return apiClientChatroomsModule.deleteChatroom(payload);
      },
      RENAME_CHATROOM: (payload) => {
        return apiClientChatroomsModule.renameChatroom(payload);
      },
      UPDATE_CHATROOM: (payload) => {
        return apiClientChatroomsModule.updateChatroom(payload);
      },
      CREATE_PARTITION: (payload) => {
        return apiClientChatroomsModule.createPartition(payload);
      },
      DELETE_PARTITION: (payload) => {
        return apiClientChatroomsModule.deletePartition(payload);
      },
      UPDATE_PARTITION_FIELDS: (payload) => {
        return apiClientChatroomsModule.updatePartitionFields(payload);
      },
      ADD_HISTORY_MESSAGE: (payload) => {
        return apiClientChatroomsModule.addHistoryMessage(payload);
      },
      UPDATE_HISTORY_MESSAGE: (payload) => {
        return apiClientChatroomsModule.updateHistoryMessage(payload);
      },
      DELETE_HISTORY_MESSAGE: (payload) => {
        return apiClientChatroomsModule.deleteHistoryMessage(payload);
      },
      DELETE_HISTORY_FROM: (payload) => {
        return apiClientChatroomsModule.deleteHistoryFrom(payload);
      },
      UPDATE_PARTITION_ROLE_STATES: (payload) => {
        return apiClientChatroomsModule.updatePartitionRoleStates(payload);
      },
      CREATE_ROLE: (payload) => {
        return apiClientChatroomsModule.createRole(payload);
      },
      UPDATE_ROLE_FIELDS: (payload) => {
        return apiClientChatroomsModule.updateRoleFields(payload);
      },
      UPDATE_ROLE_MEMORY_ONLY: (payload) => {
        return apiClientChatroomsModule.updateRoleMemoryOnly(payload);
      },
      DELETE_ROLE: (payload) => {
        return apiClientChatroomsModule.deleteRole(payload);
      },
      ADD_ROLE_MEMORY: (payload) => {
        return apiClientChatroomsModule.addRoleMemory(payload);
      },
      UPDATE_ROLE_MEMORY: (payload) => {
        return apiClientChatroomsModule.updateRoleMemory(payload);
      },
      DELETE_ROLE_MEMORY: (payload) => {
        return apiClientChatroomsModule.deleteRoleMemory(payload);
      },
      ADD_ROLE_PUBLIC_INFO: (payload) => {
        return apiClientChatroomsModule.addRolePublicInfo(payload);
      },
      UPDATE_ROLE_PUBLIC_INFO: (payload) => {
        return apiClientChatroomsModule.updateRolePublicInfo(payload);
      },
      DELETE_ROLE_PUBLIC_INFO: (payload) => {
        return apiClientChatroomsModule.deleteRolePublicInfo(payload);
      },
      CREATE_NOVEL: (payload) => {
        return apiClientChatroomsModule.createNovel(payload);
      },
      UPDATE_NOVEL: (payload) => {
        return apiClientChatroomsModule.updateNovel(payload);
      },
      UPDATE_NOVEL_TOC_ENTRY: (payload) => {
        return apiClientChatroomsModule.updateNovelTocEntry(payload);
      },
      DELETE_NOVEL: (payload) => {
        return apiClientChatroomsModule.deleteNovel(payload);
      },
      REPLACE_NOVEL_CONTENT: (payload) => {
        return apiClientChatroomsModule.replaceNovelContent(payload);
      },
      SET_BACKGROUND: (payload) => {
        return apiClientChatroomsModule.setBackground(payload);
      },
      DELETE_BACKGROUND: (payload) => {
        return apiClientChatroomsModule.deleteBackground(payload);
      },
      addEvent: (payload) => {
        return apiClientChatroomsModule.addEvent(payload);
      },
      updateEvent: (payload) => {
        return apiClientChatroomsModule.updateEvent(payload);
      },
      deleteEvent: (payload) => {
        return apiClientChatroomsModule.deleteEvent(payload);
      },
    };
  }
};