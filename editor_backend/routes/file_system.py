import sys
import os
import logging
import shutil
from typing import List, Optional, Dict, Any
from pathlib import Path
from flask import Blueprint, request, jsonify
from pydantic import BaseModel, ValidationError as PydanticValidationError
from editor_backend.utils import _get_validated_path, PROJECT_ROOT

file_system_bp = Blueprint('file_system_bp', __name__)
logger = logging.getLogger(__name__)


class FilePathPayload(BaseModel):
    filepath: str


class CreateFilePayload(FilePathPayload):
    is_directory: bool = False


class RenameFilePayload(BaseModel):
    old_filepath: str
    new_filepath: str


def _scan_directory_recursive(dir_path: Path, ignore_list: set, current_base_path: str) -> Optional[List[Dict[str, Any]]]:
    items_in_dir = []
    try:
        for item in dir_path.iterdir():
            item_relative_path_str = f"{current_base_path}/{item.name}"

            if item_relative_path_str in ignore_list:
                continue
            if item.name in ignore_list:
                continue

            item_type = 'folder' if item.is_dir() else 'file'
            children_data = _scan_directory_recursive(
                item, ignore_list, item_relative_path_str) if item_type == 'folder' else None
            items_in_dir.append({'name': item.name, 'type': item_type,
                                'children': children_data, 'path': item_relative_path_str})
        items_in_dir.sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
    except Exception as e:
        logger.error(f"Error scanning directory {dir_path}: {e}")
    return items_in_dir if items_in_dir else None


@file_system_bp.route('/list-project-files', methods=['GET'])
def list_project_files():
    try:
        root_items = []
        ignore_set = {
            '.git',
            '.idea',
            '__pycache__',
            '.vscode',
            'node_modules',
            '.DS_Store',
            'images',
            'venv',
            '.venv',
            'env',
            '.env',
            'vendor'
        }

        for item in PROJECT_ROOT.iterdir():
            item_relative_path_str = item.name
            if item_relative_path_str in ignore_set:
                continue

            item_type = 'folder' if item.is_dir() else 'file'
            children_data = _scan_directory_recursive(
                item, ignore_set, item_relative_path_str) if item_type == 'folder' else None
            root_items.append({'name': item.name, 'type': item_type,
                              'children': children_data, 'path': item_relative_path_str})

        root_items.sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
        return jsonify({'name': '/', 'type': 'folder', 'children': root_items})
    except Exception as e:
        logger.exception(f"Error listing project files: {e}")
        return jsonify({'error': 'Failed to list project files', 'details': str(e)}), 500


@file_system_bp.route('/create-project-file', methods=['POST'])
def create_project_file():
    try:
        payload = CreateFilePayload(**request.json)
        validated_path = _get_validated_path(payload.filepath)
        if not validated_path:
            return jsonify({'error': 'Access denied or invalid path for creation'}), 403
        if validated_path.exists():
            return jsonify({'error': 'File or directory already exists'}), 409

        if payload.is_directory:
            validated_path.mkdir(parents=True, exist_ok=True)
            return jsonify({'message': f"Directory '{payload.filepath}' created successfully"})
        else:
            validated_path.parent.mkdir(parents=True, exist_ok=True)
            if validated_path.parent != PROJECT_ROOT and not str(validated_path.parent.resolve()).startswith(str(PROJECT_ROOT.resolve())):
                return jsonify({'error': 'Cannot create parent directory outside project scope'}), 403
            validated_path.write_text('', encoding='utf-8')
            return jsonify({'message': f"File '{payload.filepath}' created successfully"})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e_create:
        logger.exception(f"Error creating project file/dir: {e_create}")
        return jsonify({'error': 'Failed to create file/directory', 'details': str(e_create)}), 500


@file_system_bp.route('/rename-project-file', methods=['POST'])
def rename_project_file():
    try:
        payload = RenameFilePayload(**request.json)
        old_validated_path = _get_validated_path(payload.old_filepath)
        new_validated_path = _get_validated_path(payload.new_filepath)

        if not old_validated_path or not new_validated_path:
            return jsonify({'error': 'Access denied or invalid path for renaming'}), 403
        if not old_validated_path.exists():
            return jsonify({'error': 'Source file/directory not found'}), 404
        if new_validated_path.exists():
            return jsonify({'error': 'Target file/directory already exists'}), 409

        new_parent_dir = new_validated_path.parent
        if new_parent_dir != PROJECT_ROOT and not str(new_parent_dir.resolve()).startswith(str(PROJECT_ROOT.resolve())):
            return jsonify({'error': 'Cannot create parent directory for new path outside project scope'}), 403

        new_validated_path.parent.mkdir(parents=True, exist_ok=True)
        old_validated_path.rename(new_validated_path)
        return jsonify({'message': f"Renamed '{payload.old_filepath}' to '{payload.new_filepath}' successfully"})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e_rename:
        logger.exception(f"Error renaming file/dir: {e_rename}")
        return jsonify({'error': 'Failed to rename', 'details': str(e_rename)}), 500


@file_system_bp.route('/delete-project-file', methods=['POST'])
def delete_project_file():
    try:
        payload = FilePathPayload(**request.json)
        validated_path = _get_validated_path(payload.filepath)
        if not validated_path:
            return jsonify({'error': 'Access denied or invalid path for deletion'}), 403
        if validated_path == PROJECT_ROOT.resolve():
            return jsonify({'error': 'Cannot delete the project root directory'}), 403
        if not validated_path.exists():
            return jsonify({'error': 'File/directory not found'}), 404

        if validated_path.is_dir():
            shutil.rmtree(validated_path)
            return jsonify({'message': f"Directory '{payload.filepath}' and its contents deleted successfully"})
        else:
            validated_path.unlink()
            return jsonify({'message': f"File '{payload.filepath}' deleted successfully"})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e_delete:
        logger.exception(f"Error deleting file/dir: {e_delete}")
        return jsonify({'error': 'Failed to delete', 'details': str(e_delete)}), 500