const apiClientChatroomsModule = {
  fetchChatroomDetails: async (chatroomName) => {
    if (!chatroomName) {
      return null;
    }
    const result = await apiServiceModule.performApiCall(`/chatroom-details/${encodeURIComponent(chatroomName)}`);
    if (result.success && result.data) {
      return result.data;
    } else {
      _logAndDisplayError(`Failed to fetch details for chatroom ${chatroomName}: ${result.error?.message}`, 'apiClientChatroomsModule.fetchChatroomDetails');
      return null;
    }
  },
  createChatroom: async (payload) => {
    return await apiServiceModule.performApiCall('/create-chatroom', 'POST', {
      chatroom_name: payload.name
    });
  },
  deleteChatroom: async (payload) => {
    return await apiServiceModule.performApiCall(`/delete-chatroom/${encodeURIComponent(payload.chatroomName)}`, 'DELETE');
  },
  renameChatroom: async (payload) => {
    return await apiServiceModule.performApiCall(`/rename-chatroom/${encodeURIComponent(payload.oldName)}`, 'PUT', {
      new_name: payload.newName
    });
  },
  updateChatroom: async (payload) => {
    return await apiServiceModule.performApiCall(`/update-chatroom-config/${encodeURIComponent(payload.chatroomName)}`, 'POST', payload.updates);
  },
  setBackground: async (payload) => {
    const {
      chatroomName,
      imageData
    } = payload;
    let apiPayload, isFormData = false;
    if (imageData instanceof File) {
      apiPayload = new FormData();
      apiPayload.append('image', imageData);
      isFormData = true;
    } else if (typeof imageData === 'string') {
      apiPayload = {
        imageDataUrl: imageData
      };
    } else {
      return {
        success: false,
        error: {
          message: "Invalid image data type for setBackground."
        }
      };
    }
    return await apiServiceModule.performApiCall(`/background/${encodeURIComponent(chatroomName)}`, 'POST', apiPayload, {}, null, isFormData);
  },
  deleteBackground: async (payload) => {
    return await apiServiceModule.performApiCall(`/background/${encodeURIComponent(payload.chatroomName)}`, 'DELETE');
  },
  createPartition: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions`, 'POST', {
      partition_name: payload.partitionName
    });
  },
  deletePartition: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}`, 'DELETE');
  },
  updatePartitionFields: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}`, 'PUT', payload.updates);
  },
  addHistoryMessage: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}/history`, 'POST', payload.message);
  },
  updateHistoryMessage: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}/history/${encodeURIComponent(payload.messageId)}`, 'PUT', payload.updates);
  },
  deleteHistoryMessage: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}/history/${encodeURIComponent(payload.messageId)}`, 'DELETE');
  },
  deleteHistoryFrom: async (payload) => {
    return await apiServiceModule.performApiCall(`/chatrooms/${encodeURIComponent(payload.chatroomName)}/partitions/${encodeURIComponent(payload.partitionId)}/history/delete_from`, 'POST', {
      message_id: payload.messageId
    });
  },
  createRole: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}`, 'POST', payload.roleData);
  },
  deleteRole: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}`, 'DELETE');
  },
  updateRoleFields: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}`, 'PUT', payload.updates);
  },
  updateRoleMemoryOnly: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/memory_only`, 'PUT', {
      memory: payload.memory
    });
  },
  addRoleMemory: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/memory`, 'POST', payload.memoryItem);
  },
  updateRoleMemory: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/memory/${encodeURIComponent(payload.memoryId)}`, 'PUT', payload.memoryItem);
  },
  deleteRoleMemory: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/memory/${encodeURIComponent(payload.memoryId)}`, 'DELETE');
  },
  addRolePublicInfo: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/public_info`, 'POST', payload.infoItem);
  },
  updateRolePublicInfo: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/public_info/${encodeURIComponent(payload.infoId)}`, 'PUT', payload.infoItem);
  },
  deleteRolePublicInfo: async (payload) => {
    return await apiServiceModule.performApiCall(`/roles/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.roleName)}/public_info/${encodeURIComponent(payload.infoId)}`, 'DELETE');
  },
  createNovel: async (payload) => {
    return await apiServiceModule.performApiCall(`/novels/${encodeURIComponent(payload.chatroomName)}`, 'POST', payload.novelData);
  },
  deleteNovel: async (payload) => {
    return await apiServiceModule.performApiCall(`/novels/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.novelId)}`, 'DELETE');
  },
  updateNovel: async (payload) => {
    return await apiServiceModule.performApiCall(`/novels/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.novelId)}`, 'PUT', payload.novelUpdates);
  },
  updateNovelTocEntry: async (payload) => {
    const updatePayload = {
      toc_entry_update: {
        index: payload.tocIndex,
        ...payload.tocUpdates
      }
    };
    return await apiServiceModule.performApiCall(`/novels/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.novelId)}`, 'PUT', updatePayload);
  },
  replaceNovelContent: async (payload) => {
    return await apiServiceModule.performApiCall(`/novels/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.novelId)}/replace`, 'POST', {
        search_term: payload.searchTerm,
        replace_term: payload.replaceTerm
    });
  },
  getEvents: async (chatroomName) => {
    return await apiServiceModule.performApiCall(`/events/${encodeURIComponent(chatroomName)}`);
  },
  addEvent: async (payload) => {
    return await apiServiceModule.performApiCall(`/events/${encodeURIComponent(payload.chatroomName)}`, 'POST', payload.eventData);
  },
  updateEvent: async (payload) => {
    return await apiServiceModule.performApiCall(`/events/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.eventId)}`, 'PUT', payload.eventData);
  },
  deleteEvent: async (payload) => {
    return await apiServiceModule.performApiCall(`/events/${encodeURIComponent(payload.chatroomName)}/${encodeURIComponent(payload.eventId)}`, 'DELETE');
  },
  getKnowledgeGroups: async () => {
    return await apiServiceModule.performApiCall('/knowledge-groups');
  },
  createKnowledgeGroup: async (groupName) => {
    return await apiServiceModule.performApiCall('/knowledge-groups', 'POST', {
      group_name: groupName
    });
  },
  deleteKnowledgeGroup: async (groupName) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(groupName)}`, 'DELETE');
  },
  renameKnowledgeGroup: async (oldName, newName) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(oldName)}`, 'PUT', { new_name: newName });
  },
  getKnowledgeGroupEntries: async (groupName) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(groupName)}`);
  },
  addKnowledgeEntry: async (groupName, entryData) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(groupName)}/entries`, 'POST', entryData);
  },
  updateKnowledgeEntry: async (groupName, entryId, entryData) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(groupName)}/entries/${encodeURIComponent(entryId)}`, 'PUT', entryData);
  },
  deleteKnowledgeEntry: async (groupName, entryId) => {
    return await apiServiceModule.performApiCall(`/knowledge-groups/${encodeURIComponent(groupName)}/entries/${encodeURIComponent(entryId)}`, 'DELETE');
  },
  getPredictedDate: async (chatroomName, partitionId) => {
    return await apiServiceModule.performApiCall(`/get-predicted-date/${encodeURIComponent(chatroomName)}/${encodeURIComponent(partitionId)}`);
  },
  importKnowledgeGroupFromData: async (payload) => {
    return await apiServiceModule.performApiCall('/knowledge-groups/import-parsed-data', 'POST', payload);
  },
};