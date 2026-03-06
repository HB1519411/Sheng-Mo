import hashlib
import json
import random
import time

GROUP_STATE_CACHE = {
    "groups": [],
    "history": {},
    "failures": {},
    "last_sync_hash": None
}

def _parse_api_key_groups(global_config):
    groups_text = global_config.get("apiKeyGroupsText", [])
    config_hash = hashlib.md5(json.dumps(groups_text, sort_keys=True).encode('utf-8')).hexdigest()
    
    if GROUP_STATE_CACHE["last_sync_hash"] == config_hash:
        return GROUP_STATE_CACHE["groups"]

    parsed = []
    for txt in groups_text:
        lines = [l.strip() for l in txt.strip().split('\n') if l.strip()]
        if len(lines) >= 4:
            parsed.append({
                "group_id": lines[0],
                "api_type": lines[1].lower(),
                "address": lines[2],
                "keys": lines[3:]
            })
    
    GROUP_STATE_CACHE["groups"] = parsed
    GROUP_STATE_CACHE["last_sync_hash"] = config_hash
    return parsed

def get_available_channels(global_config, rate_limit, is_backup_fallback=False):
    groups = _parse_api_key_groups(global_config)
    now = time.time()
    
    for gid in GROUP_STATE_CACHE["history"]:
        GROUP_STATE_CACHE["history"][gid] = [t for t in GROUP_STATE_CACHE["history"][gid] if now - t < 60]

    backup_channel = None
    if global_config.get('backup_proxy_url'):
        backup_channel = {
            "group_id": "备用",
            "api_type": "gemini",
            "address": global_config['backup_proxy_url'],
            "api_key": global_config.get('backup_proxy_api_key', ''),
            "is_backup": True
        }

    if is_backup_fallback or global_config.get('useBackupProxyOnly', False):
        return [backup_channel] if backup_channel else []

    if not groups:
        return [backup_channel] if backup_channel else []

    scored = []
    for g in groups:
        gid = g["group_id"]
        rpm = len(GROUP_STATE_CACHE["history"].get(gid, []))
        scored.append((rpm, g))
    
    scored.sort(key=lambda x: x[0])
    
    channels = []
    
    for rpm, g in scored:
        if rpm < rate_limit:
            channels.append({
                "group_id": g["group_id"],
                "api_type": g["api_type"],
                "address": g["address"],
                "api_key": random.choice(g["keys"]),
                "is_backup": False
            })
    
    if backup_channel:
        channels.append(backup_channel)

    return channels

def record_channel_usage(group_id):
    if group_id != "备用":
        GROUP_STATE_CACHE["history"].setdefault(group_id, []).append(time.time())

def record_channel_success(group_id):
    if group_id != "备用":
        GROUP_STATE_CACHE["failures"][group_id] = 0

def record_channel_failure(group_id):
    if group_id != "备用":
        count = GROUP_STATE_CACHE["failures"].get(group_id, 0) + 1
        GROUP_STATE_CACHE["failures"][group_id] = count
        return count
    return 0

def get_group_fail_stats():
    return GROUP_STATE_CACHE["failures"].copy()