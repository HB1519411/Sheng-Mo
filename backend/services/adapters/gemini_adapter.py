from .base_adapter import BaseAdapter

class GeminiAdapter(BaseAdapter):
    def convert_payload(self, p):
        gemini_messages = []
        system_instruction = None
        if p.get("system_prompt"):
            system_instruction = {"parts": [{"text": p["system_prompt"]}]}
        for m in p.get("messages", []):
            role = "model" if m["role"] == "assistant" else "user"
            parts = []
            content_list = m["content"]
            if isinstance(content_list, str):
                parts.append({"text": content_list})
            elif isinstance(content_list, list):
                for item in content_list:
                    if item["type"] == "text":
                        parts.append({"text": item["text"]})
                    elif item["type"] == "file":
                        parts.append({
                            "inline_data": {
                                "mime_type": item["mime_type"],
                                "data": item["data"]
                            }
                        })
            if parts:
                gemini_messages.append({"role": role, "parts": parts})
        res = {
            "contents": gemini_messages,
            "generationConfig": {
                "temperature": p.get("temperature", 1.0),
                "topP": p.get("top_p", 0.9),
                "maxOutputTokens": p.get("max_tokens", 2048)
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"}
            ]
        }
        if system_instruction:
            res["systemInstruction"] = system_instruction
        if p.get("response_schema"):
            res["generationConfig"]["responseMimeType"] = "application/json"
            res["generationConfig"]["responseSchema"] = p["response_schema"]
        if "gemini-2." in p.get("model", ""):
            res["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 128}
        else:
            res["generationConfig"]["thinkingConfig"] = {"includeThoughts": False, "thinkingLevel": "LOW"}
        return res

    def parse_response(self, resp):
        if not resp.get('candidates'): return None
        parts = resp['candidates'][0].get('content', {}).get('parts', [])
        if len(parts) > 1 and parts[0].get('thought'):
            return parts[1].get('text')
        elif parts:
            return parts[0].get('text')
        return None

    def get_headers(self, api_key):
        return {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

    def get_api_url(self, base_address, model, api_key):
        if base_address == "官方":
            return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        base = base_address.rstrip('/')
        return f"{base}/v1beta/models/{model}:generateContent"