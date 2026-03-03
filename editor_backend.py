import sys
import os
import logging
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, Response, render_template
from flask_cors import CORS
from werkzeug.exceptions import NotFound
from editor_backend.routes.file_system import file_system_bp
from editor_backend.routes.file_content import file_content_bp
from editor_backend.routes.project_utils import project_utils_bp
from editor_backend.routes.editor_ai import editor_ai_bp
from editor_backend.utils import is_safe_path_editor, PROJECT_ROOT

template_dir = str(PROJECT_ROOT / 'templates')
os.makedirs(template_dir, exist_ok=True)

app = Flask(__name__, template_folder=template_dir)
CORS(app)

werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.WARNING)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)])
logger = logging.getLogger(__name__)


def create_editor_error_response(code, message, status_code):
    response_data = {
        "success": False,
        "error": {
            "code": code,
            "message": message
        }
    }
    return jsonify(response_data), status_code


@app.route('/favicon.ico')
def favicon():
    return Response(status=204)


@app.route('/')
def serve_editor_html():
    return render_template('editor.html')


@app.route('/<path:filename>')
def serve_static_files(filename):
    if filename.endswith('.map'):
        return create_editor_error_response("NOT_FOUND", "Source map not found.", 404)

    if filename.startswith('.well-known'):
        return create_editor_error_response("NOT_FOUND", "Not found.", 404)

    if not is_safe_path_editor(filename):
        return create_editor_error_response("ACCESS_DENIED", "Access to this path is denied.", 403)

    allowed_static_dirs = ['vendor', 'js', 'css']

    try:
        normalized_filename = filename.replace('\\', '/')
        if any(normalized_filename.startswith(d + '/') for d in allowed_static_dirs):
            return send_from_directory(PROJECT_ROOT, filename)
        else:
            first_dir = Path(normalized_filename).parts[0]
            logger.info(
                f"Path's first directory '{first_dir}' is not in allowed list {allowed_static_dirs}. Returning 404.")
            return create_editor_error_response("NOT_FOUND", "File not found.", 404)
    except IndexError:
        logger.warning(f"Could not determine first directory for '{filename}'")
        return create_editor_error_response("NOT_FOUND", "File not found.", 404)


@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, NotFound):
        if not request.path.endswith('.map') and not request.path.startswith('/.well-known'):
            logger.warning(f"404 Not Found - URL requested: {request.url}")
    else:
        logger.exception(f"Unhandled Exception in editor_backend: {e}")

    response = jsonify({'error': 'Internal Server Error (Editor Backend)', 'details': str(e)})
    response.status_code = getattr(e, 'code', 500) if isinstance(getattr(e, 'code', 500), int) else 500
    return response


app.register_blueprint(file_system_bp)
app.register_blueprint(file_content_bp)
app.register_blueprint(project_utils_bp)
app.register_blueprint(editor_ai_bp)

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=9999)