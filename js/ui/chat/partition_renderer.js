const partitionRendererModule = {
  init: () => {
    eventBus.on('HISTORY_CHANGED', data => {
      const { type, payload } = data;
      const pid = payload.partitionId;
      if (pid !== stateModule.activePartitionId && type === 'ADD_HISTORY_MESSAGE') {
        stateModule.newMessagesInPartitions.add(pid);
        partitionListManagerModule.updatePartitionList();
      }
      
      const cont = stateModule.partitionDOMCache.get(pid);
      if (!cont) return;

      const actions = {
        'ADD_HISTORY_MESSAGE': () => {
          const ex = cont.querySelector(`.message-container[data-message-id="${payload.message.id}"]`);
          if (!ex || ex.dataset.status === 'pending') {
            const el = messageBubbleFactoryModule.createMessageBubble(payload.message, pid);
            if (el) { ex ? ex.replaceWith(el) : cont.appendChild(el); if (pid === stateModule.activePartitionId) partitionRendererModule.scrollToBottom(); }
          }
        },
        'UPDATE_HISTORY_MESSAGE': () => {
          const m = stateModule.currentChatroomDetails.partitions.get(pid).history.find(x => x.id === payload.messageId);
          const ex = cont.querySelector(`.message-container[data-message-id="${payload.messageId}"]`);
          if (m && ex) { const el = messageBubbleFactoryModule.createMessageBubble(m, pid); if (el) ex.replaceWith(el); }
        },
        'DELETE_HISTORY_MESSAGE': () => {
          cont.querySelector(`.message-container[data-message-id="${payload.messageId}"]`)?.remove();
        },
        'UPDATE_PARTITION_HISTORY': () => {
          cont.innerHTML = '';
          const frag = document.createDocumentFragment();
          (payload.newHistory || []).forEach(m => { const el = messageBubbleFactoryModule.createMessageBubble(m, pid); if(el) frag.appendChild(el); });
          cont.appendChild(frag);
          if (pid === stateModule.activePartitionId) partitionRendererModule.scrollToBottom();
        }
      };
      if (actions[type]) actions[type]();
    });
    
    eventBus.on('PARTITION_SWITCHED', data => { if (data.newPartitionId) partitionRendererModule.renderChatAreaForPartition(data.newPartitionId); });
  },

  createPlaceholderElement: (pid, rName, rType, targetName, mId) => {
    if (['statusProcessingSystem', 'drawingMaster'].includes(rName)) return null;
    return messageBubbleFactoryModule.createMessageBubble({ id: mId || uiChatUtilsModule._generateMessageId(), timestamp: Date.now(), sourceType: 'ai', roleName: rName, roleType: rType, targetRoleName: targetName, speechActionText: '[正在响应]', status: 'pending' }, pid);
  },

  updateMessageElementStatus: (mId, txt, isImg = false) => {
    if (isImg) return;
    const cd = document.querySelector(`.message-container[data-message-id="${mId}"] .game-host-content`);
    if (cd && stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId)?.history.find(m => m.id === mId)?.activeView !== 'imageView') {
      cd.innerHTML = uiChatToolSpecificModule._createValueBlock(txt).outerHTML;
    }
  },

  clearAllPartitionCaches: () => {
    stateModule.partitionDOMCache.clear(); stateModule.partitionScrollPositions.clear();
    elementsModule.chatArea.innerHTML = '';
  },

  renderChatAreaForPartition: (pid, isInit = false) => {
    const cur = document.querySelector('#chat-area > div[data-partition-id][style*="display: block"]');
    if (cur) stateModule.partitionScrollPositions.set(cur.dataset.partitionId, elementsModule.chatArea.scrollTop);
    
    stateModule.partitionDOMCache.forEach((c, id) => c.style.display = id === pid ? 'block' : 'none');
    
    if (stateModule.partitionDOMCache.has(pid)) {
      requestAnimationFrame(() => {
        const top = stateModule.partitionScrollPositions.get(pid);
        isInit || typeof top !== 'number' ? partitionRendererModule.scrollToBottom() : (elementsModule.chatArea.scrollTop = top);
      });
    }
  },

  addMessageElement: (mObj, pid) => {
    const cont = stateModule.partitionDOMCache.get(pid);
    if (!cont) return null;
    const el = messageBubbleFactoryModule.createMessageBubble(mObj, pid);
    if (el) { cont.appendChild(el); partitionRendererModule.scrollToBottom(); }
    return el;
  },

  scrollToBottom: () => { elementsModule.chatArea.scrollTop = elementsModule.chatArea.scrollHeight; },
  showLoadingSpinner: () => { elementsModule.loadingSpinner.style.display = 'block'; elementsModule.loadingSpinner.classList.add('spinning'); },
  hideLoadingSpinner: () => { elementsModule.loadingSpinner.style.display = 'none'; elementsModule.loadingSpinner.classList.remove('spinning'); },
  showRetryIndicator: () => {
    elementsModule.loadingSpinner.classList.add('retry-indicator');
    setTimeout(() => elementsModule.loadingSpinner.classList.remove('retry-indicator'), 200);
  }
};