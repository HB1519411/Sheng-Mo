const messageBubbleFactoryModule = {
  createMessageBubble: (messageObject, partitionId) => {
    if ((messageObject.roleName === 'statusProcessingSystem' || messageObject.roleName === 'drawingMaster' || messageObject.roleName === 'closeUpMaster' || messageObject.roleName === 'novelSummaryMaster') && messageObject.roleType === 'tool') {
      return document.createComment(`Placeholder for filtered tool message: ${messageObject.roleName}`);
    }

    const effectivePartitionId = partitionId || stateModule.activePartitionId;

    const msgCont = document.createElement('div');
    msgCont.className = 'message-container';
    msgCont.dataset.messageId = messageObject.id;
    msgCont.dataset.sourceType = messageObject.sourceType;
    msgCont.dataset.roleName = messageObject.roleName;
    msgCont.dataset.roleType = messageObject.roleType;

    if (messageObject.status === 'pending') {
      msgCont.classList.add('pending');
    }

    let activeViewForMessage = messageObject.activeView;
    if (!activeViewForMessage) {
      const hasCachedImage = stateModule.drawingMasterImageCache.has(messageObject.id);
      if (messageObject.sourceType === 'user') {
        activeViewForMessage = 'none';
      } else {
        activeViewForMessage = hasCachedImage ? 'imageView' : 'time';
      }
      messageObject.activeView = activeViewForMessage;
    }
    msgCont.dataset.activeView = activeViewForMessage;

    const roleNameButton = document.createElement('div');
    roleNameButton.className = 'std-button role-name-button-above-bubble';
    let buttonText = '';
    const {
      roleName,
      sourceType,
      targetRoleName
    } = messageObject;

    const displayName = uiChatUtilsModule.getDisplayName(roleName, effectivePartitionId);
    const nameForDisplay = (roleName === 'characterUpdateMaster' && targetRoleName) ? uiChatUtilsModule.getDisplayName(targetRoleName, effectivePartitionId) : displayName;

    if (nameForDisplay === 'privateAssistant') {
      buttonText = '‍💼';
    } else if (nameForDisplay === 'statusProcessingSystem') {
      buttonText = '🎲';
    } else if (nameForDisplay === 'gameHost') {
      buttonText = '🖋️';
    } else if (nameForDisplay === 'novelSummaryMaster') {
      buttonText = '∑';
    } else if (nameForDisplay === 'characterCreationMaster') {
      buttonText = '🆕';
    } else if (nameForDisplay === 'scriptCreationMaster') {
      buttonText = '📜';
    } else if (nameForDisplay === 'plotSummaryMaster') {
      buttonText = '📜';
    } else if (nameForDisplay === 'knowledgeRecordingMaster') {
      buttonText = '✍️';
    } else if (nameForDisplay === '用户') {
      buttonText = '📏';
    } else {
      buttonText = (nameForDisplay && nameForDisplay.length > 0) ? nameForDisplay.slice(-1) : (sourceType === 'user' ? 'U' : 'AI');
    }
    roleNameButton.textContent = buttonText;
    msgCont.appendChild(roleNameButton);

    const messageDiv = document.createElement('div');
    messageDiv.className = messageObject.sourceType === 'user' ? 'user-message' : 'ai-response';

    const mainContentContainer = document.createElement('div');
    mainContentContainer.className = 'main-text-content';

    const {
      status,
      parsedResult,
      speechActionText,
      parserError,
      processedTurnActions
    } = messageObject;

    if (status === 'pending') {
      mainContentContainer.textContent = speechActionText || "[正在响应]";
    } else {
      const isAI = messageObject.sourceType === 'ai';
      let turnActionsToRender = processedTurnActions;

      if (!turnActionsToRender && isAI && parsedResult && parsedResult.processedTurnActions) {
        turnActionsToRender = parsedResult.processedTurnActions;
      }

      if (Array.isArray(turnActionsToRender) && turnActionsToRender.length > 0 && messageObject.roleName !== 'privateAssistant') {
        turnActionsToRender.forEach((action, index) => {
          if (!action || typeof action !== 'object') return;
          const actionBlock = document.createElement('div');
          actionBlock.className = 'action-block';
          actionBlock.dataset.actionIndex = index;
          actionBlock.dataset.contentType = action.type || 'unknown';
          actionBlock.dataset.roleType = messageObject.roleType;

          if (action.isIncluded === true) {
             actionBlock.classList.add('is-included');
          }

          const contentDisplay = document.createElement('div');
          contentDisplay.className = 'action-content-display';
          contentDisplay.textContent = action.content || '';
          actionBlock.appendChild(contentDisplay);

          mainContentContainer.appendChild(actionBlock);
        });
      }

      if (mainContentContainer.children.length === 0) {
        if (parserError) {
          mainContentContainer.textContent = `[解析错误: ${parserError}]`;
        } else {
          mainContentContainer.textContent = speechActionText || '';
        }
      }
    }

    messageDiv.appendChild(mainContentContainer);

    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions-container';
    const {
      id: messageId,
      drawingMasterContext
    } = messageObject;
    const hasCachedImage = stateModule.drawingMasterImageCache.has(messageId);

    if (messageObject.status !== 'pending') {
      if (messageObject.roleName === 'characterUpdateMaster' || messageObject.roleName === 'characterCreationMaster') {
        const saveButton = document.createElement('div');
        saveButton.className = 'std-button message-action-button save-character-update-button';
        saveButton.textContent = '💾';
        eventListenersModule._setupLongPressListener(
          saveButton,
          () => {
            if (messageObject.roleName === 'characterCreationMaster') {
              messageActionsImplModule.saveNewCharacter(msgCont);
            } else if (messageObject.roleName === 'characterUpdateMaster') {
              messageActionsImplModule.saveCharacterUpdate(msgCont);
            }
          },
          () => messageActionsImplModule._handleBulkSaveCharacterUpdates(),
          false
        );
        messageActions.appendChild(saveButton);
      }
      if (messageObject.roleName === 'plotSummaryMaster') {
        const saveButton = document.createElement('div');
        saveButton.className = 'std-button message-action-button save-event-record-button';
        saveButton.textContent = '💾';
        eventListenersModule._setupLongPressListener(
          saveButton,
          () => messageActionsImplModule.saveEventRecord(msgCont),
          () => messageActionsImplModule.saveEventRecordWithManualInput(msgCont),
          false
        );
        messageActions.appendChild(saveButton);
      }
      if (messageObject.roleName === 'privateAssistant') {
        messageActions.innerHTML += `<div class="std-button message-action-button save-to-script-button">💾</div>`;
      }
      if (messageObject.roleName === 'knowledgeRecordingMaster') {
        messageActions.innerHTML += `<div class="std-button message-action-button save-knowledge-record-button">💾</div>`;
      }
      if (messageObject.roleType === 'role' || messageObject.roleType === 'temporary_role' || messageObject.roleType === 'user') {
        const redrawButton = document.createElement('div');
        redrawButton.className = 'std-button message-action-button redraw-button';
        redrawButton.textContent = '🖌️';
        eventListenersModule._setupLongPressListener(
          redrawButton,
          () => messageActionsImplModule.triggerDrawingMaster(msgCont),
          () => messageActionsImplModule.triggerCloseUpMaster(msgCont),
          false
        );
        messageActions.appendChild(redrawButton);
      }
      if (hasCachedImage) {
        const setBgButton = document.createElement('div');
        setBgButton.className = 'std-button message-action-button set-background-button';
        setBgButton.textContent = '🖼️';
        eventListenersModule._setupLongPressListener(
          setBgButton,
          () => messageActionsImplModule.setBackgroundFromMessage(msgCont),
          () => messageActionsImplModule.downloadImage(msgCont),
          false
        );
        messageActions.appendChild(setBgButton);
      }
    }

    const deleteButtonInActions = document.createElement('div');
    deleteButtonInActions.className = 'std-button message-action-button delete-button';
    deleteButtonInActions.textContent = '✕';
    messageActions.appendChild(deleteButtonInActions);
    msgCont.appendChild(messageActions);

    const shouldDisplayStatusPanel = messageObject.roleName !== '用户' &&
      (messageObject.sourceType === 'user' ||
        (messageObject.sourceType === 'ai' && (messageObject.roleType === 'role' || messageObject.roleType === 'temporary_role')));

    if (shouldDisplayStatusPanel) {
      const statusWrapper = document.createElement('div');
      statusWrapper.className = 'status-display-wrapper';
      const controlsDiv = document.createElement('div');
      controlsDiv.className = 'game-host-controls';

      const spsResult = messageObject.statusProcessingSystemResult;
      const scene = spsResult?.processedSceneContext;
      const character = spsResult?.processedCharacterInfo;
      const isImageViewAvailable = stateModule.drawingMasterImageCache.has(messageObject.id) || !!messageObject.drawingMasterContext;

      const viewConfig = [{
        id: 'time',
        icon: '🕒',
        isAvailable: scene && scene.timeItems && scene.timeItems.length > 0 && scene.timeItems[0] !== '无'
      }, {
        id: 'location',
        icon: '📍',
        isAvailable: scene && ((scene.locationItems && scene.locationItems.length > 0 && scene.locationItems[0] !== '无') || (scene.otherSceneInfoItems && scene.otherSceneInfoItems.length > 0 && scene.otherSceneInfoItems[0] !== '无'))
      }, {
        id: 'goals',
        icon: '🎯',
        isAvailable: character && character.internalGoalItems && character.internalGoalItems.length > 0 && character.internalGoalItems[0] !== '无 (不可见)'
      }, {
        id: 'character',
        icon: '👤',
        isAvailable: !!character
      }, {
        id: 'imageView',
        icon: '🎨',
        isAvailable: isImageViewAvailable
      }, ];

      viewConfig.forEach(view => {
        if (view.isAvailable) {
          const btn = document.createElement('div');
          btn.className = 'std-button game-host-view-button';
          btn.dataset.view = view.id;
          btn.textContent = view.icon;
          controlsDiv.appendChild(btn);
        }
      });

      statusWrapper.appendChild(controlsDiv);
      const contentDiv = document.createElement('div');
      contentDiv.className = 'game-host-content';
      statusWrapper.appendChild(contentDiv);

      let dataForStatus = null;
      let errorForStatus = null;
      if (messageObject.sourceType === 'user' || messageObject.roleType === 'role' || messageObject.roleType === 'temporary_role') {
        dataForStatus = messageObject.statusProcessingSystemResult;
        errorForStatus = messageObject.statusProcessingSystemParserError || messageObject.statusProcessingSystemError;
      }
      uiChatToolSpecificModule._renderStatusDisplayContent(msgCont, msgCont.dataset.activeView, dataForStatus, errorForStatus, controlsDiv, contentDiv, messageObject);
      messageDiv.appendChild(statusWrapper);
    }

    msgCont.appendChild(messageDiv);

    if (messageObject.sourceType === 'user' || messageObject.roleName === 'privateAssistant') {
      eventListenersModule._setupLongPressListener(
        messageDiv,
        null,
        (event) => {
          const target = event.target;
          if (target.closest('.value-block') || target.closest('.option-selection-badge')) {
            return;
          }
          if (typeof uiMessageEditorModule !== 'undefined') {
            uiMessageEditorModule.startEdit(msgCont);
          }
        },
        true
      );
    }

    if (messageObject.sourceType === 'ai' && messageObject.roleName !== 'privateAssistant') {
      const actionBlocks = mainContentContainer.querySelectorAll('.action-block');
      actionBlocks.forEach(block => {
        eventListenersModule._setupLongPressListener(
          block,
          () => messageActionsImplModule.toggleActionInclusion(block),
          () => {
            if (typeof uiMessageEditorModule !== 'undefined') {
              uiMessageEditorModule.startEdit(block);
            }
          },
          false
        );
      });
    }

    const deleteButton = messageActions.querySelector('.delete-button');
    if (deleteButton) {
      eventListenersModule._setupLongPressListener(
        deleteButton,
        () => messageActionsImplModule.deleteMessage(msgCont),
        () => messageActionsImplModule.deleteMessageAndBelow(msgCont),
        false
      );
    }

    return msgCont;
  },
};