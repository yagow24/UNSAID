import sys
import os
from pathlib import Path

# Add project root to sys.path so backend modules can be imported by Vercel
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app import app

# Vercel discovers and executes WSGI 'app'
