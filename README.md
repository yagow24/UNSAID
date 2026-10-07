# UNSAID — Query Resolution & Workspace Platform

UNSAID is a real-time, workspace-scoped problem reporting and query resolution platform built with React, Vite, Tailwind CSS, and Firebase.

This codebase is cross-platform and runs identically on **macOS**, **Windows (Command Prompt / PowerShell)**, and **Linux**.

---

## Prerequisites

- **Node.js**: v18.0.0+ or v20.0.0+ (LTS recommended)
- **npm**: v9.0.0+
- **Git**

---

## Quick Setup (macOS / Linux)

```bash
# 1. Clone repository
git clone <repository-url>
cd UNSAID

# 2. Install dependencies (generates platform-native node_modules)
npm install

# 3. Create your local environment file
cp .env.example .env
# Edit .env and insert your Firebase project credentials

# 4. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Quick Setup (Windows — PowerShell or Command Prompt)

```powershell
# 1. Clone repository
git clone <repository-url>
cd UNSAID

# 2. Install dependencies (generates platform-native node_modules)
npm install

# 3. Create your local environment file
# In PowerShell:
Copy-Item .env.example .env
# Or in Command Prompt (cmd):
# copy .env.example .env

# Edit .env and insert your Firebase project credentials

# 4. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** (Email/Password and Google Provider).
3. Enable **Cloud Firestore** in your desired region (e.g. `asia-south1`).
4. Enable **Cloud Storage** for problem attachment uploads.
5. In Project Settings > General > Your apps, copy the Web SDK config values into your `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Optional: Shareable URL base for invite links across devices
VITE_APP_BASE_URL=
```

---

## Deploying Security Rules

To deploy updated Firestore and Storage security rules:

```bash
# Login to Firebase CLI
npx firebase login

# Deploy rules
npx firebase deploy --only firestore:rules,storage
```

---

## Available Scripts (Cross-Platform)

All scripts run via npm without OS-dependent shell commands:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts Vite HMR development server |
| `npm run build` | `vite build` | Compiles optimized production bundle |
| `npm run lint` | `oxlint` | High-performance codebase linting |
| `npm run preview` | `vite preview` | Locally previews production build |
| `npm run backend` | `python3 backend/app.py` | Starts Flask Gemini AI backend server |
| `npm run backend:test` | `python3 -m unittest ...` | Runs backend unit & integration tests |

---

## Gemini AI Setup (Backend)

UNSAID integrates Google's official Gemini Python SDK (`google-genai`) running on a secure Flask backend for query triage, pre-submit resolution, duplicate detection, and executive summaries.

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT**:
> The `GEMINI_API_KEY` must **NEVER** be placed in frontend/Vite environment variables (`VITE_...`), React source code, browser localStorage, or GitHub. The frontend communicates exclusively with the Flask API using verified Firebase Bearer tokens.

### Step-by-Step Setup:

1. **Obtain Gemini API Key**:
   Create an API key from Google AI Studio ([https://aistudio.google.com/](https://aistudio.google.com/)).

2. **Configure Backend Environment**:
   In your root `.env` (or `backend/.env`):
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   PORT=5001
   FIREBASE_PROJECT_ID=unsaid-app-14199-4b37e
   ```

3. **Install Backend Dependencies**:
   ```bash
   # Create and activate Python virtual environment
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install packages
   pip install -r backend/requirements.txt
   ```

4. **Start the Flask Backend**:
   ```bash
   npm run backend
   # Or: python3 backend/app.py
   ```
   The backend will be available at `http://127.0.0.1:5001`.

5. **Start the React Frontend**:
   ```bash
   npm run dev
   ```
   The Vite dev server proxies `/api` calls directly to the Flask backend.

6. **Run Backend Test Suite**:
   ```bash
   npm run backend:test
   ```

---

## Cross-Platform Hygiene Notes

- **Never commit `node_modules/`**: Always let `npm install` generate dependencies locally.
- **Never commit `.env` or service account keys**: Keep secrets in `.env` (gitignored).
- **Line endings**: Normalization is managed automatically via `.gitattributes`.
- **Case-sensitivity**: All file imports strictly match disk casing for Linux/Windows compatibility.
