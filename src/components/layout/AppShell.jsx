import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../navigation/Header';
import { BottomNavigation } from '../navigation/BottomNavigation';
import { BackgroundOrbs } from '../effects/BackgroundOrbs';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

/**
 * AppShell Component
 * Primary visual shell wrapper for all views in UNSAID.
 * Hosts the ambient glass background, top sticky header, mobile bottom nav pill, and notifications modal.
 * 
 * Strict boundary rules:
 * - Public authentication pages (/signin, /signup, /forgot-password, /join/:token) MUST NOT display BottomNavigation.
 * - Only verified authenticated sessions render the floating mobile dock.
 */
export const AppShell = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Strict check for public authentication, gateway, or token join flows
  const isAuthOrJoinPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signin' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname.startsWith('/admin/signin') ||
    location.pathname.startsWith('/admin/signup') ||
    location.pathname.startsWith('/admin/login') ||
    location.pathname.startsWith('/join');

  return (
    <div className="min-h-screen relative flex flex-col selection:bg-[var(--primary)] selection:text-white">
      {/* 1. Ambient Floating Glass Orbs */}
      <BackgroundOrbs />

      {/* 2. Sticky Glass Header */}
      <Header
        onOpenNotifications={() =>
          setActiveModal({
            title: 'System Notifications',
            subtitle: 'Real-time alert status',
            content:
              'No new unhandled escalations. Real-time background sync is active.',
          })
        }
      />

      {/* 3. Main Page Content */}
      <main className="flex-1 relative z-10 w-full">
        {children}
      </main>

      {/* 4. Responsive iOS-Inspired Bottom Navigation (ONLY for Authenticated App Views) */}
      {!isAuthOrJoinPage && isAuthenticated && (
        <BottomNavigation />
      )}

      {/* 5. Shared Notification Modal Shell */}
      <ModalShell
        isOpen={Boolean(activeModal)}
        onClose={() => setActiveModal(null)}
        title={activeModal?.title}
        subtitle={activeModal?.subtitle}
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveModal(null)}>
            Dismiss
          </Button>
        }
      >
        <p>{activeModal?.content}</p>
      </ModalShell>
    </div>
  );
};
