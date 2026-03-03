from flask import Blueprint, request, jsonify
from backend.services.config_io import load_current_config
from backend.services.ai_request_handler import execute_ai_request
import logging

editor_ai_bp = Blueprint('editor_ai_bp', __name__)
logger = logging.getLogger(__name__)

@editor_ai_bp.route('/editor-ai-chat', methods=['POST'])
def editor_ai_chat():
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": {"message": "Invalid payload"}}), 400

        global_config = load_current_config()
        
        model_selection_type = data.get('model_selection_type', 'primary')
        if model_selection_type == 'secondary':
            model_id = global_config.get('secondary_model_id')
        elif model_selection_type == 'tertiary':
            model_id = global_config.get('tertiary_model_id')
        else:
            model_id = global_config.get('primary_model_id')
            
        if not model_id:
            model_id = global_config.get('primary_model_id', 'gemini-1.5-pro')

        system_instruction = data.get('systemInstruction', '')
        contents = data.get('contents', [])

        gemini_payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": float(global_config.get("temperature", 1.0)),
                "topP": float(global_config.get("topP", 0.9)),
                "topK": int(global_config.get("topK", 40)),
                "maxOutputTokens": int(global_config.get("maxOutputTokens", 8192)),
                "thinkingConfig": {"includeThoughts": False, "thinkingLevel": "LOW"}
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"}
            ]
        }
        
        if system_instruction:
            gemini_payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        request_context = {
            "model_selection_type": model_selection_type,
            "api_call_role": "editor_ai",
            "is_backup_fallback": False,
            "failed_proxy_url": None
        }

        return execute_ai_request(model_id, gemini_payload, global_config, request_context)

    except Exception as e:
        logger.exception(f"Error in editor_ai_chat: {e}")
        return jsonify({"success": False, "error": {"message": str(e)}}), 500