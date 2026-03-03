const settingsRoleSettingDetailModule = {
  init: () => {
    eventBus.on('STATE_UPDATED_FROM_SERVER', () => {
      if (stateModule.activeSettingPage === 'role-setting-detail-page' && stateModule.currentRole) {
        settingsRoleSettingDetailModule.renderPage(stateModule.currentRole);
      }
    });
  },
  renderPage: (roleName) => {
    stateModule.currentRole = roleName;
    const chatroomDetails = stateModule.currentChatroomDetails;
    const roleData = chatroomDetails.roles.find(r => r.name === roleName);
    if (!roleData) return;

    const roleIndex = chatroomDetails.roles.indexOf(roleData);

    const container = document.getElementById('role-setting-detail-page').querySelector('.settings-group');
    if (!container) return;
    container.innerHTML = '';

    if (elementsModule.roleSettingDetailHeaderTitle) {
      elementsModule.roleSettingDetailHeaderTitle.textContent = `角色设定 - ${roleName}`;
    }

    const grid = document.createElement('div');
    grid.className = 'role-setting-detail-grid';

    const mbtiContainer = document.createElement('div');
    settingsUiHelpersModule.createSettingItem(mbtiContainer, {
      id: 'role-mbti-input',
      label: 'MBTI',
      type: 'text',
      configPath: `currentChatroomDetails.roles[${roleIndex}].mbti`,
      autocomplete: 'off'
    });
    grid.appendChild(mbtiContainer);

    const bigFiveFields = [{
      id: 'role-bigfive-o-input',
      label: '开放性',
      configPath: `currentChatroomDetails.roles[${roleIndex}].bigFiveOpenness`
    }, {
      id: 'role-bigfive-c-input',
      label: '尽责性',
      configPath: `currentChatroomDetails.roles[${roleIndex}].bigFiveConscientiousness`
    }, {
      id: 'role-bigfive-e-input',
      label: '外向性',
      configPath: `currentChatroomDetails.roles[${roleIndex}].bigFiveExtraversion`
    }, {
      id: 'role-bigfive-a-input',
      label: '宜人性',
      configPath: `currentChatroomDetails.roles[${roleIndex}].bigFiveAgreeableness`
    }, {
      id: 'role-bigfive-n-input',
      label: '神经质',
      configPath: `currentChatroomDetails.roles[${roleIndex}].bigFiveNeuroticism`
    }];

    bigFiveFields.forEach(field => {
      const fieldContainer = document.createElement('div');
      settingsUiHelpersModule.createSettingItem(fieldContainer, {
        ...field,
        type: 'text',
        autocomplete: 'off'
      });
      grid.appendChild(fieldContainer);
    });

    container.appendChild(grid);

    settingsUiHelpersModule.createTagInput(container, {
      label: '原型',
      containerId: 'role-archetypes-container',
      inputId: 'role-archetypes-input',
      addButtonId: 'add-archetype-button',
      configPath: `currentChatroomDetails.roles[${roleIndex}].archetypes`,
      type: 'archetypes'
    });

    settingsUiHelpersModule.createTagInput(container, {
      label: '关键词',
      containerId: 'role-keywords-container',
      inputId: 'role-keywords-input',
      addButtonId: 'add-keyword-button',
      configPath: `currentChatroomDetails.roles[${roleIndex}].keywords`,
      type: 'keywords'
    });

    settingsUiHelpersModule.createSettingItem(container, {
      id: 'role-other-info-textarea',
      label: '其他信息',
      type: 'textarea',
      configPath: `currentChatroomDetails.roles[${roleIndex}].otherInfo`,
      style: {
        marginTop: 'var(--margin-medium)'
      }
    });

    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#role-mbti-input'), `currentChatroomDetails.roles[${roleIndex}].mbti`);
    bigFiveFields.forEach(field => {
      settingsUiHelpersModule.loadDynamicSetting(container.querySelector(`#${field.id}`), field.configPath);
    });

    const archetypes = settingsUiHelpersModule._getNestedState(`currentChatroomDetails.roles[${roleIndex}].archetypes`) || [];
    settingsUiHelpersModule.renderTagList(container.querySelector('#role-archetypes-container'), archetypes, 'archetypes', `currentChatroomDetails.roles[${roleIndex}].archetypes`);

    const keywords = settingsUiHelpersModule._getNestedState(`currentChatroomDetails.roles[${roleIndex}].keywords`) || [];
    settingsUiHelpersModule.renderTagList(container.querySelector('#role-keywords-container'), keywords, 'keywords', `currentChatroomDetails.roles[${roleIndex}].keywords`);

    settingsUiHelpersModule.loadDynamicSetting(container.querySelector('#role-other-info-textarea'), `currentChatroomDetails.roles[${roleIndex}].otherInfo`);
  },
};