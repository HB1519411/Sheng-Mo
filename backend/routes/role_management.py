from flask import Blueprint, request, jsonify
import os
import json
import sys
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, ROLES_SUBDIR, PARTITIONS_SUBDIR,
    _ensure_config_structure,
    _load_partition_data, _save_partition_data, _save_chatroom_main_config,
    read_json_safely, write_json_safely, append_to_list_in_json,
    update_item_in_list_in_json, delete_item_in_list_in_json, update_json_file
)
from backend.services.config_definitions import default_chatroom_config, default_role_config
from backend.services.chatroom_service import _update_role_in_all_partitions, get_world_snapshot
from backend.utils.path_utils import is_safe_path, create_error_response


role_management_bp = Blueprint('role_management_bp', __name__)


@role_management_bp.route('/roles/<chatroom_name>', methods=['POST'])
def create_role(chatroom_name):
    role_data = request.get_json()
    if not role_data:
        return create_error_response("INVALID_REQUEST_DATA", "Invalid request data", 400)
    role_name = role_data.get('name') if isinstance(role_data, dict) else None

    if not role_name or not isinstance(role_name, str) or '..' in role_name or '/' in role_name or '\\' in role_name:
        return create_error_response("INVALID_ROLE_NAME", "Invalid role name", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    roles_dir_for_room = os.path.abspath(os.path.join(chatroom_path, ROLES_SUBDIR))
    role_file_path = os.path.abspath(os.path.join(roles_dir_for_room, f"{role_name}.json"))

    os.makedirs(roles_dir_for_room, exist_ok=True)

    was_existing = os.path.exists(role_file_path)

    new_role_definition = json.loads(json.dumps(default_role_config))
    new_role_definition["name"] = role_name

    for key in default_role_config.keys():
        if key in role_data:
            if key == "memory" and not isinstance(role_data[key], list):
                new_role_definition[key] = []
            elif key == "publicInfo" and not isinstance(role_data[key], list):
                new_role_definition[key] = []
            elif key == "archetypes" and not isinstance(role_data[key], list):
                new_role_definition[key] = []
            elif key == "keywords" and not isinstance(role_data[key], list):
                new_role_definition[key] = []
            else:
                new_role_definition[key] = role_data[key]

    try:
        write_json_safely(role_file_path, new_role_definition)
        change_payload = { "chatroomName": chatroom_name, "role": new_role_definition }
        changes = [{"type": "UPSERT_ROLE", "payload": change_payload}]
        
        return jsonify({"success": True, "changes": changes}), 200 if was_existing else 201
    except Exception as e:
        if not was_existing and os.path.exists(role_file_path):
            try:
                os.remove(role_file_path)
            except:
                pass
        return create_error_response("CREATE_ROLE_FAILED", f"Failed to create or update role file: {e}", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>', methods=['PUT'])
def update_role(chatroom_name, role_name):
    updates = request.get_json()
    if not updates or not isinstance(updates, dict):
        return create_error_response("INVALID_REQUEST_DATA", "Invalid request data", 400)

    new_name = updates.get('name')

    if new_name and ('..' in new_name or '/' in new_name or '\\' in new_name):
        return create_error_response("INVALID_NEW_ROLE_NAME", "Invalid characters in new role name", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    roles_dir_for_room = os.path.abspath(os.path.join(chatroom_path, ROLES_SUBDIR))
    role_file_path = os.path.abspath(os.path.join(roles_dir_for_room, f"{role_name}.json"))

    if not os.path.exists(role_file_path):
        return create_error_response("ROLE_NOT_FOUND", "Role not found", 404)

    try:
        current_role_data = read_json_safely(role_file_path)
        if current_role_data is None:
            return create_error_response("READ_ROLE_FAILED", f"Failed to read existing role file", 500)
        
        changes = []
        original_name_before_update = current_role_data.get('name', role_name)

        for key, value in updates.items():
            current_role_data[key] = value

        if new_name and new_name != role_name:
            current_role_data['name'] = new_name
            new_file_path = os.path.abspath(os.path.join(roles_dir_for_room, f"{new_name}.json"))
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
                        if part_data:
                            changes.append({"type": "UPDATE_PARTITION", "payload": {"chatroomName": chatroom_name, "partitionId": partition_id, "updates": {"roleAliases": part_data.get('roleAliases', [])}}})

        else:
            write_json_safely(role_file_path, current_role_data)
            change_payload = { "chatroomName": chatroom_name, "roleName": original_name_before_update, "updatedRole": current_role_data }
            changes.append({"type": "UPDATE_ROLE", "payload": change_payload})

        return jsonify({"success": True, "changes": changes})
    except Exception as e:
        return create_error_response("UPDATE_ROLE_FAILED", f"Failed to update role: {e}", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>', methods=['DELETE'])
def delete_role(chatroom_name, role_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    roles_dir_for_room = os.path.abspath(os.path.join(chatroom_path, ROLES_SUBDIR))
    role_file_path = os.path.abspath(os.path.join(roles_dir_for_room, f"{role_name}.json"))

    change_payload = { "chatroomName": chatroom_name, "roleName": role_name }
    changes = [{"type": "DELETE_ROLE", "payload": change_payload}]

    if not os.path.exists(role_file_path):
        return jsonify({"success": True, "changes": changes})

    try:
        os.remove(role_file_path)
        _update_role_in_all_partitions(chatroom_path, "delete", role_name)
        
        updated_partitions = []
        partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
        if os.path.isdir(partitions_dir):
            for filename in os.listdir(partitions_dir):
                if filename.startswith("partition_") and filename.endswith(".json"):
                    partition_id = filename[len("partition_"):-len(".json")]
                    part_data = _load_partition_data(chatroom_path, partition_id)
                    if part_data:
                        updated_partitions.append(part_data)
        for part in updated_partitions:
            changes.append({"type": "UPDATE_PARTITION", "payload": {"chatroomName": chatroom_name, "partitionId": part['id'], "updates": {"roleAliases": part['roleAliases']}}})


        return jsonify({"success": True, "changes": changes})
    except Exception as e:
        return create_error_response("DELETE_ROLE_FAILED", f"Failed to delete role: {e}", 500)


def _get_role_file_path(chatroom_name, role_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    roles_dir_for_room = os.path.abspath(os.path.join(chatroom_path, ROLES_SUBDIR))
    return os.path.abspath(os.path.join(roles_dir_for_room, f"{role_name}.json"))


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory_only', methods=['PUT'])
def update_role_memory_only(chatroom_name, role_name):
    data = request.get_json()
    new_memory = data.get('memory')
    if not isinstance(new_memory, list):
        return create_error_response("INVALID_MEMORY_DATA", "Memory data must be a list.", 400)

    def update_memory(role_data):
        role_data['memory'] = new_memory
        return role_data

    try:
        role_file_path = _get_role_file_path(chatroom_name, role_name)
        updated_data, changed = update_json_file(role_file_path, update_memory)
        if updated_data is None:
            return create_error_response("ROLE_NOT_FOUND_OR_CORRUPT", "Role not found or could not be read.", 404)

        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "updatedRole": {"memory": new_memory} }
        return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE", "payload": change_payload}]})
    except Exception as e:
        return create_error_response("UPDATE_MEMORY_ONLY_FAILED", f"Failed to update role memory: {e}", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory', methods=['POST'])
def add_memory(chatroom_name, role_name):
    memory_item = request.get_json()
    if not memory_item or 'id' not in memory_item:
        return create_error_response("INVALID_MEMORY_ITEM", "Invalid memory item data", 400)

    role_file_path = _get_role_file_path(chatroom_name, role_name)
    
    def merge_or_append_memory(data):
        if 'memory' not in data or not isinstance(data['memory'], list):
            data['memory'] = []
        time_to_match = memory_item.get('time')
        if time_to_match:
            for existing_item in data['memory']:
                if existing_item.get('time') == time_to_match:
                    # Merge content (summary)
                    existing_item['content'] = f"{existing_item.get('content', '')}\n\n{memory_item.get('content', '')}".strip()
                    
                    # Merge details
                    existing_details = existing_item.get('details', '')
                    new_details = memory_item.get('details', '')
                    if new_details:
                        existing_item['details'] = f"{existing_details}\n\n{new_details}".strip()
                    
                    # Merge pinned status (if new one is pinned, make it pinned)
                    if memory_item.get('isPinned'):
                        existing_item['isPinned'] = True
                        
                    return data, existing_item
        data['memory'].append(memory_item)
        return data, memory_item

    try:
        role_data_before_update = read_json_safely(role_file_path)
        if role_data_before_update is None:
            return create_error_response("READ_ROLE_FAILED", "Failed to read role data for merge check.", 500)
        
        _, final_memory_item = merge_or_append_memory(role_data_before_update.copy())
        
        def update_logic(data):
            data, _ = merge_or_append_memory(data)
            return data
            
        updated_role_data, changed = update_json_file(role_file_path, update_logic)
        
        if updated_role_data is not None:
            change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryItem": final_memory_item }
            return jsonify({"success": True, "changes": [{"type": "UPSERT_ROLE_MEMORY", "payload": change_payload}]})
        else:
            return create_error_response("ADD_MEMORY_FAILED", "Failed to add or merge memory item", 500)
    except Exception as e:
        return create_error_response("ADD_MEMORY_UNEXPECTED_ERROR", f"An unexpected error occurred: {e}", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory/<item_id>', methods=['PUT'])
def update_memory(chatroom_name, role_name, item_id):
    updated_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    updated_role_data, changed = update_item_in_list_in_json(role_file_path, 'memory', item_id, updated_item)

    if updated_role_data is not None:
        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryId": item_id, "memoryItem": updated_item }
        return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE_MEMORY", "payload": change_payload}]})
    else:
        return create_error_response("UPDATE_MEMORY_FAILED", "Failed to update memory item", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/memory/<item_id>', methods=['DELETE'])
def delete_memory(chatroom_name, role_name, item_id):
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    updated_role_data, changed = delete_item_in_list_in_json(role_file_path, 'memory', item_id)
    if updated_role_data is not None:
        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "memoryId": item_id }
        return jsonify({"success": True, "changes": [{"type": "DELETE_ROLE_MEMORY", "payload": change_payload}]})
    else:
        return create_error_response("DELETE_MEMORY_FAILED", "Failed to delete memory item", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info', methods=['POST'])
def add_public_info(chatroom_name, role_name):
    info_item = request.get_json()
    if not info_item or 'id' not in info_item:
        return create_error_response("INVALID_INFO_ITEM", "Invalid public info data", 400)

    role_file_path = _get_role_file_path(chatroom_name, role_name)
    updated_role_data, changed = append_to_list_in_json(role_file_path, 'publicInfo', info_item)

    if updated_role_data is not None:
        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoItem": info_item }
        return jsonify({"success": True, "changes": [{"type": "ADD_ROLE_PUBLIC_INFO", "payload": change_payload}]})
    else:
        return create_error_response("ADD_INFO_FAILED", "Failed to add public info", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info/<item_id>', methods=['PUT'])
def update_public_info(chatroom_name, role_name, item_id):
    updated_item = request.get_json()
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    updated_role_data, changed = update_item_in_list_in_json(role_file_path, 'publicInfo', item_id, updated_item)

    if updated_role_data is not None:
        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoId": item_id, "infoItem": updated_item }
        return jsonify({"success": True, "changes": [{"type": "UPDATE_ROLE_PUBLIC_INFO", "payload": change_payload}]})
    else:
        return create_error_response("UPDATE_INFO_FAILED", "Failed to update public info", 500)


@role_management_bp.route('/roles/<chatroom_name>/<role_name>/public_info/<item_id>', methods=['DELETE'])
def delete_public_info(chatroom_name, role_name, item_id):
    role_file_path = _get_role_file_path(chatroom_name, role_name)
    updated_role_data, changed = delete_item_in_list_in_json(role_file_path, 'publicInfo', item_id)
    if updated_role_data is not None:
        change_payload = { "chatroomName": chatroom_name, "roleName": role_name, "infoId": item_id }
        return jsonify({"success": True, "changes": [{"type": "DELETE_ROLE_PUBLIC_INFO", "payload": change_payload}]})
    else:
        return create_error_response("DELETE_INFO_FAILED", "Failed to delete public info", 500)