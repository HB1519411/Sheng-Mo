const uiChatImageViewerModule = {
  init: () => {
    const page = document.getElementById('image-viewer-page');
    page.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) uiChatImageViewerModule.hideImageViewer();
    });
  },
  showImageViewer: (imageSrc) => {
    if (!imageSrc) return;
    const page = document.getElementById('image-viewer-page');
    const content = document.getElementById('image-viewer-content');
    content.src = imageSrc;
    page.classList.add('active');
  },
  hideImageViewer: () => {
    const page = document.getElementById('image-viewer-page');
    const content = document.getElementById('image-viewer-content');
    page.classList.remove('active');
    content.src = '';
  }
};