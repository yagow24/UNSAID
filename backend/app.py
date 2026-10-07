"""
UNSAID Flask Application Entry Point
Integrates Gemini AI service, Firebase token verification, and CORS configuration.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path for robust cross-directory execution
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import time
import logging
from collections import defaultdict
from flask import Flask, jsonify, request
from flask_cors import CORS
from backend.config import PORT, HOST, is_gemini_configured, get_gemini_model
from backend.routes.ai_routes import ai_bp

# Configure safe logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("unsaid.app")

app = Flask(__name__)

# Request limits
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # 2MB max payload

# CORS setup
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Basic In-Memory Rate Limiting (Abuse protection per IP/Client)
# Allows max 30 requests per minute per IP
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30     # requests
_ip_request_history = defaultdict(list)

@app.before_request
def check_rate_limit():
    # Only rate limit AI routes
    if not request.path.startswith("/api/ai"):
        return None

    client_ip = request.remote_addr or "127.0.0.1"
    now = time.time()
    history = _ip_request_history[client_ip]

    # Remove timestamps older than window
    _ip_request_history[client_ip] = [t for t in history if now - t < RATE_LIMIT_WINDOW]

    if len(_ip_request_history[client_ip]) >= RATE_LIMIT_MAX:
        logger.warning("Rate limit exceeded for IP: %s", client_ip)
        return (
            jsonify({
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please wait a moment before trying again.",
                },
            }),
            429,
        )

    _ip_request_history[client_ip].append(now)
    return None

# Register blueprints
app.register_blueprint(ai_bp)

class PrefixMiddleware:
    """WSGI middleware ensuring /api prefix routes match whether Vercel strips or preserves the prefix."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path.startswith("/ai/") or path == "/ai":
            environ["PATH_INFO"] = "/api" + path
        elif path == "/health":
            environ["PATH_INFO"] = "/api/health"
        return self.wsgi_app(environ, start_response)

app.wsgi_app = PrefixMiddleware(app.wsgi_app)

@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "unsaid-backend",
        "aiConfigured": is_gemini_configured(),
        "model": get_gemini_model(),
        "vercelProject": os.environ.get("VERCEL_PROJECT_NAME", ""),
        "vercelEnv": os.environ.get("VERCEL_ENV", ""),
        "vercelCommit": (os.environ.get("VERCEL_GIT_COMMIT_SHA") or "")[:7],
    })

# Global error handlers
@app.errorhandler(413)
def request_entity_too_large(error):
    return (
        jsonify({
            "success": False,
            "error": {
                "code": "PAYLOAD_TOO_LARGE",
                "message": "Request payload exceeds maximum allowed size (2MB).",
            },
        }),
        413,
    )

@app.errorhandler(404)
def not_found(error):
    return (
        jsonify({
            "success": False,
            "error": {
                "code": "NOT_FOUND",
                "message": "The requested API endpoint does not exist.",
            },
        }),
        404,
    )

@app.errorhandler(500)
def internal_server_error(error):
    return (
        jsonify({
            "success": False,
            "error": {
                "code": "SERVER_ERROR",
                "message": "An internal server error occurred.",
            },
        }),
        500,
    )

if __name__ == "__main__":
    logger.info("Starting UNSAID Backend on %s:%d (Gemini configured: %s)", HOST, PORT, is_gemini_configured())
    app.run(host=HOST, port=PORT, debug=False)
