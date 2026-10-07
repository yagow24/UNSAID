"""
UNSAID Authentication & Workspace Authorization Middleware
Validates incoming Firebase Bearer tokens and workspace isolation.
"""

from functools import wraps
from flask import request, jsonify, g
from backend.services.firebase_service import verify_token, verify_workspace_access

def require_auth(f):
    """
    Decorator enforcing that requests have a valid Firebase ID token.
    Populates flask.g.user with authenticated user claims.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.strip():
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "AUTH_REQUIRED",
                        "message": "Missing Authorization Bearer token in request headers.",
                    },
                }),
                401,
            )

        try:
            user_data = verify_token(auth_header)
            g.user = user_data
        except ValueError as err:
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "AUTH_INVALID",
                        "message": str(err),
                    },
                }),
                401,
            )
        except Exception as err:
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "AUTH_FAILED",
                        "message": "Token verification failed.",
                    },
                }),
                401,
            )

        return f(*args, **kwargs)

    return decorated_function

def require_workspace(f):
    """
    Decorator enforcing workspace membership or authorization.
    Extracts workspaceId from JSON body or query params.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        workspace_id = None
        if request.is_json:
            body = request.get_json(silent=True) or {}
            workspace_id = body.get("workspaceId")
        if not workspace_id:
            workspace_id = request.args.get("workspaceId")

        if not workspace_id or not str(workspace_id).strip():
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "WORKSPACE_REQUIRED",
                        "message": "A valid workspaceId is required.",
                    },
                }),
                400,
            )

        uid = getattr(g, "user", {}).get("uid")
        if not uid:
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Authenticated user required for workspace operations.",
                    },
                }),
                401,
            )

        is_authorized = verify_workspace_access(uid, str(workspace_id).strip())
        if not is_authorized:
            return (
                jsonify({
                    "success": False,
                    "error": {
                        "code": "WORKSPACE_FORBIDDEN",
                        "message": "Access denied for requested workspace context.",
                    },
                }),
                403,
            )

        g.workspace_id = str(workspace_id).strip()
        return f(*args, **kwargs)

    return decorated_function
