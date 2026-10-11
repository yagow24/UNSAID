import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X, ShieldAlert, GraduationCap } from 'lucide-react';
import { isProfileComplete, getProfileCompletionPrompt } from '../../services/profileService';
import { Button } from '../ui/Button';

/**
 * ProfileCompletionBanner Component
 * Non-intrusive banner prompting users or admins to complete their professional or academic profile.
 */
export const ProfileCompletionBanner = ({
  profile,
  isAdmin = false,
  onOpenEdit = null,
  className = '',
}) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // If already complete or user dismissed for this view session, don't show
  if (dismissed || isProfileComplete(profile)) {
    return null;
  }

  const promptText = getProfileCompletionPrompt(profile, isAdmin);
  if (!promptText) return null;

  const isStudent = profile?.professionalRole === 'Student';

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
        isAdmin
          ? 'bg-gradient-to-r from-[var(--cyan)]/15 via-[var(--surface)] to-[var(--cyan)]/5 border-[var(--cyan)]/40'
          : isStudent
          ? 'bg-gradient-to-r from-[var(--primary)]/15 via-[var(--surface)] to-[var(--primary)]/5 border-[var(--primary)]/40'
          : 'bg-gradient-to-r from-[var(--primary)]/15 via-[var(--surface)] to-[var(--cyan)]/10 border-[var(--glass-border)]'
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            isAdmin
              ? 'bg-[var(--cyan)]/20 text-[var(--cyan)] border-[var(--cyan)]/30'
              : isStudent
              ? 'bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/30'
              : 'bg-[var(--surface-hover)] text-[var(--primary)] border-[var(--glass-border)]'
          }`}
        >
          {isAdmin ? (
            <ShieldAlert className="w-4 h-4" />
          ) : isStudent ? (
            <GraduationCap className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text)]">
              Complete your profile
            </span>
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                isAdmin
                  ? 'bg-[var(--cyan)]/20 text-[var(--cyan)]'
                  : 'bg-[var(--primary)]/20 text-[var(--primary)]'
              }`}
            >
              Recommended
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-tight">
            {promptText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <Button
          variant={isAdmin ? 'primary' : 'primary'}
          size="sm"
          onClick={() => {
            if (onOpenEdit) {
              onOpenEdit();
            } else {
              navigate('/account');
            }
          }}
          icon={<ArrowRight className="w-3.5 h-3.5" />}
          className="text-xs font-semibold"
        >
          Complete Profile
        </Button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Dismiss for now"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
