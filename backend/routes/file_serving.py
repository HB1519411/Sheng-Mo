from flask import Blueprint, request, jsonify, send_from_directory, render_template
from werkzeug.exceptions import NotFound
import os
import json
from backend.utils.path_utils import is_safe_path, create_error_response
from backend.services.config_io import CHATROOMS_DIR, IMAGES_DIR, GENERATED_SUBDIR, write_json_safely, ROLES_SUBDIR, NOVELS_SUBDIR, PARTITIONS_SUBDIR

file_serving_bp = Blueprint('file_serving_bp', __name__)


@file_serving_bp.route('/get-file-content', methods=['GET'])
def get_file_content():
    filename = request.args.get('filename')
    if not filename:
        return create_error_response("MISSING_FILENAME", "Missing filename", 400)

    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not is_safe_path(safe_path, base_dir=root_dir):
        return create_error_response("ACCESS_DENIED", "Access denied outside project directory", 403)

    try:
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"success": True, "data": {"content": content}})
    except (FileNotFoundError, IsADirectoryError):
        return create_error_response("FILE_NOT_FOUND", "File not found", 404)


@file_serving_bp.route('/save-file-content', methods=['POST'])
def save_file_content():
    filename = request.json.get('filename')
    content = request.json.get('content')

    if not filename or content is None:
        return create_error_response("MISSING_FILENAME_OR_CONTENT", "Missing filename or content", 400)

    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not is_safe_path(safe_path, base_dir=root_dir):
        return create_error_response("ACCESS_DENIED", "Access denied outside project directory", 403)

    os.makedirs(os.path.dirname(safe_path), exist_ok=True)

    if filename.endswith('.json'):
        write_json_safely(safe_path, json.loads(content))
    else:
        temp_file_path = f"{safe_path}.tmp"
        with open(temp_file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        os.replace(temp_file_path, safe_path)
    return jsonify({"success": True, "message": "File saved successfully"})


@file_serving_bp.route('/images/<subdir>/<path:filename>')
def serve_subdir_image(subdir, filename):
    if subdir != GENERATED_SUBDIR:
        return create_error_response("INVALID_IMAGE_SUBDIR", "Invalid image subdirectory", 404)

    images_dir_abs = os.path.abspath(IMAGES_DIR)
    target_dir_abs = os.path.abspath(os.path.join(images_dir_abs, subdir))
    
    try:
        return send_from_directory(target_dir_abs, filename)
    except NotFound:
        return create_error_response("IMAGE_NOT_FOUND", "Image file not found", 404)


@file_serving_bp.route(f'/{CHATROOMS_DIR}/<chatroom_name>/<path:filename>')
def serve_chatroom_file(chatroom_name, filename):
    chatrooms_dir_abs = os.path.abspath(CHATROOMS_DIR)
    chatroom_path_abs = os.path.abspath(os.path.join(chatrooms_dir_abs, chatroom_name))

    allowed_subdirs = ['', ROLES_SUBDIR, NOVELS_SUBDIR, PARTITIONS_SUBDIR]
    file_subdir = os.path.dirname(filename)

    if file_subdir not in allowed_subdirs:
        if not filename.startswith('background.'):
            return create_error_response("INVALID_FILE_LOCATION", f"Access denied to this file type/location: {filename}", 403)

    try:
        return send_from_directory(chatroom_path_abs, filename)
    except NotFound:
        return create_error_response("FILE_NOT_FOUND", "File not found", 404)


@file_serving_bp.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith(CHATROOMS_DIR):
        return create_error_response("STATIC_PATH_ACCESS_DENIED", "Access denied to this path", 403)

    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    try:
        return send_from_directory(root_dir, filename)
    except NotFound:
        return create_error_response("FILE_NOT_FOUND", "File not found", 404)


@file_serving_bp.route('/')
def serve_frontend():
    return render_template('index.html')