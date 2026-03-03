const mutations = {
  SET_INITIAL_DATA(state, payload) {
    const {
      globalConfig,
      chatroomDetails
    } = payload;

    if (globalConfig) {
      Object.assign(state.config, globalConfig);
    }

    if (chatroomDetails && chatroomDetails.config) {
      state.currentChatroomDetails.config = chatroomDetails.config;
      state.currentChatroomDetails.roles = chatroomDetails.roles || [];
      state.currentChatroomDetails.novels = chatroomDetails.novels || [];
      state.currentChatroomDetails.events = chatroomDetails.events || [];

      state.currentChatroomDetails.partitions.clear();
      if (Array.isArray(chatroomDetails.partitions)) {
        chatroomDetails.partitions.forEach(p => {
          if (p && p.id) {
            state.currentChatroomDetails.partitions.set(p.id, p);
          }
        });
      }
    } else {
      state.currentChatroomDetails = {
        config: JSON.parse(JSON.stringify(defaultChatroomConfig)),
        roles: [],
        novels: [],
        partitions: new Map(),
        events: []
      };
    }

    const activeChatroomName = state.config.activeChatRoomName;
    if (activeChatroomName) {
      state.activePartitionId = state.config.activePartitionIdByChatroom?.[activeChatroomName] ||
        state.currentChatroomDetails.config.activePartitionId ||
        null;
    } else {
      state.activePartitionId = null;
    }
  },

  RESET_ALL(state, payload) {
    mutations.SET_INITIAL_DATA(state, payload);
  },

  CREATE_CHATROOM(state, payload) {
    Object.assign(state.config, payload.globalConfig);
    if (state.config.activeChatRoomName === payload.name) {
      state.currentChatroomDetails.config = payload.config;
      state.currentChatroomDetails.partitions.clear();
      (payload.partitions || []).forEach(p => state.currentChatroomDetails.partitions.set(p.id, p));
      state.currentChatroomDetails.roles = payload.roles || [];
      state.currentChatroomDetails.novels = payload.novels || [];
      state.currentChatroomDetails.events = payload.events || [];
    }
  },

  DELETE_CHATROOM(state, payload) {
    Object.assign(state.config, payload.globalConfig);
    if (state.config.activeChatRoomName === payload.newActiveChatroomName) {
      apiClientChatroomsModule.fetchChatroomDetails(payload.newActiveChatroomName).then(details => {
        if (details) {
          stateManager.commit('SET_INITIAL_DATA', {
            globalConfig: state.config,
            chatroomDetails: details
          });
        }
      });
    } else if (state.config.activeChatRoomName === null) {
      mutations.SET_INITIAL_DATA(state, {
        globalConfig: state.config,
        chatroomDetails: null
      });
    }
  },

  RENAME_CHATROOM(state, payload) {
    Object.assign(state.config, payload.globalConfig);
    if (state.currentChatroomDetails.config.name === payload.oldName) {
      state.currentChatroomDetails.config.name = payload.newName;
    }
  },

  UPDATE_GLOBAL_CONFIG(state, payload) {
    if (payload.globalConfig) {
      Object.assign(state.config, payload.globalConfig);
      const activeChatroomName = state.config.activeChatRoomName;
      if (activeChatroomName) {
        state.activePartitionId = state.config.activePartitionIdByChatroom?.[activeChatroomName] || state.activePartitionId;
      }
    } else if (payload.updates) {
      for (const path in payload.updates) {
        const keys = path.split('.');
        let current = state.config;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = payload.updates[path];
      }
      const activeChatroomName = state.config.activeChatRoomName;
      if (activeChatroomName) {
        state.activePartitionId = state.config.activePartitionIdByChatroom?.[activeChatroomName] || state.activePartitionId;
      }
    }
  },

  UPDATE_CHATROOM_CONFIG(state, payload) {
    if (state.currentChatroomDetails.config.name === payload.chatroomName) {
      Object.assign(state.currentChatroomDetails.config, payload.updates);
    }
  },

  SET_BACKGROUND(state, payload) {
    if (state.currentChatroomDetails.config.name === payload.chatroomName) {
      state.currentChatroomDetails.config.backgroundImageFilename = payload.backgroundImageFilename;
    }
  },

  DELETE_BACKGROUND(state, payload) {
    if (state.currentChatroomDetails.config.name === payload.chatroomName) {
      state.currentChatroomDetails.config.backgroundImageFilename = null;
    }
  },

  CREATE_PARTITION(state, payload) {
    const {
      partition
    } = payload;
    state.currentChatroomDetails.partitions.set(partition.id, partition);
    if (!state.currentChatroomDetails.config.partitionsOrder.includes(partition.id)) {
      state.currentChatroomDetails.config.partitionsOrder.push(partition.id);
    }
  },

  DELETE_PARTITION(state, payload) {
    const {
      partitionId
    } = payload;
    state.currentChatroomDetails.partitions.delete(partitionId);
    state.currentChatroomDetails.config.partitionsOrder = state.currentChatroomDetails.config.partitionsOrder.filter(id => id !== partitionId);
    if (state.activePartitionId === partitionId) {
      state.activePartitionId = state.currentChatroomDetails.config.partitionsOrder[0] || null;
      state.currentChatroomDetails.config.activePartitionId = state.activePartitionId;
    }
  },

  UPDATE_PARTITION(state, payload) {
    const {
      partitionId,
      updates
    } = payload;
    if (state.currentChatroomDetails.partitions.has(partitionId)) {
      const partition = state.currentChatroomDetails.partitions.get(partitionId);
      Object.assign(partition, updates);
    }
  },

  UPDATE_PARTITION_HISTORY(state, payload) {
    const {
      partitionId,
      newHistory
    } = payload;
    if (state.currentChatroomDetails.partitions.has(partitionId)) {
      state.currentChatroomDetails.partitions.get(partitionId).history = newHistory;
    }
  },

  UPSERT_ROLE(state, payload) {
    const index = state.currentChatroomDetails.roles.findIndex(r => r.name === payload.role.name);
    if (index > -1) {
      state.currentChatroomDetails.roles[index] = payload.role;
    } else {
      state.currentChatroomDetails.roles.push(payload.role);
    }
  },

  DELETE_ROLE(state, payload) {
    state.currentChatroomDetails.roles = state.currentChatroomDetails.roles.filter(r => r.name !== payload.roleName);
  },

  UPDATE_ROLE(state, payload) {
    const index = state.currentChatroomDetails.roles.findIndex(r => r.name === payload.roleName);
    if (index > -1) {
      Object.assign(state.currentChatroomDetails.roles[index], payload.updatedRole);
    }
  },

  ADD_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role) {
      if (!Array.isArray(role.memory)) role.memory = [];
      role.memory.push(payload.memoryItem);
    }
  },

  UPDATE_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role && Array.isArray(role.memory)) {
      const index = role.memory.findIndex(m => m.id === payload.memoryId);
      if (index > -1) {
        role.memory[index] = payload.memoryItem;
      }
    }
  },
  
  UPSERT_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role) {
        if (!Array.isArray(role.memory)) role.memory = [];
        const index = role.memory.findIndex(m => m.time === payload.memoryItem.time || m.id === payload.memoryItem.id);
        if (index > -1) {
            role.memory[index] = payload.memoryItem;
        } else {
            role.memory.push(payload.memoryItem);
        }
    }
  },

  DELETE_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role && Array.isArray(role.memory)) {
      role.memory = role.memory.filter(m => m.id !== payload.memoryId);
    }
  },

  ADD_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role) {
      if (!Array.isArray(role.publicInfo)) role.publicInfo = [];
      role.publicInfo.push(payload.infoItem);
    }
  },

  UPDATE_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role && Array.isArray(role.publicInfo)) {
      const index = role.publicInfo.findIndex(i => i.id === payload.infoId);
      if (index > -1) {
        role.publicInfo[index] = payload.infoItem;
      }
    }
  },

  DELETE_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    if (role && Array.isArray(role.publicInfo)) {
      role.publicInfo = role.publicInfo.filter(i => i.id !== payload.infoId);
    }
  },

  CREATE_NOVEL(state, payload) {
    state.currentChatroomDetails.novels.push(payload.novel);
  },

  UPDATE_NOVEL(state, payload) {
    const index = state.currentChatroomDetails.novels.findIndex(n => n.id === payload.novelId);
    if (index > -1) {
      state.currentChatroomDetails.novels[index] = payload.updatedNovel;
    }
  },

  UPDATE_NOVEL_TOC(state, payload) {
    const novelIndex = state.currentChatroomDetails.novels.findIndex(n => n.id === payload.novelId);
    if (novelIndex > -1) {
      const novel = state.currentChatroomDetails.novels[novelIndex];
      if (novel.toc && novel.toc[payload.tocIndex]) {
        novel.toc[payload.tocIndex] = payload.tocEntry;
      }
    }
  },

  DELETE_NOVEL(state, payload) {
    state.currentChatroomDetails.novels = state.currentChatroomDetails.novels.filter(n => n.id !== payload.novelId);
  },

  ADD_EVENT(state, payload) {
    state.currentChatroomDetails.events.push(payload.eventItem);
  },
  
  UPSERT_EVENT(state, payload) {
      const index = state.currentChatroomDetails.events.findIndex(e => e.time === payload.eventItem.time || e.id === payload.eventItem.id);
      if (index > -1) {
          state.currentChatroomDetails.events[index] = payload.eventItem;
      } else {
          state.currentChatroomDetails.events.push(payload.eventItem);
      }
  },

  UPDATE_EVENT(state, payload) {
    const index = state.currentChatroomDetails.events.findIndex(e => e.id === payload.eventId);
    if (index > -1) {
      state.currentChatroomDetails.events[index] = payload.eventItem;
    }
  },

  DELETE_EVENT(state, payload) {
    state.currentChatroomDetails.events = state.currentChatroomDetails.events.filter(e => e.id !== payload.eventId);
  },

  ADD_HISTORY_MESSAGE(state, payload) {
    const {
      partitionId,
      message
    } = payload;
    if (state.currentChatroomDetails.partitions.has(partitionId)) {
      const partition = state.currentChatroomDetails.partitions.get(partitionId);
      if (!Array.isArray(partition.history)) partition.history = [];
      partition.history.push(message);
    }
  },

  UPDATE_HISTORY_MESSAGE(state, payload) {
    const {
      partitionId,
      messageId,
      updates
    } = payload;
    if (state.currentChatroomDetails.partitions.has(partitionId)) {
      const partition = state.currentChatroomDetails.partitions.get(partitionId);
      const index = partition.history.findIndex(msg => msg.id === messageId);
      if (index > -1) {
        Object.assign(partition.history[index], updates);
      }
    }
  },

  DELETE_HISTORY_MESSAGE(state, payload) {
    const {
      partitionId,
      messageId
    } = payload;
    if (state.currentChatroomDetails.partitions.has(partitionId)) {
      const partition = state.currentChatroomDetails.partitions.get(partitionId);
      partition.history = partition.history.filter(msg => msg.id !== messageId);
    }
  },

  CREATE_KNOWLEDGE_GROUP(state, payload) {},
  DELETE_KNOWLEDGE_GROUP(state, payload) {},
  RENAME_KNOWLEDGE_GROUP(state, payload) {},
  ADD_KNOWLEDGE_ENTRY(state, payload) {},
  UPDATE_KNOWLEDGE_ENTRY(state, payload) {},
  DELETE_KNOWLEDGE_ENTRY(state, payload) {},
};