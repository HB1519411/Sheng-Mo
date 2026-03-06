import logging
import json
from datetime import datetime
from typing import List, Dict, Any
from flask import Blueprint, request, jsonify
from pydantic import BaseModel
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
        lines.append("/" if node['name'] == '/' else f"{prefix}{'└── ' if is_last_sibling else '├── '}{node['name']}{'/' if node['type'] == 'folder' else ''}")
    else:
        lines.append(f"{prefix}{'└── ' if is_last_sibling else '├── '}{node['name']}{'/' if node['type'] == 'folder' else ''}")

    if node.get("children"):
        children = [c for c in node["children"] if c]
        for i, child in enumerate(children):
            new_prefix = prefix + ("    " if is_last_sibling else "│   ")
            if indent_level == 0 and node['name'] == '/':
                new_prefix = ""
            lines.append(_format_file_tree_to_string(child, indent_level + 1, i == len(children) - 1, new_prefix))

    return "\n".join(filter(None, lines))

@project_utils_bp.route('/get-export-selection', methods=['GET'])
def get_export_selection():
    if EXPORT_SELECTION_FILE.exists():
        data = json.loads(EXPORT_SELECTION_FILE.read_text(encoding='utf-8'))
        existing_files = [f for f in data if _get_validated_path(f) and _get_validated_path(f).is_file()]
        if len(existing_files) < len(data):
            logger.warning("Removed non-existent files from export selection.")
            EXPORT_SELECTION_FILE.write_text(json.dumps(existing_files, indent=2), encoding='utf-8')
        return jsonify({'selected_files': existing_files})
    return jsonify({'selected_files': []})

@project_utils_bp.route('/save-export-selection', methods=['POST'])
def save_export_selection():
    payload = ExportSelectionPayload(**request.json)
    validated_files = [f for f in payload.selected_files if _get_validated_path(f) and _get_validated_path(f).is_file()]
    EXPORT_SELECTION_FILE.write_text(json.dumps(validated_files, indent=2), encoding='utf-8')
    return jsonify({'message': 'Export selection saved successfully'})

@project_utils_bp.route('/get-rules-and-structure', methods=['POST'])
def get_rules_and_structure():
    payload = ExportSelectionPayload(**request.json)
    mod_rules_content = ""

    if MODIFICATION_RULES_FILE.name in payload.selected_files and MODIFICATION_RULES_FILE.exists() and MODIFICATION_RULES_FILE.is_file():
        mod_rules_content = MODIFICATION_RULES_FILE.read_text(encoding='utf-8').strip()

    files_for_tree = [f for f in payload.selected_files if f != MODIFICATION_RULES_FILE.name and _get_validated_path(f) and _get_validated_path(f).is_file()]
    tree_root = _build_file_tree_from_paths(files_for_tree)

    tree_parts = ["项目文件组成:"]
    if files_for_tree: tree_parts.append("/")
    if tree_root["children"]:
        for i, child in enumerate(tree_root["children"]):
            tree_parts.append(_format_file_tree_to_string(child, 1, i == (len(tree_root["children"]) - 1), ""))

    tree_str = "\n".join(filter(None, tree_parts)).strip()
    return jsonify({'content': f"{tree_str}\n\n{mod_rules_content}".strip() if mod_rules_content else tree_str})

@project_utils_bp.route('/trigger-startup-backup', methods=['POST'])
def trigger_startup_backup():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    if EXPORT_SELECTION_FILE.exists():
        data = json.loads(EXPORT_SELECTION_FILE.read_text(encoding='utf-8'))
        valid_files = [f for f in data if _get_validated_path(f) and _get_validated_path(f).is_file()]
        if not valid_files:
            return jsonify({'message': 'No files to backup'})
        
        backup_content = []
        for f in valid_files:
            content = _get_validated_path(f).read_text(encoding='utf-8')
            ext = f.split('.')[-1] if '.' in f else 'txt'
            lang = 'python' if ext == 'py' else 'javascript' if ext == 'js' else ext
            backup_content.append(f"--- START OF FILE {f} ---\n```{lang}\n{content}\n```\n--- END OF FILE {f} ---\n\n")
        
        if backup_content:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            (BACKUPS_DIR / f"backup_{ts}.txt").write_text("".join(backup_content), encoding='utf-8')
            all_backups = sorted([f for f in BACKUPS_DIR.iterdir() if f.is_file() and f.name.endswith('.txt')], key=lambda x: x.stat().st_mtime)
            while len(all_backups) > 10:
                all_backups.pop(0).unlink(missing_ok=True)
                
        return jsonify({'message': 'Backup created successfully'})
    return jsonify({'message': 'No export selection found'})