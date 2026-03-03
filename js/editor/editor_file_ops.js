const editorFileOpsModule = {
  async saveFileContent(filePath, content) {
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/save-editor-file-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filepath: filePath,
          content: content
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "未知错误"
        }));
        editorMainModule.logDebug(`保存文件 ${filePath} 失败: ${errorData.error || response.statusText}`, 'error');
        return false;
      }
      return true;
    } catch (error) {
      editorMainModule.logDebug(`保存文件 ${filePath} 时发生错误: ${error.message}`, 'error');
      return false;
    }
  },

  async saveAllFiles() {
    if (editorMainModule.monacoInstance && editorMainModule.monacoInstance.getModel() && editorMainModule.editorState.currentFilePath) {
      editorMainModule.editorState.fileContents[editorMainModule.editorState.currentFilePath] = editorMainModule.monacoInstance.getModel().getValue();
    }
    editorMainModule.logDebug("正在保存所有已修改的文件...", 'info');
    editorMainModule.editorState.isMultiFileOperationInProgress = true;
    if(typeof editorActionsModule !== 'undefined' && editorActionsModule._setControlsDisabled) {
        editorActionsModule._setControlsDisabled(true);
    }
    const promises = [];
    let successCount = 0;
    let failureCount = 0;
    const unsavedFilesCount = editorMainModule.editorState.unsavedChanges.size;
    if (unsavedFilesCount === 0) {
      editorMainModule.logDebug("没有需要保存的文件。", 'info');
      editorMainModule.editorState.isMultiFileOperationInProgress = false;
      if(typeof editorActionsModule !== 'undefined' && editorActionsModule._setControlsDisabled) {
          editorActionsModule._setControlsDisabled(false);
      }
      return;
    }
    editorMainModule.editorState.unsavedChanges.forEach(filePath => {
      if (editorMainModule.editorState.fileContents.hasOwnProperty(filePath)) {
        promises.push(this.saveFileContent(filePath, editorMainModule.editorState.fileContents[filePath]).then(success => {
          if (success) {
            editorMainModule.editorState.unsavedChanges.delete(filePath);
            this.updateUnsavedIndicator(filePath, false);
            successCount++;
          } else {
            failureCount++;
          }
        }));
      } else {
        editorMainModule.logDebug(`警告: 文件 ${filePath} 在未保存更改集合中，但内容未加载，跳过保存。`, 'warn');
        failureCount++;
      }
    });
    try {
      await Promise.all(promises);
      if (failureCount === 0 && successCount > 0) {
        editorMainModule.logDebug(`所有已修改文件保存成功。`, 'success');
      } else if (successCount > 0 && failureCount > 0) {
        editorMainModule.logDebug(`文件保存操作完成。成功: ${successCount}，失败: ${failureCount}。`, 'warn');
      } else if (failureCount > 0 && successCount === 0) {
        editorMainModule.logDebug(`所有尝试保存的文件均失败。失败数: ${failureCount}。`, 'error');
      } else if (successCount === 0 && failureCount === 0 && unsavedFilesCount > 0) {
        editorMainModule.logDebug(`文件保存操作完成，但部分文件因内容缺失被跳过。`, 'warn');
      }
    } catch (error) {
      editorMainModule.logDebug("保存文件过程中发生错误。", 'error');
    } finally {
      editorMainModule.editorState.isMultiFileOperationInProgress = false;
      if(typeof editorActionsModule !== 'undefined' && editorActionsModule._setControlsDisabled) {
          editorActionsModule._setControlsDisabled(false);
      }
    }
  },

  updateUnsavedIndicator(filePath, isUnsaved) {
    const itemSpanInTree = document.querySelector(`.file-tree-item[data-path="${filePath}"]`);
    if (itemSpanInTree) {
      const nameSpan = itemSpanInTree.querySelector('.file-name, .folder-name');
      if (nameSpan) {
        if (isUnsaved) {
          if (!nameSpan.textContent.endsWith('*')) {
            nameSpan.textContent += '*';
          }
          nameSpan.style.color = 'orange';
        } else {
          if (nameSpan.textContent.endsWith('*')) {
            nameSpan.textContent = nameSpan.textContent.slice(0, -1);
          }
          nameSpan.style.color = '';
        }
      }
    }
    if (filePath === editorMainModule.editorState.currentFilePath && editorMainModule.currentFileNameSpan) {
      let baseName = editorMainModule.currentFileNameSpan.textContent.endsWith('*') ? editorMainModule.currentFileNameSpan.textContent.slice(0, -1) : editorMainModule.currentFileNameSpan.textContent;
      if (isUnsaved) {
        if (!baseName.endsWith('*')) {
          editorMainModule.currentFileNameSpan.textContent = baseName + '*';
        }
      } else {
        editorMainModule.currentFileNameSpan.textContent = baseName;
      }
    }
  },

  async createNewFileOrFolder(isFolder) {
    const currentSelectionPath = editorMainModule.editorState.currentFilePath;
    let baseDir = "";
    let activeFileTreeItem = document.querySelector('#file-tree-container .file-tree-item.active-file-in-tree');
    let pathForNewItem = currentSelectionPath;
    if (activeFileTreeItem && activeFileTreeItem.dataset.path) {
      pathForNewItem = activeFileTreeItem.dataset.path;
    }
    if (pathForNewItem) {
      const parts = pathForNewItem.split('/');
      const selectedItemType = document.querySelector(`.file-tree-item[data-path="${pathForNewItem}"]`)?.dataset.type;
      if (selectedItemType === 'folder') {
        baseDir = pathForNewItem + '/';
      } else if (parts.length > 1) {
        baseDir = parts.slice(0, -1).join('/') + '/';
      }
    }
    const itemName = prompt(`输入新的 ${isFolder ? '文件夹' : '文件'}名称${baseDir ? `(在 ${baseDir}中)` : ' (在根目录)'}:`);
    if (!itemName || !itemName.trim()) return;
    const newPath = baseDir + itemName.trim();
    editorMainModule.logDebug(`正在创建新的 ${isFolder ? '文件夹' : '文件'}...`, 'info');
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/create-project-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filepath: newPath,
          is_directory: isFolder
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP 错误 ${response.status}`);
      editorMainModule.logDebug(`${isFolder ? '文件夹' : '文件'} "${newPath}" 创建成功。`, 'success');
      await editorMainModule.fetchFileTree();
      if (!isFolder) {
        editorMainModule.editorState.fileContents[newPath] = "";
        const language = editorMainModule.getLanguageForFile(newPath);
        const model = monaco.editor.createModel("", language);
        editorMainModule.editorState.editors[newPath] = model;
        model.onDidChangeContent(() => {
          editorMainModule.editorState.unsavedChanges.add(newPath);
          this.updateUnsavedIndicator(newPath, true);
        });
        editorMainModule.switchToFile(newPath);
        document.getElementById('file-list-modal').classList.remove('active');
        editorMainModule.editorState.exportSelection.add(newPath);
        editorMainModule.renderFileTree(editorMainModule.editorState.fileTree, document.getElementById('file-tree-container'), '');
        if (editorMainModule.editorState.fileTreeSearchQuery && typeof editorSearchModule !== 'undefined') editorSearchModule.performFileTreeSearch(true);
      }
    } catch (e) {
      editorMainModule.logDebug(`创建 ${isFolder ? '文件夹' : '文件'} "${newPath}" 失败: ${e.message}`, 'error');
    }
  },

  async renameSelectedItem() {
    let pathToRename = editorMainModule.editorState.currentFilePath;
    const activeFileTreeItem = document.querySelector('#file-tree-container .file-tree-item.active-file-in-tree');
    if (activeFileTreeItem && activeFileTreeItem.dataset.path) {
      pathToRename = activeFileTreeItem.dataset.path;
    }
    if (!pathToRename) {
      editorMainModule.logDebug("未选择要重命名的文件或文件夹。请先在文件树中点击一个项目。", "warn");
      alert("请先在文件列表中点击一个文件或文件夹以选中它进行重命名。");
      return;
    }
    const currentItemName = pathToRename.split('/').pop();
    const newItemName = prompt(`输入"${currentItemName}"的新名称:`, currentItemName);
    if (!newItemName || !newItemName.trim() || newItemName.trim() === currentItemName) return;
    const pathParts = pathToRename.split('/');
    pathParts.pop();
    const newPath = (pathParts.length > 0 ? pathParts.join('/') + '/' : '') + newItemName.trim();
    editorMainModule.logDebug(`正在重命名项目...`, 'info');
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/rename-project-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          old_filepath: pathToRename,
          new_filepath: newPath
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP 错误 ${response.status}`);
      editorMainModule.logDebug(`项目 "${pathToRename}" 已成功重命名为 "${newPath}"。`, 'success');
      if (editorMainModule.editorState.fileContents.hasOwnProperty(pathToRename)) {
        editorMainModule.editorState.fileContents[newPath] = editorMainModule.editorState.fileContents[pathToRename];
        delete editorMainModule.editorState.fileContents[pathToRename];
      }
      if (editorMainModule.editorState.editors.hasOwnProperty(pathToRename)) {
        editorMainModule.editorState.editors[newPath] = editorMainModule.editorState.editors[pathToRename];
        delete editorMainModule.editorState.editors[pathToRename];
        if (editorMainModule.editorState.editors[newPath] && editorMainModule.editorState.editors[newPath].getLanguageId() === 'plaintext' && editorMainModule.getLanguageForFile(newPath) !== 'plaintext') {
          monaco.editor.setModelLanguage(editorMainModule.editorState.editors[newPath], editorMainModule.getLanguageForFile(newPath));
        }
      }
      if (editorMainModule.editorState.unsavedChanges.has(pathToRename)) {
        editorMainModule.editorState.unsavedChanges.delete(pathToRename);
        editorMainModule.editorState.unsavedChanges.add(newPath);
      }
      if (editorMainModule.editorState.exportSelection.has(pathToRename)) {
        editorMainModule.editorState.exportSelection.delete(pathToRename);
        editorMainModule.editorState.exportSelection.add(newPath);
      }
      const wasCurrentFile = editorMainModule.editorState.currentFilePath === pathToRename;
      await editorMainModule.fetchFileTree();
      if (wasCurrentFile) {
        editorMainModule.editorState.currentFilePath = newPath;
        editorMainModule.editorState.currentFile = newPath.split('/').pop();
        editorMainModule.currentFileNameSpan.textContent = newPath;
        this.updateUnsavedIndicator(newPath, editorMainModule.editorState.unsavedChanges.has(newPath));
        if (editorMainModule.monacoInstance && editorMainModule.editorState.editors[newPath]) {
          editorMainModule.monacoInstance.setModel(editorMainModule.editorState.editors[newPath]);
        }
      }
      editorMainModule.updateActiveFileInTree(newPath);
    } catch (e) {
      editorMainModule.logDebug(`重命名项目 "${pathToRename}" 失败: ${e.message}`, 'error');
    }
  },

  async deleteSelectedItem() {
    let pathToDelete = null;
    let itemTypeToDelete = null;
    const activeFileTreeItem = document.querySelector('#file-tree-container .file-tree-item.active-file-in-tree');
    if (activeFileTreeItem && activeFileTreeItem.dataset.path) {
      pathToDelete = activeFileTreeItem.dataset.path;
      itemTypeToDelete = activeFileTreeItem.dataset.type;
    }
    if (!pathToDelete) {
      const checkedItems = document.querySelectorAll('#file-tree-container input[type="checkbox"]:checked');
      if (checkedItems.length > 0) {
        if (checkedItems.length === 1) {
          pathToDelete = checkedItems[0].parentElement.dataset.path;
          itemTypeToDelete = checkedItems[0].parentElement.dataset.type;
        } else {
          editorMainModule.logDebug("检测到勾选了多个项目。请取消勾选多余的项目，或逐个删除。此按钮目前仅支持删除当前活动项或单个勾选项。", "warn");
          alert("检测到勾选了多个项目。请取消勾选多余的项目，或逐个删除。此按钮目前仅支持删除当前活动项或单个勾选项。");
          return;
        }
      }
    }
    if (!pathToDelete && editorMainModule.editorState.currentFilePath) {
      pathToDelete = editorMainModule.editorState.currentFilePath;
      const fileTreeItemForCurrent = document.querySelector(`.file-tree-item[data-path="${editorMainModule.editorState.currentFilePath}"]`);
      if (fileTreeItemForCurrent) itemTypeToDelete = fileTreeItemForCurrent.dataset.type;
    }
    if (!pathToDelete) {
      editorMainModule.logDebug("未选择要删除的文件或文件夹（既未在树中激活，也未勾选，也未在编辑器中打开）。", 'warn');
      alert("请先在文件列表中点击一个文件或文件夹使其高亮，或勾选一个项目，然后再执行删除操作。");
      return;
    }
    if (!itemTypeToDelete && editorMainModule.editorState.fileTree && pathToDelete) {
      function findNodeTypeRecursive(nodes, targetPathParts, depth) {
        if (!nodes) return null;
        for (const node of nodes) {
          if (node.name === targetPathParts[depth]) {
            if (depth === targetPathParts.length - 1) return node.type;
            if (node.type === 'folder') return findNodeTypeRecursive(node.children, targetPathParts, depth + 1);
          }
        }
        return null;
      }
      itemTypeToDelete = findNodeTypeRecursive(editorMainModule.editorState.fileTree.children, pathToDelete.split('/'), 0);
    }
    if (!pathToDelete || !itemTypeToDelete) {
      editorMainModule.logDebug("无法确定要删除的项目或其类型。", 'error');
      return;
    }
    if (!confirm(`确定删除 ${itemTypeToDelete === 'folder' ? '文件夹' : '文件'} "${pathToDelete}" 吗？此操作不可恢复！`)) return;
    editorMainModule.logDebug(`正在删除项目...`, 'info');
    await this.performDelete(pathToDelete);
  },

  async performDelete(pathToDelete) {
    try {
      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/delete-project-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filepath: pathToDelete
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP 错误 ${response.status}`);
      editorMainModule.logDebug(`项目 "${pathToDelete}" 删除成功。`, 'success');
      delete editorMainModule.editorState.fileContents[pathToDelete];
      if (editorMainModule.editorState.editors[pathToDelete]) {
        editorMainModule.editorState.editors[pathToDelete].dispose();
        delete editorMainModule.editorState.editors[pathToDelete];
      }
      editorMainModule.editorState.unsavedChanges.delete(pathToDelete);
      editorMainModule.editorState.exportSelection.delete(pathToDelete);
      if (editorMainModule.editorState.currentFilePath === pathToDelete) {
        editorMainModule.editorState.currentFilePath = null;
        editorMainModule.editorState.currentFile = null;
        editorMainModule.currentFileNameSpan.textContent = "未选择文件";
        if (editorMainModule.monacoInstance) editorMainModule.monacoInstance.setModel(null);
      }
      await editorMainModule.fetchFileTree();
    } catch (e) {
      editorMainModule.logDebug(`删除项目 "${pathToDelete}" 失败: ${e.message}`, 'error');
    }
  }
};