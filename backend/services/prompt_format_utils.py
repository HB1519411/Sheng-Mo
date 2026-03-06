import re
from datetime import datetime
from collections import defaultdict

def _get_role_name_maps(partitions_data, partition_id):
    role_map = {'用户': '用户'}
    reverse_map = {'用户': '用户'}
    partition = (partitions_data or {}).get(partition_id, {})
    for entry in partition.get("roleAliases", []):
        name = entry.get("name")
        alias = entry.get("alias", "").strip() or name
        if name:
            role_map[name] = alias
            reverse_map[alias] = name
    return role_map, reverse_map

def _calculate_last_actor(history_array):
    for msg in reversed(history_array or []):
        if msg.get("status") != 'pending' and msg.get("roleName"):
            return msg.get("roleName")
    return None

def _format_partition_history(history_array, display_name_map, include_date_time=True, include_location=True):
    blocks, prev_loc = [], None
    for i, msg in enumerate(history_array or []):
        if msg.get("status") == 'pending': continue
        time, loc = "", None
        ctx = (msg.get("statusProcessingSystemResult") or {}).get("processedSceneContext", {})
        for item in (ctx.get("timeItems") or []):
            if re.match(r'^\d{2}:\d{2}$', str(item).strip()): time = item.strip()
        loc_items = [str(s).strip() for s in (ctx.get("locationItems") or []) if s]
        if loc_items: loc = ', '.join(loc_items)
        
        if include_location and loc and loc != prev_loc:
            blocks.append(f"Location: {loc}")
            prev_loc = loc
            
        content = msg.get("speechActionText", "")
        parsed = msg.get("parsedResult", {})
        if msg.get("roleType") in ['role', 'temporary_role'] and parsed and parsed.get("processedTurnActions"):
            content = '\n'.join([a["content"].strip() for a in parsed["processedTurnActions"] if a.get("isIncluded") and a.get("content")])
            
        if i == 0 and msg.get('sourceType') == 'user' and msg.get('roleName') == '用户':
            content = re.sub(r'“(-?\d+)”', '', content).strip()
            
        if content:
            d_name = display_name_map.get(msg.get("roleName"), msg.get("roleName"))
            prefix = f"{time} " if include_date_time and time else ""
            sep = '\n' if '\n' in content else ''
            blocks.append(f"{prefix}{d_name}：{sep}{content}")
            
    return '\n\n'.join(blocks)

def _is_standard_time_format(time_string):
    return bool(time_string and re.match(r'^-?\d{4}-\d{2}-\d{2}$', str(time_string)))

def _calculate_age_and_memory_gap(memory_array, world_info, events_array=None):
    match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info or '')
    if not match: return {'age': '[无法计算]', 'memory_gap_days': None}
    
    def parse(d):
        p = d.split('-')
        return {'y': -int(p[1]) if d.startswith('-') else int(p[0]), 'm': int(p[1]) if not d.startswith('-') else int(p[2]), 'd': int(p[2]) if not d.startswith('-') else int(p[3])}

    curr = parse(match.group(1))
    dates = sorted([m['time'] for m in (memory_array or []) if _is_standard_time_format(m.get('time'))])
    if not dates: return {'age': '[无法计算]', 'memory_gap_days': None}

    birth = parse(dates[0])
    age = curr['y'] - birth['y'] - (1 if (curr['m'], curr['d']) < (birth['m'], birth['d']) else 0)
    
    all_dates = set(dates)
    if events_array:
        all_dates.update([e['time'] for e in events_array if _is_standard_time_format(e.get('time'))])
    
    valid = sorted(list(all_dates))
    if not valid: return {'age': f'{age}岁', 'memory_gap_days': None}
    
    last = parse(valid[-1])
    to_days = lambda d: d['y'] * 365.25 + d['m'] * 30.44 + d['d']
    gap = int(to_days(curr) - to_days(last))
    
    return {'age': f'{age}岁', 'memory_gap_days': gap if gap >= 0 else None}

def _get_role_effective_identities(role_name, chatroom_config):
    ids = {role_name} if role_name else set()
    for g in (chatroom_config or {}).get('identityGroups', []):
        if role_name in g.get('members', []) and g.get('name'):
            ids.add(g['name'])
    return ids

def _get_visibility_scope(caller_name, caller_type, active_roles_list, chatroom_config):
    if caller_type in ['role', 'temporary_role']:
        return _get_role_effective_identities(caller_name, chatroom_config)
    elif caller_type == 'tool':
        scope = set()
        for r in active_roles_list:
            if r.get('name'): scope.update(_get_role_effective_identities(r['name'], chatroom_config))
        return scope
    return set()

def _format_role_setting_for_prompt(role_data, world_info):
    if not role_data: return ''
    d = role_data
    parts = []
    if d.get('mbti'): parts.append(f"MBTI: {d['mbti']}")
    bf = ', '.join([f"{k}-{d.get(v)}" for k, v in [('O','bigFiveOpenness'),('C','bigFiveConscientiousness'),('E','bigFiveExtraversion'),('A','bigFiveAgreeableness'),('N','bigFiveNeuroticism')] if d.get(v)])
    if bf: parts.append(f"BigFive: {bf}")
    if d.get('archetypes'): parts.append(f"Archetypes: {', '.join(d['archetypes'])}")
    if d.get('keywords'): parts.append(f"Keywords: {', '.join(d['keywords'])}")
    if d.get('otherInfo'): parts.append(f"OtherInfo:\n{d['otherInfo']}")
    return '\n'.join(parts).strip()

def _format_role_memory_for_prompt(personal_memory_array, global_events, role_name, world_info_date, visibility_scope, chatroom_config=None):
    if not personal_memory_array and not global_events: return ''
    data = defaultdict(lambda: {"events": [], "personal": [], "isPinned": False})

    for item in (personal_memory_array or []):
        if item.get('time'):
            data[item['time']]["personal"].append({"content": item.get('content', ''), "details": item.get('details', '')})
            if item.get('isPinned'): data[item['time']]["isPinned"] = True

    events_for_gap = []
    for evt in (global_events or []):
        involved = set(evt.get('involvedCharacters', []))
        if not involved or not involved.isdisjoint(visibility_scope):
            events_for_gap.append(evt)
            if evt.get('time'):
                c, d = evt.get('content', ''), evt.get('details', '')
                if role_name: c, d = c.replace(role_name, '我'), d.replace(role_name, '我')
                data[evt['time']]["events"].append({"content": c, "details": d})
                if evt.get('isPinned'): data[evt['time']]["isPinned"] = True

    dates = sorted([d for d in data if not (world_info_date and _is_standard_time_format(d) and d > world_info_date)], key=lambda x: (0, int(x.replace('-','')) * (-1 if x.startswith('-') else 1)) if _is_standard_time_format(x) else (1, x))
    if not dates: return ''

    entries = []
    for i, date in enumerate(dates):
        day_data = data[date]
        show_details = (i >= len(dates) - 10) or day_data["isPinned"]
        sums = [x["content"] for x in day_data["events"] + day_data["personal"] if x["content"]]
        dets = [x["details"] for x in day_data["events"] + day_data["personal"] if show_details and x["details"]]
        
        if sums or dets:
            txt = f"日期：{date}"
            if sums: txt += "\n记忆(概要)：\n" + '\n'.join(sums)
            if dets: txt += "\n记忆(详情)：\n" + '\n\n'.join(dets)
            entries.append(txt)

    gap_info = _calculate_age_and_memory_gap(personal_memory_array, f"Date: {world_info_date}" if world_info_date else "", events_for_gap)
    gap = gap_info.get('memory_gap_days')
    gap_txt = ""
    if gap and gap > 0:
        y, m, d = gap // 365, (gap % 365) // 30, (gap % 365) % 30
        gap_txt = f"(距离你最新的记忆，已过去{f'{y}年' if y else ''}{f'{m}月' if m else ''}{d}天)\n"

    return gap_txt + '\n\n'.join(entries)

def _get_non_silent_roles_settings(non_silent_roles, all_roles, world_info, display_map):
    res = []
    for r in non_silent_roles:
        alias = display_map.get(r['name'], r['name'])
        data = next((x for x in all_roles if x['name'] == r['name']), None)
        if alias: 
            content = _format_role_setting_for_prompt(data, world_info)
            if content:
                res.append(f"<{alias.replace(' ', '_')}_Setting>\n{content}\n</{alias.replace(' ', '_')}_Setting>")
    return '\n\n'.join(res)

def _get_non_silent_roles_memories(non_silent_roles, all_roles, global_events, world_info, display_map, is_tool=False, chatroom_config=None):
    match = re.search(r'(-?\d{4}-\d{2}-\d{2})', world_info or '')
    date = match.group(1) if match else None
    res = []
    for r in non_silent_roles:
        alias = display_map.get(r['name'], r['name'])
        data = next((x for x in all_roles if x['name'] == r['name']), {})
        if alias:
            scope = _get_visibility_scope(r['name'], 'role', [], chatroom_config)
            mem = _format_role_memory_for_prompt(data.get('memory'), global_events, r['name'], date, scope, chatroom_config)
            if mem:
                res.append(f"<{alias.replace(' ', '_')}_Memory>\n{mem}\n</{alias.replace(' ', '_')}_Memory>")
    return '\n\n'.join(res)

def _get_non_silent_roles_detailed_states(non_silent_roles, role_states, display_map):
    res = []
    for r in non_silent_roles:
        alias = display_map.get(r['name'], r['name'])
        raw = role_states.get(r['name'], f"[{r['name']}] 无详细状态")
        lines = raw.split('\n')
        body = [lines[0]] + [l for l in lines[1:] if '不可见' not in l and l.split(':', 1)[-1].strip() not in ['', '无']]
        if alias: res.append(f"<{alias.replace(' ', '_')}_State>\n{'\n'.join(body)}\n</{alias.replace(' ', '_')}_State>")
    return '\n\n'.join(res)

def _get_public_infos_collection(all_roles, partition, role_states, caller_name, caller_type, display_map, world_info, chatroom_config, triggering_character_name=None):
    infos, ages = [], []
    eff_caller = triggering_character_name if caller_type == 'tool' and caller_name == 'statusProcessingSystem' else caller_name
    active = [a for a in partition.get("roleAliases", []) if a.get('state') in ['活', '用']]
    scope = _get_visibility_scope(eff_caller, caller_type, active, chatroom_config)

    for r in all_roles:
        if role_states.get(r['name']) == '默': continue
        for pi in r.get("publicInfo", []):
            keys = {k.strip() for k in re.split(r'[,\uff0c]', pi.get("keyword", "")) if k.strip()}
            if not keys or not keys.isdisjoint(scope):
                tag = f"{r['name'].replace(' ', '_')}_PublicInfo_{pi.get('keyword', 'Universal')}"
                infos.append(f"<{tag}>\n关键词: {pi.get('keyword', '')}\n内容: {pi.get('content')}\n</{tag}>")
        
        age = _calculate_age_and_memory_gap(r.get('memory'), world_info)['age']
        if age != '[无法计算]':
            ages.append(f"{display_map.get(r['name'], r['name'])}今年{age}")

    return ('\n\n'.join(infos) + ('\n\n' + '\n'.join(ages) if ages else '')).strip()