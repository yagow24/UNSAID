/**
 * Pre-Submit AI Resolution Service
 * 
 * Secure interface for requesting AI knowledge-base resolutions before publishing.
 * 
 * STRICT ARCHITECTURE RULES:
 * 1. NEVER store raw Gemini API keys or secrets in the client frontend.
 * 2. ONLY route requests to an approved, secured backend endpoint if configured.
 * 3. NO MOCK/FAKE AI RESPONSES: If no backend endpoint exists, return a truthful
 *    unavailable state so the user can proceed directly to publishing.
 */

const AI_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_RESOLUTION_ENDPOINT) || '';

/**
 * Validates the structure of AI resolution responses received from the backend.
 * Ensures the frontend does not blindly render arbitrary/malformed data.
 * 
 * @param {any} data 
 * @returns {boolean}
 */
export const isValidAIResponse = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.suggestions)) return false;

  return data.suggestions.every(
    (s) =>
      s &&
      typeof s.title === 'string' &&
      Array.isArray(s.steps) &&
      s.steps.every((step) => typeof step === 'string')
  );
};

/**
 * Requests AI resolution suggestions for a problem draft.
 * 
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} [params.category]
 * @param {string} [params.subIssue]
 * @param {string} [params.workaround]
 * @param {boolean} [params.isEmergency]
 * @returns {Promise<Object>} Resolution result or truthful unavailable state
 */
export const fetchAIResolution = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  subIssue = '',
  workaround = '',
  isEmergency = false,
}) => {
  // If no backend endpoint is configured, return truthful unavailable state immediately
  if (!AI_ENDPOINT || typeof AI_ENDPOINT !== 'string' || !AI_ENDPOINT.trim()) {
    return {
      available: false,
      reason: 'NOT_CONFIGURED',
      message: 'AI suggestions are currently unavailable. You can still publish your problem.',
      suggestions: [],
    };
  }

  // Construct context payload without exposing unnecessary personal data
  const payload = {
    workspaceId,
    title: (title || '').trim(),
    description: (description || '').trim(),
    category: (category || 'General').trim(),
    subIssue: (subIssue || '').trim(),
    workaround: (workaround || '').trim(),
    isEmergency: Boolean(isEmergency),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[UNSAID AI Resolution] Backend HTTP error: ${response.status}`);
      return {
        available: false,
        reason: 'HTTP_ERROR',
        message: 'AI suggestions are temporarily unavailable. You can proceed with publishing.',
        suggestions: [],
      };
    }

    const data = await response.json();

    if (!isValidAIResponse(data)) {
      console.warn('[UNSAID AI Resolution] Malformed response structure:', data);
      return {
        available: false,
        reason: 'MALFORMED_RESPONSE',
        message: 'Received an invalid response format from AI service. You can publish directly.',
        suggestions: [],
      };
    }

    return {
      available: true,
      canResolve: Boolean(data.canResolve),
      summary: data.summary || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      suggestions: data.suggestions,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[UNSAID AI Resolution Error]', err.name === 'AbortError' ? 'Request timed out' : err.message);

    return {
      available: false,
      reason: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: 'AI suggestion service is currently unreachable. You can still publish your problem.',
      suggestions: [],
    };
  }
};
