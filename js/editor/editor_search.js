const editorSearchModule = {
  performEditorSearch() {
    if (!editorMainModule.monacoInstance || !editorMainModule.monacoInstance.getModel()) {
      editorMainModule.logDebug("编辑器或模型未加载，无法搜索。", 'warn');
      return;
    }
    const model = editorMainModule.monacoInstance.getModel();
    const searchInput = document.getElementById('editor-search-input');
    const newSearchQuery = searchInput.value;

    if (!newSearchQuery) {
      editorMainModule.logDebug("编辑器内搜索词为空。", 'info');
      editorMainModule.editorState.currentSearchQuery = null;
      editorMainModule.editorState.currentSearchMatches = [];
      editorMainModule.editorState.currentSearchMatchIndex = -1;
      editorMainModule.monacoInstance.deltaDecorations([], []);
      return;
    }

    if (newSearchQuery !== editorMainModule.editorState.currentSearchQuery || editorMainModule.editorState.currentSearchMatches.length === 0) {
      editorMainModule.editorState.currentSearchQuery = newSearchQuery;
      editorMainModule.editorState.currentSearchMatches = model.findMatches(newSearchQuery, false, false, false, null, true);
      editorMainModule.editorState.currentSearchMatchIndex = -1;

      if (editorMainModule.editorState.currentSearchMatches.length > 0) {
        editorMainModule.editorState.currentSearchMatchIndex = 0;
        const match = editorMainModule.editorState.currentSearchMatches[0];
        editorMainModule.monacoInstance.setSelection(match.range);
        editorMainModule.monacoInstance.revealRangeInCenter(match.range);
        editorMainModule.logDebug(`编辑器内找到 ${editorMainModule.editorState.currentSearchMatches.length} 个匹配项。当前为第 1 项。`, 'info');
      } else {
        editorMainModule.logDebug(`编辑器内未找到"${newSearchQuery}"的匹配项。`, 'info');
        editorMainModule.monacoInstance.deltaDecorations([], []);
      }
    } else {
      editorMainModule.editorState.currentSearchMatchIndex++;
      if (editorMainModule.editorState.currentSearchMatchIndex >= editorMainModule.editorState.currentSearchMatches.length) {
        editorMainModule.editorState.currentSearchMatchIndex = 0;
        editorMainModule.logDebug("编辑器内搜索已到达末尾，从头开始。", 'info');
      }
      if (editorMainModule.editorState.currentSearchMatches.length > 0) {
        const match = editorMainModule.editorState.currentSearchMatches[editorMainModule.editorState.currentSearchMatchIndex];
        editorMainModule.monacoInstance.setSelection(match.range);
        editorMainModule.monacoInstance.revealRangeInCenter(match.range);
        editorMainModule.logDebug(`编辑器内当前为第 ${editorMainModule.editorState.currentSearchMatchIndex + 1}/${editorMainModule.editorState.currentSearchMatches.length} 项。`, 'info');
      } else {
        editorMainModule.logDebug(`编辑器内未找到"${editorMainModule.editorState.currentSearchQuery}"的匹配项。`, 'info');
        editorMainModule.monacoInstance.deltaDecorations([], []);
      }
    }
  },

  performFileTreeSearch(preserveCurrentMatch = false) {
    const searchInput = document.getElementById('file-tree-search-input');
    const newQuery = searchInput.value.toLowerCase().trim();
    const fileTreeContainer = document.getElementById('file-tree-container');
    document.querySelectorAll('.file-tree-item.search-highlight').forEach(el => el.classList.remove('search-highlight'));

    if (!newQuery) {
      editorMainModule.editorState.fileTreeSearchQuery = null;
      editorMainModule.editorState.fileTreeSearchMatches = [];
      editorMainModule.editorState.fileTreeSearchMatchIndex = -1;
      editorMainModule.logDebug("文件树搜索词为空，清除高亮。", "info");
      return;
    }

    if (newQuery !== editorMainModule.editorState.fileTreeSearchQuery || !preserveCurrentMatch) {
      editorMainModule.editorState.fileTreeSearchQuery = newQuery;
      editorMainModule.editorState.fileTreeSearchMatches = [];
      editorMainModule.editorState.fileTreeSearchMatchIndex = -1;
      const allItems = fileTreeContainer.querySelectorAll('.file-tree-item');
      allItems.forEach(item => {
        const itemName = item.dataset.path.toLowerCase();
        if (itemName.includes(newQuery)) {
          editorMainModule.editorState.fileTreeSearchMatches.push(item);
        }
      });
      if (editorMainModule.editorState.fileTreeSearchMatches.length > 0) {
        editorMainModule.editorState.fileTreeSearchMatchIndex = 0;
      } else {
        editorMainModule.logDebug(`文件列表中未找到"${newQuery}"。`, "info");
        return;
      }
    } else {
      if (editorMainModule.editorState.fileTreeSearchMatches.length === 0) {
        editorMainModule.logDebug(`之前未在文件列表中找到"${editorMainModule.editorState.fileTreeSearchQuery}"，无法查找下一个。`, "info");
        return;
      }
      editorMainModule.editorState.fileTreeSearchMatchIndex++;
      if (editorMainModule.editorState.fileTreeSearchMatchIndex >= editorMainModule.editorState.fileTreeSearchMatches.length) {
        editorMainModule.editorState.fileTreeSearchMatchIndex = 0;
        editorMainModule.logDebug("文件列表搜索已到达末尾，从头开始。", "info");
      }
    }

    if (editorMainModule.editorState.fileTreeSearchMatches.length > 0 && editorMainModule.editorState.fileTreeSearchMatchIndex !== -1) {
      const currentMatchElement = editorMainModule.editorState.fileTreeSearchMatches[editorMainModule.editorState.fileTreeSearchMatchIndex];
      currentMatchElement.classList.add('search-highlight');
      let parent = currentMatchElement.closest('li');
      while (parent) {
        const parentFolderLi = parent.parentElement?.closest('li');
        if (parentFolderLi) {
          const subUl = parentFolderLi.querySelector('ul');
          if (subUl) subUl.style.display = 'block';
        }
        parent = parentFolderLi;
      }
      currentMatchElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
      editorMainModule.logDebug(`文件列表搜索: 高亮第 ${editorMainModule.editorState.fileTreeSearchMatchIndex + 1}/${editorMainModule.editorState.fileTreeSearchMatches.length} 项: ${currentMatchElement.dataset.path}`, "info");
    }
  }
};