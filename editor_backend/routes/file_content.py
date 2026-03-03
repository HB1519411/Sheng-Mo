import sys
import os
import logging
import json
from pathlib import Path
from flask import Blueprint, request, jsonify
from pydantic import BaseModel, ValidationError as PydanticValidationError
from editor_backend.utils import _get_validated_path

file_content_bp = Blueprint('file_content_bp', __name__)
logger = logging.getLogger(__name__)


class FilePathPayload(BaseModel):
    filepath: str


class SaveFilePayload(FilePathPayload):
    content: str


@file_content_bp.route('/get-editor-file-content', methods=['GET'])
def get_editor_file_content():
    try:
        payload = FilePathPayload(**request.args)
        validated_path = _get_validated_path(payload.filepath)
        if not validated_path:
            return jsonify({'error': 'Access denied or invalid path'}), 403
        if not validated_path.exists() or validated_path.is_dir():
            return jsonify({'error': 'File not found'}), 404
        content_text = validated_path.read_text(encoding='utf-8')
        return jsonify({'content': content_text})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request parameters', 'details': e.errors()}), 400
    except Exception as e_read:
        logger.exception(f"Error getting file content: {e_read}")
        return jsonify({'error': 'Failed to read file', 'details': str(e_read)}), 500


@file_content_bp.route('/save-editor-file-content', methods=['POST'])
def save_editor_file_content():
    try:
        payload = SaveFilePayload(**request.json)
        validated_path = _get_validated_path(payload.filepath)
        if not validated_path:
            return jsonify({'error': 'Access denied or invalid path for saving'}), 403

        parent_dir = validated_path.parent
        if parent_dir != validated_path.parent.resolve().root and not str(parent_dir.resolve()).startswith(str(_get_validated_path('.').resolve())):
            return jsonify({'error': 'Cannot create directory outside project scope (parent check)'}), 403

        parent_dir.mkdir(parents=True, exist_ok=True)
        validated_path.write_text(payload.content, encoding='utf-8')
        return jsonify({'message': f"File '{payload.filepath}' saved successfully"})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e_save:
        logger.exception(
            f"Error saving file content for '{payload.filepath if 'payload' in locals() else 'unknown_file'}': {e_save}")
        return jsonify({'error': 'Failed to save file', 'details': str(e_save)}), 500