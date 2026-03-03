import sys
import time
import re
from flask import jsonify
from backend.routes.ai_proxy_gemini import send_gemini_request_with_retries_direct, send_gemini_request_proxy
from backend.utils.path_utils import create_error_response

PROXY_1_TIMESTAMPS = []
PROXY_2_TIMESTAMPS = []
PROXY_FAIL_COUNTS = {}

def execute_ai_request(model_id_to_use, gemini_api_payload, global_config, request_context=None):
    if request_context is None:
        request_context = {}

    debug_mode = global_config.get('debugMode', False)
    is_backup_fallback = request_context.get('is_backup_fallback', False)
    failed_proxy_url = request_context.get('failed_proxy_url', None)
    
    alerts_to_send = []

    def _record_proxy_result(url, success):
        if not url: return
        if success:
            PROXY_FAIL_COUNTS[url] = 0
        else:
            PROXY_FAIL_COUNTS[url] = PROXY_FAIL_COUNTS.get(url, 0) + 1
            if PROXY_FAIL_COUNTS[url] > 0 and PROXY_FAIL_COUNTS[url] % 10 == 0:
                alerts_to_send.append(f"中转代理连续失败警告：\n地址 {url} 已连续失败 {PROXY_FAIL_COUNTS[url]} 次，请检查代理状态或网络连接！")

    if failed_proxy_url:
        _record_proxy_result(failed_proxy_url, False)

    proxy_1_url = global_config.get('proxy_url')
    proxy_1_key = global_config.get('proxy_api_key')
    proxy_2_url = global_config.get('proxy_url_2')
    proxy_2_key = global_config.get('proxy_api_key_2')
    backup_url = global_config.get('backup_proxy_url')
    backup_key = global_config.get('backup_proxy_api_key')

    model_selection_type = request_context.get('model_selection_type', 'primary')
    rate_limit_threshold = 4 if model_selection_type == 'tertiary' else 7

    api_connection_mode = global_config.get('apiConnectionMode', 'direct')
    use_backup_only = global_config.get('useBackupProxyOnly', False)
    frontend_proxy_enabled = global_config.get('frontend_proxy_enabled', False)

    proxy_configs_to_try = []

    # 仅当模式为中转或前端回退时，才构建中转代理列表
    if api_connection_mode == 'proxy' or is_backup_fallback:
        if use_backup_only:
            proxy_configs_to_try.append(("备用中转", {"proxy_url": backup_url, "proxy_api_key": backup_key}))
        else:
            current_time = time.time()
            PROXY_1_TIMESTAMPS[:] = [ts for ts in PROXY_1_TIMESTAMPS if current_time - ts < 60]
            PROXY_2_TIMESTAMPS[:] = [ts for ts in PROXY_2_TIMESTAMPS if current_time - ts < 60]

            len1 = len(PROXY_1_TIMESTAMPS) if proxy_1_url else float('inf')
            len2 = len(PROXY_2_TIMESTAMPS) if proxy_2_url else float('inf')

            if failed_proxy_url == proxy_1_url:
                len1 = float('inf')
            if failed_proxy_url == proxy_2_url:
                len2 = float('inf')

            available_defaults = []
            if len1 < rate_limit_threshold:
                available_defaults.append((len1, "中转一", {"proxy_url": proxy_1_url, "proxy_api_key": proxy_1_key}))
            if len2 < rate_limit_threshold:
                available_defaults.append((len2, "中转二", {"proxy_url": proxy_2_url, "proxy_api_key": proxy_2_key}))

            available_defaults.sort(key=lambda x: x[0])

            for _, label, cfg in available_defaults:
                proxy_configs_to_try.append((label, cfg))
            
            proxy_configs_to_try.append(("备用中转", {"proxy_url": backup_url, "proxy_api_key": backup_key}))
            
        proxy_configs_to_try = [c for c in proxy_configs_to_try if c[1].get("proxy_url")]

        if proxy_configs_to_try and not use_backup_only:
            chosen_first_url = proxy_configs_to_try[0][1]['proxy_url']
            if chosen_first_url == proxy_1_url:
                PROXY_1_TIMESTAMPS.append(current_time)
            elif chosen_first_url == proxy_2_url:
                PROXY_2_TIMESTAMPS.append(current_time)
            elif chosen_first_url == backup_url and not available_defaults:
                msg_prefix = "备用模型主动让路" if model_selection_type == 'tertiary' else "默认代理1&2请求速率超限或已失败"
                print(f"{msg_prefix}，自动切入备用代理。", file=sys.stdout)

    # 1. 前端代理拦截
    if api_connection_mode == 'proxy' and frontend_proxy_enabled and not is_backup_fallback and not use_backup_only:
        if proxy_configs_to_try:
            chosen_label, chosen_cfg = proxy_configs_to_try[0]
            print(f"[前端代理 -> {chosen_label}] 向模型 [{model_id_to_use}] 发起请求...", file=sys.stdout)
            sys.stdout.flush()
            
            proxy_url_clean = chosen_cfg['proxy_url'].rstrip('/')
            effective_api_url = f"{proxy_url_clean}/v1beta/models/{model_id_to_use}:generateContent"
            headers = {'Content-Type': 'application/json'}
            if chosen_cfg.get('proxy_api_key'):
                headers['Authorization'] = f"Bearer {chosen_cfg['proxy_api_key']}"

            frontend_proxy_payload = {
                "is_frontend_proxy_request": True,
                "url": effective_api_url,
                "headers": headers,
                "body": gemini_api_payload,
                "responseSchemaParserJs": request_context.get("responseSchemaParserJs"),
                "proxy_url_used": chosen_cfg['proxy_url']
            }
            if alerts_to_send:
                frontend_proxy_payload["alerts"] = alerts_to_send
            return jsonify(frontend_proxy_payload)
        else:
             return create_error_response("NO_PROXY_URL", "Frontend proxy enabled but no valid proxy URL found.", 400, alerts=alerts_to_send)

    result = None

    # 2. 后端请求分发
    if api_connection_mode == 'proxy' or is_backup_fallback:
        for label, cfg in proxy_configs_to_try:
            result = send_gemini_request_proxy(
                model_id_to_use=model_id_to_use,
                gemini_payload=gemini_api_payload,
                proxy_config=cfg,
                path_label=label,
                debug_mode=debug_mode
            )
            if result:
                _record_proxy_result(cfg.get('proxy_url'), result.get("success"))
                if result.get("success"):
                    break

    else:
        # 直连模式 (无视前端路径和备用代理设置)
        result = send_gemini_request_with_retries_direct(
            model_id_to_use=model_id_to_use,
            gemini_payload=gemini_api_payload,
            debug_mode=debug_mode,
            cancel_event=None
        )

    # 3. 结果处理
    if result and result.get("success"):
        response_data = {"success": True, "data": result.get("data", {})}
        response_data["data"]["responseSchemaParserJs"] = request_context.get("responseSchemaParserJs")
        
        world_info_str = request_context.get("worldInfo", "")
        date_match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info_str)
        if date_match:
            response_data["data"]["worldTime"] = date_match.group(1)
        
        if alerts_to_send:
            response_data["alerts"] = alerts_to_send

        return jsonify(response_data)
    else:
        final_error = result.get("error", {}) if result else {"code": "NO_RESPONSE", "message": "No response from AI services."}
        final_debug_info = result.get("debug_info") if result else None
        return create_error_response(
            final_error.get("code", "UNKNOWN_API_ERROR"),
            final_error.get("message", "An unknown error occurred after all attempts."),
            500,
            details=final_error.get("details"),
            debug_info=final_debug_info,
            alerts=alerts_to_send
        )