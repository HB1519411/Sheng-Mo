const editorFileOpsModule = {
  _getActivePath: () => {
    const el = document.querySelector('#file-tree-container .file-tree-item.active-file-in-tree');
    return el ? { path: el.dataset.path, type: el.dataset.type } : { path: editorMainModule.editorState.currentFilePath, type: 'file' };
  },

  async saveFileContent(filePath, content) {
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/save-editor-file-content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filepath: filePath, content })
    });
    if (!res.ok) editorMainModule.logDebug(`保存 ${filePath} 失败`, 'error');
    return res.ok;
  },

  async saveAllFiles() {
    if (editorMainModule.monacoInstance.getModel() && editorMainModule.editorState.currentFilePath) {
      editorMainModule.editorState.fileContents[editorMainModule.editorState.currentFilePath] = editorMainModule.monacoInstance.getModel().getValue();
    }
    
    if (editorMainModule.editorState.unsavedChanges.size === 0) return editorMainModule.logDebug("没有需要保存的文件。", 'info');

    editorMainModule.editorState.isMultiFileOperationInProgress = true;
    editorActionsModule._setControlsDisabled(true);
    
    const promises = Array.from(editorMainModule.editorState.unsavedChanges).map(async filePath => {
      if (editorMainModule.editorState.fileContents[filePath] !== undefined) {
        if (await this.saveFileContent(filePath, editorMainModule.editorState.fileContents[filePath])) {
          editorMainModule.editorState.unsavedChanges.delete(filePath);
          this.updateUnsavedIndicator(filePath, false);
        }
      }
    });

    await Promise.all(promises);
    editorMainModule.logDebug(`保存操作完成。`, 'success');
    
    editorMainModule.editorState.isMultiFileOperationInProgress = false;
    editorActionsModule._setControlsDisabled(false);
  },

  updateUnsavedIndicator(filePath, isUnsaved) {
    const nameSpan = document.querySelector(`.file-tree-item[data-path="${filePath}"] .file-name, .file-tree-item[data-path="${filePath}"] .folder-name`);
    if (nameSpan) {
      nameSpan.textContent = nameSpan.textContent.replace(/\*$/, '') + (isUnsaved ? '*' : '');
      nameSpan.style.color = isUnsaved ? 'orange' : '';
    }
    if (filePath === editorMainModule.editorState.currentFilePath && editorMainModule.currentFileNameSpan) {
      const base = editorMainModule.currentFileNameSpan.textContent.replace(/\*$/, '');
      editorMainModule.currentFileNameSpan.textContent = base + (isUnsaved ? '*' : '');
    }
  },

  async createNewFileOrFolder(isFolder) {
    const active = this._getActivePath();
    const baseDir = active.path ? (active.type === 'folder' ? `${active.path}/` : active.path.substring(0, active.path.lastIndexOf('/') + 1)) : '';
    
    const itemName = prompt(`输入新${isFolder ? '文件夹' : '文件'}名称:`);
    if (!itemName || !itemName.trim()) return;
    
    const newPath = baseDir + itemName.trim();
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/create-project-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filepath: newPath, is_directory: isFolder })
    });
    
    if (res.ok) {
      editorMainModule.logDebug(`${newPath} 创建成功。`, 'success');
      await editorMainModule.fetchFileTree();
      if (!isFolder) {
        editorMainModule.editorState.fileContents[newPath] = "";
        const model = monaco.editor.createModel("", editorMainModule.getLanguageForFile(newPath));
        editorMainModule.editorState.editors[newPath] = model;
        model.onDidChangeContent(() => {
          editorMainModule.editorState.unsavedChanges.add(newPath);
          this.updateUnsavedIndicator(newPath, true);
        });
        editorMainModule.switchToFile(newPath);
        editorMainModule.editorState.exportSelection.add(newPath);
        document.getElementById('file-list-modal').classList.remove('active');
        if (editorMainModule.editorState.fileTreeSearchQuery) editorSearchModule.performFileTreeSearch(true);
      }
    } else {
      editorMainModule.logDebug(`创建 ${newPath} 失败`, 'error');
    }
  },

  async renameSelectedItem() {
    const active = this._getActivePath();
    if (!active.path) return alert("请先选择项目。");
    
    const currName = active.path.split('/').pop();
    const newName = prompt(`输入 "${currName}" 的新名称:`, currName);
    if (!newName || !newName.trim() || newName.trim() === currName) return;
    
    const newPath = active.path.substring(0, active.path.lastIndexOf('/') + 1) + newName.trim();
    
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/rename-project-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_filepath: active.path, new_filepath: newPath })
    });
    
    if (res.ok) {
      editorMainModule.logDebug(`已重命名为 "${newPath}"`, 'success');
      if (editorMainModule.editorState.fileContents[active.path] !== undefined) {
        editorMainModule.editorState.fileContents[newPath] = editorMainModule.editorState.fileContents[active.path];
        delete editorMainModule.editorState.fileContents[active.path];
      }
      if (editorMainModule.editorState.editors[active.path]) {
        editorMainModule.editorState.editors[newPath] = editorMainModule.editorState.editors[active.path];
        delete editorMainModule.editorState.editors[active.path];
        monaco.editor.setModelLanguage(editorMainModule.editorState.editors[newPath], editorMainModule.getLanguageForFile(newPath));
      }
      if (editorMainModule.editorState.unsavedChanges.has(active.path)) {
        editorMainModule.editorState.unsavedChanges.delete(active.path);
        editorMainModule.editorState.unsavedChanges.add(newPath);
      }
      if (editorMainModule.editorState.exportSelection.has(active.path)) {
        editorMainModule.editorState.exportSelection.delete(active.path);
        editorMainModule.editorState.exportSelection.add(newPath);
      }
      
      const wasCurrent = editorMainModule.editorState.currentFilePath === active.path;
      await editorMainModule.fetchFileTree();
      if (wasCurrent) {
        editorMainModule.editorState.currentFilePath = newPath;
        editorMainModule.currentFileNameSpan.textContent = newPath;
        this.updateUnsavedIndicator(newPath, editorMainModule.editorState.unsavedChanges.has(newPath));
      }
      editorMainModule.updateActiveFileInTree(newPath);
    } else {
      editorMainModule.logDebug(`重命名失败`, 'error');
    }
  },

  async deleteSelectedItem() {
    let active = this._getActivePath();
    if (!active.path) {
      const checked = document.querySelectorAll('#file-tree-container input[type="checkbox"]:checked');
      if (checked.length === 1) active = { path: checked[0].parentElement.dataset.path, type: checked[0].parentElement.dataset.type };
      else return alert("未选择明确的项目进行删除。");
    }
    
    if (!confirm(`确定删除 "${active.path}" 吗？此操作不可恢复！`)) return;
    
    const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/delete-project-file`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filepath: active.path })
    });
    
    if (res.ok) {
      editorMainModule.logDebug(`删除 "${active.path}" 成功`, 'success');
      delete editorMainModule.editorState.fileContents[active.path];
      if (editorMainModule.editorState.editors[active.path]) {
        editorMainModule.editorState.editors[active.path].dispose();
        delete editorMainModule.editorState.editors[active.path];
      }
      editorMainModule.editorState.unsavedChanges.delete(active.path);
      editorMainModule.editorState.exportSelection.delete(active.path);
      if (editorMainModule.editorState.currentFilePath === active.path) {
        editorMainModule.editorState.currentFilePath = null;
        editorMainModule.currentFileNameSpan.textContent = "未选择文件";
        editorMainModule.monacoInstance.setModel(null);
      }
      await editorMainModule.fetchFileTree();
    } else {
      editorMainModule.logDebug(`删除失败`, 'error');
    }
  }
};