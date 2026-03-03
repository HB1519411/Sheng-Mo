from backend.routes.ai_proxy_gemini import ai_proxy_gemini_bp
from backend.routes.ai_proxy_novelai import ai_proxy_novelai_bp
from backend.routes.role_management import role_management_bp
from backend.routes.partition_management import partition_management_bp
from backend.routes.novel_management import novel_management_bp
from backend.routes.file_serving import file_serving_bp
from backend.routes.config_management import config_management_bp
from backend.routes.chatroom_crud import chatroom_crud_bp
from backend.routes.chatroom_features import chatroom_features_bp
from backend.routes.ai_interaction import ai_interaction_bp
from backend.routes.event_management import event_management_bp
from backend.routes.knowledge_base import knowledge_base_bp
from flask import Flask, jsonify
from flask_cors import CORS
import logging
import sys
import traceback
from backend.services.config_io import CHATROOMS_DIR, IMAGES_DIR, GENERATED_SUBDIR, CONFIG_DIR, TOOLS_DIR
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
    print(f"Unhandled Exception: {e}", file=sys.stderr)
    traceback.print_tb(exc_traceback, limit=5, file=sys.stderr)
    response = jsonify({"error": "Internal Server Error", "details": str(e)})
    response.status_code = 500
    return response


app.register_blueprint(ai_proxy_gemini_bp)
app.register_blueprint(ai_proxy_novelai_bp)
app.register_blueprint(chatroom_crud_bp)
app.register_blueprint(chatroom_features_bp)
app.register_blueprint(config_management_bp)
app.register_blueprint(file_serving_bp)
app.register_blueprint(novel_management_bp)
app.register_blueprint(partition_management_bp)
app.register_blueprint(role_management_bp)
app.register_blueprint(ai_interaction_bp)
app.register_blueprint(event_management_bp)
app.register_blueprint(knowledge_base_bp)