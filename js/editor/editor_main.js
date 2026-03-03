const editorMainModule = {
  EDITOR_BACKEND_BASE_URL: '',

  editorState: {
    currentFile: null,
    currentFilePath: null,
    editors: {},
    fileContents: {},
    fileTree: null,
    exportSelection: new Set(),
    unsavedChanges: new Set(),
    currentSearchQuery: null,
    currentSearchMatches: [],
    currentSearchMatchIndex: -1,
    fileTreeSearchQuery: null,
    fileTreeSearchMatches: [],
    fileTreeSearchMatchIndex: -1,
    isMultiFileOperationInProgress: false,
  },

  debugOutput: null,
  editorContainer: null,
  currentFileNameSpan: null,
  monacoInstance: null,

  logDebug(message, type = 'info') {
    const typeLower = type.toLowerCase();
    const isError = typeLower === 'error' || typeLower.includes('fail') || typeLower.includes('失败');

    if (this.editorState.isMultiFileOperationInProgress && !isError && typeLower !== 'warn') {
      const isMacroOperationLog = message.includes("正在") || message.includes("完成") || message.includes("成功") || message.includes("失败");
      if (!isMacroOperationLog) {
        return;
      }
    }

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    let typeFormattedChinese = '[信息]';
    if (isError) {
      typeFormattedChinese = '[错误!]';
    } else if (typeLower === 'success' || typeLower.includes('correct') || typeLower.includes('成功')) {
      typeFormattedChinese = '[成功]';
    } else if (typeLower === 'warn') {
      typeFormattedChinese = '[警告]';
    }

    const logEntry = document.createElement('div');
    const timeSpan = document.createElement('span');
    timeSpan.textContent = `${timestamp} `;
    const typeSpan = document.createElement('span');
    typeSpan.textContent = `${typeFormattedChinese} `;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    if (isError) {
      logEntry.style.color = '#F44336';
    } else if (typeLower === 'success' || typeLower.includes('correct') || typeLower.includes('成功')) {
      logEntry.style.color = '#4CAF50';
    } else if (typeLower === 'warn') {
      logEntry.style.color = '#FFC107';
    } else {
      logEntry.style.color = '#2196F3';
    }

    logEntry.appendChild(timeSpan);
    logEntry.appendChild(typeSpan);
    logEntry.appendChild(messageSpan);

    if (this.debugOutput.firstChild) {
      this.debugOutput.insertBefore(logEntry, this.debugOutput.firstChild);
    } else {
      this.debugOutput.appendChild(logEntry);
    }
    if (this.debugOutput.children.length > 100) {
      this.debugOutput.removeChild(this.debugOutput.lastChild);
    }
  },

  async fetchFileTree() {
    this.logDebug("正在获取文件树结构...", 'info');
    try {
      const response = await fetch(`${this.EDITOR_BACKEND_BASE_URL}/list-project-files`);
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态:${response.status}`);
      }
      const treeData = await response.json();
      this.editorState.fileTree = treeData;
      this.renderFileTree(treeData, document.getElementById('file-tree-container'), '');
      this.logDebug("获取文件树结构成功。", 'success');
      await editorActionsModule.loadExportSelection();
      if (this.editorState.fileTreeSearchQuery) {
        editorActionsModule.performFileTreeSearch(true);
      }
    } catch (error) {
      this.logDebug(`获取文件树结构失败: ${error.message}`, 'error');
      document.getElementById('file-tree-container').innerHTML = '<p style="color:red;">无法加载文件列表。</p>';
    }
  },

  renderFileTree(node, parentElement, pathOfParentDirectory) {
    const ul = document.createElement('ul');
    if (pathOfParentDirectory === '') {
      parentElement.innerHTML = '';
    }
    const itemsToList = node.children;
    if (itemsToList) {
      itemsToList.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      }).forEach(childNode => {
        const li = document.createElement('li');
        const itemSpan = document.createElement('span');
        itemSpan.className = 'file-tree-item';
        let itemFullPath;
        if (pathOfParentDirectory === '' || pathOfParentDirectory === '/') {
          itemFullPath = childNode.name;
        } else {
          itemFullPath = pathOfParentDirectory + '/' + childNode.name;
        }

        itemSpan.dataset.path = itemFullPath;
        itemSpan.dataset.type = childNode.type;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const isFile = childNode.type === 'file';
        const isFolder = childNode.type === 'folder';
        checkbox.checked = isFile ? this.editorState.exportSelection.has(itemFullPath) : editorActionsModule.isFolderSelected(itemFullPath, childNode);
        checkbox.addEventListener('change', (e) => editorActionsModule.handleExportSelectionChange(itemSpan.dataset.path, e.target.checked, childNode));
        itemSpan.appendChild(checkbox);

        const nameSpan = document.createElement('span');
        nameSpan.classList.add(childNode.type === 'folder' ? 'folder-name' : 'file-name');
        nameSpan.textContent = childNode.name;
        itemSpan.appendChild(nameSpan);

        if (isFile) {
          itemSpan.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
              if (itemSpan.dataset.path.startsWith('editor_backups/')) {
                  editorActionsModule.confirmRestoreBackup(itemSpan.dataset.path);
              } else {
                  this.switchToFile(itemSpan.dataset.path);
              }
            }
          });
          if (itemSpan.dataset.path === this.editorState.currentFilePath) {
            itemSpan.classList.add('active-file-in-tree');
          }
        } else {
          itemSpan.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
              const subUl = li.querySelector('ul');
              if (subUl) {
                subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
              }
            }
          });
        }

        li.appendChild(itemSpan);

        if (childNode.type === 'folder' && childNode.children && childNode.children.length > 0) {
          const subUl = this.renderFileTree(childNode, li, itemFullPath);
          li.appendChild(subUl);
          subUl.style.display = 'none';
        }
        ul.appendChild(li);
      });
    }
    if (pathOfParentDirectory === '') {
      parentElement.appendChild(ul);
    }
    return ul;
  },

  updateActiveFileInTree(newPath) {
    document.querySelectorAll('#file-tree-container .file-tree-item').forEach(item => {
      item.classList.remove('active-file-in-tree');
      if (item.dataset.path === newPath && item.dataset.type === 'file') {
        item.classList.add('active-file-in-tree');
        let parent = item.closest('li')?.parentElement?.closest('li');
        while (parent) {
          const subUl = parent.querySelector('ul');
          if (subUl) subUl.style.display = 'block';
          parent = parent.parentElement?.closest('li');
        }
      }
    });
  },

  async switchToFile(filePath) {
    if (!this.monacoInstance) return;
    if (!filePath || filePath.includes(':')) {
      this.logDebug(`切换文件路径无效: ${filePath}`, 'warn');
      return;
    }
    if (this.editorState.currentFilePath === filePath && this.monacoInstance.getModel() && this.monacoInstance.getModel() === this.editorState.editors[filePath]) return;

    const currentModel = this.monacoInstance.getModel();
    if (currentModel && this.editorState.currentFilePath && this.editorState.editors[this.editorState.currentFilePath] === currentModel) {
      this.editorState.fileContents[this.editorState.currentFilePath] = currentModel.getValue();
    }

    this.currentFileNameSpan.textContent = filePath || "未选择文件";
    this.editorState.currentFile = filePath.split('/').pop();
    this.editorState.currentFilePath = filePath;
    this.editorState.currentSearchQuery = null;
    this.editorState.currentSearchMatches = [];
    this.editorState.currentSearchMatchIndex = -1;
    if (document.getElementById('editor-search-input')) {
      document.getElementById('editor-search-input').value = '';
    }

    if (!this.editorState.editors[filePath]) {
      const content = await this.fetchFileContent(filePath);
      if (content === null) {
        this.monacoInstance.setModel(null);
        return;
      }
      this.editorState.fileContents[filePath] = content;
      const language = this.getLanguageForFile(filePath);
      const newModel = monaco.editor.createModel(content, language);
      this.editorState.editors[filePath] = newModel;
      newModel.onDidChangeContent(() => {
        this.editorState.unsavedChanges.add(filePath);
        editorActionsModule.updateUnsavedIndicator(filePath, true);
      });
    }

    this.monacoInstance.setModel(this.editorState.editors[filePath]);
    this.updateActiveFileInTree(filePath);
    editorActionsModule.updateUnsavedIndicator(filePath, this.editorState.unsavedChanges.has(filePath));
  },

  getLanguageForFile(filename) {
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.vue')) return 'vue';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  },

  async fetchFileContent(filePath) {
    try {
      const response = await fetch(`${this.EDITOR_BACKEND_BASE_URL}/get-editor-file-content?filepath=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "未知错误"
        }));
        this.logDebug(`获取文件 ${filePath} 内容失败: ${errorData.error || response.statusText}`, 'error');
        return null;
      }
      const data = await response.json();
      return data.content;
    } catch (error) {
      this.logDebug(`获取文件 ${filePath} 内容时发生错误: ${error.message}`, 'error');
      return null;
    }
  },

  init() {
    this.debugOutput = document.getElementById('debug-output');
    this.editorContainer = document.getElementById('editor-container');
    this.currentFileNameSpan = document.getElementById('current-file-name-span');

    require.config({
      paths: {
        'vs': 'vendor/monaco-editor/vs'
      }
    });
    require(['vs/editor/editor.main'], async () => {
      this.monacoInstance = monaco.editor.create(this.editorContainer, {
        automaticLayout: true,
        theme: 'vs-dark',
        language: 'plaintext',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        minimap: {
          enabled: true
        }
      });

      await this.fetchFileTree();
      
      fetch(`${this.EDITOR_BACKEND_BASE_URL}/trigger-startup-backup`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if(data.message === 'Backup created successfully') {
                this.logDebug("启动时自动备份已完成。", "success");
                this.fetchFileTree();
            }
        })
        .catch(err => this.logDebug("启动时自动备份请求失败: " + err.message, "error"));

      if (this.editorState.fileTree && this.editorState.fileTree.name === "/" && this.editorState.fileTree.children && this.editorState.fileTree.children.length > 0) {
        let firstFile = null;
        const findFirstFileRecursive = (nodes, currentPathPrefix) => {
          for (const node of nodes) {
            const nodePath = (currentPathPrefix ? currentPathPrefix + '/' : '') + node.name;
            if (node.type === 'file') return nodePath;
            if (node.type === 'folder' && node.children) {
              const foundInChild = findFirstFileRecursive(node.children, nodePath);
              if (foundInChild) return foundInChild;
            }
          }
          return null;
        }
        const sortedRootChildren = [...this.editorState.fileTree.children].sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : (a.type === 'file' ? 1 : 0);
        });
        firstFile = findFirstFileRecursive(sortedRootChildren, '');
        if (firstFile) {
          this.switchToFile(firstFile);
        } else {
          this.currentFileNameSpan.textContent = "未选择文件";
        }
      } else {
        this.currentFileNameSpan.textContent = "项目中无文件";
      }

      if (typeof editorAiModule !== 'undefined') {
          editorAiModule.init();
      }
    });
  }
};