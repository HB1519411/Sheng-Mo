const contextUtilsModule = {
  getRoleNameMaps: (partitionId) => {
    const roleNameMap = {};
    const reverseRoleNameMap = {};
    const chatroomDetails = stateModule.currentChatroomDetails;

    roleNameMap['用户'] = '用户';
    reverseRoleNameMap['用户'] = '用户';

    if (!chatroomDetails || !chatroomDetails.partitions) {
      return {
        roleNameMap,
        reverseRoleNameMap
      };
    }

    // Fix: Only look at the specific partitionId passed in, do not iterate all partitions.
    if (partitionId && chatroomDetails.partitions.has(partitionId)) {
      const partition = chatroomDetails.partitions.get(partitionId);
      (partition.roleAliases || []).forEach(entry => {
        const originalName = entry.name;
        const alias = (entry.alias || '').trim() || originalName;

        if (originalName) {
          roleNameMap[originalName] = alias;
          reverseRoleNameMap[alias] = originalName;
        }
      });
    }

    return {
      roleNameMap,
      reverseRoleNameMap
    };
  },
  getDisplayName: (uniqueName, partitionId) => {
    if (!uniqueName) return '';
    const {
      roleNameMap
    } = contextUtilsModule.getRoleNameMaps(partitionId);
    return roleNameMap[uniqueName] || uniqueName;
  },

  getUniqueName: (displayName, partitionId) => {
    if (!displayName) return '';
    const {
      reverseRoleNameMap
    } = contextUtilsModule.getRoleNameMaps(partitionId);
    return reverseRoleNameMap[displayName] || displayName;
  },
  getNovelAndScriptContentForPayload: (partitionId) => {
    return "";
  },

  getChatContextForPartition: (partitionId, apiCallRoleName = null, apiCallRoleType = null, targetRoleNameForTool = null) => {
    return null;
  },

  updateAllPartitionContextCaches: (apiCallRoleName = null, apiCallRoleType = null, targetRoleNameForTool = null) => {
  },

  getCombinedHistoryForContext_internal: (partitionId, apiCallRoleName, apiCallRoleType) => {
    return [];
  },

  updateChatContextForPartition: (partitionId, currentApiCallRoleName = null, currentApiCallRoleType = null, targetRoleNameForTool = null) => {
    return null;
  }
};
window.shengmoAPI = {
  getActiveChatroomDetails: () => {
    return commonUtilsModule._shengmoDeepCopy(stateModule.currentChatroomDetails);
  },
  getActivePartitionId: () => {
    return stateModule.activePartitionId;
  },
  getPartitionDataById: (partitionId) => {
    if (!stateModule.currentChatroomDetails || !stateModule.currentChatroomDetails.partitions) {
      return null;
    }
    const partition = stateModule.currentChatroomDetails.partitions.get(partitionId);
    return partition ? commonUtilsModule._shengmoDeepCopy(partition) : null;
  },
  getGlobalConfig: () => {
    return commonUtilsModule._shengmoDeepCopy(stateModule.config);
  },
  getAllChatroomNames: () => {
    return stateModule.config.chatRoomOrder ? [...stateModule.config.chatRoomOrder] : [];
  },
  getChatContextForPartition: (partitionId, apiCallRoleName = null, apiCallRoleType = null) => {
    return contextUtilsModule.getChatContextForPartition(partitionId, apiCallRoleName, apiCallRoleType);
  },
  getAllRolesForCurrentChatroom: () => {
    return stateModule.currentChatroomDetails && stateModule.currentChatroomDetails.roles ?
      commonUtilsModule._shengmoDeepCopy(stateModule.currentChatroomDetails.roles) : [];
  },
  getAllPartitionsForCurrentChatroom: () => {
    return stateModule.currentChatroomDetails && stateModule.currentChatroomDetails.partitions ?
      commonUtilsModule._shengmoDeepCopy(Array.from(stateModule.currentChatroomDetails.partitions.values())) : [];
  }
};