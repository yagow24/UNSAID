"""
UNSAID AI REST Routes
Handles authenticated, workspace-isolated requests to Gemini AI.
"""

import logging
from flask import Blueprint, request, jsonify, g
from backend.config import GEMINI_MODEL, is_gemini_configured
from backend.middleware.auth_middleware import require_auth, require_workspace
from backend.services.gemini_service import (
    analyze_problem,
    generate_admin_summary,
    find_similar_issue,
    GeminiNotConfiguredError,
    GeminiAPIError,
)

logger = logging.getLogger("unsaid.routes")
ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

@ai_bp.route("/status", methods=["GET"])
def get_status():
    """Returns AI health and model configuration status."""
    return jsonify({
        "success": True,
        "status": "online",
        "aiConfigured": is_gemini_configured(),
        "model": GEMINI_MODEL,
    })

@ai_bp.route("/analyze-problem", methods=["POST"])
@require_auth
@require_workspace
def handle_analyze_problem():
    """
    POST /api/ai/analyze-problem
    Analyzes a problem draft for immediate resolution suggestions,
    likely causes, priority evaluation, and optional duplicate matches.
    """
    body = request.get_json(silent=True) or {}

    title = str(body.get("title", "")).strip()
    description = str(body.get("description", "")).strip()
    category = str(body.get("category", "General")).strip()
    sub_issue = str(body.get("subIssue", "")).strip()
    workaround = str(body.get("workaround", "")).strip()
    is_emergency = bool(body.get("isEmergency", False))
    candidate_problems = body.get("candidateProblems", [])

    if not title:
        return jsonify({
            "success": False,
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "Problem title is required for AI analysis.",
            },
        }), 400

    if not description:
        return jsonify({
            "success": False,
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "Problem description is required for AI analysis.",
            },
        }), 400

    if len(title) > 300 or len(description) > 4000:
        return jsonify({
            "success": False,
            "error": {
                "code": "PAYLOAD_TOO_LARGE",
                "message": "Input text exceeds maximum allowed length for analysis.",
            },
        }), 400

    logger.info(
        "AI analyze-problem started: user=%s, workspace=%s, emergency=%s",
        g.user.get("uid"),
        g.workspace_id,
        is_emergency,
    )

    try:
        analysis = analyze_problem(
            title=title,
            description=description,
            category=category,
            workspace_id=g.workspace_id,
            sub_issue=sub_issue,
            workaround=workaround,
            is_emergency=is_emergency,
            recent_candidates=candidate_problems if isinstance(candidate_problems, list) else None,
        )

        logger.info("AI analyze-problem success for user=%s", g.user.get("uid"))
        return jsonify({
            "success": True,
            "analysis": analysis,
        })

    except GeminiNotConfiguredError as err:
        logger.info("Gemini not configured: %s", err)
        return jsonify({
            "success": False,
            "error": {
                "code": "AI_NOT_CONFIGURED",
                "message": "AI is temporarily unavailable. You can still submit your problem.",
            },
        }), 503

    except GeminiAPIError as err:
        logger.warning("Gemini API error during analyze-problem: %s", err)
        return jsonify({
            "success": False,
            "error": {
                "code": "AI_UNAVAILABLE",
                "message": "AI is temporarily unavailable. You can still submit your problem.",
            },
        }), 503

    except Exception as err:
        logger.error("Unexpected error in handle_analyze_problem: %s", err)
        return jsonify({
            "success": False,
            "error": {
                "code": "SERVER_ERROR",
                "message": "AI analysis is temporarily unavailable. You can proceed directly.",
            },
        }), 500

@ai_bp.route("/admin-summary", methods=["POST"])
@require_auth
@require_workspace
def handle_admin_summary():
    """
    POST /api/ai/admin-summary
    Synthesizes active authorized workspace problems into an executive summary.
    """
    body = request.get_json(silent=True) or {}
    problems = body.get("problems", [])
    workspace_name = str(body.get("workspaceName", "Workspace")).strip()

    if not isinstance(problems, list):
        return jsonify({
            "success": False,
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "Problems list must be an array.",
            },
        }), 400

    logger.info(
        "AI admin-summary started: user=%s, workspace=%s, count=%d",
        g.user.get("uid"),
        g.workspace_id,
        len(problems),
    )

    try:
        summary = generate_admin_summary(problems, workspace_name=workspace_name)
        logger.info("AI admin-summary success for workspace=%s", g.workspace_id)
        return jsonify({
            "success": True,
            "summary": summary,
        })
    except GeminiNotConfiguredError as err:
        return jsonify({
            "success": False,
            "error": {
                "code": "AI_NOT_CONFIGURED",
                "message": "AI summary service is temporarily unavailable.",
            },
        }), 503
    except GeminiAPIError as err:
        return jsonify({
            "success": False,
            "error": {
                "code": "AI_UNAVAILABLE",
                "message": "AI summary service is temporarily unavailable.",
            },
        }), 503
    except Exception as err:
        logger.error("Unexpected error in handle_admin_summary: %s", err)
        return jsonify({
            "success": False,
            "error": {
                "code": "SERVER_ERROR",
                "message": "Failed to generate AI summary.",
            },
        }), 500

@ai_bp.route("/find-similar", methods=["POST"])
@require_auth
@require_workspace
def handle_find_similar():
    """
    POST /api/ai/find-similar
    Checks a draft query against recent candidates from the authorized workspace.
    """
    body = request.get_json(silent=True) or {}
    title = str(body.get("title", "")).strip()
    description = str(body.get("description", "")).strip()
    category = str(body.get("category", "General")).strip()
    candidates = body.get("candidateProblems", [])

    if not title or not description:
        return jsonify({
            "success": False,
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "Title and description required.",
            },
        }), 400

    if not isinstance(candidates, list):
        return jsonify({
            "success": True,
            "result": {"hasSimilarProblem": False, "similarProblems": []},
        })

    try:
        result = find_similar_issue(title, description, category, candidates)
        return jsonify({
            "success": True,
            "result": result,
        })
    except Exception as err:
        logger.warning("find_similar_issue error: %s", err)
        return jsonify({
            "success": True,
            "result": {"hasSimilarProblem": False, "similarProblems": []},
        })
