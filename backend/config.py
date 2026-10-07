"""
UNSAID Backend Configuration
Loads environment variables and configuration for Gemini AI and Firebase Admin.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in project root and backend dir
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

_backend_env_mtime = 0.0

def reload_env():
    """Reloads environment variables from root and backend .env files if modified."""
    global _backend_env_mtime
    backend_env_file = BACKEND_DIR / ".env"
    current_mtime = backend_env_file.stat().st_mtime if backend_env_file.exists() else 0.0
    if current_mtime != _backend_env_mtime:
        if (ROOT_DIR / ".env").exists():
            load_dotenv(ROOT_DIR / ".env", override=False)
        if backend_env_file.exists():
            load_dotenv(backend_env_file, override=True)
        _backend_env_mtime = current_mtime

# Initial load
reload_env()

def get_gemini_api_key() -> str:
    """Dynamically retrieves GEMINI_API_KEY, reloading .env if modified."""
    reload_env()
    key = (
        os.getenv("GEMINI_API_KEY", "")
        or os.getenv("VITE_GEMINI_API_KEY", "")
        or os.getenv("GOOGLE_API_KEY", "")
        or os.getenv("GEMINI_KEY", "")
    ).strip()
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1].strip()
    return key

def get_gemini_model() -> str:
    """Dynamically retrieves GEMINI_MODEL, defaulting to gemini-2.5-flash-lite."""
    reload_env()
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip() or "gemini-2.5-flash-lite"


# Static backward-compatibility exports
GEMINI_API_KEY = get_gemini_api_key()
GEMINI_MODEL = get_gemini_model()

# Firebase Settings
FIREBASE_PROJECT_ID = (
    os.getenv("FIREBASE_PROJECT_ID")
    or os.getenv("VITE_FIREBASE_PROJECT_ID")
    or "unsaid-app-14199-4b37e"
).strip()
FIREBASE_KEY_PATH = os.getenv("FIREBASE_KEY_PATH", "").strip()

# Server Settings
PORT = int(os.getenv("PORT", 5001))
HOST = os.getenv("HOST", "0.0.0.0")

def is_gemini_configured() -> bool:
    """Returns True if a non-empty, non-placeholder Gemini API key is configured."""
    key = get_gemini_api_key()
    return bool(key and not key.startswith("your_") and key != "configured locally")

