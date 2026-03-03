import os
import json
import uuid
import shutil
import sys
import traceback
import math
import random
import time
from datetime import datetime
from backend.utils.path_utils import is_safe_path
from .config_definitions import (
    default_config, default_chatroom_config, default_partition_config,
    SECRETS_KEYS, ROLEPLAY_KEYS, PRESETS_KEYS
)


CONFIG_DIR = 'config'
TOOLS_DIR = 'tools'
DEBUG_LOG_FILENAME = 'debug_log.txt'
CHATROOMS_DIR = 'chatrooms'
CHATROOM_CONFIG_FILENAME = 'chatroom_config.json'
PARTITIONS_SUBDIR = 'partitions'
ROLES_SUBDIR = 'roles'
NOVELS_SUBDIR = 'novels'
EVENTS_SUBDIR = 'events'
IMAGES_DIR = 'images'
GENERATED_SUBDIR = 'generated'
MAX_ZIP_SIZE = 100 * 1024 * 1024

API_KEY_STATE_CACHE = {
    "failures": {},
    "active_pool": [],
    "cooldown_pool": [],
    "last_sync_hash": None
}

def _ensure_config_structure(loaded_config, default_structure, parent_key=None):
    if not isinstance(loaded_config, dict):
        return json.loads(json.dumps(default_structure))

    final_config = json.loads(json.dumps(default_structure))

    for key, default_value in default_structure.items():
        if key in loaded_config:
            loaded_value = loaded_config[key]

            if isinstance(default_value, dict):
                if isinstance(loaded_value, dict):
                    final_config[key] = _ensure_config_structure(loaded_value, default_value, key)
                else:
                    final_config[key] = default_value
            elif isinstance(default_value, list):
                if isinstance(loaded_value, list):
                    final_config[key] = loaded_value
                else:
                    final_config[key] = default_value
            elif loaded_value is not None:
                final_config[key] = loaded_value
            else:
                final_config[key] = default_value
        else:
            final_config[key] = default_value

    for key, loaded_value in loaded_config.items():
        if key not in final_config:
            final_config[key] = loaded_value

    return final_config


def read_json_safely(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading or parsing JSON from {file_path}: {e}", file=sys.stderr)
        return None


def write_json_safely(file_path, data):
    if isinstance(data, dict):
        current_version = data.get('version', 0)
        data['version'] = current_version + 1

    temp_file_path = f"{file_path}.{uuid.uuid4().hex}.tmp"
    try:
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(temp_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        shutil.move(temp_file_path, file_path)
    except Exception as e:
        print(f"Error in safe write for {file_path}: {e}", file=sys.stderr)
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass
        raise
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass


def update_json_file(file_path, update_function, default_factory=dict):
    data = read_json_safely(file_path)
    if data is None:
        if os.path.exists(file_path):
            raise IOError(f"File exists but is corrupted: {file_path}")
        data = default_factory()

    original_data_str = json.dumps(data, sort_keys=True)
    updated_data = update_function(data)
    updated_data_str = json.dumps(updated_data, sort_keys=True)

    if updated_data_str != original_data_str:
        write_json_safely(file_path, updated_data)
        return updated_data, True
    return updated_data, False


def load_current_config():
    config_dir_abs = os.path.abspath(CONFIG_DIR)
    project_root = os.path.dirname(config_dir_abs)
    
    if not os.path.exists(config_dir_abs):
        print(f"Config directory '{CONFIG_DIR}' not found. Initializing with defaults.", file=sys.stderr)
        save_current_config(default_config)
        return json.loads(json.dumps(default_config))

    aggregated_config = json.loads(json.dumps(default_config))
    
    files_map = {
        'general.json': None,
        'secrets.json': None,
        'roleplay.json': None,
        'presets.json': None
    }

    for filename in files_map.keys():
        if filename == 'secrets.json':
            filepath = os.path.join(project_root, filename)
        else:
            filepath = os.path.join(config_dir_abs, filename)
            
        data = read_json_safely(filepath)
        if data:
            for k, v in data.items():
                if k != 'version':
                    aggregated_config[k] = v

    tools_dir = os.path.join(config_dir_abs, TOOLS_DIR)
    if os.path.isdir(tools_dir):
        if 'toolSettings' not in aggregated_config:
            aggregated_config['toolSettings'] = {}
            
        for filename in os.listdir(tools_dir):
            if filename.endswith('.json'):
                tool_name = os.path.splitext(filename)[0]
                tool_data = read_json_safely(os.path.join(tools_dir, filename))
                if tool_data:
                    aggregated_config['toolSettings'][tool_name] = tool_data

    final_config = _ensure_config_structure(aggregated_config, default_config)
    
    chatrooms_base_path = os.path.abspath(CHATROOMS_DIR)
    found_room_names = set()
    if os.path.isdir(chatrooms_base_path):
        for item in os.listdir(chatrooms_base_path):
            item_path = os.path.join(chatrooms_base_path, item)
            chatroom_config_path = os.path.join(item_path, CHATROOM_CONFIG_FILENAME)
            if os.path.isdir(item_path) and os.path.exists(chatroom_config_path) and is_safe_path(item_path, chatrooms_base_path):
                room_conf = read_json_safely(chatroom_config_path)
                if isinstance(room_conf, dict) and room_conf.get('name') == item:
                    found_room_names.add(item)

    config_was_modified_during_load = False
    current_order = final_config.get('chatRoomOrder', [])
    if not isinstance(current_order, list):
        current_order = []
        config_was_modified_during_load = True

    valid_ordered_rooms = [name for name in current_order if name in found_room_names]
    newly_found_rooms = list(found_room_names - set(valid_ordered_rooms))
    newly_found_rooms.sort()

    new_chat_room_order = valid_ordered_rooms + newly_found_rooms
    if final_config.get('chatRoomOrder') != new_chat_room_order:
        final_config['chatRoomOrder'] = new_chat_room_order
        config_was_modified_during_load = True

    if final_config.get('activeChatRoomName') not in found_room_names:
        new_active_room = new_chat_room_order[0] if new_chat_room_order else None
        if final_config.get('activeChatRoomName') != new_active_room:
            final_config['activeChatRoomName'] = new_active_room
            config_was_modified_during_load = True

    active_partitions_by_chatroom = final_config.get('activePartitionIdByChatroom', {})
    if not isinstance(active_partitions_by_chatroom, dict):
        active_partitions_by_chatroom = {}
        config_was_modified_during_load = True

    cleaned_active_partitions = {}
    for room_name in final_config['chatRoomOrder']:
        if room_name in active_partitions_by_chatroom:
            cleaned_active_partitions[room_name] = active_partitions_by_chatroom[room_name]
        else:
            room_config_path = os.path.join(chatrooms_base_path, room_name, CHATROOM_CONFIG_FILENAME)
            rc_data = read_json_safely(room_config_path)
            default_active_part_id_for_room = rc_data.get('activePartitionId') if isinstance(rc_data, dict) else None
            cleaned_active_partitions[room_name] = default_active_part_id_for_room
            config_was_modified_during_load = True

    if final_config.get('activePartitionIdByChatroom') != cleaned_active_partitions:
        final_config['activePartitionIdByChatroom'] = cleaned_active_partitions
        config_was_modified_during_load = True

    if config_was_modified_during_load:
        save_current_config(final_config)

    return final_config


def save_current_config(config_data):
    config_dir_abs = os.path.abspath(CONFIG_DIR)
    project_root = os.path.dirname(config_dir_abs)
    os.makedirs(config_dir_abs, exist_ok=True)
    tools_dir_abs = os.path.join(config_dir_abs, TOOLS_DIR)
    os.makedirs(tools_dir_abs, exist_ok=True)

    secrets_data = {}
    roleplay_data = {}
    presets_data = {}
    general_data = {}
    
    for key, value in config_data.items():
        if key == 'toolSettings':
            continue
        elif key in SECRETS_KEYS:
            secrets_data[key] = value
        elif key in ROLEPLAY_KEYS:
            roleplay_data[key] = value
        elif key in PRESETS_KEYS:
            presets_data[key] = value
        else:
            general_data[key] = value

    write_json_safely(os.path.join(project_root, 'secrets.json'), secrets_data)
    write_json_safely(os.path.join(config_dir_abs, 'roleplay.json'), roleplay_data)
    write_json_safely(os.path.join(config_dir_abs, 'presets.json'), presets_data)
    write_json_safely(os.path.join(config_dir_abs, 'general.json'), general_data)

    tools_data = config_data.get('toolSettings', {})
    if isinstance(tools_data, dict):
        for tool_name, tool_config in tools_data.items():
            tool_file_path = os.path.join(tools_dir_abs, f"{tool_name}.json")
            write_json_safely(tool_file_path, tool_config)


def _save_chatroom_main_config(chatroom_name, config_data):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    config_path = os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME)

    final_config_data = _ensure_config_structure(config_data, default_chatroom_config)
    final_config_data["name"] = chatroom_name
    write_json_safely(config_path, final_config_data)


def _load_partition_data(chatroom_path, partition_id):
    partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    partition_file = os.path.join(partitions_dir, f"partition_{partition_id}.json")

    data = read_json_safely(partition_file)
    if data is None:
        if os.path.exists(partition_file):
            default_data_on_error = json.loads(json.dumps(default_partition_config))
            default_data_on_error['id'] = partition_id
            default_data_on_error['name'] = f"Partition {partition_id[:8]} (Load Error)" if partition_id else "Default Partition (Load Error)"
            return default_data_on_error
        else:
            default_data = json.loads(json.dumps(default_partition_config))
            default_data['id'] = partition_id
            default_data['name'] = f"Partition {partition_id[:8]}" if partition_id else "Default Partition"
            return default_data

    merged_data = _ensure_config_structure(data, default_partition_config)
    merged_data['id'] = partition_id
    return merged_data


def _save_partition_data(chatroom_path, partition_id, partition_data):
    partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    os.makedirs(partitions_dir, exist_ok=True)
    partition_file = os.path.join(partitions_dir, f"partition_{partition_id}.json")

    final_partition_data = _ensure_config_structure(partition_data, default_partition_config)
    final_partition_data['id'] = partition_id
    write_json_safely(partition_file, final_partition_data)


def _create_default_partition(chatroom_path, chatroom_main_config_data, chatroom_name_for_partition_name="", user_provided_name=None, novel_settings_to_inherit=None):
    partition_id = str(uuid.uuid4())
    new_partition_data = json.loads(json.dumps(default_partition_config))
    new_partition_data['id'] = partition_id

    if user_provided_name and user_provided_name.strip():
        new_partition_data['name'] = user_provided_name.strip()
    else:
        new_partition_data['name'] = "初始"

    if novel_settings_to_inherit and isinstance(novel_settings_to_inherit, dict):
        for key in ['activeNovelIds', 'novelCurrentChapterIndices', 'currentNovelId', 'lastViewedNovelId']:
            if key in novel_settings_to_inherit:
                new_partition_data[key] = novel_settings_to_inherit[key]

    final_data_to_save = _ensure_config_structure(new_partition_data, default_partition_config)
    final_data_to_save['id'] = partition_id

    _save_partition_data(chatroom_path, partition_id, final_data_to_save)

    if 'partitionsOrder' not in chatroom_main_config_data or not isinstance(chatroom_main_config_data['partitionsOrder'], list):
        chatroom_main_config_data['partitionsOrder'] = []

    if partition_id not in chatroom_main_config_data['partitionsOrder']:
        chatroom_main_config_data['partitionsOrder'].append(partition_id)

    if not chatroom_main_config_data.get('activePartitionId'):
        chatroom_main_config_data['activePartitionId'] = partition_id

    return final_data_to_save


def _update_chatroom_main_config_fields(chatroom_name, updates):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    config_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME))

    def update_fields(data):
        for key, value in updates.items():
            data[key] = value
        return _ensure_config_structure(data, default_chatroom_config)

    update_json_file(config_path, update_fields, lambda: json.loads(json.dumps(default_chatroom_config)))


def append_to_list_in_json(file_path, list_key, item):
    def append_item(data):
        if list_key not in data or not isinstance(data[list_key], list):
            data[list_key] = []
        data[list_key].append(item)
        return data
    updated_data, changed = update_json_file(file_path, append_item)
    return updated_data, changed


def update_item_in_list_in_json(file_path, list_key, item_id, updated_item):
    def update_item(data):
        if list_key in data and isinstance(data[list_key], list):
            for i, item in enumerate(data[list_key]):
                if isinstance(item, dict) and item.get('id') == item_id:
                    data[list_key][i] = updated_item
                    break
        return data
    updated_data, changed = update_json_file(file_path, update_item)
    return updated_data, changed


def delete_item_in_list_in_json(file_path, list_key, item_id):
    def delete_item(data):
        if list_key in data and isinstance(data[list_key], list):
            data[list_key] = [item for item in data[list_key] if not (
                isinstance(item, dict) and item.get('id') == item_id)]
        return data
    updated_data, changed = update_json_file(file_path, delete_item)
    return updated_data, changed