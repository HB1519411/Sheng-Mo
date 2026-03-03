const messageActionsDelegateModule = {
  init: () => {
    elementsModule.chatArea.addEventListener('click', messageActionsDelegateModule._handleMessageAreaClick);
    eventBus.on('STATE_UPDATED_FROM_SERVER', () => {
      const activeMessageId = stateModule.activeMessageActions ? stateModule.activeMessageActions.dataset.messageId : null;
      if (activeMessageId) {
        const partition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
        const messageExists = partition && partition.history.some(m => m.id === activeMessageId);
        if (!messageExists) {
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
    if (viewButton) {
      uiChatToolSpecificModule._handleStatusViewChange(viewButton);
      return;
    }

    const nameButton = event.target.closest('.role-name-button-above-bubble');
    if (nameButton) {
      messageActionsImplModule.toggleMessageActions(msgCont);
      return;
    }

    const toggleRawButton = event.target.closest('.toggle-raw-button');
    if (toggleRawButton) {
      messageActionsImplModule.toggleRawJsonView(msgCont);
      return;
    }

    const saveCharUpdateButton = event.target.closest('.save-character-update-button');
    if (saveCharUpdateButton) {
      return;
    }

    const saveEventRecordButton = event.target.closest('.save-event-record-button');
    if (saveEventRecordButton) {
      return;
    }

    const saveToScriptButton = event.target.closest('.save-to-script-button');
    if (saveToScriptButton) {
      messageActionsImplModule.savePrivateAssistantToScript(msgCont);
      return;
    }

    const saveKnowledgeRecordButton = event.target.closest('.save-knowledge-record-button');
    if (saveKnowledgeRecordButton) {
      messageActionsImplModule.saveKnowledgeRecord(msgCont);
      return;
    }
  },
};