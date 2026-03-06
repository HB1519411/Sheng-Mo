from flask import Blueprint, request, jsonify
import requests
from backend.utils.path_utils import create_error_response

ai_proxy_gemini_bp = Blueprint('ai_proxy_gemini_bp', __name__)

@ai_proxy_gemini_bp.route('/models', methods=['GET'])
def list_models():
    api_key = request.args.get('key')
    api_type = request.args.get('type', 'gemini').lower()
    address = request.args.get('address', '官方')

    if not api_key:
        return create_error_response("MISSING_API_KEY", "API key is missing", 400)

    models_list = []

    if api_type == 'gemini':
        base_url = "https://generativelanguage.googleapis.com" if address == '官方' else address.rstrip('/')
        url = f"{base_url}/v1beta/models?key={api_key}"
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        for m in data["models"]:
            if "generateContent" in m["supportedGenerationMethods"]:
                m_id = m["name"].replace("models/", "")
                models_list.append({"id": m_id, "name": m.get("displayName", m_id)})

    elif api_type == 'openai':
        base_url = "https://api.openai.com/v1" if address == '官方' else f"{address.rstrip('/')}/v1"
        resp = requests.get(f"{base_url}/models", headers={"Authorization": f"Bearer {api_key}"}, timeout=15)
        resp.raise_for_status()
        for m in resp.json()["data"]:
            models_list.append({"id": m["id"], "name": m["id"]})
            
    else:
        raise NotImplementedError(f"Fetching models for api_type '{api_type}' is not supported or implemented.")

    return jsonify({"success": True, "data": {"models": models_list}})