import re
from collections import defaultdict

def _get_role_name_maps(partitions_data, partition_id):
    role_name_map = {}
    reverse_role_name_map = {}
    
    role_name_map['用户'] = '用户'
    reverse_role_name_map['用户'] = '用户'

    if not partitions_data:
        return role_name_map, reverse_role_name_map

    partition = partitions_data.get(partition_id)
    if partition:
        for entry in partition.get("roleAliases", []):
            original_name = entry.get("name")
            alias = entry.get("alias", "").strip() or original_name
            if original_name:
                role_name_map[original_name] = alias
                reverse_role_name_map[alias] = original_name

    return role_name_map, reverse_role_name_map

def _get_display_name(unique_name, role_name_map):
    if not unique_name: return ''
    return role_name_map.get(unique_name, unique_name)

def _get_unique_name(display_name, reverse_role_name_map):
    if not display_name: return ''
    return reverse_role_name_map.get(display_name, display_name)

def _calculate_last_actor(history_array):
    if not history_array: return None
    for message in reversed(history_array):
        if message and message.get("status") != 'pending' and message.get("roleName"):
            return message.get("roleName")
    return None

def _format_partition_history(history_array, display_name_map, include_date_time=True, include_location=True):
    if not history_array: return ""
    formatted_blocks, prev_loc = [], None
    for i, msg in enumerate(history_array):
        if msg.get("status") == 'pending': continue
        block, time, loc = [], "", None
        sps_result = msg.get("statusProcessingSystemResult")
        if isinstance(sps_result, dict) and isinstance(sps_result.get("processedSceneContext"), dict):
            ctx = sps_result["processedSceneContext"]
            if isinstance(ctx.get("timeItems"), list):
                for item in ctx["timeItems"]:
                    if isinstance(item, str) and re.match(r'^\d{2}:\d{2}$', item.strip()):
                        time = item.strip()
            if isinstance(ctx.get("locationItems"), list) and ctx["locationItems"]:
                loc = ', '.join(filter(None, [str(s).strip() for s in ctx["locationItems"]]))
        if include_location and loc and loc != prev_loc:
            block.append(f"Location: {loc}")
            prev_loc = loc
        content = msg.get("speechActionText", "")
        if msg.get("roleType") in ['role', 'temporary_role'] and isinstance(msg.get("parsedResult"), dict) and isinstance(msg["parsedResult"].get("processedTurnActions"), list):
            actions = [a["content"].strip() for a in msg["parsedResult"]["processedTurnActions"] if a and a.get("isIncluded") is True and a.get("content")]
            content = '\n'.join(filter(None, actions))
        
        if i == 0 and msg.get('sourceType') == 'user' and msg.get('roleName') == '用户':
            content = re.sub(r'“(-?\d+)”', '', content).strip()
            
        if content:
            display_name = _get_display_name(msg.get("roleName"), display_name_map)
            time_prefix = f"{time} " if include_date_time and time else ""
            block.append(f"{time_prefix}{display_name}：{'\n' if '\n' in content else ''}{content}")
        if block: formatted_blocks.append('\n'.join(block))
    return '\n\n'.join(formatted_blocks)

def _is_standard_time_format(time_string):
    return isinstance(time_string, str) and bool(re.match(r'^-?\d{4}-\d{2}-\d{2}$', time_string))

def _calculate_age_and_memory_gap(memory_array, world_info, events_array=None):
    match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info or '')
    if not match: return {'age': '[无法计算]', 'memory_gap_days': None}
    
    def parse_date(date_str):
        parts = date_str.split('-');
        if date_str.startswith('-'):
            return {'year': -int(parts[1]), 'month': int(parts[2]), 'day': int(parts[3])}
        return {'year': int(parts[0]), 'month': int(parts[1]), 'day': int(parts[2])}

    current_date = parse_date(match.group(1))

    birth_dates = sorted([item['time'] for item in (memory_array or []) if _is_standard_time_format(item.get('time'))])
    if not birth_dates: return {'age': '[无法计算]', 'memory_gap_days': None}

    birth_date = parse_date(birth_dates[0])
    age = current_date['year'] - birth_date['year']
    if (current_date['month'], current_date['day']) < (birth_date['month'], birth_date['day']):
        age -= 1
    
    all_dates = set(birth_dates)
    if events_array:
        all_dates.update([item['time'] for item in events_array if _is_standard_time_format(item.get('time'))])
    
    valid_dates = sorted(list(all_dates))
    if not valid_dates:
        return {'age': f'{age}岁', 'memory_gap_days': None}
        
    latest_date_obj = parse_date(valid_dates[-1])
    
    def to_days(d):
        return d['year'] * 365.25 + d['month'] * 30.44 + d['day']
        
    gap = int(to_days(current_date) - to_days(latest_date_obj))
    return {'age': f'{age}岁', 'memory_gap_days': gap if gap >= 0 else None}

def _get_role_effective_identities(role_name, chatroom_config):
    if not role_name or not chatroom_config:
        return {role_name} if role_name else set()
    
    identities = {role_name}
    identity_groups = chatroom_config.get('identityGroups', [])
    for group in identity_groups:
        if isinstance(group, dict) and role_name in group.get('members', []):
            if group_name := group.get('name'):
                identities.add(group_name)
    return identities

def _get_visibility_scope(caller_name, caller_type, active_roles_list, chatroom_config):
    if caller_type in ['role', 'temporary_role']:
        return _get_role_effective_identities(caller_name, chatroom_config)
    
    elif caller_type == 'tool':
        tool_scope = set()
        for role_info in active_roles_list:
            if role_name := role_info.get('name'):
                tool_scope.update(_get_role_effective_identities(role_name, chatroom_config))
        return tool_scope
        
    return set()

def _format_role_setting_for_prompt(role_data, world_info):
    if not role_data: return '[角色数据未找到]'
    setting_parts = []
    if mbti := role_data.get('mbti'): setting_parts.append(f"MBTI: {mbti}")
    bf = ', '.join(filter(None, [f"{k[0].upper()}-{v}" for k, v in [('O', role_data.get('bigFiveOpenness')), ('C', role_data.get('bigFiveConscientiousness')), ('E', role_data.get('bigFiveExtraversion')), ('A', role_data.get('bigFiveAgreeableness')), ('N', role_data.get('bigFiveNeuroticism'))] if v]))
    if bf: setting_parts.append(f"BigFive: {bf}")
    if archetypes := role_data.get('archetypes'): setting_parts.append(f"Archetypes: {', '.join(archetypes)}")
    if keywords := role_data.get('keywords'): setting_parts.append(f"Keywords: {', '.join(keywords)}")
    if other_info := role_data.get('otherInfo'): setting_parts.append(f"OtherInfo:\n{other_info}")
    return '\n'.join(filter(None, setting_parts)).strip() or '[角色设定为空]'

def _format_role_memory_for_prompt(personal_memory_array, global_events, role_name, world_info_date, visibility_scope, chatroom_config=None):
    if not personal_memory_array and not global_events:
        return '[该角色无记忆条目]'

    merged_by_date = defaultdict(lambda: {"events": [], "personal": [], "isPinned": False})

    for item in (personal_memory_array or []):
        date = item.get('time')
        if date:
            item_data = {
                "content": item.get('content', ''),
                "details": item.get('details', ''),
                "isPinned": item.get('isPinned', False)
            }
            merged_by_date[date]["personal"].append(item_data)
            if item.get('isPinned'):
                merged_by_date[date]["isPinned"] = True

    relevant_events_for_gap = []
    for event in (global_events or []):
        involved_set = set(event.get('involvedCharacters', []))
        if not involved_set or not involved_set.isdisjoint(visibility_scope):
            relevant_events_for_gap.append(event)
            date = event.get('time')
            if date:
                content = event.get('content', '')
                details = event.get('details', '')
                if role_name in content:
                    content = content.replace(role_name, '我')
                if role_name in details:
                    details = details.replace(role_name, '我')
                
                item_data = {
                    "content": content,
                    "details": details,
                    "isPinned": event.get('isPinned', False)
                }
                merged_by_date[date]["events"].append(item_data)
                if event.get('isPinned'):
                    merged_by_date[date]["isPinned"] = True

    filtered_dates = {date for date in merged_by_date if not (world_info_date and _is_standard_time_format(date) and date > world_info_date)}
    if not filtered_dates:
        return '[该角色无符合当前日期的记忆条目]'
    
    def date_str_to_sort_key(d):
        is_standard = _is_standard_time_format(d)
        if not is_standard:
            return (1, d)
        
        sign = 1
        date_part = d
        if d.startswith('-'):
            sign = -1
            date_part = d[1:]
        
        try:
            num = int(date_part.replace('-', ''))
            return (0, sign * num)
        except ValueError:
            return (1, d)

    sorted_dates = sorted(list(filtered_dates), key=date_str_to_sort_key)
    
    total_dates_count = len(sorted_dates)
    formatted_entries = []
    
    for index, date in enumerate(sorted_dates):
        is_recent = index >= (total_dates_count - 10)
        is_pinned = merged_by_date[date]["isPinned"]
        show_details = is_recent or is_pinned
        
        day_summary_blocks = []
        day_details_blocks = []
        
        for item in merged_by_date[date]["events"]:
            if item["content"]:
                day_summary_blocks.append(item["content"])
            if show_details and item["details"]:
                day_details_blocks.append(item["details"])
        
        for item in merged_by_date[date]["personal"]:
            if item["content"]:
                day_summary_blocks.append(item["content"])
            if show_details and item["details"]:
                day_details_blocks.append(item["details"])
        
        if not day_summary_blocks and not day_details_blocks:
            continue
            
        entry_text = f"日期：{date}"
        
        if day_summary_blocks:
            entry_text += f"\n记忆(概要)：\n" + '\n'.join(day_summary_blocks)
            
        if day_details_blocks:
            entry_text += f"\n记忆(详情)：\n" + '\n\n'.join(day_details_blocks)
            
        formatted_entries.append(entry_text)

    gap_info = _calculate_age_and_memory_gap(personal_memory_array, f"Date: {world_info_date}" if world_info_date else "", relevant_events_for_gap)
    gap_days = gap_info.get('memory_gap_days')
    gap_text = ""
    if gap_days is not None and gap_days > 0:
        y, m, d = gap_days // 365, (gap_days % 365) // 30, (gap_days % 365) % 30
        gap_text = f"(距离你最新的记忆，已过去{f'{y}年' if y else ''}{f'{m}月' if m else ''}{d}天)\n"

    return gap_text + '\n\n'.join(formatted_entries)

def _get_non_silent_roles_settings(non_silent_roles, all_roles, world_info, display_map):
    content = [f"<{alias.replace(' ', '_')}_Setting>\n{_format_role_setting_for_prompt(next((r for r in all_roles if r['name'] == role['name']), None), world_info)}\n</{alias.replace(' ', '_')}_Setting>" for role in non_silent_roles if (alias := _get_display_name(role['name'], display_map))]
    return '\n\n'.join(content) or '[无激活角色设定]'

def _get_non_silent_roles_memories(non_silent_roles, all_roles, global_events, world_info, display_map, is_tool=False, chatroom_config=None):
    date_match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info or '')
    date = date_match.group(1) if date_match else None
    
    memory_contents = []

    for role in non_silent_roles:
        role_data = next((r for r in all_roles if r['name'] == role['name']), {})
        alias = _get_display_name(role['name'], display_map)
        if alias:
            visibility_scope_for_role = _get_visibility_scope(role['name'], 'role', [], chatroom_config)
            memory_text = _format_role_memory_for_prompt(role_data.get('memory'), global_events, role['name'], date, visibility_scope_for_role, chatroom_config)
            memory_contents.append(f"<{alias.replace(' ', '_')}_Memory>\n{memory_text}\n</{alias.replace(' ', '_')}_Memory>")

    return '\n\n'.join(memory_contents) or '[无激活角色记忆]'

def _get_non_silent_roles_detailed_states(non_silent_roles, role_states, display_map):
    def filter_invisible(text):
        if not text: return ''
        lines = text.split('\n')
        header = lines.pop(0) + '\n'
        body_parts = []
        for line in lines:
            parts = line.split(':', 1)
            if len(parts) == 2:
                key, values_str = parts
                visible_values = [v.strip() for v in values_str.split(',') if '不可见' not in v and v.strip() and v.strip() != '无']
                body_parts.append(f"{key}: {', '.join(visible_values) if visible_values else ''}")
        return header + '\n'.join(body_parts)

    content = [f"<{alias.replace(' ', '_')}_State>\n{filter_invisible(role_states.get(role['name'], f'[{role["name"]}] 无详细状态'))}\n</{alias.replace(' ', '_')}_State>" for role in non_silent_roles if (alias := _get_display_name(role['name'], display_map))]
    return '\n\n'.join(content) or '[无激活角色详细状态]'

def _get_public_infos_collection(all_roles, partition, role_states, caller_name, caller_type, display_map, world_info, chatroom_config, triggering_character_name=None):
    infos = []
    
    is_sps_call = (caller_type == 'tool' and caller_name == 'statusProcessingSystem')
    sps_target_role_name = triggering_character_name if is_sps_call else None

    active_roles_in_partition = [alias for alias in partition.get("roleAliases", []) if alias.get('state') in ['活', '用']]
    
    effective_caller_name = sps_target_role_name if is_sps_call and sps_target_role_name else caller_name
    
    visibility_scope = _get_visibility_scope(effective_caller_name, caller_type, active_roles_in_partition, chatroom_config)

    for role in all_roles:
        if role_states.get(role['name'], '默') == '默': continue
        
        for pi in role.get("publicInfo", []):
            keyword_str = pi.get("keyword", "").strip()
            keywords = {k.strip() for k in re.split(r'[,\uff0c]', keyword_str) if k.strip()}
            
            is_visible = False
            if not keywords:
                is_visible = True
            elif not keywords.isdisjoint(visibility_scope):
                is_visible = True

            if is_visible:
                original_name = role['name']
                tag = f"{original_name.replace(' ', '_')}_PublicInfo_{keyword_str or 'Universal'}"
                infos.append(f"<{tag}>\n关键词: {keyword_str or ''}\n内容: {pi.get('content')}\n</{tag}>")

    age_infos = []
    for role in all_roles:
        if role_states.get(role['name'], '默') == '默': continue
        age_info = _calculate_age_and_memory_gap(role.get('memory'), world_info, events_array=[])
        if age_info['age'] != '[无法计算]':
            alias_for_age = _get_display_name(role['name'], display_map)
            age_infos.append(f"{alias_for_age}今年{age_info['age']}")

    combined_infos = '\n\n'.join(infos)
    if age_infos:
        age_text = '\n'.join(age_infos)
        if combined_infos:
            combined_infos += f"\n\n{age_text}"
        else:
            combined_infos = age_text

    return combined_infos or '[无符合条件的公开信息]'