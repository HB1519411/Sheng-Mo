const editorSearchModule = {
  performEditorSearch() {
    const model = editorMainModule.monacoInstance.getModel();
    if (!model) return;
    
    const query = document.getElementById('editor-search-input').value;
    const st = editorMainModule.editorState;

    if (!query) {
      st.currentSearchQuery = null; st.currentSearchMatches = []; st.currentSearchMatchIndex = -1;
      editorMainModule.monacoInstance.deltaDecorations([], []);
      return;
    }

    if (query !== st.currentSearchQuery || !st.currentSearchMatches.length) {
      st.currentSearchQuery = query;
      st.currentSearchMatches = model.findMatches(query, false, false, false, null, true);
      st.currentSearchMatchIndex = st.currentSearchMatches.length ? 0 : -1;
    } else {
      st.currentSearchMatchIndex = (st.currentSearchMatchIndex + 1) % st.currentSearchMatches.length;
    }

    if (st.currentSearchMatchIndex > -1) {
      const range = st.currentSearchMatches[st.currentSearchMatchIndex].range;
      editorMainModule.monacoInstance.setSelection(range);
      editorMainModule.monacoInstance.revealRangeInCenter(range);
    } else {
      editorMainModule.monacoInstance.deltaDecorations([], []);
    }
  },

  performFileTreeSearch(preserveCurrentMatch = false) {
    const query = document.getElementById('file-tree-search-input').value.toLowerCase().trim();
    document.querySelectorAll('.file-tree-item.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    const st = editorMainModule.editorState;

    if (!query) {
      st.fileTreeSearchQuery = null; st.fileTreeSearchMatches = []; st.fileTreeSearchMatchIndex = -1;
      return;
    }

    if (query !== st.fileTreeSearchQuery || !preserveCurrentMatch) {
      st.fileTreeSearchQuery = query;
      st.fileTreeSearchMatches = Array.from(document.querySelectorAll('#file-tree-container .file-tree-item')).filter(el => el.dataset.path.toLowerCase().includes(query));
      st.fileTreeSearchMatchIndex = st.fileTreeSearchMatches.length ? 0 : -1;
    } else if (st.fileTreeSearchMatches.length) {
      st.fileTreeSearchMatchIndex = (st.fileTreeSearchMatchIndex + 1) % st.fileTreeSearchMatches.length;
    }

    if (st.fileTreeSearchMatchIndex > -1) {
      const match = st.fileTreeSearchMatches[st.fileTreeSearchMatchIndex];
      match.classList.add('search-highlight');
      
      let parent = match.closest('li');
      while (parent) {
        const subUl = parent.parentElement.closest('li').querySelector(':scope > ul');
        if (subUl) subUl.style.display = 'block';
        parent = parent.parentElement.closest('li');
      }
      match.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};