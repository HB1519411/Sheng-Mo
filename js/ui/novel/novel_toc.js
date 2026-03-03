const uiNovelTocModule = {
  init: () => {
    if (elementsModule.novelTocListContainer) {
      elementsModule.novelTocListContainer.addEventListener('click', async (event) => {
        if (stateModule.isCooldownActive) return;
        const tocItem = event.target.closest('.novel-toc-item');
        if (!tocItem || tocItem.dataset.tocIndex === undefined) return;

        const targetChapterIndex = parseInt(tocItem.dataset.tocIndex, 10);
        if (isNaN(targetChapterIndex)) return;

        const novelId = tocItem.dataset.novelId;
        const chapterTitle = tocItem.querySelector('.toc-title')?.textContent || `Chapter ${targetChapterIndex}`;

        if (event.target.closest('.summarize-btn')) {
          event.stopPropagation();
          apiClientConfigModule.triggerNovelSummarization(novelId, targetChapterIndex);
          return;
        }

        if (event.target.closest('.delete-summary-btn')) {
          event.stopPropagation();
          apiClientConfigModule.deleteChapterSummary(novelId, targetChapterIndex, chapterTitle);
          return;
        }

        await uiNovelMainModule.syncAllViewsToChapter(targetChapterIndex, 'toc', false);
        uiNovelMainModule.novelUI_showNovelSection('novel-summary-page');
      });
    }
  },
  novelUI_updateTocPage: () => {
    const container = elementsModule.novelTocListContainer;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    const novelId = activePartition?.currentNovelId;

    if (!container) return;
    if (!chatroomDetails || !chatroomDetails.config?.name || !novelId || !activePartition) {
      container.innerHTML = '<p style="text-align: center;">请先在书目中选择一本小说</p>';
      return;
    }
    container.innerHTML = '';
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData || !novelData.toc || novelData.toc.length === 0) {
      container.innerHTML = '<p style="text-align: center;">未找到章节信息</p>';
      return;
    }
    const currentChapterIndex = activePartition.novelCurrentChapterIndices?.[novelId] ?? 0;

    const fragment = document.createDocumentFragment();
    novelData.toc.forEach((tocItem, index) => {
      if (tocItem && tocItem.title !== undefined) {
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
        if (!tocItem.summary) {
          deleteSummaryBtn.style.display = 'none';
        }
        actionsDiv.appendChild(deleteSummaryBtn);

        tocElement.appendChild(actionsDiv);
        fragment.appendChild(tocElement);
      }
    });
    container.appendChild(fragment);

    uiNovelTocModule.novelTOCUI_updateActiveChapter(currentChapterIndex);
  },

  novelTOCUI_updateActiveChapter: (chapterIndex) => {
    novelEventsModule.updateActiveItem(elementsModule.novelTocListContainer, chapterIndex);
  }
};