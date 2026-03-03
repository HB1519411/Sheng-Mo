from flask import Blueprint, request, jsonify
from backend.services.knowledge_base_io import (
    get_knowledge_groups,
    get_knowledge_group_entries,
    create_knowledge_group,
    delete_knowledge_group,
    rename_knowledge_group,
    add_knowledge_entry,
    update_knowledge_entry,
    delete_knowledge_entry
)
from backend.utils.path_utils import create_error_response
import uuid

knowledge_base_bp = Blueprint('knowledge_base_bp', __name__)

@knowledge_base_bp.route('/knowledge-groups', methods=['GET'])
def list_knowledge_groups():
    try:
        groups = get_knowledge_groups()
        return jsonify({"success": True, "data": groups})
    except Exception as e:
        return create_error_response("LIST_GROUPS_FAILED", f"Failed to list knowledge groups: {e}", 500)

@knowledge_base_bp.route('/knowledge-groups', methods=['POST'])
def handle_create_knowledge_group():
    data = request.get_json()
    group_name = data.get('group_name')
    if not group_name:
        return create_error_response("MISSING_GROUP_NAME", "Group name is required", 400)
    try:
        create_knowledge_group(group_name)
        change_payload = {"groupName": group_name}
        return jsonify({"success": True, "changes": [{"type": "CREATE_KNOWLEDGE_GROUP", "payload": change_payload}]}), 201
    except FileExistsError:
        return create_error_response("GROUP_EXISTS", f"Knowledge group '{group_name}' already exists", 409)
    except Exception as e:
        return create_error_response("CREATE_GROUP_FAILED", f"Failed to create knowledge group: {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>', methods=['DELETE'])
def handle_delete_knowledge_group(group_name):
    try:
        delete_knowledge_group(group_name)
        change_payload = {"groupName": group_name}
        return jsonify({"success": True, "changes": [{"type": "DELETE_KNOWLEDGE_GROUP", "payload": change_payload}]})
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except Exception as e:
        return create_error_response("DELETE_GROUP_FAILED", f"Failed to delete knowledge group: {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>', methods=['PUT'])
def handle_rename_knowledge_group(group_name):
    data = request.get_json()
    new_name = data.get('new_name')
    if not new_name:
        return create_error_response("MISSING_NEW_NAME", "New group name is required", 400)
    try:
        rename_knowledge_group(group_name, new_name)
        change_payload = {"oldName": group_name, "newName": new_name}
        return jsonify({"success": True, "changes": [{"type": "RENAME_KNOWLEDGE_GROUP", "payload": change_payload}]})
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except FileExistsError:
        return create_error_response("GROUP_EXISTS", f"Knowledge group '{new_name}' already exists", 409)
    except Exception as e:
        return create_error_response("RENAME_GROUP_FAILED", f"Failed to rename knowledge group: {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>', methods=['GET'])
def get_group_entries(group_name):
    try:
        entries = get_knowledge_group_entries(group_name)
        return jsonify({"success": True, "data": entries})
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except Exception as e:
        return create_error_response("GET_ENTRIES_FAILED", f"Failed to get entries for group '{group_name}': {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>/entries', methods=['POST'])
def handle_add_entry(group_name):
    entry_data = request.get_json()
    if not entry_data or 'name' not in entry_data or 'content' not in entry_data:
        return create_error_response("INVALID_ENTRY_DATA", "Entry data must include name and content", 400)
    
    entry_data['id'] = str(uuid.uuid4())
    entry_data.setdefault('keywords', [])

    try:
        add_knowledge_entry(group_name, entry_data)
        change_payload = {"groupName": group_name, "entry": entry_data}
        return jsonify({"success": True, "changes": [{"type": "ADD_KNOWLEDGE_ENTRY", "payload": change_payload}]}), 201
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except Exception as e:
        return create_error_response("ADD_ENTRY_FAILED", f"Failed to add entry to group '{group_name}': {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>/entries/<entry_id>', methods=['PUT'])
def handle_update_entry(group_name, entry_id):
    entry_data = request.get_json()
    if not entry_data or 'id' not in entry_data or entry_data['id'] != entry_id:
        return create_error_response("INVALID_ENTRY_DATA", "Invalid entry data or mismatched ID", 400)

    try:
        update_knowledge_entry(group_name, entry_id, entry_data)
        change_payload = {"groupName": group_name, "entry": entry_data}
        return jsonify({"success": True, "changes": [{"type": "UPDATE_KNOWLEDGE_ENTRY", "payload": change_payload}]})
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except ValueError as ve:
        return create_error_response("ENTRY_NOT_FOUND", str(ve), 404)
    except Exception as e:
        return create_error_response("UPDATE_ENTRY_FAILED", f"Failed to update entry in group '{group_name}': {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/<group_name>/entries/<entry_id>', methods=['DELETE'])
def handle_delete_entry(group_name, entry_id):
    try:
        delete_knowledge_entry(group_name, entry_id)
        change_payload = {"groupName": group_name, "entryId": entry_id}
        return jsonify({"success": True, "changes": [{"type": "DELETE_KNOWLEDGE_ENTRY", "payload": change_payload}]})
    except FileNotFoundError:
        return create_error_response("GROUP_NOT_FOUND", f"Knowledge group '{group_name}' not found", 404)
    except ValueError as ve:
        return create_error_response("ENTRY_NOT_FOUND", str(ve), 404)
    except Exception as e:
        return create_error_response("DELETE_ENTRY_FAILED", f"Failed to delete entry from group '{group_name}': {e}", 500)

@knowledge_base_bp.route('/knowledge-groups/import-parsed-data', methods=['POST'])
def import_knowledge_group_from_parsed_data():
    data = request.get_json()
    if not data:
        return create_error_response("NO_DATA", "No data provided", 400)
    
    group_name = data.get('group_name', '导入的世界书')
    entries = data.get('entries', [])
    
    if not entries:
         return create_error_response("NO_ENTRIES", "没有提供有效的词条数据", 400)

    try:
        import uuid
        import re
        
        existing_groups = [g['name'] for g in get_knowledge_groups()]
        final_group_name = group_name
        counter = 1
        while final_group_name in existing_groups:
            final_group_name = f"{group_name}_{counter}"
            counter += 1
            
        create_knowledge_group(final_group_name)
        
        added_count = 0
        for entry in entries:
            content = entry.get('content', '')
            if not isinstance(content, str):
                continue
            
            content = re.sub(r'<[^>]*>', '', content, flags=re.DOTALL)
            content = content.strip()
            
            if len(content) < 50:
                continue
                
            keys = entry.get('keys', [])
            if not isinstance(keys, list):
                keys = [str(keys)]
                
            new_entry = {
                'id': str(uuid.uuid4()),
                'name': entry.get('name', '未命名条目'),
                'keywords': keys,
                'content': content
            }
            add_knowledge_entry(final_group_name, new_entry)
            added_count += 1
            
        change_payload = {"groupName": final_group_name}
        return jsonify({
            "success": True, 
            "message": f"成功导入了 {added_count} 个知识条目。", 
            "changes": [{"type": "CREATE_KNOWLEDGE_GROUP", "payload": change_payload}]
        })

    except Exception as e:
        return create_error_response("IMPORT_FAILED", f"导入失败: {e}", 500)