const novelEventsModule = {
  init: () => {},

  findFocusVisibleItem: (container) => {
    const items = container.querySelectorAll('[data-toc-index]');
    if (items.length === 0) return null;

    const containerRect = container.getBoundingClientRect();
    const focusY = containerRect.top + containerRect.height * 0.2;

    let closestItem = null;
    let minDistance = Infinity;

    for (const item of items) {
      const itemRect = item.getBoundingClientRect();
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(focusY - itemCenterY);

      if (distance < minDistance) {
        minDistance = distance;
        closestItem = item;
      }
    }
    return closestItem;
  },


  setupCustomScrollListener: (element, viewType) => {
    if (!element) {
      return;
    }

    let scrollTimeout;
    element.addEventListener('scroll', () => {
      if (element.isScrollingProgrammatically) {
        return;
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const focusItem = novelEventsModule.findFocusVisibleItem(element);
        if (focusItem && focusItem.dataset.tocIndex) {
          const focusChapterIndex = parseInt(focusItem.dataset.tocIndex, 10);
          if (!isNaN(focusChapterIndex)) {
            uiNovelMainModule.syncAllViewsToChapter(focusChapterIndex, viewType, true);
          }
        }
      }, 250);
    }, {
      passive: true
    });
  },

  scrollToChapter: (container, chapterIndex, viewType) => {
    if (!container) return;
    let targetElement = container.querySelector(`[data-toc-index="${chapterIndex}"]`);

    if (targetElement) {
      container.isScrollingProgrammatically = true;
      targetElement.scrollIntoView({
        behavior: 'auto',
        block: 'start'
      });
      setTimeout(() => container.isScrollingProgrammatically = false, 300);
    }
  },

  updateActiveItem: (container, chapterIndex) => {
    if (!container) return;
    const activeSelector = container.id === 'novel-toc-list-container' ? '.current-chapter' : '.active';

    container.querySelectorAll(activeSelector).forEach(item => {
      item.classList.remove(activeSelector.substring(1));
    });

    if (chapterIndex !== -1) {
      const activeElement = container.querySelector(`[data-toc-index="${chapterIndex}"]`);
      if (activeElement) {
        activeElement.classList.add(activeSelector.substring(1));
        if (container.id === 'novel-toc-list-container') {
          container.isScrollingProgrammatically = true;
          activeElement.scrollIntoView({
            block: 'start',
            behavior: 'auto'
          });
          setTimeout(() => container.isScrollingProgrammatically = false, 300);
        }
      }
    }
  }
};