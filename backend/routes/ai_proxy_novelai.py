from flask import Blueprint, request, jsonify
import requests
import json
import base64
import io
import zipfile
import os
import time
from backend.utils.path_utils import create_error_response

ai_proxy_novelai_bp = Blueprint('ai_proxy_novelai_bp', __name__)

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


@ai_proxy_novelai_bp.route('/novelai-proxy', methods=['POST'])
def novelai_proxy():
    # 纯官方源后端代理逻辑。中转源现在完全由前端处理，不经过此接口。
    parameters = request.json.get('parameters')
    nai_api_key = request.json.get('nai_api_key')

    if not parameters:
        return create_error_response("MISSING_PARAMETERS", "Missing parameters", 400)
    if not nai_api_key:
        return create_error_response("MISSING_API_KEY", "Missing NovelAI API Key", 400)

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            novelai_api_url = "https://image.novelai.net/ai/generate-image"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {nai_api_key}"
            }
            response = requests.post(novelai_api_url, headers=headers, json=parameters, timeout=300)

            if response.ok:
                if response.status_code == 200:
                    zip_buffer = io.BytesIO(response.content)
                    try:
                        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
                            image_filename = None
                            for name in zip_ref.namelist():
                                if not zip_ref.getinfo(name).is_dir() and name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                                    image_filename = name
                                    break
                            if not image_filename:
                                last_error = create_error_response(
                                    "NO_IMAGE_IN_ZIP", "No image file found in the ZIP response", 500)
                                continue

                            image_bytes = zip_ref.read(image_filename)
                            base64_image = base64.b64encode(image_bytes).decode('utf-8')
                            mime_type = f"image/{os.path.splitext(image_filename)[1][1:].lower()}"
                            if mime_type == 'image/jpg':
                                mime_type = 'image/jpeg'
                            image_data_url = f"data:{mime_type};base64,{base64_image}"
                            return jsonify({"success": True, "data": {"imageDataUrl": image_data_url}})
                    except zipfile.BadZipFile:
                        last_error = create_error_response("BAD_ZIP_FILE", "NovelAI returned an invalid ZIP file", 500)
                        continue
                else:
                    last_error = create_error_response(
                        "UNEXPECTED_STATUS", f"API returned unexpected status: {response.status_code}", 500)
                    continue
            else:
                error_msg = f"API request failed with status code: {response.status_code}"
                try:
                    error_detail_json = response.json()
                    error_msg += f"\nError details: {error_detail_json.get('message', response.text)}"
                except json.JSONDecodeError:
                    error_msg += f"\nResponse content: {response.text}"

                error_code = "NOVELAI_API_ERROR"
                if response.status_code == 401:
                    error_code = "NOVELAI_UNAUTHORIZED"
                elif response.status_code == 402:
                    error_code = "NOVELAI_SUBSCRIPTION_REQUIRED"
                elif response.status_code == 400:
                    error_code = "NOVELAI_BAD_REQUEST"
                elif response.status_code == 429:
                    error_code = "NOVELAI_RATE_LIMIT"
                elif response.status_code >= 500:
                    error_code = "NOVELAI_SERVER_ERROR"

                last_error = create_error_response(error_code, error_msg, response.status_code)
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                continue
        except requests.exceptions.RequestException as e:
            last_error = create_error_response("CONNECTION_ERROR", f"Connection error: {e}", 500)
            time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
            continue

    if last_error:
        return last_error

    return create_error_response("MAX_RETRIES_EXCEEDED", f"Request failed after {MAX_RETRIES} attempts.", 500)