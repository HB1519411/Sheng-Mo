import sys
import os
import logging
import traceback
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, Response, render_template
from flask_cors import CORS
from werkzeug.exceptions import NotFound
from pydantic import ValidationError
from editor_backend.routes.file_system import file_system_bp
from editor_backend.routes.file_content import file_content_bp
from editor_backend.routes.project_utils import project_utils_bp
from editor_backend.routes.editor_ai import editor_ai_bp
from editor_backend.utils import is_safe_path_editor, PROJECT_ROOT
from backend.services.config_io import write_to_debug_log

template_dir = str(PROJECT_ROOT / 'templates')
os.makedirs(template_dir, exist_ok=True)

app = Flask(__name__, template_folder=template_dir)
CORS(app)

werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger(__name__)

def create_editor_error_response(code, message, status_code):
    return jsonify({"success": False, "error": {"code": code, "message": message}}), status_code

@app.route('/favicon.ico')
def favicon():
    return Response(status=204)

@app.route('/')
def serve_editor_html():
    return render_template('editor.html')

@app.route('/<path:filename>')
def serve_static_files(filename):
    if filename.endswith('.map') or filename.startswith('.well-known'):
        return create_editor_error_response("NOT_FOUND", "Not found.", 404)

    if not is_safe_path_editor(filename):
        return create_editor_error_response("ACCESS_DENIED", "Access to this path is denied.", 403)

    allowed_static_dirs = ['vendor', 'js', 'css']
    normalized_filename = filename.replace('\\', '/')
    
    if any(normalized_filename.startswith(d + '/') for d in allowed_static_dirs):
        return send_from_directory(PROJECT_ROOT, filename)
        
    return create_editor_error_response("NOT_FOUND", "File not found.", 404)


@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, NotFound):
        if not request.path.endswith('.map') and not request.path.startswith('/.well-known'):
            logger.warning(f"404 Not Found - URL requested: {request.url}")
        return jsonify({"success": False, "error": {"code": "NOT_FOUND", "message": "Not Found"}}), 404
        
    if isinstance(e, ValidationError):
        return jsonify({'success': False, 'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid request payload', 'details': e.errors()}}), 400

    exc_type, exc_value, exc_traceback = sys.exc_info()
    tb_str = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    
    print("\033[91m[错误(详见debug)]\033[0m", file=sys.stderr)
    
    timestamp = datetime.now().isoformat()
    log_content = (
        f"!!! UNHANDLED EDITOR BACKEND EXCEPTION at {timestamp} !!!\n"
        f"Error: {str(e)}\n"
        f"Traceback:\n{tb_str}\n"
        f"--------------------------------------------------\n\n"
    )
    write_to_debug_log(log_content)

    status_code = getattr(e, 'code', 500) if isinstance(getattr(e, 'code', 500), int) else 500
    return jsonify({
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR", 
            "message": "Internal Server Error (Editor Backend)", 
            "details": str(e)
        }
    }), status_code


app.register_blueprint(file_system_bp)
app.register_blueprint(file_content_bp)
app.register_blueprint(project_utils_bp)
app.register_blueprint(editor_ai_bp)

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=9999)