from flask import Blueprint, request, jsonify
import requests
import base64
import io
import zipfile
import os
from backend.utils.path_utils import create_error_response

ai_proxy_novelai_bp = Blueprint('ai_proxy_novelai_bp', __name__)

@ai_proxy_novelai_bp.route('/novelai-proxy', methods=['POST'])
def novelai_proxy():
    data = request.json
    parameters = data['parameters']
    nai_api_key = data['nai_api_key']

    url = "https://image.novelai.net/ai/generate-image"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {nai_api_key}"}
    
    resp = requests.post(url, headers=headers, json=parameters, timeout=300)
    resp.raise_for_status()
    
    with zipfile.ZipFile(io.BytesIO(resp.content), 'r') as zf:
        for name in zf.namelist():
            if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                img_bytes = zf.read(name)
                b64_img = base64.b64encode(img_bytes).decode('utf-8')
                ext = os.path.splitext(name)[1][1:].lower()
                mime = f"image/{'jpeg' if ext == 'jpg' else ext}"
                return jsonify({"success": True, "data": {"imageDataUrl": f"data:{mime};base64,{b64_img}"}})
                
    raise ValueError("No image found in ZIP")