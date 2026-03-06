from flask import Blueprint, request, jsonify, send_file
import os
import json
import shutil
import uuid
import re
import io
import zipfile
import base64
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, PARTITIONS_SUBDIR,
    _update_chatroom_main_config_fields, MAX_ZIP_SIZE, read_json_safely,
    write_json_safely, _ensure_config_structure,
    load_current_config, save_current_config
)
from backend.services.config_definitions import default_chatroom_config, default_partition_config
from backend.utils.path_utils import create_error_response
from backend.services.prompt_context_builder import calculate_virtual_world_time

chatroom_features_bp = Blueprint('chatroom_features_bp', __name__)

@chatroom_features_bp.route('/update-chatroom-config/<chatroom_name>', methods=['POST'])
def update_chatroom_config(chatroom_name):
    updates = request.get_json()
    if not isinstance(updates, dict):
        return create_error_response("INVALID_UPDATE_DATA", "Invalid update data", 400)
    _update_chatroom_main_config_fields(chatroom_name, updates)
    change_payload = {
        "chatroomName": chatroom_name,
        "updates": updates
    }
    return jsonify({"success": True, "changes": [{"type": "UPDATE_CHATROOM_CONFIG", "payload": change_payload}]})

@chatroom_features_bp.route('/background/<chatroom_name>', methods=['POST'])
def set_background_image(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    os.makedirs(chatroom_path, exist_ok=True)

    image_data_url = None
    file_to_save = None
    file_ext_to_use = None

    if 'image' in request.files:
        file_to_save = request.files['image']
        if file_to_save.filename == '':
            return create_error_response("NO_FILE_SELECTED", "No file selected", 400)
        file_ext_to_use = os.path.splitext(file_to_save.filename)[1].lower().lstrip('.')
    elif request.is_json:
        json_data = request.get_json()
        if json_data and 'imageDataUrl' in json_data:
            image_data_url = json_data['imageDataUrl']
            try:
                header, encoded = image_data_url.split(',', 1)
                mime_match = re.match(r'data:image/(\w+);base64', header)
                if not mime_match:
                    return create_error_response("INVALID_DATA_URL_FORMAT", "Invalid image Data URL format", 400)
                file_ext_to_use = mime_match.group(1).lower()
                if file_ext_to_use == 'jpeg':
                    file_ext_to_use = 'jpg'
                img_data_bytes = base64.b64decode(encoded)
            except Exception as e:
                return create_error_response("PROCESS_DATA_URL_FAILED", f"Failed to process image Data URL: {e}", 500)

    if not file_to_save and not image_data_url:
        return create_error_response("MISSING_IMAGE_DATA", "Missing image file or image data", 400)

    allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    if file_ext_to_use not in allowed_extensions:
        return create_error_response("UNSUPPORTED_FILE_TYPE", f"Unsupported file type: {file_ext_to_use}", 400)

    new_filename = f"background.{file_ext_to_use}"
    filepath = os.path.join(chatroom_path, new_filename)

    for ext_to_remove in allowed_extensions:
        old_bg_path = os.path.join(chatroom_path, f"background.{ext_to_remove}")
        if os.path.exists(old_bg_path) and old_bg_path != filepath:
            try: os.remove(old_bg_path)
            except: pass

    if file_to_save:
        file_to_save.save(filepath)
    else:
        with open(filepath, 'wb') as f:
            f.write(img_data_bytes)

    _update_chatroom_main_config_fields(chatroom_name, {"backgroundImageFilename": new_filename})
    change_payload = {
        "chatroomName": chatroom_name,
        "backgroundImageFilename": new_filename
    }
    return jsonify({"success": True, "changes": [{"type": "SET_BACKGROUND", "payload": change_payload}]})

@chatroom_features_bp.route('/background/<chatroom_name>', methods=['DELETE'])
def delete_background_image(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not os.path.isdir(chatroom_path):
        return jsonify({"success": True, "message": "Chatroom directory not found, nothing to delete"})

    deleted_any = False
    possible_extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif']

    for ext in possible_extensions:
        filepath = os.path.join(chatroom_path, f"background.{ext}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                deleted_any = True
            except Exception: pass

    if deleted_any:
        try: _update_chatroom_main_config_fields(chatroom_name, {"backgroundImageFilename": None})
        except Exception: pass

    change_payload = {"chatroomName": chatroom_name}
    return jsonify({"success": True, "changes": [{"type": "DELETE_BACKGROUND", "payload": change_payload}]})

@chatroom_features_bp.route('/export-chatroom-zip/<chatroom_name>', methods=['GET'])
def export_chatroom_zip(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not os.path.isdir(chatroom_path):
        return create_error_response("CHATROOM_NOT_FOUND", "Chatroom not found or invalid path", 404)

    zip_memory_file = io.BytesIO()
    with zipfile.ZipFile(zip_memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(chatroom_path):
            for file_name in files:
                file_path_abs = os.path.join(root, file_name)
                arcname = os.path.relpath(file_path_abs, chatroom_path)
                zf.write(file_path_abs, arcname)

    zip_bytes = zip_memory_file.getvalue()
    bg_bytes = None
    bg_ext = 'png'
    mimetype = 'image/png'
    possible_extensions = ['png', 'jpg', 'jpeg', 'webp']
    for ext in possible_extensions:
        bg_path = os.path.join(chatroom_path, f"background.{ext}")
        if os.path.exists(bg_path):
            with open(bg_path, 'rb') as f:
                bg_bytes = f.read()
            bg_ext = ext
            mimetype = f'image/{ext}' if ext != 'jpg' else 'image/jpeg'
            break

    if not bg_bytes:
        bg_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xfa\x0f\x00\x01\x05\x01\x02\xcf\xa0.\xcd\x00\x00\x00\x00IEND\xaeB`\x82'

    final_bytes = bg_bytes + zip_bytes
    final_memory_file = io.BytesIO(final_bytes)
    final_memory_file.seek(0)

    download_name = f'{chatroom_name}.{bg_ext}'
    return send_file(final_memory_file, mimetype=mimetype, as_attachment=True, download_name=download_name)

@chatroom_features_bp.route('/import-chatroom-zip', methods=['POST'])
def import_chatroom_zip():
    if 'chatroom_zip' not in request.files:
        return create_error_response("NO_UPLOADED_FILE", "No uploaded file found ('chatroom_zip')", 400)

    file = request.files['chatroom_zip']
    if file.filename == '' or not file.filename.lower().endswith(('.zip', '.png', '.jpg', '.jpeg', '.webp')):
        return create_error_response("INVALID_FILE_TYPE", "No file selected or invalid file type (must be image or .zip)", 400)

    if file.content_length > MAX_ZIP_SIZE:
        return create_error_response("FILE_TOO_LARGE", f"File too large (max {MAX_ZIP_SIZE // 1024 // 1024}MB)", 413)

    chatrooms_dir_abs = os.path.abspath(CHATROOMS_DIR)
    imported_room_name_from_config = None
    final_room_name = None
    temp_extract_dir = os.path.join(chatrooms_dir_abs, f"__import_temp_{uuid.uuid4().hex}__")

    try:
        os.makedirs(temp_extract_dir, exist_ok=True)

        with zipfile.ZipFile(file.stream, 'r') as zf:
            if CHATROOM_CONFIG_FILENAME not in [os.path.basename(m) for m in zf.namelist() if not m.endswith('/')]:
                if CHATROOM_CONFIG_FILENAME not in zf.namelist():
                    raise ValueError(f"Archive is missing '{CHATROOM_CONFIG_FILENAME}' at the root level.")

            zf.extractall(temp_extract_dir)

            main_config_path_in_temp = os.path.join(temp_extract_dir, CHATROOM_CONFIG_FILENAME)
            if not os.path.exists(main_config_path_in_temp):
                raise ValueError(f"Extracted files missing '{CHATROOM_CONFIG_FILENAME}'")

            room_cfg_loaded = read_json_safely(main_config_path_in_temp)
            if not isinstance(room_cfg_loaded, dict) or 'name' not in room_cfg_loaded:
                raise ValueError(f"Imported '{CHATROOM_CONFIG_FILENAME}' is invalid or missing 'name'")

            imported_room_name_from_config = room_cfg_loaded['name']
            if not imported_room_name_from_config or not isinstance(imported_room_name_from_config, str):
                imported_room_name_from_config = f"ImportedRoom_{uuid.uuid4().hex[:6]}"

            room_cfg_ensured = _ensure_config_structure(room_cfg_loaded, default_chatroom_config)
            room_cfg_ensured['name'] = imported_room_name_from_config
            write_json_safely(main_config_path_in_temp, room_cfg_ensured)

            temp_partitions_path = os.path.join(temp_extract_dir, PARTITIONS_SUBDIR)
            if os.path.isdir(temp_partitions_path):
                for p_filename in os.listdir(temp_partitions_path):
                    if p_filename.startswith("partition_") and p_filename.endswith(".json"):
                        p_file_path = os.path.join(temp_partitions_path, p_filename)
                        try:
                            p_data_loaded = read_json_safely(p_file_path)
                            if p_data_loaded:
                                p_data_ensured = _ensure_config_structure(p_data_loaded, default_partition_config)
                                if 'id' not in p_data_ensured or not p_data_ensured['id']:
                                    p_data_ensured['id'] = p_filename[len("partition_"):-len(".json")]
                                write_json_safely(p_file_path, p_data_ensured)
                        except Exception: pass

        global_config = load_current_config()
        current_room_names_in_global_config = set(global_config.get('chatRoomOrder', []))

        final_room_name = imported_room_name_from_config
        name_counter = 1
        while os.path.exists(os.path.join(chatrooms_dir_abs, final_room_name)) or final_room_name in current_room_names_in_global_config:
            final_room_name = f"{imported_room_name_from_config}_{name_counter}"
            name_counter += 1

        final_target_room_path = os.path.join(chatrooms_dir_abs, final_room_name)
        shutil.move(temp_extract_dir, final_target_room_path)
        temp_extract_dir = None

        final_main_config_path_in_target = os.path.join(final_target_room_path, CHATROOM_CONFIG_FILENAME)
        final_room_cfg_data = read_json_safely(final_main_config_path_in_target)
        if final_room_cfg_data:
            final_room_cfg_data['name'] = final_room_name
            write_json_safely(final_main_config_path_in_target, final_room_cfg_data)

        if final_room_name not in global_config['chatRoomOrder']:
            global_config['chatRoomOrder'].append(final_room_name)
        save_current_config(global_config)
        
        from backend.services.chatroom_service import get_full_chatroom_details
        new_chatroom_details = get_full_chatroom_details(final_room_name)
        change_payload = {**new_chatroom_details, "globalConfig": global_config}
        
        return jsonify({"success": True, "changes": [{"type": "CREATE_CHATROOM", "payload": change_payload}]})

    except (zipfile.BadZipFile, ValueError) as e:
        return create_error_response("IMPORT_FAILED_VALIDATION", f"Import failed: {e}", 400)
    finally:
        if temp_extract_dir and os.path.exists(temp_extract_dir):
            shutil.rmtree(temp_extract_dir, ignore_errors=True)

@chatroom_features_bp.route('/get-predicted-date/<chatroom_name>/<partition_id>', methods=['GET'])
def get_predicted_date(chatroom_name, partition_id):
    date_str = calculate_virtual_world_time(chatroom_name, partition_id)
    if date_str:
        return jsonify({"success": True, "data": {"date": date_str}})
    else:
        return create_error_response("DATE_CALCULATION_FAILED", "Could not calculate a date.", 404)