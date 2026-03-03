const uiNovelBookshelfModule = {
  init: () => {
    if (elementsModule.novelBookshelfListContainer) {
      elementsModule.novelBookshelfListContainer.addEventListener('change', (event) => {
        if (stateModule.isCooldownActive) return;
        const target = event.target;
        const item = target.closest('.novel-bookshelf-item');
        if (!item) return;
        const novelId = item.dataset.novelId;
        if (target.type === 'radio' && target.name === 'currentNovelSelection' && target.checked) {
          uiNovelBookshelfModule.novelUI_handleNovelSelection(novelId);
        } else if (target.type === 'checkbox' && target.classList.contains('novel-activation-checkbox')) {
          const isChecked = target.checked;
          uiNovelBookshelfModule.novelUI_handleNovelActivation(novelId, isChecked);
        }
      });
      elementsModule.novelBookshelfListContainer.addEventListener('click', (event) => {
        if (stateModule.isCooldownActive) return;
        const label = event.target.closest('label');
        const item = event.target.closest('.novel-bookshelf-item');
        if (label && item) {
          event.preventDefault();
          const radio = item.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            const changeEvent = new Event('change', {
              bubbles: true
            });
            radio.dispatchEvent(changeEvent);
          }
        }
      });
    }
  },
  novelUI_updateBookshelfPage: () => {
    const container = elementsModule.novelBookshelfListContainer;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);

    if (!container) return;
    if (!chatroomDetails || !chatroomDetails.config?.name || !activePartition) {
      container.innerHTML = '<p style="text-align: center;">请先在书目中选择一本小说</p>';
      return;
    }
    container.innerHTML = '';
    const currentNovelId = activePartition.currentNovelId;
    const currentChatroomName = chatroomDetails.config.name;
    const associatedNovels = chatroomDetails.novels || [];
    if (associatedNovels.length === 0) {
      container.innerHTML = '<p style="text-align: center;">当前聊天室无小说<br>(请在 设置 -> 聊天室设置 -> 聊天室详情 -> 聊天室小说 中添加)</p>';
      return;
    }
    const activeIdsInPartition = new Set(activePartition.activeNovelIds || []);
    const fragment = document.createDocumentFragment();
    const sortedNovels = [...associatedNovels]
      .filter(Boolean)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortedNovels.length === 0) {
      container.innerHTML = '<p style="text-align: center;">关联的小说似乎已被删除</p>';
      return;
    }
    sortedNovels.forEach(novel => {
      if (!novel || !novel.id || !novel.name) return;
      const item = document.createElement('div');
      item.className = 'novel-bookshelf-item';
      item.dataset.novelId = novel.id;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'currentNovelSelection';
      radio.value = novel.id;
      radio.id = `novel-select-${currentChatroomName}-${novel.id.replace(/\./g, '-')}`;
      radio.checked = currentNovelId === novel.id;
      const label = document.createElement('label');
      label.textContent = novel.name;
      label.htmlFor = radio.id;
      label.style.cursor = 'pointer';
      if (currentNovelId === novel.id) {
        label.style.fontWeight = 'bold';
      }
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'novel-activation-checkbox';
      checkbox.value = novel.id;
      checkbox.id = `novel-activate-${currentChatroomName}-${novel.id.replace(/\./g, '-')}`;
      checkbox.checked = activeIdsInPartition.has(novel.id);
      item.appendChild(radio);
      item.appendChild(label);
      item.appendChild(checkbox);
      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  },

  novelUI_handleNovelSelection: async (novelId) => {
    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) return;

    const updates = {
      currentNovelId: novelId,
      lastViewedNovelId: novelId
    };

    await transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      updates
    });

    uiNovelMainModule.novelUI_showNovelSection('novel-summary-page');
  },

  novelUI_handleNovelActivation: (novelId, isChecked) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) return;
    let activeIds = activePartition.activeNovelIds || [];
    const index = activeIds.indexOf(novelId);
    if (isChecked && index === -1) {
      activeIds.push(novelId);
    } else if (!isChecked && index > -1) {
      activeIds.splice(index, 1);
    } else {
      return;
    }
    transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
      chatroomName: chatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      updates: {
        activeNovelIds: activeIds
      }
    });
  }
};