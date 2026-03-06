import base64
from .base_adapter import BaseAdapter

class OpenAIAdapter(BaseAdapter):
    def convert_payload(self, p):
        msgs = []
        system_role = "developer" if p.get("model", "").startswith(("o1", "o3")) else "system"
        if p.get("system_prompt"):
            msgs.append({"role": system_role, "content": p["system_prompt"]})
        for m in p.get("messages", []):
            role = "assistant" if m["role"] == "model" else m["role"]
            content_list = m["content"]
            if isinstance(content_list, str):
                msgs.append({"role": role, "content": content_list})
                continue
            openai_content = []
            for item in content_list:
                if item["type"] == "text":
                    openai_content.append({"type": "text", "text": item["text"]})
                elif item["type"] == "file":
                    if item["mime_type"].startswith("image/"):
                        openai_content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{item['mime_type']};base64,{item['data']}"
                            }
                        })
                    else:
                        decoded = base64.b64decode(item["data"]).decode('utf-8')
                        openai_content.append({
                            "type": "text", 
                            "text": f"\n[File Content: {item.get('mime_type', 'text')}]\n{decoded}\n"
                        })
            msgs.append({"role": role, "content": openai_content})
        res = {
            "model": p.get("model"),
            "messages": msgs,
            "max_tokens": p.get("max_tokens", 2048)
        }
        if not p.get("model", "").startswith(("o1", "o3")):
            res["temperature"] = p.get("temperature", 1.0)
            res["top_p"] = p.get("top_p", 0.9)
        else:
            res["reasoning_effort"] = "low"
        if p.get("response_schema"):
            res["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_output",
                    "strict": True,
                    "schema": p["response_schema"]
                }
            }
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
            return "https://api.openai.com/v1/chat/completions"
        base = base_address.rstrip('/')
        if not base.endswith('/v1/chat/completions'):
             base += '/v1/chat/completions'
        return base