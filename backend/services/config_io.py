import os
import json
import uuid
import shutil
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
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_json_safely(file_path, data):
    if isinstance(data, dict):
        data['version'] = data.get('version', 0) + 1
    temp_file_path = f"{file_path}.{uuid.uuid4().hex}.tmp"
    dir_name = os.path.dirname(file_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(temp_file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    shutil.move(temp_file_path, file_path)

def update_json_file(file_path, update_function, default_factory=dict):
    data = read_json_safely(file_path)
    if data is None:
        data = default_factory()
    original_data_str = json.dumps(data, sort_keys=True)
    updated_data = update_function(data)
    if json.dumps(updated_data, sort_keys=True) != original_data_str:
        write_json_safely(file_path, updated_data)
        return updated_data, True
    return updated_data, False

def load_current_config():
    config_dir_abs = os.path.abspath(CONFIG_DIR)
    project_root = os.path.dirname(config_dir_abs)
    if not os.path.exists(config_dir_abs):
        save_current_config(default_config)
        return json.loads(json.dumps(default_config))

    aggregated_config = json.loads(json.dumps(default_config))
    files_map = ['general.json', 'secrets.json', 'roleplay.json', 'presets.json']
    
    for filename in files_map:
        filepath = os.path.join(project_root if filename == 'secrets.json' else config_dir_abs, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for k, v in data.items():
                if k != 'version': aggregated_config[k] = v

    tools_dir = os.path.join(config_dir_abs, TOOLS_DIR)
    if os.path.isdir(tools_dir):
        aggregated_config.setdefault('toolSettings', {})
        for filename in os.listdir(tools_dir):
            if filename.endswith('.json'):
                with open(os.path.join(tools_dir, filename), 'r', encoding='utf-8') as f:
                    tool_data = json.load(f)
                aggregated_config['toolSettings'][os.path.splitext(filename)[0]] = tool_data

    final_config = _ensure_config_structure(aggregated_config, default_config)
    chatrooms_base_path = os.path.abspath(CHATROOMS_DIR)
    found_room_names = set()
    
    if os.path.isdir(chatrooms_base_path):
        for item in os.listdir(chatrooms_base_path):
            item_path = os.path.join(chatrooms_base_path, item)
            chatroom_config_path = os.path.join(item_path, CHATROOM_CONFIG_FILENAME)
            if os.path.isdir(item_path) and os.path.exists(chatroom_config_path) and is_safe_path(item_path, chatrooms_base_path):
                with open(chatroom_config_path, 'r', encoding='utf-8') as f:
                    room_conf = json.load(f)
                if isinstance(room_conf, dict) and room_conf.get('name') == item:
                    found_room_names.add(item)

    current_order = final_config.get('chatRoomOrder', [])
    valid_ordered_rooms = [name for name in current_order if name in found_room_names]
    newly_found_rooms = sorted(list(found_room_names - set(valid_ordered_rooms)))
    new_chat_room_order = valid_ordered_rooms + newly_found_rooms
    
    final_config['chatRoomOrder'] = new_chat_room_order
    if final_config.get('activeChatRoomName') not in found_room_names:
        final_config['activeChatRoomName'] = new_chat_room_order[0] if new_chat_room_order else None

    active_partitions = final_config.get('activePartitionIdByChatroom', {})
    cleaned_active_partitions = {}
    for room_name in new_chat_room_order:
        if room_name in active_partitions:
            cleaned_active_partitions[room_name] = active_partitions[room_name]
        else:
            config_path = os.path.join(chatrooms_base_path, room_name, CHATROOM_CONFIG_FILENAME)
            with open(config_path, 'r', encoding='utf-8') as f:
                rc_data = json.load(f)
            cleaned_active_partitions[room_name] = rc_data.get('activePartitionId')

    final_config['activePartitionIdByChatroom'] = cleaned_active_partitions
    save_current_config(final_config)
    return final_config

def save_current_config(config_data):
    config_dir_abs = os.path.abspath(CONFIG_DIR)
    project_root = os.path.dirname(config_dir_abs)
    tools_dir_abs = os.path.join(config_dir_abs, TOOLS_DIR)
    os.makedirs(config_dir_abs, exist_ok=True)
    os.makedirs(tools_dir_abs, exist_ok=True)

    secrets_data, roleplay_data, presets_data, general_data = {}, {}, {}, {}
    for key, value in config_data.items():
        if key == 'toolSettings': continue
        if key in SECRETS_KEYS: secrets_data[key] = value
        elif key in ROLEPLAY_KEYS: roleplay_data[key] = value
        elif key in PRESETS_KEYS: presets_data[key] = value
        else: general_data[key] = value

    write_json_safely(os.path.join(project_root, 'secrets.json'), secrets_data)
    write_json_safely(os.path.join(config_dir_abs, 'roleplay.json'), roleplay_data)
    write_json_safely(os.path.join(config_dir_abs, 'presets.json'), presets_data)
    write_json_safely(os.path.join(config_dir_abs, 'general.json'), general_data)

    tools_data = config_data.get('toolSettings', {})
    if isinstance(tools_data, dict):
        for tool_name, tool_config in tools_data.items():
            write_json_safely(os.path.join(tools_dir_abs, f"{tool_name}.json"), tool_config)

def _save_chatroom_main_config(chatroom_name, config_data):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    config_path = os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME)
    final_config_data = _ensure_config_structure(config_data, default_chatroom_config)
    final_config_data["name"] = chatroom_name
    write_json_safely(config_path, final_config_data)

def _load_partition_data(chatroom_path, partition_id):
    partition_file = os.path.join(chatroom_path, PARTITIONS_SUBDIR, f"partition_{partition_id}.json")
    data = read_json_safely(partition_file)
    if data is None:
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
    final_partition_data = _ensure_config_structure(partition_data, default_partition_config)
    final_partition_data['id'] = partition_id
    write_json_safely(os.path.join(partitions_dir, f"partition_{partition_id}.json"), final_partition_data)

def _create_default_partition(chatroom_path, chatroom_main_config_data, chatroom_name_for_partition_name="", user_provided_name=None, novel_settings_to_inherit=None):
    partition_id = str(uuid.uuid4())
    new_partition_data = json.loads(json.dumps(default_partition_config))
    new_partition_data['id'] = partition_id
    new_partition_data['name'] = user_provided_name.strip() if user_provided_name and user_provided_name.strip() else "初始"

    if isinstance(novel_settings_to_inherit, dict):
        for key in ['activeNovelIds', 'novelCurrentChapterIndices', 'currentNovelId', 'lastViewedNovelId']:
            if key in novel_settings_to_inherit:
                new_partition_data[key] = novel_settings_to_inherit[key]

    final_data_to_save = _ensure_config_structure(new_partition_data, default_partition_config)
    final_data_to_save['id'] = partition_id
    _save_partition_data(chatroom_path, partition_id, final_data_to_save)

    if not isinstance(chatroom_main_config_data.get('partitionsOrder'), list):
        chatroom_main_config_data['partitionsOrder'] = []
    if partition_id not in chatroom_main_config_data['partitionsOrder']:
        chatroom_main_config_data['partitionsOrder'].append(partition_id)
    if not chatroom_main_config_data.get('activePartitionId'):
        chatroom_main_config_data['activePartitionId'] = partition_id

    return final_data_to_save

def _update_chatroom_main_config_fields(chatroom_name, updates):
    config_path = os.path.abspath(os.path.join(CHATROOMS_DIR, chatroom_name, CHATROOM_CONFIG_FILENAME))
    def update_fields(data):
        data.update(updates)
        return _ensure_config_structure(data, default_chatroom_config)
    update_json_file(config_path, update_fields, lambda: json.loads(json.dumps(default_chatroom_config)))

def append_to_list_in_json(file_path, list_key, item):
    def append_item(data):
        data.setdefault(list_key, []).append(item)
        return data
    return update_json_file(file_path, append_item)

def update_item_in_list_in_json(file_path, list_key, item_id, updated_item):
    def update_item(data):
        for i, item in enumerate(data.get(list_key, [])):
            if isinstance(item, dict) and item.get('id') == item_id:
                data[list_key][i] = updated_item
                break
        return data
    return update_json_file(file_path, update_item)

def delete_item_in_list_in_json(file_path, list_key, item_id):
    def delete_item(data):
        if list_key in data and isinstance(data[list_key], list):
            data[list_key] = [i for i in data[list_key] if not (isinstance(i, dict) and i.get('id') == item_id)]
        return data
    return update_json_file(file_path, delete_item)

def write_to_debug_log(content):
    try:
        if os.path.exists(DEBUG_LOG_FILENAME) and os.path.getsize(DEBUG_LOG_FILENAME) > 1024 * 1024:
            with open(DEBUG_LOG_FILENAME, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            if lines:
                with open(DEBUG_LOG_FILENAME, 'w', encoding='utf-8') as f:
                    f.write("[System: Log size exceeded 1MB, oldest 1/3 removed.]\n\n")
                    f.writelines(lines[-int(len(lines) * 2 / 3):])
        with open(DEBUG_LOG_FILENAME, 'a', encoding='utf-8') as f:
            f.write(content)
    except Exception:
        pass