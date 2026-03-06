import os
import re
from datetime import datetime, timedelta
from backend.services.chatroom_service import get_full_chatroom_details
from backend.services.knowledge_base_io import get_knowledge_groups, get_knowledge_group_entries
from backend.services.prompt_format_utils import (
    _get_role_name_maps, _calculate_last_actor,
    _format_partition_history, _is_standard_time_format, _get_role_effective_identities,
    _format_role_setting_for_prompt, _get_non_silent_roles_settings, _get_non_silent_roles_memories,
    _get_non_silent_roles_detailed_states, _get_public_infos_collection
)

def _get_novel_and_script_content(chatroom_details, partition, global_config, context_for_kb_matching=None):
    active_novel_ids = partition.get("activeNovelIds", [])
    novel_defs = chatroom_details.get("novels", [])
    script_text = partition.get("script", "").strip()
    all_content_parts = []

    if active_novel_ids:
        N = global_config.get("originalNovelLength", 1)
        for novel_id in active_novel_ids:
            novel_data = next((n for n in novel_defs if n.get("id") == novel_id), None)
            if not novel_data: continue
            
            novel_name = novel_data.get("name", f"小说 {novel_id[:4]}")
            novel_part = f"[{novel_name} 内容开始]\n"
            
            toc = novel_data.get("toc", [])
            if not toc:
                novel_part += f"[警告：小说 {novel_name} 内容未加载/为空]"
            else:
                X = int(partition.get("novelCurrentChapterIndices", {}).get(novel_id, 0))
                
                loop_start = max(0, X - 3)
                loop_end = min(len(toc) - 1, X + 3 + N + 10)

                context_blocks = []
                for i in range(loop_start, loop_end + 1):
                    chapter_entry = toc[i]
                    parts = []
                    if chapter_entry.get("summary"):
                        parts.append(f"总结: {chapter_entry['summary']}")
                    if X <= i <= X + 3 + N:
                        parts.append(f"正文:\n{chapter_entry.get('content', '')}")
                    
                    if parts:
                         context_blocks.append(f"章节: {chapter_entry.get('title', '未知')}\n" + "\n".join(parts))

                novel_part += '\n\n'.join(context_blocks)
            novel_part += f"\n[{novel_name} 内容结束]"
            all_content_parts.append(novel_part)

    if script_text:
        all_content_parts.append(f"[SCRIPT CONTENT]\n{script_text}")

    matching_source_text = "".join(str(v) for v in (context_for_kb_matching or {}).values() if v)

    if matching_source_text:
        knowledge_content = set()
        for group_info in get_knowledge_groups():
            group_name = group_info['name']
            entries = get_knowledge_group_entries(group_name)
            
            if f"@{group_name}" in matching_source_text:
                for entry in entries: knowledge_content.add(entry.get('content', ''))
                continue

            for entry in entries:
                if (entry.get('name') and entry['name'] in matching_source_text) or \
                   any(k and k in matching_source_text for k in entry.get('keywords', [])):
                    knowledge_content.add(entry.get('content', ''))
        
        if knowledge_content:
            all_content_parts.append(f"[KNOWLEDGE BASE CONTENT]\n" + "\n\n".join(sorted(list(knowledge_content))))

    return '\n\n'.join(all_content_parts) or "[原著小说、剧本和知识库内容均为空]"

def calculate_virtual_world_time(chatroom_name, partition_id, chatroom_details=None):
    # Data Retrieval
    if not chatroom_details:
        chatroom_details = get_full_chatroom_details(chatroom_name)
        if not chatroom_details: return None

    # Structural alignment: service returns list, we might need map for logic
    partitions_map = {p['id']: p for p in chatroom_details.get("partitions", [])}
    main_config = chatroom_details.get("config", {})
    current_partition = partitions_map.get(partition_id)
    if not current_partition: return None

    # History Aggregation
    all_history = []
    partitions_to_load = [partition_id]
    if current_partition.get("allowCrossPartitionHistoryAccess"):
        partitions_to_load = main_config.get('partitionsOrder', [])
    
    for pid in partitions_to_load:
        p_data = partitions_map.get(pid)
        if p_data and (pid == partition_id or p_data.get("allowCrossPartitionHistoryAccess")):
            all_history.extend(p_data.get("history", []))
    
    all_history.sort(key=lambda x: x.get('timestamp', 0))

    # Priority 1: Check SPS result in history
    for msg in reversed(all_history):
        if msg.get("status") == 'pending': continue
        ctx = (msg.get("statusProcessingSystemResult") or {}).get("processedSceneContext", {})
        date = next((i for i in ctx.get("timeItems", []) if _is_standard_time_format(i)), "")
        if date: return date
    
    # Priority 2: Max date from Events or Memory
    all_dates = []
    
    for e in chatroom_details.get('events', []):
        if _is_standard_time_format(e.get('time')): all_dates.append(e['time'])

    active_role_names = {a['name'] for a in current_partition.get('roleAliases', [])}
    for r_data in chatroom_details.get('roles', []):
        if r_data.get('name') in active_role_names:
            for mem in r_data.get('memory', []):
                if _is_standard_time_format(mem.get('time')): all_dates.append(mem['time'])

    latest_date_obj = datetime.now()
    if all_dates:
        try: latest_date_obj = datetime.strptime(max(all_dates), '%Y-%m-%d')
        except ValueError: pass

    # Priority 3: User directive in first message (Legacy feature)
    date_directive = None
    if all_history:
        first_msg = all_history[0]
        if first_msg.get('sourceType') == 'user' and first_msg.get('roleName') == '用户':
            match = re.search(r'“(-?\d+)”', first_msg.get('speechActionText', ''))
            if match: date_directive = match.group(1)

    try:
        if date_directive:
            if len(date_directive) == 8:
                return datetime.strptime(date_directive, '%Y%m%d').strftime('%Y-%m-%d')
            elif len(date_directive) == 4:
                return datetime.strptime(f"{latest_date_obj.year}{date_directive}", '%Y%m%d').strftime('%Y-%m-%d')
            else:
                return (latest_date_obj + timedelta(days=int(date_directive))).strftime('%Y-%m-%d')
    except ValueError: pass

    return (latest_date_obj + timedelta(days=1)).strftime('%Y-%m-%d')

def _get_full_context_for_partition(chatroom_name, partition_id, current_api_call_role_name, current_api_call_role_type, global_config, triggering_character_name=None):
    # Centralized Data Loading (Group 3 Service)
    chatroom_details = get_full_chatroom_details(chatroom_name)
    if not chatroom_details: return None
    
    main_config = chatroom_details.get("config", {})
    # Transform list to map for O(1) access
    partitions_data = {p['id']: p for p in chatroom_details.get("partitions", [])}
    current_partition = partitions_data.get(partition_id)
    if not current_partition: return None
    
    role_name_map, reverse_role_name_map = _get_role_name_maps(partitions_data, partition_id)
    all_roles_in_room = chatroom_details.get("roles", [])
    global_events = chatroom_details.get("events", [])
    
    # History Aggregation
    all_history = []
    partitions_to_scan = [current_partition]
    if current_partition.get("allowCrossPartitionHistoryAccess"):
        partitions_to_scan = [p for p in partitions_data.values() if p.get("allowCrossPartitionHistoryAccess")]

    bound_tools = ['characterUpdateMaster', 'statusProcessingSystem', 'drawingMaster']
    is_bound_mode = (current_api_call_role_type in ['role', 'temporary_role']) or (current_api_call_role_type == 'tool' and current_api_call_role_name in bound_tools)
    
    target_actor_name = triggering_character_name if (is_bound_mode and current_api_call_role_type == 'tool') else current_api_call_role_name
    
    # Determine active witnesses for visibility filtering
    active_witnesses = set()
    if not is_bound_mode:
        for a in current_partition.get("roleAliases", []):
            if a.get('state') in ['活', '用']:
                active_witnesses.add(a.get('name'))

    for p in partitions_to_scan:
        is_visible = False
        p_active_roles = set(a.get('name') for a in p.get("roleAliases", []) if a.get('state') in ['活', '用'])
        
        if is_bound_mode:
            if target_actor_name:
                is_visible = target_actor_name in p_active_roles
            else:
                is_visible = True
        else:
            if p.get('id') == partition_id or bool(p_active_roles.intersection(active_witnesses)):
                is_visible = True
        
        if is_visible:
            all_history.extend(p.get("history", []))

    all_history.sort(key=lambda x: x.get('timestamp', 0))
    # Deduplication removed: Assuming data integrity from service

    world_date = calculate_virtual_world_time(chatroom_name, partition_id, chatroom_details)
    world_info = f"Time: {world_date}" if world_date else '[世界信息未获取]'

    role_detailed_states = {}
    role_states = {}
    non_silent_roles = []
    
    for a in current_partition.get("roleAliases", []):
        name = a['name']
        role_states[name] = a.get('state', '默')
        role_detailed_states[name] = f"[{role_name_map.get(name, name)} 在当前分区无详细状态]"
        if a.get('state') in ['活', '用']:
            non_silent_roles.append(a)

    # State Extraction from History
    for msg in reversed(all_history):
        if msg.get("status") == 'pending': continue
        sps = msg.get("statusProcessingSystemResult")
        if sps and sps.get("processedCharacterInfo"):
            info = sps["processedCharacterInfo"]
            char_name = reverse_role_name_map.get(info.get("characterName"), info.get("characterName"))
            if char_name and char_name in role_detailed_states:
                if "无详细状态" in role_detailed_states[char_name]:
                    parts = []
                    for k, v in info.items():
                        if k == 'characterName': continue
                        val_str = ', '.join([str(x) for x in v if str(x) != '无']) if isinstance(v, list) else (str(v) if v and str(v) != '无' else "")
                        if val_str: parts.append(f"{k}: {val_str}")
                    role_detailed_states[char_name] = f"{info.get('characterName')}：\n" + '\n'.join(parts)

    clothing_guide = global_config.get("clothingGuide", "").strip()
    should_append_clothing_guide = False
    if clothing_guide:
        target = triggering_character_name if current_api_call_role_name == 'statusProcessingSystem' else (current_api_call_role_name if current_api_call_role_type in ['role', 'temporary_role'] else None)
        if target:
            count = sum(1 for msg in all_history if msg.get('roleName') == target)
            if count <= 1:
                role_detailed_states[target] = clothing_guide
                should_append_clothing_guide = True

    non_silent_role_settings_value = _get_non_silent_roles_settings(non_silent_roles, all_roles_in_room, world_info, role_name_map)
    non_silent_role_detailed_states_value = _get_non_silent_roles_detailed_states(non_silent_roles, role_detailed_states, role_name_map)
    formatted_history = f"<History>\n{_format_partition_history(all_history, role_name_map)}\n</History>"

    context_for_kb = {
        'single_role_setting_value': _format_role_setting_for_prompt(next((r for r in all_roles_in_room if r['name'] == current_api_call_role_name), None), world_info),
        'single_role_state_value': role_detailed_states.get(current_api_call_role_name, ''),
        'nonSilentRoleSettingsValue': non_silent_role_settings_value,
        'nonSilentRoleDetailedStatesValue': non_silent_role_detailed_states_value,
        'formattedHistory': formatted_history,
    }

    return {
        "chatroomDetails": chatroom_details,
        "role_name_map": role_name_map,
        "worldInfo": world_info,
        "roleDetailedStates": role_detailed_states,
        "lastActor": _calculate_last_actor(all_history),
        "nonSilentRolesValue": ','.join([role_name_map.get(r['name'], r['name']) for r in non_silent_roles]) or '[无激活角色]',
        "userControlRoleNamesValue": ','.join([role_name_map.get(r['name'], r['name']) for r in non_silent_roles if r.get('state') == '用']) or '[无用状态角色]',
        "formattedHistory": formatted_history,
        "latestMessageContent": _format_partition_history(all_history[-4:], role_name_map, include_location=False),
        "currentPartitionData": current_partition,
        "nonSilentRoleSettingsValue": non_silent_role_settings_value,
        "nonSilentRoleMemoriesValue": _get_non_silent_roles_memories(non_silent_roles, all_roles_in_room, global_events, world_info, role_name_map, is_tool=current_api_call_role_type == 'tool', chatroom_config=main_config),
        "nonSilentRoleDetailedStatesValue": non_silent_role_detailed_states_value,
        "publicInfosCollectionValue": _get_public_infos_collection(all_roles_in_room, current_partition, role_states, current_api_call_role_name, current_api_call_role_type, role_name_map, world_info, main_config, triggering_character_name),
        "novelAndScriptContent": _get_novel_and_script_content(
            chatroom_details, current_partition, global_config, context_for_kb_matching=context_for_kb
        ),
        "should_append_clothing_guide_to_prompt": should_append_clothing_guide
    }