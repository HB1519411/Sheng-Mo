const partitionRendererModule = {
  init: () => {
    eventBus.on('HISTORY_CHANGED', (data) => {
      const {
        type,
        payload
      } = data;
      const {
        partitionId
      } = payload;

      if (partitionId !== stateModule.activePartitionId) {
        if (type === 'ADD_HISTORY_MESSAGE') {
          stateModule.newMessagesInPartitions.add(partitionId);
          partitionListManagerModule.updatePartitionList();
        }
      }

      const partitionContainer = stateModule.partitionDOMCache.get(partitionId);
      if (!partitionContainer) return;

      switch (type) {
        case 'ADD_HISTORY_MESSAGE':
          {
            const messageObject = payload.message;
            const existingElement = partitionContainer.querySelector(`.message-container[data-message-id="${messageObject.id}"]`);
            if (existingElement && existingElement.dataset.status === 'pending') {
            } else if (!existingElement) {
              const newElement = messageBubbleFactoryModule.createMessageBubble(messageObject, partitionId);
              if (newElement) {
                partitionContainer.appendChild(newElement);
                if (partitionId === stateModule.activePartitionId) {
                  partitionRendererModule.scrollToBottom();
                }
              }
            }
            break;
          }
        case 'UPDATE_HISTORY_MESSAGE':
          {
            const messageId = payload.messageId;
            const messageObject = stateModule.currentChatroomDetails.partitions.get(partitionId).history.find(m => m.id === messageId);
            if (messageObject) {
              const existingElement = partitionContainer.querySelector(`.message-container[data-message-id="${messageId}"]`);
              if (existingElement) {
                const newElement = messageBubbleFactoryModule.createMessageBubble(messageObject, partitionId);
                if (newElement) {
                  existingElement.replaceWith(newElement);
                }
              }
            }
            break;
          }
        case 'DELETE_HISTORY_MESSAGE':
          {
            const messageId = payload.messageId;
            const elementToRemove = partitionContainer.querySelector(`.message-container[data-message-id="${messageId}"]`);
            if (elementToRemove) {
              elementToRemove.remove();
            }
            break;
          }
        case 'UPDATE_PARTITION_HISTORY':
          {
            partitionContainer.innerHTML = '';
            const newHistory = payload.newHistory || [];
            const fragment = document.createDocumentFragment();
            newHistory.forEach(msgObj => {
                const newElement = messageBubbleFactoryModule.createMessageBubble(msgObj, partitionId);
                if (newElement) fragment.appendChild(newElement);
            });
            partitionContainer.appendChild(fragment);
            if (partitionId === stateModule.activePartitionId) {
              partitionRendererModule.scrollToBottom();
            }
            break;
          }
      }
    });

    eventBus.on('PARTITION_SWITCHED', (data) => {
      if (data.newPartitionId) {
        partitionRendererModule.renderChatAreaForPartition(data.newPartitionId);
      }
    });
  },

  createPlaceholderElement: (partitionId, roleName, roleType, targetRoleName, messageId) => {
    if (roleName === 'statusProcessingSystem' || roleName === 'drawingMaster') {
      return null;
    }

    const effectiveMessageId = messageId || uiChatUtilsModule._generateMessageId();

    const placeholderMessageObject = {
      id: effectiveMessageId,
      timestamp: Date.now(),
      sourceType: 'ai',
      roleName: roleName,
      roleType: roleType,
      targetRoleName: targetRoleName,
      speechActionText: '[正在响应]',
      rawJson: null,
      parsedResult: null,
      displayMode: 'formatted',
      parserError: null,
      status: 'pending',
    };

    return messageBubbleFactoryModule.createMessageBubble(placeholderMessageObject, partitionId);
  },

  updateMessageElementStatus: (messageId, statusText, isImageUpdate = false) => {
    if (isImageUpdate) {
        return;
    }
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (!activePartition) return;

    const selector = `.message-container[data-message-id="${messageId}"]`;
    const messageContainer = document.querySelector(selector);

    if (!messageContainer) return;
    const messageObject = activePartition.history.find(msg => msg.id === messageId);
    if (!messageObject) return;

    const statusPanel = messageContainer.querySelector('.status-display-wrapper');
    const contentDivInStatusPanel = statusPanel ? statusPanel.querySelector('.game-host-content') : null;

    if (isImageUpdate) {
      if (contentDivInStatusPanel && messageObject.activeView === 'imageView') {
        contentDivInStatusPanel.innerHTML = uiChatToolSpecificModule._createValueBlock(statusText).outerHTML;
      } else if (messageObject.activeView === 'imageView') {}
    } else {
      if (contentDivInStatusPanel && (messageObject.activeView !== 'imageView' || !isImageUpdate)) {
        contentDivInStatusPanel.innerHTML = uiChatToolSpecificModule._createValueBlock(statusText).outerHTML;
      }
    }
  },

  clearAllPartitionCaches: () => {
    stateModule.partitionDOMCache.clear();
    stateModule.partitionScrollPositions.clear();
    if (elementsModule.chatArea) {
      elementsModule.chatArea.innerHTML = '';
    }
  },

  renderChatAreaForPartition: (partitionId, isInitialLoadOrSwitch = false) => {
    const currentlyVisible = document.querySelector('#chat-area > div[data-partition-id][style*="display: block"]');
    if (currentlyVisible) {
        const visiblePartitionId = currentlyVisible.dataset.partitionId;
        if (visiblePartitionId && elementsModule.chatArea) {
            stateModule.partitionScrollPositions.set(visiblePartitionId, elementsModule.chatArea.scrollTop);
        }
    }

    stateModule.partitionDOMCache.forEach((container, id) => {
        if (id !== partitionId) {
            container.style.display = 'none';
        }
    });

    const targetContainer = stateModule.partitionDOMCache.get(partitionId);
    if (targetContainer) {
        targetContainer.style.display = 'block';
        if (isInitialLoadOrSwitch) {
            requestAnimationFrame(() => partitionRendererModule.scrollToBottom());
        } else {
            const savedScrollTop = stateModule.partitionScrollPositions.get(partitionId);
            if (typeof savedScrollTop === 'number' && elementsModule.chatArea) {
                elementsModule.chatArea.scrollTop = savedScrollTop;
            } else {
                requestAnimationFrame(() => partitionRendererModule.scrollToBottom());
            }
        }
    }
  },
  
  addMessageElement: (messageObject, partitionId) => {
    const partitionContainer = stateModule.partitionDOMCache.get(partitionId);
    if (!partitionContainer) {
      return null;
    }
    const newElement = messageBubbleFactoryModule.createMessageBubble(messageObject, partitionId);
    if (newElement) {
      partitionContainer.appendChild(newElement);
      partitionRendererModule.scrollToBottom();
    }
    return newElement;
  },

  scrollToBottom: () => {
    if (elementsModule.chatArea) {
      elementsModule.chatArea.scrollTop = elementsModule.chatArea.scrollHeight;
    }
  },

  showLoadingSpinner: () => {
    if (elementsModule.loadingSpinner) {
      elementsModule.loadingSpinner.style.display = 'block';
      elementsModule.loadingSpinner.classList.add('spinning');
    }
  },

  hideLoadingSpinner: () => {
    if (elementsModule.loadingSpinner) {
      elementsModule.loadingSpinner.style.display = 'none';
      elementsModule.loadingSpinner.classList.remove('spinning');
    }
  },

  showRetryIndicator: () => {
    const spinner = elementsModule.loadingSpinner;
    if (spinner) {
      spinner.classList.add('retry-indicator');
      setTimeout(() => {
        spinner.classList.remove('retry-indicator');
      }, 200);
    }
  },
};