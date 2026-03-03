const uiChatToolSpecificModule = {
  init: () => {},
  _formatCharacterUpdateMasterDisplay: (parsedResult) => {
    if (!parsedResult || typeof parsedResult !== 'object') {
      return "[无法格式化角色更新：无效的解析结果]";
    }
    return parsedResult.formattedUpdate || "[角色更新：缺少 formattedUpdate 字段]";
  },

  _handleStatusViewChange: (button) => {
    const messageContainer = button.closest('.message-container');
    let viewToShow = button.dataset.view;
    if (!messageContainer || !viewToShow) return;

    const currentActiveView = messageContainer.dataset.activeView;
    if (currentActiveView === viewToShow) {
      viewToShow = 'none';
    }

    messageContainer.dataset.activeView = viewToShow;

    const messageId = messageContainer.dataset.messageId;
    const activePartitionId = stateModule.activePartitionId;
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(activePartitionId);
    if (!activePartition) return;
    const messageObject = activePartition.history.find(msg => msg.id === messageId);
    if (!messageObject) return;

    messageObject.activeView = viewToShow;

    const allMessageContainersInPartition = document.querySelectorAll(`#chat-area > div[data-partition-id="${activePartitionId}"] .message-container`);
    allMessageContainersInPartition.forEach(otherMsgContainer => {
      if (otherMsgContainer.dataset.messageId !== messageId) {
        const otherMessageId = otherMsgContainer.dataset.messageId;
        const otherMessageObject = activePartition.history.find(msg => msg.id === otherMessageId);
        if (otherMessageObject && otherMessageObject.activeView !== 'time') {
          otherMessageObject.activeView = 'time';
          otherMsgContainer.dataset.activeView = 'time';
          const otherControlsDiv = otherMsgContainer.querySelector('.game-host-controls');
          const otherContentDiv = otherMsgContainer.querySelector('.game-host-content');
          if (otherControlsDiv && otherContentDiv) {
            uiChatToolSpecificModule._renderStatusDisplayContent(otherMsgContainer, 'time', null, null, otherControlsDiv, otherContentDiv, otherMessageObject);
          }
        }
      }
    });

    const controlsDiv = messageContainer.querySelector('.game-host-controls');
    const contentDiv = messageContainer.querySelector('.game-host-content');

    uiChatToolSpecificModule._renderStatusDisplayContent(messageContainer, viewToShow, null, null, controlsDiv, contentDiv, messageObject);
  },

  _createValueBlock: (value, jsonPath = null) => {
    if (value === null || value === undefined || value === '' || value === '无') return null;
    const span = document.createElement('span');
    span.className = 'value-block';
    span.textContent = String(value);
    if (jsonPath) {
      span.dataset.jsonPath = jsonPath;
    }
    return span;
  },

  _formatStatusDisplayContent: (parsedResult, view, messageObject) => {
    let content = document.createDocumentFragment();

    if (view === 'none') {
      return '';
    }

    if (view === 'imageView') {
      const cachedImageDataUrl = stateModule.drawingMasterImageCache.get(messageObject.id);
      if (cachedImageDataUrl) {
        const img = document.createElement('img');
        img.src = cachedImageDataUrl;
        img.alt = "[AI Generated Image]";
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.borderRadius = "var(--border-radius-medium)";
        img.style.cursor = "pointer";
        img.addEventListener('click', (event) => uiChatImageViewerModule.showImageViewer(event.target.src));
        return img.outerHTML;
      } else if (messageObject.drawingMasterError) {
        const errorBlock = uiChatToolSpecificModule._createValueBlock(`[图片错误: ${messageObject.drawingMasterError.message || '未知'}]`);
        return errorBlock ? errorBlock.outerHTML : '';
      } else if (messageObject.drawingMasterContext) {
        const pendingBlock = uiChatToolSpecificModule._createValueBlock('[图片生成中...]');
        return pendingBlock ? pendingBlock.outerHTML : '';
      } else if (messageObject.drawingMasterResult?.hasImage) {
        const expiredBlock = uiChatToolSpecificModule._createValueBlock('[图片已失效或未缓存]');
        return expiredBlock ? expiredBlock.outerHTML : '';
      }
      const noDataBlock = uiChatToolSpecificModule._createValueBlock('[无图片数据]');
      return noDataBlock ? noDataBlock.outerHTML : '';
    }

    const parsedSPSResult = messageObject.statusProcessingSystemResult;

    if (!parsedSPSResult) {
      if (view === 'time' || view === 'location' || view === 'character' || view === 'goals') {
        const unavailableBlock = uiChatToolSpecificModule._createValueBlock('[状态信息不可用]');
        return unavailableBlock ? unavailableBlock.outerHTML : '';
      }
    }

    const icons = {
      map: '📍',
      people: '👥',
      name: '✨',
      demeanor: '😐',
      clothing: '👕',
      underwear: '👙',
      accessories: '💍',
      pose: '🤸',
      statusShort: '🩹',
    };
    const renderItems = (items, jsonPathPrefix = '', icon = '') => {
      if (!Array.isArray(items) || items.length === 0 || (items.length === 1 && items[0] === '无')) return null;
      const filteredItems = items.filter(item => item !== '无');
      if (filteredItems.length === 0) return null;

      const div = document.createElement('div');
      if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        iconSpan.textContent = icon;
        div.appendChild(iconSpan);
      }
      filteredItems.forEach((item, index) => {
        let path = `${jsonPathPrefix}[${index}]`;
        if (jsonPathPrefix.endsWith('outerwear') || jsonPathPrefix.endsWith('underwear')) {
          const clothingLayerName = jsonPathPrefix.split('.').pop();
          const clothingData = parsedSPSResult?.processedCharacterInfo?.clothing?.[clothingLayerName];
          if (clothingData) {
            const key = Object.keys(clothingData).find(k => Array.isArray(clothingData[k]) && clothingData[k].includes(item));
            if (key) {
              const itemIndex = clothingData[key].indexOf(item);
              path = `${jsonPathPrefix}.${key}[${itemIndex}]`;
            }
          }
        }
        const valueBlock = uiChatToolSpecificModule._createValueBlock(item, path);
        if (valueBlock) {
            div.appendChild(valueBlock);
        }
      });
      return div;
    };


    let tempDiv;

    switch (view) {
      case 'time':
        const sceneTime = parsedSPSResult?.processedSceneContext;
        if (sceneTime) {
          tempDiv = renderItems(sceneTime.timeItems, 'statusProcessingSystemResult.processedSceneContext.timeItems');
          if (tempDiv) content.appendChild(tempDiv);
        } else {
          const unavailableBlock = uiChatToolSpecificModule._createValueBlock('[Scene Time Unavailable]');
          if(unavailableBlock) content.appendChild(unavailableBlock);
        }
        break;
      case 'location':
        const sceneLocation = parsedSPSResult?.processedSceneContext;
        if (sceneLocation) {
          tempDiv = renderItems(sceneLocation.locationItems, 'statusProcessingSystemResult.processedSceneContext.locationItems', icons.map);
          if (tempDiv) content.appendChild(tempDiv);
        } else {
          const unavailableBlock = uiChatToolSpecificModule._createValueBlock('[Scene Location Unavailable]');
          if(unavailableBlock) content.appendChild(unavailableBlock);
        }
        break;
      case 'goals':
        const goalsInfo = parsedSPSResult?.processedCharacterInfo;
        if (goalsInfo) {
          tempDiv = renderItems(goalsInfo.internalGoalItems, 'statusProcessingSystemResult.processedCharacterInfo.internalGoalItems', '');
          if (tempDiv) content.appendChild(tempDiv);
        } else {
            const unavailableBlock = uiChatToolSpecificModule._createValueBlock('[Goals Info Unavailable]');
            if(unavailableBlock) content.appendChild(unavailableBlock);
        }
        break;
      case 'character':
        const charInfo = parsedSPSResult?.processedCharacterInfo;
        if (!charInfo) {
          const tempContainer = document.createElement('div');
          tempContainer.appendChild(content);
          return tempContainer.innerHTML;
        }

        const nameDiv = document.createElement('div');
        const nameIcon = document.createElement('span');
        nameIcon.className = 'icon';
        nameIcon.textContent = icons.name;
        nameDiv.appendChild(nameIcon);
        const nameBlock = uiChatToolSpecificModule._createValueBlock(charInfo.characterName || '[Unknown Name]', 'statusProcessingSystemResult.processedCharacterInfo.characterName');
        if(nameBlock) nameDiv.appendChild(nameBlock);
        content.appendChild(nameDiv);

        const charInfoMappings = [{
          items: charInfo.demeanorItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.demeanorItems',
          icon: icons.demeanor
        }, {
          items: charInfo.outerwearItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.outerwearItems',
          icon: icons.clothing
        }, {
          items: charInfo.underwearItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.underwearItems',
          icon: icons.underwear
        }, {
          items: charInfo.accessories,
          path: 'statusProcessingSystemResult.processedCharacterInfo.accessories',
          icon: icons.accessories
        }, {
          items: charInfo.actionPoseItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.actionPoseItems',
          icon: icons.pose
        }, {
          items: charInfo.currentPositionItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.currentPositionItems',
          icon: icons.map
        }, {
          items: charInfo.shortTermStatusItems,
          path: 'statusProcessingSystemResult.processedCharacterInfo.shortTermStatusItems',
          icon: icons.statusShort
        }, ];

        charInfoMappings.forEach(({
          items,
          path,
          icon
        }) => {
          tempDiv = renderItems(items, path, icon);
          if (tempDiv) content.appendChild(tempDiv);
        });
        break;
      default:
        const unknownBlock = uiChatToolSpecificModule._createValueBlock('[Unknown View]');
        if(unknownBlock) content.appendChild(unknownBlock);
    }
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(content);

    const noDataBlock = uiChatToolSpecificModule._createValueBlock('[No relevant data]');
    return tempContainer.innerHTML || `<div>${noDataBlock ? noDataBlock.outerHTML : ''}</div>`;
  },

  _renderStatusDisplayContent: (messageContainer, viewToShow, dataForDisplay, errorForDisplay, controlsDiv, contentDiv, messageObject) => {
    if (!contentDiv || !controlsDiv) {
      return;
    }

    const isUserMessage = messageObject.sourceType === 'user';
    const isAIMessageRoleType = messageObject.roleType === 'role' || messageObject.roleType === 'temporary_role';

    let isSPSDataPending = (isUserMessage || isAIMessageRoleType) && !messageObject.statusProcessingSystemResult && !messageObject.statusProcessingSystemError && !messageObject.statusProcessingSystemParserError && viewToShow !== 'imageView' && viewToShow !== 'none';
    let isDMDataPending = viewToShow === 'imageView' && !stateModule.drawingMasterImageCache.has(messageObject.id) && !messageObject.drawingMasterError && messageObject.drawingMasterContext;

    const isPending = isSPSDataPending || isDMDataPending;

    if (isPending) {
      const pendingBlock = uiChatToolSpecificModule._createValueBlock("[正在加载...]");
      contentDiv.innerHTML = pendingBlock ? pendingBlock.outerHTML : '';
      controlsDiv.querySelectorAll('.game-host-view-button').forEach(btn => btn.classList.remove('active'));
      return;
    }

    if (viewToShow === 'imageView') {
      contentDiv.innerHTML = uiChatToolSpecificModule._formatStatusDisplayContent(messageObject.parsedResult, viewToShow, messageObject);
    } else {
      const needsSPSData = (view) => (view === 'time' || view === 'location' || view === 'character' || view === 'goals');
      const dataIsActuallyNeeded = needsSPSData(viewToShow);

      if (dataIsActuallyNeeded && (messageObject.statusProcessingSystemError || messageObject.statusProcessingSystemParserError || !messageObject.statusProcessingSystemResult)) {
        const spsError = messageObject.statusProcessingSystemParserError || messageObject.statusProcessingSystemError;
        const errorBlock = uiChatToolSpecificModule._createValueBlock(spsError ? `[SPS解析错误: ${typeof spsError === 'string' ? spsError : JSON.stringify(spsError)}]` : "[当前视图无SPS数据]");
        contentDiv.innerHTML = errorBlock ? errorBlock.outerHTML : '';
      } else {
        const formattedContent = uiChatToolSpecificModule._formatStatusDisplayContent(messageObject.parsedResult, viewToShow, messageObject);
        contentDiv.innerHTML = formattedContent;
      }
    }

    const editableItems = contentDiv.querySelectorAll('.value-block[data-json-path]');
    editableItems.forEach(item => {
      eventListenersModule._setupLongPressListener(
        item,
        null,
        () => {
            if (typeof uiMessageEditorModule !== 'undefined') {
                uiMessageEditorModule.startEdit(item);
            }
        },
        false
      );
    });


    controlsDiv.querySelectorAll('.game-host-view-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewToShow);
    });
  },
};