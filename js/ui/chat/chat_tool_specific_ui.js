const uiChatToolSpecificModule = {
  init: () => {},

  _handleStatusViewChange: (button) => {
    const messageContainer = button.closest('.message-container');
    
    let viewToShow = button.dataset.view;
    if (messageContainer.dataset.activeView === viewToShow) viewToShow = 'none';
    messageContainer.dataset.activeView = viewToShow;

    const messageId = messageContainer.dataset.messageId;
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    const messageObject = activePartition?.history.find(msg => msg.id === messageId);
    messageObject.activeView = viewToShow;

    const allContainers = document.querySelectorAll(`#chat-area > div[data-partition-id="${stateModule.activePartitionId}"] .message-container`);
    allContainers.forEach(other => {
      if (other.dataset.messageId !== messageId) {
        const otherMsgObj = activePartition.history.find(m => m.id === other.dataset.messageId);
        if (otherMsgObj && otherMsgObj.activeView !== 'time') {
          otherMsgObj.activeView = 'time';
          other.dataset.activeView = 'time';
          const controls = other.querySelector('.game-host-controls');
          const content = other.querySelector('.game-host-content');
          if (controls && content) {
              uiChatToolSpecificModule._renderStatusDisplayContent(other, 'time', null, null, controls, content, otherMsgObj);
          }
        }
      }
    });

    const currentControls = messageContainer.querySelector('.game-host-controls');
    const currentContent = messageContainer.querySelector('.game-host-content');
    if (currentControls && currentContent) {
        uiChatToolSpecificModule._renderStatusDisplayContent(messageContainer, viewToShow, null, null, currentControls, currentContent, messageObject);
    }
  },

  _createValueBlock: (value, jsonPath = null) => {
    if (value === null || value === undefined || value === '' || value === '无') return null;
    const span = document.createElement('span');
    span.className = 'value-block';
    span.textContent = String(value);
    if (jsonPath) span.dataset.jsonPath = jsonPath;
    return span;
  },

  _formatStatusDisplayContent: (parsedResult, view, messageObject) => {
    if (view === 'none') return '';

    if (view === 'imageView') {
      const cached = stateModule.drawingMasterImageCache.get(messageObject.id);
      if (cached) {
        return `<img src="${cached}" alt="AI Generated Image" style="width:100%;height:auto;display:block;border-radius:var(--border-radius-medium);cursor:pointer;" onclick="uiChatImageViewerModule.showImageViewer(this.src)">`;
      }
      if (messageObject.drawingMasterError) return uiChatToolSpecificModule._createValueBlock(`[图片错误: ${messageObject.drawingMasterError.message || '未知'}]`)?.outerHTML || '';
      return '';
    }

    const sps = messageObject.statusProcessingSystemResult;
    if (!sps) return '';

    const content = document.createDocumentFragment();
    const icons = { map: '📍', people: '👥', name: '✨', demeanor: '😐', clothing: '👕', underwear: '👙', accessories: '💍', pose: '🤸', statusShort: '🩹' };

    const renderItems = (items, prefix, icon) => {
      const valid = (items || []).filter(i => i !== '无');
      if (!valid.length) return;
      const div = document.createElement('div');
      if (icon) div.innerHTML = `<span class="icon">${icon}</span>`;
      
      valid.forEach((item, idx) => {
        let path = `${prefix}[${idx}]`;
        if (prefix.endsWith('wear')) {
            const layer = prefix.split('.').pop();
            const data = sps.processedCharacterInfo?.clothing?.[layer];
            const key = Object.keys(data || {}).find(k => data[k]?.includes(item));
            if (key) path = `${prefix}.${key}[${data[key].indexOf(item)}]`;
        }
        const block = uiChatToolSpecificModule._createValueBlock(item, path);
        if (block) div.appendChild(block);
      });
      content.appendChild(div);
    };

    if (view === 'time') renderItems(sps.processedSceneContext?.timeItems, 'statusProcessingSystemResult.processedSceneContext.timeItems');
    else if (view === 'location') renderItems(sps.processedSceneContext?.locationItems, 'statusProcessingSystemResult.processedSceneContext.locationItems', icons.map);
    else if (view === 'goals') renderItems(sps.processedCharacterInfo?.internalGoalItems, 'statusProcessingSystemResult.processedCharacterInfo.internalGoalItems');
    else if (view === 'character') {
      const info = sps.processedCharacterInfo;
      if (info) {
        const nameDiv = document.createElement('div');
        nameDiv.innerHTML = `<span class="icon">${icons.name}</span>`;
        const nameBlock = uiChatToolSpecificModule._createValueBlock(info.characterName || '[Unknown]', 'statusProcessingSystemResult.processedCharacterInfo.characterName');
        if (nameBlock) nameDiv.appendChild(nameBlock);
        content.appendChild(nameDiv);

        const mappings = [
          { k: 'demeanorItems', i: icons.demeanor }, { k: 'outerwearItems', i: icons.clothing },
          { k: 'underwearItems', i: icons.underwear }, { k: 'accessories', i: icons.accessories },
          { k: 'actionPoseItems', i: icons.pose }, { k: 'currentPositionItems', i: icons.map },
          { k: 'shortTermStatusItems', i: icons.statusShort }
        ];
        mappings.forEach(m => renderItems(info[m.k], `statusProcessingSystemResult.processedCharacterInfo.${m.k}`, m.i));
      }
    }

    const temp = document.createElement('div');
    temp.appendChild(content);
    return temp.innerHTML || '';
  },

  _renderStatusDisplayContent: (msgCont, view, data, error, controls, content, msgObj) => {
    if (!content || !controls) return;

    if (error && view !== 'imageView' && view !== 'none') {
      content.innerHTML = uiChatToolSpecificModule._createValueBlock(`[SPS错误: ${typeof error === 'string' ? error : JSON.stringify(error)}]`)?.outerHTML || '';
    } else {
      content.innerHTML = uiChatToolSpecificModule._formatStatusDisplayContent(msgObj.parsedResult, view, msgObj);
    }

    content.querySelectorAll('.value-block[data-json-path]').forEach(item => {
      eventListenersModule._setupLongPressListener(item, null, () => uiMessageEditorModule.startEdit(item), false);
    });

    controls.querySelectorAll('.game-host-view-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  }
};