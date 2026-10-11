import React from 'react';
import { Briefcase, GraduationCap } from 'lucide-react';
import { formatCompactProfile } from '../../services/profileService';

/**
 * ProfileBadge Component
 * Compact, privacy-safe display of a member's professional or academic identity.
 * Example outputs:
 * - "Student • 2nd Year • CSE"
 * - "Professor • Computer Science"
 * - "Employee • IT Department"
 */
export const ProfileBadge = ({
  profile,
  className = '',
  size = 'sm',
  showIcon = true,
  fallback = null,
}) => {
  const formatted = formatCompactProfile(profile);

  if (!formatted) {
    if (fallback) {
      return (
        <span className={`inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] ${className}`}>
          {fallback}
        </span>
      );
    }
    return null;
  }

  const isAcademic =
    profile?.professionalRole === 'Student' ||
    profile?.professionalRole === 'Research Scholar' ||
    profile?.professionalRole === 'Professor' ||
    profile?.professionalRole === 'Lecturer' ||
    profile?.professionalRole === 'Teacher' ||
    profile?.professionalRole === 'Teaching Assistant';

  const isSmall = size === 'xs' || size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all font-medium ${
        isAcademic
          ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]'
          : 'bg-[var(--cyan)]/10 border-[var(--cyan)]/30 text-[var(--cyan)]'
      } ${isSmall ? 'text-[11px]' : 'text-xs'} ${className}`}
      title={formatted}
    >
      {showIcon && (
        isAcademic ? (
          <GraduationCap className={isSmall ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        ) : (
          <Briefcase className={isSmall ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        )
      )}
      <span className="truncate max-w-[200px] sm:max-w-[260px]">{formatted}</span>
    </span>
  );
};
