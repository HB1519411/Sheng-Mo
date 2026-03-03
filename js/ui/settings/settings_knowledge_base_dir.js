const settingsKnowledgeBaseDirModule = {
  init: () => {
    const page = document.getElementById('knowledge-base-directory-page');
    if (!page) return;

    const addButton = document.getElementById('add-knowledge-group-button');
    if (addButton) {
      addButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) settingsKnowledgeBaseDirModule.addGroup();
      });
    }
    
    if (elementsModule.importKnowledgeJsonButton) {
        elementsModule.importKnowledgeJsonButton.addEventListener('click', () => {
            if (!stateModule.isCooldownActive) elementsModule.importKnowledgeJsonFile.click();
        });
    }
    
    if (elementsModule.importKnowledgeJsonFile) {
        elementsModule.importKnowledgeJsonFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.name || !data.entries) throw new Error("无效的知识组JSON格式");
                    const payload = {
                        group_name: data.name,
                        entries: data.entries
                    };
                    const result = await apiClientChatroomsModule.importKnowledgeGroupFromData(payload);
                    if (result.success && result.changes) {
                        incrementalUpdateHandlerModule.processChanges(result.changes);
                        alert(`导入成功！\n${result.message || ''}`);
                    } else {
                        alert(`导入失败: ${result.error?.message || '未知错误'}`);
                    }
                } catch (err) {
                    alert(`解析JSON失败: ${err.message}`);
                } finally {
                    e.target.value = null;
                }
            };
            reader.readAsText(file);
        });
    }

    if (elementsModule.importKnowledgeImageButton) {
      elementsModule.importKnowledgeImageButton.addEventListener('click', () => {
        if (!stateModule.isCooldownActive) elementsModule.importKnowledgeImageFile.click();
      });
    }
    
    if (elementsModule.importKnowledgeImageFile) {
        elementsModule.importKnowledgeImageFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.type !== 'image/png') {
                alert("请上传 PNG 格式的图片文件");
                e.target.value = null;
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const buffer = event.target.result;
                    const uint8 = new Uint8Array(buffer);
                    const view = new DataView(buffer);
                    let offset = 8;
                    let charData = null;

                    while (offset < buffer.byteLength) {
                        const length = view.getUint32(offset);
                        const type = String.fromCharCode(...uint8.slice(offset + 4, offset + 8));
                        if (type === 'tEXt') {
                            const data = uint8.slice(offset + 8, offset + 8 + length);
                            let sep = data.indexOf(0);
                            const keyword = new TextDecoder('iso-8859-1').decode(data.slice(0, sep));
                            if (keyword === 'chara') {
                                const base64Str = new TextDecoder('utf-8').decode(data.slice(sep + 1));
                                charData = JSON.parse(decodeURIComponent(escape(atob(base64Str))));
                                break;
                            }
                        }
                        offset += 12 + length;
                    }
                    
                    if (!charData) throw new Error("未在图片中找到角色卡数据");
                    
                    let groupName = '导入的角色卡';
                    if (charData.data && charData.data.name) groupName = charData.data.name;
                    else if (charData.name) groupName = charData.name;
                    
                    const entriesToImport = [];

                    const traverse = (obj) => {
                        if (typeof obj !== 'object' || obj === null) return;
                        for (const key in obj) {
                            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                            const val = obj[key];

                            if ((key === 'character_book' || key === 'lorebook') && val && Array.isArray(val.entries)) {
                                val.entries.forEach(entry => {
                                    entriesToImport.push({
                                        name: entry.comment || entry.name || '未命名世界书条目',
                                        keys: Array.isArray(entry.keys) ? entry.keys : [String(entry.keys || '')],
                                        content: entry.content || ''
                                    });
                                });
                                continue;
                            }

                            if (typeof val === 'string') {
                                entriesToImport.push({
                                    name: key,
                                    keys: [],
                                    content: val
                                });
                            } else if (typeof val === 'object') {
                                traverse(val);
                            }
                        }
                    };

                    traverse(charData);

                    if (entriesToImport.length === 0) {
                        throw new Error("此角色卡图片中未找到任何有效文本内容");
                    }
                    
                    const payload = {
                        group_name: groupName,
                        entries: entriesToImport
                    };
                    
                    const result = await apiClientChatroomsModule.importKnowledgeGroupFromData(payload);
                    if (result.success && result.changes) {
                        incrementalUpdateHandlerModule.processChanges(result.changes);
                        alert(`导入成功！\n${result.message || ''}`);
                    } else {
                        alert(`导入失败: ${result.error?.message || '未知错误'}`);
                    }
                    
                } catch (err) {
                    alert(`解析图片失败: ${err.message}`);
                } finally {
                    e.target.value = null;
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    const listContainer = document.getElementById('knowledge-group-list-container');
    if (listContainer) {
      listContainer.addEventListener('click', (event) => {
        if (stateModule.isCooldownActive) return;

        const groupItem = event.target.closest('.chatroom-item');
        if (!groupItem) return;

        const groupName = groupItem.dataset.groupName;

        if (event.target.classList.contains('item-delete')) {
          settingsKnowledgeBaseDirModule.deleteGroup(groupName);
        } else if (event.target.classList.contains('item-rename')) {
          settingsKnowledgeBaseDirModule.renameGroup(groupName);
        } else if (event.target.classList.contains('item-export')) {
          settingsKnowledgeBaseDirModule.exportGroup(groupName);
        } else {
          settingsPageManagerModule.showSection('knowledge-base-entries-page', groupName);
        }
      });
    }
    eventBus.on('UI_UPDATE_GLOBAL', () => {
      if (stateModule.activeSettingPage === 'knowledge-base-directory-page') {
        settingsKnowledgeBaseDirModule.renderPage();
      }
    });
  },

  renderPage: async () => {
    const container = document.getElementById('knowledge-group-list-container');
    if (!container) return;
    container.innerHTML = '';

    const result = await apiClientChatroomsModule.getKnowledgeGroups();
    if (result.success && result.data) {
      if (result.data.length === 0) {
        container.innerHTML = '<p style="text-align: center;">知识库为空。</p>';
        return;
      }
      const fragment = document.createDocumentFragment();
      result.data.forEach(group => {
        fragment.appendChild(settingsKnowledgeBaseDirModule._createGroupListItem(group.name));
      });
      container.appendChild(fragment);
    } else {
      _logAndDisplayError(`Failed to load knowledge groups: ${result.error?.message}`, 'settingsKnowledgeBaseDirModule.renderPage');
      container.innerHTML = '<p style="text-align: center; color: red;">加载知识组失败。</p>';
    }
  },

  _createGroupListItem: (groupName) => {
    const item = document.createElement('div');
    item.className = 'chatroom-item';
    item.dataset.groupName = groupName;

    const label = document.createElement('label');
    label.textContent = groupName;
    label.style.cursor = 'pointer';
    label.style.flexGrow = '1';

    item.appendChild(label);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const renameButton = document.createElement('div');
    renameButton.className = 'std-button item-rename';
    renameButton.textContent = '✎';
    renameButton.style.width = '28px';
    renameButton.style.height = '28px';

    const exportButton = document.createElement('div');
    exportButton.className = 'std-button item-export';
    exportButton.textContent = '📥';
    exportButton.style.width = '28px';
    exportButton.style.height = '28px';

    const deleteButton = document.createElement('div');
    deleteButton.className = 'std-button item-delete';
    deleteButton.textContent = '✕';
    deleteButton.style.width = '28px';
    deleteButton.style.height = '28px';

    actionsDiv.appendChild(renameButton);
    actionsDiv.appendChild(exportButton);
    actionsDiv.appendChild(deleteButton);
    item.appendChild(actionsDiv);

    return item;
  },

  addGroup: async () => {
    const groupName = prompt("请输入新的知识组名称:");
    if (!groupName || groupName.trim() === "") return;

    const result = await apiClientChatroomsModule.createKnowledgeGroup(groupName.trim());
    if (result.success && result.changes) {
      incrementalUpdateHandlerModule.processChanges(result.changes);
    }
  },

  deleteGroup: async (groupName) => {
    if (!confirm(`确定要删除知识组 "${groupName}" 吗？此操作不可恢复！`)) return;

    const result = await apiClientChatroomsModule.deleteKnowledgeGroup(groupName);
    if (result.success && result.changes) {
      incrementalUpdateHandlerModule.processChanges(result.changes);
    }
  },
  
  renameGroup: async (oldName) => {
      const newName = prompt(`输入知识组 "${oldName}" 的新名称:`, oldName);
      if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
      const result = await apiClientChatroomsModule.renameKnowledgeGroup(oldName, newName.trim());
      if (result.success && result.changes) {
          incrementalUpdateHandlerModule.processChanges(result.changes);
      } else {
          alert(`重命名失败: ${result.error?.message || '未知错误'}`);
      }
  },
  
  exportGroup: async (groupName) => {
      const result = await apiClientChatroomsModule.getKnowledgeGroupEntries(groupName);
      if (result.success) {
          const exportData = {
              name: groupName,
              entries: result.data
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `知识库_${groupName}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } else {
          alert(`导出失败: 获取词条数据失败 - ${result.error?.message || '未知错误'}`);
      }
  }
};