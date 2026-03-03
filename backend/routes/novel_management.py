from flask import Blueprint, request, jsonify
import os
import json
import sys
import traceback
from backend.services.config_io import (
    CHATROOMS_DIR, NOVELS_SUBDIR, _load_partition_data, _save_partition_data,
    PARTITIONS_SUBDIR, CHATROOM_CONFIG_FILENAME,
    read_json_safely, write_json_safely, update_json_file
)
from backend.services.config_definitions import default_partition_config
from backend.services.file_processing import process_novel_content, filter_chapters_by_keywords
from backend.utils.path_utils import is_safe_path, create_error_response

novel_management_bp = Blueprint('novel_management_bp', __name__)


@novel_management_bp.route('/novels/<chatroom_name>', methods=['POST'])
def create_novel(chatroom_name):
    novel_data = request.json
    novel_id = novel_data.get('id') if isinstance(novel_data, dict) else None
    novel_name = novel_data.get('name') if isinstance(novel_data, dict) else None
    novel_toc = novel_data.get('toc', []) if isinstance(novel_data, dict) else []
    novel_encoding = novel_data.get('encoding', 'utf-8') if isinstance(novel_data, dict) else 'utf-8'

    if not novel_id or not isinstance(novel_id, str) or '..' in novel_id or '/' in novel_id or '\\' in novel_id:
        return create_error_response("INVALID_NOVEL_ID", "Invalid or missing novel ID", 400)
    if not novel_name:
        novel_name = f"Novel_{novel_id[:8]}"

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    novels_dir_for_room = os.path.abspath(os.path.join(chatroom_path, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir_for_room, f"{novel_id}.json"))

    os.makedirs(novels_dir_for_room, exist_ok=True)

    if os.path.exists(novel_file_path):
        return create_error_response("NOVEL_ID_EXISTS", "Novel ID already exists", 409)

    novel_definition = {
        "id": novel_id,
        "name": novel_name,
        "toc": novel_toc,
        "encoding": novel_encoding
    }
    try:
        write_json_safely(novel_file_path, novel_definition)
        change_payload = {"chatroomName": chatroom_name, "novel": novel_definition}
        return jsonify({"success": True, "changes": [{"type": "CREATE_NOVEL", "payload": change_payload}]}), 201
    except Exception as e:
        return create_error_response("CREATE_NOVEL_FILE_FAILED", f"Failed to create novel file: {e}", 500)


@novel_management_bp.route('/novels/<chatroom_name>/<novel_id>/process', methods=['POST'])
def upload_and_process_novel(chatroom_name, novel_id):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    novels_dir_for_room = os.path.abspath(os.path.join(chatroom_path, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir_for_room, f"{novel_id}.json"))

    if not os.path.exists(novel_file_path):
        return create_error_response("NOVEL_NOT_FOUND", "Novel not found for processing", 404)

    file_bytes = request.data
    if not file_bytes:
        return create_error_response("MISSING_CONTENT", "Missing novel content", 400)

    keywords_str = request.args.get('keywords', '')

    detected_encoding = 'utf-8'
    try:
        file_bytes.decode('utf-8')
    except UnicodeDecodeError:
        detected_encoding = 'gbk'

    try:
        content = file_bytes.decode(detected_encoding, errors='replace')
        toc_entries = process_novel_content(content)

        if keywords_str:
            keywords = [k.strip() for k in keywords_str.split(',') if k.strip()]
            if keywords:
                toc_entries = filter_chapters_by_keywords(toc_entries, keywords)

        def update_novel_data(data):
            data['toc'] = toc_entries
            data['encoding'] = detected_encoding
            return data

        updated_data, _ = update_json_file(novel_file_path, update_novel_data)
        change_payload = {"chatroomName": chatroom_name, "novelId": novel_id, "updatedNovel": updated_data}
        return jsonify({"success": True, "changes": [{"type": "UPDATE_NOVEL", "payload": change_payload}]})
    except Exception as e:
        return create_error_response("PROCESS_NOVEL_FAILED", f"Failed to process and finalize novel: {e}", 500)


@novel_management_bp.route('/novels/<chatroom_name>/<novel_id>', methods=['PUT'])
def update_novel(chatroom_name, novel_id):
    novel_data_updates = request.json
    if not isinstance(novel_data_updates, dict):
        return create_error_response("INVALID_UPDATE_DATA", "Invalid update data format", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    novels_dir_for_room = os.path.abspath(os.path.join(chatroom_path, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir_for_room, f"{novel_id}.json"))

    if not os.path.exists(novel_file_path):
        return create_error_response("NOVEL_NOT_FOUND", "Novel not found for update", 404)

    updated_toc_entry_data = None

    def update_fields(data):
        nonlocal updated_toc_entry_data
        if 'name' in novel_data_updates:
            data['name'] = novel_data_updates['name']
        if 'toc_entry_update' in novel_data_updates:
            update_info = novel_data_updates['toc_entry_update']
            toc_index = update_info.get('index')
            summary = update_info.get('summary')
            title = update_info.get('title')
            
            if isinstance(toc_index, int) and 0 <= toc_index < len(data.get('toc', [])):
                if summary is not None:
                    data['toc'][toc_index]['summary'] = summary
                if title is not None:
                    data['toc'][toc_index]['title'] = title
                updated_toc_entry_data = data['toc'][toc_index]
        return data

    try:
        updated_data, _ = update_json_file(novel_file_path, update_fields)
        if 'toc_entry_update' in novel_data_updates and updated_toc_entry_data:
            toc_index = novel_data_updates['toc_entry_update'].get('index')
            change_payload = {
                "chatroomName": chatroom_name,
                "novelId": novel_id,
                "tocIndex": toc_index,
                "tocEntry": updated_toc_entry_data
            }
            return jsonify({"success": True, "changes": [{"type": "UPDATE_NOVEL_TOC", "payload": change_payload}]})
        else:
            change_payload = {"chatroomName": chatroom_name, "novelId": novel_id, "updatedNovel": updated_data}
            return jsonify({"success": True, "changes": [{"type": "UPDATE_NOVEL", "payload": change_payload}]})
    except Exception as e:
        return create_error_response("UPDATE_NOVEL_FAILED", f"Failed to update novel file: {e}", 500)


@novel_management_bp.route('/novels/<chatroom_name>/<novel_id>', methods=['DELETE'])
def delete_novel(chatroom_name, novel_id):
    if not novel_id or not isinstance(novel_id, str):
        return create_error_response("INVALID_NOVEL_ID_URL", "Invalid novel ID in URL", 400)

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    novels_dir_for_room = os.path.abspath(os.path.join(chatroom_path, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir_for_room, f"{novel_id}.json"))

    if not os.path.exists(novel_file_path):
        change_payload = {"chatroomName": chatroom_name, "novelId": novel_id}
        return jsonify({"success": True, "changes": [{"type": "DELETE_NOVEL", "payload": change_payload}]})

    try:
        os.remove(novel_file_path)
        partitions_dir_for_room = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
        changes = [{"type": "DELETE_NOVEL", "payload": {"chatroomName": chatroom_name, "novelId": novel_id}}]
        if os.path.isdir(partitions_dir_for_room):
            for filename in os.listdir(partitions_dir_for_room):
                if filename.startswith("partition_") and filename.endswith(".json"):
                    part_id = filename[len("partition_"):-len(".json")]
                    part_file_path = os.path.join(partitions_dir_for_room, filename)

                    def remove_novel_from_partition(data):
                        changed = False
                        if isinstance(data.get('activeNovelIds'), list) and novel_id in data['activeNovelIds']:
                            data['activeNovelIds'].remove(novel_id)
                            changed = True
                        if isinstance(data.get('novelCurrentChapterIndices'), dict) and novel_id in data['novelCurrentChapterIndices']:
                            del data['novelCurrentChapterIndices'][novel_id]
                            changed = True
                        return data
                    
                    try:
                        updated_partition_data, was_changed = update_json_file(part_file_path, remove_novel_from_partition)
                        if was_changed:
                            partition_change = {
                                "type": "UPDATE_PARTITION",
                                "payload": {
                                    "chatroomName": chatroom_name,
                                    "partitionId": part_id,
                                    "updates": {
                                        "activeNovelIds": updated_partition_data.get('activeNovelIds'),
                                        "novelCurrentChapterIndices": updated_partition_data.get('novelCurrentChapterIndices')
                                    }
                                }
                            }
                            changes.append(partition_change)
                    except Exception as e_part_update:
                        pass
        return jsonify({"success": True, "changes": changes})
    except Exception as e:
        return create_error_response("DELETE_NOVEL_FAILED", f"Failed to delete novel: {e}", 500)


@novel_management_bp.route('/novels/<chatroom_name>/<novel_id>/replace', methods=['POST'])
def replace_novel_content(chatroom_name, novel_id):
    data = request.json
    search_term = data.get('search_term')
    replace_term = data.get('replace_term')

    if not search_term:
        return create_error_response("MISSING_TERM", "Search term is required", 400)
    if replace_term is None: 
        replace_term = ""

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    novels_dir_for_room = os.path.abspath(os.path.join(chatroom_path, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir_for_room, f"{novel_id}.json"))

    if not os.path.exists(novel_file_path):
        return create_error_response("NOVEL_NOT_FOUND", "Novel not found", 404)

    def do_replace(novel_data):
        if 'name' in novel_data and isinstance(novel_data['name'], str):
            novel_data['name'] = novel_data['name'].replace(search_term, replace_term)
        
        if 'toc' in novel_data and isinstance(novel_data['toc'], list):
            for chapter in novel_data['toc']:
                if not isinstance(chapter, dict): continue
                
                if 'title' in chapter and isinstance(chapter['title'], str):
                    chapter['title'] = chapter['title'].replace(search_term, replace_term)
                
                if 'content' in chapter and isinstance(chapter['content'], str):
                    chapter['content'] = chapter['content'].replace(search_term, replace_term)
                
                if 'summary' in chapter and isinstance(chapter['summary'], str):
                    chapter['summary'] = chapter['summary'].replace(search_term, replace_term)
        
        return novel_data

    try:
        updated_data, changed = update_json_file(novel_file_path, do_replace)
        
        if changed:
            change_payload = {"chatroomName": chatroom_name, "novelId": novel_id, "updatedNovel": updated_data}
            return jsonify({"success": True, "changes": [{"type": "UPDATE_NOVEL", "payload": change_payload}]})
        else:
            return jsonify({"success": True, "message": "No changes made."})

    except Exception as e:
        return create_error_response("REPLACE_FAILED", f"Failed to replace content: {e}", 500)