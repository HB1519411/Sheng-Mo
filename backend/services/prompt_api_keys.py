import hashlib
import json
import math
import random
import time
from backend.services.config_io import API_KEY_STATE_CACHE

def _initialize_api_key_pools(global_config):
    groups_text = global_config.get("apiKeyGroupsText", [])
    config_hash = hashlib.md5(json.dumps(groups_text, sort_keys=True).encode('utf-8')).hexdigest()
    
    if API_KEY_STATE_CACHE.get("last_sync_hash") == config_hash:
        return

    all_keys_info = []
    for group_text in groups_text:
        lines = [line.strip() for line in group_text.strip().split('\n') if line.strip()]
        if len(lines) < 2: continue
        group_id, keys = lines[0], lines[1:]
        all_keys_info.extend([{"key": key, "groupId": group_id} for key in keys])
    
    random.shuffle(all_keys_info)
    mid_point = math.ceil(len(all_keys_info) / 2)
    API_KEY_STATE_CACHE["active_pool"] = all_keys_info[:mid_point]
    API_KEY_STATE_CACHE["cooldown_pool"] = all_keys_info[mid_point:]
    
    current_failures = API_KEY_STATE_CACHE.get("failures", {})
    new_failures = {info['key']: current_failures.get(info['key'], 0) for info in all_keys_info}
    API_KEY_STATE_CACHE["failures"] = new_failures
    API_KEY_STATE_CACHE["cooldown_until"] = API_KEY_STATE_CACHE.get("cooldown_until", {})
    API_KEY_STATE_CACHE["last_sync_hash"] = config_hash

def select_api_key(global_config, exclude_keys=None):
    if exclude_keys is None:
        exclude_keys = set()
    
    _initialize_api_key_pools(global_config)
    
    failures = API_KEY_STATE_CACHE["failures"]
    cooldown_until = API_KEY_STATE_CACHE.get("cooldown_until", {})
    current_time = time.time()
    
    all_available_keys = [
        info for info in (API_KEY_STATE_CACHE["active_pool"] + API_KEY_STATE_CACHE["cooldown_pool"])
        if info['key'] not in exclude_keys and current_time >= cooldown_until.get(info['key'], 0)
    ]

    if not all_available_keys:
        raise ValueError("No available API keys to select from (all keys are on cooldown or excluded).")

    min_fails = min((failures.get(info['key'], 0) for info in all_available_keys), default=0)
    candidates = [info for info in all_available_keys if failures.get(info['key'], 0) == min_fails]
    
    selected_key_info = random.choice(candidates)
    
    return selected_key_info['key']

def record_api_key_failure(api_key):
    if api_key in API_KEY_STATE_CACHE["failures"]:
        API_KEY_STATE_CACHE["failures"][api_key] += 1

def start_api_key_cooldown(api_key, duration_seconds=180):
    if "cooldown_until" not in API_KEY_STATE_CACHE:
        API_KEY_STATE_CACHE["cooldown_until"] = {}
    API_KEY_STATE_CACHE["cooldown_until"][api_key] = time.time() + duration_seconds