from flask import Blueprint, request, jsonify
import os
import json
from backend.services.config_io import CHATROOMS_DIR, EVENTS_SUBDIR, write_json_safely

event_management_bp = Blueprint('event_management_bp', __name__)

def _get_events_file_path(chatroom_name):
    return os.path.join(CHATROOMS_DIR, chatroom_name, EVENTS_SUBDIR, 'events.json')

@event_management_bp.route('/events/<chatroom_name>', methods=['GET'])
def get_events(chatroom_name):
    try:
        with open(_get_events_file_path(chatroom_name), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({"success": True, "data": data['events']})
    except FileNotFoundError:
        return jsonify({"success": True, "data": []})

@event_management_bp.route('/events/<chatroom_name>', methods=['POST'])
def add_event(chatroom_name):
    event_item = request.get_json()
    file_path = _get_events_file_path(chatroom_name)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {"events": []}
        
    time_to_match = event_item.get('time')
    new_involved_sorted = sorted(event_item['involvedCharacters'])
    
    merged = False
    if time_to_match:
        for existing_event in data['events']:
            if existing_event['time'] == time_to_match and sorted(existing_event['involvedCharacters']) == new_involved_sorted:
                existing_event['content'] = f"{existing_event['content']}\n\n{event_item['content']}".strip()
                if event_item.get('details'):
                    existing_event['details'] = f"{existing_event.get('details', '')}\n\n{event_item['details']}".strip()
                if event_item.get('isPinned'):
                    existing_event['isPinned'] = True
                event_item = existing_event
                merged = True
                break

    if not merged:
        data['events'].append(event_item)
        
    write_json_safely(file_path, data)
    return jsonify({"success": True, "changes": [{"type": "UPSERT_EVENT", "payload": {"chatroomName": chatroom_name, "eventItem": event_item}}]})

@event_management_bp.route('/events/<chatroom_name>/<event_id>', methods=['PUT'])
def update_event(chatroom_name, event_id):
    updated_item = request.get_json()
    file_path = _get_events_file_path(chatroom_name)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for i, item in enumerate(data['events']):
        if item['id'] == event_id:
            data['events'][i] = updated_item
            break
            
    write_json_safely(file_path, data)
    return jsonify({"success": True, "changes": [{"type": "UPDATE_EVENT", "payload": {"chatroomName": chatroom_name, "eventId": event_id, "eventItem": updated_item}}]})

@event_management_bp.route('/events/<chatroom_name>/<event_id>', methods=['DELETE'])
def delete_event(chatroom_name, event_id):
    file_path = _get_events_file_path(chatroom_name)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    data['events'] = [item for item in data['events'] if item['id'] != event_id]
    
    write_json_safely(file_path, data)
    return jsonify({"success": True, "changes": [{"type": "DELETE_EVENT", "payload": {"chatroomName": chatroom_name, "eventId": event_id}}]})