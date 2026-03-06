from flask import Flask, jsonify
from flask_cors import CORS
import logging
import sys
import traceback
from datetime import datetime
from backend.services.config_io import (
    CHATROOMS_DIR, IMAGES_DIR, GENERATED_SUBDIR, CONFIG_DIR, TOOLS_DIR,
    write_to_debug_log
)
from backend.services.knowledge_base_io import KNOWLEDGE_BASE_DIR
import os

os.makedirs(CHATROOMS_DIR, exist_ok=True)
os.makedirs(os.path.join(IMAGES_DIR, GENERATED_SUBDIR), exist_ok=True)
os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)
os.makedirs(os.path.join(CONFIG_DIR, TOOLS_DIR), exist_ok=True)

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
template_dir = os.path.join(project_root, 'templates')
os.makedirs(template_dir, exist_ok=True)

app = Flask(__name__, template_folder=template_dir)
CORS(app)

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)


@app.errorhandler(Exception)
def handle_exception(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    
    print("\033[91m[错误(详见debug)]\033[0m", file=sys.stderr)
    
    timestamp = datetime.now().isoformat()
    log_content = (
        f"!!! UNHANDLED BACKEND EXCEPTION at {timestamp} !!!\n"
        f"Error: {str(e)}\n"
        f"Traceback:\n{tb_str}\n"
        f"--------------------------------------------------\n\n"
    )
    write_to_debug_log(log_content)

    response = jsonify({
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Internal Server Error",
            "details": str(e)
        }
    })
    response.status_code = 500
    return response


blueprints_to_register = [
    ('backend.routes.ai_proxy_gemini', 'ai_proxy_gemini_bp'),
    ('backend.routes.ai_proxy_novelai', 'ai_proxy_novelai_bp'),
    ('backend.routes.role_management', 'role_management_bp'),
    ('backend.routes.partition_management', 'partition_management_bp'),
    ('backend.routes.novel_management', 'novel_management_bp'),
    ('backend.routes.file_serving', 'file_serving_bp'),
    ('backend.routes.config_management', 'config_management_bp'),
    ('backend.routes.chatroom_crud', 'chatroom_crud_bp'),
    ('backend.routes.chatroom_features', 'chatroom_features_bp'),
    ('backend.routes.ai_interaction', 'ai_interaction_bp'),
    ('backend.routes.event_management', 'event_management_bp'),
    ('backend.routes.knowledge_base', 'knowledge_base_bp')
]

for module_name, bp_name in blueprints_to_register:
    try:
        module = __import__(module_name, fromlist=[bp_name])
        blueprint = getattr(module, bp_name)
        app.register_blueprint(blueprint)
    except Exception as e:
        print(f"!!! FAILED to register blueprint '{bp_name}' from '{module_name}' !!!", file=sys.stderr)
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        print(f"Error: {e}\n{tb_str}", file=sys.stderr)