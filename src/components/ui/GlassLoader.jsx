import React from 'react';
import { UnsaidLogoMark } from './UnsaidLogoMark';

/**
 * GlassLoader Component
 * Centered frosted glass loading screen featuring the official UNSAID app icon
 * with a smooth ambient glow and subtle pulse animation.
 * 
 * @param {Object} props
 * @param {string} [props.message='Checking session...']
 * @param {string} [props.subtitle='Securing access & verifying workspace']
 */
export const GlassLoader = ({
  message = 'Checking session...',
  subtitle = 'Securing access & verifying workspace',
}) => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
      <div className="glass-card p-8 rounded-3xl flex flex-col items-center gap-5 max-w-sm w-full border border-[var(--glass-border)] shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        {/* Top subtle specular reflection line */}
        <div
          className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-80"
          aria-hidden="true"
        />

        {/* Animated UNSAID App Icon with Jumping & Dancing */}
        <div className="relative flex items-center justify-center my-4">
          {/* Ambient luminous glow */}
          <div className="absolute -inset-3 rounded-2xl bg-gradient-to-tr from-[var(--primary)] via-[#8b5cf6] to-[var(--cyan)] opacity-35 blur-xl pointer-events-none" />

          {/* Official UNSAID App Icon */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <UnsaidLogoMark className="w-full h-full" showShadow />
          </div>
        </div>

        {/* Status message */}
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-[var(--text)] tracking-tight">
            {message}
          </h3>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
