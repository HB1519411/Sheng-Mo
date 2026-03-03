import os
import json
import sys
from .config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, ROLES_SUBDIR, NOVELS_SUBDIR, PARTITIONS_SUBDIR, EVENTS_SUBDIR,
    _load_partition_data, _save_partition_data, _ensure_config_structure,
    _save_chatroom_main_config, _create_default_partition, read_json_safely
)
from .config_definitions import default_partition_config, default_chatroom_config


def get_world_snapshot(chatroom_name):
    try:
        details = get_full_chatroom_details(chatroom_name)
        if details is None:
            return None
        return details
    except Exception:
        return None


def get_full_chatroom_details(chatroom_name):
    if not chatroom_name:
        return None

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not os.path.isdir(chatroom_path):
        return None

    details = {"config": None, "roles": [], "novels": [], "partitions": [], "events": []}
    permanent_role_names = set()

    roles_path = os.path.join(chatroom_path, ROLES_SUBDIR)
    if os.path.isdir(roles_path):
        for filename in os.listdir(roles_path):
            if filename.endswith('.json'):
                role_file_path = os.path.join(roles_path, filename)
                role_data = read_json_safely(role_file_path)
                if role_data and 'name' in role_data:
                    permanent_role_names.add(role_data['name'])
                    details["roles"].append(role_data)

    config_path = os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME)
    main_config_loaded = read_json_safely(config_path)
    main_config_changed_during_load = False
    if main_config_loaded is None:
        main_config = json.loads(json.dumps(default_chatroom_config))
        main_config["name"] = chatroom_name
        main_config_changed_during_load = True
    else:
        ensured_config = _ensure_config_structure(main_config_loaded, default_chatroom_config)
        if ensured_config != main_config_loaded:
            main_config_changed_during_load = True
        main_config = ensured_config

    if main_config_changed_during_load:
        _save_chatroom_main_config(chatroom_name, main_config)

    details["config"] = main_config

    partitions_dir_path = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    os.makedirs(partitions_dir_path, exist_ok=True)
    loaded_partition_ids = []

    for filename in os.listdir(partitions_dir_path):
        if filename.startswith("partition_") and filename.endswith(".json"):
            partition_id = filename[len("partition_"):-len(".json")]
            partition_data = _load_partition_data(chatroom_path, partition_id)
            if partition_data:
                details["partitions"].append(partition_data)
                loaded_partition_ids.append(partition_id)

    if not details["partitions"]:
        default_part_data = _create_default_partition(
            chatroom_path, main_config, chatroom_name_for_partition_name=chatroom_name)
        details["partitions"].append(default_part_data)
        loaded_partition_ids.append(default_part_data['id'])
        _save_chatroom_main_config(chatroom_name, main_config)
        details["config"] = main_config

    main_config_changed_by_partition_sync = False
    current_partitions_order = main_config.get("partitionsOrder", [])
    if not isinstance(current_partitions_order, list):
        current_partitions_order = []

    valid_ordered_partitions = [pid for pid in current_partitions_order if pid in loaded_partition_ids]
    newly_found_partitions = sorted(list(set(loaded_partition_ids) - set(valid_ordered_partitions)))
    final_partitions_order = valid_ordered_partitions + newly_found_partitions

    if set(main_config.get("partitionsOrder", [])) != set(final_partitions_order) or main_config.get("partitionsOrder", []) != final_partitions_order:
        main_config["partitionsOrder"] = final_partitions_order
        main_config_changed_by_partition_sync = True

    current_active_partition_id = main_config.get("activePartitionId")
    if current_active_partition_id not in loaded_partition_ids:
        main_config["activePartitionId"] = final_partitions_order[0] if final_partitions_order else None
        main_config_changed_by_partition_sync = True

    if main_config_changed_by_partition_sync:
        _save_chatroom_main_config(chatroom_name, main_config)
        details["config"] = main_config

    novels_path = os.path.join(chatroom_path, NOVELS_SUBDIR)
    if os.path.isdir(novels_path):
        for filename in os.listdir(novels_path):
            if filename.endswith('.json'):
                novel_file_path = os.path.join(novels_path, filename)
                novel_data = read_json_safely(novel_file_path)
                if novel_data:
                    details["novels"].append(novel_data)
    
    events_file_path = os.path.join(chatroom_path, EVENTS_SUBDIR, 'events.json')
    if os.path.isfile(events_file_path):
        events_data = read_json_safely(events_file_path)
        if events_data and isinstance(events_data.get('events'), list):
            details["events"].extend(events_data['events'])

    return details


def _update_role_in_all_partitions(chatroom_path, operation, role_name, new_role_name=None):
    partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    if not os.path.isdir(partitions_dir):
        return

    for filename in os.listdir(partitions_dir):
        if filename.startswith("partition_") and filename.endswith(".json"):
            partition_id = filename[len("partition_"):-len(".json")]
            try:
                partition_data = _load_partition_data(chatroom_path, partition_id)
                if partition_data is None:
                    continue

                if 'roleAliases' not in partition_data or not isinstance(partition_data['roleAliases'], list):
                    partition_data['roleAliases'] = []

                changed_in_this_partition = False
                existing_role_index = -1
                for i, alias_entry in enumerate(partition_data['roleAliases']):
                    if isinstance(alias_entry, dict) and alias_entry.get('name') == role_name:
                        existing_role_index = i
                        break

                if operation == "create":
                    if existing_role_index == -1:
                        partition_data['roleAliases'].append({
                            "name": role_name,
                            "alias": "",
                            "state": "默"
                        })
                        changed_in_this_partition = True
                elif operation == "delete":
                    if existing_role_index != -1:
                        del partition_data['roleAliases'][existing_role_index]
                        changed_in_this_partition = True
                elif operation == "rename" and new_role_name:
                    if existing_role_index != -1:
                        partition_data['roleAliases'][existing_role_index]['name'] = new_role_name
                        changed_in_this_partition = True

                if changed_in_this_partition:
                    _save_partition_data(chatroom_path, partition_id, partition_data)
            except Exception as e:
                pass