from flask import Blueprint, request
from backend.services.prompt_payload_builder import build_standard_request_body
from backend.services.config_io import load_current_config
from backend.services.ai_request_handler import execute_ai_request
from backend.utils.path_utils import create_error_response

ai_interaction_bp = Blueprint('ai_interaction_bp', __name__)

@ai_interaction_bp.route('/trigger-ai-response', methods=['POST'])
def trigger_ai_response():
    trigger_info = request.json
    if not trigger_info:
        return create_error_response("INVALID_REQUEST", "Request body must be JSON.", 400)

    global_config = load_current_config()
    
    is_backup_fallback = trigger_info.pop('is_backup_fallback', False)
    failed_proxy_url = trigger_info.pop('failed_proxy_url', None)

    standard_payload, context = build_standard_request_body(trigger_info, global_config)
    
    request_context = {
        "is_backup_fallback": is_backup_fallback,
        "failed_proxy_url": failed_proxy_url,
        "model_selection_type": context.get('model_selection_type', 'primary'),
        "responseSchemaParserJs": context.get("api_call", {}).get("responseSchemaParserJs"),
        "worldInfo": context.get("worldInfo", ""),
        "api_call_role": context.get('api_call', {}).get('role_name', 'Unknown')
    }

    return execute_ai_request(standard_payload, global_config, request_context)