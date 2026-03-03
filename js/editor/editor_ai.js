const editorAiModule = {
  chatHistory: [],
  currentController: null,
  currentMode: 'edit',
  currentModelType: 'primary',

  init() {
    document.getElementById('btn-toggle-ai').addEventListener('click', this.toggleView.bind(this));
    document.getElementById('btn-ai-send').addEventListener('click', this.sendMessage.bind(this));

    const inputArea = document.getElementById('ai-chat-input');
    
    inputArea.addEventListener('input', function() {
        this.style.height = '36px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    const historyContainer = document.getElementById('ai-chat-history');
    historyContainer.addEventListener('click', (e) => {
      const header = e.target.closest('.file-block-header');
      if (header) {
        const wrapper = header.closest('.file-block-wrapper');
        if (wrapper) {
          wrapper.classList.toggle('expanded');
        }
      }
    });

    const btnQuick = document.getElementById('btn-ai-quick');
    const menuQuick = document.getElementById('ai-quick-menu');
    const btnSettings = document.getElementById('btn-ai-settings');
    const menuSettings = document.getElementById('ai-settings-menu');

    if (btnQuick && menuQuick) {
        btnQuick.addEventListener('click', (e) => {
            e.stopPropagation();
            menuQuick.classList.toggle('active');
            if(menuSettings) menuSettings.classList.remove('active');
        });

        const quickItems = menuQuick.querySelectorAll('.ai-quick-item');
        quickItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = item.getAttribute('data-text');
                const currentVal = inputArea.value;
                if (currentVal.trim()) {
                    inputArea.value = currentVal + "\n\n" + text;
                } else {
                    inputArea.value = text;
                }
                menuQuick.classList.remove('active');
                this.sendMessage();
            });
        });
    }

    if (btnSettings && menuSettings) {
        btnSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            menuSettings.classList.toggle('active');
            if(menuQuick) menuQuick.classList.remove('active');
            this.updateSettingsMenuVisual();
        });

        const settingItems = menuSettings.querySelectorAll('.ai-settings-item');
        settingItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = item.getAttribute('data-type');
                const val = item.getAttribute('data-value');
                if (type === 'mode') {
                    this.currentMode = val;
                } else if (type === 'model') {
                    this.currentModelType = val;
                }
                this.updateSettingsMenuVisual();
                menuSettings.classList.remove('active');
            });
        });
    }

    document.addEventListener('click', (e) => {
        if (menuQuick && !menuQuick.contains(e.target) && e.target !== btnQuick) {
            menuQuick.classList.remove('active');
        }
        if (menuSettings && !menuSettings.contains(e.target) && e.target !== btnSettings) {
            menuSettings.classList.remove('active');
        }
    });

    this.updateSettingsMenuVisual();
  },

  updateSettingsMenuVisual() {
    const menu = document.getElementById('ai-settings-menu');
    if (!menu) return;
    const items = menu.querySelectorAll('.ai-settings-item');
    items.forEach(item => {
        const type = item.getAttribute('data-type');
        const val = item.getAttribute('data-value');
        if (type === 'mode') {
            item.classList.toggle('active', val === this.currentMode);
        } else if (type === 'model') {
            item.classList.toggle('active', val === this.currentModelType);
        }
    });
  },

  toggleView() {
    const editorCont = document.getElementById('editor-container');
    const aiPane = document.getElementById('ai-chat-pane');
    const fileDisplay = document.getElementById('current-file-display-wrapper');
    const btnToggle = document.getElementById('btn-toggle-ai');

    if (aiPane.style.display === 'none') {
      editorCont.style.display = 'none';
      fileDisplay.style.display = 'none';
      aiPane.style.display = 'flex';
      btnToggle.textContent = '返回代码';
      btnToggle.style.backgroundColor = '#4CAF50';
      btnToggle.style.color = '#fff';
      btnToggle.style.borderColor = '#4CAF50';
    } else {
      editorCont.style.display = 'block';
      fileDisplay.style.display = 'flex';
      aiPane.style.display = 'none';
      btnToggle.textContent = 'AI 助手';
      btnToggle.style.backgroundColor = '';
      btnToggle.style.color = '';
      btnToggle.style.borderColor = '';
    }
  },

  async sendMessage() {
    const btnSend = document.getElementById('btn-ai-send');

    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
      btnSend.textContent = '发送';
      btnSend.style.backgroundColor = '';
      btnSend.style.borderColor = '';
      editorMainModule.logDebug("AI: 用户终止了响应", 'warn');
      return;
    }

    const inputArea = document.getElementById('ai-chat-input');
    let text = inputArea.value.trim();

    if (!text) {
      if (this.chatHistory.length === 0) return;

      const lastMsg = this.chatHistory[this.chatHistory.length - 1];

      if (lastMsg.role === 'user') {
        editorMainModule.logDebug("AI: 检测到空输入，尝试基于上一条用户消息重试/续写...", 'info');
      } else if (lastMsg.role === 'model') {
        if (confirm("确定要删除上一条AI回复并重新生成吗？")) {
          this.chatHistory.pop();
          this.renderHistory();
          editorMainModule.logDebug("AI: 删除上一条回复，准备重新生成...", 'info');
        } else {
          return;
        }
      }
    }

    let systemInstructionText = "";
    let fileContextText = "";

    if (text && this.currentMode === 'edit' && this.chatHistory.length === 0) {
      editorMainModule.logDebug("AI: 准备以编辑模式发送，正在拉取文件内容...", 'info');

      let modRules = editorMainModule.editorState.fileContents['modification_rules.txt'];
      if (modRules === undefined) {
        modRules = await editorMainModule.fetchFileContent('modification_rules.txt') || "";
      }
      systemInstructionText = modRules;

      const selectedFiles = Array.from(editorMainModule.editorState.exportSelection);
      for (const filePath of selectedFiles) {

        let content = "";
        if (editorMainModule.editorState.currentFilePath === filePath && editorMainModule.monacoInstance && editorMainModule.monacoInstance.getModel()) {
          content = editorMainModule.monacoInstance.getModel().getValue();
          editorMainModule.editorState.fileContents[filePath] = content;
        } else if (editorMainModule.editorState.fileContents.hasOwnProperty(filePath)) {
          content = editorMainModule.editorState.fileContents[filePath];
        } else {
          content = await editorMainModule.fetchFileContent(filePath);
          if (content) editorMainModule.editorState.fileContents[filePath] = content;
        }

        if (content) {
          const lang = editorMainModule.getLanguageForFile(filePath);
          fileContextText += `--- START OF FILE ${filePath} ---\n\`\`\`${lang}\n${content}\n\`\`\`\n--- END OF FILE ${filePath} ---\n\n`;
        }
      }
    }

    if (text) {
      let parts = [];
      if (fileContextText) {
        const utf8Encode = new TextEncoder().encode(fileContextText);
        let binaryStr = '';
        const chunkSize = 8192;
        for (let i = 0; i < utf8Encode.length; i += chunkSize) {
          binaryStr += String.fromCharCode.apply(null, utf8Encode.subarray(i, i + chunkSize));
        }
        const base64Str = window.btoa(binaryStr);
        parts.push({
          inline_data: {
            mime_type: "text/plain",
            data: base64Str
          }
        });
      }
      parts.push({
        text: text
      });

      this.addMessageToState('user', parts);
      inputArea.value = '';
      inputArea.style.height = '36px';
      this.renderHistory();
    }

    if (this.chatHistory.length === 0) return;

    editorMainModule.logDebug("AI: 请求发送中...", 'info');

    this.currentController = new AbortController();
    const signal = this.currentController.signal;

    try {
      btnSend.textContent = '终止响应';
      btnSend.style.backgroundColor = '#c0392b';
      btnSend.style.borderColor = '#c0392b';

      const payload = {
        contents: this.chatHistory,
        systemInstruction: systemInstructionText,
        model_selection_type: this.currentModelType
      };

      const response = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/editor-ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: signal
      });

      if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);

      let result = await response.json();

      if (result.is_frontend_proxy_request) {
        try {
          const proxyResp = await fetch(result.url, {
            method: 'POST',
            headers: result.headers,
            body: JSON.stringify(result.body),
            signal: signal
          });

          if (!proxyResp.ok) {
            const errText = await proxyResp.text();
            throw new Error(`前端代理请求失败 (${proxyResp.status}): ${errText}`);
          }

          const proxyJson = await proxyResp.json();
          const textContent = proxyJson?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!textContent) {
            const blockReason = proxyJson?.promptFeedback?.blockReason;
            const errorMsg = proxyJson?.error?.message;
            throw new Error(errorMsg || (blockReason ? `被拦截: ${blockReason}` : "代理返回的数据中没有有效文本"));
          }

          result = {
            success: true,
            data: {
              text_content: textContent
            }
          };
        } catch (proxyError) {
          if (proxyError.name === 'AbortError') {
            throw new Error("请求已中止");
          }
          throw new Error(proxyError.message);
        }
      }

      if (result.success && result.data && result.data.text_content) {
        this.addMessageToState('model', result.data.text_content);
        editorMainModule.logDebug("AI: 已收到响应", 'success');
      } else {
        let errorMsg = "未知错误";
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMsg = result.error + (result.details ? `: ${result.details}` : '');
          } else if (result.error.message) {
            errorMsg = result.error.message;
          }
        }
        throw new Error(errorMsg);
      }

    } catch (e) {
      if (e.name === 'AbortError' || e.message === '请求已中止') {
        editorMainModule.logDebug("AI: 请求已手动中止", 'warn');
      } else {
        editorMainModule.logDebug(`AI 接口请求失败: ${e.message}`, 'error');
        this.addMessageToState('model', `[系统错误: 请求失败]\n${e.message}`);
      }
    } finally {
      this.currentController = null;
      btnSend.textContent = '发送';
      btnSend.style.backgroundColor = '';
      btnSend.style.borderColor = '';
      this.renderHistory();
    }
  },

  addMessageToState(role, content) {
    if (Array.isArray(content)) {
      this.chatHistory.push({
        role: role,
        parts: content
      });
    } else {
      this.chatHistory.push({
        role: role,
        parts: [{
          text: content
        }]
      });
    }
  },

  _formatContent(text) {
    if (!text) return '';

    const escapeHtml = (unsafe) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const fileBlockRegex = /--- START OF FILE (.*?) ---[\s\S]*?--- END OF FILE \1 ---/g;

    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = fileBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(escapeHtml(text.substring(lastIndex, match.index)));
      }

      const filepath = match[1].trim();
      const fullContent = match[0];

      const blockHtml = `
                    <div class="file-block-wrapper">
                        <div class="file-block-header">${escapeHtml(filepath)}</div>
                        <div class="file-block-content"><pre style="margin: 0; white-space: pre-wrap;">${escapeHtml(fullContent)}</pre></div>
                    </div>
                `;
      parts.push(blockHtml);

      lastIndex = fileBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(escapeHtml(text.substring(lastIndex)));
    }

    return parts.join('');
  },

  renderHistory() {
    const historyContainer = document.getElementById('ai-chat-history');
    
    const previousScrollTop = historyContainer.scrollTop;

    historyContainer.innerHTML = '';

    this.chatHistory.forEach((msg, index) => {
      const bubble = document.createElement('div');
      bubble.className = `ai-message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
      bubble.dataset.index = index;

      const textPart = msg.parts.find(p => p.text);
      let rawText = textPart ? textPart.text : '';
      const hasAttachment = msg.parts.some(p => p.inline_data);

      if (msg.role === 'user' && hasAttachment) {
        rawText = "[已附带项目文件]\n\n" + rawText;
      }

      bubble.innerHTML = this._formatContent(rawText);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'ai-message-actions';

      if (msg.role !== 'user') {
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾';
        saveBtn.title = '保存解析';
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const textToSave = textPart ? textPart.text : '';
          editorActionsModule.processAndSaveImportedText(textToSave);
        });
        actionsDiv.appendChild(saveBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editMessage(index);
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '❌';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteMessage(index);
      });

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);
      bubble.appendChild(actionsDiv);

      historyContainer.appendChild(bubble);
    });

    historyContainer.scrollTop = previousScrollTop;
  },

  editMessage(index) {
    const msg = this.chatHistory[index];
    if (!msg) return;

    const historyContainer = document.getElementById('ai-chat-history');
    const bubble = historyContainer.querySelector(`.ai-message-bubble[data-index="${index}"]`);
    if (!bubble) return;

    const textPart = msg.parts.find(p => p.text);
    const editableText = textPart ? textPart.text : '';

    bubble.innerHTML = '';
    bubble.classList.add('editing');

    const textarea = document.createElement('textarea');
    textarea.className = 'ai-message-edit-textarea';
    textarea.value = editableText;

    const saveFunc = () => {
      const newText = textarea.value;
      if (newText.trim() !== '') {
        if (textPart) {
          textPart.text = newText;
        } else {
          this.chatHistory[index].parts.push({
            text: newText
          });
        }
      }
      bubble.classList.remove('editing');
      this.renderHistory();
    };

    textarea.addEventListener('blur', saveFunc);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        textarea.blur();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        textarea.blur();
      }
    });

    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });

    bubble.appendChild(textarea);
    
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  },

  deleteMessage(index) {
    if (confirm('确定删除此消息及其后面的所有对话吗？')) {
      this.chatHistory = this.chatHistory.slice(0, index);
      this.renderHistory();
    }
  }
};