import base64
import json
from .base_adapter import BaseAdapter

class DeepSeekAdapter(BaseAdapter):
    def convert_payload(self, p):
        msgs = []
        system_prompt = p.get("system_prompt", "")
        if p.get("response_schema"):
            schema_str = json.dumps(p["response_schema"], ensure_ascii=False)
            system_prompt += f"\n\n请务必输出 JSON 格式，且严格符合以下 Schema:\n{schema_str}"
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        for m in p.get("messages", []):
            role = "assistant" if m["role"] == "model" else m["role"]
            content_list = m["content"]
            if isinstance(content_list, str):
                msgs.append({"role": role, "content": content_list})
                continue
            deepseek_content = ""
            for item in content_list:
                if item["type"] == "text":
                    deepseek_content += item["text"] + "\n"
                elif item["type"] == "file":
                    decoded = base64.b64decode(item["data"]).decode('utf-8')
                    deepseek_content += f"\n[File Content: {item.get('mime_type', 'text')}]\n{decoded}\n"
            msgs.append({"role": role, "content": deepseek_content.strip()})
        res = {
            "model": p.get("model"),
            "messages": msgs,
            "temperature": p.get("temperature", 1.0),
            "top_p": p.get("top_p", 0.9),
            "max_tokens": p.get("max_tokens", 2048)
        }
        if p.get("response_schema"):
            res["response_format"] = {"type": "json_object"}
        return res

    def parse_response(self, resp):
        choices = resp.get('choices', [])
        if choices and choices[0].get('message'):
            return choices[0]['message'].get('content')
        return None

    def get_headers(self, api_key):
        return {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

    def get_api_url(self, base_address, model, api_key):
        if base_address == "官方":
            return "https://api.deepseek.com/v1/chat/completions"
        base = base_address.rstrip('/')
        if not base.endswith('/v1/chat/completions'):
             base += '/v1/chat/completions'
        return base