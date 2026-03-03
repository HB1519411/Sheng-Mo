const settingsChatroomNovelsModule = {
  init: () => {
    elementsModule.novelListContainer.addEventListener('click', (event) => {
      if (stateModule.isCooldownActive) return;
      const novelItem = event.target.closest('.novel-item');
      if (!novelItem) return;
      const novelId = novelItem.dataset.novelId;
      const novelName = novelItem.querySelector('.novel-name')?.textContent;
      const targetButton = event.target.closest('.item-actions > .std-button');
      if (!targetButton) return;
      if (targetButton.classList.contains('summarize-novel-button')) {
        event.stopPropagation();
        apiClientConfigModule.triggerNovelSummarization(novelId);
      } else if (targetButton.classList.contains('item-rename')) {
        event.stopPropagation();
        settingsChatroomNovelsModule.renameChatroomNovel(novelId, novelName);
      } else if (targetButton.classList.contains('item-replace')) {
        event.stopPropagation();
        settingsChatroomNovelsModule.replaceChatroomNovel(novelId, novelName);
      } else if (targetButton.classList.contains('item-export')) {
        event.stopPropagation();
        settingsChatroomNovelsModule.exportChatroomNovel(novelId);
      } else if (targetButton.classList.contains('item-delete')) {
        event.stopPropagation();
        settingsChatroomNovelsModule.deleteChatroomNovel(novelId, novelName);
      }
    });
  },
  addChatroomNovelFromFile: async () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
      _logAndDisplayError("请先选择一个聊天室。", 'settingsChatroomNovelsModule.addChatroomNovelFromFile');
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) {
        document.body.removeChild(fileInput);
        return;
      }
      document.body.removeChild(fileInput);

      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      await settingsChatroomNovelsModule._processNovelImport(defaultName, file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
  },

  addChatroomNovelFromPDF: async () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
        _logAndDisplayError("请先选择一个聊天室。", 'settingsChatroomNovelsModule.addChatroomNovelFromPDF');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            document.body.removeChild(fileInput);
            return;
        }
        document.body.removeChild(fileInput);
        await settingsChatroomNovelsModule._handlePdfFileSelection(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
  },

  _handlePdfFileSelection: async (file) => {
    if (!window.pdfjsLib) {
        alert("PDF解析库加载失败，请检查网络连接。");
        return;
    }

    const defaultName = file.name.replace(/\.[^/.]+$/, "");
    const isDualColumn = confirm(`文件 "${file.name}" 是否为双栏排版？\n\n点击【确定】按双栏（先左后右）解析\n点击【取消】按单栏（从上到下）解析`);

    const loadingOverlay = document.getElementById('global-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const items = textContent.items;
            const viewport = page.getViewport({ scale: 1 });
            const pageWidth = viewport.width;

            if (isDualColumn) {
                const midPoint = pageWidth / 2;
                const leftCol = [];
                const rightCol = [];

                items.forEach(item => {
                    const x = item.transform[4];
                    if (x < midPoint) {
                        leftCol.push(item);
                    } else {
                        rightCol.push(item);
                    }
                });

                const sortItems = (a, b) => {
                    const yDiff = b.transform[5] - a.transform[5];
                    if (Math.abs(yDiff) < (a.height || 10)) { 
                        return a.transform[4] - b.transform[4];
                    }
                    return yDiff;
                };

                leftCol.sort(sortItems);
                rightCol.sort(sortItems);

                const extractText = (colItems) => {
                    let text = "";
                    let lastY = -1;
                    colItems.forEach(item => {
                        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > (item.height || 10) * 1.5) {
                            text += "\n";
                        }
                        text += item.str;
                        lastY = item.transform[5];
                    });
                    return text;
                };

                fullText += extractText(leftCol) + "\n" + extractText(rightCol) + "\n";

            } else {
                items.sort((a, b) => {
                    const yDiff = b.transform[5] - a.transform[5];
                    if (Math.abs(yDiff) < (a.height || 10)) {
                        return a.transform[4] - b.transform[4];
                    }
                    return yDiff;
                });

                let lastY = -1;
                items.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > (item.height || 10) * 1.5) {
                        fullText += "\n";
                    }
                    fullText += item.str;
                    lastY = item.transform[5];
                });
                fullText += "\n";
            }
        }

        const contentBlob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        await settingsChatroomNovelsModule._processNovelImport(defaultName, contentBlob);

    } catch (error) {
        _logAndDisplayError(`PDF 解析失败: ${error.message}`, 'settingsChatroomNovelsModule._handlePdfFileSelection');
        alert(`PDF 解析失败: ${error.message}`);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
  },

  addChatroomNovelFromClipboard: async () => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
        _logAndDisplayError("请先选择一个聊天室。", 'settingsChatroomNovelsModule.addChatroomNovelFromClipboard');
        return;
    }

    try {
        const text = prompt("请在此处粘贴小说内容：");
        if (!text || !text.trim()) {
            _logAndDisplayError("粘贴的内容为空。", 'info');
            return;
        }

        const defaultName = `来自剪贴板 - ${new Date().toLocaleString()}`;
        const contentBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });

        await settingsChatroomNovelsModule._processNovelImport(defaultName, contentBlob);

    } catch (err) {
        _logAndDisplayError(`从剪贴板导入小说失败: ${err.message}`, 'settingsChatroomNovelsModule.addChatroomNovelFromClipboard');
    }
  },

  importChatroomNovelFromJson: () => {
    const input = document.getElementById('import-novel-json-file');
    if (input) input.click();
  },

  _handleImportNovelJsonFile: async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
      _logAndDisplayError("请先选择一个聊天室。", 'settingsChatroomNovelsModule._handleImportNovelJsonFile');
      event.target.value = null;
      return;
    }
    const roomName = chatroomDetails.config.name;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData || typeof importedData !== 'object' || !importedData.name || !Array.isArray(importedData.toc)) {
                throw new Error("无效的小说JSON格式，必须包含 'name' 和 'toc' 字段。");
            }

            let finalName = importedData.name;
            const existingNames = chatroomDetails.novels.map(n => n.name);
            
            while (existingNames.includes(finalName)) {
                const newName = prompt(`小说 "${finalName}" 已存在。请输入新名称:`, `${finalName}_1`);
                if (!newName || newName.trim() === "") {
                    event.target.value = null;
                    return;
                }
                finalName = newName.trim();
            }

            const newNovelId = `novel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const newNovelData = {
                id: newNovelId,
                name: finalName,
                toc: importedData.toc,
                encoding: importedData.encoding || 'utf-8'
            };

            const createResult = await apiClientChatroomsModule.createNovel({
                chatroomName: roomName,
                novelData: newNovelData
            });

            if (createResult.success && createResult.changes) {
                incrementalUpdateHandlerModule.processChanges(createResult.changes);
                _logAndDisplayError(`小说 "${finalName}" 导入成功！`, 'success');
            } else {
                throw new Error(createResult.error?.message || "导入请求失败");
            }

        } catch (err) {
            _logAndDisplayError(`导入小说失败: ${err.message}`, 'settingsChatroomNovelsModule._handleImportNovelJsonFile');
            alert(`导入小说失败: ${err.message}`);
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
  },

  exportChatroomNovel: (novelId) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.novels) return;
    
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData) {
        _logAndDisplayError("未找到小说数据。", 'settingsChatroomNovelsModule.exportChatroomNovel');
        return;
    }

    try {
        const blob = new Blob([JSON.stringify(novelData, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${novelData.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        _logAndDisplayError(`导出小说失败: ${e.message}`, 'settingsChatroomNovelsModule.exportChatroomNovel');
    }
  },

  _processNovelImport: async (defaultName, fileOrBlob) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roomName = chatroomDetails.config.name;

    const name = prompt("请输入新小说名称:", defaultName);
    if (!name || name.trim() === "") return;
    
    const keywords = prompt("请输入提取关键词(用英文逗号,隔开，可留空):", "");
    
    const trimmedName = name.trim();
    if (chatroomDetails.novels.some(n => n.name === trimmedName)) {
        _logAndDisplayError(`小说名称 "${trimmedName}" 在当前聊天室已存在。`, 'settingsChatroomNovelsModule._processNovelImport');
        return;
    }

    const newNovelId = `novel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
        const skeletonNovel = { id: newNovelId, name: trimmedName, toc: [] };
        
        _logAndDisplayError(`正在初始化小说 "${trimmedName}"...`, 'info');
        const createResult = await apiClientChatroomsModule.createNovel({ chatroomName: roomName, novelData: skeletonNovel });
        
        if (!createResult.success) {
            throw new Error(createResult.error?.message || "创建小说文件失败");
        }
        
        _logAndDisplayError(`正在上传和处理小说内容...`, 'info');

        const url = new URL(`${window.location.origin}/novels/${roomName}/${newNovelId}/process`);
        if (keywords && keywords.trim()) {
            url.searchParams.append('keywords', keywords.trim());
        }

        const processResponse = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: fileOrBlob
        });

        if (!processResponse.ok) {
            const errorData = await processResponse.json().catch(() => ({}));
            throw new Error(`后端处理失败: ${errorData.error?.message || '未知后端错误'}`);
        }

        const processResult = await processResponse.json();
        
        if (processResult.success) {
            if (createResult.changes) {
                incrementalUpdateHandlerModule.processChanges(createResult.changes);
            }
            if (processResult.changes) {
                incrementalUpdateHandlerModule.processChanges(processResult.changes);
            }
            _logAndDisplayError(`小说 "${trimmedName}" 导入成功！`, 'success');
        } else {
             throw new Error(processResult.error?.message || "处理响应失败");
        }
    } catch (error) {
        _logAndDisplayError(`添加小说失败: ${error.message}`, 'settingsChatroomNovelsModule._processNovelImport');
        transactionManagerModule.dispatch('DELETE_NOVEL', { chatroomName: roomName, novelId: newNovelId });
    }
  },

  renameChatroomNovel: (novelId, currentName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) return;
    const roomName = chatroomDetails.config.name;
    const novelData = chatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData) return;

    const newName = prompt(`输入小说 "${currentName}" 的新名称:`, currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;

    transactionManagerModule.dispatch('UPDATE_NOVEL', {
      chatroomName: roomName,
      novelId,
      novelUpdates: {
        name: newName.trim()
      }
    });
  },

  replaceChatroomNovel: (novelId, novelName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) return;
    const roomName = chatroomDetails.config.name;

    const searchTerm = prompt(`[${novelName}] 全文替换\n请输入要查找的内容:`);
    if (!searchTerm) return;

    const replaceTerm = prompt(`[${novelName}] 全文替换\n将 "${searchTerm}" 替换为:`);
    if (replaceTerm === null) return;

    if (!confirm(`确定要将小说 "${novelName}" 中的所有 "${searchTerm}" 替换为 "${replaceTerm}" 吗？\n此操作将修改标题、正文和摘要，且不可撤销！`)) return;

    transactionManagerModule.dispatch('REPLACE_NOVEL_CONTENT', {
        chatroomName: roomName,
        novelId: novelId,
        searchTerm: searchTerm,
        replaceTerm: replaceTerm
    }).then((result) => {
        if (result && result.success) {
             if (result.message === "No changes made.") {
                 alert("未找到匹配内容，无更改。");
             } else {
                 alert("替换成功！");
             }
        }
    });
  },

  deleteChatroomNovel: (novelId, novelName) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!chatroomDetails || !chatroomDetails.config?.name) return;
    if (!confirm(`确定要删除小说 "${novelName}" 吗？`)) return;

    transactionManagerModule.dispatch('DELETE_NOVEL', {
      chatroomName: chatroomDetails.config.name,
      novelId
    });
  },

  _createChatroomNovelListItem: (novel) => {
    const item = document.createElement('div');
    item.className = 'novel-item';
    item.dataset.novelId = novel.id;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'novel-name';
    nameSpan.textContent = novel.name;
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    const summarizeButton = document.createElement('div');
    summarizeButton.className = 'std-button summarize-novel-button';
    summarizeButton.textContent = 'Σ';
    summarizeButton.style.width = '28px';
    summarizeButton.style.height = '28px';
    const renameButton = document.createElement('div');
    renameButton.className = 'std-button item-rename';
    renameButton.textContent = '✎';
    renameButton.style.width = '28px';
    renameButton.style.height = '28px';
    const replaceButton = document.createElement('div');
    replaceButton.className = 'std-button item-replace';
    replaceButton.textContent = '🔁';
    replaceButton.style.width = '28px';
    replaceButton.style.height = '28px';
    replaceButton.title = '全文替换';
    const exportButton = document.createElement('div');
    exportButton.className = 'std-button item-export';
    exportButton.textContent = '📥';
    exportButton.style.width = '28px';
    exportButton.style.height = '28px';
    exportButton.title = '导出小说(JSON)';
    const deleteButton = document.createElement('div');
    deleteButton.className = 'std-button item-delete';
    deleteButton.textContent = '✕';
    deleteButton.style.width = '28px';
    deleteButton.style.height = '28px';
    actionsDiv.appendChild(summarizeButton);
    actionsDiv.appendChild(renameButton);
    actionsDiv.appendChild(replaceButton);
    actionsDiv.appendChild(exportButton);
    actionsDiv.appendChild(deleteButton);
    item.appendChild(nameSpan);
    item.appendChild(actionsDiv);
    return item;
  },

  updateChatroomNovelPage: () => {
    const container = elementsModule.novelListContainer;
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (!container) return;
    if (!chatroomDetails || !chatroomDetails.config?.name) {
      container.innerHTML = '<p style="text-align: center;">请先选择一个聊天室。</p>';
      return;
    }
    container.innerHTML = '';
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group-horizontal';
    
    const addNovelFromFileButton = document.createElement('div');
    addNovelFromFileButton.id = 'add-chatroom-novel-from-file-button';
    addNovelFromFileButton.className = 'settings-menu-item';
    addNovelFromFileButton.textContent = '从TXT导入';
    addNovelFromFileButton.addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromFile);

    const addNovelFromClipboardButton = document.createElement('div');
    addNovelFromClipboardButton.id = 'add-chatroom-novel-from-clipboard-button';
    addNovelFromClipboardButton.className = 'settings-menu-item';
    addNovelFromClipboardButton.textContent = '剪贴板导入';
    addNovelFromClipboardButton.addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromClipboard);

    const addNovelFromPdfButton = document.createElement('div');
    addNovelFromPdfButton.id = 'add-chatroom-novel-from-pdf-button';
    addNovelFromPdfButton.className = 'settings-menu-item';
    addNovelFromPdfButton.textContent = '从PDF导入';
    addNovelFromPdfButton.addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromPDF);

    const importJsonInput = document.createElement('input');
    importJsonInput.type = 'file';
    importJsonInput.id = 'import-novel-json-file';
    importJsonInput.accept = '.json';
    importJsonInput.style.display = 'none';
    importJsonInput.addEventListener('change', settingsChatroomNovelsModule._handleImportNovelJsonFile);

    const importNovelJsonButton = document.createElement('div');
    importNovelJsonButton.id = 'import-chatroom-novel-json-button';
    importNovelJsonButton.className = 'settings-menu-item';
    importNovelJsonButton.textContent = '导入(JSON)';
    importNovelJsonButton.addEventListener('click', settingsChatroomNovelsModule.importChatroomNovelFromJson);

    buttonGroup.appendChild(addNovelFromFileButton);
    buttonGroup.appendChild(addNovelFromClipboardButton);
    buttonGroup.appendChild(addNovelFromPdfButton);
    buttonGroup.appendChild(importNovelJsonButton);
    buttonGroup.appendChild(importJsonInput);
    container.appendChild(buttonGroup);

    const novels = chatroomDetails.novels || [];
    const sortedNovels = [...novels].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortedNovels.length === 0) {
      const noNovelsMsg = document.createElement('p');
      noNovelsMsg.textContent = '此聊天室暂无小说。';
      noNovelsMsg.style.textAlign = 'center';
      container.appendChild(noNovelsMsg);
    } else {
      const fragment = document.createDocumentFragment();
      sortedNovels.forEach(novel => {
        if (novel && novel.id && novel.name) {
          fragment.appendChild(settingsChatroomNovelsModule._createChatroomNovelListItem(novel));
        }
      });
      container.appendChild(fragment);
    }
  },
};