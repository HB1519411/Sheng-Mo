import re
import json
from backend.services.prompt_context_builder import _get_full_context_for_partition
from backend.services.prompt_format_utils import (
    _get_display_name, _get_visibility_scope, _format_role_setting_for_prompt,
    _format_role_memory_for_prompt
)

def _replace_placeholders_in_string(text, context, currently_parsing=None):
    if currently_parsing is None: currently_parsing = set()
    if not isinstance(text, str) or '{{' not in text: return text

    def replacer(match):
        full_placeholder = match.group(0)
        content = match.group(1).strip()
        if full_placeholder in currently_parsing: return ""
        currently_parsing.add(full_placeholder)
        
        raw_value = _resolve_placeholder(content, context)
        
        processed_value = _replace_placeholders_in_string(raw_value, context, currently_parsing)
        currently_parsing.remove(full_placeholder)
        return processed_value

    return re.sub(r'\{\{([^}]+?)\}\}', replacer, text)

def _resolve_placeholder(content, context):
    api_call_context = context.get("api_call", {})
    caller_name = api_call_context.get("role_name")

    if caller_name == 'novelSummaryMaster':
        if content == '原著小说':
            summary_context = api_call_context.get("summaryContext", {})
            novel_id = summary_context.get("novelId")
            toc_entry_index = summary_context.get("tocEntryIndex")
            novels = context.get("chatroomDetails", {}).get("novels", [])

            if not novel_id or toc_entry_index is None:
                return "[前情提要无法生成: 上下文信息不足]"

            novel_data = next((n for n in novels if n.get("id") == novel_id), None)
            if not novel_data or not isinstance(novel_data.get("toc"), list):
                return "[前情提要无法生成: 未找到小说或目录]"
            
            toc = novel_data.get("toc", [])
            start_index = max(0, toc_entry_index - 10)
            
            previous_summaries = []
            for i in range(start_index, toc_entry_index):
                if 0 <= i < len(toc):
                    chapter = toc[i]
                    if chapter and chapter.get("summary"):
                        previous_summaries.append(f"章节: {chapter.get('title', '无标题')}\n总结: {chapter['summary']}")

            if not previous_summaries:
                return "[无前情提要]"
            
            return "[前情提要 开始]\n\n" + "\n\n".join(previous_summaries) + "\n\n[前情提要 结束]"
        elif content == '数据库':
            return f"<Database>\n{api_call_context.get('database_instruction', '')}\n</Database>"
        elif content == '章节标题':
            return context.get("chapterTitleForTool", '[章节标题未知]')
        elif content == '章节内容片段':
            return context.get("chapterContentForTool", '[章节内容片段未知]')
        else:
            return ""
            
    full_placeholder = f"{{{{{content}}}}}"
    all_roles = context.get("allRolesInRoom", [])
    global_events = context.get("chatroomDetails", {}).get("events", [])
    display_map = context.get("role_name_map", {})
    world_info = context.get("worldInfo", "")
    date_match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info)
    current_date = date_match.group(1) if date_match else None
    main_config = context.get("chatroomDetails", {}).get("config", {})
    
    def wrap_tag(tag, inner_content): return f"<{tag}>\n{inner_content or ''}\n</{tag}>"
    def wrap_dyn_tag(base_tag, role_alias, inner_content): return wrap_tag(f"{role_alias.replace(' ', '_')}_{base_tag}", inner_content)

    source_role_name = context.get("triggeringCharacterName")
    source_role_alias = _get_display_name(source_role_name, display_map) if source_role_name else '[源角色未知]'
    source_role_data = next((r for r in all_roles if r.get('name') == source_role_name), None) if source_role_name else None
    
    if full_placeholder.startswith('{{源角色'):
        if not source_role_name: return f"[{full_placeholder} 错误: 源角色名称未定义]"
        visibility_scope_for_source = _get_visibility_scope(source_role_name, 'role', [], main_config)
        if content == '源角色名称': return source_role_alias
        if content == '源角色设定': return wrap_dyn_tag('Setting', source_role_alias, _format_role_setting_for_prompt(source_role_data, world_info))
        if content == '源角色记忆': return wrap_dyn_tag('Memory', source_role_alias, _format_role_memory_for_prompt(source_role_data.get('memory'), global_events, source_role_name, current_date, visibility_scope_for_source, main_config))
        if content == '源角色状态': return wrap_dyn_tag('State', source_role_alias, context.get('roleDetailedStates', {}).get(source_role_name, f"[{source_role_alias}] 无详细状态"))

    if content.endswith('角色记忆') and not content.startswith(('源', '目标', '角色')):
        role_name = content[:-4].strip()
        role_data = next((r for r in all_roles if r.get('name') == role_name), None)
        if role_data:
            visibility_scope = _get_visibility_scope(role_name, 'role', [], main_config)
            return wrap_dyn_tag('Memory', _get_display_name(role_name, display_map), _format_role_memory_for_prompt(role_data.get('memory'), global_events, role_name, current_date, visibility_scope, main_config))
        return f"[角色 {role_name} 未找到]"
    
    caller_type = api_call_context.get("role_type")
    caller_data = next((r for r in all_roles if r.get('name') == caller_name), None) if caller_type in ['role', 'temporary_role'] else None
    caller_alias = _get_display_name(caller_name, display_map)
    visibility_scope_for_caller = _get_visibility_scope(caller_name, caller_type, context.get("currentPartitionData", {}).get("roleAliases", []), main_config)

    if content == '角色名称': return caller_alias
    if content == '角色设定': return wrap_dyn_tag('Setting', caller_alias, _format_role_setting_for_prompt(caller_data, world_info))
    if content == '角色记忆': return wrap_dyn_tag('Memory', caller_alias, _format_role_memory_for_prompt(caller_data.get('memory') if caller_data else [], global_events, caller_name, current_date, visibility_scope_for_caller, main_config))
    if content == '角色状态': return wrap_dyn_tag('State', caller_alias, context.get('roleDetailedStates', {}).get(caller_name, f"[{caller_alias}] 无详细状态"))

    if content == '目标角色名称': return _get_display_name(context.get("targetRoleNameForTool", '[无目标角色]'), display_map)
    
    target_role_name = context.get("targetRoleNameForTool")
    target_role_data = next((r for r in all_roles if r.get('name') == target_role_name), None) if target_role_name else None
    target_role_alias = _get_display_name(target_role_name, display_map) if target_role_name else None
    
    if content == '目标角色设定' and target_role_data: return wrap_dyn_tag('Setting', target_role_alias, _format_role_setting_for_prompt(target_role_data, world_info))
    if content == '目标角色记忆' and target_role_data:
        visibility_scope_for_target = _get_visibility_scope(target_role_name, 'role', [], main_config)
        return wrap_dyn_tag('Memory', target_role_alias, _format_role_memory_for_prompt(target_role_data.get('memory'), global_events, target_role_name, current_date, visibility_scope_for_target, main_config))

    if content == '原著小说':
        if caller_name == 'drawingMaster' or caller_name == 'closeUpMaster':
            override_settings = context.get("chatroomDetails", {}).get("config", {}).get("overrideSettings", {}).get("drawingMaster", {})
            global_settings = context.get("global_config", {}).get("toolSettings", {}).get("drawingMaster", {})
            if override_settings.get("enabled"):
                novel_content = override_settings.get("novelContent", '[绘图大师原著小说(覆盖)为空]')
            else:
                novel_content = global_settings.get("novelContent", '[绘图大师原著小说(全局)为空]')
            return wrap_tag('OriginalNovel', novel_content)
        else:
            return wrap_tag('OriginalNovel', context.get("novelAndScriptContent"))

    if content == "扮演规则":
        return wrap_tag('RoleplayRules', context.get("currentPartitionData", {}).get("roleplayRules", '[扮演规则为空]'))
        
    mapping = {
        '角色名称集': context.get("nonSilentRolesValue", '[无激活角色]'),
        '用角色名称集': context.get("userControlRoleNamesValue", '[无用状态角色]'),
        '最新角色': _get_display_name(context.get("lastActor"), display_map) or '[最近行动者未知]',
        '消息记录': context.get("formattedHistory", ''),
        '最新消息': wrap_tag('LatestNews', context.get("latestMessageContent")),
        '角色设定集': wrap_tag('CharacterSettingsCollection', context.get("nonSilentRoleSettingsValue")),
        '角色状态集': wrap_tag('CharacterStatesCollection', context.get("nonSilentRoleDetailedStatesValue")),
        '角色记忆集': wrap_tag('CharacterMemoriesCollection', context.get("nonSilentRoleMemoriesValue")),
        '公开信息集': wrap_tag('CharacterPublicInfosCollection', context.get("publicInfosCollectionValue")),
        '世界信息': wrap_tag('WorldInfo', world_info),
        '公共信息': wrap_tag('PublicInfo', context.get("chatroomDetails", {}).get("config", {}).get("publicInfo", '[公共信息为空]')),
        '主提示词': wrap_tag('MainPrompt', api_call_context.get("main_prompt", '[主提示词为空]')),
        '数据库': f"<Database>\n{api_call_context.get('database_instruction', '')}\n</Database>",
        '绘图角色': _get_display_name(context.get("triggeringCharacterName", '[触发绘图的角色未知]'), display_map),
        '章节标题': context.get("chapterTitleForTool", '[章节标题未知]'),
        '章节内容片段': context.get("chapterContentForTool", '[章节内容片段未知]'),
        'user': context.get("chatroomDetails", {}).get("config", {}).get("user", '[user未设置]')
    }
    return mapping.get(content, full_placeholder)

def replace_placeholders_in_payload(payload, context):
    if isinstance(payload, dict):
        return {k: replace_placeholders_in_payload(v, context) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [replace_placeholders_in_payload(i, context) for i in payload]
    elif isinstance(payload, str):
        return _replace_placeholders_in_string(payload, context)
    return payload

def _convert_turns_to_gemini_format(turns):
    if not isinstance(turns, list):
        return []
    
    gemini_formatted_turns = []
    for turn in turns:
        if isinstance(turn, dict) and 'role' in turn and 'instruction' in turn:
            gemini_formatted_turns.append({
                "role": turn["role"],
                "parts": [{"text": turn["instruction"]}]
            })
    return gemini_formatted_turns

def build_gemini_request_body(trigger_info, global_config):
    context = _get_full_context_for_partition(
        trigger_info["chatroomName"],
        trigger_info["partitionId"],
        trigger_info["roleName"],
        trigger_info["roleType"],
        global_config,
        trigger_info.get("triggeringCharacterName")
    )
    if not context:
        raise ValueError("获取分区上下文失败，请检查聊天室或分区是否存在。")
        
    context["targetRoleNameForTool"] = trigger_info.get("targetRoleNameForTool")
    context["triggeringCharacterName"] = trigger_info.get("triggeringCharacterName")
    context["global_config"] = global_config
    
    summary_context = trigger_info.get("summaryContext", {})

    api_call_config = {}
    role_name, role_type = trigger_info["roleName"], trigger_info["roleType"]
    chatroom_overrides = context["chatroomDetails"]["config"].get("overrideSettings", {})
    
    if role_type in ['role', 'temporary_role']:
        cfg_source = chatroom_overrides.get("general") if chatroom_overrides.get("general", {}).get("enabled") else global_config
        api_call_config["model_selection_type"] = cfg_source.get("model_selection_type") or global_config.get("generalModelSelectionType") or "primary"
        api_call_config["database_instruction"] = cfg_source.get("sharedDatabaseInstruction", "")
        api_call_config["main_prompt"] = cfg_source.get("mainPrompt", "")
        api_call_config["response_schema"] = cfg_source.get("responseSchemaJson")
        api_call_config["responseSchemaParserJs"] = cfg_source.get("responseSchemaParserJs", "")
    else:
        cfg_source = chatroom_overrides.get(role_name) if chatroom_overrides.get(role_name, {}).get("enabled") else global_config["toolSettings"].get(role_name, {})
        api_call_config["model_selection_type"] = cfg_source.get("model_selection_type", "primary")
        api_call_config["database_instruction"] = cfg_source.get("toolDatabaseInstruction", "")
        api_call_config["main_prompt"] = cfg_source.get("mainPrompt", "")
        api_call_config["response_schema"] = cfg_source.get("responseSchemaJson")
        api_call_config["responseSchemaParserJs"] = cfg_source.get("responseSchemaParserJs", "")

    if context.get("should_append_clothing_guide_to_prompt"):
        clothing_guide = global_config.get("clothingGuide", "").strip()
        if clothing_guide:
            api_call_config["main_prompt"] = f"{api_call_config.get('main_prompt', '')}\n\n{clothing_guide}"

    context["api_call"] = {
        "role_name": role_name, "role_type": role_type, "summaryContext": summary_context, **api_call_config
    }
    
    if summary_context and role_name == 'novelSummaryMaster':
        novel_id = summary_context.get("novelId")
        toc_entry_index = summary_context.get("tocEntryIndex")
        if novel_id and toc_entry_index is not None and 'novels' in context['chatroomDetails']:
            novel_data = next((n for n in context["chatroomDetails"]["novels"] if n["id"] == novel_id), None)
            if novel_data and 'toc' in novel_data and 0 <= toc_entry_index < len(novel_data["toc"]):
                toc_entry = novel_data["toc"][toc_entry_index]
                context["chapterContentForTool"] = toc_entry.get("content", "")
                context["chapterTitleForTool"] = summary_context.get("chapterTitle", toc_entry.get("title", ""))
    
    model_selection_type = api_call_config["model_selection_type"]
    if model_selection_type == "secondary":
        model_id = global_config["secondary_model_id"]
    elif model_selection_type == "tertiary":
        model_id = global_config.get("tertiary_model_id", global_config["primary_model_id"])
    else:
        model_id = global_config["primary_model_id"]

    context["model_selection_type"] = model_selection_type
    
    prompt_preset_turns = global_config.get("promptPresetTurns", [])
    gemini_formatted_turns = _convert_turns_to_gemini_format(prompt_preset_turns)
    
    thinking_config = {}
    if model_id and "gemini-2." in model_id:
        thinking_config = {"thinkingBudget": 128}
    else:
        thinking_config = {"includeThoughts": False, "thinkingLevel": "LOW"}

    base_payload = {
        "model_id_to_use": model_id,
        "systemInstruction": global_config.get("systemInstruction", ""),
        "contents": gemini_formatted_turns,
        "generationConfig": {
            "temperature": float(global_config.get("temperature", 1.0)),
            "topP": float(global_config.get("topP", 0.9)),
            "topK": int(global_config.get("topK", 40)),
            "maxOutputTokens": int(global_config.get("maxOutputTokens", 2048)),
            "responseMimeType": global_config.get("responseMimeType", "application/json"),
            "thinkingConfig": thinking_config,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"}
        ]
    }
    
    if api_call_config.get("response_schema"):
        try:
            schema_str = _replace_placeholders_in_string(api_call_config["response_schema"], context)
            base_payload["generationConfig"]["responseSchema"] = json.loads(schema_str)
        except (json.JSONDecodeError, TypeError):
            pass

    final_payload = replace_placeholders_in_payload(base_payload, context)
    
    if isinstance(final_payload.get("systemInstruction"), str):
        final_payload["systemInstruction"] = {"parts": [{"text": final_payload["systemInstruction"]}]}
        
    return final_payload, context