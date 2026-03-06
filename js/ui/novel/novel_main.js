const uiNovelMainModule = {
  init: () => {
    const setupButton = (element, action) => {
      eventListenersModule._setupLongPressListener(element, action, action, false);
    };
    setupButton(elementsModule.novelSyncProgressButton, () => uiNovelMainModule.syncProgressToLatest());
    setupButton(elementsModule.novelBookshelfButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-bookshelf-page'));
    setupButton(elementsModule.novelTocButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-toc-page'));
    setupButton(elementsModule.novelSummaryButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-summary-page'));
    setupButton(elementsModule.novelContentButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-content-page'));
    setupButton(elementsModule.novelCloseButton, () => uiNovelMainModule.novelUI_toggleNovelInterface());
  },
  _getCurrentNovelData: () => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    return stateModule.currentChatroomDetails.novels.find(n => n.id === activePartition.currentNovelId);
  },
  _getRenderRange: (viewType) => {
    const novelData = uiNovelMainModule._getCurrentNovelData();
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const currentChapterIndex = activePartition.novelCurrentChapterIndices[activePartition.currentNovelId];
    const config = { content: { before: 1, after: 2 }, summary: { before: 10, after: 40 } }[viewType];
    return { 
      renderRange: { 
        startChapterIndex: Math.max(0, currentChapterIndex - config.before), 
        endChapterIndex: Math.min(novelData.toc.length - 1, currentChapterIndex + config.after) 
      }, 
      currentChapterIndex 
    };
  },
  syncProgressToLatest: async () => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const novelId = activePartition.currentNovelId;
    let latestIndex = -1;
    stateModule.currentChatroomDetails.partitions.forEach(partition => {
      const index = partition.novelCurrentChapterIndices[novelId];
      if (typeof index === 'number' && index > latestIndex) latestIndex = index;
    });
    const currentIndex = activePartition.novelCurrentChapterIndices[novelId];
    if (latestIndex > currentIndex) {
      await uiNovelMainModule.syncAllViewsToChapter(latestIndex, 'content', false);
      _logAndDisplayError(`小说进度已同步至最新章节 ${latestIndex + 1}。`, 'success');
    } else {
      _logAndDisplayError("当前分区已是最新进度。", 'info');
    }
  },
  syncAllViewsToChapter: async (targetChapterIndex, sourceViewType, isSilent = false) => {
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const novelId = activePartition.currentNovelId;
    if (activePartition.novelCurrentChapterIndices[novelId] !== targetChapterIndex) {
      if (isSilent) activePartition.novelCurrentChapterIndices[novelId] = targetChapterIndex;
      await transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        updates: { novelCurrentChapterIndices: { ...activePartition.novelCurrentChapterIndices, [novelId]: targetChapterIndex } },
        isUISilent: isSilent
      });
    }
    if (isSilent) return;
    requestAnimationFrame(() => {
      if (stateModule.activeNovelPage === 'novel-content-page') uiNovelContentModule.novelUI_renderVisibleChapters();
      else if (stateModule.activeNovelPage === 'novel-summary-page') uiNovelSummaryModule.novelSummaryUI_renderVisibleSummaries();
      else if (stateModule.activeNovelPage === 'novel-toc-page') uiNovelTocModule.novelUI_updateTocPage();
    });
  },
  novelUI_toggleNovelInterface: () => {
    if (elementsModule.novelInterface.classList.contains('active')) {
      elementsModule.novelInterface.classList.remove('active');
      stateModule.isNovelInterfaceVisible = false;
    } else {
      if (elementsModule.settingsPanel.classList.contains('active')) settingsPageManagerModule.toggleSettings();
      elementsModule.novelInterface.classList.add('active');
      stateModule.isNovelInterfaceVisible = true;
      uiNovelMainModule.novelUI_showNovelSection(stateModule.activeNovelPage || 'novel-summary-page');
    }
  },
  novelUI_closeAndClearAllPages: () => {
    [elementsModule.novelBookshelfPage, elementsModule.novelTocPage, elementsModule.novelSummaryPage, elementsModule.novelContentPage].forEach(page => {
      page.classList.remove('active');
      page.querySelector('.novel-page-section > .novel-page-group > div, #novel-content-area, #novel-summary-content-area').innerHTML = '';
    });
    stateModule.activeNovelPage = null;
  },
  novelUI_showNovelSection: (pageId) => {
    uiNovelMainModule.novelUI_closeAndClearAllPages();
    const activePartition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    const currentChapterIndex = activePartition.novelCurrentChapterIndices[activePartition.currentNovelId];
    let pageElement;
    if (pageId === 'novel-bookshelf-page') {
      pageElement = elementsModule.novelBookshelfPage;
      uiNovelBookshelfModule.novelUI_updateBookshelfPage();
    } else if (pageId === 'novel-toc-page') {
      pageElement = elementsModule.novelTocPage;
      uiNovelTocModule.novelUI_updateTocPage();
      requestAnimationFrame(() => uiNovelTocModule.novelTOCUI_updateActiveChapter(currentChapterIndex));
    } else if (pageId === 'novel-summary-page') {
      pageElement = elementsModule.novelSummaryPage;
      uiNovelSummaryModule.novelSummaryUI_renderVisibleSummaries();
    } else if (pageId === 'novel-content-page') {
      pageElement = elementsModule.novelContentPage;
      uiNovelContentModule.novelUI_loadAndDisplayNovelContent(activePartition.currentNovelId);
    }
    pageElement.classList.add('active');
    stateModule.activeNovelPage = pageId;
  },
  novelUI_updateNovelButtonVisual: () => {
    const partition = stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId);
    if (!partition) {
        elementsModule.novelButton.textContent = '📕';
        return;
    }
    const activeNovelIds = partition.activeNovelIds;
    elementsModule.novelButton.textContent = activeNovelIds.length > 0 ? '📖' : '📕';
  }
};