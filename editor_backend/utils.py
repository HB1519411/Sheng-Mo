import os
from pathlib import Path
from typing import Optional

PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
EXPORT_SELECTION_FILE = PROJECT_ROOT / '.editor_export_selection.json'
MODIFICATION_RULES_FILE = PROJECT_ROOT / 'modification_rules.txt'
BACKUPS_DIR = PROJECT_ROOT / 'editor_backups'


def is_safe_path_editor(target_path_str: str) -> bool:
    if ".." in target_path_str:
        return False

    normalized_path = os.path.normpath(target_path_str)

    if os.path.isabs(normalized_path):
        return False

    full_path = PROJECT_ROOT.joinpath(normalized_path).resolve()
    return os.path.commonpath([str(full_path), str(PROJECT_ROOT.resolve())]) == str(PROJECT_ROOT.resolve())


def _get_validated_path(filepath_relative_to_project_root_str: str) -> Optional[Path]:
    path_obj = Path(filepath_relative_to_project_root_str)
    if path_obj.is_absolute() or any(part == '..' for part in path_obj.parts):
        return None
        
    resolved_path = (PROJECT_ROOT / path_obj).resolve()

    if os.path.commonpath([str(resolved_path), str(PROJECT_ROOT.resolve())]) == str(PROJECT_ROOT.resolve()):
        return resolved_path
    return None