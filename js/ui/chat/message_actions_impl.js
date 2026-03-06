const messageActionsImplModule = {
  init: () => {},

  _getLatestDateFromHistory: (partitionId) => {
    const partition = stateModule.currentChatroomDetails.partitions.get(partitionId);
    for (let i = partition.history.length - 1; i >= 0; i--) {
      const msg = partition.history[i];
      const timeItems = msg.statusProcessingSystemResult?.processedSceneContext?.timeItems;
      if (Array.isArray(timeItems)) {
        for (const item of timeItems) {
          if (typeof item === 'string' && /^-?\d{4}-\d{2}-\d{2}$/.test(item.trim())) {
            return item.trim();
          }
        }
      }
      if (msg.calculatedWorldTime && typeof msg.calculatedWorldTime === 'string' && /^-?\d{4}-\d{2}-\d{2}$/.test(msg.calculatedWorldTime.trim())) {
        return msg.calculatedWorldTime.trim();
      }
    }
    return null;
  },

  toggleMessageActions: (msgCont) => {
    if (stateModule.activeMessageActions && stateModule.activeMessageActions !== msgCont) {
      const actions = stateModule.activeMessageActions.querySelector('.message-actions-container');
      actions.style.display = 'none';
    }
    const actions = msgCont.querySelector('.message-actions-container');
    const isVisible = actions.style.display === 'flex';
    actions.style.display = isVisible ? 'none' : 'flex';
    stateModule.activeMessageActions = isVisible ? null : msgCont;
  },

  hideAllMessageActions: () => {
    if (stateModule.activeMessageActions) {
      const actions = stateModule.activeMessageActions.querySelector('.message-actions-container');
      actions.style.display = 'none';
      stateModule.activeMessageActions = null;
    }
  },

  toggleActionInclusion: (actionBlock) => {
    if (actionBlock.querySelector('.universal-message-editor')) return;
    const msgCont = actionBlock.closest('.message-container');
    const messageId = msgCont.dataset.messageId;
    const actionIndex = parseInt(actionBlock.dataset.actionIndex, 10);
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const message = activePartition.history.find(m => m.id === messageId);

    let actions = JSON.parse(JSON.stringify(message.processedTurnActions || message.parsedResult.processedTurnActions));

    actions[actionIndex].isIncluded = !actions[actionIndex].isIncluded;

    let updates = { processedTurnActions: actions };
    updates.speechActionText = chatParsingModule._getSpeechActionTextForHistory({ processedTurnActions: actions }, message.roleType, message.roleName, null);

    if (message.parsedResult) {
        const newParsedResult = JSON.parse(JSON.stringify(message.parsedResult));
        newParsedResult.processedTurnActions = actions;
        updates.parsedResult = newParsedResult;
    }
    
    transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      messageId: messageId,
      updates
    });
  },

  _getMessageAndActions: (msgCont) => {
    const messageId = msgCont.dataset.messageId;
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const message = activePartition.history.find(m => m.id === messageId);
    const actions = message.processedTurnActions || message.parsedResult.processedTurnActions;
    return { ...message, processedTurnActions: actions, _originalMessageRef: message };
  },

  deleteMessage: (msgCont) => {
    const messageId = msgCont.dataset.messageId;
    const isPending = msgCont.dataset.status === 'pending';

    if (stateModule.pendingRequests.has(messageId)) {
      stateModule.pendingRequests.get(messageId).abort();
    }

    if (isPending) {
      msgCont.remove();
      return;
    }

    transactionManagerModule.dispatch('DELETE_HISTORY_MESSAGE', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      messageId
    });
  },

  deleteMessageAndBelow: (msgCont) => {
    transactionManagerModule.dispatch('DELETE_HISTORY_FROM', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      messageId: msgCont.dataset.messageId
    });
  },

  handleNovelAiResponse: (partitionId, naiResponse, drawingMasterParsedData, rawJsonText, triggerMessageId) => {
    const partition = stateModule.currentChatroomDetails.partitions.get(partitionId);
    const messageIndex = partition.history.findIndex(m => m.id === triggerMessageId);
    const updates = {};
    if (naiResponse.success && naiResponse.data.imageDataUrl) {
      stateModule.drawingMasterImageCache.set(triggerMessageId, naiResponse.data.imageDataUrl);
      updates.drawingMasterResult = { hasImage: true };
      updates.drawingMasterError = null;
    } else {
      updates.drawingMasterError = naiResponse.error || { code: "UNKNOWN_NAI_ERROR", message: "An unknown error occurred during image generation." };
      updates.drawingMasterResult = null;
    }

    transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: partitionId,
      messageId: triggerMessageId,
      updates: updates
    }).then(() => {
      const updatedPartition = stateModule.currentChatroomDetails.partitions.get(partitionId);
      const messageToUpdate = updatedPartition.history.find(m => m.id === triggerMessageId);
      if (naiResponse.success) {
        messageToUpdate.activeView = 'imageView';
      }
      const partitionContainer = stateModule.partitionDOMCache.get(partitionId);
      const existingElement = partitionContainer.querySelector(`.message-container[data-message-id="${triggerMessageId}"]`);
      const newElement = messageBubbleFactoryModule.createMessageBubble(messageToUpdate, partitionId);
      existingElement.replaceWith(newElement);
    });
  },

  handleLongPressOnBubbleItem: (element) => {
    uiMessageEditorModule.startEdit(element);
  },

  saveNewCharacter: (msgCont) => messageActionsCharacterModule.saveNewCharacter(msgCont),
  saveCharacterUpdate: (msgCont) => messageActionsCharacterModule.saveCharacterUpdate(msgCont),
  _handleBulkSaveCharacterUpdates: () => messageActionsCharacterModule._handleBulkSaveCharacterUpdates(),
  saveEventRecord: (msgCont, override) => messageActionsToolsModule.saveEventRecord(msgCont, override),
  saveEventRecordWithManualInput: (msgCont) => messageActionsToolsModule.saveEventRecordWithManualInput(msgCont),
  savePrivateAssistantToScript: (msgCont) => messageActionsToolsModule.savePrivateAssistantToScript(msgCont),
  saveKnowledgeRecord: (msgCont) => messageActionsToolsModule.saveKnowledgeRecord(msgCont),
  triggerDrawingMaster: (msgCont) => messageActionsToolsModule.triggerDrawingMaster(msgCont),
  triggerCloseUpMaster: (msgCont) => messageActionsToolsModule.triggerCloseUpMaster(msgCont),
  setBackgroundFromMessage: (msgCont) => messageActionsToolsModule.setBackgroundFromMessage(msgCont),
  downloadImage: (msgCont) => messageActionsToolsModule.downloadImage(msgCont)
};