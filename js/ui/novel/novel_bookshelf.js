const uiNovelBookshelfModule = {
  init: () => {
    elementsModule.novelBookshelfListContainer.addEventListener('change', (event) => {
      if (stateModule.isCooldownActive) return;
      const target = event.target;
      const item = target.closest('.novel-bookshelf-item');
      if (!item) return;
      if (target.type === 'radio' && target.name === 'currentNovelSelection' && target.checked) {
        uiNovelBookshelfModule.novelUI_handleNovelSelection(item.dataset.novelId);
      } else if (target.type === 'checkbox' && target.classList.contains('novel-activation-checkbox')) {
        uiNovelBookshelfModule.novelUI_handleNovelActivation(item.dataset.novelId, target.checked);
      }
    });
    elementsModule.novelBookshelfListContainer.addEventListener('click', (event) => {
      if (stateModule.isCooldownActive) return;
      if (event.target.closest('label')) {
        event.preventDefault();
        const radio = event.target.closest('.novel-bookshelf-item').querySelector('input[type="radio"]');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  },
  novelUI_updateBookshelfPage: () => {
    const container = elementsModule.novelBookshelfListContainer;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails.partitions.get(stateModule.activePartitionId);
    container.innerHTML = '';
    const activeIdsInPartition = new Set(activePartition.activeNovelIds);
    const fragment = document.createDocumentFragment();
    [...chatroomDetails.novels].sort((a, b) => a.name.localeCompare(b.name)).forEach(novel => {
      const item = document.createElement('div');
      item.className = 'novel-bookshelf-item';
      item.dataset.novelId = novel.id;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'currentNovelSelection';
      radio.value = novel.id;
      radio.id = `novel-select-${chatroomDetails.config.name}-${novel.id.replace(/\./g, '-')}`;
      radio.checked = activePartition.currentNovelId === novel.id;
      const label = document.createElement('label');
      label.textContent = novel.name;
      label.htmlFor = radio.id;
      label.style.cursor = 'pointer';
      if (activePartition.currentNovelId === novel.id) label.style.fontWeight = 'bold';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'novel-activation-checkbox';
      checkbox.value = novel.id;
      checkbox.id = `novel-activate-${chatroomDetails.config.name}-${novel.id.replace(/\./g, '-')}`;
      checkbox.checked = activeIdsInPartition.has(novel.id);
      item.appendChild(radio);
      item.appendChild(label);
      item.appendChild(checkbox);
      fragment.appendChild(item);
    });
    container.appendChild(fragment);
  },
  novelUI_handleNovelSelection: async (novelId) => {
    await transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      updates: { currentNovelId: novelId, lastViewedNovelId: novelId }
    });
    uiNovelMainModule.novelUI_showNovelSection('novel-summary-page');
  },
  novelUI_handleNovelActivation: (novelId, isChecked) => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const activeIds = activePartition.activeNovelIds;
    const index = activeIds.indexOf(novelId);
    if (isChecked && index === -1) activeIds.push(novelId);
    else if (!isChecked && index > -1) activeIds.splice(index, 1);
    else return;
    transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      partitionId: stateModule.activePartitionId,
      updates: { activeNovelIds: activeIds }
    });
  }
};