const partitionListManagerModule = {
  init: () => {},

  updatePartitionList: () => {
    const container = elementsModule.partitionListContainer;
    container.innerHTML = '';
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (chatroomDetails.partitions.size === 0) {
      container.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    const orderedPartitions = [];
    const order = chatroomDetails.config.partitionsOrder;
    const existingPartitionIds = new Set();
    
    order.forEach(pid => {
      orderedPartitions.push(chatroomDetails.partitions.get(pid));
      existingPartitionIds.add(pid);
    });
    
    chatroomDetails.partitions.forEach(p => {
      if (!existingPartitionIds.has(p.id)) {
        orderedPartitions.push(p);
      }
    });
    
    orderedPartitions.forEach(partition => {
      const isNew = stateModule.newMessagesInPartitions.has(partition.id);
      const item = partitionListManagerModule._createPartitionListItem(partition, isNew);
      fragment.appendChild(item);
    });
    container.appendChild(fragment);

    const nameDisplay = document.getElementById('current-partition-name-display');
    if (nameDisplay && nameDisplay.closest('.setting-page-template.active')) {
      const activePartition = chatroomDetails.partitions.get(stateModule.activePartitionId);
      nameDisplay.textContent = activePartition.name;
    }
  },

  _createPartitionListItem: (partition, isNewMessage) => {
    const item = document.createElement('div');
    item.className = 'partition-list-item';
    item.dataset.partitionId = partition.id;
    if (isNewMessage) {
      item.style.backgroundColor = 'white';
      item.style.color = 'black';
    }
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';

    const accessCheckboxContainer = document.createElement('div');
    accessCheckboxContainer.className = 'partition-cross-access-checkbox-container';
    const accessCheckboxId = `partition-cross-access-${partition.id}`;
    const accessCheckbox = document.createElement('input');
    accessCheckbox.type = 'checkbox';
    accessCheckbox.id = accessCheckboxId;
    accessCheckbox.checked = partition.allowCrossPartitionHistoryAccess;
    accessCheckbox.addEventListener('change', (e) => {
      e.stopPropagation();
      transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: partition.id,
        updates: {
          allowCrossPartitionHistoryAccess: e.target.checked
        }
      });
    });
    accessCheckboxContainer.appendChild(accessCheckbox);
    item.appendChild(accessCheckboxContainer);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = partition.name;
    nameSpan.style.flexGrow = '1';
    nameSpan.style.textAlign = 'center';
    nameSpan.style.cursor = 'pointer';

    item.appendChild(nameSpan);

    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'partition-switchable-checkbox-container';
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.marginLeft = '10px';

    const checkboxId = `partition-switchable-${partition.id}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.checked = partition.isSwitchable;

    const label = document.createElement('label');
    label.htmlFor = checkboxId;

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      transactionManagerModule.dispatch('UPDATE_PARTITION_FIELDS', {
        chatroomName: stateModule.currentChatroomDetails.config.name,
        partitionId: partition.id,
        updates: {
          isSwitchable: e.target.checked
        }
      });
    });
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);

    item.appendChild(checkboxContainer);

    eventListenersModule._setupLongPressListener(
      item,
      (e) => {
        if (e.target.closest('.partition-switchable-checkbox-container, .partition-cross-access-checkbox-container')) return;
        partitionListManagerModule.switchActivePartition(partition.id);
        partitionListManagerModule.togglePartitionList();
      },
      (e) => {
        if (e.target.closest('.partition-switchable-checkbox-container, .partition-cross-access-checkbox-container')) return;
        partitionListManagerModule.handleDeletePartition(partition.id);
      },
      false
    );

    return item;
  },

  togglePartitionList: () => {
    if (elementsModule.partitionListContainer.style.display === 'flex') {
      elementsModule.partitionListContainer.style.display = 'none';
    } else {
      partitionListManagerModule.updatePartitionList();
      elementsModule.partitionListContainer.style.display = 'flex';
    }
  },

  switchActivePartition: (partitionId) => {
    transactionManagerModule.dispatch('SWITCH_ACTIVE_PARTITION', {
      partitionId
    });
  },

  handleDeletePartition: (partitionId) => {
    const chatroomDetails = stateModule.currentChatroomDetails;
    if (chatroomDetails.partitions.size <= 1) {
      alert("至少需要保留一个分区。");
      return;
    }
    const partitionToDelete = chatroomDetails.partitions.get(partitionId);
    if (!confirm(`确定要删除分区 "${partitionToDelete.name}" 吗？此操作不可恢复！`)) return;

    transactionManagerModule.dispatch('DELETE_PARTITION', {
      chatroomName: chatroomDetails.config.name,
      partitionId
    });
  },

  switchPartitionBySwipe: (direction) => {
    if (stateModule.isPartitionSwitchingCooldown) return;

    const chatroomDetails = stateModule.currentChatroomDetails;
    const partitionOrder = chatroomDetails.config.partitionsOrder;
    const switchablePartitions = partitionOrder.filter(id => {
      return chatroomDetails.partitions.get(id).isSwitchable;
    });

    if (switchablePartitions.length < 2) return;

    const currentPartitionId = stateModule.activePartitionId;
    const currentIndex = switchablePartitions.indexOf(currentPartitionId);

    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % switchablePartitions.length;
    } else {
      nextIndex = (currentIndex - 1 + switchablePartitions.length) % switchablePartitions.length;
    }

    const nextPartitionId = switchablePartitions[nextIndex];
    if (nextPartitionId !== currentPartitionId) {
      stateModule.isPartitionSwitchingCooldown = true;
      transactionManagerModule.dispatch('SWITCH_ACTIVE_PARTITION', {
        partitionId: nextPartitionId
      }).finally(() => {
        setTimeout(() => {
          stateModule.isPartitionSwitchingCooldown = false;
        }, 100);
      });
    }
  }
};