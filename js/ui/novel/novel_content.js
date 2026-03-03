const uiNovelContentModule = {
  init: () => {
    if (elementsModule.novelContentArea) {
      novelEventsModule.setupCustomScrollListener(elementsModule.novelContentArea, 'content');
    }
    eventBus.on('STATE_UPDATED_FROM_SERVER', () => {
      if (stateModule.isNovelInterfaceVisible && !stateModule.activeNovelPage) {
        const activePartition = stateModule.currentChatroomDetails?.partitions?.get(stateModule.activePartitionId);
        const novelIdToLoad = activePartition?.currentNovelId;
        uiNovelContentModule.novelUI_loadAndDisplayNovelContent(novelIdToLoad);
      }
    });

    if (elementsModule.novelSearchPrevBtn) {
      elementsModule.novelSearchPrevBtn.addEventListener('click', () => uiNovelContentModule._performGlobalSearch('prev'));
    }
    if (elementsModule.novelSearchNextBtn) {
      elementsModule.novelSearchNextBtn.addEventListener('click', () => uiNovelContentModule._performGlobalSearch('next'));
    }
    if (elementsModule.novelSearchInput) {
      elementsModule.novelSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          uiNovelContentModule._performGlobalSearch('next');
        }
      });
    }
  },

  _renderChapterItem: (tocEntry, tocIndex) => {
    const fragment = document.createDocumentFragment();
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'novel-chapter';
    chapterDiv.dataset.tocIndex = tocIndex;
    chapterDiv.textContent = tocEntry.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    fragment.appendChild(chapterDiv);
    return fragment;
  },

  novelUI_renderVisibleChapters: () => {
    const container = elementsModule.novelContentArea;
    const novelData = uiNovelMainModule._getCurrentNovelData();

    if (!container || !novelData || !novelData.toc || novelData.toc.length === 0) {
      if (container) container.innerHTML = '<p>小说数据或目录丢失。</p>';
      return;
    }

    const rangeData = uiNovelMainModule._getRenderRange('content');
    if (!rangeData) {
      if (container) container.innerHTML = '<p>无法计算渲染范围，可能是小说目录或阅读位置数据有误。</p>';
      return;
    }
    const {
      renderRange,
      currentChapterIndex
    } = rangeData;

    const {
      startChapterIndex,
      endChapterIndex
    } = renderRange;
    const fragment = document.createDocumentFragment();

    for (let i = startChapterIndex; i <= endChapterIndex; i++) {
      const tocEntry = novelData.toc[i];
      if (tocEntry) {
        fragment.appendChild(uiNovelContentModule._renderChapterItem(tocEntry, i));
      }
    }

    container.innerHTML = '';
    container.appendChild(fragment);

    requestAnimationFrame(() => {
      novelEventsModule.scrollToChapter(container, currentChapterIndex, 'content');
    });
  },

  novelUI_loadAndDisplayNovelContent: (novelId) => {
    const displayArea = elementsModule.novelContentArea;
    if (!displayArea || stateModule.isNovelLoading) return;

    if (!novelId) {
      displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">请在书目(📚)中选择小说</p>';
      return;
    }

    const chatroomDetails = stateModule.currentChatroomDetails;
    const activePartition = chatroomDetails?.partitions?.get(stateModule.activePartitionId);
    if (!chatroomDetails || !activePartition) {
      return;
    }
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData || !novelData.toc) {
      displayArea.innerHTML = '<p style="text-align: center; color: red;">无法加载小说数据</p>';
      return;
    }
    stateModule.isNovelLoading = true;
    displayArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">正在加载...</p>';
    
    let initialChapterIndex = activePartition.novelCurrentChapterIndices?.[novelId];
    if (initialChapterIndex === null || initialChapterIndex === undefined || isNaN(initialChapterIndex) || initialChapterIndex < 0 || initialChapterIndex >= novelData.toc.length) {
      initialChapterIndex = 0;
    }
    if (!activePartition.novelCurrentChapterIndices) activePartition.novelCurrentChapterIndices = {};
    activePartition.novelCurrentChapterIndices[novelId] = initialChapterIndex;

    uiNovelContentModule.novelUI_renderVisibleChapters();

    stateModule.isNovelLoading = false;
  },

  _performGlobalSearch: (direction) => {
    const query = elementsModule.novelSearchInput.value.toLowerCase();
    if (!query) return;

    const novelData = uiNovelMainModule._getCurrentNovelData();
    if (!novelData || !novelData.toc) return;

    if (query !== stateModule.novelSearchState.query) {
      stateModule.novelSearchState = { query, lastMatchChapterIndex: -1, lastMatchIndexInContent: -1 };
    }

    const toc = novelData.toc;
    const totalChapters = toc.length;
    
    const renderRange = uiNovelMainModule._getRenderRange('content');
    if (!renderRange) return;
    const startChapter = renderRange.currentChapterIndex;

    let found = false;
    let targetChapterIndex = -1;
    let matchPos = -1;

    for (let i = 1; i < totalChapters; i++) {
        let chapterIndex;
        if (direction === 'next') {
            chapterIndex = (startChapter + i) % totalChapters;
            const chapterContent = toc[chapterIndex].content.toLowerCase();
            matchPos = chapterContent.indexOf(query);
        } else {
            chapterIndex = (startChapter - i + totalChapters) % totalChapters;
            const chapterContent = toc[chapterIndex].content.toLowerCase();
            matchPos = chapterContent.lastIndexOf(query);
        }

        if (matchPos !== -1) {
            targetChapterIndex = chapterIndex;
            found = true;
            break;
        }
    }
    
    if (found) {
      stateModule.novelSearchState = { 
          query, 
          lastMatchChapterIndex: targetChapterIndex, 
          lastMatchIndexInContent: matchPos 
      };
      uiNovelMainModule.syncAllViewsToChapter(targetChapterIndex, 'content', false);
      _logAndDisplayError(`已跳转至含有关键词的章节: ${targetChapterIndex + 1}`, 'success');
    } else {
      _logAndDisplayError(`在其他章节中未找到 "${query}"`, 'info');
    }
  }
};