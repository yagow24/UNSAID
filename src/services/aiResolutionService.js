/**
 * UNSAID Centralized AI Service (Client Interface)
 * 
 * Secure interface connecting the React frontend to the Flask Gemini AI backend.
 * 
 * STRICT ARCHITECTURE RULES:
 * 1. NEVER store raw Gemini API keys or secrets in the client frontend.
 * 2. Authenticates exclusively using verified Firebase ID tokens:
 *    Authorization: Bearer <firebase-id-token>
 * 3. NO FAKE/MOCK AI RESPONSES: If backend or Gemini is unavailable, returns a truthful
 *    graceful fallback state so the user can proceed directly to standard operations.
 */

import { auth } from '../config/firebase';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

const getAuthHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('[UNSAID AI] Failed to retrieve Firebase ID token:', err);
  }

  return headers;
};

/**
 * Validates the structure of AI problem analysis received from the backend.
 * 
 * @param {any} data 
 * @returns {boolean}
 */
export const isValidAnalysisResponse = (data) => {
  if (!data || typeof data !== 'object') return false;
  const a = data.analysis;
  if (!a || typeof a !== 'object') return false;
  return typeof a.summary === 'string';
};

/**
 * Requests AI problem analysis and suggested resolutions for a problem draft.
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} [params.category]
 * @param {string} [params.subIssue]
 * @param {string} [params.workaround]
 * @param {boolean} [params.isEmergency]
 * @param {Array} [params.candidateProblems]
 * @returns {Promise<Object>} Structured analysis or truthful unavailable state
 */
export const fetchAIResolution = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  subIssue = '',
  workaround = '',
  isEmergency = false,
  candidateProblems = [],
}) => {
  if (!workspaceId) {
    return {
      available: false,
      reason: 'WORKSPACE_REQUIRED',
      message: 'Workspace context is required for AI resolution.',
      analysis: null,
    };
  }

  const payload = {
    workspaceId,
    title: (title || '').trim(),
    description: (description || '').trim(),
    category: (category || 'General').trim(),
    subIssue: (subIssue || '').trim(),
    workaround: (workaround || '').trim(),
    isEmergency: Boolean(isEmergency),
    candidateProblems: Array.isArray(candidateProblems)
      ? candidateProblems.slice(0, 10).map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
        }))
      : [],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);


  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/ai/analyze-problem`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok) {
      const errData = isJson ? await response.json().catch(() => ({})) : {};
      const code = errData?.error?.code || `HTTP_${response.status}`;
      const msg =
        errData?.error?.message ||
        'AI suggestions are temporarily unavailable. You can still submit your problem.';
      const details = errData?.error?.details || '';

      console.warn(`[UNSAID AI] Backend returned ${code}:`, details || msg);

      return {
        available: false,
        reason: code,
        category: errData?.error?.category || 'error',
        message: msg,
        details,
        analysis: null,
      };
    }

    if (!isJson) {
      console.warn('[UNSAID AI] Backend endpoint returned non-JSON response.');
      return {
        available: false,
        reason: 'BACKEND_NOT_CONFIGURED',
        message: 'AI backend endpoint is not yet connected on this deployment.',
        analysis: null,
      };
    }

    const data = await response.json();

    if (!data.success || !isValidAnalysisResponse(data)) {
      return {
        available: false,
        reason: 'INVALID_FORMAT',
        message: 'Received an invalid response format from AI service.',
        analysis: null,
      };
    }

    const a = data.analysis;

    return {
      available: true,
      analysis: {
        summary: a.summary || '',
        category: a.category || category,
        priority: a.priority || (isEmergency ? 'high' : 'medium'),
        urgency: a.urgency || (isEmergency ? 'emergency' : 'normal'),
        suggestedWorkaround: a.suggestedWorkaround || '',
        likelyCause: a.likelyCause || '',
        quickActions: Array.isArray(a.quickActions) ? a.quickActions : [],
        needsHumanAttention: Boolean(a.needsHumanAttention),
        confidence: typeof a.confidence === 'number' ? a.confidence : 0.85,
        hasSimilarProblem: Boolean(a.hasSimilarProblem),
        similarProblems: Array.isArray(a.similarProblems) ? a.similarProblems : [],
        model: a.model || 'gemini-2.5-flash',
      },
      // Backward compatibility helpers for legacy views
      summary: a.summary || '',
      confidence: typeof a.confidence === 'number' ? a.confidence : null,
      suggestions: a.suggestedWorkaround
        ? [
            {
              title: 'Recommended Troubleshooting Steps',
              steps: a.quickActions?.length
                ? a.quickActions
                : [a.suggestedWorkaround],
            },
          ]
        : [],
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';

    return {
      available: false,
      reason: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: 'AI is temporarily unavailable. You can still submit your problem.',
      analysis: null,
    };
  }
};

/**
 * Requests an executive AI summary of authorized problems in a workspace.
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} [params.workspaceName]
 * @param {Array} params.problems
 * @returns {Promise<Object>}
 */
export const fetchAdminAISummary = async ({
  workspaceId,
  workspaceName = 'Workspace',
  problems = [],
}) => {
  if (!workspaceId) {
    return {
      success: false,
      error: 'Workspace identifier required.',
    };
  }

  const payload = {
    workspaceId,
    workspaceName,
    problems: problems.slice(0, 30).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      priority: p.priority,
      status: p.status,
      isEmergency: p.isEmergency,
      isRecurring: p.isRecurring,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);


  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/ai/admin-summary`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok) {
      const errData = isJson ? await response.json().catch(() => ({})) : {};
      const code = errData?.error?.code || `HTTP_${response.status}`;
      const msg =
        errData?.error?.message ||
        'AI summary is temporarily unavailable.';
      const details = errData?.error?.details || '';
      console.warn(`[UNSAID AI Summary] Backend returned ${code}:`, details || msg);
      return {
        success: false,
        error: msg,
        details,
      };
    }

    if (!isJson) {
      return {
        success: false,
        error: 'AI backend endpoint is not yet connected on this deployment. Please verify backend deployment and environment variables.',
      };
    }

    const data = await response.json();
    return {
      success: true,
      summary: data.summary,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'AI request timed out.' : 'AI network error.',
    };
  }
};

/**
 * Checks AI backend health and model status.
 * 
 * @returns {Promise<Object>}
 */
export const checkAIStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/ai/status`, {
      method: 'GET',
    });
    if (!res.ok) return { online: false, aiConfigured: false };
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (!isJson) return { online: false, aiConfigured: false };
    const data = await res.json();
    return {
      online: true,
      aiConfigured: Boolean(data.aiConfigured),
      model: data.model || 'gemini-2.5-flash-lite',
    };
  } catch {
    return { online: false, aiConfigured: false };
  }
};

/**
 * Sends a conversational message from the user chatbot to the backend Gemini AI.
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} [params.workspaceName]
 * @param {string} params.message
 * @param {Array} [params.history]
 * @returns {Promise<Object>}
 */
export const sendUserChatMessage = async ({
  workspaceId,
  workspaceName = 'Workspace',
  message,
  history = [],
}) => {
  if (!workspaceId) {
    return {
      success: false,
      error: 'Workspace context is required.',
    };
  }

  if (!message || !message.trim()) {
    return {
      success: false,
      error: 'Message cannot be empty.',
    };
  }

  const payload = {
    workspaceId,
    workspaceName,
    message: message.trim(),
    history: Array.isArray(history)
      ? history.slice(-8).map((h) => ({
          sender: h.sender || (h.isUser ? 'user' : 'model'),
          text: h.text || h.content || '',
        }))
      : [],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok) {
      const errData = isJson ? await response.json().catch(() => ({})) : {};
      const code = errData?.error?.code || `HTTP_${response.status}`;
      const msg =
        errData?.error?.message ||
        'AI assistant is temporarily unavailable.';
      return {
        success: false,
        error: msg,
        code,
      };
    }

    if (!isJson) {
      return {
        success: false,
        error: 'AI assistant is temporarily unavailable on this deployment. Please verify backend deployment and environment variables.',
      };
    }

    const data = await response.json();
    if (!data.success || typeof data.reply !== 'string') {
      return {
        success: false,
        error: 'Invalid response from AI assistant.',
      };
    }

    return {
      success: true,
      reply: data.reply,
      model: data.model,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'AI request timed out.' : 'AI network error.',
    };
  }
};

