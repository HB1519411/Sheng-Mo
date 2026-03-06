import base64
from .base_adapter import BaseAdapter

class ClaudeAdapter(BaseAdapter):
    def convert_payload(self, p):
        msgs = []
        for m in p.get("messages", []):
            role = "assistant" if m["role"] == "model" else m["role"]
            content_list = m["content"]
            if isinstance(content_list, str):
                msgs.append({"role": role, "content": content_list})
                continue
            claude_content = []
            for item in content_list:
                if item["type"] == "text":
                    claude_content.append({"type": "text", "text": item["text"]})
                elif item["type"] == "file":
                    if item["mime_type"].startswith("image/"):
                        claude_content.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": item["mime_type"],
                                "data": item["data"]
                            }
                        })
                    else:
                        decoded = base64.b64decode(item["data"]).decode('utf-8')
                        claude_content.append({
                            "type": "text",
                            "text": f"\n[File Content]\n{decoded}\n"
                        })
            msgs.append({"role": role, "content": claude_content})
        res = {
            "model": p.get("model"),
            "messages": msgs,
            "temperature": p.get("temperature", 1.0),
            "max_tokens": p.get("max_tokens", 2048)
        }
        if p.get("system_prompt"):
            res["system"] = p.get("system_prompt")
        if p.get("response_schema"):
            res["output_config"] = {
                "format": {
                    "type": "json_schema",
                    "schema": p["response_schema"]
                }
            }
        return res

    def parse_response(self, resp):
        content = resp.get('content', [])
        if content and content[0].get('text'):
            return content[0]['text']
        return None

    def get_headers(self, api_key):
        return {
            "Content-Type": "application/json", 
            "x-api-key": api_key, 
            "anthropic-version": "2023-06-01"
        }

    def get_api_url(self, base_address, model, api_key):
        if base_address == "官方":
            return "https://api.anthropic.com/v1/messages"
        base = base_address.rstrip('/')
        if not base.endswith('/v1/messages'):
             base += '/v1/messages'
        return base