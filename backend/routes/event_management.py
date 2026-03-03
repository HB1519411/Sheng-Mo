from flask import Blueprint, request, jsonify
import os
from backend.services.config_io import (
    CHATROOMS_DIR, EVENTS_SUBDIR, update_json_file, read_json_safely
)
from backend.utils.path_utils import create_error_response
from backend.services.config_definitions import default_events_file

event_management_bp = Blueprint('event_management_bp', __name__)


def _get_events_file_path(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    events_dir = os.path.join(chatroom_path, EVENTS_SUBDIR)
    os.makedirs(events_dir, exist_ok=True)
    return os.path.join(events_dir, 'events.json')


@event_management_bp.route('/events/<chatroom_name>', methods=['GET'])
def get_events(chatroom_name):
    try:
        events_file_path = _get_events_file_path(chatroom_name)
        if not os.path.exists(events_file_path):
            return jsonify({"success": True, "data": []})
        
        data = read_json_safely(events_file_path)
        if data is None:
            return jsonify({"success": True, "data": []})
        
        return jsonify({"success": True, "data": data.get('events', [])})
    except Exception as e:
        return create_error_response("GET_EVENTS_FAILED", f"Failed to get events: {e}", 500)


@event_management_bp.route('/events/<chatroom_name>', methods=['POST'])
def add_event(chatroom_name):
    event_item = request.get_json()
    if not event_item or 'id' not in event_item:
        return create_error_response("INVALID_EVENT_ITEM", "Invalid event item data", 400)

    def merge_or_append_event(data):
        if 'events' not in data or not isinstance(data['events'], list):
            data['events'] = []
        
        time_to_match = event_item.get('time')
        new_involved_sorted = sorted(event_item.get('involvedCharacters', []))

        if time_to_match:
            for existing_event in data['events']:
                existing_involved_sorted = sorted(existing_event.get('involvedCharacters', []))
                if existing_event.get('time') == time_to_match and existing_involved_sorted == new_involved_sorted:
                    # Merge content (summary)
                    existing_event['content'] = f"{existing_event.get('content', '')}\n\n{event_item.get('content', '')}".strip()
                    
                    # Merge details
                    existing_details = existing_event.get('details', '')
                    new_details = event_item.get('details', '')
                    if new_details:
                        existing_event['details'] = f"{existing_details}\n\n{new_details}".strip()
                    
                    # Merge pinned status (if new one is pinned, make it pinned)
                    if event_item.get('isPinned'):
                        existing_event['isPinned'] = True
                        
                    return data, existing_event

        data['events'].append(event_item)
        return data, event_item

    try:
        events_file_path = _get_events_file_path(chatroom_name)
        
        def update_logic(data):
            data, _ = merge_or_append_event(data)
            return data
            
        data_before_update = read_json_safely(events_file_path) or default_events_file.copy()
        _, final_event_item = merge_or_append_event(data_before_update.copy())
        
        updated_data, changed = update_json_file(events_file_path, update_logic, lambda: default_events_file.copy())

        if updated_data is not None:
            change_payload = { "chatroomName": chatroom_name, "eventItem": final_event_item }
            return jsonify({"success": True, "changes": [{"type": "UPSERT_EVENT", "payload": change_payload}]})
        else:
            return create_error_response("ADD_EVENT_FAILED", "Failed to add or merge event item", 500)
    except Exception as e:
        return create_error_response("ADD_EVENT_UNEXPECTED_ERROR", f"An unexpected error occurred: {e}", 500)


@event_management_bp.route('/events/<chatroom_name>/<event_id>', methods=['PUT'])
def update_event(chatroom_name, event_id):
    updated_item = request.get_json()

    def update_event_in_list(data):
        if 'events' in data and isinstance(data['events'], list):
            for i, item in enumerate(data['events']):
                if isinstance(item, dict) and item.get('id') == event_id:
                    data['events'][i] = updated_item
                    break
        return data

    try:
        events_file_path = _get_events_file_path(chatroom_name)
        updated_data, changed = update_json_file(events_file_path, update_event_in_list, lambda: default_events_file.copy())
        if updated_data is not None:
            change_payload = { "chatroomName": chatroom_name, "eventId": event_id, "eventItem": updated_item }
            return jsonify({"success": True, "changes": [{"type": "UPDATE_EVENT", "payload": change_payload}]})
        else:
            return create_error_response("UPDATE_EVENT_FAILED", "Failed to update event item", 500)
    except Exception as e:
        return create_error_response("UPDATE_EVENT_UNEXPECTED_ERROR", f"An unexpected error occurred: {e}", 500)


@event_management_bp.route('/events/<chatroom_name>/<event_id>', methods=['DELETE'])
def delete_event(chatroom_name, event_id):
    def delete_event_from_list(data):
        if 'events' in data and isinstance(data['events'], list):
            data['events'] = [item for item in data['events'] if not (
                isinstance(item, dict) and item.get('id') == event_id)]
        return data
    
    try:
        events_file_path = _get_events_file_path(chatroom_name)
        updated_data, changed = update_json_file(events_file_path, delete_event_from_list, lambda: default_events_file.copy())
        if updated_data is not None:
            change_payload = { "chatroomName": chatroom_name, "eventId": event_id }
            return jsonify({"success": True, "changes": [{"type": "DELETE_EVENT", "payload": change_payload}]})
        else:
            return create_error_response("DELETE_EVENT_FAILED", "Failed to delete event item", 500)
    except Exception as e:
        return create_error_response("DELETE_EVENT_UNEXPECTED_ERROR", f"An unexpected error occurred: {e}", 500)