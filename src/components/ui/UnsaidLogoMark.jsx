import React, { useId } from 'react';

/**
 * Official UNSAID App Icon Logo Mark
 * Minimal, geometric brand mark featuring the signature two vertical capsules (eyes)
 * and centered horizontal pill (mouth) with an organic pet blink & sparkle "bling" animation.
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
            @keyframes unsaid-pet-blink-${id} {
              0%, 86%, 100% {
                transform: scaleY(1);
              }
              89% {
                transform: scaleY(0.08);
              }
              92% {
                transform: scaleY(1);
              }
              94% {
                transform: scaleY(0.12);
              }
              96.5% {
                transform: scaleY(1);
              }
            }

            @keyframes unsaid-pet-bling-${id} {
              0%, 92% {
                opacity: 0;
                transform: scale(0) rotate(0deg);
              }
              95% {
                opacity: 1;
                transform: scale(1.2) rotate(45deg);
              }
              97.5% {
                opacity: 0.9;
                transform: scale(0.85) rotate(90deg);
              }
              100% {
                opacity: 0;
                transform: scale(0) rotate(135deg);
              }
            }

            .unsaid-eye-left-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-blink-${id} 3.8s infinite ease-in-out;
            }

            .unsaid-eye-right-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-blink-${id} 3.8s infinite ease-in-out;
            }

            .unsaid-sparkle-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-${id} 3.8s infinite ease-in-out;
            }
          `}</style>
        )}
      </defs>

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
    </svg>
  );
};
