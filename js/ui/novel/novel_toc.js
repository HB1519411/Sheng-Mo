const uiNovelTocModule = {
  init: () => {
    elementsModule.novelTocListContainer.addEventListener('click', async (event) => {
      if (stateModule.isCooldownActive) return;
      const tocItem = event.target.closest('.novel-toc-item');
      if (!tocItem) return;
      const targetChapterIndex = parseInt(tocItem.dataset.tocIndex, 10);
      const novelId = tocItem.dataset.novelId;
      if (event.target.closest('.summarize-btn')) {
        event.stopPropagation();
        apiClientConfigModule.triggerNovelSummarization(novelId, targetChapterIndex);
        return;
      }
      if (event.target.closest('.delete-summary-btn')) {
        event.stopPropagation();
        apiClientConfigModule.deleteChapterSummary(novelId, targetChapterIndex, tocItem.querySelector('.toc-title').textContent);
        return;
      }
      await uiNovelMainModule.syncAllViewsToChapter(targetChapterIndex, 'toc', false);
      uiNovelMainModule.novelUI_showNovelSection('novel-summary-page');
    });
  },
  novelUI_updateTocPage: () => {
    const container = elementsModule.novelTocListContainer;
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const novelId = activePartition.currentNovelId;
    container.innerHTML = '';
    const novelData = stateModule.currentChatroomDetails.novels.find(n => n.id === novelId);
    const fragment = document.createDocumentFragment();
    novelData.toc.forEach((tocItem, index) => {
      const tocElement = document.createElement('div');
      tocElement.className = 'novel-toc-item';
      tocElement.dataset.tocIndex = index;
      tocElement.dataset.novelId = novelId;
      const titleSpan = document.createElement('span');
      titleSpan.className = 'toc-title';
      titleSpan.textContent = tocItem.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      tocElement.appendChild(titleSpan);
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      const summarizeBtn = document.createElement('div');
      summarizeBtn.className = 'std-button summarize-btn';
      summarizeBtn.textContent = 'Σ';
      summarizeBtn.title = '从此处开始总结';
      actionsDiv.appendChild(summarizeBtn);
      const deleteSummaryBtn = document.createElement('div');
      deleteSummaryBtn.className = 'std-button delete-summary-btn';
      deleteSummaryBtn.textContent = '✕';
      deleteSummaryBtn.title = '删除总结';
      if (!tocItem.summary) deleteSummaryBtn.style.display = 'none';
      actionsDiv.appendChild(deleteSummaryBtn);
      tocElement.appendChild(actionsDiv);
      fragment.appendChild(tocElement);
    });
    container.appendChild(fragment);
    uiNovelTocModule.novelTOCUI_updateActiveChapter(activePartition.novelCurrentChapterIndices[novelId]);
  },
  novelTOCUI_updateActiveChapter: (chapterIndex) => {
    novelEventsModule.updateActiveItem(elementsModule.novelTocListContainer, chapterIndex);
  }
};