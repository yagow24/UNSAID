"""
UNSAID Backend Configuration
Loads environment variables and configuration for Gemini AI and Firebase Admin.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in project root and backend dir
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

# Gemini AI Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

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
    return bool(GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"))
