const uiNovelSummaryModule = {
  init: () => {
    novelEventsModule.setupCustomScrollListener(elementsModule.novelSummaryContentArea, 'summary');
  },
  _renderSummaryItem: (tocEntry, tocIndex) => {
    const fragment = document.createDocumentFragment();
    const titleDiv = document.createElement('div');
    titleDiv.className = 'summary-chapter-title';
    titleDiv.textContent = tocEntry.title;
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
    const rangeData = uiNovelMainModule._getRenderRange('summary');
    const fragment = document.createDocumentFragment();
    for (let i = rangeData.renderRange.startChapterIndex; i <= rangeData.renderRange.endChapterIndex; i++) {
      if (novelData.toc[i].summary) fragment.appendChild(uiNovelSummaryModule._renderSummaryItem(novelData.toc[i], i));
    }
    container.innerHTML = '';
    container.appendChild(fragment);
    requestAnimationFrame(() => {
      novelEventsModule.scrollToChapter(container, rangeData.currentChapterIndex);
      novelEventsModule.updateActiveItem(container, rangeData.currentChapterIndex);
    });
  }
};