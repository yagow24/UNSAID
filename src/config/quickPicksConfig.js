/**
 * Quick Picks & Sub-Issues Configuration
 * 
 * Provides contextual chips for rapid problem reporting.
 * Completely configurable per workspace with a clean fallback model.
 * Does not permanently hardcode institutional categories or fixed questions.
 */

/**
 * Generic fallback quick picks displayed ONLY when a workspace
 * has not configured custom quick-pick chips.
 */
export const FALLBACK_QUICK_PICKS = [
  { id: 'gen-issue', label: 'General Issue', issueTitle: 'General Issue', category: 'General', isFallback: true },
  { id: 'tech-issue', label: 'Technical Issue', issueTitle: 'Technical Issue', category: 'Technical', isFallback: true },
  { id: 'access-issue', label: 'Access Issue', issueTitle: 'Access Issue', category: 'Access', isFallback: true },
  { id: 'facilities-issue', label: 'Facilities', issueTitle: 'Facilities', category: 'Facilities', isFallback: true },
];

/**
 * Resolves quick picks for a workspace, prioritizing workspace-specific configurations.
 * 
 * @param {Array} [workspaceQuickPicks] Optional custom quick picks stored on the workspace document
 * @returns {Array} List of active quick pick objects
 */
export const getActiveQuickPicks = (workspaceQuickPicks = null) => {
  if (Array.isArray(workspaceQuickPicks) && workspaceQuickPicks.length > 0) {
    return workspaceQuickPicks
      .filter((qp) => qp && qp.active !== false)
      .map((qp) => ({
        id: qp.id || `qp_${Math.random().toString(36).substring(2, 7)}`,
        label: qp.label || qp.issueTitle || 'Issue',
        issueTitle: qp.issueTitle || qp.label || 'Issue',
        category: qp.category || 'General',
        isFallback: false,
      }));
  }
  return FALLBACK_QUICK_PICKS;
};

/**
 * Generic fallback sub-issue options by category/topic.
 * Used only when the workspace does not define custom subIssueOptions.
 */
export const FALLBACK_SUB_ISSUES = {
  Infrastructure: ['Network Coverage', 'Slow Speed', 'No Connection', 'Hardware Malfunction', 'Power Outage'],
  Technical: ['System Down', 'Authentication Error', 'Application Crash', 'Slow Performance', 'Data Sync Issue'],
  Access: ['Card / Gate Denied', 'Permissions Expired', 'Account Locked', 'Turnstile Issue', 'Visitor Access'],
  Facilities: ['Air Conditioning / HVAC', 'Lighting', 'Water Supply', 'Restroom Cleanliness', 'Physical Damage'],
  General: ['Urgent Request', 'Policy Clarification', 'Scheduling Conflict', 'Feedback'],
};

/**
 * Resolves contextual sub-issues based on current category or title.
 * 
 * @param {string} category Current selected category
 * @param {string} issueTitle Current issue title
 * @param {Object} [workspaceSubIssues] Optional workspace.subIssueOptions mapping
 * @returns {Array<string>} List of sub-issue labels
 */
export const getContextualSubIssues = (category = 'General', issueTitle = '', workspaceSubIssues = null) => {
  // 1. Check workspace custom subIssueOptions by issueTitle first, then category
  if (workspaceSubIssues && typeof workspaceSubIssues === 'object') {
    if (issueTitle && Array.isArray(workspaceSubIssues[issueTitle])) {
      return workspaceSubIssues[issueTitle];
    }
    if (category && Array.isArray(workspaceSubIssues[category])) {
      return workspaceSubIssues[category];
    }
  }

  // 2. Fallback to generic contextual sub-issues
  if (category && FALLBACK_SUB_ISSUES[category]) {
    return FALLBACK_SUB_ISSUES[category];
  }

  return [];
};
