import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Building2,
  User,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';

/**
 * BottomNavigation Component
 * Modern macOS / iOS Liquid Glass floating dock navigation.
 * Features a TRUE liquid press-and-hold morph interaction:
 * - Fluid glass membrane expansion on hold
 * - Neighboring items smoothly parting away
 * - Traveling specular light reflection
 * - Graceful icon + label unfurling
 * - Instant short click/tap navigation without delay
 * - Strictly isolated from public authentication & join flows
 * - Inactive and unclickable when any modal dialog is open
 */
export const BottomNavigation = ({ onHoldAction }) => {
  const { isAuthenticated, isAdmin: isPlatformAdmin } = useAuth();
  const { isCurrentWorkspaceAdmin } = useWorkspace();
  const isAdmin = isPlatformAdmin || isCurrentWorkspaceAdmin;
  const navigate = useNavigate();
  const location = useLocation();

  // Strict route boundary: Do NOT render bottom navigation on public auth or join pages
  const isAuthOrJoin =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signin' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname.startsWith('/admin/signin') ||
    location.pathname.startsWith('/admin/signup') ||
    location.pathname.startsWith('/admin/login') ||
    location.pathname.startsWith('/join');

  // Hold State Management
  const [heldItemId, setHeldItemId] = useState(null);
  const [isMorphActive, setIsMorphActive] = useState(false);

  const startTimeRef = useRef(0);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const hasTriggeredRef = useRef(false);
  const animFrameRef = useRef(null);
  const holdTimerRef = useRef(null);
  const isDraggingRef = useRef(false);

  const HOLD_THRESHOLD = 260; // ms to activate liquid glass morph
  const FULL_HOLD_THRESHOLD = 480; // ms to complete hold and fire action

  // Navigation Items configuration strictly for authenticated roles
  const getNavItems = () => {
    if (isAdmin) {
      return [
        { id: 'admin', label: 'Dashboard', path: '/admin', icon: <ShieldAlert className="w-5 h-5" /> },
        { id: 'workspaces', label: 'Workspaces', path: '/workspace', icon: <Building2 className="w-5 h-5" /> },
        { id: 'account', label: 'Account', path: '/account', icon: <User className="w-5 h-5" /> },
      ];
    }

    // Authenticated Regular User
    return [
      { id: 'home', label: 'Home', path: '/app', icon: <Home className="w-5 h-5" /> },
      { id: 'workspace', label: 'Workspaces', path: '/workspace', icon: <Building2 className="w-5 h-5" /> },
      { id: 'account', label: 'Account', path: '/account', icon: <User className="w-5 h-5" /> },
    ];
  };

  const navItems = getNavItems();

  const resetHold = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHeldItemId(null);
    setIsMorphActive(false);
    hasTriggeredRef.current = false;
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    return () => resetHold();
  }, [resetHold]);

  const handlePointerDown = useCallback((e, item) => {
    if (e.button && e.button !== 0) return; // Only primary mouse/touch button

    // When a modal is open (indicated by locked body scroll), ignore all dock pointer gestures
    if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') {
      return;
    }

    e.stopPropagation();

    resetHold();
    startTimeRef.current = performance.now();
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasTriggeredRef.current = false;
    isDraggingRef.current = false;

    // Window-level safety: release anywhere collapses hold
    const handleGlobalRelease = () => {
      resetHold();
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
    };
    window.addEventListener('pointerup', handleGlobalRelease, { once: true });
    window.addEventListener('pointercancel', handleGlobalRelease, { once: true });

    // Loop animation to smoothly interpolate hold morph
    const loop = () => {
      const elapsed = performance.now() - startTimeRef.current;

      if (elapsed >= HOLD_THRESHOLD) {
        setIsMorphActive(true);
        setHeldItemId(item.id);
      }

      if (elapsed >= FULL_HOLD_THRESHOLD && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        // Subtle haptic response
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(25);
          } catch {
            // Safe fallback
          }
        }
        if (onHoldAction) {
          onHoldAction(item);
        }
      }

      if (elapsed < FULL_HOLD_THRESHOLD + 200) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [resetHold, onHoldAction]);

  const handlePointerMove = useCallback((e) => {
    if (!startTimeRef.current) return;
    const dist = Math.hypot(
      e.clientX - pointerStartPosRef.current.x,
      e.clientY - pointerStartPosRef.current.y
    );
    if (dist > 14) {
      // User is scrolling/dragging; cancel hold cleanly
      isDraggingRef.current = true;
      resetHold();
    }
  }, [resetHold]);

  const handlePointerUp = useCallback((e, item) => {
    e.stopPropagation();
    const elapsed = performance.now() - startTimeRef.current;
    const wasDragging = isDraggingRef.current;
    const hadTriggeredHold = hasTriggeredRef.current || elapsed >= HOLD_THRESHOLD;

    resetHold();

    // Short click / tap: navigate directly if not held and not dragged
    if (!hadTriggeredHold && !wasDragging && elapsed < HOLD_THRESHOLD) {
      navigate(item.path);
    }
  }, [resetHold, navigate]);

  const handlePointerCancel = useCallback(() => {
    resetHold();
  }, [resetHold]);

  const handleKeyDown = (e, item) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(item.path);
    }
  };

  // If on auth route or not authenticated, render nothing
  if (isAuthOrJoin || !isAuthenticated) {
    return null;
  }

  const heldIndex = heldItemId ? navItems.findIndex((i) => i.id === heldItemId) : -1;

  return (
    <nav
      className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none select-none"
      aria-label="Liquid Glass Bottom Navigation"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`pointer-events-auto liquid-dock rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--glass-highlight)] shadow-2xl flex items-center justify-center gap-1.5 sm:gap-2 relative transition-all duration-300 ease-out ${
          isMorphActive ? 'scale-[1.03] shadow-[0_25px_60px_-10px_rgba(0,0,0,0.35)]' : ''
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Dock top specular light catch */}
        <div
          className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-85 pointer-events-none rounded-t-full"
          aria-hidden="true"
        />

        {navItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          const isHeld = isMorphActive && heldItemId === item.id;
          const isNeighbor = isMorphActive && heldItemId !== null && heldItemId !== item.id;

          // Calculate displacement for neighboring items (smooth parting)
          let neighborDisplacement = 0;
          if (isNeighbor && heldIndex !== -1) {
            if (idx < heldIndex) {
              neighborDisplacement = -10; // Slide left
            } else if (idx > heldIndex) {
              neighborDisplacement = 10; // Slide right
            }
          }

          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onPointerDown={(e) => handlePointerDown(e, item)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, item)}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerCancel}
              onKeyDown={(e) => handleKeyDown(e, item)}
              className={`relative flex items-center justify-center rounded-full cursor-pointer outline-none select-none transition-all ${
                isHeld
                  ? 'px-4 sm:px-5 py-2 sm:py-2.5 z-20 text-[var(--primary)] font-semibold shadow-lg'
                  : 'w-10 h-10 sm:w-11 sm:h-11'
              } ${
                isNeighbor ? 'opacity-55 scale-90' : 'opacity-100'
              } ${
                isActive && !isHeld
                  ? 'text-[var(--primary)] font-semibold'
                  : !isHeld
                  ? 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  : ''
              }`}
              style={{
                transform: isHeld
                  ? `scale(1.06) translateY(-2px)`
                  : neighborDisplacement !== 0
                  ? `translateX(${neighborDisplacement}px) scale(0.92)`
                  : 'none',
                transitionDuration: isHeld ? '220ms' : '380ms',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                background: isHeld
                  ? 'var(--primary-light)'
                  : isActive && !isMorphActive
                  ? 'var(--primary-light)'
                  : 'transparent',
                borderColor: isHeld
                  ? 'rgba(124, 92, 255, 0.45)'
                  : isActive && !isMorphActive
                  ? 'rgba(124, 92, 255, 0.3)'
                  : 'transparent',
                boxShadow: isHeld
                  ? '0 12px 30px -4px rgba(124, 92, 255, 0.45), 0 0 20px 2px rgba(124, 92, 255, 0.25), inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.7)'
                  : isActive && !isMorphActive
                  ? 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.5), 0 4px 14px -2px rgba(124, 92, 255, 0.35)'
                  : 'none',
              }}
            >
              {/* Traveling Liquid Shimmer on Held Button */}
              {isHeld && <div className="liquid-hold-shimmer" aria-hidden="true" />}

              {/* Icon Container */}
              <div
                className="relative z-10 transition-transform duration-200 shrink-0 flex items-center justify-center"
                style={{
                  filter: isHeld
                    ? 'drop-shadow(0 0 10px var(--primary))'
                    : isActive
                    ? 'drop-shadow(0 0 6px var(--primary))'
                    : undefined,
                  transform: isHeld ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {item.icon}
              </div>

              {/* Liquid Unfurling Label */}
              <span
                className={`relative z-10 text-xs tracking-tight font-semibold whitespace-nowrap overflow-hidden transition-all ${
                  isHeld
                    ? 'max-w-[120px] opacity-100 ml-1.5'
                    : 'max-w-0 opacity-0 ml-0'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
