import os
from pathlib import Path
from typing import Optional

PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
EXPORT_SELECTION_FILE = PROJECT_ROOT / '.editor_export_selection.json'
MODIFICATION_RULES_FILE = PROJECT_ROOT / 'modification_rules.txt'
BACKUPS_DIR = PROJECT_ROOT / 'editor_backups'


def is_safe_path_editor(target_path_str: str) -> bool:
    try:
        if ".." in target_path_str:
            return False

        normalized_path = os.path.normpath(target_path_str)

        if os.path.isabs(normalized_path):
            return False

        full_path = PROJECT_ROOT.joinpath(normalized_path).resolve()

        common_path = os.path.commonpath([str(full_path), str(PROJECT_ROOT.resolve())])
        is_within_project = common_path == str(PROJECT_ROOT.resolve())

        return is_within_project
    except Exception as e:
        return False


def _get_validated_path(filepath_relative_to_project_root_str: str) -> Optional[Path]:
    try:
        path_obj = Path(filepath_relative_to_project_root_str)
        if path_obj.is_absolute() or any(part == '..' for part in path_obj.parts):
            return None
        resolved_path = (PROJECT_ROOT / path_obj).resolve()

        common_path = os.path.commonpath([str(resolved_path), str(PROJECT_ROOT.resolve())])
        if common_path == str(PROJECT_ROOT.resolve()):
            return resolved_path
        return None
    except Exception:
        return None