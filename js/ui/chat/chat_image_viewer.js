const uiChatImageViewerModule = {
  init: () => {
    if (elementsModule.imageViewerPage) {
      elementsModule.imageViewerPage.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) uiChatImageViewerModule.hideImageViewer();
      });
    }
  },
  showImageViewer: (imageSrc) => {
    if (!imageSrc || !elementsModule.imageViewerPage || !elementsModule.imageViewerContent) {
      return;
    }
    elementsModule.imageViewerContent.src = imageSrc;
    elementsModule.imageViewerPage.classList.add('active');
  },

  hideImageViewer: () => {
    if (!elementsModule.imageViewerPage || !elementsModule.imageViewerContent) {
      return;
    }
    elementsModule.imageViewerPage.classList.remove('active');
    elementsModule.imageViewerContent.src = '';
  }
};