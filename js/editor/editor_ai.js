const editorAiModule = {
  chatHistory: [], currentController: null, currentMode: 'edit', currentModelType: 'primary', audioContext: null, isAutoModifying: false, targetAutoModifyCount: 0, currentAutoModifyIndex: 0,

  init() {
    document.getElementById('btn-toggle-ai').addEventListener('click', () => this.toggleView());
    document.getElementById('btn-ai-send').addEventListener('click', () => this.sendMessage());
    
    const inputArea = document.getElementById('ai-chat-input');
    inputArea.addEventListener('input', function() { this.style.height = '36px'; this.style.height = this.scrollHeight + 'px'; });
    inputArea.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); this.sendMessage(); } });

    document.getElementById('ai-chat-history').addEventListener('click', e => {
      const h = e.target.closest('.file-block-header');
      if (h) h.closest('.file-block-wrapper').classList.toggle('expanded');
    });

    document.addEventListener('click', e => {
      const mq = document.getElementById('ai-quick-menu');
      const ms = document.getElementById('ai-settings-menu');
      
      if (e.target.closest('#btn-ai-quick')) {
        mq.classList.toggle('active'); ms.classList.remove('active');
      } else if (e.target.closest('#btn-ai-settings')) {
        ms.classList.toggle('active'); mq.classList.remove('active'); this.updateSettingsMenuVisual();
      } else {
        if (!mq.contains(e.target)) mq.classList.remove('active');
        if (!ms.contains(e.target)) ms.classList.remove('active');
      }

      const qItem = e.target.closest('.ai-quick-item');
      if (qItem) {
        const t = qItem.dataset.text;
        if (t === '授权你完成本次修改' && /^\d+$/.test(inputArea.value.trim())) {
          this.isAutoModifying = true; this.targetAutoModifyCount = parseInt(inputArea.value.trim()); this.currentAutoModifyIndex = 1;
          inputArea.value = `授权你完成第 1 个文件的修改`;
        } else inputArea.value = inputArea.value.trim() ? inputArea.value + "\n\n" + t : t;
        mq.classList.remove('active'); this.sendMessage();
      }

      const sItem = e.target.closest('.ai-settings-item');
      if (sItem) {
        sItem.dataset.type === 'mode' ? (this.currentMode = sItem.dataset.value) : (this.currentModelType = sItem.dataset.value);
        this.updateSettingsMenuVisual(); ms.classList.remove('active');
      }
    });
  },

  playBeep() {
    if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.audioContext, osc = ctx.createOscillator(), gn = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gn.gain.setValueAtTime(0.1, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gn); gn.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.15);
  },

  updateSettingsMenuVisual() {
    document.querySelectorAll('#ai-settings-menu .ai-settings-item').forEach(i => {
      i.classList.toggle('active', i.dataset.value === (i.dataset.type === 'mode' ? this.currentMode : this.currentModelType));
    });
  },

  toggleView() {
    const pane = document.getElementById('ai-chat-pane'), btn = document.getElementById('btn-toggle-ai');
    const isHidden = pane.style.display === 'none';
    pane.style.display = isHidden ? 'flex' : 'none';
    document.getElementById('editor-container').style.display = isHidden ? 'none' : 'block';
    document.getElementById('current-file-display-wrapper').style.display = isHidden ? 'none' : 'flex';
    Object.assign(btn.style, isHidden ? { backgroundColor: '#4CAF50', color: '#fff', borderColor: '#4CAF50' } : { backgroundColor: '', color: '', borderColor: '' });
    btn.textContent = isHidden ? '返回代码' : 'AI 助手';
  },

  async sendMessage() {
    const btn = document.getElementById('btn-ai-send'), input = document.getElementById('ai-chat-input');
    
    if (this.currentController) {
      this.currentController.abort(); this.currentController = null; this.isAutoModifying = false;
      Object.assign(btn.style, { backgroundColor: '', borderColor: '' }); btn.textContent = '发送';
      return;
    }

    if (this.audioContext && this.audioContext.state === 'suspended') this.audioContext.resume();
    
    let text = input.value.trim();
    if (!text && this.chatHistory.length && this.chatHistory.at(-1).role === 'model') {
      if (confirm("删除上一条AI回复并重新生成？")) { this.chatHistory.pop(); this.renderHistory(); } else return;
    } else if (!text && !this.chatHistory.length) return;

    let sysText = "", fileText = "";
    if (text && this.currentMode === 'edit' && !this.chatHistory.length) {
      sysText = editorMainModule.editorState.fileContents['modification_rules.txt'] ?? await editorMainModule.fetchFileContent('modification_rules.txt') ?? "";
      for (const p of editorMainModule.editorState.exportSelection) {
        let c = editorMainModule.editorState.currentFilePath === p && editorMainModule.monacoInstance.getModel() ? editorMainModule.monacoInstance.getModel().getValue() : (editorMainModule.editorState.fileContents[p] ?? await editorMainModule.fetchFileContent(p));
        if (c) fileText += `--- START OF FILE ${p} ---\n\`\`\`${editorMainModule.getLanguageForFile(p)}\n${c}\n\`\`\`\n--- END OF FILE ${p} ---\n\n`;
      }
    }

    if (text.includes('调试日志')) {
      const log = await editorMainModule.fetchFileContent('debug_log.txt');
      if (log) fileText += `--- START OF FILE debug_log.txt ---\n\`\`\`txt\n${log}\n\`\`\`\n--- END OF FILE debug_log.txt ---\n\n`;
    }

    if (text) {
      const parts = fileText ? [{ inline_data: { mime_type: "text/plain", data: window.btoa(unescape(encodeURIComponent(fileText))) } }, { text }] : [{ text }];
      this.chatHistory.push({ role: 'user', parts });
      input.value = ''; input.style.height = '36px'; this.renderHistory();
    }

    if (!this.chatHistory.length) return;

    this.currentController = new AbortController();
    Object.assign(btn.style, { backgroundColor: '#c0392b', borderColor: '#c0392b' }); btn.textContent = '终止响应';

    try {
      const res = await fetch(`${editorMainModule.EDITOR_BACKEND_BASE_URL}/editor-ai-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: this.chatHistory, systemInstruction: sysText, model_selection_type: this.currentModelType }), signal: this.currentController.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();

      if (data.is_frontend_proxy_request) {
        const pRes = await fetch(data.url, { method: 'POST', headers: data.headers, body: JSON.stringify(data.body), signal: this.currentController.signal });
        if (!pRes.ok) throw new Error(`代理失败: ${await pRes.text()}`);
        const pJson = await pRes.json();
        const txt = data.api_type === 'openai' || data.api_type === 'deepseek' ? pJson.choices[0].message.content : (data.api_type === 'claude' ? pJson.content[0].text : pJson.candidates[0].content.parts[0].text);
        if (!txt) throw new Error(pJson.error.message || "无返回文本");
        data = { success: true, data: { text_content: txt } };
      }

      if (data.success && data.data.text_content) {
        this.chatHistory.push({ role: 'model', parts: [{ text: data.data.text_content }] });
        this.playBeep();
        
        if (this.isAutoModifying) {
          if ((data.data.text_content.match(/--- START OF FILE/g) || []).length === 1) {
            if (this.currentAutoModifyIndex < this.targetAutoModifyCount) {
              input.value = `授权你完成第 ${++this.currentAutoModifyIndex} 个文件的修改`; setTimeout(() => this.sendMessage(), 500);
            } else {
              input.value = "对本次修改进行自我审查"; this.isAutoModifying = false; setTimeout(() => this.sendMessage(), 500);
            }
          } else this.isAutoModifying = false;
        }
      } else throw new Error(data.error.message || data.error);
    } catch (e) {
      this.isAutoModifying = false;
      if (e.name !== 'AbortError') this.chatHistory.push({ role: 'model', parts: [{ text: `[错误]\n${e.message}` }] });
    } finally {
      this.currentController = null;
      Object.assign(btn.style, { backgroundColor: '', borderColor: '' }); btn.textContent = '发送';
      this.renderHistory();
    }
  },

  _buildMessageContent(text, container) {
    if (!text) return;
    const parts = text.split(/--- START OF FILE (.*?) ---([\s\S]*?)--- END OF FILE \1 ---/g);
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        if (parts[i]) {
          const span = document.createElement('span');
          span.textContent = parts[i];
          container.appendChild(span);
        }
      } else if (i % 3 === 1) {
        const filePath = parts[i].trim();
        const fileContent = parts[i+1];
        
        const wrapper = document.createElement('div');
        wrapper.className = 'file-block-wrapper';
        
        const header = document.createElement('div');
        header.className = 'file-block-header';
        header.textContent = filePath;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'file-block-content';
        
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.whiteSpace = 'pre-wrap';
        pre.textContent = `--- START OF FILE ${filePath} ---${fileContent}--- END OF FILE ${filePath} ---`;
        
        contentDiv.appendChild(pre);
        wrapper.appendChild(header);
        wrapper.appendChild(contentDiv);
        container.appendChild(wrapper);
        
        i++; 
      }
    }
  },

  renderHistory() {
    const cont = document.getElementById('ai-chat-history');
    const scroll = cont.scrollTop;
    cont.innerHTML = '';
    
    this.chatHistory.forEach((msg, i) => {
      const text = msg.parts.find(p => p.text).text;
      const finalContent = msg.role === 'user' && msg.parts.some(p => p.inline_data) ? "[已附带文件]\n" + text : text;
      
      const bubble = document.createElement('div');
      bubble.className = `ai-message-bubble ${msg.role}`;
      bubble.dataset.index = i;
      
      this._buildMessageContent(finalContent, bubble);
      
      const acts = document.createElement('div');
      acts.className = 'ai-message-actions';
      if (msg.role !== 'user') {
        const s = Object.assign(document.createElement('button'), { textContent: '💾' });
        s.onclick = e => { e.stopPropagation(); editorImportExportModule.processAndSaveImportedText(text); };
        acts.appendChild(s);
      }
      const eBtn = Object.assign(document.createElement('button'), { textContent: '✏️' });
      eBtn.onclick = e => { e.stopPropagation(); this.editMessage(i); };
      const dBtn = Object.assign(document.createElement('button'), { textContent: '❌' });
      dBtn.onclick = e => { e.stopPropagation(); if (confirm('删除此消息及之后所有?')) { this.chatHistory = this.chatHistory.slice(0, i); this.renderHistory(); } };
      acts.append(eBtn, dBtn);
      bubble.appendChild(acts);
      cont.appendChild(bubble);
    });
    cont.scrollTop = scroll;
  },

  editMessage(i) {
    const b = document.querySelector(`.ai-message-bubble[data-index="${i}"]`);
    if (!b) return;
    b.innerHTML = ''; b.classList.add('editing');
    const ta = Object.assign(document.createElement('textarea'), { className: 'ai-message-edit-textarea', value: this.chatHistory[i].parts.find(p=>p.text).text });
    const save = () => {
      const v = ta.value;
      if (v.trim()) {
        const pt = this.chatHistory[i].parts.find(p=>p.text);
        pt ? (pt.text = v) : this.chatHistory[i].parts.push({text: v});
      }
      b.classList.remove('editing'); this.renderHistory();
    };
    ta.onblur = save;
    ta.onkeydown = e => { if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) { e.preventDefault(); ta.blur(); } };
    ta.oninput = function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; };
    b.appendChild(ta); ta.style.height = ta.scrollHeight + 'px'; ta.focus();
  }
};