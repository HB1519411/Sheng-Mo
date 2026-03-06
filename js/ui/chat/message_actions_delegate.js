const messageActionsDelegateModule = {
  init: () => {
    elementsModule.chatArea.addEventListener('click', messageActionsDelegateModule._handleMessageAreaClick);
    eventBus.on('STATE_UPDATED_FROM_SERVER', () => {
      const activeMessageId = stateModule.activeMessageActions ? stateModule.activeMessageActions.dataset.messageId : null;
      if (activeMessageId) {
        const partition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
        if (!partition || !partition.history.some(m => m.id === activeMessageId)) {
          messageActionsImplModule.hideAllMessageActions();
        }
      }
    });
  },

  _handleMessageAreaClick: (event) => {
    if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') return;

    const msgCont = event.target.closest('.message-container');
    if (!msgCont) return;

    if (event.target.closest('.delete-button') || event.target.closest('.redraw-button') || event.target.closest('.set-background-button')) {
      return;
    }

    const viewButton = event.target.closest('.game-host-view-button');
    if (viewButton) return uiChatToolSpecificModule._handleStatusViewChange(viewButton);

    const nameButton = event.target.closest('.role-name-button-above-bubble');
    if (nameButton) return messageActionsImplModule.toggleMessageActions(msgCont);

    const toggleRawButton = event.target.closest('.toggle-raw-button');
    if (toggleRawButton) return messageActionsImplModule.toggleRawJsonView(msgCont);

    const saveToScriptButton = event.target.closest('.save-to-script-button');
    if (saveToScriptButton) return messageActionsImplModule.savePrivateAssistantToScript(msgCont);

    const saveKnowledgeRecordButton = event.target.closest('.save-knowledge-record-button');
    if (saveKnowledgeRecordButton) return messageActionsImplModule.saveKnowledgeRecord(msgCont);
  }
};