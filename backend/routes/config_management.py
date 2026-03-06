from flask import Blueprint, request, jsonify, send_file
import os
import json
import shutil
from datetime import datetime
import io
import zipfile
import re
from backend.services.config_io import (
    CONFIG_DIR, CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME,
    IMAGES_DIR, GENERATED_SUBDIR, PARTITIONS_SUBDIR, MAX_ZIP_SIZE, DEBUG_LOG_FILENAME,
    load_current_config, save_current_config,
    _ensure_config_structure, read_json_safely, write_json_safely, write_to_debug_log
)
from backend.services.config_definitions import default_chatroom_config, default_partition_config
from backend.services.chatroom_service import get_full_chatroom_details
from backend.utils.path_utils import create_error_response
from backend.services.knowledge_base_io import KNOWLEDGE_BASE_DIR

config_management_bp = Blueprint('config_management_bp', __name__)


@config_management_bp.route('/load-initial-data', methods=['GET'])
def load_initial_data():
    global_config = load_current_config()
    active_chatroom_name = global_config.get('activeChatRoomName')
    
    chatroom_details = None
    if active_chatroom_name:
        chatroom_details = get_full_chatroom_details(active_chatroom_name)

    world_snapshot = {
        "globalConfig": global_config,
        "chatroomDetails": chatroom_details
    }
    return jsonify({"success": True, "data": world_snapshot})


@config_management_bp.route('/update-config-fields', methods=['POST'])
def update_config_fields():
    data = request.get_json()
    updates = data.get('updates')
    if not isinstance(updates, dict):
        return create_error_response("INVALID_UPDATE_DATA", "Invalid update data format", 400)

    current_config = load_current_config()
    
    for path, value in updates.items():
        keys = path.split('.')
        d = current_config
        for i, key in enumerate(keys[:-1]):
            array_match = re.match(r'(\w+)\[(\d+)\]', key)
            if array_match:
                array_name, index_str = array_match.groups()
                index = int(index_str)
                if array_name not in d or not isinstance(d[array_name], list):
                    d[array_name] = []
                while len(d[array_name]) <= index:
                    d[array_name].append(None)
                d = d[array_name][index]
            else:
                if key not in d or not isinstance(d[key], dict):
                    d[key] = {}
                d = d[key]

        final_key = keys[-1]
        array_match_final = re.match(r'(\w+)\[(\d+)\]', final_key)
        if array_match_final:
            array_name, index_str = array_match_final.groups()
            index = int(index_str)
            if array_name not in d or not isinstance(d[array_name], list):
                d[array_name] = []
            while len(d[array_name]) <= index:
                d[array_name].append(None)
            d[array_name][index] = value
        else:
            d[final_key] = value

    save_current_config(current_config)
    
    change_payload = { "updates": updates }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_GLOBAL_CONFIG", "payload": change_payload}]})


@config_management_bp.route('/load-config', methods=['GET'])
def load_config_route():
    current_config = load_current_config()
    return jsonify({"success": True, "data": current_config})


@config_management_bp.route('/export-full-config-zip', methods=['GET'])
def export_full_config_zip():
    memory_file = io.BytesIO()
    project_root_abs = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    config_dir_abs = os.path.join(project_root_abs, CONFIG_DIR)
    chatrooms_dir_abs = os.path.join(project_root_abs, CHATROOMS_DIR)
    knowledge_base_dir_abs = os.path.join(project_root_abs, KNOWLEDGE_BASE_DIR)

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.isdir(config_dir_abs):
            for root, dirs, files in os.walk(config_dir_abs):
                for file_name in files:
                    file_path_abs = os.path.join(root, file_name)
                    arcname = os.path.join(CONFIG_DIR, os.path.relpath(file_path_abs, config_dir_abs))
                    zf.write(file_path_abs, arcname)

        if os.path.isdir(chatrooms_dir_abs):
            for item in os.listdir(chatrooms_dir_abs):
                item_path_abs = os.path.join(chatrooms_dir_abs, item)
                if os.path.isdir(item_path_abs):
                    arc_dir_prefix = os.path.join(CHATROOMS_DIR, item)
                    for root, dirs, files in os.walk(item_path_abs):
                        for file_name in files:
                            file_path_abs = os.path.join(root, file_name)
                            arcname = os.path.join(arc_dir_prefix, os.path.relpath(file_path_abs, item_path_abs))
                            zf.write(file_path_abs, arcname)

        if os.path.isdir(knowledge_base_dir_abs):
            for filename in os.listdir(knowledge_base_dir_abs):
                file_path_abs = os.path.join(knowledge_base_dir_abs, filename)
                if os.path.isfile(file_path_abs) and filename.endswith('.json'):
                    arcname = os.path.join(KNOWLEDGE_BASE_DIR, filename)
                    zf.write(file_path_abs, arcname)
                    
        secrets_path_abs = os.path.join(project_root_abs, 'secrets.json')
        if os.path.isfile(secrets_path_abs):
            zf.write(secrets_path_abs, 'secrets.json')

    memory_file.seek(0)
    download_name = f'绳墨_{datetime.now().strftime("%Y%m%d_%H%M")}.zip'
    return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name=download_name)


@config_management_bp.route('/import-full-config-zip', methods=['POST'])
def import_full_config_zip():
    if 'config_zip' not in request.files:
        return create_error_response("NO_UPLOADED_FILE", "No uploaded file found", 400)

    file = request.files['config_zip']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return create_error_response("INVALID_FILE_TYPE", "Invalid file type", 400)

    if file.content_length > MAX_ZIP_SIZE:
        return create_error_response("FILE_TOO_LARGE", f"File too large", 413)

    project_root_abs = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    chatrooms_dir_abs = os.path.join(project_root_abs, CHATROOMS_DIR)
    knowledge_base_dir_abs = os.path.join(project_root_abs, KNOWLEDGE_BASE_DIR)
    config_dir_abs = os.path.join(project_root_abs, CONFIG_DIR)

    if os.path.isdir(config_dir_abs):
        shutil.rmtree(config_dir_abs, ignore_errors=True)
    if os.path.isdir(chatrooms_dir_abs):
        shutil.rmtree(chatrooms_dir_abs, ignore_errors=True)
    if os.path.isdir(knowledge_base_dir_abs):
        shutil.rmtree(knowledge_base_dir_abs, ignore_errors=True)
        
    os.makedirs(config_dir_abs, exist_ok=True)
    os.makedirs(chatrooms_dir_abs, exist_ok=True)
    os.makedirs(knowledge_base_dir_abs, exist_ok=True)

    with zipfile.ZipFile(file.stream, 'r') as zf:
        for member_info in zf.infolist():
            target_path_part = member_info.filename.replace('\\', '/')

            if target_path_part.startswith('/') or '..' in target_path_part:
                continue

            target_filepath_abs = os.path.join(project_root_abs, target_path_part)

            is_in_config_dir = target_path_part.startswith(CONFIG_DIR + '/')
            is_in_chatrooms_dir = target_path_part.startswith(CHATROOMS_DIR + '/')
            is_in_kb_dir = target_path_part.startswith(KNOWLEDGE_BASE_DIR + '/')
            is_secrets_file = target_path_part == 'secrets.json'

            if not (is_in_config_dir or is_in_chatrooms_dir or is_in_kb_dir or is_secrets_file):
                continue

            if member_info.is_dir():
                os.makedirs(target_filepath_abs, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(target_filepath_abs), exist_ok=True)
                with zf.open(member_info) as source, open(target_filepath_abs, "wb") as target:
                    target.write(source.read())

                if target_filepath_abs.endswith(CHATROOM_CONFIG_FILENAME):
                    room_cfg_loaded = read_json_safely(target_filepath_abs)
                    if room_cfg_loaded:
                        room_cfg_ensured = _ensure_config_structure(room_cfg_loaded, default_chatroom_config)
                        if 'name' not in room_cfg_ensured or not room_cfg_ensured['name']:
                            room_cfg_ensured['name'] = os.path.basename(os.path.dirname(target_filepath_abs))
                        write_json_safely(target_filepath_abs, room_cfg_ensured)

                elif PARTITIONS_SUBDIR in target_filepath_abs and target_filepath_abs.endswith(".json"):
                    part_cfg_loaded = read_json_safely(target_filepath_abs)
                    if part_cfg_loaded:
                        part_cfg_ensured = _ensure_config_structure(part_cfg_loaded, default_partition_config)
                        if 'id' not in part_cfg_ensured or not part_cfg_ensured['id']:
                            part_cfg_ensured['id'] = os.path.splitext(os.path.basename(target_filepath_abs))[0].replace('partition_', '')
                        write_json_safely(target_filepath_abs, part_cfg_ensured)

    load_current_config()
    return jsonify({"success": True, "message": "Full configuration imported successfully!"})


@config_management_bp.route('/clear-all-config', methods=['POST'])
def clear_all_config():
    project_root_abs = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    config_dir_path = os.path.join(project_root_abs, CONFIG_DIR)
    chatrooms_dir_path = os.path.join(project_root_abs, CHATROOMS_DIR)
    images_generated_dir_path = os.path.join(project_root_abs, IMAGES_DIR, GENERATED_SUBDIR)
    knowledge_base_dir_path = os.path.join(project_root_abs, KNOWLEDGE_BASE_DIR)
    debug_log_path = os.path.join(project_root_abs, DEBUG_LOG_FILENAME)

    if os.path.isdir(config_dir_path):
        shutil.rmtree(config_dir_path, ignore_errors=True)

    if os.path.isdir(chatrooms_dir_path):
        shutil.rmtree(chatrooms_dir_path, ignore_errors=True)
    os.makedirs(chatrooms_dir_path, exist_ok=True)
    
    if os.path.isdir(knowledge_base_dir_path):
        shutil.rmtree(knowledge_base_dir_path, ignore_errors=True)
    os.makedirs(knowledge_base_dir_path, exist_ok=True)

    if os.path.isdir(images_generated_dir_path):
        shutil.rmtree(images_generated_dir_path, ignore_errors=True)
    os.makedirs(images_generated_dir_path, exist_ok=True)

    if os.path.exists(debug_log_path):
        try:
            with open(debug_log_path, 'w') as f:
                f.write("")
        except Exception:
            pass

    new_default_config = load_current_config()
    
    empty_details = {
        "config": json.loads(json.dumps(default_chatroom_config)),
        "roles": [], "novels": [], "partitions": [], "events": []
    }
    change_payload = {
        "globalConfig": new_default_config,
        "chatroomDetails": empty_details
    }
    return jsonify({"success": True, "changes": [{"type": "RESET_ALL", "payload": change_payload}]})


@config_management_bp.route('/log-client-error', methods=['POST'])
def log_client_error():
    data = request.get_json() or {}
    message = data.get('message', 'No message')
    stack = data.get('stack', 'No stack trace')
    timestamp = datetime.now().isoformat()

    log_content = (
        f"!!! FRONTEND ERROR at {timestamp} !!!\n"
        f"Message: {message}\n"
        f"Stack Trace:\n{stack}\n"
        f"--------------------------------------------------\n\n"
    )
    write_to_debug_log(log_content)
    return jsonify({"success": True})