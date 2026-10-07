"""
UNSAID Gemini AI Diagnostic Script
Safely verifies real Google Gemini connectivity via google-genai SDK.

SECURITY RULES:
- Never prints or exposes GEMINI_API_KEY.
- Reports exact error category and status code.
- Executes prompt: "Return JSON with a short greeting and a status field."
"""

import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import google.genai as genai
from backend.config import get_gemini_api_key, get_gemini_model, is_gemini_configured
from backend.services.gemini_service import test_gemini_connection, GeminiNotConfiguredError, GeminiAPIError

def run_diagnostic():
    print("=" * 60)
    print("UNSAID GEMINI AI DIAGNOSTIC CHECK")
    print("=" * 60)

    # 1. SDK Version
    print(f"[SDK] google-genai version: {genai.__version__}")

    # 2. Config check
    configured = is_gemini_configured()
    model = get_gemini_model()
    print(f"[CONFIG] Model: {model}")
    print(f"[CONFIG] API Key configured: {'YES (Present)' if configured else 'NO (Missing or empty)'}")

    if not configured:
        print("\n[RESULT] FAIL - GEMINI_API_KEY is not configured in backend/.env")
        print("Please configure GEMINI_API_KEY in backend/.env before running live tests.")
        return False

    # 3. Real Gemini API request
    print(f"\n[REQUEST] Sending test prompt to Google Gemini API (model={model})...")
    print("[REQUEST] Prompt: 'Return JSON with a short greeting and a status field.'")

    try:
        result = test_gemini_connection()
        print("\n[SUCCESS] REAL GEMINI API CALL PASSED!")
        print(f"[RESPONSE] Model used: {result.get('model')}")
        print(f"[RESPONSE] Content: {result.get('response')}")
        print("=" * 60)
        return True
    except GeminiNotConfiguredError as err:
        print(f"\n[FAIL] GEMINI_NOT_CONFIGURED: {err.safe_reason}")
        return False
    except GeminiAPIError as err:
        print(f"\n[FAIL] REAL GEMINI API CALL FAILED:")
        print(f"  Category:    {err.category}")
        print(f"  Status Code: {err.status_code}")
        print(f"  Reason:      {err.safe_reason}")
        print("=" * 60)
        return False
    except Exception as err:
        print(f"\n[FAIL] Unexpected exception: {type(err).__name__}: {err}")
        print("=" * 60)
        return False

if __name__ == "__main__":
    success = run_diagnostic()
    sys.exit(0 if success else 1)
