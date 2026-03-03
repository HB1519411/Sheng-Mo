from flask import Blueprint, request, jsonify
import requests
import json
import sys
import traceback
import time
from backend.services.config_io import load_current_config, DEBUG_LOG_FILENAME
from backend.services.prompt_service import select_api_key, record_api_key_failure, start_api_key_cooldown
from backend.utils.path_utils import create_error_response
from datetime import datetime

ai_proxy_gemini_bp = Blueprint('ai_proxy_gemini_bp', __name__)

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_API_BASE_URL_FOR_LIST_MODELS = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_RETRIES = 5
RETRY_DELAY = 1

def _write_to_debug_log(content):
    try:
        with open(DEBUG_LOG_FILENAME, 'a', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        pass

def send_gemini_request_with_retries_direct(model_id_to_use, gemini_payload, debug_mode=False, cancel_event=None):
    request_headers = {'Content-Type': 'application/json'}
    last_error_result = None
    used_keys_in_retry = set()

    for attempt in range(MAX_RETRIES):
        if cancel_event and cancel_event.is_set():
            return {"success": False, "error": {"code": "REQUEST_CANCELLED", "message": "Direct request was cancelled because another request succeeded first."}}

        api_key_in_use = None
        global_config = load_current_config()
        try:
            api_key_in_use = select_api_key(global_config, exclude_keys=used_keys_in_retry)
            if not api_key_in_use:
                last_error_result = {"success": False, "error": {"code": "NO_AVAILABLE_KEYS", "message": "No available API keys for retry."}}
                break
            used_keys_in_retry.add(api_key_in_use)
        except ValueError as e:
            return {"success": False, "error": {"code": "API_KEY_SELECTION_FAILED", "message": str(e)}}
        
        effective_api_url = f"{GEMINI_API_BASE_URL}/{model_id_to_use}:generateContent?key={api_key_in_use}"
        
        result = _send_to_gemini_api(effective_api_url, request_headers, gemini_payload, model_id_to_use, "直连", api_key_in_use, debug_mode, cancel_event)
        
        if result.get("success"):
            return result
        else:
            last_error_result = result
            
            if api_key_in_use and not (cancel_event and cancel_event.is_set()):
                record_api_key_failure(api_key_in_use)
            
            time.sleep(RETRY_DELAY)
    
    return last_error_result

def send_gemini_request_proxy(model_id_to_use, gemini_payload, proxy_config, path_label="中转", debug_mode=False, cancel_event=None):
    if cancel_event and cancel_event.is_set():
        return {"success": False, "error": {"code": "REQUEST_CANCELLED", "message": "Proxy request was cancelled because another request succeeded first."}}

    def _prepare_request_params(config):
        if not config or not config.get('proxy_url'):
            return None, None
        
        headers = {'Content-Type': 'application/json'}
        proxy_url = config.get('proxy_url')
        proxy_api_key = config.get('proxy_api_key')
        
        base_proxy_url = proxy_url.rstrip('/')
        url = f"{base_proxy_url}/v1beta/models/{model_id_to_use}:generateContent"
        if proxy_api_key:
            headers['Authorization'] = f"Bearer {proxy_api_key}"
        return url, headers

    primary_url, primary_headers = _prepare_request_params(proxy_config)
    if not primary_url:
        return {"success": False, "error": {"code": "MISSING_PROXY_URL", "message": "Missing proxy_url for proxy request"}}

    result = _send_to_gemini_api(primary_url, primary_headers, gemini_payload, model_id_to_use, path_label, None, debug_mode, cancel_event)
    return result


def _send_to_gemini_api(api_url, headers, payload, model_id, path_label, api_key=None, debug_mode=False, cancel_event=None):
    if cancel_event and cancel_event.is_set():
        return {"success": False, "error": {"code": "REQUEST_CANCELLED", "message": "API call cancelled before sending."}}

    print(f"[{path_label}] 向模型 [{model_id}] 发起请求...", file=sys.stdout)
    sys.stdout.flush()

    try:
        if debug_mode:
            log_content = (
                f"--- Request Sent at {datetime.now().isoformat()} ---\n"
                f"URL: {api_url}\n"
                f"Headers: {json.dumps(headers, indent=2)}\n"
                f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}\n"
                f"--------------------------------------------------\n\n"
            )
            _write_to_debug_log(log_content)

        response = requests.post(api_url, headers=headers, json=payload, timeout=600)
        ai_response_json_text = response.text

        if cancel_event and cancel_event.is_set():
            return {"success": False, "error": {"code": "REQUEST_CANCELLED", "message": "Request cancelled during response reception."}}
        
        if debug_mode:
            log_content = (
                f"--- Response Received at {datetime.now().isoformat()} ---\n"
                f"From URL: {api_url}\n"
                f"Status Code: {response.status_code}\n"
                f"Raw Text:\n{ai_response_json_text}\n"
                f"--------------------------------------------------\n\n"
            )
            _write_to_debug_log(log_content)


        response.raise_for_status()
        ai_response_json = response.json()

        text_content = None
        if 'candidates' not in ai_response_json and 'content' in ai_response_json:
            ai_response_json = {"candidates": [{"content": ai_response_json['content']}]}
        
        if not ai_response_json.get('candidates'):
            error_message = "AI response has no candidates"
            block_reason = ai_response_json.get('promptFeedback', {}).get('blockReason')
            if block_reason:
                error_message = f"AI request blocked: {block_reason}"
            print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
            sys.stdout.flush()
            return {"success": False, "error": {"code": "NO_CANDIDATES", "message": error_message, "details": ai_response_json}}

        candidate = ai_response_json['candidates'][0]
        finish_reason = candidate.get('finishReason', 'UNKNOWN')
        
        if finish_reason in ['SAFETY', 'RECITATION']:
            print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
            sys.stdout.flush()
            return {"success": False, "error": {"code": f"{finish_reason}_BLOCK", "message": f"Response blocked due to {finish_reason}", "details": ai_response_json}}

        candidate_content = candidate.get('content')
        if not candidate_content or not candidate_content.get('parts'):
            if finish_reason == 'MAX_TOKENS':
                if api_key:
                    start_api_key_cooldown(api_key)
                return {"success": True, "data": {"text_content": "[输出被截断]"}}
            print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
            sys.stdout.flush()
            return {"success": False, "error": {"code": "MISSING_CONTENT", "message": f"Response missing content/parts. Finish reason: {finish_reason}", "details": ai_response_json}}
        
        parts = candidate_content['parts']
        if len(parts) > 1 and parts[0].get('thought'):
            text_content = parts[1].get('text')
        elif parts:
            text_content = parts[0].get('text')

        if text_content is None:
            print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
            sys.stdout.flush()
            return {"success": False, "error": {"code": "NO_USABLE_TEXT", "message": "Response parts found, but none contained text.", "details": ai_response_json}}
        
        if api_key:
            start_api_key_cooldown(api_key)
        return {"success": True, "data": {"text_content": text_content}}

    except requests.exceptions.HTTPError as e:
        error_details = response.text if 'response' in locals() else "No response object"
        error_message = str(e)
        try:
            error_json = response.json()
            error_details = error_json
            if isinstance(error_json, dict):
                api_error_message = error_json.get('error', {}).get('message')
                if api_error_message:
                    error_message = api_error_message
                if error_json.get('error', {}).get('status') == 'RESOURCE_EXHAUSTED':
                    print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
                    sys.stdout.flush()
                    return {"success": False, "error": {"code": "RESOURCE_EXHAUSTED", "message": "API key limit reached", "details": error_details}}
        except json.JSONDecodeError:
            pass
        print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
        sys.stdout.flush()
        return {"success": False, "error": {"code": "HTTP_ERROR", "message": error_message, "details": error_details}}
    except requests.exceptions.RequestException as e:
        print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
        sys.stdout.flush()
        return {"success": False, "error": {"code": "REQUEST_EXCEPTION", "message": str(e)}}
    except Exception as e:
        print(f"[{path_label}] 模型 [{model_id}] 请求失败", file=sys.stdout)
        sys.stdout.flush()
        return {"success": False, "error": {"code": "PROCESSING_ERROR", "message": f"An unexpected error occurred: {e}"}}


@ai_proxy_gemini_bp.route('/ai-proxy', methods=['POST'])
def ai_proxy():
    request_data = request.json
    global_config = load_current_config()
    debug_mode = global_config.get('debugMode', False)
    model_id_to_use = request_data.get('model_id_to_use')
    
    gemini_payload = {
        "contents": request_data.get('contents'),
        "systemInstruction": request_data.get('systemInstruction'),
        "generationConfig": request_data.get('generationConfig', {}),
        "safetySettings": request_data.get('safetySettings', []),
    }

    if request_data.get('is_frontend_proxy_request'):
        proxy_config = {
            "proxy_url": request_data.get('proxy_url'),
            "proxy_api_key": request_data.get('proxy_api_key')
        }
        result = send_gemini_request_proxy(
            model_id_to_use=model_id_to_use,
            gemini_payload=gemini_payload,
            proxy_config=proxy_config,
            path_label="前端代理",
            debug_mode=debug_mode
        )
    else:
        result = send_gemini_request_with_retries_direct(
            model_id_to_use=model_id_to_use,
            gemini_payload=gemini_payload,
            debug_mode=debug_mode
        )
    
    if result.get("success"):
        return jsonify(result)
    else:
        final_error = result.get("error", {})
        return create_error_response(
            final_error.get("code", "UNKNOWN_PROXY_ERROR"),
            final_error.get("message", "An unknown error occurred."),
            500,
            details=final_error.get("details"),
        )

@ai_proxy_gemini_bp.route('/models', methods=['GET'])
def list_models():
    api_key = request.args.get('key')
    if not api_key:
        return create_error_response("MISSING_API_KEY", "API key is missing", 400)

    models_api_url = f"{GEMINI_API_BASE_URL_FOR_LIST_MODELS}?key={api_key}"
    try:
        response = requests.get(models_api_url)
        response.raise_for_status()
        return jsonify({"success": True, "data": response.json()})
    except requests.exceptions.RequestException as e:
        return create_error_response("REQUEST_MODEL_LIST_FAILED", f"Failed to request model list: {e}", 500)
    except Exception as e:
        return create_error_response("PROCESS_MODEL_LIST_FAILED", f"Failed to process model list response: {e}", 500)