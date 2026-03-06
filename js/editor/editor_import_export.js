const editorImportExportModule = {
  isFolderSelected(folderPath, folderNode) {
    if (!folderNode.children) return false;
    let allSelected = true, hasFile = false;
    const check = (node, path) => {
      if (!node.children) return;
      node.children.forEach(c => {
        const cp = `${path}/${c.name}`;
        if (c.type === 'file') { hasFile = true; if (!editorMainModule.editorState.exportSelection.has(cp)) allSelected = false; }
        else check(c, cp);
      });
    };
    check(folderNode, folderPath);
    return hasFile && allSelected;
  },

  handleExportSelectionChange(path, isSelected, nodeData) {
    if (nodeData.type === 'folder') {
      const setSel = (n, p) => {
        if (!n.children) return;
        n.children.forEach(c => {
          const cp = `${p}/${c.name}`;
          if (c.type === 'file') isSelected ? editorMainModule.editorState.exportSelection.add(cp) : editorMainModule.editorState.exportSelection.delete(cp);
          else setSel(c, cp);
        });
      };
      setSel(nodeData, path);
    } else if (nodeData.type === 'file') {
      isSelected ? editorMainModule.editorState.exportSelection.add(path) : editorMainModule.editorState.exportSelection.delete(path);
    }
    editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
  },

  async loadExportSelection() {
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/get-export-selection`);
    if (res.ok) {
      const data = await res.json();
      editorMainModule.editorState.exportSelection = new Set(data.selected_files || []);
    } else editorMainModule.editorState.exportSelection = new Set();
    if (editorMainModule.editorState.fileTree) editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
  },

  async saveExportSelection() {
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/save-export-selection`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected_files: [...editorMainModule.editorState.exportSelection] })
    });
    if (res.ok) editorMainModule.logDebug("导出选区保存成功。", 'success');
  },

  parseImportedTextLogic(text) {
    if (!text.trim()) return 0;
    const regex = /--- START OF FILE (.*?) ---\s*([\s\S]*?)\s*--- END OF FILE \1 ---/g;
    let match, count = 0;

    while ((match = regex.exec(text)) !== null) {
      const path = match[1].trim().replace(/\\/g, '/');
      const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
      if (!editorActionsModule.ALLOWED_IMPORT_EXTENSIONS.includes(ext) && path !== 'modification_rules.txt') continue;
      
      let content = match[2].trim();
      content = content.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim();

      if (path === 'modification_rules.txt') {
        localStorage.setItem('editorModificationRulesFallback', content);
        count++; continue;
      }

      if (editorMainModule.editorState.editors[path]) {
        editorMainModule.editorState.editors[path].setValue(content);
      } else {
        const model = monaco.editor.createModel(content, editorMainModule.getLanguageForFile(path));
        editorMainModule.editorState.editors[path] = model;
        model.onDidChangeContent(() => {
          editorMainModule.editorState.unsavedChanges.add(path);
          editorFileOpsModule.updateUnsavedIndicator(path, true);
        });
        
        let curr = editorMainModule.editorState.fileTree.children;
        if (curr) {
          path.split('/').forEach((p, i, arr) => {
            let n = curr.find(x => x.name === p);
            if (!n) { n = { name: p, type: i === arr.length - 1 ? 'file' : 'folder', children: [] }; curr.push(n); }
            if (n.type === 'folder') curr = n.children;
          });
        }
      }
      editorMainModule.editorState.fileContents[path] = content;
      editorMainModule.editorState.unsavedChanges.add(path);
      editorFileOpsModule.updateUnsavedIndicator(path, true);
      count++;
    }
    if (editorMainModule.editorState.fileTree) editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
    return count;
  },

  async processAndSaveImportedText(text) {
    if (!text || !text.trim()) return;
    editorMainModule.editorState.isMultiFileOperationInProgress = true;
    editorActionsModule._setControlsDisabled(true);
    
    if (this.parseImportedTextLogic(text) > 0) {
      editorMainModule.logDebug(`文本已解析，正在尝试保存...`, 'info');
      await editorFileOpsModule.saveAllFiles();
      const ta = document.getElementById('manual-paste-import-textarea');
      if (ta.value === text) ta.value = '';
    }
    
    editorMainModule.editorState.isMultiFileOperationInProgress = false;
    editorActionsModule._setControlsDisabled(false);
  },

  async exportSelectedFiles() {
    if (!editorMainModule.editorState.exportSelection.size) return;
    if (editorMainModule.monacoInstance.getModel() && editorMainModule.editorState.currentFilePath && editorMainModule.editorState.exportSelection.has(editorMainModule.editorState.currentFilePath)) {
      editorMainModule.editorState.fileContents[editorMainModule.editorState.currentFilePath] = editorMainModule.monacoInstance.getModel().getValue();
    }

    const rules = await editorMainModule.fetchFileContent('modification_rules.txt') || localStorage.getItem('editorModificationRulesFallback') || "";
    const blocks = [`--- START OF FILE modification_rules.txt ---\n\`\`\`txt\n${rules.trim()}\n\`\`\`\n--- END OF FILE modification_rules.txt ---\n\n`];

    for (const p of [...editorMainModule.editorState.exportSelection].sort()) {
      let content = editorMainModule.editorState.fileContents[p];
      if (content === undefined) content = await editorMainModule.fetchFileContent(p);
      if (content !== null) {
        editorMainModule.editorState.fileContents[p] = content;
        blocks.push(`--- START OF FILE ${p} ---\n\`\`\`${editorMainModule.getLanguageForFile(p)}\n${content.trim()}\n\`\`\`\n--- END OF FILE ${p} ---\n\n`);
      }
    }

    const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([blocks.join('')])), download: `绳墨_${ts}.txt` });
    document.body.appendChild(a); a.click(); a.remove();
  },

  async confirmRestoreBackup(filePath) {
    if (confirm(`是否从 "${filePath}" 恢复？未保存更改将丢失！`)) {
      const content = await editorMainModule.fetchFileContent(filePath);
      if (content) await this.processAndSaveImportedText(content);
    }
  }
};