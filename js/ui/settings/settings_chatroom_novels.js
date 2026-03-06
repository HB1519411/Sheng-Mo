const settingsChatroomNovelsModule = {
  init: () => {
    elementsModule.novelListContainer.addEventListener('click', (event) => {
      if (stateModule.isCooldownActive) return;
      const novelItem = event.target.closest('.novel-item');
      if (!novelItem) return;
      const novelId = novelItem.dataset.novelId;
      const novelName = novelItem.querySelector('.novel-name').textContent;
      const targetButton = event.target.closest('.item-actions > .std-button');
      if (!targetButton) return;
      
      event.stopPropagation();
      if (targetButton.classList.contains('summarize-novel-button')) {
        apiClientConfigModule.triggerNovelSummarization(novelId);
      } else if (targetButton.classList.contains('item-rename')) {
        settingsChatroomNovelsModule.renameChatroomNovel(novelId, novelName);
      } else if (targetButton.classList.contains('item-replace')) {
        settingsChatroomNovelsModule.replaceChatroomNovel(novelId, novelName);
      } else if (targetButton.classList.contains('item-export')) {
        settingsChatroomNovelsModule.exportChatroomNovel(novelId);
      } else if (targetButton.classList.contains('item-delete')) {
        settingsChatroomNovelsModule.deleteChatroomNovel(novelId, novelName);
      }
    });
  },

  addChatroomNovelFromFile: () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      await settingsChatroomNovelsModule._processNovelImport(defaultName, file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    fileInput.remove();
  },

  addChatroomNovelFromPDF: () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await settingsChatroomNovelsModule._handlePdfFileSelection(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    fileInput.remove();
  },

  _handlePdfFileSelection: async (file) => {
    if (!window.pdfjsLib) return alert("PDF解析库加载失败，请检查网络连接。");

    const defaultName = file.name.replace(/\.[^/.]+$/, "");
    const isDualColumn = confirm(`文件 "${file.name}" 是否为双栏排版？\n\n点击【确定】按双栏（先左后右）解析\n点击【取消】按单栏（从上到下）解析`);

    const loadingOverlay = document.getElementById('global-loading-overlay');
    loadingOverlay.classList.add('active');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const items = textContent.items;
            const midPoint = page.getViewport({ scale: 1 }).width / 2;

            if (isDualColumn) {
                const leftCol = items.filter(i => i.transform[4] < midPoint);
                const rightCol = items.filter(i => i.transform[4] >= midPoint);

                const sortItems = (a, b) => Math.abs(b.transform[5] - a.transform[5]) < (a.height || 10) ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5];
                leftCol.sort(sortItems);
                rightCol.sort(sortItems);

                const extractText = (colItems) => {
                    let text = "", lastY = -1;
                    colItems.forEach(item => {
                        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > (item.height || 10) * 1.5) text += "\n";
                        text += item.str;
                        lastY = item.transform[5];
                    });
                    return text;
                };
                fullText += extractText(leftCol) + "\n" + extractText(rightCol) + "\n";
            } else {
                items.sort((a, b) => Math.abs(b.transform[5] - a.transform[5]) < (a.height || 10) ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5]);
                let lastY = -1;
                items.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > (item.height || 10) * 1.5) fullText += "\n";
                    fullText += item.str;
                    lastY = item.transform[5];
                });
                fullText += "\n";
            }
        }
        await settingsChatroomNovelsModule._processNovelImport(defaultName, new Blob([fullText], { type: 'text/plain;charset=utf-8' }));
    } catch (error) {
        alert(`PDF 解析失败: ${error.message}`);
    } finally {
        loadingOverlay.classList.remove('active');
    }
  },

  addChatroomNovelFromClipboard: async () => {
    const text = prompt("请在此处粘贴小说内容：");
    if (!text || !text.trim()) return;
    await settingsChatroomNovelsModule._processNovelImport(`来自剪贴板 - ${new Date().toLocaleString()}`, new Blob([text], { type: 'text/plain;charset=utf-8' }));
  },

  importChatroomNovelFromJson: () => {
    document.getElementById('import-novel-json-file').click();
  },

  _handleImportNovelJsonFile: async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const roomName = stateModule.currentChatroomDetails.config.name;
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.name || !Array.isArray(importedData.toc)) throw new Error("无效的小说JSON格式");

            let finalName = importedData.name;
            const existingNames = stateModule.currentChatroomDetails.novels.map(n => n.name);
            
            while (existingNames.includes(finalName)) {
                finalName = prompt(`小说 "${finalName}" 已存在。请输入新名称:`, `${finalName}_1`);
                if (!finalName || !finalName.trim()) return;
                finalName = finalName.trim();
            }

            const newNovelId = `novel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const result = await apiClientChatroomsModule.createNovel({
                chatroomName: roomName,
                novelData: { id: newNovelId, name: finalName, toc: importedData.toc, encoding: importedData.encoding || 'utf-8' }
            });

            if (result.success && result.changes) incrementalUpdateHandlerModule.processChanges(result.changes);
        } catch (err) {
            alert(`导入小说失败: ${err.message}`);
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
  },

  exportChatroomNovel: (novelId) => {
    const novelData = stateModule.currentChatroomDetails.novels.find(n => n.id === novelId);
    if (!novelData) return;
    const blob = new Blob([JSON.stringify(novelData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novelData.name}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  _processNovelImport: async (defaultName, fileOrBlob) => {
    const roomName = stateModule.currentChatroomDetails.config.name;
    const name = prompt("请输入新小说名称:", defaultName);
    if (!name || !name.trim()) return;
    const keywords = prompt("请输入提取关键词(用英文逗号,隔开，可留空):", "");
    
    const trimmedName = name.trim();
    if (stateModule.currentChatroomDetails.novels.some(n => n.name === trimmedName)) {
        return alert(`小说名称 "${trimmedName}" 已存在。`);
    }

    const newNovelId = `novel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
        const createResult = await apiClientChatroomsModule.createNovel({ chatroomName: roomName, novelData: { id: newNovelId, name: trimmedName, toc: [] } });
        if (!createResult.success) throw new Error(createResult.error.message);
        
        const url = new URL(`${window.location.origin}/novels/${roomName}/${newNovelId}/process`);
        if (keywords && keywords.trim()) url.searchParams.append('keywords', keywords.trim());

        const processResponse = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: fileOrBlob });
        const processResult = await processResponse.json();
        
        if (processResult.success) {
            if (createResult.changes) incrementalUpdateHandlerModule.processChanges(createResult.changes);
            if (processResult.changes) incrementalUpdateHandlerModule.processChanges(processResult.changes);
        } else {
             throw new Error(processResult.error.message);
        }
    } catch (error) {
        alert(`添加小说失败: ${error.message}`);
        transactionManagerModule.dispatch('DELETE_NOVEL', { chatroomName: roomName, novelId: newNovelId });
    }
  },

  renameChatroomNovel: (novelId, currentName) => {
    const newName = prompt(`输入小说 "${currentName}" 的新名称:`, currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    transactionManagerModule.dispatch('UPDATE_NOVEL', {
      chatroomName: stateModule.currentChatroomDetails.config.name,
      novelId,
      novelUpdates: { name: newName.trim() }
    });
  },

  replaceChatroomNovel: (novelId, novelName) => {
    const searchTerm = prompt(`[${novelName}] 全文替换\n请输入要查找的内容:`);
    if (!searchTerm) return;
    const replaceTerm = prompt(`[${novelName}] 全文替换\n将 "${searchTerm}" 替换为:`);
    if (replaceTerm === null) return;
    if (!confirm(`确定要将小说 "${novelName}" 中的所有 "${searchTerm}" 替换为 "${replaceTerm}" 吗？此操作不可撤销！`)) return;

    transactionManagerModule.dispatch('REPLACE_NOVEL_CONTENT', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        novelId, searchTerm, replaceTerm
    }).then(r => { if (r && r.success) alert(r.message === "No changes made." ? "未找到匹配内容。" : "替换成功！"); });
  },

  deleteChatroomNovel: (novelId, novelName) => {
    if (!confirm(`确定要删除小说 "${novelName}" 吗？`)) return;
    transactionManagerModule.dispatch('DELETE_NOVEL', { chatroomName: stateModule.currentChatroomDetails.config.name, novelId });
  },

  _createChatroomNovelListItem: (novel) => {
    const item = Object.assign(document.createElement('div'), { className: 'novel-item' });
    item.dataset.novelId = novel.id;
    const nameSpan = Object.assign(document.createElement('span'), { className: 'novel-name', textContent: novel.name });
    const actionsDiv = Object.assign(document.createElement('div'), { className: 'item-actions' });
    const btns = [
      { cls: 'summarize-novel-button', txt: 'Σ', title: '' },
      { cls: 'item-rename', txt: '✎', title: '' },
      { cls: 'item-replace', txt: '🔁', title: '全文替换' },
      { cls: 'item-export', txt: '📥', title: '导出(JSON)' },
      { cls: 'item-delete', txt: '✕', title: '' }
    ];
    btns.forEach(b => actionsDiv.appendChild(Object.assign(document.createElement('div'), { className: `std-button ${b.cls}`, textContent: b.txt, title: b.title, style: 'width:28px;height:28px;' })));
    item.append(nameSpan, actionsDiv);
    return item;
  },

  updateChatroomNovelPage: () => {
    const container = elementsModule.novelListContainer;
    container.innerHTML = '';
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group-horizontal';
    buttonGroup.innerHTML = `
      <div id="add-chatroom-novel-from-file-button" class="settings-menu-item">从TXT导入</div>
      <div id="add-chatroom-novel-from-clipboard-button" class="settings-menu-item">剪贴板导入</div>
      <div id="add-chatroom-novel-from-pdf-button" class="settings-menu-item">从PDF导入</div>
      <div id="import-chatroom-novel-json-button" class="settings-menu-item">导入(JSON)</div>
      <input type="file" id="import-novel-json-file" accept=".json" style="display:none;">
    `;
    container.appendChild(buttonGroup);

    buttonGroup.querySelector('#add-chatroom-novel-from-file-button').addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromFile);
    buttonGroup.querySelector('#add-chatroom-novel-from-clipboard-button').addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromClipboard);
    buttonGroup.querySelector('#add-chatroom-novel-from-pdf-button').addEventListener('click', settingsChatroomNovelsModule.addChatroomNovelFromPDF);
    buttonGroup.querySelector('#import-chatroom-novel-json-button').addEventListener('click', settingsChatroomNovelsModule.importChatroomNovelFromJson);
    buttonGroup.querySelector('#import-novel-json-file').addEventListener('change', settingsChatroomNovelsModule._handleImportNovelJsonFile);

    const novels = [...stateModule.currentChatroomDetails.novels].sort((a, b) => a.name.localeCompare(b.name));
    if (!novels.length) {
      const p = Object.assign(document.createElement('p'), { textContent: '此聊天室暂无小说。', style: 'text-align:center;' });
      container.appendChild(p);
    } else {
      const frag = document.createDocumentFragment();
      novels.forEach(n => frag.appendChild(settingsChatroomNovelsModule._createChatroomNovelListItem(n)));
      container.appendChild(frag);
    }
  }
};