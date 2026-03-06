from flask import Blueprint, request, jsonify
import os
import json
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, PARTITIONS_SUBDIR,
    _load_partition_data, _create_default_partition,
    _ensure_config_structure, _save_chatroom_main_config,
    update_json_file, read_json_safely, load_current_config, save_current_config,
    append_to_list_in_json, update_item_in_list_in_json, delete_item_in_list_in_json
)
from backend.services.config_definitions import default_partition_config, default_chatroom_config
from backend.utils.path_utils import create_error_response

partition_management_bp = Blueprint('partition_management_bp', __name__)

def _get_partition_file_path(chatroom_name, partition_id):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    return os.path.join(chatroom_path, PARTITIONS_SUBDIR, f"partition_{partition_id}.json")

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions', methods=['POST'])
def create_partition(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    if not os.path.isdir(chatroom_path):
        return create_error_response("CHATROOM_NOT_FOUND", "Chatroom not found", 404)
    data = request.get_json()

    partition_name = "初始"
    if data and 'partition_name' in data and data['partition_name']:
        partition_name = data.get('partition_name', '').strip()

    if '..' in partition_name or '/' in partition_name or '\\' in partition_name:
        return create_error_response("INVALID_PARTITION_NAME_CHARS", "Invalid characters in partition name", 400)

    main_config_path = os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME)
    main_config_data = read_json_safely(main_config_path) or json.loads(json.dumps(default_chatroom_config))

    inherited_novel_settings = {
        'activeNovelIds': [],
        'novelCurrentChapterIndices': {},
        'currentNovelId': None,
        'lastViewedNovelId': None
    }

    if main_config_data.get('partitionsOrder'):
        max_progress_map = {}
        for pid in main_config_data['partitionsOrder']:
            p_data = _load_partition_data(chatroom_path, pid)
            progress_data = p_data.get('novelCurrentChapterIndices', {})
            for nid, idx in progress_data.items():
                current_max = max_progress_map.get(nid, -1)
                if idx > current_max:
                    max_progress_map[nid] = idx
        
        inherited_novel_settings['novelCurrentChapterIndices'] = max_progress_map

    new_partition = _create_default_partition(
        chatroom_path,
        main_config_data,
        user_provided_name=partition_name,
        novel_settings_to_inherit=inherited_novel_settings
    )
    main_config_data['activePartitionId'] = new_partition['id']
    _save_chatroom_main_config(chatroom_name, main_config_data)
    
    global_config = load_current_config()
    global_config['activeChatRoomName'] = chatroom_name
    if 'activePartitionIdByChatroom' not in global_config:
        global_config['activePartitionIdByChatroom'] = {}
    global_config['activePartitionIdByChatroom'][chatroom_name] = new_partition['id']
    save_current_config(global_config)

    changes = [
        {"type": "CREATE_PARTITION", "payload": {"chatroomName": chatroom_name, "partition": new_partition}},
        {"type": "UPDATE_CHATROOM_CONFIG", "payload": {"chatroomName": chatroom_name, "updates": {"partitionsOrder": main_config_data["partitionsOrder"], "activePartitionId": main_config_data["activePartitionId"]}}},
        {"type": "UPDATE_GLOBAL_CONFIG", "payload": {"updates": {"activeChatRoomName": chatroom_name, f"activePartitionIdByChatroom.{chatroom_name}": new_partition['id']}}}
    ]
    return jsonify({"success": True, "changes": changes}), 201

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>', methods=['PUT'])
def update_partition(chatroom_name, partition_id):
    updates = request.get_json()
    if not isinstance(updates, dict):
        return create_error_response("INVALID_PARTITION_DATA", "Invalid partition data", 400)

    allowed_fields = ['name', 'roleplayRules', 'script', 'publicKeywords', 'isSwitchable', 'autoTriggerNextCharacter', 'activeNovelIds', 'novelCurrentChapterIndices',
                      'currentNovelId', 'lastViewedNovelId', 'history', 'allowCrossPartitionHistoryAccess', 'roleAliases']

    def update_fields(data):
        for key, value in updates.items():
            if key in allowed_fields:
                if key == 'roleAliases' and isinstance(value, list):
                    data[key] = [
                        {k: v for k, v in alias.items() if k != 'detailedState'}
                        for alias in value if isinstance(alias, dict)
                    ]
                else:
                    data[key] = value
        return data

    partition_file_path = _get_partition_file_path(chatroom_name, partition_id)
    updated_data, changed = update_json_file(
        partition_file_path, update_fields, lambda: json.loads(json.dumps(default_partition_config)))
    if updated_data is None:
        return create_error_response("UPDATE_PARTITION_FAILED", f"Partition file for {partition_id} could not be read or created.", 500)

    changes = [{
        "type": "UPDATE_PARTITION",
        "payload": {
            "chatroomName": chatroom_name,
            "partitionId": partition_id,
            "updates": updates
        }
    }]

    if 'novelCurrentChapterIndices' in updates and updated_data.get('allowCrossPartitionHistoryAccess'):
        chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
        chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
        partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
        
        for filename in os.listdir(partitions_dir):
            if filename.startswith("partition_") and filename.endswith(".json"):
                other_pid = filename[len("partition_"):-len(".json")]
                if other_pid == partition_id:
                    continue
                
                other_p_data = _load_partition_data(chatroom_path, other_pid)
                if other_p_data.get('allowCrossPartitionHistoryAccess'):
                    def sync_progress(data):
                        data['novelCurrentChapterIndices'] = updates['novelCurrentChapterIndices']
                        return data
                    
                    other_p_file_path = _get_partition_file_path(chatroom_name, other_pid)
                    update_json_file(other_p_file_path, sync_progress)
                    changes.append({
                        "type": "UPDATE_PARTITION",
                        "payload": {
                            "chatroomName": chatroom_name,
                            "partitionId": other_pid,
                            "updates": {'novelCurrentChapterIndices': updates['novelCurrentChapterIndices']}
                        }
                    })

    return jsonify({"success": True, "changes": changes})

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>/history', methods=['POST'])
def add_history_message(chatroom_name, partition_id):
    message = request.get_json()
    if not message or not isinstance(message, dict) or 'id' not in message:
        return create_error_response("INVALID_MESSAGE_DATA", "Invalid or missing message data", 400)

    partition_file_path = _get_partition_file_path(chatroom_name, partition_id)
    updated_data, _ = append_to_list_in_json(partition_file_path, 'history', message)
    
    if updated_data is None:
        return create_error_response("ADD_MESSAGE_FAILED", "Could not read or update partition file.", 500)

    change_payload = {
        "chatroomName": chatroom_name,
        "partitionId": partition_id,
        "message": message
    }
    return jsonify({"success": True, "changes": [{"type": "ADD_HISTORY_MESSAGE", "payload": change_payload}]}), 201

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>/history/<message_id>', methods=['PUT'])
def update_history_message(chatroom_name, partition_id, message_id):
    updates = request.get_json()
    if not isinstance(updates, dict):
        return create_error_response("INVALID_UPDATE_DATA", "Invalid update data", 400)
    
    updates.pop('activeView', None)
    updates.pop('displayMode', None)
    updates.pop('rawJson', None)
    updates.pop('parserError', None)

    def update_message_logic(data):
        if 'history' in data and isinstance(data['history'], list):
            for i, msg in enumerate(data['history']):
                if isinstance(msg, dict) and msg.get('id') == message_id:
                    data['history'][i].update(updates)
                    break
        return data

    partition_file_path = _get_partition_file_path(chatroom_name, partition_id)
    updated_data, _ = update_json_file(partition_file_path, update_message_logic)
    
    if updated_data is None:
        return create_error_response("UPDATE_MESSAGE_FAILED", "Could not read or update partition file.", 500)

    change_payload = {
        "chatroomName": chatroom_name,
        "partitionId": partition_id,
        "messageId": message_id,
        "updates": updates
    }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_HISTORY_MESSAGE", "payload": change_payload}]})

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>/history/<message_id>', methods=['DELETE'])
def delete_history_message(chatroom_name, partition_id, message_id):
    partition_file_path = _get_partition_file_path(chatroom_name, partition_id)
    updated_data, _ = delete_item_in_list_in_json(partition_file_path, 'history', message_id)
    
    if updated_data is None:
        return create_error_response("DELETE_MESSAGE_FAILED", "Could not read or update partition file.", 500)

    change_payload = {
        "chatroomName": chatroom_name,
        "partitionId": partition_id,
        "messageId": message_id
    }
    return jsonify({"success": True, "changes": [{"type": "DELETE_HISTORY_MESSAGE", "payload": change_payload}]})

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>/history/delete_from', methods=['POST'])
def delete_history_from(chatroom_name, partition_id):
    data = request.get_json() or {}
    message_id = data.get('message_id')
    if not message_id:
        return create_error_response("MISSING_MESSAGE_ID", "Missing message_id to delete from", 400)

    def delete_from_message(data):
        if 'history' in data and isinstance(data['history'], list):
            for i, msg in enumerate(data['history']):
                if isinstance(msg, dict) and msg.get('id') == message_id:
                    data['history'] = data['history'][:i]
                    break
        return data

    partition_file_path = _get_partition_file_path(chatroom_name, partition_id)
    updated_data, _ = update_json_file(partition_file_path, delete_from_message)
    if updated_data is None:
        return create_error_response("DELETE_FROM_FAILED", "Could not read or update partition file.", 500)

    change_payload = {
        "chatroomName": chatroom_name,
        "partitionId": partition_id,
        "newHistory": updated_data.get('history', [])
    }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_PARTITION_HISTORY", "payload": change_payload}]})

@partition_management_bp.route('/chatrooms/<chatroom_name>/partitions/<partition_id>', methods=['DELETE'])
def delete_partition(chatroom_name, partition_id):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not os.path.isdir(chatroom_path):
        return create_error_response("CHATROOM_NOT_FOUND", "Chatroom not found", 404)

    partition_file = _get_partition_file_path(chatroom_name, partition_id)
    os.remove(partition_file)
    
    main_config_path = os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME)

    def update_main_config(data):
        data = _ensure_config_structure(data, default_chatroom_config)
        if 'partitionsOrder' in data and isinstance(data['partitionsOrder'], list) and partition_id in data['partitionsOrder']:
            data["partitionsOrder"].remove(partition_id)
        if data.get("activePartitionId") == partition_id:
            data["activePartitionId"] = data["partitionsOrder"][0] if data.get("partitionsOrder") else None
        return data

    updated_data, _ = update_json_file(main_config_path, update_main_config)
    
    changes = [
        {"type": "DELETE_PARTITION", "payload": {"chatroomName": chatroom_name, "partitionId": partition_id}},
        {"type": "UPDATE_CHATROOM_CONFIG", "payload": {"chatroomName": chatroom_name, "updates": {"partitionsOrder": updated_data["partitionsOrder"], "activePartitionId": updated_data["activePartitionId"]}}}
    ]
    return jsonify({"success": True, "changes": changes})