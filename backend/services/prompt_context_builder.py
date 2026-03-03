import os
import re
from datetime import datetime, timedelta
from backend.services.config_io import (
    CHATROOMS_DIR, CHATROOM_CONFIG_FILENAME, ROLES_SUBDIR, NOVELS_SUBDIR, EVENTS_SUBDIR,
    read_json_safely, _load_partition_data
)
from backend.services.knowledge_base_io import get_knowledge_groups, get_knowledge_group_entries
from backend.services.prompt_format_utils import (
    _get_role_name_maps, _get_display_name, _get_unique_name, _calculate_last_actor,
    _format_partition_history, _is_standard_time_format, _get_role_effective_identities,
    _format_role_setting_for_prompt, _get_non_silent_roles_settings, _get_non_silent_roles_memories,
    _get_non_silent_roles_detailed_states, _get_public_infos_collection
)

def _get_novel_and_script_content(chatroom_details, partition, global_config, display_name_map, all_roles, current_role_name, tool_name=None, context_for_kb_matching=None):
    active_novel_ids = partition.get("activeNovelIds", [])
    novel_defs = chatroom_details.get("novels", [])
    script_text = partition.get("script", "").strip()
    all_content_parts = []

    if active_novel_ids:
        N = global_config.get("originalNovelLength", 1)

        for novel_id in active_novel_ids:
            novel_data = next((n for n in novel_defs if n.get("id") == novel_id), None)
            novel_name = novel_data.get("name", f"小说 {novel_id[:4]}") if novel_data else f"小说 {novel_id[:4]}"
            novel_part = f"[{novel_name} 内容开始]\n"
            
            if not novel_data or not novel_data.get("toc"):
                novel_part += f"[警告：小说 {novel_name} 内容未加载/为空]"
            else:
                toc = novel_data.get("toc", [])
                total_chapters = len(toc)
                X = int(partition.get("novelCurrentChapterIndices", {}).get(novel_id, 0))
                
                content_range_end = X + 3 + N
                summary_range_start = max(0, X - 3)
                summary_range_end = content_range_end + 10
                
                loop_start = summary_range_start
                loop_end = min(total_chapters - 1, summary_range_end)

                context_blocks = []
                for i in range(loop_start, loop_end + 1):
                    chapter_entry = toc[i]
                    block_content = []
                    
                    header = f"章节: {chapter_entry.get('title', '未知')}"
                    
                    parts = []
                    
                    if chapter_entry.get("summary"):
                        parts.append(f"总结: {chapter_entry['summary']}")
                    
                    if X <= i <= content_range_end:
                        parts.append(f"正文:\n{chapter_entry.get('content', '')}")
                    
                    if parts:
                         block_content.append(header)
                         block_content.extend(parts)
                         context_blocks.append('\n'.join(block_content))

                novel_part += '\n\n'.join(context_blocks)
                
            novel_part += f"\n[{novel_name} 内容结束]"
            all_content_parts.append(novel_part)

    if script_text:
        all_content_parts.append(f"[SCRIPT CONTENT]\n{script_text}")

    try:
        matching_source_text = ""
        if context_for_kb_matching:
            matching_source_text += context_for_kb_matching.get('single_role_setting_value', '')
            matching_source_text += context_for_kb_matching.get('single_role_state_value', '')
            matching_source_text += context_for_kb_matching.get('nonSilentRoleSettingsValue', '')
            matching_source_text += context_for_kb_matching.get('nonSilentRoleDetailedStatesValue', '')
            matching_source_text += context_for_kb_matching.get('formattedHistory', '')

        if matching_source_text:
            knowledge_content = set()
            knowledge_groups = get_knowledge_groups()
            for group_info in knowledge_groups:
                group_name = group_info['name']
                if f"@{group_name}" in matching_source_text:
                    entries = get_knowledge_group_entries(group_name)
                    for entry in entries:
                        knowledge_content.add(entry.get('content', ''))
                else:
                    entries = get_knowledge_group_entries(group_name)
                    for entry in entries:
                        if entry.get('name') and entry.get('name') in matching_source_text:
                            knowledge_content.add(entry.get('content', ''))
                            continue
                        for keyword in entry.get('keywords', []):
                            if keyword and keyword in matching_source_text:
                                knowledge_content.add(entry.get('content', ''))
                                break
            
            if knowledge_content:
                all_content_parts.append(f"[KNOWLEDGE BASE CONTENT]\n" + "\n\n".join(sorted(list(knowledge_content))))
            
    except Exception as e:
        pass

    return '\n\n'.join(all_content_parts) or "[原著小说、剧本和知识库内容均为空]"

def calculate_virtual_world_time(chatroom_name, partition_id):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.join(chatrooms_dir, chatroom_name)
    main_config = read_json_safely(os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME))
    if not main_config: return None

    all_history = []
    current_partition = _load_partition_data(chatroom_path, partition_id)
    if current_partition.get("allowCrossPartitionHistoryAccess"):
        partitions_data = {pid: _load_partition_data(chatroom_path, pid) for pid in main_config.get('partitionsOrder', [])}
        for p in partitions_data.values():
            if p.get("allowCrossPartitionHistoryAccess"):
                all_history.extend(p.get("history", []))
    else:
        all_history.extend(current_partition.get("history", []))
    
    all_history = sorted(list({msg['id']: msg for msg in all_history}.values()), key=lambda x: x.get('timestamp', 0))

    world_info = '[世界信息未获取]'
    for msg in reversed(all_history):
        if msg.get("status") == 'pending' or not isinstance(msg.get("statusProcessingSystemResult"), dict): continue
        sps = msg["statusProcessingSystemResult"]
        if isinstance(sps.get("processedSceneContext"), dict):
            ctx = sps["processedSceneContext"]
            date = next((i for i in ctx.get("timeItems", []) if _is_standard_time_format(i)), "")
            if date:
                world_info = f"Time: {date}"
                break
    
    if world_info == '[世界信息未获取]':
        partition_roles_aliases = current_partition.get('roleAliases', [])
        
        active_identity_pool = set()
        for role_alias in partition_roles_aliases:
            if role_alias.get('name'):
                 active_identity_pool.update(_get_role_effective_identities(role_alias['name'], main_config))

        events_file_path = os.path.join(chatroom_path, EVENTS_SUBDIR, 'events.json')
        global_events = read_json_safely(events_file_path).get('events', []) if os.path.exists(events_file_path) else []
        
        all_dates = []
        
        all_roles_in_room = [data for role_file in os.listdir(os.path.join(chatroom_path, ROLES_SUBDIR)) if role_file.endswith('.json') and (data := read_json_safely(os.path.join(chatroom_path, ROLES_SUBDIR, role_file)))]
        
        for role_data in all_roles_in_room:
             if role_data and role_data.get('memory') and role_data.get('name') in {a['name'] for a in partition_roles_aliases}:
                for mem in role_data['memory']:
                    if _is_standard_time_format(mem.get('time')):
                        all_dates.append(mem['time'])

        for event in global_events:
            involved_set = set(event.get('involvedCharacters', []))
            if not involved_set or not involved_set.isdisjoint(active_identity_pool):
                if _is_standard_time_format(event.get('time')):
                    all_dates.append(event['time'])
        
        latest_date_obj = datetime.now()
        if all_dates:
            try:
                latest_date_obj = datetime.strptime(max(all_dates), '%Y-%m-%d')
            except (ValueError, TypeError): pass

        date_directive = None
        if all_history:
            first_message = all_history[0]
            if first_message.get('sourceType') == 'user' and first_message.get('roleName') == '用户':
                content = first_message.get('speechActionText', '')
                match = re.search(r'“(-?\d+)”', content)
                if match: date_directive = match.group(1)
        
        new_date_obj = None
        if date_directive:
            if len(date_directive) == 8 and not date_directive.startswith('-'):
                try: new_date_obj = datetime.strptime(date_directive, '%Y%m%d')
                except ValueError: pass
            elif len(date_directive) == 4 and not date_directive.startswith('-'):
                try: new_date_obj = datetime.strptime(f"{latest_date_obj.year}{date_directive}", '%Y%m%d')
                except ValueError: pass
            else:
                try:
                    days_to_add = int(date_directive)
                    new_date_obj = latest_date_obj + timedelta(days=days_to_add)
                except ValueError: pass
        
        if new_date_obj:
            world_info = f"Time: {new_date_obj.strftime('%Y-%m-%d')}"
        else:
            world_info = f"Time: {(latest_date_obj + timedelta(days=1)).strftime('%Y-%m-%d')}"
            
    date_match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info)
    return date_match.group(1) if date_match else None

def _get_full_context_for_partition(chatroom_name, partition_id, current_api_call_role_name, current_api_call_role_type, global_config, triggering_character_name=None):
    chatrooms_dir = os.path.abspath(CHATROOMS_DIR)
    chatroom_path = os.path.join(chatrooms_dir, chatroom_name)
    if not os.path.isdir(chatroom_path):
        return None
    
    main_config = read_json_safely(os.path.join(chatroom_path, CHATROOM_CONFIG_FILENAME))
    if not main_config:
        return None
    
    current_partition = _load_partition_data(chatroom_path, partition_id)
    if not current_partition:
        return None
    
    all_role_names_in_partitions = {alias['name'] for pid in main_config.get('partitionsOrder', []) if (p := _load_partition_data(chatroom_path, pid)) for alias in p.get('roleAliases', [])}
    all_roles_in_room = [data for role_file in os.listdir(os.path.join(chatroom_path, ROLES_SUBDIR)) if role_file.endswith('.json') and (data := read_json_safely(os.path.join(chatroom_path, ROLES_SUBDIR, role_file))) and data.get('name') in all_role_names_in_partitions]
    
    all_novels = [data for novel_file in os.listdir(os.path.join(chatroom_path, NOVELS_SUBDIR)) if novel_file.endswith('.json') and (data := read_json_safely(os.path.join(chatroom_path, NOVELS_SUBDIR, novel_file)))]
    
    events_file_path = os.path.join(chatroom_path, EVENTS_SUBDIR, 'events.json')
    global_events = read_json_safely(events_file_path).get('events', []) if os.path.exists(events_file_path) else []
    
    partitions_data = {pid: _load_partition_data(chatroom_path, pid) for pid in main_config.get('partitionsOrder', [])}
    
    chatroom_details = {"config": main_config, "roles": all_roles_in_room, "novels": all_novels, "partitions": partitions_data, "events": global_events}
    
    role_name_map, reverse_role_name_map = _get_role_name_maps(partitions_data, partition_id)
    
    all_history = []
    if current_partition.get("allowCrossPartitionHistoryAccess"):
        partitions_to_scan = [p for p in partitions_data.values() if p.get("allowCrossPartitionHistoryAccess")]
        source_actor_restricted_tools = ['statusProcessingSystem', 'drawingMaster', 'closeUpMaster']
        is_tool_with_source_actor = current_api_call_role_type == 'tool' and current_api_call_role_name in source_actor_restricted_tools
        
        for p in partitions_to_scan:
            can_add_history = False
            effective_actor_name = triggering_character_name if is_tool_with_source_actor else current_api_call_role_name

            if is_tool_with_source_actor and effective_actor_name:
                source_actor_state = next((a.get('state', '默') for a in p.get("roleAliases", []) if a.get('name') == effective_actor_name), '默')
                if source_actor_state in ['活', '用']:
                    can_add_history = True
            elif current_api_call_role_type in ['role', 'temporary_role'] and effective_actor_name:
                actor_state = next((a.get('state', '默') for a in p.get("roleAliases", []) if a.get('name') == effective_actor_name), '默')
                if actor_state in ['活', '用']:
                    can_add_history = True
            elif not (current_api_call_role_type in ['role', 'temporary_role'] or is_tool_with_source_actor):
                can_add_history = True
            
            if can_add_history:
                all_history.extend(p.get("history", []))
    else:
        all_history.extend(current_partition.get("history", []))

    all_history = sorted(list({msg['id']: msg for msg in all_history}.values()), key=lambda x: x.get('timestamp', 0))

    world_info = calculate_virtual_world_time(chatroom_name, partition_id)
    if world_info:
        world_info = f"Time: {world_info}"
    else:
        world_info = '[世界信息未获取]'
    
    role_detailed_states = {a['name']: f"[{_get_display_name(a['name'], role_name_map)} 在当前分区无详细状态]" for a in current_partition.get("roleAliases", [])}
    role_states = {a['name']: a.get('state', '默') for a in current_partition.get("roleAliases", [])}
    non_silent_roles = [a for a in current_partition.get("roleAliases", []) if a.get('state') in ['活', '用']]
            
    for msg in all_history:
        if msg.get("status") == 'pending' or not isinstance(msg.get("statusProcessingSystemResult"), dict): continue
        sps = msg["statusProcessingSystemResult"]
        if isinstance(sps.get("processedCharacterInfo"), dict):
            info = sps["processedCharacterInfo"]
            name = _get_unique_name(info.get("characterName"), reverse_role_name_map)
            if name:
                parts = []
                for k, v in info.items():
                    if k == 'characterName': continue
                    val_str = ""
                    if isinstance(v, list):
                        filtered_v = [str(x) for x in v if str(x) != '无']
                        val_str = ', '.join(filtered_v)
                    else:
                        val_str = str(v) if v and str(v) != '无' else ""
                    parts.append(f"{k}: {val_str}")
                role_detailed_states[name] = f"{info.get('characterName')}：\n" + '\n'.join(parts)


    clothing_guide = global_config.get("clothingGuide", "").strip()
    should_append_clothing_guide_to_prompt = False
    
    if clothing_guide:
        target_subject = None
        is_first_time = False
        
        if current_api_call_role_name == 'statusProcessingSystem':
            target_subject = triggering_character_name
            if target_subject:
                count = sum(1 for msg in all_history if msg.get('roleName') == target_subject)
                if count == 1: is_first_time = True
        
        elif current_api_call_role_type in ['role', 'temporary_role']:
            target_subject = current_api_call_role_name
            if target_subject:
                count = sum(1 for msg in all_history if msg.get('roleName') == target_subject)
                if count == 0: is_first_time = True
        
        if target_subject and is_first_time:
            role_detailed_states[target_subject] = clothing_guide
            should_append_clothing_guide_to_prompt = True

    current_role_data = next((r for r in all_roles_in_room if r['name'] == current_api_call_role_name), None)
    
    single_role_setting_value = _format_role_setting_for_prompt(current_role_data, world_info)
    single_role_state_value = role_detailed_states.get(current_api_call_role_name, '')
    
    non_silent_role_settings_value = _get_non_silent_roles_settings(non_silent_roles, all_roles_in_room, world_info, role_name_map)
    non_silent_role_detailed_states_value = _get_non_silent_roles_detailed_states(non_silent_roles, role_detailed_states, role_name_map)
    formatted_history = f"<History>\n{_format_partition_history(all_history, role_name_map)}\n</History>"
    
    context_for_kb_matching = {
        'single_role_setting_value': single_role_setting_value,
        'single_role_state_value': single_role_state_value,
        'nonSilentRoleSettingsValue': non_silent_role_settings_value,
        'nonSilentRoleDetailedStatesValue': non_silent_role_detailed_states_value,
        'formattedHistory': formatted_history,
    }

    return {
        "chatroomDetails": chatroom_details,
        "role_name_map": role_name_map, "reverse_role_name_map": reverse_role_name_map,
        "worldInfo": world_info, "roleDetailedStates": role_detailed_states,
        "lastActor": _calculate_last_actor(all_history),
        "nonSilentRolesValue": ','.join([_get_display_name(r['name'], role_name_map) for r in non_silent_roles]) or '[无激活角色]',
        "userControlRoleNamesValue": ','.join([_get_display_name(r['name'], role_name_map) for r in non_silent_roles if r.get('state') == '用']) or '[无用状态角色]',
        "formattedHistory": formatted_history,
        "latestMessageContent": _format_partition_history(all_history[-4:], role_name_map, include_location=False),
        "allPartitions": partitions_data, "allRolesInRoom": all_roles_in_room, "currentPartitionData": current_partition, "roleStates": role_states,
        "nonSilentRoleSettingsValue": non_silent_role_settings_value,
        "nonSilentRoleMemoriesValue": _get_non_silent_roles_memories(non_silent_roles, all_roles_in_room, global_events, world_info, role_name_map, is_tool=current_api_call_role_type == 'tool', chatroom_config=main_config),
        "nonSilentRoleDetailedStatesValue": non_silent_role_detailed_states_value,
        "publicInfosCollectionValue": _get_public_infos_collection(all_roles_in_room, current_partition, role_states, current_api_call_role_name, current_api_call_role_type, role_name_map, world_info, main_config, triggering_character_name),
        "novelAndScriptContent": _get_novel_and_script_content(
            chatroom_details, current_partition, global_config, role_name_map, all_roles_in_room, 
            current_api_call_role_name, tool_name=current_api_call_role_name,
            context_for_kb_matching=context_for_kb_matching
        ),
        "should_append_clothing_guide_to_prompt": should_append_clothing_guide_to_prompt
    }