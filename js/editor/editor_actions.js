const editorActionsModule = {
  ALLOWED_IMPORT_EXTENSIONS: ['.py', '.js', '.html', '.css', '.vue', '.ts', '.json', '.txt', '.bat', '.sh', '.md', '.yml'],

  init: () => {
    const bind = (id, evt, cb) => document.getElementById(id).addEventListener(evt, cb);
    
    bind('btn-open-file-modal', 'click', () => {
      document.getElementById('file-list-modal').classList.add('active');
      if (editorMainModule.editorState.fileTree) {
        editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
        if (editorMainModule.editorState.fileTreeSearchQuery) editorSearchModule.performFileTreeSearch(true);
      } else editorMainModule.fetchFileTree();
    });
    bind('btn-close-file-modal', 'click', () => document.getElementById('file-list-modal').classList.remove('active'));
    bind('btn-refresh-file-tree', 'click', () => editorMainModule.fetchFileTree());
    bind('btn-save-export-selection', 'click', () => editorImportExportModule.saveExportSelection());
    bind('btn-modal-create-file', 'click', () => editorFileOpsModule.createNewFileOrFolder(false));
    bind('btn-modal-create-folder', 'click', () => editorFileOpsModule.createNewFileOrFolder(true));
    bind('btn-modal-rename-item', 'click', () => editorFileOpsModule.renameSelectedItem());
    bind('btn-modal-delete-item', 'click', () => editorFileOpsModule.deleteSelectedItem());
    bind('btn-save-all', 'click', () => editorFileOpsModule.saveAllFiles());
    bind('btn-import-text-modal', 'click', () => document.getElementById('file-importer-input').click());
    bind('file-importer-input', 'change', async e => {
      const files = e.target.files;
      if (!files.length) return;
      editorMainModule.logDebug(`正在导入 ${files.length} 个文件...`, 'info');
      let text = "";
      for (const f of files) text += await f.text() + "\n\n";
      e.target.value = null;
      editorImportExportModule.processAndSaveImportedText(text.trim());
    });
    bind('btn-parse-save-pasted-text', 'click', () => editorImportExportModule.processAndSaveImportedText(document.getElementById('manual-paste-import-textarea').value));
    bind('btn-export-selected', 'click', () => editorImportExportModule.exportSelectedFiles());
    bind('editor-search-button', 'click', () => editorSearchModule.performEditorSearch());
    bind('editor-search-input', 'keydown', e => e.key === 'Enter' && editorSearchModule.performEditorSearch());
    bind('file-tree-search-button', 'click', () => editorSearchModule.performFileTreeSearch(false));
    bind('file-tree-search-input', 'keydown', e => e.key === 'Enter' && editorSearchModule.performFileTreeSearch(false));
    bind('file-tree-search-input', 'input', e => !e.target.value.trim() && editorSearchModule.performFileTreeSearch(false));
    
    window.addEventListener('click', e => { if (e.target.id === 'file-list-modal') e.target.classList.remove('active'); });
  },

  _setControlsDisabled: (disabled) => {
    ['btn-open-file-modal', 'btn-save-all', 'btn-import-text-modal', 'btn-export-selected', 'btn-parse-save-pasted-text', 'manual-paste-import-textarea'].forEach(id => {
      document.getElementById(id).disabled = disabled;
    });
  }
};