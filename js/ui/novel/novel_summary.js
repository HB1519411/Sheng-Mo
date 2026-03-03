const uiNovelSummaryModule = {
  init: () => {
    if (elementsModule.novelSummaryContentArea) {
      novelEventsModule.setupCustomScrollListener(elementsModule.novelSummaryContentArea, 'summary');
    }
  },

  _renderSummaryItem: (tocEntry, tocIndex) => {
    const fragment = document.createDocumentFragment();
    const titleDiv = document.createElement('div');
    titleDiv.className = 'summary-chapter-title';
    titleDiv.textContent = tocEntry.title || `章节 ${tocIndex + 1}`;
    titleDiv.dataset.tocIndex = tocIndex;
    fragment.appendChild(titleDiv);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'summary-chapter-content';
    contentDiv.textContent = tocEntry.summary;
    contentDiv.dataset.tocIndex = tocIndex;
    fragment.appendChild(contentDiv);
    return fragment;
  },

  novelSummaryUI_renderVisibleSummaries: () => {
    const container = elementsModule.novelSummaryContentArea;
    const novelData = uiNovelMainModule._getCurrentNovelData();
    if (!container || !novelData || !novelData.toc || novelData.toc.length === 0) {
      container.innerHTML = '<p>小说数据或目录丢失。</p>';
      return;
    }
    const rangeData = uiNovelMainModule._getRenderRange('summary');
    if (!rangeData) {
      container.innerHTML = '<p>无法计算渲染范围，可能是小说目录或阅读位置数据有误。</p>';
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
      if (tocEntry && tocEntry.summary) {
        fragment.appendChild(uiNovelSummaryModule._renderSummaryItem(tocEntry, i));
      }
    }
    container.innerHTML = '';
    container.appendChild(fragment);

    requestAnimationFrame(() => {
      novelEventsModule.scrollToChapter(container, currentChapterIndex, 'summary');
      novelEventsModule.updateActiveItem(container, currentChapterIndex);
    });
  },
};