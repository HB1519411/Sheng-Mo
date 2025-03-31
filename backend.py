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
NOVELS_DIR = 'novels'
HISTORY_DIR = 'history'
ROLES_DIR = 'roles'
IMAGES_DIR = 'images'
BACKGROUNDS_SUBDIR = 'backgrounds'
GENERATED_SUBDIR = 'generated'

SEGMENT_TARGET_LENGTH = 200
AUTO_TOC_SEGMENT_THRESHOLD = 100
MAX_ZIP_SIZE = 100 * 1024 * 1024
CHAPTER_TITLE_MAX_LENGTH = 50

default_config = {
    "primaryModel": "",
    "secondaryModel": "",
    "temperature": "1.0",
    "topP": "0.9",
    "topK": "40",
    "maxOutputTokens": "2048",
    "systemInstruction": "",
    "responseMimeType": "application/json",
    "user1Instruction": "",
    "user2Instruction": "",
    "model1Instruction": "",
    "model2Instruction": "",
    "user3Instruction": "",
    "responseSchemaJson": "",
    "responseSchemaParserJs": "",
    "roles": [],
    "temporaryRoles": ["管理员"],
    "toolSettings": {
        "drawingMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "user2Instruction": "", "enabled": False, "display": True },
        "gameHost": { "responseSchemaJson": "", "responseSchemaParserJs": "", "user2Instruction": "", "enabled": False, "display": True },
        "writingMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "user2Instruction": "", "enabled": False, "display": True },
        "characterUpdateMaster": { "responseSchemaJson": "", "responseSchemaParserJs": "", "user2Instruction": "", "enabled": False, "display": True },
    },
    "chatRooms": [
        {
            "name": "默认",
            "roles": ["管理员"],
            "associatedNovelIds": [],
            "roleplayRules": "",
            "publicInfo": "",
            "backgroundImagePath": None
        }
    ],
    "activeChatRoomName": "默认",
    "isRunPaused": True,
    "isRoleListVisible": False,
    "roleStates": {},
    "errorLogs": [],
    "novels": [],
    "activeNovelIdsInChatroom": {},
    "lastViewedNovelId": None,
    "referenceTextLength": 10000,
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
    "novelCurrentSegmentIds": {},
}

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

os.makedirs(NOVELS_DIR, exist_ok=True)
os.makedirs(HISTORY_DIR, exist_ok=True)
os.makedirs(ROLES_DIR, exist_ok=True)
os.makedirs(os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR), exist_ok=True)
os.makedirs(os.path.join(IMAGES_DIR, GENERATED_SUBDIR), exist_ok=True)

@app.errorhandler(Exception)
def handle_exception(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    print(f"Unhandled Exception: {e}", file=sys.stderr)
    traceback.print_tb(exc_traceback, limit=5, file=sys.stderr)
    response = jsonify({"error": "Internal Server Error", "details": str(e)})
    response.status_code = 500
    return response

def is_safe_path(path):
    project_root_abs = os.path.abspath(os.path.dirname(__file__))
    target_path_abs = os.path.abspath(path)
    return target_path_abs.startswith(project_root_abs)


def load_current_config():
    if os.path.exists(CONFIG_FILENAME):
        try:
            with open(CONFIG_FILENAME, 'r', encoding='utf-8') as f:
                 config_data = json.load(f)
                 if 'novelScrollPositions' in config_data:
                    if 'novelCurrentSegmentIds' not in config_data:
                        config_data['novelCurrentSegmentIds'] = {}
                    del config_data['novelScrollPositions']
                 if 'apiKeys' in config_data: del config_data['apiKeys']
                 if 'currentApiKeyIndex' in config_data: del config_data['currentApiKeyIndex']
                 if 'novelaiApiKey' in config_data: del config_data['novelaiApiKey']
                 if 'chatroomHistories' in config_data: del config_data['chatroomHistories']
                 for key in list(config_data.keys()):
                     if key.endswith('_setting') or key.endswith('_memory') or key.endswith('_drawingTemplate'):
                         del config_data[key]
                 if 'chatRooms' in config_data and isinstance(config_data['chatRooms'], list):
                     for room in config_data['chatRooms']:
                         if isinstance(room, dict):
                             if 'backgroundImageUrl' in room:
                                 if 'backgroundImagePath' not in room:
                                     room['backgroundImagePath'] = None
                                 del room['backgroundImageUrl']
                 return config_data
        except Exception as e:
            print(f"Error loading config: {e}", file=sys.stderr)
            clean_default = default_config.copy()
            if 'apiKeys' in clean_default: del clean_default['apiKeys']
            if 'currentApiKeyIndex' in clean_default: del clean_default['currentApiKeyIndex']
            if 'novelaiApiKey' in clean_default: del clean_default['novelaiApiKey']
            if 'chatroomHistories' in clean_default: del clean_default['chatroomHistories']
            return clean_default
    clean_default = default_config.copy()
    if 'apiKeys' in clean_default: del clean_default['apiKeys']
    if 'currentApiKeyIndex' in clean_default: del clean_default['currentApiKeyIndex']
    if 'novelaiApiKey' in clean_default: del clean_default['novelaiApiKey']
    if 'chatroomHistories' in clean_default: del clean_default['chatroomHistories']
    return clean_default

def save_current_config(config_data):
    clean_config = config_data.copy()
    if 'apiKeys' in clean_config: del clean_config['apiKeys']
    if 'currentApiKeyIndex' in clean_config: del clean_config['currentApiKeyIndex']
    if 'novelaiApiKey' in clean_config: del clean_config['novelaiApiKey']
    if 'chatroomHistories' in clean_config: del clean_config['chatroomHistories']
    if 'novelScrollPositions' in clean_config: del clean_config['novelScrollPositions']
    for key in list(clean_config.keys()):
        if key.endswith('_setting') or key.endswith('_memory') or key.endswith('_drawingTemplate'):
            del clean_config[key]
    if 'chatRooms' in clean_config and isinstance(clean_config['chatRooms'], list):
        for room in clean_config['chatRooms']:
            if isinstance(room, dict) and 'backgroundImageUrl' in room:
                del room['backgroundImageUrl']
            if isinstance(room, dict) and 'backgroundImagePath' not in room:
                room['backgroundImagePath'] = None
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
        return jsonify({"error": "缺少配置数据"}), 400

    try:
        save_current_config(config_data)
        return jsonify({"message": "配置自动保存成功"})
    except Exception as e:
        return jsonify({"error": f"自动保存失败: {e}"}), 500

@app.route('/load-config', methods=['GET'])
def load_config_route():
    merged_config = default_config.copy()
    if 'apiKeys' in merged_config: del merged_config['apiKeys']
    if 'currentApiKeyIndex' in merged_config: del merged_config['currentApiKeyIndex']
    if 'novelaiApiKey' in merged_config: del merged_config['novelaiApiKey']
    if 'chatroomHistories' in merged_config: del merged_config['chatroomHistories']

    if os.path.exists(CONFIG_FILENAME):
        try:
            with open(CONFIG_FILENAME, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
        except Exception as e:
            print(f"Error reading/parsing config.json: {e}", file=sys.stderr)
            config_data = {}

        explicitly_handled_keys = set([
            'toolSettings', 'roleStates', 'chatRooms',
            'novels', 'activeNovelIdsInChatroom', 'temporaryRoles', 'primaryModel',
            'secondaryModel', 'referenceTextLength', 'selectedModel',
            'novelCurrentSegmentIds', 'novelScrollPositions',
            'backgroundImageUrl', 'backgroundImagePath', 'roles',
            'apiKeys', 'currentApiKeyIndex', 'novelaiApiKey', 'chatroomHistories'
        ])

        for key in config_data:
            if key not in explicitly_handled_keys:
                 merged_config[key] = config_data[key]
            elif key in default_config and key not in ['apiKeys', 'currentApiKeyIndex', 'novelaiApiKey', 'chatroomHistories']:
                 merged_config[key] = config_data[key]

        if config_data.get('primaryModel'):
            merged_config['primaryModel'] = config_data['primaryModel']
        elif config_data.get('selectedModel'):
            merged_config['primaryModel'] = config_data['selectedModel']
        if config_data.get('secondaryModel'):
            merged_config['secondaryModel'] = config_data['secondaryModel']
        elif config_data.get('selectedModel') and not merged_config['secondaryModel']:
            merged_config['secondaryModel'] = config_data['selectedModel']

        merged_config['toolSettings'] = default_config['toolSettings'].copy()
        if config_data.get('toolSettings') and isinstance(config_data['toolSettings'], dict):
            for toolName in default_config['toolSettings']:
                 if config_data['toolSettings'].get(toolName) and isinstance(config_data['toolSettings'][toolName], dict):

                     tool_copy = default_config['toolSettings'][toolName].copy()
                     tool_copy.update(config_data['toolSettings'][toolName])
                     merged_config['toolSettings'][toolName] = tool_copy

        merged_config['roleStates'] = default_config['roleStates'].copy()
        if config_data.get('roleStates') and isinstance(config_data['roleStates'], dict):
            merged_config['roleStates'].update(config_data['roleStates'])

        if config_data.get('novelCurrentSegmentIds') and isinstance(config_data['novelCurrentSegmentIds'], dict):
             merged_config['novelCurrentSegmentIds'] = config_data['novelCurrentSegmentIds']
        elif config_data.get('novelScrollPositions') and isinstance(config_data['novelScrollPositions'], dict):
             merged_config['novelCurrentSegmentIds'] = {}
        else:
             merged_config['novelCurrentSegmentIds'] = {}

        merged_config['novels'] = [n for n in config_data.get('novels', []) if isinstance(n, dict) and 'id' in n and 'name' in n and 'filename' in n]
        merged_config['roles'] = [r for r in config_data.get('roles', []) if isinstance(r, str) and r.strip()]

        if isinstance(config_data.get('temporaryRoles'), list):
            merged_config['temporaryRoles'] = list(set(["管理员"] + config_data['temporaryRoles']))
        else:
            merged_config['temporaryRoles'] = ["管理员"]

        if isinstance(config_data.get('referenceTextLength'), int) and config_data['referenceTextLength'] > 0:
            merged_config['referenceTextLength'] = config_data['referenceTextLength']
        else:
            merged_config['referenceTextLength'] = default_config['referenceTextLength']

        merged_config['activeNovelIdsInChatroom'] = config_data.get('activeNovelIdsInChatroom', {})
        for roomName in merged_config['activeNovelIdsInChatroom']:
            if not isinstance(merged_config['activeNovelIdsInChatroom'][roomName], list):
                merged_config['activeNovelIdsInChatroom'][roomName] = []

        merged_config['lastViewedNovelId'] = config_data.get('lastViewedNovelId', None)

        if isinstance(config_data.get('chatRooms'), list):
            merged_config['chatRooms'] = []
            all_temporary_roles = merged_config.get('temporaryRoles', ["管理员"])
            for room_data in config_data['chatRooms']:
                if isinstance(room_data, dict):
                    default_room = {
                        "name": f"聊天室_{uuid.uuid4().hex[:6]}",
                        "roles": list(all_temporary_roles),
                        "associatedNovelIds": [],
                        "roleplayRules": "",
                        "publicInfo": "",
                        "backgroundImagePath": None
                    }
                    new_room = default_room.copy()
                    new_room.update(room_data)
                    new_room['roles'] = list(set(new_room.get('roles', []) + all_temporary_roles))
                    new_room['associatedNovelIds'] = new_room.get('associatedNovelIds', []) if isinstance(new_room.get('associatedNovelIds'), list) else []
                    new_room['roleplayRules'] = new_room.get('roleplayRules', "") if isinstance(new_room.get('roleplayRules'), str) else ""
                    new_room['publicInfo'] = new_room.get('publicInfo', "") if isinstance(new_room.get('publicInfo'), str) else ""
                    if 'backgroundImageUrl' in new_room: del new_room['backgroundImageUrl']
                    new_room['backgroundImagePath'] = new_room.get('backgroundImagePath') if isinstance(new_room.get('backgroundImagePath'), str) else None
                    merged_config['chatRooms'].append(new_room)
        else:
             merged_config['chatRooms'] = [default_config['chatRooms'][0].copy()]

        if not merged_config['chatRooms']:
             merged_config['chatRooms'] = [default_config['chatRooms'][0].copy()]

        nai_keys_to_check = [
            "novelaiModel", "novelaiArtistChain", "novelaiDefaultPositivePrompt", "novelaiDefaultNegativePrompt",
            "novelaiWidth", "novelaiHeight", "novelaiSteps", "novelaiScale",
            "novelaiCfgRescale", "novelaiSampler", "novelaiNoiseSchedule", "novelaiSeed"
        ]
        for key in nai_keys_to_check:
            if key not in merged_config:
                merged_config[key] = default_config[key]

        valid_novel_ids = {n['id'] for n in merged_config['novels']}
        valid_role_names = set(merged_config['roles']) | set(merged_config['temporaryRoles'])
        for room in merged_config['chatRooms']:
            room['associatedNovelIds'] = [nid for nid in room.get('associatedNovelIds', []) if nid in valid_novel_ids]
            room['roles'] = [rname for rname in room.get('roles', []) if rname in valid_role_names]
            merged_config['activeNovelIdsInChatroom'][room['name']] = [nid for nid in merged_config['activeNovelIdsInChatroom'].get(room['name'], []) if nid in valid_novel_ids and nid in room['associatedNovelIds']]

        if merged_config['lastViewedNovelId'] and merged_config['lastViewedNovelId'] not in valid_novel_ids:
             merged_config['lastViewedNovelId'] = None

        if not any(room['name'] == merged_config.get('activeChatRoomName') for room in merged_config['chatRooms']):
            merged_config['activeChatRoomName'] = merged_config['chatRooms'][0]['name'] if merged_config['chatRooms'] else None

        for novel_id in list(merged_config['novelCurrentSegmentIds']):
            if novel_id not in valid_novel_ids:
                 del merged_config['novelCurrentSegmentIds'][novel_id]


        keys_to_remove = [k for k in merged_config if k.endswith('_setting') or k.endswith('_memory') or k.endswith('_drawingTemplate')]
        for k in keys_to_remove:
            if k in merged_config: del merged_config[k]

    return jsonify(merged_config)

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
        return jsonify({"error": "缺少必要参数 (apiKey, model, contents)"}), 400

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
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }

    if system_instruction:
         gemini_payload["systemInstruction"] = {"parts": [{"text": system_instruction['parts'][0]['text']}]} if isinstance(system_instruction, dict) else {"parts": [{"text": str(system_instruction)}]}

    if response_schema:
        gemini_payload["generationConfig"]["responseSchema"] = response_schema

    print("--- BACKEND -> GOOGLE AI ---")
    print(json.dumps(gemini_payload, indent=2, ensure_ascii=False))

    ai_response_json = None
    try:
        response = requests.post(gemini_api_url, headers={'Content-Type': 'application/json'}, json=gemini_payload)
        response.raise_for_status()
        ai_response_json = response.json()

        print("--- GOOGLE AI -> BACKEND ---")
        print(json.dumps(ai_response_json, indent=2, ensure_ascii=False))

        if response.status_code == 200 and ai_response_json and ('candidates' in ai_response_json or 'content' in ai_response_json):
            if 'candidates' not in ai_response_json and 'content' in ai_response_json:
                 ai_response_json = {"candidates": [{"content": ai_response_json['content']}]}
            elif not ai_response_json.get('candidates'):
                error_message = "AI 响应中无候选内容"
                block_reason = ai_response_json.get('promptFeedback', {}).get('blockReason')
                if block_reason:
                     error_message = f"AI 请求被阻止: {block_reason}"
                     safety_ratings = ai_response_json.get('promptFeedback', {}).get('safetyRatings')
                     if safety_ratings:
                          error_message += f" (详细信息: {safety_ratings})"
                return jsonify({"error": error_message, "full_response_for_error": ai_response_json}), 500

            text_content = ai_response_json['candidates'][0]['content']['parts'][0]['text']
            return jsonify({"text_content": text_content})
        else:
            error_message = ai_response_json.get("error", {}).get("message", "AI 响应格式错误或未知错误")
            return jsonify({"error": error_message, "full_response_for_error": ai_response_json}), response.status_code if response.status_code >= 400 else 500

    except requests.exceptions.RequestException as e:
        print("--- GOOGLE AI -> BACKEND (Request Exception) ---")
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print("--- GOOGLE AI -> BACKEND (General Exception) ---")
        print(f"Error: {e}")
        if ai_response_json:
            print(json.dumps(ai_response_json, indent=2, ensure_ascii=False))
        exc_type, exc_value, exc_traceback_obj = sys.exc_info()
        traceback.print_tb(exc_traceback_obj, limit=2, file=sys.stderr)
        return jsonify({"error": f"处理 AI 响应时出错: {e}"}), 500

@app.route('/novelai-proxy', methods=['POST'])
def novelai_proxy():
    nai_api_key = request.json.get('nai_api_key')
    parameters = request.json.get('parameters')

    if not nai_api_key or not parameters:
        return jsonify({"error": "缺少 NovelAI API Key 或参数"}), 400

    novelai_api_url = "https://image.novelai.net/ai/generate-image"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {nai_api_key}"
    }

    print("--- BACKEND -> NOVELAI ---")
    print(json.dumps({"parameters": parameters}, indent=2, ensure_ascii=False))

    try:
        response = requests.post(novelai_api_url, headers=headers, json=parameters)

        if not response.ok:
            error_msg = f"NovelAI API 请求失败，状态码: {response.status_code}"
            try:
                error_detail = response.json()
                error_msg += f"\n错误详情: {error_detail.get('message', response.text)}"
            except json.JSONDecodeError:
                 error_msg += f"\n响应内容: {response.text}"

            if response.status_code == 401: error_msg += "\n可能原因：API Key 无效或过期"
            elif response.status_code == 402: error_msg += "\n可能原因：需要有效订阅"
            elif response.status_code == 400: error_msg += "\n可能原因：请求参数错误"
            elif response.status_code == 429: error_msg += "\n可能原因：请求过于频繁"
            elif response.status_code >= 500: error_msg += "\n可能原因：NovelAI 服务器内部错误"
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
                        return jsonify({"error": "ZIP 响应中未找到图片文件"}), 500

                    image_bytes = zip_ref.read(image_filename)
                    base64_image = base64.b64encode(image_bytes).decode('utf-8')
                    mime_type = f"image/{os.path.splitext(image_filename)[1][1:].lower()}"
                    if mime_type == 'image/jpg': mime_type = 'image/jpeg'
                    image_data_url = f"data:{mime_type};base64,{base64_image}"
                    return jsonify({"imageDataUrl": image_data_url})
            except zipfile.BadZipFile:
                return jsonify({"error": "NovelAI 返回的不是有效的 ZIP 文件"}), 500
        else:
             return jsonify({"error": f"NovelAI 返回意外响应状态: {response.status_code}, Content-Type: {response.headers.get('Content-Type')}"}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"连接 NovelAI 时出错: {e}"}), 500
    except Exception as e:
         return jsonify({"error": f"处理 NovelAI 响应时出错: {e}"}), 500

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

@app.route('/models', methods=['GET'])
def list_models_proxy():
    api_key = request.args.get('key')
    if not api_key:
        return jsonify({"error": "缺少 API 密钥"}), 400

    models_api_url = f"{GEMINI_API_BASE_URL}?key={api_key}"
    try:
        response = requests.get(models_api_url)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"请求模型列表失败: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"处理模型列表响应失败: {e}"}), 500

@app.route('/get-file-content', methods=['GET'])
def get_file_content():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({"error": "缺少文件名"}), 400

    root_dir = os.path.dirname(os.path.abspath(__file__))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "禁止访问项目外文件"}), 403

    if not os.path.exists(safe_path):
         return jsonify({"error": "文件未找到"}), 404

    try:
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": f"读取文件失败: {e}"}), 500

@app.route('/save-file-content', methods=['POST'])
def save_file_content():
    filename = request.json.get('filename')
    content = request.json.get('content')
    if not filename or content is None:
        return jsonify({"error": "缺少文件名或文件内容"}), 400

    root_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        dir_path = os.path.dirname(filename)
        if dir_path:
            full_dir_path = os.path.abspath(os.path.join(root_dir, dir_path))
            if not full_dir_path.startswith(root_dir):
                 return jsonify({"error": "禁止在项目外创建目录"}), 403
            os.makedirs(full_dir_path, exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"创建目录失败: {e}"}), 500

    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "禁止访问项目外文件"}), 403

    try:
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({"message": "文件保存成功"})
    except Exception as e:
        return jsonify({"error": f"保存文件失败: {e}"}), 500

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

def process_and_segment_novel(content):
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

            segment_length = len(segment_content)
            if segment_content.startswith('第') and segment_length < CHAPTER_TITLE_MAX_LENGTH:
                toc_entries.append({
                    "title": segment_content.split('\n')[0].strip(),
                    "segmentId": segment_id,
                    "type": "native"
                })
                segments_since_last_toc = 0
                last_segment_id_for_toc = segment_id
            else:
                segments_since_last_toc += 1
                if segments_since_last_toc >= AUTO_TOC_SEGMENT_THRESHOLD and segment_id > last_segment_id_for_toc:
                     auto_chapter_counter += 1
                     toc_entries.append({
                         "title": f"自动段落 {auto_chapter_counter}",
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

    return {"segments": segments, "toc": toc_entries}

@app.route('/novels', methods=['POST'])
def create_novel():
    data = request.json
    novel_name = data.get('name')
    content = data.get('content')
    if not novel_name or content is None:
        return jsonify({"error": "缺少小说名称或内容"}), 400

    novel_id = str(uuid.uuid4())
    filename = f"{novel_id}.json"
    filepath = os.path.join(NOVELS_DIR, filename)

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的文件路径"}), 400

    try:
        structured_data = process_and_segment_novel(content)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(structured_data, f, ensure_ascii=False)
        return jsonify({"id": novel_id, "name": novel_name, "filename": filename})
    except Exception as e:
        print(f"Error processing/saving novel: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"处理或保存小说失败: {e}"}), 500

@app.route('/novels-structured/<filename>', methods=['GET'])
def get_novel_structured_content(filename):
    if '..' in filename or filename.startswith('/'):
         return jsonify({"error": "无效的文件名"}), 400

    filepath = os.path.join(NOVELS_DIR, filename)

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的文件路径"}), 400

    if not os.path.exists(filepath):
        return jsonify({"error": "小说结构文件未找到"}), 404

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            structured_data = json.load(f)
        if not isinstance(structured_data, dict) or 'segments' not in structured_data or 'toc' not in structured_data:
             raise ValueError("JSON 文件结构无效 (缺少 segments 或 toc)")
        if not isinstance(structured_data['segments'], list):
             raise ValueError("JSON 文件 'segments' 必须是列表")
        if not isinstance(structured_data['toc'], list):
             raise ValueError("JSON 文件 'toc' 必须是列表")
        return jsonify(structured_data)
    except Exception as e:
        return jsonify({"error": f"读取或解析小说失败: {e}"}), 500

@app.route('/novels/<novel_id>', methods=['DELETE'])
def delete_novel_file(novel_id):
    filename = f"{novel_id}.json"
    filepath = os.path.join(NOVELS_DIR, filename)

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的文件路径"}), 400

    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            return jsonify({"message": "小说文件删除成功"})
        else:
            return jsonify({"message": "小说文件未找到或已被删除"})
    except Exception as e:
         return jsonify({"error": f"删除小说文件失败: {e}"}), 500

@app.route('/history/<chatroom_name>', methods=['GET'])
def get_history(chatroom_name):
    filepath = os.path.join(HISTORY_DIR, f"{chatroom_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的聊天室名称或路径"}), 400

    if not os.path.exists(filepath):
        return jsonify([])

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            history_data = json.load(f)
        return jsonify(history_data)
    except Exception as e:
        return jsonify({"error": f"读取历史记录失败: {e}"}), 500

@app.route('/history/<chatroom_name>', methods=['POST'])
def save_history(chatroom_name):
    history_data = request.json
    if history_data is None or not isinstance(history_data, list):
        return jsonify({"error": "无效的历史记录数据格式"}), 400

    filepath = os.path.join(HISTORY_DIR, f"{chatroom_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的聊天室名称或路径"}), 400

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(history_data, f, ensure_ascii=False)
        return jsonify({"message": "历史记录保存成功"})
    except Exception as e:
        return jsonify({"error": f"保存历史记录失败: {e}"}), 500

@app.route('/history/<chatroom_name>', methods=['DELETE'])
def delete_history(chatroom_name):
    filepath = os.path.join(HISTORY_DIR, f"{chatroom_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的聊天室名称或路径"}), 400

    try:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"message": "历史记录文件已删除（如果存在）"})
    except Exception as e:
        return jsonify({"error": f"删除历史记录文件失败: {e}"}), 500

@app.route('/roles/<role_name>', methods=['GET'])
def get_role_data(role_name):
    filepath = os.path.join(ROLES_DIR, f"{role_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的角色名称或路径"}), 400

    if not os.path.exists(filepath):
        return jsonify({"name": role_name, "setting": "", "memory": "", "drawingTemplate": ""})

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            role_data = json.load(f)
        role_data.setdefault("name", role_name)
        role_data.setdefault("setting", "")
        role_data.setdefault("memory", "")
        role_data.setdefault("drawingTemplate", "")
        return jsonify(role_data)
    except Exception as e:
        return jsonify({"error": f"读取角色数据失败: {e}"}), 500

@app.route('/roles/<role_name>', methods=['POST'])
def save_role_data(role_name):
    role_data = request.json
    if not role_data or not isinstance(role_data, dict):
        return jsonify({"error": "无效的角色数据格式"}), 400

    role_data["name"] = role_name
    role_data.setdefault("setting", "")
    role_data.setdefault("memory", "")
    role_data.setdefault("drawingTemplate", "")

    filepath = os.path.join(ROLES_DIR, f"{role_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的角色名称或路径"}), 400

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(role_data, f, ensure_ascii=False, indent=2)
        return jsonify({"message": "角色数据保存成功"})
    except Exception as e:
        return jsonify({"error": f"保存角色数据失败: {e}"}), 500

@app.route('/roles/<role_name>', methods=['DELETE'])
def delete_role_data(role_name):
    filepath = os.path.join(ROLES_DIR, f"{role_name}.json")

    if not is_safe_path(filepath):
        return jsonify({"error": "无效的角色名称或路径"}), 400

    try:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"message": "角色文件已删除（如果存在）"})
    except Exception as e:
        return jsonify({"error": f"删除角色文件失败: {e}"}), 500

@app.route('/roles/<old_name>/rename', methods=['PUT'])
def rename_role_data(old_name):
    data = request.json
    new_name = data.get('newName')
    if not new_name:
        return jsonify({"error": "缺少新角色名称 'newName'"}), 400

    old_filepath = os.path.join(ROLES_DIR, f"{old_name}.json")
    new_filepath = os.path.join(ROLES_DIR, f"{new_name}.json")

    if not is_safe_path(old_filepath) or not is_safe_path(new_filepath):
        return jsonify({"error": "无效的角色名称或路径"}), 400

    if not os.path.exists(old_filepath):
        return jsonify({"error": "原始角色文件未找到"}), 404
    if os.path.exists(new_filepath):
        return jsonify({"error": "目标角色文件名已存在"}), 409

    try:
        os.rename(old_filepath, new_filepath)
        with open(new_filepath, 'r+', encoding='utf-8') as f:
            role_data = json.load(f)
            role_data['name'] = new_name
            f.seek(0)
            json.dump(role_data, f, ensure_ascii=False, indent=2)
            f.truncate()
        return jsonify({"message": "角色重命名成功"})
    except Exception as e:
        if not os.path.exists(old_filepath) and os.path.exists(new_filepath):
             try: os.rename(new_filepath, old_filepath)
             except Exception as rollback_e: print(f"Rollback rename failed: {rollback_e}", file=sys.stderr)
        return jsonify({"error": f"重命名角色失败: {e}"}), 500

@app.route('/background/<chatroom_name>', methods=['POST'])
def set_background_image(chatroom_name):
    if 'image' not in request.files:
        data = request.json
        if data and 'imageDataUrl' in data:
            image_data_url = data['imageDataUrl']
            try:
                header, encoded = image_data_url.split(',', 1)
                mime_match = re.match(r'data:image/(\w+);base64', header)
                if not mime_match:
                    return jsonify({"error": "无效的图像 Data URL 格式"}), 400
                img_format = mime_match.group(1).lower()
                if img_format == 'jpeg': img_format = 'jpg'
                allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
                if img_format not in allowed_extensions:
                     return jsonify({"error": f"不支持的图像格式: {img_format}"}), 400
                img_data = base64.b64decode(encoded)

                filename = f"{chatroom_name}.{img_format}"
                filepath = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, filename)

                if not is_safe_path(filepath):
                    return jsonify({"error": "无效的聊天室名称或路径"}), 400

                with open(filepath, 'wb') as f:
                    f.write(img_data)

                relative_path = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, filename).replace('\\', '/')
                return jsonify({"message": "背景图片设置成功", "path": relative_path})

            except Exception as e:
                 return jsonify({"error": f"处理图像 Data URL 失败: {e}"}), 500
        else:
            return jsonify({"error": "缺少图像文件或图像数据"}), 400
    else:
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "未选择文件"}), 400

        allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
        file_ext = os.path.splitext(file.filename)[1].lower()[1:]
        if not file_ext or file_ext not in allowed_extensions:
             return jsonify({"error": f"不支持的文件类型: {file_ext}"}), 400

        filename = f"{chatroom_name}.{file_ext}"
        filepath = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, filename)

        if not is_safe_path(filepath):
            return jsonify({"error": "无效的聊天室名称或路径"}), 400

        try:
            file.save(filepath)
            relative_path = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, os.path.basename(filepath)).replace('\\', '/')
            return jsonify({"message": "背景图片上传成功", "path": relative_path})
        except Exception as e:
            return jsonify({"error": f"保存背景图片失败: {e}"}), 500

@app.route('/background/<chatroom_name>', methods=['DELETE'])
def delete_background_image(chatroom_name):
    basedir = os.path.abspath(os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR))
    possible_extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif']
    deleted = False
    last_error = None

    for ext in possible_extensions:
        filename = f"{chatroom_name}.{ext}"
        filepath = os.path.join(basedir, filename)
        if is_safe_path(filepath) and os.path.exists(filepath):
            try:
                os.remove(filepath)
                deleted = True
            except Exception as e:
                last_error = str(e)

    if deleted:
        return jsonify({"message": "背景图片已删除"})
    elif last_error:
         return jsonify({"error": f"删除背景图片时出错: {last_error}"}), 500
    else:
         return jsonify({"message": "未找到要删除的背景图片"})

@app.route('/background/<chatroom_name>/rename', methods=['PUT'])
def rename_background_image(chatroom_name):
    data = request.json
    new_filename_base = data.get('newFilename')
    if not new_filename_base:
        return jsonify({"error": "缺少 newFilename"}), 400

    old_name = chatroom_name
    new_name_base = os.path.splitext(new_filename_base)[0]
    new_ext = os.path.splitext(new_filename_base)[1].lower()

    basedir = os.path.abspath(os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR))
    possible_extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif']
    old_filepath = None
    old_ext = None

    for ext in possible_extensions:
        temp_path = os.path.join(basedir, f"{old_name}.{ext}")
        if is_safe_path(temp_path) and os.path.exists(temp_path):
            old_filepath = temp_path
            old_ext = ext
            break

    if not old_filepath:
        return jsonify({"error": "原始背景图片未找到"}), 404

    if not new_ext or new_ext[1:] not in possible_extensions:
        new_ext = f".{old_ext}"

    new_filename = f"{new_name_base}{new_ext}"
    new_filepath = os.path.join(basedir, new_filename)

    if not is_safe_path(new_filepath):
        return jsonify({"error": "无效的新文件名或路径"}), 400
    if os.path.exists(new_filepath):
        return jsonify({"error": "目标背景文件名已存在"}), 409

    try:
        os.rename(old_filepath, new_filepath)
        new_relative_path = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, new_filename).replace('\\', '/')
        return jsonify({"message": "背景图片重命名成功", "newPath": new_relative_path})
    except Exception as e:
        return jsonify({"error": f"重命名背景图片失败: {e}"}), 500

@app.route('/export-chatroom-zip/<chatroom_name>', methods=['GET'])
def export_chatroom_zip(chatroom_name):
    try:
        config = load_current_config()
        room = next((r for r in config.get('chatRooms', []) if r.get('name') == chatroom_name), None)
        if not room:
            return jsonify({"error": "聊天室未找到"}), 404

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            history_filename = f"{chatroom_name}.json"
            history_filepath = os.path.join(HISTORY_DIR, history_filename)
            history_exists = os.path.exists(history_filepath) and is_safe_path(history_filepath)

            chatroom_info = {
                "name": room.get('name'),
                "roles": room.get('roles', []),
                "associatedNovelIds": room.get('associatedNovelIds', []),
                "roleplayRules": room.get('roleplayRules', ""),
                "publicInfo": room.get('publicInfo', ""),
                "historyFile": history_filename if history_exists else None,
                "activeNovelIds": config.get('activeNovelIdsInChatroom', {}).get(chatroom_name, []),
                "backgroundImagePathInZip": None
            }

            bg_path = room.get('backgroundImagePath')
            if bg_path and isinstance(bg_path, str):
                bg_filepath_abs = os.path.abspath(bg_path)
                images_dir_abs = os.path.abspath(IMAGES_DIR)
                if is_safe_path(bg_filepath_abs) and os.path.exists(bg_filepath_abs):
                     try:
                         arcname = os.path.relpath(bg_filepath_abs, start=os.path.dirname(images_dir_abs)).replace('\\', '/')
                         zf.write(bg_filepath_abs, arcname)
                         chatroom_info['backgroundImagePathInZip'] = arcname
                     except Exception as e:
                         print(f"Error adding background image {bg_path} to zip: {e}", file=sys.stderr)

            zf.writestr('chatroom_info.json', json.dumps(chatroom_info, indent=2, ensure_ascii=False))

            if history_exists:
                 try:
                     zf.write(history_filepath, os.path.join(HISTORY_DIR, history_filename))
                 except Exception as e:
                     print(f"Error adding history {history_filename} to zip: {e}", file=sys.stderr)

            roles_to_export = [role_name for role_name in room.get('roles', []) if role_name in config.get('roles', [])]
            if roles_to_export:
                zf.mkdir('roles/')
                for role_name in roles_to_export:
                    role_filename = f"{role_name}.json"
                    role_filepath = os.path.join(ROLES_DIR, role_filename)
                    if is_safe_path(role_filepath) and os.path.exists(role_filepath):
                        try:
                            zf.write(role_filepath, os.path.join('roles', role_filename))
                        except Exception as e:
                             print(f"Error adding role file {role_filename} to zip: {e}", file=sys.stderr)
                    else:
                         print(f"Role file not found or unsafe path: {role_filepath}", file=sys.stderr)

            novel_ids_to_export = room.get('associatedNovelIds', [])
            if novel_ids_to_export:
                zf.mkdir('novels/')
                for novel_id in novel_ids_to_export:
                    novel_meta = next((n for n in config.get('novels', []) if n.get('id') == novel_id), None)
                    if novel_meta and novel_meta.get('filename'):
                        zf.writestr(f'novels/{novel_id}_meta.json', json.dumps(novel_meta, indent=2, ensure_ascii=False))
                        novel_filepath = os.path.join(NOVELS_DIR, novel_meta['filename'])
                        if is_safe_path(novel_filepath) and os.path.exists(novel_filepath):
                             try:
                                 zf.write(novel_filepath, os.path.join('novels', novel_meta['filename']))
                             except Exception as e:
                                 print(f"Error writing novel content {novel_meta['filename']} to zip: {e}", file=sys.stderr)
                        else:
                            print(f"Novel file not found or unsafe path: {novel_filepath}", file=sys.stderr)

        memory_file.seek(0)
        download_name = f'chatroom_{chatroom_name}_{datetime.now().strftime("%Y%m%d%H%M")}.zip'
        return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name=download_name)

    except Exception as e:
        print(f"Error exporting chatroom {chatroom_name}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"导出聊天室时出错: {e}"}), 500

@app.route('/import-chatroom-zip', methods=['POST'])
def import_chatroom_zip():
    if 'chatroom_zip' not in request.files:
        return jsonify({"error": "未找到上传的文件"}), 400

    file = request.files['chatroom_zip']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return jsonify({"error": "未选择文件或文件类型无效"}), 400

    if file.content_length > MAX_ZIP_SIZE:
         return jsonify({"error": f"文件过大"}), 413

    try:
        config = load_current_config()
        new_chatroom_info = None
        imported_bg_path_in_zip = None
        imported_history_filename_in_zip = None
        imported_role_filenames = []
        imported_novel_files = {}
        project_root_abs = os.path.abspath(os.path.dirname(__file__))

        with zipfile.ZipFile(file.stream, 'r') as zf:
            if 'chatroom_info.json' not in zf.namelist():
                return jsonify({"error": "ZIP 文件缺少 chatroom_info.json"}), 400

            with zf.open('chatroom_info.json') as info_f:
                new_chatroom_info = json.load(info_f)

            if not new_chatroom_info or 'name' not in new_chatroom_info:
                 return jsonify({"error": "chatroom_info.json 格式无效或缺少名称"}), 400

            imported_bg_path_in_zip = new_chatroom_info.get('backgroundImagePathInZip')
            imported_history_filename_in_zip = new_chatroom_info.get('historyFile')

            for member in zf.infolist():
                if member.filename.startswith('roles/') and member.filename.endswith('.json'):
                     imported_role_filenames.append(member.filename)
                elif member.filename.startswith('novels/') and member.filename.endswith('_meta.json'):
                     novel_id = os.path.basename(member.filename).replace('_meta.json', '')
                     content_filename = f"{novel_id}.json"
                     content_path_in_zip = os.path.join('novels', content_filename)
                     if content_path_in_zip in zf.namelist():
                         if novel_id not in imported_novel_files: imported_novel_files[novel_id] = {}
                         imported_novel_files[novel_id]['meta_path'] = member.filename
                         imported_novel_files[novel_id]['content_path'] = content_path_in_zip

        original_name = new_chatroom_info['name']
        final_name = original_name
        name_counter = 1
        while any(room.get('name') == final_name for room in config.get('chatRooms', [])):
            final_name = f"{original_name}_导入_{name_counter}"
            name_counter += 1

        roles_dir_abs = os.path.abspath(ROLES_DIR)
        os.makedirs(roles_dir_abs, exist_ok=True)
        with zipfile.ZipFile(file.stream, 'r') as zf:
             for role_zip_path in imported_role_filenames:
                  role_filename = os.path.basename(role_zip_path)
                  target_filepath = os.path.join(roles_dir_abs, role_filename)
                  if not is_safe_path(target_filepath):
                      print(f"Skipping unsafe role path: {target_filepath}", file=sys.stderr)
                      continue
                  try:
                      role_data_bytes = zf.read(role_zip_path)
                      role_data = json.loads(role_data_bytes.decode('utf-8'))
                      role_name = role_data.get('name')
                      if role_name:
                          if role_name not in config.get('roles', []):
                              config.setdefault('roles', []).append(role_name)
                              config.setdefault('roleStates', {})[role_name] = default_config['roleStates'].get(role_name, '默')

                          with open(target_filepath, 'wb') as f_out:
                               f_out.write(role_data_bytes)
                  except Exception as e:
                      print(f"Error processing/saving role file {role_filename}: {e}", file=sys.stderr)

        novels_dir_abs = os.path.abspath(NOVELS_DIR)
        os.makedirs(novels_dir_abs, exist_ok=True)
        with zipfile.ZipFile(file.stream, 'r') as zf:
            for novel_id, paths in imported_novel_files.items():
                meta_path = paths['meta_path']
                content_path = paths['content_path']
                try:
                     meta_data_bytes = zf.read(meta_path)
                     meta_data = json.loads(meta_data_bytes.decode('utf-8'))
                     if meta_data.get('id') != novel_id: continue

                     content_filename = meta_data.get('filename')
                     if not content_filename:
                         content_filename = f"{novel_id}.json"

                     target_filepath = os.path.join(novels_dir_abs, content_filename)
                     if not is_safe_path(target_filepath):
                         print(f"Skipping unsafe novel path: {target_filepath}", file=sys.stderr)
                         continue

                     if not any(n['id'] == novel_id for n in config.get('novels', [])):
                          config.setdefault('novels', []).append({
                              "id": novel_id,
                              "name": meta_data.get('name', f'导入小说_{novel_id[:4]}'),
                              "filename": content_filename
                          })

                          with zf.open(content_path) as source, open(target_filepath, "wb") as target:
                              target.write(source.read())
                     elif not os.path.exists(target_filepath):
                          with zf.open(content_path) as source, open(target_filepath, "wb") as target:
                              target.write(source.read())

                except Exception as e:
                     print(f"Error processing/importing novel {novel_id}: {e}", file=sys.stderr)

        final_history_path = None
        history_dir_abs = os.path.abspath(HISTORY_DIR)
        os.makedirs(history_dir_abs, exist_ok=True)
        if imported_history_filename_in_zip:
            target_history_filename = f"{final_name}.json"
            target_history_filepath = os.path.join(history_dir_abs, target_history_filename)
            zip_history_path = os.path.join(HISTORY_DIR, imported_history_filename_in_zip)

            if is_safe_path(target_history_filepath) and zip_history_path in zf.namelist():
                 try:
                     with zf.open(zip_history_path) as source, open(target_history_filepath, "wb") as target:
                         target.write(source.read())
                     final_history_path = target_history_filepath
                 except Exception as e:
                     print(f"Error extracting history file {imported_history_filename_in_zip}: {e}", file=sys.stderr)

        final_bg_path = None
        bg_dir_abs = os.path.abspath(os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR))
        os.makedirs(bg_dir_abs, exist_ok=True)
        if imported_bg_path_in_zip:
             bg_filename_in_zip = os.path.basename(imported_bg_path_in_zip)
             file_ext = os.path.splitext(bg_filename_in_zip)[1]
             target_bg_filename = f"{final_name}{file_ext}"
             target_bg_filepath = os.path.join(bg_dir_abs, target_bg_filename)

             if is_safe_path(target_bg_filepath) and imported_bg_path_in_zip in zf.namelist():
                  try:
                      with zf.open(imported_bg_path_in_zip) as source, open(target_bg_filepath, "wb") as target:
                          target.write(source.read())
                      final_bg_path = os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR, target_bg_filename).replace('\\', '/')
                  except Exception as e:
                      print(f"Error extracting background image {imported_bg_path_in_zip}: {e}", file=sys.stderr)

        valid_roles_in_new_room = [r for r in new_chatroom_info.get('roles', []) if r in config.get('roles', []) or r in config.get('temporaryRoles', [])]
        all_valid_novel_ids_in_config = {n['id'] for n in config.get('novels', [])}
        valid_novel_ids_in_new_room = [nid for nid in new_chatroom_info.get('associatedNovelIds', []) if nid in all_valid_novel_ids_in_config]
        valid_active_novel_ids = [nid for nid in new_chatroom_info.get('activeNovelIds', []) if nid in valid_novel_ids_in_new_room]

        new_room_entry = {
            "name": final_name,
            "roles": list(set(valid_roles_in_new_room + config.get('temporaryRoles', ["管理员"]))),
            "associatedNovelIds": valid_novel_ids_in_new_room,
            "roleplayRules": new_chatroom_info.get('roleplayRules', ""),
            "publicInfo": new_chatroom_info.get('publicInfo', ""),
            "backgroundImagePath": final_bg_path
        }
        config.setdefault('chatRooms', []).append(new_room_entry)
        config.setdefault('activeNovelIdsInChatroom', {})[final_name] = valid_active_novel_ids

        save_current_config(config)
        return jsonify({"message": f"聊天室 '{original_name}' 已成功导入为 '{final_name}'"})

    except zipfile.BadZipFile:
        return jsonify({"error": "无效的 ZIP 文件"}), 400
    except json.JSONDecodeError as e:
         return jsonify({"error": f"解析 JSON 失败: {e}"}), 400
    except Exception as e:
        print(f"Error importing chatroom: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"导入聊天室时出错: {e}"}), 500

@app.route('/export-full-config-zip', methods=['GET'])
def export_full_config_zip():
    try:
        config = load_current_config()
        memory_file = io.BytesIO()
        novels_dir_abs = os.path.abspath(NOVELS_DIR)
        history_dir_abs = os.path.abspath(HISTORY_DIR)
        roles_dir_abs = os.path.abspath(ROLES_DIR)
        images_dir_abs = os.path.abspath(IMAGES_DIR)

        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('config.json', json.dumps(config, indent=2, ensure_ascii=False))

            for novel_meta in config.get('novels', []):
                if novel_meta and novel_meta.get('filename'):
                    novel_filename = novel_meta['filename']
                    novel_filepath = os.path.join(novels_dir_abs, novel_filename)
                    if is_safe_path(novel_filepath) and os.path.exists(novel_filepath):
                        zf.write(novel_filepath, os.path.join(NOVELS_DIR, novel_filename))
                    else:
                        print(f"Skipping novel file (not found/unsafe): {novel_filepath}", file=sys.stderr)

            for filename in os.listdir(history_dir_abs):
                 filepath = os.path.join(history_dir_abs, filename)
                 if filename.endswith('.json') and os.path.isfile(filepath) and is_safe_path(filepath):
                     zf.write(filepath, os.path.join(HISTORY_DIR, filename))

            for filename in os.listdir(roles_dir_abs):
                 filepath = os.path.join(roles_dir_abs, filename)
                 if filename.endswith('.json') and os.path.isfile(filepath) and is_safe_path(filepath):
                     zf.write(filepath, os.path.join(ROLES_DIR, filename))

            for root, _, files in os.walk(images_dir_abs):
                 for filename in files:
                     filepath = os.path.join(root, filename)
                     if is_safe_path(filepath) and os.path.isfile(filepath):
                         arcname = os.path.relpath(filepath, start=os.path.dirname(images_dir_abs)).replace('\\', '/')
                         zf.write(filepath, arcname)

        memory_file.seek(0)
        download_name = f'full_config_{datetime.now().strftime("%Y%m%d%H%M")}.zip'
        return send_file(memory_file, mimetype='application/zip', as_attachment=True, download_name=download_name)

    except Exception as e:
        print(f"Error exporting full config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"导出完整配置时出错: {e}"}), 500

@app.route('/import-full-config-zip', methods=['POST'])
def import_full_config_zip():
    if 'config_zip' not in request.files:
        return jsonify({"error": "未找到上传的 'config_zip' 文件"}), 400

    file = request.files['config_zip']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return jsonify({"error": "未选择文件或文件类型无效"}), 400
    if file.content_length > MAX_ZIP_SIZE:
         return jsonify({"error": f"文件过大"}), 413

    try:
        imported_config = None
        project_root_abs = os.path.abspath(os.path.dirname(__file__))

        os.makedirs(NOVELS_DIR, exist_ok=True)
        os.makedirs(HISTORY_DIR, exist_ok=True)
        os.makedirs(ROLES_DIR, exist_ok=True)
        os.makedirs(IMAGES_DIR, exist_ok=True)

        with zipfile.ZipFile(file.stream, 'r') as zf:
            if 'config.json' not in zf.namelist():
                return jsonify({"error": "ZIP 文件缺少 config.json"}), 400

            try:
                with zf.open('config.json') as config_f:
                    imported_config_raw = json.load(config_f)
                    imported_config = default_config.copy()
                    if 'apiKeys' in imported_config: del imported_config['apiKeys']
                    if 'currentApiKeyIndex' in imported_config: del imported_config['currentApiKeyIndex']
                    if 'novelaiApiKey' in imported_config: del imported_config['novelaiApiKey']
                    if 'chatroomHistories' in imported_config: del imported_config['chatroomHistories']

                    for key, value in imported_config_raw.items():
                        if key in imported_config:
                             imported_config[key] = value
            except Exception as e:
                 return jsonify({"error": f"无法读取或解析 ZIP 中的 config.json: {e}"}), 400

            if not isinstance(imported_config, dict):
                 return jsonify({"error": "config.json 文件内容不是有效的 JSON 对象"}), 400

            keys_to_remove = ['apiKeys', 'currentApiKeyIndex', 'novelaiApiKey', 'chatroomHistories', 'novelScrollPositions']
            keys_to_remove.extend([k for k in imported_config if k.endswith('_setting') or k.endswith('_memory') or k.endswith('_drawingTemplate')])
            for k in keys_to_remove:
                 if k in imported_config: del imported_config[k]
            if 'chatRooms' in imported_config:
                 for room in imported_config['chatRooms']:
                     if isinstance(room, dict) and 'backgroundImageUrl' in room: del room['backgroundImageUrl']
                     if isinstance(room, dict) and 'backgroundImagePath' not in room: room['backgroundImagePath'] = None

            for member_info in zf.infolist():
                if member_info.is_dir(): continue

                target_filepath_abs = os.path.abspath(os.path.join(project_root_abs, member_info.filename))

                if not target_filepath_abs.startswith(project_root_abs):
                    print(f"Skipping unsafe extracted path: {target_filepath_abs}", file=sys.stderr)
                    continue

                try:
                    os.makedirs(os.path.dirname(target_filepath_abs), exist_ok=True)
                    with zf.open(member_info) as source, open(target_filepath_abs, "wb") as target:
                        target.write(source.read())
                except Exception as e:
                     print(f"Error extracting file {member_info.filename} to {target_filepath_abs}: {e}", file=sys.stderr)

        save_current_config(imported_config)
        return jsonify({"message": "完整配置导入成功！"})

    except zipfile.BadZipFile:
        return jsonify({"error": "无效的 ZIP 文件"}), 400
    except Exception as e:
        print(f"Error importing full config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({"error": f"导入完整配置时出错: {e}"}), 500

@app.route('/clear-all-config', methods=['POST'])
def clear_all_config_route():
    if request.method != 'POST':
        return jsonify({"error": "仅允许 POST 请求"}), 405

    project_root_abs = os.path.abspath(os.path.dirname(__file__))
    errors = []

    def safe_remove_file(filepath):
        if not is_safe_path(filepath):
            errors.append(f"跳过不安全路径: {filepath}")
            return
        if os.path.exists(filepath) and os.path.isfile(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                errors.append(f"删除文件失败 {filepath}: {e}")
        elif os.path.exists(filepath):
             errors.append(f"无法删除非文件路径 {filepath}")

    def safe_clear_directory(dirpath):
        dir_abs = os.path.abspath(dirpath)
        if not is_safe_path(dir_abs):
            errors.append(f"跳过不安全目录: {dirpath}")
            return
        if os.path.isdir(dir_abs):
            for filename in os.listdir(dir_abs):
                file_path_to_remove = os.path.join(dir_abs, filename)
                try:
                    if os.path.isfile(file_path_to_remove):
                        os.remove(file_path_to_remove)
                    elif os.path.isdir(file_path_to_remove):
                         shutil.rmtree(file_path_to_remove, ignore_errors=True)
                except Exception as e:
                    errors.append(f"删除失败 {file_path_to_remove}: {e}")

    try:
        safe_remove_file(CONFIG_FILENAME)
        safe_clear_directory(HISTORY_DIR)
        safe_clear_directory(ROLES_DIR)
        safe_clear_directory(NOVELS_DIR)
        safe_clear_directory(os.path.join(IMAGES_DIR, BACKGROUNDS_SUBDIR))
        safe_clear_directory(os.path.join(IMAGES_DIR, GENERATED_SUBDIR))

        if not errors:
            return jsonify({"message": "所有配置和数据已成功清除！"})
        else:
            return jsonify({"error": "清除部分文件或目录时出错。", "details": errors}), 500

    except Exception as e:
        print(f"Error during clear all config: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        errors.append(f"清除操作期间发生意外错误: {e}")
        return jsonify({"error": "清除所有配置时发生严重错误。", "details": errors}), 500

@app.route('/images/<path:filename>')
def serve_image(filename):
    images_dir_abs = os.path.abspath(IMAGES_DIR)
    safe_path = os.path.abspath(os.path.join(images_dir_abs, filename))

    if not is_safe_path(safe_path):
         return jsonify({"error": "禁止访问图像目录外文件"}), 403

    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
         return jsonify({"error": "图像文件未找到"}), 404

    return send_from_directory(images_dir_abs, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    if '..' in filename or filename.startswith('/'):
         return jsonify({"error": "禁止访问此路径"}), 403

    root_dir = os.path.dirname(os.path.abspath(__file__))
    safe_path = os.path.abspath(os.path.join(root_dir, filename))

    if not safe_path.startswith(root_dir):
         return jsonify({"error": "禁止访问项目外文件"}), 403

    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
         return jsonify({"error": "文件未找到"}), 404

    return send_from_directory(root_dir, filename)

@app.route('/')
def serve_frontend():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(root_dir, 'gemini_chat.html')

@app.route('/editor')
def serve_editor():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(root_dir, 'editor.html')

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)