const uiNovelMainModule = {
  init: () => {
    const setupButton = (element, action) => {
      if (element) {
        eventListenersModule._setupLongPressListener(element, action, action, false);
      }
    };
    setupButton(elementsModule.novelSyncProgressButton, () => uiNovelMainModule.syncProgressToLatest());
    setupButton(elementsModule.novelBookshelfButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-bookshelf-page'));
    setupButton(elementsModule.novelTocButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-toc-page'));
    setupButton(elementsModule.novelSummaryButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-summary-page'));
    setupButton(elementsModule.novelContentButton, () => uiNovelMainModule.novelUI_showNovelSection('novel-content-page'));
    setupButton(elementsModule.novelCloseButton, () => uiNovelMainModule.novelUI_toggleNovelInterface());
  },

  _getCurrentNovelData: () => {
    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition || !activePartition.currentNovelId) return null;
    return stateModule.currentChatroomDetails?.novels?.find(n => n.id === activePartition.currentNovelId) || null;
  },

  _getRenderRange: (viewType) => {
    const novelData = uiNovelMainModule._getCurrentNovelData();
    const activePartition = stateModule.currentChatroomDetails?.partitions.get(stateModule.activePartitionId);
    if (!novelData || !activePartition || !activePartition.currentNovelId) return null;

    const novelId = activePartition.currentNovelId;
    const currentChapterIndex = activePartition.novelCurrentChapterIndices?.[novelId] ?? 0;
    const toc = novelData.toc;
    const totalChapters = toc.length;

    if (currentChapterIndex < 0 || currentChapterIndex >= totalChapters) return null;

    const ranges = {
      content: { before: 1, after: 2 },
      summary: { before: 10, after: 40 }
    };

    const config = ranges[viewType] || ranges['content'];
    const startChapterIndex = Math.max(0, currentChapterIndex - config.before);
    const endChapterIndex = Math.min(totalChapters - 1, currentChapterIndex + config.after);

    if (startChapterIndex > endChapterIndex) {
      return null;
    }

    return {
      renderRange: {
        startChapterIndex,
        endChapterIndex,
      },
      currentChapterIndex
    };
  },

  syncProgressToLatest: async () => {
    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition || !activePartition.currentNovelId) {
      _logAndDisplayError("没有当前小说可以同步进度。", 'warn');
      return;
    }
    const novelId = activePartition.currentNovelId;
    let latestIndex = -1;
    stateModule.currentChatroomDetails.partitions.forEach(partition => {
      const index = partition.novelCurrentChapterIndices?.[novelId];
      if (typeof index === 'number' && index > latestIndex) {
        latestIndex = index;
      }
    });

    const currentIndex = activePartition.novelCurrentChapterIndices?.[novelId] ?? 0;
    if (latestIndex > currentIndex) {
      await uiNovelMainModule.syncAllViewsToChapter(latestIndex, 'content', false);
      _logAndDisplayError(`小说进度已同步至最新章节 ${latestIndex + 1}。`, 'success');
    } else {
      _logAndDisplayError("当前分区已是最新进度。", 'info');
    }
  },

  syncAllViewsToChapter: async (targetChapterIndex, sourceViewType, isSilent = false) => {
    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!activePartition) return;
    const novelId = activePartition.currentNovelId;
    if (!novelId) return;

    if (!activePartition.novelCurrentChapterIndices) activePartition.novelCurrentChapterIndices = {};
    if (activePartition.novelCurrentChapterIndices[novelId] !== targetChapterIndex) {
      if (isSilent) {
        activePartition.novelCurrentChapterIndices[novelId] = targetChapterIndex;
      }

      const updates = {
        novelCurrentChapterIndices: {
          ...activePartition.novelCurrentChapterIndices,
          [novelId]: targetChapterIndex
        }
      };

      await transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: stateModule.activePartitionId,
        updates,
        isUISilent: isSilent
      });
    }

    if (isSilent) {
      return;
    }

    requestAnimationFrame(() => {
      if (stateModule.activeNovelPage === 'novel-content-page') {
        uiNovelContentModule.novelUI_renderVisibleChapters();
      } else if (stateModule.activeNovelPage === 'novel-summary-page') {
        uiNovelSummaryModule.novelSummaryUI_renderVisibleSummaries();
      } else if (stateModule.activeNovelPage === 'novel-toc-page') {
        uiNovelTocModule.novelUI_updateTocPage();
      }
    });
  },

  novelUI_toggleNovelInterface: () => {
    const isCurrentlyVisible = elementsModule.novelInterface.classList.contains('active');

    if (isCurrentlyVisible) {
      elementsModule.novelInterface.classList.remove('active');
      stateModule.isNovelInterfaceVisible = false;
    } else {
      if (elementsModule.settingsPanel.classList.contains('active')) {
        settingsPageManagerModule.toggleSettings();
      }
      elementsModule.novelInterface.classList.add('active');
      stateModule.isNovelInterfaceVisible = true;
      
      const pageToShow = stateModule.activeNovelPage || 'novel-summary-page';
      uiNovelMainModule.novelUI_showNovelSection(pageToShow);
    }
  },

  novelUI_closeAndClearAllPages: () => {
    const pages = [
      elementsModule.novelBookshelfPage,
      elementsModule.novelTocPage,
      elementsModule.novelSummaryPage,
      elementsModule.novelContentPage
    ];
    pages.forEach(page => {
      if (page) {
        page.classList.remove('active');
        const contentArea = page.querySelector('.novel-page-section > .novel-page-group > div, #novel-content-area, #novel-summary-content-area');
        if (contentArea) {
          contentArea.innerHTML = '';
        }
      }
    });
    stateModule.activeNovelPage = null;
  },

  novelUI_showNovelSection: (pageId) => {
    uiNovelMainModule.novelUI_closeAndClearAllPages();
    let pageElement = null;

    const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
    const novelId = activePartition?.currentNovelId;
    const currentChapterIndex = activePartition?.novelCurrentChapterIndices?.[novelId] ?? 0;

    if (pageId === 'novel-bookshelf-page') {
      pageElement = elementsModule.novelBookshelfPage;
      uiNovelBookshelfModule.novelUI_updateBookshelfPage();
    } else {
      if (!novelId) {
        uiNovelMainModule.novelUI_showNovelSection('novel-bookshelf-page');
        return;
      }

      if (pageId === 'novel-toc-page') {
        pageElement = elementsModule.novelTocPage;
        uiNovelTocModule.novelUI_updateTocPage();
        requestAnimationFrame(() => {
          uiNovelTocModule.novelTOCUI_updateActiveChapter(currentChapterIndex);
        });
      } else if (pageId === 'novel-summary-page') {
        pageElement = elementsModule.novelSummaryPage;
        uiNovelSummaryModule.novelSummaryUI_renderVisibleSummaries();
      } else if (pageId === 'novel-content-page') {
        pageElement = elementsModule.novelContentPage;
        uiNovelContentModule.novelUI_loadAndDisplayNovelContent(novelId);
      }
    }

    if (pageElement) {
      pageElement.classList.add('active');
      stateModule.activeNovelPage = pageId;
    } else {
      stateModule.activeNovelPage = null;
    }
  },

  novelUI_updateNovelButtonVisual: () => {
    if (elementsModule.novelButton) {
      const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
      const activeNovelIds = activePartition?.activeNovelIds || [];
      const hasActiveNovels = activeNovelIds.length > 0;
      elementsModule.novelButton.textContent = hasActiveNovels ? '📖' : '📕';
    }
  },
};