const novelEventsModule = {
  findFocusVisibleItem: (container) => {
    const items = container.querySelectorAll('[data-toc-index]');
    const focusY = container.getBoundingClientRect().top + container.getBoundingClientRect().height * 0.2;
    let closestItem = null;
    let minDistance = Infinity;
    for (const item of items) {
      const distance = Math.abs(focusY - (item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestItem = item;
      }
    }
    return closestItem;
  },
  setupCustomScrollListener: (element, viewType) => {
    let scrollTimeout;
    element.addEventListener('scroll', () => {
      if (element.isScrollingProgrammatically) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        uiNovelMainModule.syncAllViewsToChapter(parseInt(novelEventsModule.findFocusVisibleItem(element).dataset.tocIndex, 10), viewType, true);
      }, 250);
    }, { passive: true });
  },
  scrollToChapter: (container, chapterIndex) => {
    container.isScrollingProgrammatically = true;
    const targetElement = container.querySelector(`[data-toc-index="${chapterIndex}"]`);
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    setTimeout(() => container.isScrollingProgrammatically = false, 300);
  },
  updateActiveItem: (container, chapterIndex) => {
    const activeSelector = container.id === 'novel-toc-list-container' ? '.current-chapter' : '.active';
    container.querySelectorAll(activeSelector).forEach(item => item.classList.remove(activeSelector.substring(1)));
    if (chapterIndex !== -1) {
      const activeElement = container.querySelector(`[data-toc-index="${chapterIndex}"]`);
      if (activeElement) {
          activeElement.classList.add(activeSelector.substring(1));
          if (container.id === 'novel-toc-list-container') {
            container.isScrollingProgrammatically = true;
            activeElement.scrollIntoView({ block: 'start', behavior: 'auto' });
            setTimeout(() => container.isScrollingProgrammatically = false, 300);
          }
      }
    }
  }
};