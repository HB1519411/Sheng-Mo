import re
import json
from backend.services.prompt_context_builder import _get_full_context_for_partition
from backend.services.prompt_format_utils import (
    _get_visibility_scope, _format_role_setting_for_prompt,
    _format_role_memory_for_prompt
)

def _replace_placeholders_in_string(text, context):
    if not isinstance(text, str) or '{{' not in text: return text

    def replacer(match):
        content = match.group(1).strip()
        raw_value = _resolve_placeholder(content, context)
        return _replace_placeholders_in_string(str(raw_value), context)

    return re.sub(r'\{\{([^}]+?)\}\}', replacer, text)

def _resolve_placeholder(content, context):
    api_call_context = context["api_call"]
    caller_name = api_call_context["role_name"]
    
    if caller_name == 'novelSummaryMaster':
        if content == '原著小说':
            summary_ctx = api_call_context["summaryContext"]
            novel_id = summary_ctx["novelId"]
            idx = summary_ctx["tocEntryIndex"]
            novels = context["chatroomDetails"]["novels"]
            
            novel = next(n for n in novels if n["id"] == novel_id)
            start = max(0, idx - 10)
            summaries = []
            for i in range(start, idx):
                chap = novel["toc"][i]
                if "summary" in chap and chap["summary"]:
                    summaries.append(f"章节: {chap.get('title', '')}\n总结: {chap['summary']}")
            
            return "[前情提要 开始]\n\n" + "\n\n".join(summaries) + "\n\n[前情提要 结束]" if summaries else "[无前情提要]"
            
        elif content == '数据库': 
            return f"<Database>\n{api_call_context['database_instruction']}\n</Database>"
        elif content == '章节标题': 
            return context["chapterTitleForTool"]
        elif content == '章节内容片段': 
            return context["chapterContentForTool"]

    display_map = context["role_name_map"]
    main_config = context["chatroomDetails"]["config"]
    
    direct_mapping = {
        '角色名称集': context["nonSilentRolesValue"],
        '用角色名称集': context["userControlRoleNamesValue"],
        '最新角色': display_map.get(context["lastActor"], context["lastActor"]),
        '消息记录': context["formattedHistory"],
        '角色设定集': f"<CharacterSettingsCollection>\n{context['nonSilentRoleSettingsValue']}\n</CharacterSettingsCollection>",
        '角色状态集': f"<CharacterStatesCollection>\n{context['nonSilentRoleDetailedStatesValue']}\n</CharacterStatesCollection>",
        '角色记忆集': f"<CharacterMemoriesCollection>\n{context['nonSilentRoleMemoriesValue']}\n</CharacterMemoriesCollection>",
        '公开信息集': f"<CharacterPublicInfosCollection>\n{context['publicInfosCollectionValue']}\n</CharacterPublicInfosCollection>",
        '世界信息': f"<WorldInfo>\n{context['worldInfo']}\n</WorldInfo>",
        '公共信息': f"<PublicInfo>\n{main_config['publicInfo']}\n</PublicInfo>",
        '主提示词': f"<MainPrompt>\n{api_call_context['main_prompt']}\n</MainPrompt>",
        '数据库': f"<Database>\n{api_call_context['database_instruction']}\n</Database>",
        '绘图角色': display_map.get(context["triggeringCharacterName"], context["triggeringCharacterName"]),
        'user': main_config["user"],
        '最新消息': f"<LatestNews>\n{context['latestMessageContent']}\n</LatestNews>",
        '扮演规则': f"<RoleplayRules>\n{context['currentPartitionData']['roleplayRules']}\n</RoleplayRules>"
    }
    
    if content == '原著小说':
        val = context["global_config"]["drawingMaster_novelContent"] if caller_name in ['drawingMaster', 'closeUpMaster'] else context["novelAndScriptContent"]
        return f"<OriginalNovel>\n{val}\n</OriginalNovel>"

    if content in direct_mapping: 
        return direct_mapping[content]
    
    target_role = None
    if content.startswith('源角色'): target_role = context["triggeringCharacterName"]
    elif content.startswith('目标角色'): target_role = context["targetRoleNameForTool"]
    elif content.startswith('角色'): target_role = caller_name
    elif content.endswith('角色记忆'): target_role = content[:-4].strip()

    if target_role:
        r_alias = display_map.get(target_role, target_role)
        if content.endswith('名称'): 
            return r_alias
            
        r_data = next(r for r in context["allRolesInRoom"] if r['name'] == target_role)
        tag_name = f"{r_alias.replace(' ', '_')}_{content.split('角色')[-1]}"
        
        if content.endswith('设定'): 
            inner = _format_role_setting_for_prompt(r_data, context["worldInfo"])
        elif content.endswith('记忆'):
            scope = _get_visibility_scope(target_role, 'role', [], main_config)
            inner = _format_role_memory_for_prompt(r_data['memory'], context["chatroomDetails"]["events"], target_role, None, scope, main_config)
        elif content.endswith('状态'):
            inner = context['roleDetailedStates'][target_role]
        else:
            raise ValueError(f"无法解析的动态占位符类型: {content}")
            
        return f"<{tag_name}>\n{inner}\n</{tag_name}>"

    raise ValueError(f"无法解析的未知占位符: {content}")

def replace_placeholders_in_payload(payload, context):
    if isinstance(payload, dict):
        return {k: replace_placeholders_in_payload(v, context) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [replace_placeholders_in_payload(i, context) for i in payload]
    elif isinstance(payload, str):
        return _replace_placeholders_in_string(payload, context)
    return payload

def build_standard_request_body(trigger_info, global_config):
    context = _get_full_context_for_partition(
        trigger_info["chatroomName"],
        trigger_info["partitionId"],
        trigger_info["roleName"],
        trigger_info["roleType"],
        global_config,
        trigger_info.get("triggeringCharacterName")
    )
    if not context: raise ValueError("获取分区上下文失败")
    
    context["allRolesInRoom"] = context["chatroomDetails"]["roles"]
        
    context.update({
        "targetRoleNameForTool": trigger_info.get("targetRoleNameForTool"),
        "triggeringCharacterName": trigger_info.get("triggeringCharacterName"),
        "global_config": global_config
    })
    
    role_name, role_type = trigger_info["roleName"], trigger_info["roleType"]
    
    if role_type in ['role', 'temporary_role']:
        source = global_config
        prefix = "generalModelSelectionType"
    else:
        source = global_config["toolSettings"][role_name]
        prefix = "model_selection_type"

    api_config = {
        "model_selection_type": source[prefix] if role_type != 'tool' else source.get('model_selection_type', 'primary'),
        "database_instruction": source.get("sharedDatabaseInstruction" if role_type != 'tool' else "toolDatabaseInstruction", ""),
        "main_prompt": source["mainPrompt"],
        "response_schema": source.get("responseSchemaJson"),
        "responseSchemaParserJs": source.get("responseSchemaParserJs", "")
    }

    if context.get("should_append_clothing_guide_to_prompt"):
        guide = global_config["clothingGuide"].strip()
        if guide: api_config["main_prompt"] += f"\n\n{guide}"

    context["api_call"] = {
        "role_name": role_name, "role_type": role_type, 
        "summaryContext": trigger_info.get("summaryContext", {}), 
        **api_config
    }
    
    if role_name == 'novelSummaryMaster':
        s_ctx = trigger_info["summaryContext"]
        novel = next(n for n in context["chatroomDetails"]["novels"] if n["id"] == s_ctx["novelId"])
        toc = novel["toc"][s_ctx["tocEntryIndex"]]
        context["chapterContentForTool"] = toc["content"]
        context["chapterTitleForTool"] = s_ctx.get("chapterTitle", toc["title"])

    ms_type = api_config["model_selection_type"]
    model_id = global_config[f"{ms_type}_model_id"]
    context["model_selection_type"] = ms_type

    messages = []
    for turn in global_config["promptPresetTurns"]:
        messages.append({"role": turn["role"], "content": turn["instruction"]})

    base_payload = {
        "model": model_id,
        "system_prompt": global_config["systemInstruction"],
        "messages": messages,
        "temperature": float(global_config["temperature"]),
        "top_p": float(global_config["topP"]),
        "max_tokens": int(global_config["maxOutputTokens"])
    }
    
    if api_config["response_schema"]:
        schema_str = _replace_placeholders_in_string(api_config["response_schema"], context)
        base_payload["response_schema"] = json.loads(schema_str)

    return replace_placeholders_in_payload(base_payload, context), context