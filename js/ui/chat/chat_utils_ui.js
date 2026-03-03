const uiChatUtilsModule = {
  audioContext: null,
  init: () => {},
  playBeep: () => {
    if (!uiChatUtilsModule.audioContext) {
      try {
        uiChatUtilsModule.audioContext = new(window.AudioContext || window.webkitAudioContext)();
        if (uiChatUtilsModule.audioContext.state === 'suspended') {
          uiChatUtilsModule.audioContext.resume();
        }
      } catch (e) {
        console.error("Web Audio API is not supported in this browser", e);
        return;
      }
    }
    if (!uiChatUtilsModule.audioContext) return;
    if (uiChatUtilsModule.audioContext.state === 'suspended') {
      uiChatUtilsModule.audioContext.resume().then(() => {
        uiChatUtilsModule._doPlayBeep(uiChatUtilsModule.audioContext);
      }).catch(e => console.error("Failed to resume AudioContext:", e));
    } else {
      uiChatUtilsModule._doPlayBeep(uiChatUtilsModule.audioContext);
    }
  },

  _doPlayBeep: (ctx) => {
    try {
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
    if (!stateObj || typeof stateObj !== 'object') return '[Invalid state object]';
    let text = '';
    for (const key in stateObj) {
      if (stateObj.hasOwnProperty(key)) {
        let value = stateObj[key];
        if (typeof value === 'object' && value !== null) {
          try {
            value = JSON.stringify(value);
          } catch (e) {
            value = '[Cannot serialize object]';
          }
        }
        text += `${key}: ${value}\n`;
      }
    }
    return text.trim() || '[Empty state object]';
  },

  findBottomRoleButton: (roleName) => {
    if (!roleName) return null;
    const btns = elementsModule.roleButtonsListContainer.querySelectorAll('.role-button-container > .std-button');
    for (const btn of btns) {
      if (btn.dataset.roleName === roleName) return btn;
    }
    return null;
  },

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
    } = uiChatUtilsModule.getRoleNameMaps(partitionId);
    return roleNameMap[uniqueName] || uniqueName;
  },

  getUniqueName: (displayName, partitionId) => {
    if (!displayName) return '';
    const {
      reverseRoleNameMap
    } = uiChatUtilsModule.getRoleNameMaps(partitionId);
    return reverseRoleNameMap[displayName] || displayName;
  },
};