import React, { useId } from 'react';

/**
 * Official UNSAID App Icon Logo Mark
 * Minimal, geometric brand mark featuring the signature two vertical capsules (eyes)
 * and centered horizontal pill (mouth) with lifelike pet activities:
 * - Gentle idle respiration & curious head-tilt
 * - Smooth, relaxed, slow organic eye blinks
 * - Expressive mouth reactivity
 * - Sparkling "bling" star twinkle
 */
export const UnsaidLogoMark = ({
  size,
  className = '',
  showShadow = true,
  animated = true,
  alt = 'UNSAID',
}) => {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const bgGradId = `unsaid-bg-${id}`;
  const depthFilterId = `unsaid-depth-${id}`;
  const pillGradId = `unsaid-pill-${id}`;

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`select-none shrink-0 ${showShadow ? 'shadow-md' : ''} ${className}`}
      aria-label={alt}
      role="img"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ea8fc" />
          <stop offset="25%" stopColor="#6582fd" />
          <stop offset="60%" stopColor="#9a71f9" />
          <stop offset="100%" stopColor="#e696f8" />
        </linearGradient>

        <filter id={depthFilterId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#190e4a" floodOpacity="0.24" />
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#24155b" floodOpacity="0.18" />
        </filter>

        <linearGradient id={pillGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5f4fc" />
        </linearGradient>

        {animated && (
          <style>{`
            /* 1. Pet Body Activities: Calm breathing, curious idle head tilt, and perky bounce (5.5s cycle) */
            @keyframes unsaid-pet-body-${id} {
              0%, 100% {
                transform: translateY(0px) scale(1) rotate(0deg);
              }
              25% {
                transform: translateY(-2.5px) scale(1.015) rotate(0.8deg); /* breathing in & curious tilt */
              }
              50% {
                transform: translateY(0px) scale(1) rotate(-0.6deg); /* breathing out & gentle shift */
              }
              70% {
                transform: translateY(-2px) scale(1.01) rotate(0.6deg); /* listening / watching */
              }
              86% {
                transform: translateY(0px) scale(1) rotate(0deg);
              }
              89% {
                transform: translateY(2px) scaleY(0.985); /* subtle dip during blink */
              }
              93% {
                transform: translateY(-3px) scale(1.02) rotate(-0.5deg); /* perky bounce as eyes open */
              }
              97% {
                transform: translateY(0px) scale(1) rotate(0deg);
              }
            }

            /* 2. Slower, smooth, cushioned eye blink */
            @keyframes unsaid-pet-eyes-${id} {
              0%, 84%, 100% {
                transform: scaleY(1);
              }
              87.5% {
                transform: scaleY(0.08); /* smooth cushioned close */
              }
              90.5% {
                transform: scaleY(1); /* smooth reopen */
              }
              92.5% {
                transform: scaleY(0.22); /* cute soft flutter */
              }
              94.5% {
                transform: scaleY(1.05); /* perky wide open */
              }
              97.5% {
                transform: scaleY(1);
              }
            }

            /* 3. Expressive Pet Mouth Activity */
            @keyframes unsaid-pet-mouth-${id} {
              0%, 85%, 100% {
                transform: scale(1);
              }
              88% {
                transform: scaleX(0.94) scaleY(1.06); /* curious soft pursing */
              }
              93% {
                transform: scaleX(1.06) scaleY(0.94); /* happy soft smile widening */
              }
              97% {
                transform: scale(1);
              }
            }

            /* 4. Magical Bling Sparkle */
            @keyframes unsaid-pet-bling-${id} {
              0%, 91% {
                opacity: 0;
                transform: scale(0) rotate(0deg);
              }
              94% {
                opacity: 1;
                transform: scale(1.2) rotate(45deg);
              }
              96.5% {
                opacity: 0.9;
                transform: scale(0.85) rotate(90deg);
              }
              99% {
                opacity: 0;
                transform: scale(0) rotate(135deg);
              }
              100% {
                opacity: 0;
              }
            }

            .unsaid-pet-body-${id} {
              transform-origin: 256px 256px;
              animation: unsaid-pet-body-${id} 5.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
              transition: transform 0.3s ease;
            }

            .unsaid-pet-body-${id}:hover {
              animation-play-state: paused;
              transform: translateY(-2px) scale(1.04);
            }

            .unsaid-eye-left-${id},
            .unsaid-eye-right-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-eyes-${id} 5.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
            }

            .unsaid-mouth-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-mouth-${id} 5.5s infinite ease-in-out;
            }

            .unsaid-sparkle-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-${id} 5.5s infinite ease-out;
            }
          `}</style>
        )}
      </defs>

      {/* Entire Animated Pet Body (Breathing, Sway & Bounce) */}
      <g className={animated ? `unsaid-pet-body-${id}` : ''}>
        {/* Squircle Canvas */}
        <rect width="512" height="512" rx="116" fill={`url(#${bgGradId})`} />

        {/* UNSAID Iconic Mark */}
        <g filter={`url(#${depthFilterId})`}>
          {/* Left Eye Capsule */}
          <rect
            className={animated ? `unsaid-eye-left-${id}` : ''}
            x="106"
            y="138"
            width="56"
            height="198"
            rx="16"
            fill={`url(#${pillGradId})`}
          />

          {/* Right Eye Capsule */}
          <rect
            className={animated ? `unsaid-eye-right-${id}` : ''}
            x="350"
            y="138"
            width="56"
            height="198"
            rx="16"
            fill={`url(#${pillGradId})`}
          />

          {/* Center Mouth Capsule */}
          <rect
            className={animated ? `unsaid-mouth-${id}` : ''}
            x="182"
            y="327"
            width="148"
            height="46"
            rx="14"
            fill={`url(#${pillGradId})`}
          />

          {/* Playful Pet Bling Star Sparkle */}
          {animated && (
            <path
              className={`unsaid-sparkle-${id}`}
              d="M 406 128 Q 406 154 380 154 Q 406 154 406 180 Q 406 154 432 154 Q 406 154 406 128 Z"
              fill="#ffffff"
              filter="drop-shadow(0 0 6px rgba(255, 255, 255, 0.9))"
            />
          )}
        </g>
      </g>
    </svg>
  );
};
