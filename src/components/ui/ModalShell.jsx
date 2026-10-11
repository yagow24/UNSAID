import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

/**
 * ModalShell Component
 * Premium Liquid Glass accessible dialog modal mounted to document.body via Portal.
 * 
 * Features:
 * - Viewport-bounded centering (max-height: calc(100dvh - margins))
 * - Dedicated scrollable internal container
 * - Pinned header and footer
 * - Full-screen click-to-dismiss backdrop blur
 * - High stacking context (z-[9999]) to always sit above sticky headers and navigation
 * - Robust body scroll locking with cleanup
 * - Escape key dismissal
 * - Pointer and click event isolation
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string|React.ReactNode} [props.title]
 * @param {string|React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {'sm' | 'md' | 'lg' | 'xl'} [props.maxWidth='md']
 */
export const ModalShell = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Robust scroll-lock: lock body scroll while modal is active and restore on unmount/close
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const maxWidthClass = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-6xl',
  }[maxWidth] || 'max-w-xl';

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={typeof title === 'string' ? 'modal-title' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Universal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md transition-opacity duration-300 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={`glass-modal relative w-full ${maxWidthClass} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)] flex flex-col z-10 pointer-events-auto border border-[var(--glass-highlight)] shadow-2xl overflow-hidden animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top edge specular reflection */}
        <div
          className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-85 pointer-events-none"
          aria-hidden="true"
        />

        {/* Modal Header — pinned at top */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 pb-4 border-b border-[var(--glass-border)] shrink-0 bg-[var(--surface)]/80 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            {title && (
              <div
                id="modal-title"
                className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text)] truncate"
              >
                {title}
              </div>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>

          <IconButton
            icon={<X className="w-4 h-4 sm:w-5 sm:h-5" />}
            ariaLabel="Close modal"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>

        {/* Modal Body — internally scrollable, stays within viewport bounds */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed space-y-4">
          {children}
        </div>

        {/* Modal Footer — pinned at bottom */}
        {footer && (
          <div className="p-4 sm:p-5 pt-3.5 border-t border-[var(--glass-border)] flex items-center justify-end gap-3 shrink-0 bg-[var(--surface)]/80 backdrop-blur-md">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
