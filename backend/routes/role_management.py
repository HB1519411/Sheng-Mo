from flask import Blueprint, request, jsonify
import os
import json
from backend.services.config_io import (
    CHATROOMS_DIR, ROLES_SUBDIR, PARTITIONS_SUBDIR,
    _load_partition_data, write_json_safely
)
from backend.services.config_definitions import default_role_config
from backend.services.chatroom_service import _update_role_in_all_partitions
from backend.utils.path_utils import create_error_response

role_management_bp = Blueprint('role_management_bp', __name__)

def _get_role_file_path(chatroom_name, role_name):
    return os.path.abspath(os.path.join(CHATROOMS_DIR, chatroom_name, ROLES_SUBDIR, f"{role_name}.json"))

@role_management_bp.route('/roles/<chatroom_name>', methods=['POST'])
def create_role(chatroom_name):
    role_data = request.get_json()
    role_name = role_data.get('name')

    if not role_name or '..' in role_name or '/' in role_name or '\\' in role_name:
        return create_error_response("INVALID_ROLE_NAME", "Invalid role name", 400)

    chatroom_path = os.path.join(CHATROOMS_DIR, chatroom_name)
    role_file_path = os.path.join(chatroom_path, ROLES_SUBDIR, f"{role_name}.json")
    os.makedirs(os.path.dirname(role_file_path), exist_ok=True)

    was_existing = os.path.exists(role_file_path)

    new_role_definition = {**default_role_config, **role_data, "name": role_name}

    write_json_safely(role_file_path, new_role_definition)
    
    change_payload = { "chatroomName": chatroom_name, "role": new_role_definition }
    return jsonify({"success": True, "changes": [{"type": "UPSERT_ROLE", "payload": change_payload}]}), 200 if was_existing else 201

@role_management_bp.route('/roles/<chatroom_name>/<role_name>', methods=['PUT'])
def update_role(chatroom_name, role_name):
    updates = request.get_json()
    new_name = updates.get('name')

    if new_name and ('..' in new_name or '/' in new_name or '\\' in new_name):
        return create_error_response("INVALID_NEW_ROLE_NAME", "Invalid characters in new role name", 400)

    chatroom_path = os.path.join(CHATROOMS_DIR, chatroom_name)
    role_file_path = os.path.join(chatroom_path, ROLES_SUBDIR, f"{role_name}.json")

    with open(role_file_path, 'r', encoding='utf-8') as f:
        current_role_data = json.load(f)

    original_name_before_update = current_role_data.get('name', role_name)
    current_role_data.update(updates)

    changes = []
    if new_name and new_name != role_name:
        new_file_path = os.path.join(chatroom_path, ROLES_SUBDIR, f"{new_name}.json")
        if os.path.exists(new_file_path):
            return create_error_response("NEW_ROLE_NAME_EXISTS", "New role name already exists", 409)

        write_json_safely(new_file_path, current_role_data)
        os.remove(role_file_path)
        
        _update_role_in_all_partitions(chatroom_path, "rename", role_name, new_name)
        
        changes.append({"type": "DELETE_ROLE", "payload": {"chatroomName": chatroom_name, "roleName": original_name_before_update}})
        changes.append({"type": "UPSERT_ROLE", "payload": {"chatroomName": chatroom_name, "role": current_role_data}})

        partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
        if os.path.isdir(partitions_dir):
            for filename in os.listdir(partitions_dir):
                if filename.startswith("partition_") and filename.endswith(".json"):
                    partition_id = filename[len("partition_"):-len(".json")]
                    part_data = _load_partition_data(chatroom_path, partition_id)
                    changes.append({"type": "UPDATE_PARTITION", "payload": {"chatroomName": chatroom_name, "partitionId": partition_id, "updates": {"roleAliases": part_data.get('roleAliases', [])}}})
    else:
        write_json_safely(role_file_path, current_role_data)
        change_payload = { "chatroomName": chatroom_name, "roleName": original_name_before_update, "updatedRole": current_role_data }
        changes.append({"type": "UPDATE_ROLE", "payload": change_payload})

    return jsonify({"success": True, "changes": changes})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>', methods=['DELETE'])
def delete_role(chatroom_name, role_name):
    chatroom_path = os.path.join(CHATROOMS_DIR, chatroom_name)
    role_file_path = os.path.join(chatroom_path, ROLES_SUBDIR, f"{role_name}.json")

    try:
        os.remove(role_file_path)
    except FileNotFoundError:
        pass

    _update_role_in_all_partitions(chatroom_path, "delete", role_name)
    
    changes = [{"type": "DELETE_ROLE", "payload": { "chatroomName": chatroom_name, "roleName": role_name }}]
    
    partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    if os.path.isdir(partitions_dir):
        for filename in os.listdir(partitions_dir):
            if filename.startswith("partition_") and filename.endswith(".json"):
                partition_id = filename[len("partition_"):-len(".json")]
                part_data = _load_partition_data(chatroom_path, partition_id)
                changes.append({"type": "UPDATE_PARTITION", "payload": {"chatroomName": chatroom_name, "partitionId": part_data['id'], "updates": {"roleAliases": part_data.get('roleAliases', [])}}})

    return jsonify({"success": True, "changes": changes})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory_only', methods=['PUT'])
def update_role_memory_only(chatroom_name, role_name):
    new_memory = request.get_json().get('memory', [])
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    role_data['memory'] = new_memory
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "updatedRole": {"memory": new_memory} }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory', methods=['POST'])
def add_memory(chatroom_name, role_name):
    memory_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)

    memories = role_data.setdefault('memory', [])
    time_to_match = memory_item.get('time')
    merged = False

    if time_to_match:
        for item in memories:
            if item.get('time') == time_to_match:
                item['content'] = f"{item.get('content', '')}\n\n{memory_item.get('content', '')}".strip()
                if memory_item.get('details'):
                    item['details'] = f"{item.get('details', '')}\n\n{memory_item.get('details')}".strip()
                if memory_item.get('isPinned'):
                    item['isPinned'] = True
                memory_item = item
                merged = True
                break
                
    if not merged:
        memories.append(memory_item)

    write_json_safely(role_file_path, role_data)
    
    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryItem": memory_item }
    return jsonify({"success": True, "changes": [{"type": "UPSERT_ROLE_MEMORY", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory/<item_id>', methods=['PUT'])
def update_memory(chatroom_name, role_name, item_id):
    updated_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    for i, item in enumerate(role_data.get('memory', [])):
        if item.get('id') == item_id:
            role_data['memory'][i] = updated_item
            break
            
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryId": item_id, "memoryItem": updated_item }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE_MEMORY", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory/<item_id>', methods=['DELETE'])
def delete_memory(chatroom_name, role_name, item_id):
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    role_data['memory'] = [i for i in role_data.get('memory', []) if i.get('id') != item_id]
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryId": item_id }
    return jsonify({"success": True, "changes": [{"type": "DELETE_ROLE_MEMORY", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info', methods=['POST'])
def add_public_info(chatroom_name, role_name):
    info_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    role_data.setdefault('publicInfo', []).append(info_item)
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoItem": info_item }
    return jsonify({"success": True, "changes": [{"type": "ADD_ROLE_PUBLIC_INFO", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info/<item_id>', methods=['PUT'])
def update_public_info(chatroom_name, role_name, item_id):
    updated_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    for i, item in enumerate(role_data.get('publicInfo', [])):
        if item.get('id') == item_id:
            role_data['publicInfo'][i] = updated_item
            break
            
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoId": item_id, "infoItem": updated_item }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE_PUBLIC_INFO", "payload": change_payload}]})

@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info/<item_id>', methods=['DELETE'])
def delete_public_info(chatroom_name, role_name, item_id):
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    with open(role_file_path, 'r', encoding='utf-8') as f:
        role_data = json.load(f)
        
    role_data['publicInfo'] = [i for i in role_data.get('publicInfo', []) if i.get('id') != item_id]
    write_json_safely(role_file_path, role_data)

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoId": item_id }
    return jsonify({"success": True, "changes": [{"type": "DELETE_ROLE_PUBLIC_INFO", "payload": change_payload}]})