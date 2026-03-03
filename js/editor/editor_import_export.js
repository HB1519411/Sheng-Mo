const editorImportExportModule = {
  isFolderSelected(folderPath, folderNode) {
    if (!folderNode || !folderNode.children || folderNode.children.length === 0) return false;
    let allChildrenFilesSelected = true;
    let hasAnyFile = false;

    function checkChildren(node, basePath) {
      if (!node.children) return;
      node.children.forEach(child => {
        const childPath = `${basePath}/${child.name}`;
        if (child.type === 'file') {
          hasAnyFile = true;
          if (!editorMainModule.editorState.exportSelection.has(childPath)) {
            allChildrenFilesSelected = false;
          }
        } else if (child.type === 'folder') {
          checkChildren(child, childPath);
        }
      });
    }
    checkChildren(folderNode, folderPath);
    return hasAnyFile && allChildrenFilesSelected;
  },

  handleExportSelectionChange(path, isSelected, nodeData) {
    if (nodeData && nodeData.type === 'folder') {
      this.setFolderSelection(nodeData, path, isSelected);
    } else if (nodeData && nodeData.type === 'file') {
      if (isSelected) {
        editorMainModule.editorState.exportSelection.add(path);
      } else {
        editorMainModule.editorState.exportSelection.delete(path);
      }
    }
    if (editorMainModule.editorState.fileTree) {
      editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
      if (editorMainModule.editorState.fileTreeSearchQuery && typeof editorSearchModule !== 'undefined') editorSearchModule.performFileTreeSearch(true);
    }
  },

  setFolderSelection(folderNode, folderPath, isSelected) {
    if (!folderNode.children) return;
    folderNode.children.forEach(child => {
      const childPath = `${folderPath}/${child.name}`;
      if (child.type === 'file') {
        if (isSelected) {
          editorMainModule.editorState.exportSelection.add(childPath);
        } else {
          editorMainModule.editorState.exportSelection.delete(childPath);
        }
      } else if (child.type === 'folder') {
        this.setFolderSelection(child, childPath, isSelected);
      }
    });
  },

  async loadExportSelection() {
    editorMainModule.logDebug("正在加载导出选区...", 'info');
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/get-export-selection`);
      if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);
      const data = await response.json();
      if (data && Array.isArray(data.selected_files)) {
        editorMainModule.editorState.exportSelection = new Set(data.selected_files);
        editorMainModule.logDebug("导出选区加载成功。", 'success');
      } else {
        editorMainModule.editorState.exportSelection = new Set();
        editorMainModule.logDebug("未找到导出选区或格式无效，已初始化为空选区。", 'warn');
      }
    } catch (e) {
      editorMainModule.logDebug(`加载导出选区失败: ${e.message}`, 'error');
      editorMainModule.editorState.exportSelection = new Set();
    }
    if (editorMainModule.editorState.fileTree) {
      editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
      if (editorMainModule.editorState.fileTreeSearchQuery && typeof editorSearchModule !== 'undefined') editorSearchModule.performFileTreeSearch(true);
    }
  },

  async saveExportSelection() {
    editorMainModule.logDebug("正在保存导出选区...", 'info');
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/save-export-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selected_files: Array.from(editorMainModule.editorState.exportSelection)
        })
      });
      if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);
      editorMainModule.logDebug("导出选区保存成功。", 'success');
    } catch (e) {
      editorMainModule.logDebug(`保存导出选区失败: ${e.message}`, 'error');
    }
  },

  parseImportedTextLogic(text) {
    if (!text.trim()) {
      editorMainModule.logDebug("导入的文本内容为空。", 'warn');
      return 0;
    }
    const fileBlockRegex = /--- START OF FILE (.*?) ---\s*([\s\S]*?)\s*--- END OF FILE \1 ---/g;
    let match;
    let filesImportedCount = 0;
    while ((match = fileBlockRegex.exec(text)) !== null) {
      const filePathDirty = match[1].trim();
      let contentBlock = match[2].trim();
      const filePath = filePathDirty.replace(/\\/g, '/');
      const fileExtension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      if (typeof editorActionsModule !== 'undefined' && !editorActionsModule.ALLOWED_IMPORT_EXTENSIONS.includes(fileExtension) && filePath !== 'modification_rules.txt') {
        editorMainModule.logDebug(`因扩展名不支持，已跳过导入文件 ${filePath}`, 'info');
        continue;
      }
      const codeFenceStartMatch = contentBlock.match(/^```[\w-]*\n?/);
      const codeFenceEndMatch = contentBlock.match(/\n?```$/);
      let finalContent = contentBlock;
      if (codeFenceStartMatch) {
        finalContent = finalContent.substring(codeFenceStartMatch[0].length);
      }
      if (codeFenceEndMatch) {
        finalContent = finalContent.substring(0, finalContent.length - codeFenceEndMatch[0].length);
      }
      finalContent = finalContent.trim();
      if (filePath === 'modification_rules.txt') {
        localStorage.setItem('editorModificationRulesFallback', finalContent);
        editorMainModule.logDebug(`modification_rules.txt 已导入并缓存。`, 'success');
        filesImportedCount++;
        continue;
      }
      if (editorMainModule.editorState.editors[filePath]) {
        editorMainModule.editorState.editors[filePath].setValue(finalContent);
        editorMainModule.editorState.fileContents[filePath] = finalContent;
        editorMainModule.editorState.unsavedChanges.add(filePath);
        if (typeof editorFileOpsModule !== 'undefined') editorFileOpsModule.updateUnsavedIndicator(filePath, true);
        filesImportedCount++;
      } else {
        const language = editorMainModule.getLanguageForFile(filePath);
        const model = monaco.editor.createModel(finalContent, language);
        editorMainModule.editorState.editors[filePath] = model;
        editorMainModule.editorState.fileContents[filePath] = finalContent;
        editorMainModule.editorState.unsavedChanges.add(filePath);
        if (typeof editorFileOpsModule !== 'undefined') editorFileOpsModule.updateUnsavedIndicator(filePath, true);
        model.onDidChangeContent(() => {
          editorMainModule.editorState.unsavedChanges.add(filePath);
          if (typeof editorFileOpsModule !== 'undefined') editorFileOpsModule.updateUnsavedIndicator(filePath, true);
        });
        filesImportedCount++;
        if (!editorMainModule.editorState.fileTree) editorMainModule.editorState.fileTree = {
          name: "/",
          type: "folder",
          children: []
        };
        let currentLevel = editorMainModule.editorState.fileTree.children;
        const pathParts = filePath.split('/');
        let currentPathAccumulator = '';
        pathParts.forEach((part, index) => {
          currentPathAccumulator += (currentPathAccumulator ? '/' : '') + part;
          let node = currentLevel.find(n => n.name === part);
          if (!node) {
            node = {
              name: part,
              type: (index === pathParts.length - 1) ? 'file' : 'folder',
              children: []
            };
            currentLevel.push(node);
            currentLevel.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            });
          }
          if (node.type === 'folder') {
            if (!node.children) node.children = [];
            currentLevel = node.children;
          }
        });
      }
    }
    if (editorMainModule.editorState.fileTree) {
      editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
      if (editorMainModule.editorState.fileTreeSearchQuery && typeof editorSearchModule !== 'undefined') editorSearchModule.performFileTreeSearch(true);
    }
    return filesImportedCount;
  },

  async processAndSaveImportedText(text) {
    if (!text || !text.trim()) {
      editorMainModule.logDebug("导入文本为空，操作已跳过。", "warn");
      return;
    }
    editorMainModule.logDebug("正在处理并保存导入的文本...", 'info');
    editorMainModule.editorState.isMultiFileOperationInProgress = true;
    if (typeof editorActionsModule !== 'undefined' && editorActionsModule._setControlsDisabled) editorActionsModule._setControlsDisabled(true);
    try {
      const filesProcessedCount = this.parseImportedTextLogic(text);
      if (filesProcessedCount > 0) {
        editorMainModule.logDebug(`已从文本加载 ${filesProcessedCount} 个文件，正在尝试保存...`, 'info');
        if (typeof editorFileOpsModule !== 'undefined') await editorFileOpsModule.saveAllFiles();
        editorMainModule.logDebug(`文本导入操作完成。`, "success");
        const manualPasteTextarea = document.getElementById('manual-paste-import-textarea');
        if (manualPasteTextarea && manualPasteTextarea.value === text) {
          manualPasteTextarea.value = '';
        }
      } else {
        editorMainModule.logDebug("未从文本中解析出有效文件，未执行保存。", "warn");
      }
    } catch (e) {
      editorMainModule.logDebug(`处理导入文本时发生错误: ${e.message}`, 'error');
    } finally {
      editorMainModule.editorState.isMultiFileOperationInProgress = false;
      if (typeof editorActionsModule !== 'undefined' && editorActionsModule._setControlsDisabled) editorActionsModule._setControlsDisabled(false);
    }
  },

  async exportSelectedFiles() {
    if (editorMainModule.editorState.exportSelection.size === 0) {
      editorMainModule.logDebug("未选择任何文件用于导出。", "warn");
      return;
    }
    editorMainModule.logDebug(`正在导出选定的文件...`, 'info');
    if (editorMainModule.monacoInstance && editorMainModule.monacoInstance.getModel() && editorMainModule.editorState.currentFilePath && editorMainModule.editorState.exportSelection.has(editorMainModule.editorState.currentFilePath)) {
      editorMainModule.editorState.fileContents[editorMainModule.editorState.currentFilePath] = editorMainModule.monacoInstance.getModel().getValue();
    }
    let modificationRulesContent = "";
    try {
      modificationRulesContent = await editorMainModule.fetchFileContent('modification_rules.txt');
      if (modificationRulesContent === null) modificationRulesContent = localStorage.getItem('editorModificationRulesFallback') || "";
    } catch {
      modificationRulesContent = localStorage.getItem('editorModificationRulesFallback') || "";
    }
    const allFileBlocks = [];
    allFileBlocks.push({
      path: 'modification_rules.txt',
      content: `--- START OF FILE modification_rules.txt ---\n\`\`\`txt\n${modificationRulesContent.trim()}\n\`\`\`\n--- END OF FILE modification_rules.txt ---\n\n`
    });
    for (const filePath of editorMainModule.editorState.exportSelection) {
      let contentToExport = editorMainModule.editorState.fileContents[filePath];
      if (contentToExport === undefined) {
        contentToExport = await editorMainModule.fetchFileContent(filePath);
        if (contentToExport === null) {
          editorMainModule.logDebug(`获取文件 ${filePath} 内容用于导出失败，已跳过。`, 'error');
          continue;
        }
        editorMainModule.editorState.fileContents[filePath] = contentToExport;
      }
      const language = editorMainModule.getLanguageForFile(filePath);
      allFileBlocks.push({
        path: filePath,
        content: `--- START OF FILE ${filePath} ---\n\`\`\`${language}\n${contentToExport.trim()}\n\`\`\`\n--- END OF FILE ${filePath} ---\n\n`
      });
    }
    allFileBlocks.sort((a, b) => a.path.localeCompare(b.path));
    
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${YYYY}${MM}${DD}_${hh}${mm}${ss}`;

    try {
      if (allFileBlocks.length > 0) {
        const combinedContent = allFileBlocks.map(block => block.content).join('');
        const blob = new Blob([combinedContent], {
          type: 'text/plain;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `绳墨_${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        editorMainModule.logDebug("文件导出成功。", 'success');
      } else {
        editorMainModule.logDebug("无内容可导出。", 'warn');
      }
    } catch (e) {
      editorMainModule.logDebug(`导出文件失败: ${e.message}`, 'error');
    }
  },

  async confirmRestoreBackup(filePath) {
    if (!confirm(`是否要从备份文件 "${filePath}" 回退（恢复）版本？\n此操作将覆盖当前项目中对应的文件，且未保存的更改将丢失！`)) {
      return;
    }
    editorMainModule.logDebug(`正在准备从 ${filePath} 恢复版本...`, 'info');
    const content = await editorMainModule.fetchFileContent(filePath);
    if (content) {
      await this.processAndSaveImportedText(content);
      editorMainModule.logDebug(`从 ${filePath} 回退版本完成。`, 'success');
    } else {
      editorMainModule.logDebug(`无法读取备份文件 ${filePath}。`, 'error');
    }
  }
};