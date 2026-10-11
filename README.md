# UNSAID — Query Resolution & Workspace Platform

UNSAID is a real-time, workspace-scoped problem reporting and query resolution platform built with React, Vite, Tailwind CSS, Firebase, and a Python Flask backend powered by Google Gemini AI.

This codebase is cross-platform and runs identically on **macOS**, **Windows (Command Prompt / PowerShell)**, and **Linux**.

---

## Prerequisites

- **Node.js**: v18.0.0+ or v20.0.0+ (LTS recommended)
- **npm**: v9.0.0+
- **Python**: 3.10+ (with `venv` module)
- **Git**

---

## One-Time Setup

### 1. Clone & Install Frontend Dependencies

```bash
# Clone repository
git clone <repository-url>
cd UNSAID

# Install Node dependencies
npm install
```

### 2. Set Up Python Virtual Environment

Create the virtual environment in the project root (`./venv`):

**On macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**On Windows (Command Prompt - cmd):**
```cmd
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

---

## Environment Variables Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure the following variables in `.env` (keep your secret keys private and never commit `.env` to Git):

```env
# ==========================================
# Frontend Configuration (Firebase Web SDK)
# ==========================================
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_APP_BASE_URL=http://localhost:5173

# ==========================================
# Backend Configuration (Flask & Gemini AI)
# ==========================================
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
PORT=5001
HOST=127.0.0.1
FIREBASE_PROJECT_ID=your_firebase_project_id
```

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT**:
> `GEMINI_API_KEY` is a backend-only secret. **NEVER** prefix it with `VITE_` or expose it in frontend React code. The frontend interacts with AI exclusively through the Vite proxy (`/api/ai/*`) forwarding to the Flask backend.

---

## Single-Command Local Development

To start **BOTH** the Flask backend and the Vite frontend simultaneously in a single terminal:

```bash
npm run dev:full
```

### What this command does:
1. Automatically detects the Python executable inside your project-root `venv` across macOS, Linux, and Windows.
2. Starts the Flask backend on `http://127.0.0.1:5001`.
3. Starts the Vite development server on `http://localhost:5173`.
4. Streams both backend and frontend logs side-by-side with colorized prefixes `[backend]` and `[frontend]`.
5. Forwards all `/api/*` frontend requests to the Flask server via Vite's configured proxy.

### How to Stop:
Press **`Ctrl + C`** once in the terminal. Both the frontend and backend processes terminate cleanly and immediately release ports `5173` and `5001`.

---

## Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **`npm run dev:full`** | `concurrently ...` | **Starts both Flask backend & Vite frontend in one terminal** |
| `npm run dev` | `vite` | Starts only the Vite frontend dev server |
| `npm run dev:backend` | `node scripts/dev-backend.js` | Starts only the Flask backend using the root `venv` |
| `npm run build` | `vite build` | Compiles optimized frontend production bundle |
| `npm run lint` | `oxlint` | Codebase linting |
| `npm run preview` | `vite preview` | Previews production build locally |
| `npm run backend` | `python3 backend/app.py` | Legacy direct backend start command |
| `npm run backend:test` | `python3 -m unittest ...` | Runs Python backend test suite |
| `npm run backend:diag` | `python3 backend/diagnostic.py` | Runs backend Gemini AI diagnostics |

---

## Verifying Services

With servers running via `npm run dev:full`, you can verify both endpoints:

1. **Backend Health Check**:
   ```bash
   curl http://127.0.0.1:5001/api/health
   # Response: {"status":"healthy","service":"unsaid-backend","aiConfigured":true,...}
   ```

2. **Gemini AI Status**:
   ```bash
   curl http://127.0.0.1:5001/api/ai/status
   # Response: {"status":"online","success":true,"model":"gemini-2.5-flash-lite",...}
   ```

3. **Frontend Proxy Verification**:
   ```bash
   curl http://localhost:5173/api/health
   # Forwards through Vite to Flask and returns the same health JSON
   ```

---

## Troubleshooting

### 1. Port 5001 is already in use
If another terminal or background process is already bound to port 5001:
- **macOS / Linux**:
  ```bash
  lsof -ti :5001 | xargs kill -9
  ```
- **Windows (PowerShell)**:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5001).OwningProcess | Stop-Process -Force
  ```
- **Windows (Command Prompt)**:
  ```cmd
  netstat -ano | findstr :5001
  taskkill /PID <PID_NUMBER> /F
  ```

### 2. "No venv found at ./venv" warning
Ensure you created your virtual environment in the project root:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. "No module named flask" or missing Python dependencies
Activate the virtual environment and reinstall packages:
```bash
./venv/bin/pip install -r requirements.txt
# On Windows: .\venv\Scripts\pip.exe install -r requirements.txt
```

### 4. AI shows "API Key not configured"
Verify that `GEMINI_API_KEY` is defined in `.env` without surrounding quotation marks and without a `VITE_` prefix.

---

## Deploying Security Rules

To deploy updated Firestore and Storage security rules:

```bash
# Login to Firebase CLI
npx firebase login

# Deploy rules
npx firebase deploy --only firestore:rules,storage
```
