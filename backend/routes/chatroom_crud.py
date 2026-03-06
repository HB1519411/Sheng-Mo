from flask import Blueprint, request, jsonify
import os
import json
import shutil
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, ROLES_SUBDIR, NOVELS_SUBDIR, PARTITIONS_SUBDIR, EVENTS_SUBDIR,
    load_current_config, save_current_config, _save_chatroom_main_config,
    _create_default_partition, read_json_safely, write_json_safely
)
from backend.services.config_definitions import default_chatroom_config
from backend.services.chatroom_service import get_full_chatroom_details
from backend.utils.path_utils import create_error_response

chatroom_crud_bp = Blueprint('chatroom_crud_bp', __name__)

@chatroom_crud_bp.route('/chatroom-details/<chatroom_name>', methods=['GET'])
def get_chatroom_details(chatroom_name):
    details = get_full_chatroom_details(chatroom_name)
    if details is None:
        return create_error_response("CHATROOM_NOT_FOUND", "Chatroom not found", 404)
    return jsonify({"success": True, "data": details})

@chatroom_crud_bp.route('/create-chatroom', methods=['POST'])
def create_chatroom():
    data = request.get_json() or {}
    new_name = data.get('chatroom_name')

    if not new_name or not isinstance(new_name, str) or '..' in new_name or '/' in new_name or '\\' in new_name:
        return create_error_response("INVALID_CHATROOM_NAME", "Invalid chatroom name", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    new_room_path = os.path.abspath(os.path.join(chatrooms_dir, new_name))

    if os.path.exists(new_room_path):
        return create_error_response("CHATROOM_EXISTS", "Chatroom name already exists", 409)

    os.makedirs(os.path.join(new_room_path, ROLES_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(new_room_path, NOVELS_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(new_room_path, PARTITIONS_SUBDIR), exist_ok=True)
    os.makedirs(os.path.join(new_room_path, EVENTS_SUBDIR), exist_ok=True)

    initial_main_config_obj = json.loads(json.dumps(default_chatroom_config))
    initial_main_config_obj["name"] = new_name

    new_partition_data = _create_default_partition(new_room_path, initial_main_config_obj, chatroom_name_for_partition_name=new_name)

    _save_chatroom_main_config(new_name, initial_main_config_obj)

    config = load_current_config()
    if new_name not in config['chatRoomOrder']:
        config['chatRoomOrder'].append(new_name)
    if 'activePartitionIdByChatroom' not in config:
        config['activePartitionIdByChatroom'] = {}
    config['activePartitionIdByChatroom'][new_name] = initial_main_config_obj.get('activePartitionId')
    save_current_config(config)

    change_payload = {
        "name": new_name,
        "config": initial_main_config_obj,
        "partitions": [new_partition_data],
        "roles": [],
        "novels": [],
        "events": [],
        "globalConfig": config
    }
    return jsonify({"success": True, "changes": [{"type": "CREATE_CHATROOM", "payload": change_payload}]}), 201

@chatroom_crud_bp.route('/delete-chatroom/<chatroom_name>', methods=['DELETE'])
def delete_chatroom(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    room_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not os.path.isdir(room_path):
        return create_error_response("CHATROOM_NOT_FOUND", "Chatroom not found", 404)

    shutil.rmtree(room_path)
    config = load_current_config()
    new_active_chatroom_name = None
    
    if chatroom_name in config['chatRoomOrder']:
        config['chatRoomOrder'].remove(chatroom_name)
    
    if config.get('activeChatRoomName') == chatroom_name:
        new_active_chatroom_name = config['chatRoomOrder'][0] if config['chatRoomOrder'] else None
        config['activeChatRoomName'] = new_active_chatroom_name
    
    if chatroom_name in config.get('activePartitionIdByChatroom', {}):
        del config['activePartitionIdByChatroom'][chatroom_name]
        
    save_current_config(config)

    change_payload = {
        "chatroomName": chatroom_name,
        "newActiveChatroomName": new_active_chatroom_name,
        "globalConfig": config
    }
    return jsonify({"success": True, "changes": [{"type": "DELETE_CHATROOM", "payload": change_payload}]})

@chatroom_crud_bp.route('/rename-chatroom/<old_name>', methods=['PUT'])
def rename_chatroom(old_name):
    data = request.get_json() or {}
    new_name = data.get('new_name')

    if not new_name or not isinstance(new_name, str) or '..' in new_name or '/' in new_name or '\\' in new_name:
        return create_error_response("INVALID_NEW_NAME", "Invalid new chatroom name", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    old_path = os.path.abspath(os.path.join(chatrooms_dir, old_name))
    new_path = os.path.abspath(os.path.join(chatrooms_dir, new_name))

    if not os.path.isdir(old_path):
        return create_error_response("OLD_CHATROOM_NOT_FOUND", "Old chatroom not found", 404)
    if os.path.exists(new_path):
        return create_error_response("NEW_NAME_EXISTS", "New chatroom name already exists", 409)

    os.rename(old_path, new_path)
    
    main_config_file = os.path.join(new_path, CHATROOM_CONFIG_FILENAME)
    if os.path.exists(main_config_file):
        room_config_loaded = read_json_safely(main_config_file)
        if room_config_loaded:
            room_config_loaded['name'] = new_name
            write_json_safely(main_config_file, room_config_loaded)

    config = load_current_config()
    if old_name in config['chatRoomOrder']:
        idx = config['chatRoomOrder'].index(old_name)
        config['chatRoomOrder'][idx] = new_name

    if config.get('activeChatRoomName') == old_name:
        config['activeChatRoomName'] = new_name

    if old_name in config.get('activePartitionIdByChatroom', {}):
        config['activePartitionIdByChatroom'][new_name] = config['activePartitionIdByChatroom'].pop(old_name)

    save_current_config(config)

    change_payload = {
        "oldName": old_name,
        "newName": new_name,
        "globalConfig": config
    }
    return jsonify({"success": True, "changes": [{"type": "RENAME_CHATROOM", "payload": change_payload}]})