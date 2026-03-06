import json
import requests
import re
from flask import jsonify
from backend.utils.path_utils import create_error_response
from backend.services.adapters import get_adapter
from backend.services.prompt_api_keys import (
    get_available_channels, record_channel_usage, 
    record_channel_success, record_channel_failure, get_group_fail_stats
)
from datetime import datetime
from backend.services.config_io import write_to_debug_log

def execute_ai_request(standard_payload, global_config, request_context=None):
    request_context = request_context or {}
    debug_mode = global_config.get('debugMode', False)
    is_backup_fallback = request_context.get('is_backup_fallback', False)
    model_selection_type = request_context.get('model_selection_type', 'primary')
    
    rate_limit = int(global_config.get('rateLimitPerMinute', 8))
        
    if model_selection_type == 'tertiary':
        rate_limit = max(1, rate_limit // 2)

    channels = get_available_channels(global_config, rate_limit, is_backup_fallback)
    if not channels:
        return create_error_response("NO_AVAILABLE_CHANNELS", "没有可用的 API 渠道或未配置密钥", 500)

    alerts_to_send = []
    model = standard_payload.get("model")

    if global_config.get('frontend_proxy_enabled') and not is_backup_fallback and not channels[0].get('is_backup'):
        ch = channels[0]
        adapter = get_adapter(ch['api_type'])
        record_channel_usage(ch['group_id'])
        
        print(f"[{ch['group_id']}][{model}][请求]", flush=True)
        
        return jsonify({
            "is_frontend_proxy_request": True,
            "api_type": ch['api_type'],
            "url": adapter.get_api_url(ch['address'], model, ch['api_key']),
            "headers": adapter.get_headers(ch['api_key']),
            "body": adapter.convert_payload(standard_payload),
            "responseSchemaParserJs": request_context.get("responseSchemaParserJs"),
            "proxy_url_used": ch['address']
        })

    last_error = None
    for ch in channels:
        adapter = get_adapter(ch['api_type'])
        api_url = adapter.get_api_url(ch['address'], model, ch['api_key'])
        headers = adapter.get_headers(ch['api_key'])
        body = adapter.convert_payload(standard_payload)
        
        record_channel_usage(ch['group_id'])
        
        print(f"[{ch['group_id']}][{model}][请求]", flush=True)
        
        try:
            if debug_mode:
                write_to_debug_log(f"--- Request Sent at {datetime.now().isoformat()} ---\nURL: {api_url}\nPayload: {json.dumps(body, ensure_ascii=False)}\n\n")

            resp = requests.post(api_url, headers=headers, json=body, timeout=600)
            
            if debug_mode:
                write_to_debug_log(f"--- Response Received at {datetime.now().isoformat()} ---\nStatus Code: {resp.status_code}\nBody:\n{resp.text[:20000]}\n\n")

            resp.raise_for_status()
            text_content = adapter.parse_response(resp.json())
            
            if text_content:
                record_channel_success(ch['group_id'])
                response_data = {"success": True, "data": {"text_content": text_content, "responseSchemaParserJs": request_context.get("responseSchemaParserJs")}}
                if match := re.search(r'(-?\d{4}-\d{2}-\d{2})', request_context.get("worldInfo", "")):
                    response_data["data"]["worldTime"] = match.group(1)
                
                response_data["group_fail_stats"] = get_group_fail_stats()
                if alerts_to_send:
                    response_data["alerts"] = alerts_to_send
                return jsonify(response_data)
            raise ValueError("响应内容为空或解析失败")
                
        except Exception as e:
            print(f"\033[91m[{ch['group_id']}][{model}][失败]\033[0m", flush=True)
            
            fails = record_channel_failure(ch['group_id'])
            error_details = getattr(e, 'response', None)
            detail_text = error_details.text if error_details else ""
            
            write_to_debug_log(f"!!! EXCEPTION at {datetime.now().isoformat()} !!!\nChannel: {ch['group_id']} ({ch['api_type']})\nError: {str(e)}\nResponse Body:\n{detail_text}\n\n")
            
            if fails > 0 and fails % 10 == 0:
                alerts_to_send.append(f"渠道 [{ch['group_id']}] 已连续失败 {fails} 次！")
            
            last_error = {
                "code": "REQUEST_FAILED", 
                "message": str(e), 
                "details": detail_text
            }

    return create_error_response(last_error.get("code", "UNKNOWN"), last_error.get("message", "All channels failed"), 500, details=last_error.get("details"), alerts=alerts_to_send)