from flask import Blueprint, request, jsonify
from backend.services.config_io import load_current_config
from backend.services.ai_request_handler import execute_ai_request
import logging

editor_ai_bp = Blueprint('editor_ai_bp', __name__)
logger = logging.getLogger(__name__)

@editor_ai_bp.route('/editor-ai-chat', methods=['POST'])
def editor_ai_chat():
    data = request.json
    global_config = load_current_config()
    
    model_selection_type = data.get('model_selection_type', 'primary')
    model_id = global_config.get(f'{model_selection_type}_model_id') or global_config['primary_model_id']
    system_instruction = data.get('systemInstruction', '')
    contents = data.get('contents', [])

    standard_messages = []
    for c in contents:
        role = "assistant" if c.get("role") == "model" else "user"
        raw_parts = c.get("parts", [])
        standard_content = []

        for part in raw_parts:
            if "text" in part and part["text"].strip():
                standard_content.append({"type": "text", "text": part["text"]})
            elif "inline_data" in part:
                standard_content.append({
                    "type": "file",
                    "mime_type": part["inline_data"]["mime_type"],
                    "data": part["inline_data"]["data"]
                })

        if standard_content:
            standard_messages.append({"role": role, "content": standard_content})

    standard_payload = {
        "model": model_id,
        "system_prompt": system_instruction,
        "messages": standard_messages,
        "temperature": float(global_config.get("temperature", 1.0)),
        "top_p": float(global_config.get("topP", 0.9)),
        "max_tokens": int(global_config.get("maxOutputTokens", 8192))
    }

    request_context = {
        "model_selection_type": model_selection_type,
        "api_call_role": "editor_ai",
        "is_backup_fallback": False,
        "failed_proxy_url": None
    }

    return execute_ai_request(standard_payload, global_config, request_context)