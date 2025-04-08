import base64
import io
import zipfile
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import requests
import json
import os
import logging
import uuid
import re
import math
import sys
import traceback
from datetime import datetime
import shutil

app = Flask(__name__)
CORS(app)

CONFIG_FILENAME = 'config.json'
CHATROOMS_DIR = 'chatrooms'
HISTORY_FILENAME = 'history.json'
CHATROOM_CONFIG_FILENAME = 'chatroom_config.json'
ROLES_SUBDIR = 'roles'
NOVELS_SUBDIR = 'novels'
IMAGES_DIR = 'images'
GENERATED_SUBDIR = 'generated'


MAX_ZIP_SIZE = 100 * 1024 * 1024


default_config = {
    "temperature": "1.0",
    "topP": "0.9",
    "topK": "40",
    "maxOutputTokens": "2048",
    "responseMimeType": "application/json",
    "promptPresetTurns": [],
    "model": "",
    "responseSchemaJson": "",
    "responseSchemaParserJs": "",
    "sharedDatabaseInstruction": "",
    "mainPrompt": "",
    "toolSettings": {
        "drawingMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model": "", "mainPrompt": "", "novelContent": ""},
        "gameHost": { "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model": "", "mainPrompt": "" },
        "writingMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model": "", "mainPrompt": "" },
        "characterUpdateMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model": "", "mainPrompt": "" },
        "privateAssistant": { "responseSchemaJson": "", "responseSchemaParserJs": "", "toolDatabaseInstruction": "", "enabled": False, "model": "", "mainPrompt": "" },
    },
    "activeChatRoomName": None,
    "chatRoomOrder": [],
    "isRunPaused": True,
    "isRoleListVisible": False,
    "lastViewedNovelId": None,
    "originalNovelLength": 10000,
    "novelaiModel": "",
    "novelaiArtistChain": "",
    "novelaiDefaultPositivePrompt": "",
    "novelaiDefaultNegativePrompt": "",
    "novelaiWidth": 1024,
    "novelaiHeight": 1024,
    "novelaiSteps": 28,
    "novelaiScale": 5.0,
    "novelaiCfgRescale": 0.0,
    "novelaiSampler": "k_euler",
    "novelaiNoiseSchedule": "native",
    "novelaiSeed": 0,
    "systemInstruction": ""
}


default_chatroom_override_settings = {
    "general": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "sharedDatabaseInstruction": "",
        "mainPrompt": ""
    },
    "drawingMaster": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "toolDatabaseInstruction": "",
        "mainPrompt": "",
        "novelContent": ""
    },
    "gameHost": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "toolDatabaseInstruction": "",
        "mainPrompt": ""
    },
    "writingMaster": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "toolDatabaseInstruction": "",
        "mainPrompt": ""
    },
    "characterUpdateMaster": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "toolDatabaseInstruction": "",
        "mainPrompt": ""
    },
    "privateAssistant": {
        "enabled": False,
        "model": "",
        "responseSchemaJson": "",
        "responseSchemaParserJs": "",
        "toolDatabaseInstruction": "",
        "mainPrompt": ""
    }
}

default_chatroom_config = {
    "name": "",
    "roleplayRules": "",
    "publicInfo": "",
    "user": "",
    "activeNovelIds": [],
    "roleStates": {"管理员": "默"},
    "roleDetailedStates": {},
    "novelCurrentSegmentIds": {},
    "backgroundImageFilename": None,
    "overrideSettings": default_chatroom_override_settings.copy(),
    "roleVisibility": {"管理员": True}
}


log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

os.makedirs(CHATROOMS_DIR, exist_ok=True)
os.makedirs(os.path.join(IMAGES_DIR, GENERATED_SUBDIR), exist_ok=True)


@app.errorhandler(Exception)
def handle_exception(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    print(f"Unhandled Exception: {e}", file=sys.stderr)
    traceback.print_tb(exc_traceback, limit=5, file=sys.stderr)
    response = jsonify({"error": "Internal Server Error", "details": str(e)})
    response.status_code = 500
    return response

def is_safe_path(path, base_dir=None):
    if base_dir is None:
        base_dir = os.path.abspath(os.path.dirname(__file__))
    else:
        base_dir = os.path.abspath(base_dir)

    target_path_abs = os.path.abspath(path)
    return target_path_abs.startswith(base_dir)


def load_current_config():
    config_to_return = default_config.copy()
    loaded_data = {}

    if os.path.exists(CONFIG_FILENAME):
        try:
            with open(CONFIG_FILENAME, 'r', encoding='utf-8') as f:
                 loaded_data = json.load(f)
            if not isinstance(loaded_data, dict):
                 print(f"Warning: Config file '{CONFIG_FILENAME}' is not a valid JSON object. Using defaults.", file=sys.stderr)
                 loaded_data = {}
        except Exception as e:
            print(f"Error loading config file '{CONFIG_FILENAME}': {e}. Using defaults.", file=sys.stderr)
            loaded_data = {}


    for key, default_value in default_config.items():
        if key == 'toolSettings':
            if isinstance(loaded_data.get(key), dict):
                config_to_return[key] = {}
                for tool_name, default_tool_config in default_config[key].items():
                    loaded_tool_config = loaded_data[key].get(tool_name)
                    if isinstance(loaded_tool_config, dict):
                        config_to_return[key][tool_name] = default_tool_config.copy()
                        config_to_return[key][tool_name].update({
                            k: v for k, v in loaded_tool_config.items()
                            if k in default_tool_config
                        })
                    else:
                        config_to_return[key][tool_name] = default_tool_config.copy()
            else:
                config_to_return[key] = default_config[key].copy()
        elif key == 'chatRoomOrder':
             if isinstance(loaded_data.get(key), list):
                 config_to_return[key] = [str(name) for name in loaded_data[key] if isinstance(name, str) and name.strip()]
             else:
                 config_to_return[key] = []
        elif key == 'activeChatRoomName':
             config_to_return[key] = loaded_data.get(key) if isinstance(loaded_data.get(key), str) else None
        elif key not in ['chatRooms', 'activeNovelIdsInChatroom', 'novelCurrentSegmentIds', 'errorLogs']:
            if key in loaded_data:
                config_to_return[key] = loaded_data[key]


    obsolete_keys_set = set(['chatRooms', 'activeNovelIdsInChatroom', 'novelCurrentSegmentIds', 'errorLogs', 'roleStates',
                             'apiKeys', 'currentApiKeyIndex', 'novelaiApiKey', 'chatroomHistories',
                             'user1Instruction', 'model1Instruction', 'user2Instruction',
                             'model2Instruction', 'user3Instruction', 'primaryModel', 'secondaryModel',
                             'roles', 'temporaryRoles', 'novels'])
    for key in list(config_to_return.keys()):
         if key.endswith('_setting') or key.endswith('_memory') or key.endswith('_drawingTemplate'):
             del config_to_return[key]
         elif key in obsolete_keys_set:
             pass


    chatrooms_base_path = os.path.abspath(CHATROOMS_DIR)
    found_room_names = set()
    if os.path.isdir(chatrooms_base_path):
        for item in os.listdir(chatrooms_base_path):
            item_path = os.path.join(chatrooms_base_path, item)
            chatroom_config_path = os.path.join(item_path, CHATROOM_CONFIG_FILENAME)
            if os.path.isdir(item_path) and os.path.exists(chatroom_config_path) and is_safe_path(item_path, chatrooms_base_path):
                try:
                    with open(chatroom_config_path, 'r', encoding='utf-8') as cf:
                        room_conf = json.load(cf)
                    if isinstance(room_conf, dict) and 'name' in room_conf and room_conf['name'] == item:
                        found_room_names.add(item)
                    else:
                         print(f"Warning: Chatroom directory '{item}' has invalid or mismatched config file. Skipping.", file=sys.stderr)
                except Exception as e:
                    print(f"Warning: Error reading chatroom config '{chatroom_config_path}': {e}. Skipping.", file=sys.stderr)


    current_order = config_to_return['chatRoomOrder']
    valid_ordered_rooms = [name for name in current_order if name in found_room_names]
    newly_found_rooms = list(found_room_names - set(valid_ordered_rooms))
    newly_found_rooms.sort()

    config_to_return['chatRoomOrder'] = valid_ordered_rooms + newly_found_rooms


    if config_to_return['activeChatRoomName'] not in found_room_names:
        config_to_return['activeChatRoomName'] = config_to_return['chatRoomOrder'][0] if config_to_return['chatRoomOrder'] else None

    return config_to_return

def save_current_config(config_data):
    clean_config = {}
    allowed_keys = set(default_config.keys()) - {'chatRooms', 'activeNovelIdsInChatroom', 'novelCurrentSegmentIds', 'errorLogs'}

    for key in allowed_keys:
        if key in config_data:
            clean_config[key] = config_data[key]
        elif key in default_config:
            clean_config[key] = default_config[key]

    if 'toolSettings' in clean_config:
        for tool_name, tool_config in list(clean_config['toolSettings'].items()):
            if tool_name not in default_config['toolSettings']:
                del clean_config['toolSettings'][tool_name]
            else:
                default_tool_keys = set(default_config['toolSettings'][tool_name].keys())
                for k in list(tool_config.keys()):
                    if k not in default_tool_keys:
                        del clean_config['toolSettings'][tool_name][k]


    if not isinstance(clean_config.get('chatRoomOrder'), list):
        clean_config['chatRoomOrder'] = []
    if not isinstance(clean_config.get('activeChatRoomName'), str) and clean_config.get('activeChatRoomName') is not None:
         clean_config['activeChatRoomName'] = None

    try:
        with open(CONFIG_FILENAME, 'w', encoding='utf-8') as f:
            json.dump(clean_config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving config: {e}", file=sys.stderr)
        raise

@app.route('/autosave-config', methods=['POST'])
def autosave_config_route():
    config_data = request.json
    if not config_data:
        return jsonify({"error": "Missing config data"}), 400

    try:
        save_current_config(config_data)
        return jsonify({"message": "Config automatically saved"})
    except Exception as e:
        return jsonify({"error": f"Auto-save failed: {e}"}), 500

@app.route('/load-config', methods=['GET'])
def load_config_route():
    try:
        current_config = load_current_config()

        config_to_send = {}
        allowed_keys = set(default_config.keys()) - {'chatRooms', 'activeNovelIdsInChatroom', 'novelCurrentSegmentIds', 'errorLogs'}
        for key in allowed_keys:
            if key in current_config:
                config_to_send[key] = current_config[key]

        return jsonify(config_to_send)
    except Exception as e:
        print(f"Error in /load-config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": "Failed to load configuration"}), 500

@app.route('/ai-proxy', methods=['POST'])
def ai_proxy():
    api_key = request.json.get('apiKey')
    model_name = request.json.get('model')
    contents = request.json.get('contents')
    system_instruction = request.json.get('systemInstruction')
    generation_config = request.json.get('generationConfig', {})
    response_mime_type = generation_config.get('responseMimeType', 'application/json')
    response_schema = generation_config.get('responseSchema')

    if not api_key or not model_name or not contents:
        return jsonify({"error": "Missing required parameters (apiKey, model, contents)"}), 400

    GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
    gemini_api_url = f"{GEMINI_API_BASE_URL}/{model_name}:generateContent?key={api_key}"

    gemini_payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": float(generation_config.get("temperature", 1.0)),
            "topP": float(generation_config.get("topP", 0.9)),
            "topK": int(generation_config.get("topK", 40)),
            "maxOutputTokens": int(generation_config.get("maxOutputTokens", 2048)),
            "responseMimeType": response_mime_type,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
        ]
    }

    if system_instruction and isinstance(system_instruction, dict) and 'parts' in system_instruction and system_instruction['parts']:
         gemini_payload["systemInstruction"] = {"parts": [{"text": system_instruction['parts'][0].get('text', '')}]}
    elif system_instruction and isinstance(system_instruction, str) and system_instruction.strip():
         gemini_payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}


    if response_schema:
        gemini_payload["generationConfig"]["responseSchema"] = response_schema


    ai_response_json = None
    try:
        print("--- Sending to Gemini ---")
        print(json.dumps(gemini_payload, indent=2, ensure_ascii=False))
        response = requests.post(gemini_api_url, headers={'Content-Type': 'application/json'}, json=gemini_payload)
        ai_response_json = response.json()
        print("--- Received from Gemini ---")
        print(json.dumps(ai_response_json, indent=2, ensure_ascii=False))
        response.raise_for_status()


        if response.status_code == 200 and ai_response_json:
            if 'candidates' not in ai_response_json and 'content' in ai_response_json:
                 ai_response_json = {"candidates": [{"content": ai_response_json['content']}]}

            if not ai_response_json.get('candidates'):
                error_message = "AI response has no candidates"
                block_reason = ai_response_json.get('promptFeedback', {}).get('blockReason')
                if block_reason:
                     error_message = f"AI request blocked: {block_reason}"
                     safety_ratings = ai_response_json.get('promptFeedback', {}).get('safetyRatings')
                     if safety_ratings:
                          error_message += f" (Details: {safety_ratings})"
                return jsonify({"error": error_message, "full_response_for_error": ai_response_json}), 500

            if not ai_response_json['candidates'][0].get('content') or not ai_response_json['candidates'][0]['content'].get('parts'):
                 finish_reason = ai_response_json['candidates'][0].get('finishReason', 'UNKNOWN')
                 safety_ratings = ai_response_json['candidates'][0].get('safetyRatings', [])
                 if finish_reason == 'SAFETY':
                     error_message = f"AI response blocked due to safety settings. Ratings: {safety_ratings}"
                 elif finish_reason == 'RECITATION':
                     error_message = f"AI response blocked due to recitation policy."
                 elif finish_reason == 'MAX_TOKENS':
                     return jsonify({"text_content": "[输出被截断]"})
                 else:
                     error_message = f"AI response missing content/parts. Finish reason: {finish_reason}"
                 return jsonify({"error": error_message, "full_response_for_error": ai_response_json}), 500


            text_content = ai_response_json['candidates'][0]['content']['parts'][0]['text']
            return jsonify({"text_content": text_content})
        else:
            error_message = ai_response_json.get("error", {}).get("message", "AI response format error or unknown error")
            return jsonify({"error": error_message, "full_response_for_error": ai_response_json}), response.status_code if response.status_code >= 400 else 500

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        exc_type, exc_value, exc_traceback_obj = sys.exc_info()
        traceback.print_tb(exc_traceback_obj, limit=2, file=sys.stderr)
        return jsonify({"error": f"Error processing AI response: {e}"}), 500

@app.route('/novelai-proxy', methods=['POST'])
def novelai_proxy():
    nai_api_key = request.json.get('nai_api_key')
    parameters = request.json.get('parameters')

    if not nai_api_key or not parameters:
        return jsonify({"error": "Missing NovelAI API Key or parameters"}), 400

    novelai_api_url = "https://image.novelai.net/ai/generate-image"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {nai_api_key}"
    }


    try:
        print("--- Sending to NovelAI ---")
        print(json.dumps(parameters, indent=2, ensure_ascii=False))
        response = requests.post(novelai_api_url, headers=headers, json=parameters)

        if not response.ok:
            error_msg = f"NovelAI API request failed with status code: {response.status_code}"
            try:
                error_detail = response.json()
                error_msg += f"\nError details: {error_detail.get('message', response.text)}"
            except json.JSONDecodeError:
                 error_msg += f"\nResponse content: {response.text}"

            if response.status_code == 401: error_msg += "\nPossible reason: Invalid or expired API Key"
            elif response.status_code == 402: error_msg += "\nPossible reason: Active subscription required"
            elif response.status_code == 400: error_msg += "\nPossible reason: Bad request parameters"
            elif response.status_code == 429: error_msg += "\nPossible reason: Rate limit exceeded"
            elif response.status_code >= 500: error_msg += "\nPossible reason: NovelAI server internal error"
            return jsonify({"error": error_msg}), response.status_code

        if response.status_code == 200:
            zip_buffer = io.BytesIO(response.content)
            try:
                with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                    image_filename = None
                    for name in zip_ref.namelist():
                        if not zip_ref.getinfo(name).is_dir() and name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                            image_filename = name
                            break

                    if not image_filename:
                        return jsonify({"error": "No image file found in the ZIP response"}), 500

                    image_bytes = zip_ref.read(image_filename)
                    base64_image = base64.b64encode(image_bytes).decode('utf-8')
                    mime_type = f"image/{os.path.splitext(image_filename)[1][1:].lower()}"
                    if mime_type == 'image/jpg': mime_type = 'image/jpeg'
                    image_data_url = f"data:{mime_type};base64,{base64_image}"
                    return jsonify({"imageDataUrl": image_data_url})
            except zipfile.BadZipFile:
                return jsonify({"error": "NovelAI returned an invalid ZIP file"}), 500
        else:
             return jsonify({"error": f"NovelAI returned unexpected status: {response.status_code}, Content-Type: {response.headers.get('Content-Type')}"}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Connection error to NovelAI: {e}"}), 500
    except Exception as e:
         return jsonify({"error": f"Error processing NovelAI response: {e}"}), 500


GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

@app.route('/models', methods=['GET'])
def list_models_proxy():
    api_key = request.args.get('key')
    if not api_key:
        return jsonify({"error": "API key is missing"}), 400

    models_api_url = f"{GEMINI_API_BASE_URL}?key={api_key}"
    try:
        response = requests.get(models_api_url)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to request model list: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to process model list response: {e}"}), 500

@app.route('/get-file-content', methods=['GET'])
def get_file_content():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    root_dir = os.path.dirname(os.path.abspath(__file__))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "Access denied outside project directory"}), 403

    if not os.path.exists(safe_path):
         return jsonify({"error": "File not found"}), 404

    try:
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": f"Failed to read file: {e}"}), 500

@app.route('/save-file-content', methods=['POST'])
def save_file_content():
    filename = request.json.get('filename')
    content = request.json.get('content')
    if not filename or content is None:
        return jsonify({"error": "Missing filename or content"}), 400

    root_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        dir_path = os.path.dirname(filename)
        if dir_path:
            full_dir_path = os.path.abspath(os.path.join(root_dir, dir_path))
            if not full_dir_path.startswith(root_dir):
                 return jsonify({"error": "Cannot create directory outside project"}), 403
            os.makedirs(full_dir_path, exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Failed to create directory: {e}"}), 500

    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "Access denied outside project directory"}), 403

    try:
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({"message": "File saved successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to save file: {e}"}), 500

@app.route('/process-novel-content', methods=['POST'])
def process_novel_content_route():
    content = request.json.get('content')
    if content is None:
        return jsonify({"error": "Missing novel content 'content'"}), 400

    SEGMENT_TARGET_LENGTH = 200
    AUTO_TOC_SEGMENT_THRESHOLD = 50
    CHAPTER_TITLE_MAX_LENGTH = 20

    def find_best_split_point(text, target_length, lookback=50):
        if len(text) <= target_length:
            return len(text)
        end_index = target_length
        best_split = -1
        split_chars = ['\n', '。', '！', '？', '.', '!', '?']
        search_start = max(0, end_index - lookback)
        for i in range(end_index, search_start -1, -1):
            if text[i] in split_chars:
                best_split = i + 1
                break
            if i > search_start and text[i-1:i+1] == '\n\n':
                 best_split = i
                 break
        if best_split != -1 and best_split > 0:
            return best_split
        return target_length

    try:
        normalized_content = content.replace('\r\n', '\n').replace('\r', '\n').strip()
        segments = []
        toc_entries = []
        current_pos = 0
        segment_id_counter = 0
        segments_since_last_toc = 0
        auto_chapter_counter = 0
        last_segment_id_for_toc = -1

        while current_pos < len(normalized_content):
            remaining_text = normalized_content[current_pos:]
            split_point = find_best_split_point(remaining_text, SEGMENT_TARGET_LENGTH)
            segment_content = remaining_text[:split_point].strip()

            if segment_content:
                segment_id = segment_id_counter
                segments.append({"id": segment_id, "content": segment_content})

                native_toc_found_in_segment = False
                lines = segment_content.split('\n')
                for line in lines:
                    trimmed_line = line.strip()
                    if trimmed_line.startswith('第') and len(trimmed_line) < CHAPTER_TITLE_MAX_LENGTH:
                        toc_entries.append({
                            "title": trimmed_line,
                            "segmentId": segment_id,
                            "type": "native"
                        })
                        segments_since_last_toc = 0
                        last_segment_id_for_toc = segment_id
                        native_toc_found_in_segment = True
                        break

                if not native_toc_found_in_segment:
                    segments_since_last_toc += 1
                    if segments_since_last_toc >= AUTO_TOC_SEGMENT_THRESHOLD and segment_id > last_segment_id_for_toc:
                         auto_chapter_counter += 1
                         toc_entries.append({
                             "title": f"Auto Paragraph {auto_chapter_counter}",
                             "segmentId": segment_id,
                             "type": "auto"
                         })
                         segments_since_last_toc = 0
                         last_segment_id_for_toc = segment_id

                segment_id_counter += 1

            current_pos += split_point

            while current_pos < len(normalized_content) and normalized_content[current_pos] == '\n':
                current_pos += 1

        toc_entries.sort(key=lambda x: x.get("segmentId", 0))

        return jsonify({"segments": segments, "toc": toc_entries})
    except Exception as e:
        print(f"Error processing novel content: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"Failed to process novel content: {e}"}), 500


@app.route('/history/<chatroom_name>', methods=['GET'])
def get_history(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    filepath = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, HISTORY_FILENAME))

    if not is_safe_path(filepath, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom name or path"}), 400

    if not os.path.exists(filepath):
        return jsonify([])

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            history_data = json.load(f)
        return jsonify(history_data)
    except Exception as e:
        return jsonify({"error": f"Failed to read history: {e}"}), 500

@app.route('/history/<chatroom_name>', methods=['POST'])
def save_history(chatroom_name):
    history_data = request.json
    if history_data is None or not isinstance(history_data, list):
        return jsonify({"error": "Invalid history data format"}), 400

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    filepath = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, HISTORY_FILENAME))

    if not is_safe_path(filepath, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom name or path"}), 400

    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False)
        return jsonify({"message": "History saved successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to save history: {e}"}), 500

@app.route('/history/<chatroom_name>', methods=['DELETE'])
def delete_history(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    filepath = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, HISTORY_FILENAME))

    if not is_safe_path(filepath, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom name or path"}), 400

    try:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"message": "History file deleted (if existed)"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete history file: {e}"}), 500

def _update_chatroom_config(chatroom_name, updates):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    config_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME))

    if not is_safe_path(config_path, base_dir=chatrooms_dir):
        raise ValueError("Invalid chatroom name or path")

    if not os.path.exists(config_path):
        raise FileNotFoundError("Chatroom config file not found")

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        if not isinstance(config_data, dict):
             config_data = {}
    except Exception as e:
        raise IOError(f"Failed to read chatroom config: {e}")

    for key, value in updates.items():
        if key in default_chatroom_config:
            config_data[key] = value

    if "roleStates" not in config_data:
        config_data["roleStates"] = {}
    if "roleDetailedStates" not in config_data:
        config_data["roleDetailedStates"] = {}
    if "overrideSettings" not in config_data:
        config_data["overrideSettings"] = default_chatroom_override_settings.copy()
    if "roleVisibility" not in config_data:
         config_data["roleVisibility"] = {}
    if "user" not in config_data:
         config_data["user"] = default_chatroom_config["user"]

    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise IOError(f"Failed to write chatroom config: {e}")

@app.route('/background/<chatroom_name>', methods=['POST'])
def set_background_image(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not is_safe_path(chatroom_path, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom name or path"}), 400
    if not os.path.isdir(chatroom_path):
        return jsonify({"error": "Chatroom directory not found"}), 404

    image_data_url = None
    file = None
    if 'image' in request.files:
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
        file_ext = os.path.splitext(file.filename)[1].lower()[1:]
        if not file_ext or file_ext not in allowed_extensions:
            return jsonify({"error": f"Unsupported file type: {file_ext}"}), 400
    elif request.json and 'imageDataUrl' in request.json:
        image_data_url = request.json['imageDataUrl']
        try:
            header, encoded = image_data_url.split(',', 1)
            mime_match = re.match(r'data:image/(\w+);base64', header)
            if not mime_match:
                return jsonify({"error": "Invalid image Data URL format"}), 400
            img_format = mime_match.group(1).lower()
            if img_format == 'jpeg': img_format = 'jpg'
            allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
            if img_format not in allowed_extensions:
                 return jsonify({"error": f"Unsupported image format: {img_format}"}), 400
            img_data = base64.b64decode(encoded)
            file_ext = img_format
        except Exception as e:
             return jsonify({"error": f"Failed to process image Data URL: {e}"}), 500
    else:
        return jsonify({"error": "Missing image file or image data"}), 400

    new_filename = f"background.{file_ext}"
    filepath = os.path.join(chatroom_path, new_filename)

    for ext in allowed_extensions:
         old_bg_path = os.path.join(chatroom_path, f"background.{ext}")
         if os.path.exists(old_bg_path) and old_bg_path != filepath:
             try:
                 os.remove(old_bg_path)
             except Exception as e:
                 print(f"Warning: Failed to remove old background {old_bg_path}: {e}", file=sys.stderr)

    try:
        if file:
            file.save(filepath)
        else:
            with open(filepath, 'wb') as f:
                f.write(img_data)

        _update_chatroom_config(chatroom_name, {"backgroundImageFilename": new_filename})
        relative_path = os.path.join(CHATROOMS_DIR, chatroom_name, new_filename).replace('\\', '/')
        return jsonify({"message": "Background image set successfully", "path": relative_path})
    except Exception as e:
        return jsonify({"error": f"Failed to save background image or update config: {e}"}), 500


@app.route('/background/<chatroom_name>', methods=['DELETE'])
def delete_background_image(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not is_safe_path(chatroom_path, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom name or path"}), 400
    if not os.path.isdir(chatroom_path):
        return jsonify({"message": "Chatroom directory not found, nothing to delete"}), 200

    deleted = False
    last_error = None
    possible_extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif']
    filename_to_remove = None

    try:
         with open(os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME), 'r', encoding='utf-8') as f:
             config_data = json.load(f)
         current_bg_filename = config_data.get("backgroundImageFilename")
         if current_bg_filename:
             filepath_to_remove = os.path.join(chatroom_path, current_bg_filename)
             if is_safe_path(filepath_to_remove, base_dir=chatroom_path) and os.path.exists(filepath_to_remove):
                  try:
                      os.remove(filepath_to_remove)
                      deleted = True
                  except Exception as e:
                      last_error = str(e)
             else:
                 print(f"Warning: Background filename '{current_bg_filename}' in config but file not found or unsafe.", file=sys.stderr)
         else:

             for ext in possible_extensions:
                 filepath = os.path.join(chatroom_path, f"background.{ext}")
                 if os.path.exists(filepath) and is_safe_path(filepath, base_dir=chatroom_path):
                     try:
                         os.remove(filepath)
                         deleted = True
                     except Exception as e:
                         last_error = str(e)

         if deleted or current_bg_filename:
            _update_chatroom_config(chatroom_name, {"backgroundImageFilename": None})

         if deleted:
             return jsonify({"message": "Background image deleted"})
         elif last_error:
              return jsonify({"error": f"Error deleting background image: {last_error}"}), 500
         else:
              return jsonify({"message": "No background image found to delete"})

    except Exception as e:
        return jsonify({"error": f"Error processing background deletion: {e}"}), 500

@app.route('/export-chatroom-zip/<chatroom_name>', methods=['GET'])
def export_chatroom_zip(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not is_safe_path(chatroom_path, base_dir=chatrooms_dir) or not os.path.isdir(chatroom_path):
        return jsonify({"error": "Chatroom not found or invalid path"}), 404

    memory_file = io.BytesIO()
    try:
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(chatroom_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, chatroom_path)
                    zf.write(file_path, arcname)

        memory_file.seek(0)
        download_name = f'chatroom_{chatroom_name}_{datetime.now().strftime("%Y%m%d%H%M")}.zip'
        return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name=download_name)

    except Exception as e:
        print(f"Error exporting chatroom {chatroom_name}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"Error exporting chatroom: {e}"}), 500

@app.route('/import-chatroom-zip', methods=['POST'])
def import_chatroom_zip():
    if 'chatroom_zip' not in request.files:
        return jsonify({"error": "No uploaded file found ('chatroom_zip')"}), 400

    file = request.files['chatroom_zip']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return jsonify({"error": "No file selected or invalid file type (must be .zip)"}), 400

    if file.content_length > MAX_ZIP_SIZE:
         return jsonify({"error": f"File too large (max {MAX_ZIP_SIZE // 1024 // 1024}MB)"}), 413

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    temp_extract_dir = os.path.join(chatrooms_dir, f"__import_temp_{uuid.uuid4()}__")
    imported_room_name = None
    final_room_name = None

    try:
        os.makedirs(temp_extract_dir, exist_ok=True)

        file_content = file.read()
        zip_buffer = io.BytesIO(file_content)

        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            if CHATROOM_CONFIG_FILENAME not in [os.path.basename(f) for f in zf.namelist() if not f.endswith('/')]:
                 raise ValueError(f"ZIP file is missing '{CHATROOM_CONFIG_FILENAME}' at the root level")

            zf.extractall(temp_extract_dir)


            config_path = os.path.join(temp_extract_dir, CHATROOM_CONFIG_FILENAME)
            if not os.path.exists(config_path):
                 raise ValueError(f"Extracted files missing '{CHATROOM_CONFIG_FILENAME}'")

            with open(config_path, 'r', encoding='utf-8') as f:
                room_config = json.load(f)
            if not isinstance(room_config, dict) or 'name' not in room_config:
                 raise ValueError(f"'{CHATROOM_CONFIG_FILENAME}' is invalid or missing 'name'")

            imported_room_name = room_config['name']
            if not imported_room_name or not isinstance(imported_room_name, str):
                 raise ValueError("Room name in config is invalid")

            if "overrideSettings" not in room_config:
                 room_config["overrideSettings"] = default_chatroom_override_settings.copy()
            else:
                current_override_settings = room_config["overrideSettings"]
                default_override_copy = default_chatroom_override_settings.copy()
                for section, default_section_config in default_override_copy.items():
                    if section not in current_override_settings:
                        current_override_settings[section] = default_section_config
                    else:
                        for key, default_value in default_section_config.items():
                            if key not in current_override_settings[section]:
                                current_override_settings[section][key] = default_value
            if "roleVisibility" not in room_config:
                 room_config["roleVisibility"] = {}
            if "user" not in room_config:
                room_config["user"] = default_chatroom_config["user"]


            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(room_config, f, indent=2, ensure_ascii=False)


        config = load_current_config()
        current_room_names = set(config['chatRoomOrder'])
        final_room_name = imported_room_name
        name_counter = 1
        while final_room_name in current_room_names:
            final_room_name = f"{imported_room_name}_imported_{name_counter}"
            name_counter += 1


        target_room_path = os.path.join(chatrooms_dir, final_room_name)
        shutil.move(temp_extract_dir, target_room_path)


        if final_room_name != imported_room_name:
            final_config_path = os.path.join(target_room_path, CHATROOM_CONFIG_FILENAME)
            try:
                with open(final_config_path, 'r', encoding='utf-8') as f:
                    final_room_config = json.load(f)
                final_room_config['name'] = final_room_name
                with open(final_config_path, 'w', encoding='utf-8') as f:
                    json.dump(final_room_config, f, indent=2, ensure_ascii=False)
            except Exception as e:
                 print(f"Warning: Failed to update room name in imported config '{final_config_path}': {e}", file=sys.stderr)


        config['chatRoomOrder'].append(final_room_name)
        save_current_config(config)

        return jsonify({"message": f"Chatroom '{imported_room_name}' successfully imported as '{final_room_name}'"})

    except (zipfile.BadZipFile, ValueError, FileNotFoundError) as e:
         if os.path.exists(temp_extract_dir):
             shutil.rmtree(temp_extract_dir, ignore_errors=True)
         return jsonify({"error": f"Import failed: {e}"}), 400
    except Exception as e:
        if os.path.exists(temp_extract_dir):
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
        print(f"Error importing chatroom: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"An unexpected error occurred during import: {e}"}), 500

@app.route('/export-full-config-zip', methods=['GET'])
def export_full_config_zip():
    memory_file = io.BytesIO()
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    try:
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:

            if os.path.exists(CONFIG_FILENAME):
                zf.write(CONFIG_FILENAME, CONFIG_FILENAME)


            if os.path.isdir(chatrooms_dir):
                for item in os.listdir(chatrooms_dir):
                    item_path = os.path.join(chatrooms_dir, item)
                    if os.path.isdir(item_path):
                         arc_dir = os.path.join(CHATROOMS_DIR, item)
                         for root, _, files in os.walk(item_path):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join(arc_dir, os.path.relpath(file_path, item_path))
                                zf.write(file_path, arcname)

        memory_file.seek(0)
        download_name = f'full_config_{datetime.now().strftime("%Y%m%d%H%M")}.zip'
        return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name=download_name)

    except Exception as e:
        print(f"Error exporting full config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"Error exporting full configuration: {e}"}), 500

@app.route('/import-full-config-zip', methods=['POST'])
def import_full_config_zip():
    if 'config_zip' not in request.files:
        return jsonify({"error": "No uploaded file found ('config_zip')"}), 400

    file = request.files['config_zip']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return jsonify({"error": "No file selected or invalid file type (must be .zip)"}), 400
    if file.content_length > MAX_ZIP_SIZE:
         return jsonify({"error": f"File too large (max {MAX_ZIP_SIZE // 1024 // 1024}MB)"}), 413

    project_root_abs = os.path.abspath(os.path.dirname(__file__))
    chatrooms_dir_abs = os.path.abspath(CHATROOMS_DIR)

    try:

        if os.path.exists(CONFIG_FILENAME):
            os.remove(CONFIG_FILENAME)
        if os.path.isdir(chatrooms_dir_abs):
            shutil.rmtree(chatrooms_dir_abs, ignore_errors=True)
        os.makedirs(chatrooms_dir_abs, exist_ok=True)

        with zipfile.ZipFile(file.stream, 'r') as zf:
            extract_list = zf.namelist()
            if CONFIG_FILENAME not in extract_list:
                raise ValueError("ZIP file is missing config.json")

            for member_info in zf.infolist():
                target_path_part = member_info.filename.replace('\\', '/')
                if '..' in target_path_part or target_path_part.startswith('/'):
                     print(f"Skipping potentially unsafe path in ZIP: {member_info.filename}", file=sys.stderr)
                     continue

                target_filepath_abs = None
                if target_path_part == CONFIG_FILENAME:
                     target_filepath_abs = os.path.join(project_root_abs, CONFIG_FILENAME)
                elif target_path_part.startswith(CHATROOMS_DIR + '/'):
                     target_filepath_abs = os.path.join(project_root_abs, target_path_part)
                     if not is_safe_path(target_filepath_abs, base_dir=chatrooms_dir_abs):
                         print(f"Skipping unsafe extracted chatroom path: {target_filepath_abs}", file=sys.stderr)
                         continue
                else:
                     print(f"Skipping unexpected file/folder in ZIP root: {member_info.filename}", file=sys.stderr)
                     continue

                if target_filepath_abs:
                    if member_info.is_dir():
                        os.makedirs(target_filepath_abs, exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(target_filepath_abs), exist_ok=True)
                        with zf.open(member_info) as source, open(target_filepath_abs, "wb") as target:
                            target.write(source.read())
                        if target_filepath_abs.endswith(CHATROOM_CONFIG_FILENAME):
                             try:
                                 with open(target_filepath_abs, 'r+', encoding='utf-8') as f:
                                     room_config = json.load(f)
                                     if "overrideSettings" not in room_config:
                                         room_config["overrideSettings"] = default_chatroom_override_settings.copy()
                                     else:
                                         current_override_settings = room_config["overrideSettings"]
                                         default_override_copy = default_chatroom_override_settings.copy()
                                         for section, default_section_config in default_override_copy.items():
                                             if section not in current_override_settings:
                                                 current_override_settings[section] = default_section_config
                                             else:
                                                 for key, default_value in default_section_config.items():
                                                     if key not in current_override_settings[section]:
                                                         current_override_settings[section][key] = default_value
                                     if "roleVisibility" not in room_config:
                                          room_config["roleVisibility"] = {}
                                     if "user" not in room_config:
                                         room_config["user"] = default_chatroom_config["user"]
                                     f.seek(0)
                                     json.dump(room_config, f, indent=2, ensure_ascii=False)
                                     f.truncate()
                             except Exception as e:
                                  print(f"Warning: Failed to check/update settings in imported {target_filepath_abs}: {e}", file=sys.stderr)


        load_current_config()

        return jsonify({"message": "Full configuration imported successfully!"})

    except (zipfile.BadZipFile, ValueError) as e:
        return jsonify({"error": f"Import failed: {e}"}), 400
    except Exception as e:
        print(f"Error importing full config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"An unexpected error occurred during import: {e}"}), 500

@app.route('/clear-all-config', methods=['POST'])
def clear_all_config_route():
    if request.method != 'POST':
        return jsonify({"error": "Only POST requests allowed"}), 405

    errors = []
    project_root_abs = os.path.abspath(os.path.dirname(__file__))
    chatrooms_dir_abs = os.path.abspath(CHATROOMS_DIR)
    images_generated_dir = os.path.abspath(os.path.join(IMAGES_DIR, GENERATED_SUBDIR))


    def safe_remove(path_to_remove):
        path_abs = os.path.abspath(path_to_remove)
        is_safe = path_abs.startswith(project_root_abs)

        if not is_safe and path_abs != chatrooms_dir_abs and not path_abs.startswith(images_generated_dir):
             errors.append(f"Skipping unsafe path: {path_to_remove}")
             return

        try:
            if os.path.isfile(path_abs):
                os.remove(path_abs)
            elif os.path.isdir(path_abs):
                if path_abs == chatrooms_dir_abs or path_abs == images_generated_dir:
                    shutil.rmtree(path_abs, ignore_errors=True)
                    os.makedirs(path_abs, exist_ok=True)
                else:
                    errors.append(f"Skipping directory removal for non-standard path: {path_to_remove}")
        except Exception as e:
            errors.append(f"Failed to remove {path_to_remove}: {e}")

    try:
        safe_remove(CONFIG_FILENAME)
        safe_remove(chatrooms_dir_abs)
        safe_remove(images_generated_dir)

        if not errors:
            return jsonify({"message": "All configuration and data successfully cleared!"})
        else:
            return jsonify({"error": "Errors occurred during cleanup.", "details": errors}), 500

    except Exception as e:
        print(f"Error during clear all config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        errors.append(f"An unexpected error occurred during cleanup: {e}")
        return jsonify({"error": "A critical error occurred while clearing configuration.", "details": errors}), 500


@app.route('/images/<subdir>/<path:filename>')
def serve_subdir_image(subdir, filename):
    if subdir != GENERATED_SUBDIR:
        return jsonify({"error": "Invalid image subdirectory"}), 404

    images_dir_abs = os.path.abspath(IMAGES_DIR)
    target_dir_abs = os.path.abspath(os.path.join(images_dir_abs, subdir))
    safe_path = os.path.abspath(os.path.join(target_dir_abs, filename))

    if not is_safe_path(safe_path, base_dir=images_dir_abs):
         return jsonify({"error": "Access denied outside allowed image directories"}), 403

    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
         return jsonify({"error": "Image file not found"}), 404

    return send_from_directory(target_dir_abs, filename)

@app.route(f'/{CHATROOMS_DIR}/<chatroom_name>/<filename>')
def serve_chatroom_file(chatroom_name, filename):
    chatrooms_dir_abs = os.path.abspath(CHATROOMS_DIR)
    chatroom_path_abs = os.path.abspath(os.path.join(chatrooms_dir_abs, chatroom_name))
    safe_path = os.path.abspath(os.path.join(chatroom_path_abs, filename))

    if not is_safe_path(safe_path, base_dir=chatrooms_dir_abs):
        return jsonify({"error": "Access denied outside chatrooms directory"}), 403
    if '..' in filename or filename.startswith('/'):
         return jsonify({"error": "Invalid filename path components"}), 403


    allowed_subdirs = ['', ROLES_SUBDIR, NOVELS_SUBDIR]
    file_subdir = os.path.dirname(filename)
    base_filename = os.path.basename(filename)

    if file_subdir not in allowed_subdirs:
         if not filename.startswith('background.'):
             return jsonify({"error": f"Access denied to this file type/location: {filename}"}), 403


    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
         return jsonify({"error": "File not found"}), 404

    return send_from_directory(chatroom_path_abs, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    if '..' in filename or filename.startswith('/') or filename.startswith(CHATROOMS_DIR):
         return jsonify({"error": "Access denied to this path"}), 403

    root_dir = os.path.dirname(os.path.abspath(__file__))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "Access denied outside project directory"}), 403

    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
         return jsonify({"error": "File not found"}), 404

    return send_from_directory(root_dir, filename)

@app.route('/')
def serve_frontend():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(root_dir, 'gemini_chat.html')

@app.route('/editor')
def serve_editor():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(root_dir, 'editor.html')

@app.route('/chatroom-details/<chatroom_name>', methods=['GET'])
def get_chatroom_details(chatroom_name):

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))
    if not is_safe_path(chatroom_path, base_dir=chatrooms_dir) or not os.path.isdir(chatroom_path):
        return jsonify({"error": "Chatroom not found"}), 404

    details = {"config": None, "roles": [], "novels": []}
    permanent_role_names = set()


    try:
        roles_path = os.path.join(chatroom_path, ROLES_SUBDIR)
        if os.path.isdir(roles_path):
            for filename in os.listdir(roles_path):
                if filename.endswith('.json'):
                    role_file_path = os.path.join(roles_path, filename)
                    if is_safe_path(role_file_path, base_dir=roles_path):
                        try:
                            with open(role_file_path, 'r', encoding='utf-8') as rf:
                                role_data = json.load(rf)
                                if 'name' in role_data:
                                    permanent_role_names.add(role_data['name'])
                                    role_data['isTemporary'] = False
                                    details["roles"].append(role_data)
                        except Exception as e:
                            print(f"Warning: Failed to load role file {filename}: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Warning: Error reading roles directory for {chatroom_name}: {e}", file=sys.stderr)


    try:
        config_path = os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME)
        config_needs_update = False
        with open(config_path, 'r+', encoding='utf-8') as f:
            details["config"] = json.load(f)
            if "roleDetailedStates" not in details["config"]:
                details["config"]["roleDetailedStates"] = {}
                config_needs_update = True
            if "overrideSettings" not in details["config"]:
                details["config"]["overrideSettings"] = default_chatroom_override_settings.copy()
                config_needs_update = True
            else:
                loaded_overrides = details["config"]["overrideSettings"]
                default_overrides_copy = default_chatroom_override_settings.copy()
                for section_key, default_section in default_overrides_copy.items():
                     if section_key not in loaded_overrides:
                         loaded_overrides[section_key] = default_section
                         config_needs_update = True
                     else:
                          loaded_section = loaded_overrides[section_key]
                          for key, default_value in default_section.items():
                              if key not in loaded_section:
                                  loaded_section[key] = default_value
                                  config_needs_update = True

            if "roleVisibility" not in details["config"] or not isinstance(details["config"]["roleVisibility"], dict):
                 details["config"]["roleVisibility"] = {}
                 config_needs_update = True

            if "user" not in details["config"]:
                details["config"]["user"] = default_chatroom_config["user"]
                config_needs_update = True

            current_visibility = details["config"]["roleVisibility"]
            for role_name in permanent_role_names:
                if role_name not in current_visibility:
                    current_visibility[role_name] = True
                    config_needs_update = True
                elif not isinstance(current_visibility[role_name], bool):
                     current_visibility[role_name] = True
                     config_needs_update = True

            for role_name in list(current_visibility.keys()):
                 if role_name != "管理员" and role_name not in permanent_role_names:
                      del current_visibility[role_name]
                      config_needs_update = True

            if config_needs_update:
                 f.seek(0)
                 json.dump(details["config"], f, indent=2, ensure_ascii=False)
                 f.truncate()

    except Exception as e:
        print(f"Error loading/processing chatroom config '{config_path}': {e}", file=sys.stderr)
        return jsonify({"error": f"Failed to load chatroom config: {e}"}), 500


    try:
        novels_path = os.path.join(chatroom_path, NOVELS_SUBDIR)
        if os.path.isdir(novels_path):
             for filename in os.listdir(novels_path):
                 if filename.endswith('.json'):
                    novel_file_path = os.path.join(novels_path, filename)
                    if is_safe_path(novel_file_path, base_dir=novels_path):
                         try:
                             with open(novel_file_path, 'r', encoding='utf-8') as nf:
                                 details["novels"].append(json.load(nf))
                         except Exception as e:
                             print(f"Warning: Failed to load novel file {filename}: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Warning: Error reading novels directory for {chatroom_name}: {e}", file=sys.stderr)

    return jsonify(details)


@app.route('/update-chatroom-config/<chatroom_name>', methods=['POST'])
def update_chatroom_config_route(chatroom_name):
    updates = request.json
    if not updates or not isinstance(updates, dict):
        return jsonify({"error": "Invalid update data"}), 400
    try:
        _update_chatroom_config(chatroom_name, updates)
        return jsonify({"message": "Chatroom config updated successfully"})
    except (FileNotFoundError, ValueError, IOError) as e:
        return jsonify({"error": str(e)}), 404 if isinstance(e, FileNotFoundError) else 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500


@app.route('/create-chatroom', methods=['POST'])
def create_chatroom_route():
    data = request.json
    new_name = data.get('chatroom_name')
    if not new_name or not isinstance(new_name, str) or '..' in new_name or '/' in new_name or '\\' in new_name:
        return jsonify({"error": "Invalid chatroom name"}), 400

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    new_room_path = os.path.abspath(os.path.join(chatrooms_dir, new_name))

    if not is_safe_path(new_room_path, base_dir=chatrooms_dir):
         return jsonify({"error": "Invalid chatroom path generated"}), 400
    if os.path.exists(new_room_path):
        return jsonify({"error": "Chatroom name already exists"}), 409

    try:
        os.makedirs(os.path.join(new_room_path, ROLES_SUBDIR), exist_ok=True)
        os.makedirs(os.path.join(new_room_path, NOVELS_SUBDIR), exist_ok=True)

        initial_config = default_chatroom_config.copy()
        initial_config["name"] = new_name

        with open(os.path.join(new_room_path, CHATROOM_CONFIG_FILENAME), 'w', encoding='utf-8') as f:
            json.dump(initial_config, f, indent=2, ensure_ascii=False)

        with open(os.path.join(new_room_path, HISTORY_FILENAME), 'w', encoding='utf-8') as f:
            json.dump([], f)

        config = load_current_config()
        if new_name not in config['chatRoomOrder']:
             config['chatRoomOrder'].append(new_name)
             save_current_config(config)

        return jsonify({"message": f"Chatroom '{new_name}' created successfully"}), 201

    except Exception as e:
        if os.path.exists(new_room_path):
             shutil.rmtree(new_room_path, ignore_errors=True)
        return jsonify({"error": f"Failed to create chatroom: {e}"}), 500

@app.route('/delete-chatroom/<chatroom_name>', methods=['DELETE'])
def delete_chatroom_route(chatroom_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    room_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name))

    if not is_safe_path(room_path, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid chatroom path"}), 400
    if not os.path.isdir(room_path):
        return jsonify({"error": "Chatroom not found"}), 404

    try:
        shutil.rmtree(room_path)
        config = load_current_config()
        if chatroom_name in config['chatRoomOrder']:
            config['chatRoomOrder'].remove(chatroom_name)
        if config['activeChatRoomName'] == chatroom_name:
            config['activeChatRoomName'] = config['chatRoomOrder'][0] if config['chatRoomOrder'] else None
        save_current_config(config)
        return jsonify({"message": f"Chatroom '{chatroom_name}' deleted successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete chatroom: {e}"}), 500


@app.route('/rename-chatroom/<old_name>', methods=['PUT'])
def rename_chatroom_route(old_name):
    data = request.json
    new_name = data.get('new_name')

    if not new_name or not isinstance(new_name, str) or '..' in new_name or '/' in new_name or '\\' in new_name:
        return jsonify({"error": "Invalid new chatroom name"}), 400
    if not old_name or not isinstance(old_name, str):
         return jsonify({"error": "Invalid old chatroom name"}), 400

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    old_path = os.path.abspath(os.path.join(chatrooms_dir, old_name))
    new_path = os.path.abspath(os.path.join(chatrooms_dir, new_name))

    if not is_safe_path(old_path, base_dir=chatrooms_dir):
        return jsonify({"error": "Invalid old chatroom path"}), 400
    if not os.path.isdir(old_path):
        return jsonify({"error": "Old chatroom not found"}), 404
    if not is_safe_path(new_path, base_dir=chatrooms_dir):
         return jsonify({"error": "Invalid new chatroom path"}), 400
    if os.path.exists(new_path):
        return jsonify({"error": "New chatroom name already exists"}), 409

    try:

        os.rename(old_path, new_path)


        config_file = os.path.join(new_path, CHATROOM_CONFIG_FILENAME)
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                room_config = json.load(f)
            room_config['name'] = new_name
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(room_config, f, indent=2, ensure_ascii=False)
        except Exception as e:
             print(f"Warning: Failed to update name in chatroom config during rename: {e}", file=sys.stderr)


        config = load_current_config()
        try:
            index = config['chatRoomOrder'].index(old_name)
            config['chatRoomOrder'][index] = new_name
        except ValueError:
             if new_name not in config['chatRoomOrder']:
                 config['chatRoomOrder'].append(new_name)

        if config['activeChatRoomName'] == old_name:
            config['activeChatRoomName'] = new_name
        save_current_config(config)

        return jsonify({"message": f"Chatroom renamed from '{old_name}' to '{new_name}'"})
    except Exception as e:

        if not os.path.exists(old_path) and os.path.exists(new_path):
             try: os.rename(new_path, old_path)
             except: pass
        return jsonify({"error": f"Failed to rename chatroom: {e}"}), 500


@app.route('/roles/<chatroom_name>', methods=['POST'])
def create_role_route(chatroom_name):
     role_data = request.json
     role_name = role_data.get('name') if isinstance(role_data, dict) else None
     if not role_name or not isinstance(role_name, str) or '..' in role_name or '/' in role_name or '\\' in role_name:
         return jsonify({"error": "Invalid role name"}), 400

     chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
     roles_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, ROLES_SUBDIR))
     role_file_path = os.path.abspath(os.path.join(roles_dir, f"{role_name}.json"))
     config_path = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME))

     if not is_safe_path(roles_dir, base_dir=chatrooms_dir) or not is_safe_path(role_file_path, base_dir=roles_dir):
         return jsonify({"error": "Invalid role path"}), 400
     if not os.path.isdir(roles_dir):
         os.makedirs(roles_dir, exist_ok=True)
     if os.path.exists(role_file_path):
         return jsonify({"error": "Role already exists"}), 409

     role_definition = {
         "name": role_name,
         "setting": role_data.get("setting", ""),
         "memory": role_data.get("memory", ""),
         "drawingTemplate": role_data.get("drawingTemplate", "")
     }

     try:
         with open(role_file_path, 'w', encoding='utf-8') as f:
             json.dump(role_definition, f, indent=2, ensure_ascii=False)

         try:
             if not os.path.exists(config_path):
                  raise FileNotFoundError("Chatroom config file not found.")

             with open(config_path, 'r+', encoding='utf-8') as f:
                 room_config = json.load(f)
                 if not isinstance(room_config, dict):
                     room_config = {}

                 if 'roleStates' not in room_config or not isinstance(room_config['roleStates'], dict):
                     room_config['roleStates'] = {}
                 room_config['roleStates'][role_name] = "默"

                 if 'roleDetailedStates' not in room_config or not isinstance(room_config['roleDetailedStates'], dict):
                     room_config['roleDetailedStates'] = {}
                 room_config['roleDetailedStates'][role_name] = ""

                 if 'roleVisibility' not in room_config or not isinstance(room_config['roleVisibility'], dict):
                     room_config['roleVisibility'] = {}
                 room_config['roleVisibility'][role_name] = True

                 f.seek(0)
                 json.dump(room_config, f, indent=2, ensure_ascii=False)
                 f.truncate()

         except Exception as update_e:
              print(f"Warning: Role file created, but failed to update chatroom config states: {update_e}", file=sys.stderr)
              if os.path.exists(role_file_path):
                   try: os.remove(role_file_path)
                   except Exception as rem_e: print(f"Also failed to remove role file after config update failure: {rem_e}", file=sys.stderr)
              return jsonify({"error": f"Failed to update chatroom config: {update_e}"}), 500

         return jsonify({"message": f"Role '{role_name}' created successfully"}), 201
     except Exception as e:
         if os.path.exists(role_file_path):
            try: os.remove(role_file_path)
            except: pass
         return jsonify({"error": f"Failed to create role file or update config: {e}"}), 500


@app.route('/roles/<chatroom_name>/<role_name>', methods=['PUT'])
def update_role_route(chatroom_name, role_name):
    role_data = request.json
    new_name = role_data.get('name') if isinstance(role_data, dict) else None
    if not new_name or not isinstance(new_name, str) or '..' in new_name or '/' in new_name or '\\' in new_name:
        return jsonify({"error": "Invalid role name in update data"}), 400

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    roles_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, ROLES_SUBDIR))
    old_file_path = os.path.abspath(os.path.join(roles_dir, f"{role_name}.json"))
    new_file_path = os.path.abspath(os.path.join(roles_dir, f"{new_name}.json"))

    if not is_safe_path(roles_dir, base_dir=chatrooms_dir) or \
       not is_safe_path(old_file_path, base_dir=roles_dir) or \
       not is_safe_path(new_file_path, base_dir=roles_dir):
        return jsonify({"error": "Invalid role path"}), 400
    if not os.path.exists(old_file_path):
        return jsonify({"error": "Role not found"}), 404
    if role_name != new_name and os.path.exists(new_file_path):
        return jsonify({"error": "New role name already exists"}), 409

    role_definition = {
        "name": new_name,
        "setting": role_data.get("setting", ""),
        "memory": role_data.get("memory", ""),
        "drawingTemplate": role_data.get("drawingTemplate", "")
    }

    try:
        with open(old_file_path if role_name == new_name else new_file_path, 'w', encoding='utf-8') as f:
             json.dump(role_definition, f, indent=2, ensure_ascii=False)
        if role_name != new_name:
             os.remove(old_file_path)


             try:
                  config_path = os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME)
                  with open(config_path, 'r+', encoding='utf-8') as f:
                      room_config = json.load(f)
                      updated_config = False
                      visibility_value = True

                      if 'roleVisibility' in room_config and role_name in room_config['roleVisibility']:
                            visibility_value = room_config['roleVisibility'].pop(role_name)
                            room_config['roleVisibility'][new_name] = visibility_value
                            updated_config = True

                      if 'roleStates' in room_config and role_name in room_config['roleStates']:
                          room_config['roleStates'][new_name] = room_config['roleStates'].pop(role_name)
                          updated_config = True
                      if 'roleDetailedStates' in room_config and role_name in room_config['roleDetailedStates']:
                          room_config['roleDetailedStates'][new_name] = room_config['roleDetailedStates'].pop(role_name)
                          updated_config = True

                      if updated_config:
                          f.seek(0)
                          json.dump(room_config, f, indent=2, ensure_ascii=False)
                          f.truncate()
             except Exception as update_e:
                  print(f"Warning: Role file renamed/updated, but failed to update chatroom config states/visibility: {update_e}", file=sys.stderr)

        return jsonify({"message": f"Role '{new_name}' updated successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to update role: {e}"}), 500


@app.route('/roles/<chatroom_name>/<role_name>', methods=['DELETE'])
def delete_role_route(chatroom_name, role_name):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    roles_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, ROLES_SUBDIR))
    role_file_path = os.path.abspath(os.path.join(roles_dir, f"{role_name}.json"))

    if not is_safe_path(roles_dir, base_dir=chatrooms_dir) or not is_safe_path(role_file_path, base_dir=roles_dir):
        return jsonify({"error": "Invalid role path"}), 400
    if not os.path.exists(role_file_path):
        return jsonify({"error": "Role file not found"}), 404

    try:
        os.remove(role_file_path)

        try:
             config_path = os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME)
             with open(config_path, 'r+', encoding='utf-8') as f:
                 room_config = json.load(f)
                 updated_config = False
                 if 'roleStates' in room_config and role_name in room_config['roleStates']:
                     del room_config['roleStates'][role_name]
                     updated_config = True
                 if 'roleDetailedStates' in room_config and role_name in room_config['roleDetailedStates']:
                     del room_config['roleDetailedStates'][role_name]
                     updated_config = True
                 if 'roleVisibility' in room_config and role_name in room_config['roleVisibility']:
                     del room_config['roleVisibility'][role_name]
                     updated_config = True

                 if updated_config:
                     f.seek(0)
                     json.dump(room_config, f, indent=2, ensure_ascii=False)
                     f.truncate()
        except Exception as update_e:
             print(f"Warning: Role file deleted, but failed to update chatroom config states/visibility: {update_e}", file=sys.stderr)

        return jsonify({"message": f"Role '{role_name}' deleted successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete role: {e}"}), 500


@app.route('/novels/<chatroom_name>', methods=['POST'])
def create_novel_route(chatroom_name):
    novel_data = request.json
    novel_id = novel_data.get('id') if isinstance(novel_data, dict) else None
    novel_name = novel_data.get('name') if isinstance(novel_data, dict) else None

    if not novel_id or not isinstance(novel_id, str) or '..' in novel_id or '/' in novel_id or '\\' in novel_id:
        return jsonify({"error": "Invalid or missing novel ID"}), 400
    if not novel_name:
         novel_name = f"Novel_{novel_id}"

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    novels_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir, f"{novel_id}.json"))

    if not is_safe_path(novels_dir, base_dir=chatrooms_dir) or not is_safe_path(novel_file_path, base_dir=novels_dir):
        return jsonify({"error": "Invalid novel path"}), 400
    if not os.path.isdir(novels_dir):
         os.makedirs(novels_dir, exist_ok=True)
    if os.path.exists(novel_file_path):
        return jsonify({"error": "Novel ID already exists"}), 409

    novel_definition = {
        "id": novel_id,
        "name": novel_name,
        "segments": novel_data.get("segments", []),
        "toc": novel_data.get("toc", [])
    }

    try:
        with open(novel_file_path, 'w', encoding='utf-8') as f:
            json.dump(novel_definition, f, indent=2, ensure_ascii=False)
        return jsonify({"message": f"Novel '{novel_name}' (ID: {novel_id}) created successfully"}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create novel file: {e}"}), 500


@app.route('/novels/<chatroom_name>/<novel_id>', methods=['PUT'])
def update_novel_route(chatroom_name, novel_id):
    novel_data = request.json
    new_name = novel_data.get('name') if isinstance(novel_data, dict) else None

    if not novel_id or not isinstance(novel_id, str):
        return jsonify({"error": "Invalid novel ID in URL"}), 400
    if not new_name:
         new_name = f"Novel_{novel_id}"

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    novels_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir, f"{novel_id}.json"))

    if not is_safe_path(novels_dir, base_dir=chatrooms_dir) or not is_safe_path(novel_file_path, base_dir=novels_dir):
        return jsonify({"error": "Invalid novel path"}), 400
    if not os.path.exists(novel_file_path):
        return jsonify({"error": "Novel not found"}), 404

    novel_definition = {
        "id": novel_id,
        "name": new_name,
        "segments": novel_data.get("segments", []),
        "toc": novel_data.get("toc", [])
    }

    try:
        with open(novel_file_path, 'w', encoding='utf-8') as f:
            json.dump(novel_definition, f, indent=2, ensure_ascii=False)
        return jsonify({"message": f"Novel '{new_name}' (ID: {novel_id}) updated successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to update novel file: {e}"}), 500


@app.route('/novels/<chatroom_name>/<novel_id>', methods=['DELETE'])
def delete_novel_route(chatroom_name, novel_id):
    if not novel_id or not isinstance(novel_id, str):
        return jsonify({"error": "Invalid novel ID in URL"}), 400

    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    novels_dir = os.path.abspath(os.path.join(chatrooms_dir, chatroom_name, NOVELS_SUBDIR))
    novel_file_path = os.path.abspath(os.path.join(novels_dir, f"{novel_id}.json"))

    if not is_safe_path(novels_dir, base_dir=chatrooms_dir) or not is_safe_path(novel_file_path, base_dir=novels_dir):
        return jsonify({"error": "Invalid novel path"}), 400
    if not os.path.exists(novel_file_path):
        return jsonify({"error": "Novel file not found"}), 404

    try:
        os.remove(novel_file_path)

        try:
             config_path = os.path.join(chatrooms_dir, chatroom_name, CHATROOM_CONFIG_FILENAME)
             with open(config_path, 'r+', encoding='utf-8') as f:
                 room_config = json.load(f)
                 updated = False
                 if 'activeNovelIds' in room_config and novel_id in room_config['activeNovelIds']:
                     room_config['activeNovelIds'].remove(novel_id)
                     updated = True
                 if 'novelCurrentSegmentIds' in room_config and novel_id in room_config['novelCurrentSegmentIds']:
                     del room_config['novelCurrentSegmentIds'][novel_id]
                     updated = True
                 if updated:
                     f.seek(0)
                     json.dump(room_config, f, indent=2, ensure_ascii=False)
                     f.truncate()
        except Exception as update_e:
             print(f"Warning: Novel file deleted, but failed to update chatroom config: {update_e}", file=sys.stderr)

        return jsonify({"message": f"Novel ID '{novel_id}' deleted successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete novel: {e}"}), 500


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=8888)