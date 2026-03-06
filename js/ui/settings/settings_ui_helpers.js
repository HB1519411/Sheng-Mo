const settingsUiHelpersModule = {
  init: () => {},
  createSettingItem: (container, itemConfig) => {
    const { id, label, type, configPath, options, placeholder, step, min, max, rows, readonly, name, style, eventHandlers } = itemConfig;
    const settingItem = document.createElement('div');
    settingItem.className = 'settings-group';
    
    if (!['checkbox', 'radioGroup', 'button', 'info'].includes(type) && label) {
      const labelElement = document.createElement('label');
      labelElement.htmlFor = id;
      labelElement.className = 'settings-label';
      labelElement.textContent = label;
      settingItem.appendChild(labelElement);
    }

    let inputElement;
    if (type === 'text' || type === 'number' || type === 'password') {
      inputElement = document.createElement('input');
      inputElement.type = type;
      inputElement.className = 'settings-input';
      if (type === 'number') {
        if (step !== undefined) inputElement.step = step;
        if (min !== undefined) inputElement.min = min;
        if (max !== undefined) inputElement.max = max;
      }
    } else if (type === 'textarea') {
      inputElement = document.createElement('textarea');
      inputElement.className = 'settings-textarea';
      if (rows) inputElement.rows = rows;
    } else if (type === 'select') {
      inputElement = document.createElement('select');
      inputElement.className = 'settings-select';
      options.forEach(opt => {
        const optionElement = document.createElement('option');
        const val = typeof opt === 'object' ? opt.value : opt;
        const txt = typeof opt === 'object' ? opt.text : opt;
        optionElement.value = val;
        optionElement.textContent = txt;
        if (typeof opt === 'object') {
          if (opt.disabled) optionElement.disabled = true;
          if (opt.selected) optionElement.selected = true;
        }
        inputElement.appendChild(optionElement);
      });
    } else if (type === 'checkbox') {
      inputElement = document.createElement('input');
      inputElement.type = 'checkbox';
      inputElement.id = id;
      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = id;
      checkboxLabel.textContent = ` ${label}`;
      settingItem.appendChild(inputElement);
      settingItem.appendChild(checkboxLabel);
    } else if (type === 'radioGroup') {
      inputElement = document.createElement('div');
      inputElement.className = 'model-selection-group';
      inputElement.id = id;
      if (label) {
        const groupLabel = document.createElement('label');
        groupLabel.className = 'settings-label';
        groupLabel.textContent = label;
        settingItem.appendChild(groupLabel);
      }
      options.forEach(opt => {
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.id = `${id}-${opt.value}`;
        radioInput.name = name || id;
        radioInput.value = opt.value;
        if (opt.checked) radioInput.checked = true;
        const radioLabel = document.createElement('label');
        radioLabel.htmlFor = radioInput.id;
        radioLabel.textContent = opt.text;
        inputElement.appendChild(radioInput);
        inputElement.appendChild(radioLabel);
        if (configPath) {
          radioInput.addEventListener('change', () => {
            if (radioInput.checked) settingsUiHelpersModule._handleStateUpdate(configPath, radioInput.value);
          });
        }
      });
      settingItem.appendChild(inputElement);
    } else if (type === 'button') {
      inputElement = document.createElement('div');
      inputElement.className = 'settings-menu-item';
      inputElement.textContent = label;
      settingItem.appendChild(inputElement);
    } else if (type === 'info') {
      inputElement = document.createElement('div');
      inputElement.className = 'settings-info-display';
      if (label) {
        const infoLabel = document.createElement('label');
        infoLabel.className = 'settings-label';
        infoLabel.textContent = label;
        settingItem.appendChild(infoLabel);
      }
      settingItem.appendChild(inputElement);
    } else if (type === 'div' || type === 'grid') {
      inputElement = document.createElement('div');
      inputElement.id = id;
      if (type === 'grid') inputElement.className = 'chatroom-management-grid';
      settingItem.appendChild(inputElement);
    }

    if (inputElement) {
      if (['text', 'number', 'password', 'textarea', 'select'].includes(type)) {
        settingItem.appendChild(inputElement);
      }

      if (id && type !== 'radioGroup' && type !== 'div' && type !== 'grid') inputElement.id = id;
      if (placeholder) inputElement.placeholder = placeholder;
      if (readonly) inputElement.readOnly = true;
      if (style) Object.assign(inputElement.style, style);
      
      if (configPath && !['button', 'info', 'radioGroup', 'div', 'grid'].includes(type)) {
        inputElement.dataset.configPath = configPath;
        inputElement.addEventListener('change', (e) => {
          const val = type === 'checkbox' ? e.target.checked : (type === 'number' ? parseFloat(e.target.value) : e.target.value);
          settingsUiHelpersModule._handleStateUpdate(configPath, val);
        });
      }
      
      if (eventHandlers) {
        Object.keys(eventHandlers).forEach(evt => inputElement.addEventListener(evt, eventHandlers[evt]));
      }
    }

    container.appendChild(settingItem);
    return inputElement;
  },

  _getNestedState: (path) => {
    const parts = path.split('.');
    let current = parts[0] === 'config' ? stateModule.config : stateModule.currentChatroomDetails;
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const match = part.match(/(\w+)\[(\d+)\]/);
      if (match) {
        current = current[match[1]][parseInt(match[2], 10)];
      } else {
        current = current instanceof Map ? current.get(part) : current[part];
      }
    }
    return current;
  },

  _handleStateUpdate: (configPath, value) => {
    const parts = configPath.split('.');
    if (parts[0] === 'config') {
      transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', { updates: { [configPath.substring(7)]: value } });
    } else if (parts[0] === 'currentChatroomDetails') {
      const chatroomName = stateModule.currentChatroomDetails.config.name;
      const match = parts[1].match(/(\w+)\[(\d+)\]/);
      if (match && match[1] === 'roles') {
        const role = stateModule.currentChatroomDetails.roles[parseInt(match[2], 10)];
        transactionManagerModule.dispatch('UPDATE_ROLE_FIELDS', {
          chatroomName, roleName: role.name, updates: { [parts.slice(2).join('.')]: value }
        });
      } else if (parts[1] === 'config') {
        transactionManagerModule.dispatch('UPDATE_CHATROOM', {
          chatroomName, updates: { [parts.slice(2).join('.')]: value }
        });
      } else if (parts[1] === 'partitions') {
        transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
          chatroomName, partitionId: parts[2], updates: { [parts.slice(3).join('.')]: value }
        });
      }
    }
  },

  loadDynamicSetting: (element, configPath, isRadioGroup = false) => {
    const value = settingsUiHelpersModule._getNestedState(configPath);
    if (isRadioGroup) {
      element.querySelectorAll(`input[type="radio"]`).forEach(r => r.checked = String(r.value) === String(value));
    } else if (element.type === 'checkbox') {
      element.checked = value;
    } else if (element.tagName === 'SELECT' || element.type === 'text' || element.type === 'number' || element.tagName === 'TEXTAREA' || element.type === 'password') {
      if (element.value !== String(value)) element.value = String(value);
    } else if (element.classList.contains('settings-info-display')) {
      element.textContent = String(value);
    }
  },

  createTagInput: (parent, config) => {
    settingsUiHelpersModule.createSettingItem(parent, { id: config.containerId, label: config.label, type: 'div' }).classList.add('tag-input-container');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-with-button-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = config.inputId;
    input.className = 'settings-input';
    input.placeholder = `输入${config.label}后添加`;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!stateModule.isCooldownActive) settingsUiHelpersModule.addTag(input, config.type, config.configPath);
      }
    });

    const button = document.createElement('div');
    button.id = config.addButtonId;
    button.className = 'std-button enter-action-button';
    button.textContent = '回车';
    button.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsUiHelpersModule.addTag(input, config.type, config.configPath);
    });

    inputGroup.appendChild(input);
    inputGroup.appendChild(button);
    parent.appendChild(inputGroup);
  },

  renderTagList: (container, tags, type, configPath) => {
    container.innerHTML = '';
    tags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'tag-item';
      tagElement.textContent = type === 'roleAliases' ? (tag.alias ? `${tag.name}（${tag.alias}）` : tag.name) : tag;
      
      const deleteButton = document.createElement('span');
      deleteButton.className = 'tag-delete-button';
      deleteButton.innerHTML = '&times;';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!stateModule.isCooldownActive) settingsUiHelpersModule.removeTag(tag, type, configPath);
      });
      
      tagElement.appendChild(deleteButton);
      container.appendChild(tagElement);
    });
  },

  addTag: (input, type, configPath) => {
    const val = input.value.trim();
    if (!val) return;
    const current = settingsUiHelpersModule._getNestedState(configPath);
    
    if (type === 'roleAliases') {
      const match = val.match(/(.+?)[（\(](.+?)[）\)]$/);
      const name = match ? match[1].trim() : val;
      const alias = match ? match[2].trim() : "";
      if (!current.some(t => t.name === name)) {
        settingsUiHelpersModule._handleStateUpdate(configPath, [...current, { name, alias }]);
      }
    } else if (!current.includes(val)) {
      settingsUiHelpersModule._handleStateUpdate(configPath, [...current, val]);
    }
    input.value = '';
    input.focus();
  },

  removeTag: (tag, type, configPath) => {
    const current = settingsUiHelpersModule._getNestedState(configPath);
    const newTags = type === 'roleAliases' ? current.filter(t => t.name !== tag.name) : current.filter(t => t !== tag);
    settingsUiHelpersModule._handleStateUpdate(configPath, newTags);
  }
};