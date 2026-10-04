import { createContext } from 'react';

export const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspace: null,
  memberships: [],
  loading: true,
  isCurrentWorkspaceAdmin: false,
  isCurrentWorkspaceMember: false,
  currentWorkspaceRole: null,
  workspacePermissions: {},
  switchWorkspace: () => {},
  createWorkspace: async () => {},
  generateInvite: async () => {},
  getWorkspaceInvites: async () => [],
  revokeInvite: async () => {},
  getInviteByToken: async () => {},
  acceptInviteAndJoinWorkspace: async () => {},
  requestJoinWorkspace: async () => {},
  getUserRequestForWorkspace: async () => {},
  getWorkspaceRequests: async () => [],
  reviewJoinRequest: async () => {},
  pendingRequests: [],
  pendingRequestsCount: 0,
  refreshWorkspaces: async () => {},
});

