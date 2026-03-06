const systemTriggersModule = {
  init: () => {
  },

  _triggerStatusProcessingSystemIfNeeded: (partitionId) => {
    if (!stateModule.config.toolSettings.statusProcessingSystem.enabled) return;
    const partition = stateModule.currentChatroomDetails.partitions.get(partitionId);
    if (!partition.history.length) return;

    const targetMsg = [...partition.history].reverse().find(m => m.sourceType === 'user' && m.roleName !== '用户');
    if (targetMsg && !targetMsg.statusProcessingSystemResult && !targetMsg.statusProcessingSystemError) {
      transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId, messageId: targetMsg.id, updates: { statusProcessingSystemResult: { status: 'pending' } }
      });
      apiMainTriggerModule.sendSingleMessageForRoleImpl(partitionId, 'statusProcessingSystem', 'tool', null, targetMsg.roleName, {
        initiatorMessageId: `${targetMsg.id}_sps`, triggeringCharacterName: targetMsg.roleName
      }, true);
    }
  },

  _triggerActiveRoles: (partitionId) => {
    elementsModule.activeRoleTriggerList.style.display = 'none';
    const aliases = stateModule.currentChatroomDetails.partitions.get(partitionId).roleAliases;
    const active = aliases.filter(a => ['活', '用'].includes(a.state));
    if (active.length) systemTriggersModule.showActiveRoleTriggerList(partitionId, active);
  },

  toggleRoleList: (forceClose) => {
    stateModule.isRoleListVisible_temp = forceClose ? false : !stateModule.isRoleListVisible_temp;
    elementsModule.roleButtonsListContainer.style.display = stateModule.isRoleListVisible_temp ? 'flex' : 'none';
    if (!stateModule.isRoleListVisible_temp) roleManagementUiModule.hideRoleStateButtons();
  },

  _handleBulkUpdateTrigger: async () => {
    const details = stateModule.currentChatroomDetails;
    const partition = details.partitions.get(stateModule.activePartitionId);
    
    const perms = new Set(details.roles.map(r => r.name));
    const roles = partition.roleAliases.filter(a => a.state === '活' && perms.has(a.name));
    
    for (const r of roles) {
      await new Promise(res => setTimeout(res, 0));
      apiMainTriggerModule.triggerCharacterUpdateForRole(stateModule.activePartitionId, r.name);
    }
    roleManagementUiModule.hideRoleStateButtons();
  },

  showActiveRoleTriggerList: (partitionId, activeRoles) => {
    const list = elementsModule.activeRoleTriggerList;
    list.innerHTML = '';
    
    const { roleNameMap } = uiChatUtilsModule.getRoleNameMaps(partitionId);
    activeRoles.sort((a, b) => (a.state === '用' ? -1 : 1));

    const addBtn = (text, onClick, onLong) => {
      const btn = document.createElement('div');
      btn.className = 'active-role-trigger-button';
      btn.textContent = text;
      eventListenersModule._setupLongPressListener(btn, () => {
        elementsModule.runPauseButton.textContent = '■';
        setTimeout(() => elementsModule.runPauseButton.textContent = '▶', 200);
        onClick();
      }, onLong ? () => {
        elementsModule.runPauseButton.textContent = '■';
        setTimeout(() => elementsModule.runPauseButton.textContent = '▶', 200);
        onLong();
      } : null, false);
      list.appendChild(btn);
    };

    addBtn('主持人', () => apiMainTriggerModule.triggerRoleResponse(partitionId, 'gameHost', null, null, false), 
      async () => { for (const r of activeRoles) await apiMainTriggerModule.triggerRoleResponse(partitionId, r.name, null, null, true); });

    activeRoles.forEach(r => {
      addBtn(roleNameMap[r.name] || r.name, 
        () => apiMainTriggerModule.triggerRoleResponse(partitionId, r.name, null, null, false),
        async () => { for (const o of activeRoles.filter(x => x.name !== r.name)) await apiMainTriggerModule.triggerRoleResponse(partitionId, o.name, null, null, true); }
      );
    });
    list.style.display = 'flex';
  },

  updateModelToggleButtonVisual: () => {
    const types = { primary: '●', secondary: '○', tertiary: '◎' };
    elementsModule.modelToggleButton.textContent = types[stateModule.config.generalModelSelectionType];
  },

  updateAutoTriggerButtonVisual: () => {
    const partition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!partition) {
        elementsModule.autoTriggerButton.textContent = '||';
        return;
    }
    elementsModule.autoTriggerButton.textContent = partition.autoTriggerNextCharacter ? '>>' : '||';
  }
};