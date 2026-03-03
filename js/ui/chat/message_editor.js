const uiMessageEditorModule = {
  activeEditor: null,

  init: () => {
  },

  startEdit: (element) => {
    if (uiMessageEditorModule.activeEditor) {
      uiMessageEditorModule.activeEditor.blur();
    }

    if (element.classList.contains('message-container')) {
      uiMessageEditorModule._editFullMessage(element);
    } else if (element.classList.contains('action-block')) {
      uiMessageEditorModule._editActionBlock(element);
    } else if (element.classList.contains('value-block')) {
      uiMessageEditorModule._editStatusItem(element);
    } else if (element.classList.contains('user-message') || element.classList.contains('ai-response')) {
        const container = element.closest('.message-container');
        if (container) uiMessageEditorModule._editFullMessage(container);
    }
  },

  saveCurrentEdit: () => {
    if (uiMessageEditorModule.activeEditor) {
      uiMessageEditorModule.activeEditor.blur();
    }
  },

  _getTextFromEditableDiv: (element) => {
    if (!element) return '';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
    let node;
    let text = '';
    let lastNodeWasBlock = true;

    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
        lastNodeWasBlock = false;
      } else if (node.nodeName === 'BR') {
        if (!text.endsWith('\n')) {
          text += '\n';
        }
        lastNodeWasBlock = true;
      } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
        if (!lastNodeWasBlock && text.length > 0) {
          text += '\n';
        }
        lastNodeWasBlock = true;
      }
    }
    return text;
  },

  _createEditorUI_Textarea: (targetElement, initialValue, saveCallback) => {
    const editorDiv = document.createElement('div');
    editorDiv.className = targetElement.className + ' universal-message-editor';
    editorDiv.setAttribute('contenteditable', 'true');
    editorDiv.innerText = initialValue;

    const parent = targetElement.parentNode;
    const nextSibling = targetElement.nextSibling;
    
    let displayStyleToRestore = targetElement.style.display;
    
    targetElement.style.display = 'none';
    parent.insertBefore(editorDiv, nextSibling);

    requestAnimationFrame(() => {
        editorDiv.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorDiv);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    const cleanup = () => {
        editorDiv.remove();
        if (document.body.contains(targetElement)) {
            targetElement.style.display = displayStyleToRestore || '';
        }
        uiMessageEditorModule.activeEditor = null;
        stateModule.editingMessageContainer = null;
    };

    const handleSave = () => {
        const newValue = uiMessageEditorModule._getTextFromEditableDiv(editorDiv);
        if (newValue.trim() !== initialValue.trim()) {
            saveCallback(newValue);
        }
        cleanup();
    };

    editorDiv.addEventListener('blur', handleSave);
    editorDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            editorDiv.blur();
        }
    });

    uiMessageEditorModule.activeEditor = editorDiv;
  },

  _createEditorUI_ContentEditable: (targetElement, initialValue, saveCallback) => {
    const mainContentContainer = targetElement.querySelector('.main-text-content');
    const allOtherChildren = Array.from(targetElement.children).filter(child => child !== mainContentContainer);
    allOtherChildren.forEach(child => child.style.display = 'none');

    targetElement.setAttribute('contenteditable', 'true');
    targetElement.innerText = initialValue;

    requestAnimationFrame(() => {
        targetElement.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(targetElement);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    const cleanup = () => {
        targetElement.removeAttribute('contenteditable');
        allOtherChildren.forEach(child => child.style.display = '');
        uiMessageEditorModule.activeEditor = null;
        stateModule.editingMessageContainer = null;
    };

    const handleSave = () => {
        const newValue = uiMessageEditorModule._getTextFromEditableDiv(targetElement);
        if (newValue !== initialValue) {
            saveCallback(newValue);
        }
        cleanup();
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        targetElement.innerText = initialValue;
        targetElement.blur();
      }
    };
    
    targetElement.addEventListener('blur', handleSave, { once: true });
    targetElement.addEventListener('keydown', handleKeydown, { once: true });
    
    uiMessageEditorModule.activeEditor = targetElement;
  },

  _editFullMessage: (msgCont) => {
    const messageId = msgCont.dataset.messageId;
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    const message = activePartition?.history.find(m => m.id === messageId);
    
    if (!message) {
        return;
    }

    const messageDiv = msgCont.querySelector('.user-message') || msgCont.querySelector('.ai-response');
    if (!messageDiv) return;

    let initialText = message.speechActionText || '';
    stateModule.editingMessageContainer = msgCont;

    const saveCallback = (newValue) => {
      if (!newValue.trim()) {
          transactionManagerModule.dispatch('DELETE_HISTORY_MESSAGE', {
              chatroomName: stateModule.currentChatroomDetails.config.name,
              partitionId: stateModule.activePartitionId,
              messageId: message.id
          });
          msgCont.remove();
          return;
      }

      const updates = {};
      updates.speechActionText = newValue;

      if (message.sourceType === 'ai') {
        updates.processedTurnActions = null;
        updates.statusProcessingSystemResult = null;
        updates.parsedResult = null;
      }

      transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        messageId: message.id,
        updates
      });
    };

    if(message.sourceType === 'user'){
        uiMessageEditorModule._createEditorUI_ContentEditable(messageDiv, initialText, saveCallback);
    } else {
        uiMessageEditorModule._createEditorUI_Textarea(messageDiv, initialText, saveCallback, 'bubble-message-editor');
    }
  },

  _editActionBlock: (actionBlock) => {
    const msgCont = actionBlock.closest('.message-container');
    if (!msgCont) return;
    
    const messageId = msgCont.dataset.messageId;
    const actionIndex = parseInt(actionBlock.dataset.actionIndex, 10);
    const initialText = actionBlock.querySelector('.action-content-display').textContent;

    uiMessageEditorModule._createEditorUI_Textarea(actionBlock.querySelector('.action-content-display'), initialText, (newValue) => {
      const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
      const message = activePartition?.history.find(m => m.id === messageId);
      if (!message) return;

      let actions = JSON.parse(JSON.stringify(message.processedTurnActions || []));
      
      if (actions.length === 0 && message.parsedResult?.processedTurnActions) {
          actions = JSON.parse(JSON.stringify(message.parsedResult.processedTurnActions));
      }

      if (actionIndex >= actions.length) return;

      actions[actionIndex].content = newValue;

      let updates = { processedTurnActions: actions };
      updates.speechActionText = chatParsingModule._getSpeechActionTextForHistory({ processedTurnActions: actions }, message.roleType, message.roleName, null);

      if (message.parsedResult) {
          const newParsedResult = JSON.parse(JSON.stringify(message.parsedResult));
          newParsedResult.processedTurnActions = actions;

          if (message.roleType === 'tool' && newParsedResult.originalData) {
              const roleName = message.roleName;

              if (roleName === 'gameHost' && newParsedResult.originalData.storytelling?.paragraphs) {
                  newParsedResult.originalData.storytelling.paragraphs[actionIndex] = newValue;
              } else if (roleName === 'privateAssistant' && newParsedResult.originalData.generatedResult?.responseItems) {
                  newParsedResult.originalData.generatedResult.responseItems[actionIndex] = newValue;
              }
          }
          updates.parsedResult = newParsedResult;
      }
      
      transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        messageId: messageId,
        updates
      });
    });
  },

  _editStatusItem: (statusItem) => {
    const msgCont = statusItem.closest('.message-container');
    if (!msgCont) return;
    
    const messageId = msgCont.dataset.messageId;
    const jsonPath = statusItem.dataset.jsonPath;
    const initialText = statusItem.textContent;

    if (!jsonPath) return;

    uiMessageEditorModule._createEditorUI_Textarea(statusItem, initialText, (newValue) => {
      const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
      const message = activePartition?.history.find(m => m.id === messageId);
      if (!message || !message.statusProcessingSystemResult) return;

      const spsResult = JSON.parse(JSON.stringify(message.statusProcessingSystemResult));

      try {
        const pathParts = jsonPath.split('.');
        if (pathParts[0] === 'statusProcessingSystemResult') {
            pathParts.shift();
        }

        let current = spsResult;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
            if (arrayMatch) {
                current = current[arrayMatch[1]][parseInt(arrayMatch[2], 10)];
            } else {
                current = current[part];
            }
        }

        const finalPart = pathParts[pathParts.length - 1];
        const finalArrayMatch = finalPart.match(/(\w+)\[(\d+)\]/);
        if (finalArrayMatch) {
            current[finalArrayMatch[1]][parseInt(finalArrayMatch[2], 10)] = newValue;
        } else {
            current[finalPart] = newValue;
        }

        transactionManagerModule.dispatch('UPDATE_HISTORY_MESSAGE', {
            chatroomName: stateModule.currentChatroomDetails.config.name,
            partitionId: stateModule.activePartitionId,
            messageId: messageId,
            updates: { statusProcessingSystemResult: spsResult }
        });

      } catch (e) {
        _logAndDisplayError(`Error updating status item: ${e.message}`, '_editStatusItem');
      }
    });
  }
};