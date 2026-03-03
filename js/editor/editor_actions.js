const editorActionsModule = {
  ALLOWED_IMPORT_EXTENSIONS: ['.py', '.js', '.html', '.css', '.vue', '.ts', '.json', '.txt', '.bat', '.sh', '.md', '.yml'],

  init: () => {
    document.getElementById('btn-open-file-modal').addEventListener('click', () => {
      document.getElementById('file-list-modal').classList.add('active');
      if (editorMainModule.editorState.fileTree) {
        editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
        if (editorMainModule.editorState.fileTreeSearchQuery) editorSearchModule.performFileTreeSearch(true);
      } else {
        editorMainModule.fetchFileTree();
      }
    });
    document.getElementById('btn-close-file-modal').addEventListener('click', () => {
      document.getElementById('file-list-modal').classList.remove('active');
    });
    document.getElementById('btn-refresh-file-tree').addEventListener('click', () => editorMainModule.fetchFileTree());
    document.getElementById('btn-save-export-selection').addEventListener('click', () => editorImportExportModule.saveExportSelection());
    document.getElementById('btn-modal-create-file').addEventListener('click', () => editorFileOpsModule.createNewFileOrFolder(false));
    document.getElementById('btn-modal-create-folder').addEventListener('click', () => editorFileOpsModule.createNewFileOrFolder(true));
    document.getElementById('btn-modal-rename-item').addEventListener('click', () => editorFileOpsModule.renameSelectedItem());
    document.getElementById('btn-modal-delete-item').addEventListener('click', () => editorFileOpsModule.deleteSelectedItem());
    document.getElementById('btn-save-all').addEventListener('click', () => editorFileOpsModule.saveAllFiles());
    document.getElementById('btn-import-text-modal').addEventListener('click', () => {
      document.getElementById('file-importer-input').click();
    });
    document.getElementById('file-importer-input').addEventListener('change', async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      editorMainModule.logDebug(`正在从 ${files.length} 个文件导入文本...`, 'info');
      let combinedText = "";
      for (const file of files) {
        try {
          const text = await file.text();
          combinedText += text + "\n\n";
        } catch (e) {
          editorMainModule.logDebug(`读取文件 ${file.name} 失败: ${e.message}`, 'error');
        }
      }
      event.target.value = null;
      await editorImportExportModule.processAndSaveImportedText(combinedText.trim());
    });
    document.getElementById('btn-parse-save-pasted-text').addEventListener('click', async () => {
      const textToParse = document.getElementById('manual-paste-import-textarea').value;
      await editorImportExportModule.processAndSaveImportedText(textToParse);
    });
    document.getElementById('btn-export-selected').addEventListener('click', () => editorImportExportModule.exportSelectedFiles());
    document.getElementById('editor-search-button').addEventListener('click', () => editorSearchModule.performEditorSearch());
    document.getElementById('editor-search-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        editorSearchModule.performEditorSearch();
      }
    });
    document.getElementById('file-tree-search-button').addEventListener('click', () => editorSearchModule.performFileTreeSearch(false));
    document.getElementById('file-tree-search-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        editorSearchModule.performFileTreeSearch(false);
      }
    });
    document.getElementById('file-tree-search-input').addEventListener('input', () => {
      if (!document.getElementById('file-tree-search-input').value.trim()) {
        editorSearchModule.performFileTreeSearch(false);
      }
    });
    window.addEventListener('click', (event) => {
      if (event.target === document.getElementById('file-list-modal')) document.getElementById('file-list-modal').classList.remove('active');
    });
  },

  _setControlsDisabled(disabled) {
    const buttonIds = [
      'btn-open-file-modal', 'btn-save-all',
      'btn-import-text-modal', 'btn-export-selected',
      'btn-parse-save-pasted-text'
    ];
    const textareaIds = ['manual-paste-import-textarea'];

    buttonIds.forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
    });

    textareaIds.forEach(id => {
      const textarea = document.getElementById(id);
      if (textarea) textarea.disabled = disabled;
    });
  },
  
  updateUnsavedIndicator: (filePath, isUnsaved) => editorFileOpsModule.updateUnsavedIndicator(filePath, isUnsaved),
  isFolderSelected: (folderPath, folderNode) => editorImportExportModule.isFolderSelected(folderPath, folderNode),
  handleExportSelectionChange: (path, isSelected, nodeData) => editorImportExportModule.handleExportSelectionChange(path, isSelected, nodeData),
  loadExportSelection: () => editorImportExportModule.loadExportSelection(),
  saveExportSelection: () => editorImportExportModule.saveExportSelection(),
  performFileTreeSearch: (preserve) => editorSearchModule.performFileTreeSearch(preserve),
  confirmRestoreBackup: (filePath) => editorImportExportModule.confirmRestoreBackup(filePath),
  processAndSaveImportedText: (text) => editorImportExportModule.processAndSaveImportedText(text)
};