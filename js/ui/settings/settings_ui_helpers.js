const settingsUiHelpersModule = {
  init: () => {},
  createSettingItem: (container, itemConfig, isChatroomOverride = false) => {
    const {
      id,
      label,
      type,
      configPath,
      options,
      placeholder,
      step,
      min,
      max,
      rows,
      readonly,
      name,
      value,
      checked,
      style,
      eventHandlers
    } = itemConfig;
    const settingItem = document.createElement('div');
    settingItem.className = 'settings-group';
    if (type !== 'checkbox' && type !== 'radioGroup' && type !== 'button' && type !== 'info' && label) {
      const labelElement = document.createElement('label');
      labelElement.htmlFor = id;
      labelElement.className = 'settings-label';
      labelElement.textContent = label;
      settingItem.appendChild(labelElement);
    }
    let inputElement;
    switch (type) {
      case 'text':
      case 'number':
      case 'password':
        inputElement = document.createElement('input');
        inputElement.type = type;
        inputElement.className = 'settings-input';
        if (placeholder) inputElement.placeholder = placeholder;
        if (type === 'number') {
          if (step !== undefined) inputElement.step = step;
          if (min !== undefined) inputElement.min = min;
          if (max !== undefined) inputElement.max = max;
        }
        break;
      case 'textarea':
        inputElement = document.createElement('textarea');
        inputElement.className = 'settings-textarea';
        if (placeholder) inputElement.placeholder = placeholder;
        if (rows) inputElement.rows = rows;
        break;
      case 'select':
        inputElement = document.createElement('select');
        inputElement.className = 'settings-select';
        if (options && Array.isArray(options)) {
          options.forEach(opt => {
            const optionElement = document.createElement('option');
            optionElement.value = typeof opt === 'object' ? opt.value : opt;
            optionElement.textContent = typeof opt === 'object' ? opt.text : opt;
            if (typeof opt === 'object' && opt.disabled) optionElement.disabled = true;
            if (typeof opt === 'object' && opt.selected) optionElement.selected = true;
            inputElement.appendChild(optionElement);
          });
        }
        break;
      case 'checkbox':
        inputElement = document.createElement('input');
        inputElement.type = 'checkbox';
        inputElement.id = id;
        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = id;
        checkboxLabel.textContent = ` ${label}`;
        settingItem.innerHTML = '';
        settingItem.appendChild(inputElement);
        settingItem.appendChild(checkboxLabel);
        break;
      case 'radioGroup':
        inputElement = document.createElement('div');
        inputElement.className = 'model-selection-group';
        inputElement.id = id;
        if (label) {
          const groupLabel = document.createElement('label');
          groupLabel.className = 'settings-label';
          if (isChatroomOverride) groupLabel.style.marginTop = "15px";
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
              if (radioInput.checked) {
                settingsUiHelpersModule._handleStateUpdate(configPath, radioInput.value);
              }
            });
          }
        });
        break;
      case 'button':
        inputElement = document.createElement('div');
        inputElement.className = 'settings-menu-item';
        inputElement.textContent = label;
        if (style) Object.assign(inputElement.style, style);
        settingItem.innerHTML = '';
        settingItem.appendChild(inputElement);
        break;
      case 'info':
        inputElement = document.createElement('div');
        inputElement.className = 'settings-info-display';
        if (style) Object.assign(inputElement.style, style);
        if (label) {
          const infoLabel = document.createElement('label');
          infoLabel.className = 'settings-label';
          infoLabel.textContent = label;
          settingItem.appendChild(infoLabel);
        }
        settingItem.appendChild(inputElement);
        break;
      case 'div':
        inputElement = document.createElement('div');
        inputElement.id = id;
        if (style) Object.assign(inputElement.style, style);
        settingItem.appendChild(inputElement);
        break;
      case 'grid':
        inputElement = document.createElement('div');
        inputElement.id = id;
        inputElement.className = 'chatroom-management-grid';
        if (style) Object.assign(inputElement.style, style);
        settingItem.appendChild(inputElement);
        break;
      default:
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'settings-input';
    }
    if (inputElement && type !== 'checkbox' && type !== 'button' && type !== 'radioGroup' && type !== 'div' && type !== 'grid') {
      inputElement.id = id;
      if (readonly) inputElement.readOnly = true;
      settingItem.appendChild(inputElement);
    } else if (type === 'radioGroup' || type === 'div' || type === 'grid') {
      settingItem.appendChild(inputElement);
    }
    const eventType = 'change';
    if (inputElement && configPath && type !== 'button' && type !== 'info' && type !== 'radioGroup' && type !== 'div' && type !== 'grid') {
      inputElement.dataset.configPath = configPath;
      inputElement.addEventListener(eventType, (e) => {
        let val;
        if (type === 'checkbox') {
          val = e.target.checked;
        } else {
          val = (type === 'number') ? parseFloat(e.target.value) : e.target.value;
        }
        settingsUiHelpersModule._handleStateUpdate(configPath, val);
      });
    }
    if (eventHandlers && typeof eventHandlers === 'object') {
      for (const eventName in eventHandlers) {
        if (typeof eventHandlers[eventName] === 'function') {
          inputElement.addEventListener(eventName, eventHandlers[eventName]);
        }
      }
    }
    container.appendChild(settingItem);
    return inputElement;
  },
  _getNestedState: (path) => {
    const pathParts = path.split('.');
    const rootKey = pathParts[0];
    let startNode;

    if (rootKey === 'config') {
      startNode = stateModule.config;
    } else if (rootKey === 'currentChatroomDetails') {
      startNode = stateModule.currentChatroomDetails;
    } else {
      return undefined;
    }

    const remainingPath = pathParts.slice(1);

    return remainingPath.reduce((acc, part) => {
      if (acc === undefined || acc === null) return undefined;

      const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        const targetArray = acc[arrayName];
        return Array.isArray(targetArray) ? targetArray[index] : undefined;
      }

      if (acc instanceof Map) {
        return acc.get(part);
      }

      return acc[part];
    }, startNode);
  },
  _handleStateUpdate: (configPath, value) => {
    const pathParts = configPath.split('.');
    const rootKey = pathParts[0];

    if (rootKey === 'config') {
      const updates = {
        [configPath.substring(7)]: value
      };
      transactionManagerModule.dispatch('UPDATE_CONFIG_FIELDS', {
        updates
      });
    } else if (rootKey === 'currentChatroomDetails') {
      const chatroomName = stateModule.currentChatroomDetails?.config?.name;
      if (!chatroomName) return;

      let action = '';
      let payload = {};

      const firstPart = pathParts[1];
      const arrayMatch = firstPart.match(/(\w+)\[(\d+)\]/);

      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        const remainingPath = pathParts.slice(2).join('.');

        if (arrayName === 'roles' && stateModule.currentChatroomDetails.roles[index]) {
          const role = stateModule.currentChatroomDetails.roles[index];
          action = 'UPDATE_ROLE_FIELDS';
          let updates = {
            [remainingPath]: value
          };
          payload = {
            chatroomName,
            roleName: role.name,
            updates
          };
        }
      } else {
        if (firstPart === 'config') {
          const keyToUpdate = pathParts.slice(2).join('.');
          const updates = {
            [keyToUpdate]: value
          };
          action = 'UPDATE_CHATROOM';
          payload = {
            chatroomName,
            updates
          };
        } else if (firstPart === 'partitions') {
          const partitionId = pathParts[2];
          const keyToUpdate = pathParts.slice(3).join('.');
          const updates = {
            [keyToUpdate]: value
          };
          action = 'UPDATE_PARTITION_FIELDS';
          payload = {
            chatroomName,
            partitionId,
            updates
          };
        }
      }

      if (action) {
        transactionManagerModule.dispatch(action, payload);
      }
    }
  },
  loadDynamicSetting: (element, configPath, isRadioGroup = false) => {
    if (!element || !configPath) {
      return;
    }
    const value = settingsUiHelpersModule._getNestedState(configPath);

    if (isRadioGroup) {
      const radios = element.querySelectorAll(`input[type="radio"]`);
      radios.forEach(radio => {
        const isChecked = String(radio.value) === String(value);
        radio.checked = isChecked;
      });
    } else if (element.type === 'checkbox') {
      element.checked = value || false;
    } else if (element.tagName === 'SELECT' || element.type === 'text' || element.type === 'number' || element.tagName === 'TEXTAREA' || element.type === 'password') {
      const currentValue = element.value;
      const newValue = value === undefined ? (element.type === 'number' ? '0' : '') : String(value);
      if (currentValue !== newValue) {
        element.value = newValue;
      }
    } else if (element.classList.contains('settings-info-display')) {
      const newValue = value === undefined ? '' : String(value);
      if (element.textContent !== newValue) {
        element.textContent = newValue;
      }
    }
  },
  createTagInput: (parentContainer, config) => {
    const {
      label,
      containerId,
      inputId,
      addButtonId,
      configPath,
      type
    } = config;
    settingsUiHelpersModule.createSettingItem(parentContainer, {
      id: containerId,
      label,
      type: 'div'
    });
    const tagContainer = parentContainer.querySelector(`#${containerId}`);
    tagContainer.classList.add('tag-input-container');

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-with-button-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'settings-input';
    input.placeholder = `输入${label}后添加`;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!stateModule.isCooldownActive) settingsUiHelpersModule.addTag(input, type, configPath);
      }
    });

    const button = document.createElement('div');
    button.id = addButtonId;
    button.className = 'std-button enter-action-button';
    button.textContent = '回车';
    button.addEventListener('click', () => {
      if (!stateModule.isCooldownActive) settingsUiHelpersModule.addTag(input, type, configPath);
    });

    inputGroup.appendChild(input);
    inputGroup.appendChild(button);
    parentContainer.appendChild(inputGroup);
  },
  renderTagList: (container, tags, type, configPath) => {
    if (!container) return;
    container.innerHTML = '';

    if (type === 'roleAliases') {
      tags.forEach(tagObject => {
        const displayName = tagObject.alias ? `${tagObject.name}（${tagObject.alias}）` : tagObject.name;
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-item';
        tagElement.textContent = displayName;

        const deleteButton = document.createElement('span');
        deleteButton.className = 'tag-delete-button';
        deleteButton.innerHTML = '&times;';
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!stateModule.isCooldownActive) settingsUiHelpersModule.removeTag(tagObject, type, configPath);
        });
        tagElement.appendChild(deleteButton);
        container.appendChild(tagElement);
      });
    } else {
      tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-item';
        tagElement.textContent = tag;

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
    }
  },
  addTag: (inputElement, type, configPath) => {
    if (!inputElement) return;
    const tagName = inputElement.value.trim();
    if (!tagName) return;

    let currentTags = settingsUiHelpersModule._getNestedState(configPath) || [];

    if (type === 'roleAliases') {
      const regex = /(.+?)[（\(](.+?)[）\)]$/;
      const match = tagName.match(regex);
      let newName, newAlias;

      if (match) {
        newName = match[1].trim();
        newAlias = match[2].trim();
      } else {
        newName = tagName;
        newAlias = "";
      }

      if (!currentTags.some(t => t.name === newName)) {
        const newTags = [...currentTags, {
          name: newName,
          alias: newAlias
        }];
        settingsUiHelpersModule._handleStateUpdate(configPath, newTags);
      }
    } else {
      if (!currentTags.includes(tagName)) {
        const newTags = [...currentTags, tagName];
        settingsUiHelpersModule._handleStateUpdate(configPath, newTags);
      }
    }

    inputElement.value = '';
    inputElement.focus();
  },
  removeTag: (tagToRemove, type, configPath) => {
    let currentTags = settingsUiHelpersModule._getNestedState(configPath) || [];
    let newTags;

    if (type === 'roleAliases') {
      newTags = currentTags.filter(t => t.name !== tagToRemove.name);
    } else {
      newTags = currentTags.filter(t => t !== tagToRemove);
    }

    settingsUiHelpersModule._handleStateUpdate(configPath, newTags);
  },
};