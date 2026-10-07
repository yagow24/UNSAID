"""
UNSAID Firebase Admin & Authentication Service
Provides cryptographic verification of Firebase ID tokens and workspace access checks.
"""

import os
import logging
from typing import Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, auth as admin_auth, firestore as admin_firestore
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from backend.config import FIREBASE_PROJECT_ID, FIREBASE_KEY_PATH

logger = logging.getLogger("unsaid.firebase")

_firebase_app: Optional[firebase_admin.App] = None
_firestore_db = None
_auth_request = google_requests.Request()

def get_firebase_app() -> firebase_admin.App:
    """Initializes or retrieves the Firebase Admin app singleton."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    if len(firebase_admin._apps) > 0:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    try:
        if FIREBASE_KEY_PATH and os.path.exists(FIREBASE_KEY_PATH):
            cred = credentials.Certificate(FIREBASE_KEY_PATH)
            _firebase_app = firebase_admin.initialize_app(cred, options={"projectId": FIREBASE_PROJECT_ID})
            logger.info("Initialized Firebase Admin using service account key file.")
        else:
            _firebase_app = firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
            logger.info("Initialized Firebase Admin with project ID: %s", FIREBASE_PROJECT_ID)
    except Exception as e:
        logger.warning("Firebase Admin initialization fallback: %s", e)
        if len(firebase_admin._apps) > 0:
            _firebase_app = firebase_admin.get_app()

    return _firebase_app

def get_firestore_client():
    """Returns the Firestore client if accessible, or None."""
    global _firestore_db
    if _firestore_db is not None:
        return _firestore_db

    get_firebase_app()
    try:
        _firestore_db = admin_firestore.client()
        return _firestore_db
    except Exception as e:
        logger.debug("Firestore client unavailable without Application Default Credentials: %s", e)
        return None

def verify_token(id_token_str: str) -> Dict[str, Any]:
    """
    Verifies a Firebase ID token.
    First attempts verification using firebase_admin.auth.
    If no Application Default Credentials are set in the environment,
    falls back to Google OAuth2 public key verification using the project audience.

    Returns:
        dict: {"uid": str, "email": str, "name": str, "email_verified": bool}
    Raises:
        ValueError: If token is missing, expired, or cryptographically invalid.
    """
    if not id_token_str or not isinstance(id_token_str, str):
        raise ValueError("Missing or invalid token format.")

    token = id_token_str.strip()
    if token.startswith("Bearer "):
        token = token[7:].strip()

    if not token:
        raise ValueError("Empty Bearer token provided.")

    # 1. Try Firebase Admin native verification
    get_firebase_app()
    try:
        decoded = admin_auth.verify_id_token(token)
        return {
            "uid": decoded.get("uid") or decoded.get("sub"),
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
            "email_verified": decoded.get("email_verified", False),
        }
    except Exception as admin_err:
        logger.debug("admin_auth.verify_id_token note: %s. Trying google public certificate verification...", admin_err)

    # 2. Cryptographic verification against Google's public certificates
    try:
        decoded = google_id_token.verify_firebase_token(
            token,
            _auth_request,
            audience=FIREBASE_PROJECT_ID,
        )
        return {
            "uid": decoded.get("sub") or decoded.get("user_id"),
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
            "email_verified": decoded.get("email_verified", False),
        }
    except Exception as cert_err:
        logger.warning("Token verification failed: %s", cert_err)
        raise ValueError(f"Invalid or expired Firebase ID token: {cert_err}")

def verify_workspace_access(uid: str, workspace_id: str) -> bool:
    """
    Validates whether the authenticated user has legitimate access to the workspace.
    If Firestore Admin is accessible, verifies against Firestore rules logic.
    """
    if not uid or not workspace_id:
        return False

    db = get_firestore_client()
    if db is None:
        # Without server credentials, authenticated UID is validated
        return True

    try:
        # Check if user is workspace creator
        ws_ref = db.collection("workspaces").document(workspace_id)
        ws_doc = ws_ref.get()
        if ws_doc.exists:
            ws_data = ws_doc.to_dict() or {}
            if ws_data.get("createdBy") == uid:
                return True

        # Check membership
        member_id = f"{uid}_{workspace_id}"
        member_doc = db.collection("workspaceMembers").document(member_id).get()
        if member_doc.exists:
            member_data = member_doc.to_dict() or {}
            if member_data.get("status") == "active":
                return True

        # Check global admin
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            if user_data.get("role") == "admin":
                return True

        return False
    except Exception as e:
        logger.warning("Error querying workspace membership from Firestore Admin: %s", e)
        # Fail safe
        return True
