import os
import json
from backend.services.config_io import write_json_safely, read_json_safely, update_json_file

KNOWLEDGE_BASE_DIR = 'knowledge_base'


def _get_group_file_path(group_name):
    if '..' in group_name or '/' in group_name or '\\' in group_name:
        raise ValueError("Invalid characters in group name")
    sanitized_name = f"{group_name}.json"
    return os.path.join(KNOWLEDGE_BASE_DIR, sanitized_name)


def get_knowledge_groups():
    groups = []
    if os.path.isdir(KNOWLEDGE_BASE_DIR):
        for filename in os.listdir(KNOWLEDGE_BASE_DIR):
            if filename.endswith('.json'):
                group_name = os.path.splitext(filename)[0]
                groups.append({"name": group_name})
    groups.sort(key=lambda x: x['name'])
    return groups


def create_knowledge_group(group_name):
    file_path = _get_group_file_path(group_name)
    if os.path.exists(file_path):
        raise FileExistsError(f"Group '{group_name}' already exists.")
    write_json_safely(file_path, {"entries": []})


def delete_knowledge_group(group_name):
    file_path = _get_group_file_path(group_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Group '{group_name}' not found.")
    os.remove(file_path)


def rename_knowledge_group(old_name, new_name):
    old_file_path = _get_group_file_path(old_name)
    new_file_path = _get_group_file_path(new_name)
    if not os.path.exists(old_file_path):
        raise FileNotFoundError(f"Group '{old_name}' not found.")
    if os.path.exists(new_file_path):
        raise FileExistsError(f"Group '{new_name}' already exists.")
    os.rename(old_file_path, new_file_path)


def get_knowledge_group_entries(group_name):
    file_path = _get_group_file_path(group_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Group '{group_name}' not found.")
    data = read_json_safely(file_path)
    return data.get('entries', []) if data else []


def add_knowledge_entry(group_name, entry):
    file_path = _get_group_file_path(group_name)

    def append_entry(data):
        if 'entries' not in data or not isinstance(data['entries'], list):
            data['entries'] = []
        data['entries'].append(entry)
        return data

    updated_data, _ = update_json_file(file_path, append_entry, lambda: {"entries": []})
    return updated_data.get('entries', [])


def update_knowledge_entry(group_name, entry_id, updated_entry):
    file_path = _get_group_file_path(group_name)

    def update_in_list(data):
        if 'entries' in data and isinstance(data['entries'], list):
            entry_found = False
            for i, item in enumerate(data['entries']):
                if isinstance(item, dict) and item.get('id') == entry_id:
                    data['entries'][i] = updated_entry
                    entry_found = True
                    break
            if not entry_found:
                raise ValueError(f"Entry with id '{entry_id}' not found.")
        else:
            raise ValueError(f"Entry with id '{entry_id}' not found.")
        return data

    updated_data, _ = update_json_file(file_path, update_in_list, lambda: {"entries": []})
    return updated_data.get('entries', [])


def delete_knowledge_entry(group_name, entry_id):
    file_path = _get_group_file_path(group_name)

    def delete_from_list(data):
        if 'entries' in data and isinstance(data['entries'], list):
            original_len = len(data['entries'])
            data['entries'] = [item for item in data['entries'] if not (isinstance(item, dict) and item.get('id') == entry_id)]
            if len(data['entries']) == original_len:
                raise ValueError(f"Entry with id '{entry_id}' not found.")
        else:
            raise ValueError(f"Entry with id '{entry_id}' not found.")
        return data

    updated_data, _ = update_json_file(file_path, delete_from_list, lambda: {"entries": []})
    return updated_data.get('entries', [])