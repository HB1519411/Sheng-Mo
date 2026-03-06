import os
import json
from backend.services.config_io import write_json_safely

KNOWLEDGE_BASE_DIR = 'knowledge_base'

def _get_group_file_path(group_name):
    return os.path.join(KNOWLEDGE_BASE_DIR, f"{group_name}.json")

def get_knowledge_groups():
    groups = []
    for filename in os.listdir(KNOWLEDGE_BASE_DIR):
        if filename.endswith('.json'):
            groups.append({"name": os.path.splitext(filename)[0]})
    return sorted(groups, key=lambda x: x['name'])

def create_knowledge_group(group_name):
    file_path = _get_group_file_path(group_name)
    if os.path.exists(file_path):
        raise FileExistsError(f"Group '{group_name}' already exists.")
    write_json_safely(file_path, {"entries": []})

def delete_knowledge_group(group_name):
    os.remove(_get_group_file_path(group_name))

def rename_knowledge_group(old_name, new_name):
    old_file_path = _get_group_file_path(old_name)
    new_file_path = _get_group_file_path(new_name)
    if os.path.exists(new_file_path):
        raise FileExistsError(f"Group '{new_name}' already exists.")
    os.rename(old_file_path, new_file_path)

def get_knowledge_group_entries(group_name):
    with open(_get_group_file_path(group_name), 'r', encoding='utf-8') as f:
        return json.load(f).get('entries', [])

def add_knowledge_entry(group_name, entry):
    file_path = _get_group_file_path(group_name)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data.setdefault('entries', []).append(entry)
    write_json_safely(file_path, data)
    return data.get('entries', [])

def update_knowledge_entry(group_name, entry_id, updated_entry):
    file_path = _get_group_file_path(group_name)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    entries = data.get('entries', [])
    for i, item in enumerate(entries):
        if item.get('id') == entry_id:
            entries[i] = updated_entry
            write_json_safely(file_path, data)
            return data.get('entries', [])
    raise ValueError(f"Entry with id '{entry_id}' not found.")

def delete_knowledge_entry(group_name, entry_id):
    file_path = _get_group_file_path(group_name)
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    entries = data.get('entries', [])
    new_entries = [i for i in entries if i.get('id') != entry_id]
    if len(entries) == len(new_entries):
        raise ValueError(f"Entry with id '{entry_id}' not found.")
    data['entries'] = new_entries
    write_json_safely(file_path, data)
    return data.get('entries', [])