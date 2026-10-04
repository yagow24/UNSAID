import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppShell } from './components/layout/AppShell';

// Route Guards
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { AuthRoute } from './components/auth/AuthRoute';

// Pages
import { AdminSignInPage } from './pages/auth/AdminSignInPage';
import { AdminSignUpPage } from './pages/auth/AdminSignUpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { UserDashboardShell } from './pages/UserDashboardShell';
import { AdminDashboardShell } from './pages/AdminDashboardShell';
import { AccountPage } from './pages/account/AccountPage';
import { WorkspaceManagementPage } from './pages/workspace/WorkspaceManagementPage';
import { JoinWorkspacePage } from './pages/workspace/JoinWorkspacePage';
import { ComponentShowcase } from './pages/ComponentShowcase';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <NotificationProvider>
              <AppShell>
              <Routes>
                {/* Public Application Entry: Admin Authentication & Showcase */}
                <Route
                  path="/"
                  element={
                    <AuthRoute>
                      <AdminSignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/signin"
                  element={
                    <AuthRoute>
                      <AdminSignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <AuthRoute>
                      <AdminSignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <AuthRoute>
                      <AdminSignUpPage />
                    </AuthRoute>
                  }
                />
                <Route path="/showcase" element={<ComponentShowcase />} />

                {/* Explicit Admin Authentication Routes (Aliases) */}
                <Route
                  path="/admin/signin"
                  element={
                    <AuthRoute>
                      <AdminSignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/admin/login"
                  element={
                    <AuthRoute>
                      <AdminSignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/admin/signup"
                  element={
                    <AuthRoute>
                      <AdminSignUpPage />
                    </AuthRoute>
                  }
                />

                {/* Direct User Auth Routes Blocked -> Strictly Redirect to Public Gateway */}
                <Route
                  path="/user/*"
                  element={
                    <Navigate
                      to="/"
                      state={{
                        reason: 'invite_required',
                        message:
                          'User accounts are created through workspace invitations. Please open the invitation link provided by your workspace administrator.',
                      }}
                      replace
                    />
                  }
                />
                <Route
                  path="/app/signup"
                  element={
                    <Navigate
                      to="/"
                      state={{
                        reason: 'invite_required',
                        message:
                          'User accounts are created through workspace invitations. Please open the invitation link provided by your workspace administrator.',
                      }}
                      replace
                    />
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <AuthRoute>
                      <ForgotPasswordPage />
                    </AuthRoute>
                  }
                />

                {/* Workspace Invitation Flow (Public/Auth via valid invite token) */}
                <Route path="/join/:token" element={<JoinWorkspacePage />} />
                <Route path="/join/:inviteToken" element={<JoinWorkspacePage />} />

                {/* User Protected Views */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <UserDashboardShell />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <AccountPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspace"
                  element={
                    <ProtectedRoute>
                      <WorkspaceManagementPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Protected Views */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboardShell />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminDashboardShell />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </NotificationProvider>
        </WorkspaceProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
