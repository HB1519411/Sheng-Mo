import os
from flask import jsonify


def is_safe_path(path, base_dir=None):
    if base_dir is None:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    else:
        base_dir = os.path.abspath(base_dir)

    try:
        target_path_abs = os.path.abspath(path)
    except Exception:
        return False

    if os.path.commonprefix([target_path_abs, base_dir]) != base_dir:
        return False

    return True


def create_error_response(code, message, status_code, details=None, debug_info=None, alerts=None):
    response_data = {
        "success": False,
        "error": {
            "code": code,
            "message": message
        }
    }
    if details is not None:
        response_data["error"]["details"] = details
    if alerts is not None and isinstance(alerts, list):
        response_data["alerts"] = alerts
    return jsonify(response_data), status_code