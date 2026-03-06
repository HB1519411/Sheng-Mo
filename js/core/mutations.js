const mutations = {
  SET_INITIAL_DATA(state, payload) {
    const { globalConfig, chatroomDetails } = payload;

    Object.assign(state.config, globalConfig);

    if (chatroomDetails) {
      state.currentChatroomDetails.config = chatroomDetails.config;
      state.currentChatroomDetails.roles = chatroomDetails.roles;
      state.currentChatroomDetails.novels = chatroomDetails.novels;
      state.currentChatroomDetails.events = chatroomDetails.events;

      state.currentChatroomDetails.partitions.clear();
      chatroomDetails.partitions.forEach(p => state.currentChatroomDetails.partitions.set(p.id, p));
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
      payload.partitions.forEach(p => state.currentChatroomDetails.partitions.set(p.id, p));
      state.currentChatroomDetails.roles = payload.roles;
      state.currentChatroomDetails.novels = payload.novels;
      state.currentChatroomDetails.events = payload.events;
    }
  },

  DELETE_CHATROOM(state, payload) {
    Object.assign(state.config, payload.globalConfig);
    if (state.config.activeChatRoomName === payload.newActiveChatroomName) {
      apiClientChatroomsModule.fetchChatroomDetails(payload.newActiveChatroomName).then(details => {
        stateManager.commit('SET_INITIAL_DATA', {
          globalConfig: state.config,
          chatroomDetails: details
        });
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
    state.currentChatroomDetails.config.name = payload.newName;
  },

  UPDATE_GLOBAL_CONFIG(state, payload) {
    if (payload.globalConfig) {
      Object.assign(state.config, payload.globalConfig);
    } else {
      for (const path in payload.updates) {
        const keys = path.split('.');
        let current = state.config;
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = payload.updates[path];
      }
    }
    const activeChatroomName = state.config.activeChatRoomName;
    if (activeChatroomName) {
      state.activePartitionId = state.config.activePartitionIdByChatroom?.[activeChatroomName] || state.activePartitionId;
    }
  },

  UPDATE_CHATROOM_CONFIG(state, payload) {
    Object.assign(state.currentChatroomDetails.config, payload.updates);
  },

  SET_BACKGROUND(state, payload) {
    state.currentChatroomDetails.config.backgroundImageFilename = payload.backgroundImageFilename;
  },

  DELETE_BACKGROUND(state, payload) {
    state.currentChatroomDetails.config.backgroundImageFilename = null;
  },

  CREATE_PARTITION(state, payload) {
    const { partition } = payload;
    state.currentChatroomDetails.partitions.set(partition.id, partition);
    if (!state.currentChatroomDetails.config.partitionsOrder.includes(partition.id)) {
      state.currentChatroomDetails.config.partitionsOrder.push(partition.id);
    }
  },

  DELETE_PARTITION(state, payload) {
    const { partitionId } = payload;
    state.currentChatroomDetails.partitions.delete(partitionId);
    state.currentChatroomDetails.config.partitionsOrder = state.currentChatroomDetails.config.partitionsOrder.filter(id => id !== partitionId);
    if (state.activePartitionId === partitionId) {
      state.activePartitionId = state.currentChatroomDetails.config.partitionsOrder[0] || null;
      state.currentChatroomDetails.config.activePartitionId = state.activePartitionId;
    }
  },

  UPDATE_PARTITION(state, payload) {
    const { partitionId, updates } = payload;
    const partition = state.currentChatroomDetails.partitions.get(partitionId);
    Object.assign(partition, updates);
  },

  UPDATE_PARTITION_HISTORY(state, payload) {
    const { partitionId, newHistory } = payload;
    state.currentChatroomDetails.partitions.get(partitionId).history = newHistory;
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
    Object.assign(state.currentChatroomDetails.roles[index], payload.updatedRole);
  },

  ADD_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    role.memory.push(payload.memoryItem);
  },

  UPDATE_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    const index = role.memory.findIndex(m => m.id === payload.memoryId);
    role.memory[index] = payload.memoryItem;
  },

  UPSERT_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    const index = role.memory.findIndex(m => m.time === payload.memoryItem.time || m.id === payload.memoryItem.id);
    if (index > -1) {
      role.memory[index] = payload.memoryItem;
    } else {
      role.memory.push(payload.memoryItem);
    }
  },

  DELETE_ROLE_MEMORY(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    role.memory = role.memory.filter(m => m.id !== payload.memoryId);
  },

  ADD_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    role.publicInfo.push(payload.infoItem);
  },

  UPDATE_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    const index = role.publicInfo.findIndex(i => i.id === payload.infoId);
    role.publicInfo[index] = payload.infoItem;
  },

  DELETE_ROLE_PUBLIC_INFO(state, payload) {
    const role = state.currentChatroomDetails.roles.find(r => r.name === payload.roleName);
    role.publicInfo = role.publicInfo.filter(i => i.id !== payload.infoId);
  },

  CREATE_NOVEL(state, payload) {
    state.currentChatroomDetails.novels.push(payload.novel);
  },

  UPDATE_NOVEL(state, payload) {
    const index = state.currentChatroomDetails.novels.findIndex(n => n.id === payload.novelId);
    state.currentChatroomDetails.novels[index] = payload.updatedNovel;
  },

  UPDATE_NOVEL_TOC(state, payload) {
    const novelIndex = state.currentChatroomDetails.novels.findIndex(n => n.id === payload.novelId);
    state.currentChatroomDetails.novels[novelIndex].toc[payload.tocIndex] = payload.tocEntry;
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
    state.currentChatroomDetails.events[index] = payload.eventItem;
  },

  DELETE_EVENT(state, payload) {
    state.currentChatroomDetails.events = state.currentChatroomDetails.events.filter(e => e.id !== payload.eventId);
  },

  ADD_HISTORY_MESSAGE(state, payload) {
    const { partitionId, message } = payload;
    const partition = state.currentChatroomDetails.partitions.get(partitionId);
    if (!Array.isArray(partition.history)) partition.history = [];
    partition.history.push(message);
  },

  UPDATE_HISTORY_MESSAGE(state, payload) {
    const { partitionId, messageId, updates } = payload;
    const partition = state.currentChatroomDetails.partitions.get(partitionId);
    const index = partition.history.findIndex(msg => msg.id === messageId);
    Object.assign(partition.history[index], updates);
  },

  DELETE_HISTORY_MESSAGE(state, payload) {
    const { partitionId, messageId } = payload;
    const partition = state.currentChatroomDetails.partitions.get(partitionId);
    partition.history = partition.history.filter(msg => msg.id !== messageId);
  }
};