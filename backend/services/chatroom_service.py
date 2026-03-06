import os
import json
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, ROLES_SUBDIR, NOVELS_SUBDIR, PARTITIONS_SUBDIR, EVENTS_SUBDIR, write_json_safely
)

def get_world_snapshot(chatroom_name):
    return get_full_chatroom_details(chatroom_name)

def get_full_chatroom_details(chatroom_name):
    if not chatroom_name:
        return None

    chatroom_path = os.path.join(CHATROOMS_DIR, chatroom_name)
    if not os.path.isdir(chatroom_path):
        return None

    details = {"config": None, "roles": [], "novels": [], "partitions": [], "events": []}
    
    with open(os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME), 'r', encoding='utf-8') as f:
        details["config"] = json.load(f)

    roles_path = os.path.join(chatroom_path, ROLES_SUBDIR)
    if os.path.isdir(roles_path):
        for filename in os.listdir(roles_path):
            if filename.endswith('.json'):
                with open(os.path.join(roles_path, filename), 'r', encoding='utf-8') as f:
                    details["roles"].append(json.load(f))

    partitions_dir_path = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    if os.path.isdir(partitions_dir_path):
        for filename in os.listdir(partitions_dir_path):
            if filename.startswith("partition_") and filename.endswith(".json"):
                with open(os.path.join(partitions_dir_path, filename), 'r', encoding='utf-8') as f:
                    details["partitions"].append(json.load(f))

    novels_path = os.path.join(chatroom_path, NOVELS_SUBDIR)
    if os.path.isdir(novels_path):
        for filename in os.listdir(novels_path):
            if filename.endswith('.json'):
                with open(os.path.join(novels_path, filename), 'r', encoding='utf-8') as f:
                    details["novels"].append(json.load(f))
    
    events_file_path = os.path.join(chatroom_path, EVENTS_SUBDIR, 'events.json')
    if os.path.exists(events_file_path):
        with open(events_file_path, 'r', encoding='utf-8') as f:
            details["events"] = json.load(f)["events"]

    return details

def _update_role_in_all_partitions(chatroom_path, operation, role_name, new_role_name=None):
    partitions_dir = os.path.join(chatroom_path, PARTITIONS_SUBDIR)
    if not os.path.isdir(partitions_dir):
        return

    for filename in os.listdir(partitions_dir):
        if filename.startswith("partition_") and filename.endswith(".json"):
            filepath = os.path.join(partitions_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                partition_data = json.load(f)

            changed = False
            existing_index = next((i for i, a in enumerate(partition_data['roleAliases']) if a['name'] == role_name), -1)

            if operation == "create" and existing_index == -1:
                partition_data['roleAliases'].append({"name": role_name, "alias": "", "state": "默"})
                changed = True
            elif operation == "delete" and existing_index != -1:
                del partition_data['roleAliases'][existing_index]
                changed = True
            elif operation == "rename" and new_role_name and existing_index != -1:
                partition_data['roleAliases'][existing_index]['name'] = new_role_name
                changed = True

            if changed:
                write_json_safely(filepath, partition_data)