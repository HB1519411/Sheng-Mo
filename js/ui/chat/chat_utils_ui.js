const uiChatUtilsModule = {
  audioContext: null,
  init: () => {},
  playBeep: () => {
    try {
      if (!uiChatUtilsModule.audioContext) {
        uiChatUtilsModule.audioContext = new(window.AudioContext || window.webkitAudioContext)();
      }
      if (uiChatUtilsModule.audioContext.state === 'suspended') {
        uiChatUtilsModule.audioContext.resume();
      }
      const ctx = uiChatUtilsModule.audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {
      console.error("Error playing beep:", e);
    }
  },
  _generateMessageId: () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  },
  formatStateObjectToText: (stateObj) => {
    return Object.entries(stateObj).map(([key, value]) => {
      let displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
      return `${key}: ${displayValue}`;
    }).join('\n');
  },
  findBottomRoleButton: (roleName) => {
    if (!roleName) throw new Error("findBottomRoleButton requires a valid roleName");
    return elementsModule.roleButtonsListContainer.querySelector(`.role-button-container > .std-button[data-role-name="${roleName}"]`);
  },
  getRoleNameMaps: (partitionId) => {
    const roleNameMap = {
      '用户': '用户'
    };
    const reverseRoleNameMap = {
      '用户': '用户'
    };
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (partitionId && chatroomDetails?.partitions?.has(partitionId)) {
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
    if (!uniqueName) throw new Error("getDisplayName requires a valid uniqueName");
    return uiChatUtilsModule.getRoleNameMaps(partitionId).roleNameMap[uniqueName] || uniqueName;
  },
  getUniqueName: (displayName, partitionId) => {
    if (!displayName) throw new Error("getUniqueName requires a valid displayName");
    return uiChatUtilsModule.getRoleNameMaps(partitionId).reverseRoleNameMap[displayName] || displayName;
  },
};