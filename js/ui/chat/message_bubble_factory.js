const messageBubbleFactoryModule = {
  createMessageBubble: (msgObj, partitionId) => {
    if (['statusProcessingSystem', 'drawingMaster', 'closeUpMaster', 'novelSummaryMaster'].includes(msgObj.roleName) && msgObj.roleType === 'tool') return document.createComment(`Filtered: ${msgObj.roleName}`);
    
    const pid = partitionId || stateModule.activePartitionId;
    const hasImage = stateModule.drawingMasterImageCache.has(msgObj.id);
    const actView = msgObj.activeView || (msgObj.sourceType === 'user' ? 'none' : (hasImage ? 'imageView' : 'time'));
    msgObj.activeView = actView;

    const cont = document.createElement('div');
    cont.className = `message-container ${msgObj.status === 'pending' ? 'pending' : ''}`;
    cont.dataset.messageId = msgObj.id;
    cont.dataset.sourceType = msgObj.sourceType;
    cont.dataset.roleName = msgObj.roleName;
    cont.dataset.roleType = msgObj.roleType;
    cont.dataset.activeView = actView;

    const dName = uiChatUtilsModule.getDisplayName(msgObj.roleName, pid);
    const icons = { privateAssistant: '‍💼', statusProcessingSystem: '🎲', gameHost: '🖋️', novelSummaryMaster: '∑', characterCreationMaster: '🆕', scriptCreationMaster: '📜', plotSummaryMaster: '📜', knowledgeRecordingMaster: '✍️', '用户': '📏' };
    const btnText = icons[msgObj.roleName === 'characterUpdateMaster' && msgObj.targetRoleName ? uiChatUtilsModule.getDisplayName(msgObj.targetRoleName, pid) : dName] || (dName ? dName.slice(-1) : (msgObj.sourceType === 'user' ? 'U' : 'AI'));
    cont.appendChild(Object.assign(document.createElement('div'), { className: 'std-button role-name-button-above-bubble', textContent: btnText }));

    const msgDiv = Object.assign(document.createElement('div'), { className: msgObj.sourceType === 'user' ? 'user-message' : 'ai-response' });
    const mainTxt = Object.assign(document.createElement('div'), { className: 'main-text-content' });

    if (msgObj.status === 'pending') mainTxt.textContent = msgObj.speechActionText || "[正在响应]";
    else {
      const acts = msgObj.processedTurnActions || (msgObj.sourceType === 'ai' ? msgObj.parsedResult?.processedTurnActions : null);
      if (acts?.length && msgObj.roleName !== 'privateAssistant') {
        acts.forEach((a, i) => {
          const ab = document.createElement('div');
          ab.className = `action-block ${a.isIncluded ? 'is-included' : ''}`;
          ab.dataset.actionIndex = i;
          ab.dataset.contentType = a.type || 'unknown';
          ab.dataset.roleType = msgObj.roleType;
          
          ab.appendChild(Object.assign(document.createElement('div'), { className: 'action-content-display', textContent: a.content || '' }));
          mainTxt.appendChild(ab);
        });
      } else mainTxt.textContent = msgObj.parserError ? `[解析错误: ${msgObj.parserError}]` : (msgObj.speechActionText || '');
    }
    msgDiv.appendChild(mainTxt);

    const actsDiv = Object.assign(document.createElement('div'), { className: 'message-actions-container' });
    const makeBtn = (cls, txt, short, long = null) => {
      const b = Object.assign(document.createElement('div'), { className: `std-button message-action-button ${cls}`, textContent: txt });
      eventListenersModule._setupLongPressListener(b, short, long, false);
      actsDiv.appendChild(b);
    };

    if (msgObj.status !== 'pending') {
      if (['characterUpdateMaster', 'characterCreationMaster'].includes(msgObj.roleName)) makeBtn('save-character-update-button', '💾', () => msgObj.roleName === 'characterCreationMaster' ? messageActionsImplModule.saveNewCharacter(cont) : messageActionsImplModule.saveCharacterUpdate(cont), () => messageActionsImplModule._handleBulkSaveCharacterUpdates());
      if (msgObj.roleName === 'plotSummaryMaster') makeBtn('save-event-record-button', '💾', () => messageActionsImplModule.saveEventRecord(cont), () => messageActionsImplModule.saveEventRecordWithManualInput(cont));
      if (msgObj.roleName === 'privateAssistant') actsDiv.innerHTML += `<div class="std-button message-action-button save-to-script-button">💾</div>`;
      if (msgObj.roleName === 'knowledgeRecordingMaster') actsDiv.innerHTML += `<div class="std-button message-action-button save-knowledge-record-button">💾</div>`;
      if (['role', 'temporary_role', 'user'].includes(msgObj.roleType)) makeBtn('redraw-button', '🖌️', () => messageActionsImplModule.triggerDrawingMaster(cont), () => messageActionsImplModule.triggerCloseUpMaster(cont));
      if (hasImage) makeBtn('set-background-button', '🖼️', () => messageActionsImplModule.setBackgroundFromMessage(cont), () => messageActionsImplModule.downloadImage(cont));
    }
    makeBtn('delete-button', '✕', () => messageActionsImplModule.deleteMessage(cont), () => messageActionsImplModule.deleteMessageAndBelow(cont));
    cont.appendChild(actsDiv);

    if (msgObj.roleName !== '用户' && (msgObj.sourceType === 'user' || ['role', 'temporary_role'].includes(msgObj.roleType))) {
      const sw = Object.assign(document.createElement('div'), { className: 'status-display-wrapper' });
      const ctrls = Object.assign(document.createElement('div'), { className: 'game-host-controls' });
      const cd = Object.assign(document.createElement('div'), { className: 'game-host-content' });
      const sps = msgObj.statusProcessingSystemResult, sc = sps?.processedSceneContext, ch = sps?.processedCharacterInfo;

      [{id: 'time', i: '🕒', a: sc?.timeItems?.length && sc.timeItems[0] !== '无'},
       {id: 'location', i: '📍', a: sc && ((sc.locationItems?.length && sc.locationItems[0] !== '无') || (sc.otherSceneInfoItems?.length && sc.otherSceneInfoItems[0] !== '无'))},
       {id: 'goals', i: '🎯', a: ch?.internalGoalItems?.length && ch.internalGoalItems[0] !== '无 (不可见)'},
       {id: 'character', i: '👤', a: !!ch},
       {id: 'imageView', i: '🎨', a: hasImage || !!msgObj.drawingMasterContext}
      ].forEach(v => { 
        if (v.a) {
          const btn = document.createElement('div');
          btn.className = 'std-button game-host-view-button';
          btn.dataset.view = v.id;
          btn.textContent = v.i;
          ctrls.appendChild(btn);
        }
      });

      sw.append(ctrls, cd);
      uiChatToolSpecificModule._renderStatusDisplayContent(cont, actView, msgObj.sourceType === 'user' || ['role', 'temporary_role'].includes(msgObj.roleType) ? sps : null, msgObj.statusProcessingSystemParserError || msgObj.statusProcessingSystemError, ctrls, cd, msgObj);
      msgDiv.appendChild(sw);
    }
    
    cont.appendChild(msgDiv);
    if (msgObj.sourceType === 'user' || msgObj.roleName === 'privateAssistant') eventListenersModule._setupLongPressListener(msgDiv, null, e => { if (!e.target.closest('.value-block')) uiMessageEditorModule.startEdit(cont); }, true);
    if (msgObj.sourceType === 'ai' && msgObj.roleName !== 'privateAssistant') mainTxt.querySelectorAll('.action-block').forEach(b => eventListenersModule._setupLongPressListener(b, () => messageActionsImplModule.toggleActionInclusion(b), () => uiMessageEditorModule.startEdit(b), false));

    return cont;
  }
};