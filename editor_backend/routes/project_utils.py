import sys
import os
import logging
import json
from datetime import datetime
from typing import List, Dict, Any
from flask import Blueprint, request, jsonify
from pydantic import BaseModel, ValidationError as PydanticValidationError
from editor_backend.utils import _get_validated_path, EXPORT_SELECTION_FILE, MODIFICATION_RULES_FILE, BACKUPS_DIR

project_utils_bp = Blueprint('project_utils_bp', __name__)
logger = logging.getLogger(__name__)


class ExportSelectionPayload(BaseModel):
    selected_files: List[str]


def _build_file_tree_from_paths(file_paths: List[str]) -> Dict[str, Any]:
    root = {"name": "/", "type": "folder", "children": []}
    for f_path in sorted(file_paths):
        parts = f_path.split('/')
        current_node = root
        for i, part in enumerate(parts):
            found = False
            for child in current_node["children"]:
                if child["name"] == part:
                    current_node = child
                    found = True
                    break
            if not found:
                new_node = {
                    "name": part,
                    "type": "folder" if i < len(parts) - 1 else "file",
                    "children": [] if i < len(parts) - 1 else None
                }
                current_node["children"].append(new_node)
                current_node["children"].sort(key=lambda x: (x["type"] != "folder", x["name"].lower()))
                current_node = new_node
    return root


def _format_file_tree_to_string(node: Dict[str, Any], indent_level: int = 0, is_last_sibling: bool = False, prefix: str = "") -> str:
    lines = []

    if indent_level == 0:
        if node['name'] == '/':
            lines.append("/")
        else:
            lines.append(
                f"{prefix}{'└── ' if is_last_sibling else '├── '}{node['name']}{'/' if node['type'] == 'folder' else ''}")
    else:
        connector = "└── " if is_last_sibling else "├── "
        lines.append(f"{prefix}{connector}{node['name']}{'/' if node['type'] == 'folder' else ''}")

    if node.get("children"):
        children_to_process = [c for c in node["children"] if c]

        for i, child in enumerate(children_to_process):
            child_is_last = i == len(children_to_process) - 1

            new_prefix_part = "    " if is_last_sibling else "│   "
            current_prefix_for_child = prefix + new_prefix_part

            if indent_level == 0 and node['name'] == '/':
                current_prefix_for_child = ""

            lines.append(_format_file_tree_to_string(child, indent_level + 1, child_is_last, current_prefix_for_child))

    return "\n".join(filter(None, lines))


@project_utils_bp.route('/get-export-selection', methods=['GET'])
def get_export_selection():
    try:
        if EXPORT_SELECTION_FILE.exists():
            data = json.loads(EXPORT_SELECTION_FILE.read_text(encoding='utf-8'))
            if isinstance(data, list):
                existing_files = [f for f in data if _get_validated_path(f) and _get_validated_path(f).is_file()]
                if len(existing_files) < len(data):
                    logger.warning("Removed non-existent files from export selection.")
                    EXPORT_SELECTION_FILE.write_text(json.dumps(existing_files, indent=2), encoding='utf-8')
                return jsonify({'selected_files': existing_files})
        return jsonify({'selected_files': []})
    except Exception as e:
        logger.exception(f"Error getting export selection: {e}")
        return jsonify({'error': 'Failed to get export selection', 'details': str(e)}), 500


@project_utils_bp.route('/save-export-selection', methods=['POST'])
def save_export_selection():
    try:
        payload = ExportSelectionPayload(**request.json)
        validated_and_existing_files = [
            f for f in payload.selected_files
            if _get_validated_path(f) and _get_validated_path(f).is_file()
        ]
        EXPORT_SELECTION_FILE.write_text(json.dumps(validated_and_existing_files, indent=2), encoding='utf-8')
        return jsonify({'message': 'Export selection saved successfully'})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e_save_selection:
        logger.exception(f"Error saving export selection: {e_save_selection}")
        return jsonify({'error': 'Failed to save export selection', 'details': str(e_save_selection)}), 500


@project_utils_bp.route('/get-rules-and-structure', methods=['POST'])
def get_rules_and_structure():
    try:
        payload = ExportSelectionPayload(**request.json)
        selected_files = payload.selected_files
        mod_rules_content = ""

        if MODIFICATION_RULES_FILE.name in selected_files:
            if MODIFICATION_RULES_FILE.exists() and MODIFICATION_RULES_FILE.is_file():
                mod_rules_content = MODIFICATION_RULES_FILE.read_text(encoding='utf-8').strip()

        files_for_tree = [f for f in selected_files if f !=
                          MODIFICATION_RULES_FILE.name and _get_validated_path(f) and _get_validated_path(f).is_file()]

        tree_root = _build_file_tree_from_paths(files_for_tree)

        tree_string_parts = ["项目文件组成:"]
        if files_for_tree:
            tree_string_parts.append("/")

        if tree_root["children"]:
            for i, child in enumerate(tree_root["children"]):
                tree_string_parts.append(_format_file_tree_to_string(
                    child, 1, i == (len(tree_root["children"]) - 1), ""))

        tree_structure_content = "\n".join(filter(None, tree_string_parts)).strip()

        if mod_rules_content:
            combined_content = f"{tree_structure_content}\n\n{mod_rules_content}"
        else:
            combined_content = tree_structure_content

        return jsonify({'content': combined_content.strip()})
    except PydanticValidationError as e:
        return jsonify({'error': 'Invalid request payload', 'details': e.errors()}), 400
    except Exception as e:
        logger.exception(f"Error getting rules and structure: {e}")
        return jsonify({'error': 'Failed to get rules and structure', 'details': str(e)}), 500


@project_utils_bp.route('/trigger-startup-backup', methods=['POST'])
def trigger_startup_backup():
    try:
        BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        
        if EXPORT_SELECTION_FILE.exists():
            data = json.loads(EXPORT_SELECTION_FILE.read_text(encoding='utf-8'))
            if isinstance(data, list):
                valid_files = [f for f in data if _get_validated_path(f) and _get_validated_path(f).is_file()]
                if not valid_files:
                    return jsonify({'message': 'No files to backup'})
                
                backup_content_parts = []
                for filepath_str in valid_files:
                    validated_path = _get_validated_path(filepath_str)
                    if validated_path:
                        try:
                            content = validated_path.read_text(encoding='utf-8')
                            ext = filepath_str.split('.')[-1] if '.' in filepath_str else 'txt'
                            lang = ext
                            if ext == 'py': lang = 'python'
                            elif ext == 'js': lang = 'javascript'
                            
                            block = f"--- START OF FILE {filepath_str} ---\n```{lang}\n{content}\n```\n--- END OF FILE {filepath_str} ---\n\n"
                            backup_content_parts.append(block)
                        except Exception as e:
                            logger.error(f"Failed to read {filepath_str} for backup: {e}")
                
                if backup_content_parts:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    backup_filename = f"backup_{timestamp}.txt"
                    backup_file_path = BACKUPS_DIR / backup_filename
                    backup_file_path.write_text("".join(backup_content_parts), encoding='utf-8')
                    
                    all_backups = sorted([f for f in BACKUPS_DIR.iterdir() if f.is_file() and f.name.endswith('.txt')], key=lambda x: x.stat().st_mtime)
                    while len(all_backups) > 10:
                        oldest = all_backups.pop(0)
                        oldest.unlink(missing_ok=True)
                        
                return jsonify({'message': 'Backup created successfully'})
        return jsonify({'message': 'No export selection found'})
    except Exception as e:
        logger.exception(f"Error creating startup backup: {e}")
        return jsonify({'error': 'Failed to create backup', 'details': str(e)}), 500