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
    const tLower = type.toLowerCase();
    const isError = ['error', 'fail', '失败'].some(k => tLower.includes(k));
    if (this.editorState.isMultiFileOperationInProgress && !isError && tLower !== 'warn' && !/正在|完成|成功|失败/.test(message)) return;

    const colors = { error: '#F44336', success: '#4CAF50', warn: '#FFC107', info: '#2196F3' };
    const prefixes = { error: '[错误!]', success: '[成功]', warn: '[警告]', info: '[信息]' };
    const t = isError ? 'error' : (['success', 'correct', '成功'].some(k => tLower.includes(k)) ? 'success' : (tLower === 'warn' ? 'warn' : 'info'));

    const logEntry = Object.assign(document.createElement('div'), { style: `color: ${colors[t]}` });
    logEntry.innerHTML = `<span>${new Date().toLocaleTimeString([], {hour12: false})} </span><span>${prefixes[t]} </span><span>${message}</span>`;
    this.debugOutput.prepend(logEntry);
    if (this.debugOutput.children.length > 100) this.debugOutput.lastChild.remove();
  },

  async fetchFileTree() {
    this.logDebug("正在获取文件树结构...", 'info');
    const response = await fetch(`${this.EDITOR_BACKEND_BASE_URL}/list-project-files`);
    if (!response.ok) {
      this.logDebug(`获取文件树结构失败: HTTP ${response.status}`, 'error');
      document.getElementById('file-tree-container').innerHTML = '<p style="color:red;">无法加载文件列表。</p>';
      return;
    }
    this.editorState.fileTree = await response.json();
    this.renderFileTree(this.editorState.fileTree, document.getElementById('file-tree-container'), '');
    this.logDebug("获取文件树结构成功。", 'success');
    await editorImportExportModule.loadExportSelection();
    if (this.editorState.fileTreeSearchQuery) editorSearchModule.performFileTreeSearch(true);
  },

  renderFileTree(node, parentElement, pathOfParentDirectory) {
    const ul = document.createElement('ul');
    if (!pathOfParentDirectory) parentElement.innerHTML = '';
    
    if (node.children) {
      node.children.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1)).forEach(child => {
        const li = document.createElement('li');
        const itemPath = (!pathOfParentDirectory || pathOfParentDirectory === '/') ? child.name : `${pathOfParentDirectory}/${child.name}`;
        
        const itemSpan = document.createElement('span');
        itemSpan.className = `file-tree-item ${child.type === 'file' && itemPath === this.editorState.currentFilePath ? 'active-file-in-tree' : ''}`;
        itemSpan.dataset.path = itemPath;
        itemSpan.dataset.type = child.type;

        const cb = Object.assign(document.createElement('input'), { type: 'checkbox' });
        cb.checked = child.type === 'file' ? this.editorState.exportSelection.has(itemPath) : editorImportExportModule.isFolderSelected(itemPath, child);
        cb.addEventListener('change', e => editorImportExportModule.handleExportSelectionChange(itemPath, e.target.checked, child));
        
        const nameSpan = Object.assign(document.createElement('span'), {
          className: child.type === 'folder' ? 'folder-name' : 'file-name',
          textContent: child.name
        });
        
        itemSpan.append(cb, nameSpan);
        itemSpan.addEventListener('click', e => {
          if (e.target === cb) return;
          if (child.type === 'file') {
            itemPath.startsWith('editor_backups/') ? editorImportExportModule.confirmRestoreBackup(itemPath) : this.switchToFile(itemPath);
          } else {
            const subUl = li.querySelector('ul');
            if (subUl) subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
          }
        });
        li.appendChild(itemSpan);

        if (child.type === 'folder' && child.children) {
          const subUl = this.renderFileTree(child, li, itemPath);
          li.appendChild(subUl);
          subUl.style.display = 'none';
        }
        ul.appendChild(li);
      });
    }
    if (!pathOfParentDirectory) parentElement.appendChild(ul);
    return ul;
  },

  updateActiveFileInTree(newPath) {
    document.querySelectorAll('#file-tree-container .file-tree-item').forEach(item => {
      item.classList.toggle('active-file-in-tree', item.dataset.path === newPath && item.dataset.type === 'file');
      if (item.classList.contains('active-file-in-tree')) {
        let parent = item.closest('li').parentElement.closest('li');
        while (parent) {
          const subUl = parent.querySelector(':scope > ul');
          if (subUl) subUl.style.display = 'block';
          parent = parent.parentElement.closest('li');
        }
      }
    });
  },

  async switchToFile(filePath) {
    if (!this.monacoInstance || !filePath) return;
    if (this.editorState.currentFilePath === filePath && this.monacoInstance.getModel() === this.editorState.editors[filePath]) return;

    const currModel = this.monacoInstance.getModel();
    if (currModel && this.editorState.currentFilePath && this.editorState.editors[this.editorState.currentFilePath] === currModel) {
      this.editorState.fileContents[this.editorState.currentFilePath] = currModel.getValue();
    }

    this.currentFileNameSpan.textContent = filePath;
    this.editorState.currentFile = filePath.split('/').pop();
    this.editorState.currentFilePath = filePath;
    this.editorState.currentSearchQuery = null;
    this.editorState.currentSearchMatches = [];
    this.editorState.currentSearchMatchIndex = -1;
    document.getElementById('editor-search-input').value = '';

    if (!this.editorState.editors[filePath]) {
      const content = await this.fetchFileContent(filePath);
      if (content === null) return this.monacoInstance.setModel(null);
      this.editorState.fileContents[filePath] = content;
      const newModel = monaco.editor.createModel(content, this.getLanguageForFile(filePath));
      this.editorState.editors[filePath] = newModel;
      newModel.onDidChangeContent(() => {
        this.editorState.unsavedChanges.add(filePath);
        editorFileOpsModule.updateUnsavedIndicator(filePath, true);
      });
    }

    this.monacoInstance.setModel(this.editorState.editors[filePath]);
    this.updateActiveFileInTree(filePath);
    editorFileOpsModule.updateUnsavedIndicator(filePath, this.editorState.unsavedChanges.has(filePath));
  },

  getLanguageForFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { py: 'python', js: 'javascript', ts: 'typescript' };
    return map[ext] || (['html', 'css', 'vue', 'json'].includes(ext) ? ext : 'plaintext');
  },

  async fetchFileContent(filePath) {
    const response = await fetch(`${this.EDITOR_BACKEND_BASE_URL}/get-editor-file-content?filepath=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      this.logDebug(`获取文件 ${filePath} 内容失败`, 'error');
      return null;
    }
    return (await response.json()).content;
  },

  init() {
    this.debugOutput = document.getElementById('debug-output');
    this.editorContainer = document.getElementById('editor-container');
    this.currentFileNameSpan = document.getElementById('current-file-name-span');

    require.config({ paths: { 'vs': 'vendor/monaco-editor/vs' } });
    require(['vs/editor/editor.main'], async () => {
      this.monacoInstance = monaco.editor.create(this.editorContainer, {
        automaticLayout: true, theme: 'vs-dark', language: 'plaintext', lineNumbers: 'on', scrollBeyondLastLine: false, minimap: { enabled: true }
      });

      await this.fetchFileTree();
      
      fetch(`${this.EDITOR_BACKEND_BASE_URL}/trigger-startup-backup`, { method: 'POST' })
        .then(res => res.json())
        .then(data => data.message === 'Backup created successfully' && this.logDebug("启动备份完成", "success"));

      const root = this.editorState.fileTree;
      if (root.children.length > 0) {
        let firstFile = null;
        const find = (nodes, prefix) => {
          for (const n of nodes) {
            const p = prefix ? `${prefix}/${n.name}` : n.name;
            if (n.type === 'file') return p;
            if (n.type === 'folder' && n.children) { const f = find(n.children, p); if (f) return f; }
          }
          return null;
        };
        firstFile = find([...root.children].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1)), '');
        firstFile ? this.switchToFile(firstFile) : (this.currentFileNameSpan.textContent = "未选择文件");
      } else {
        this.currentFileNameSpan.textContent = "项目中无文件";
      }

      editorAiModule.init();
    });
  }
};