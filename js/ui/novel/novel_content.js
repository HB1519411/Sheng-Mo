const uiNovelContentModule = {
  init: () => {
    novelEventsModule.setupCustomScrollListener(elementsModule.novelContentArea, 'content');
    eventBus.on('STATE_UPDATED_FROM_SERVER', () => {
      if (stateModule.isNovelInterfaceVisible && !stateModule.activeNovelPage) {
        uiNovelContentModule.novelUI_loadAndDisplayNovelContent(stateModule.currentChatroomDetails.partitions.get(stateModule.activePartitionId).currentNovelId);
      }
    });
    elementsModule.novelSearchPrevBtn.addEventListener('click', () => uiNovelContentModule._performGlobalSearch('prev'));
    elementsModule.novelSearchNextBtn.addEventListener('click', () => uiNovelContentModule._performGlobalSearch('next'));
    elementsModule.novelSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') uiNovelContentModule._performGlobalSearch('next');
    });
  },
  _renderChapterItem: (tocEntry, tocIndex) => {
    const fragment = document.createDocumentFragment();
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'novel-chapter';
    chapterDiv.dataset.tocIndex = tocIndex;
    chapterDiv.textContent = tocEntry.content;
    fragment.appendChild(chapterDiv);
    return fragment;
  },
  novelUI_renderVisibleChapters: () => {
    const container = elementsModule.novelContentArea;
    const novelData = uiNovelMainModule._getCurrentNovelData();
    const rangeData = uiNovelMainModule._getRenderRange('content');
    const fragment = document.createDocumentFragment();
    for (let i = rangeData.renderRange.startChapterIndex; i <= rangeData.renderRange.endChapterIndex; i++) {
      fragment.appendChild(uiNovelContentModule._renderChapterItem(novelData.toc[i], i));
    }
    container.innerHTML = '';
    container.appendChild(fragment);
    requestAnimationFrame(() => novelEventsModule.scrollToChapter(container, rangeData.currentChapterIndex));
  },
  novelUI_loadAndDisplayNovelContent: (novelId) => {
    if (stateModule.isNovelLoading) return;
    stateModule.isNovelLoading = true;
    elementsModule.novelContentArea.innerHTML = '<p style="text-align: center; padding-top: 20px;">正在加载...</p>';
    uiNovelContentModule.novelUI_renderVisibleChapters();
    stateModule.isNovelLoading = false;
  },
  _performGlobalSearch: (direction) => {
    const query = elementsModule.novelSearchInput.value.toLowerCase();
    if (!query) return;
    const novelData = uiNovelMainModule._getCurrentNovelData();
    if (query !== stateModule.novelSearchState.query) {
      stateModule.novelSearchState = { query, lastMatchChapterIndex: -1, lastMatchIndexInContent: -1 };
    }
    const totalChapters = novelData.toc.length;
    const startChapter = uiNovelMainModule._getRenderRange('content').currentChapterIndex;
    let targetChapterIndex = -1;
    let matchPos = -1;
    for (let i = 1; i < totalChapters; i++) {
      const chapterIndex = direction === 'next' ? (startChapter + i) % totalChapters : (startChapter - i + totalChapters) % totalChapters;
      const chapterContent = novelData.toc[chapterIndex].content.toLowerCase();
      matchPos = direction === 'next' ? chapterContent.indexOf(query) : chapterContent.lastIndexOf(query);
      if (matchPos !== -1) {
        targetChapterIndex = chapterIndex;
        break;
      }
    }
    if (targetChapterIndex !== -1) {
      stateModule.novelSearchState = { query, lastMatchChapterIndex: targetChapterIndex, lastMatchIndexInContent: matchPos };
      uiNovelMainModule.syncAllViewsToChapter(targetChapterIndex, 'content', false);
      _logAndDisplayError(`已跳转至含有关键词的章节: ${targetChapterIndex + 1}`, 'success');
    } else {
      _logAndDisplayError(`在其他章节中未找到 "${query}"`, 'info');
    }
  }
};