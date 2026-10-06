import React, { useId } from 'react';

/**
 * Official UNSAID App Icon Logo Mark
 * Minimal, geometric brand mark featuring:
 * - Playful dancing effect (rhythmic groove, step bobs, and joyful hop)
 * - Cheerful curving smile transformation with happy smiling eyes (^ _ ^)
 * - Slower, relaxed, cushioned organic pet eye blinks
 * - Sparkling "bling" star sparkles
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
            /* 1. DANCING EFFECT: Rhythmic groove, step & bob, shimmy, and joyful hop (6s loop) */
            @keyframes unsaid-pet-dance-body-${id} {
              /* Beat 1: Step & bob left */
              0% { transform: translateY(0) rotate(0deg) scale(1); }
              6% { transform: translateY(-7px) rotate(-4.5deg) scale(1.02); }
              12% { transform: translateY(2px) rotate(-1deg) scale(1.01, 0.98); }

              /* Beat 2: Step & bob right */
              18% { transform: translateY(-7px) rotate(4.5deg) scale(1.02); }
              24% { transform: translateY(2px) rotate(1deg) scale(1.01, 0.98); }

              /* Beat 3: Playful shimmy wiggle */
              30% { transform: translateY(-4px) rotate(-3deg); }
              34% { transform: translateY(-4px) rotate(3deg); }
              38% { transform: translateY(-4px) rotate(-2deg); }
              42% { transform: translateY(1px) rotate(0deg); }

              /* Beat 4: THE BIG JOYFUL DANCE HOP & SMILE! */
              48% { transform: translateY(-12px) rotate(0deg) scale(1.05, 1.05); }
              54% { transform: translateY(-14px) rotate(-1.5deg) scale(1.06, 1.06); }
              60% { transform: translateY(-10px) rotate(1.5deg) scale(1.05, 1.05); }
              66% { transform: translateY(3px) rotate(0deg) scale(1.02, 0.96); } /* cushioned landing */
              72% { transform: translateY(-2px) scale(1.01); } /* gentle rebound */
              76% { transform: translateY(0) scale(1); }

              /* Calm rest, idle respiration & slow blink */
              84% { transform: translateY(-2px) rotate(0.5deg); }
              90% { transform: translateY(1px) scale(0.99, 1.01); }
              96% { transform: translateY(-1px) rotate(-0.5deg); }
              100% { transform: translateY(0) rotate(0deg) scale(1); }
            }

            /* 2. EYES: Dancing expression, joyful smiling squint (^ ^), and relaxed smooth blink */
            @keyframes unsaid-pet-eyes-${id} {
              0%, 44% { transform: scaleY(1) translateY(0); }

              /* Smiling squint during the big dance hop (48% - 65%) */
              48% { transform: scaleY(0.35) translateY(-8px); }
              54% { transform: scaleY(0.28) translateY(-10px); }
              60% { transform: scaleY(0.35) translateY(-8px); }
              66% { transform: scaleY(1) translateY(0); }

              /* Smooth, slow, cushioned natural blink at 88% - 94% */
              84% { transform: scaleY(1); }
              88% { transform: scaleY(0.08); } /* smooth cushioned close */
              91% { transform: scaleY(1); }    /* smooth reopen */
              93% { transform: scaleY(0.22); } /* soft flutter */
              95% { transform: scaleY(1.04); }
              98%, 100% { transform: scaleY(1); }
            }

            /* 3. MOUTH: Transforms smoothly into a BIG HAPPY CURVED SMILE during the dance! */
            @keyframes unsaid-pet-mouth-neutral-${id} {
              0%, 44% { opacity: 1; transform: scale(1); }
              47%, 65% { opacity: 0; transform: scale(0.6) translateY(-5px); }
              68%, 100% { opacity: 1; transform: scale(1); }
            }

            @keyframes unsaid-pet-mouth-smile-${id} {
              0%, 45% { opacity: 0; transform: scale(0.6) translateY(8px); }
              48% { opacity: 1; transform: scale(1) translateY(0); }
              54% { opacity: 1; transform: scale(1.08) translateY(-2px); } /* big beaming smile */
              62% { opacity: 1; transform: scale(1.04) translateY(-1px); }
              66% { opacity: 0; transform: scale(0.8) translateY(6px); }
              68%, 100% { opacity: 0; }
            }

            /* 4. CELEBRATION SPARKLES / BLING */
            @keyframes unsaid-pet-bling-top-${id} {
              0%, 46% { opacity: 0; transform: scale(0) rotate(0deg); }
              50% { opacity: 1; transform: scale(1.3) rotate(45deg); }
              56% { opacity: 1; transform: scale(1) rotate(90deg); }
              62% { opacity: 0.9; transform: scale(0.7) rotate(135deg); }
              66%, 100% { opacity: 0; transform: scale(0) rotate(180deg); }
            }

            @keyframes unsaid-pet-bling-cheek-${id} {
              0%, 48% { opacity: 0; transform: scale(0); }
              52% { opacity: 0.85; transform: scale(1); }
              58% { opacity: 0.85; transform: scale(0.9); }
              64%, 100% { opacity: 0; transform: scale(0); }
            }

            .unsaid-dance-body-${id} {
              transform-origin: 256px 256px;
              animation: unsaid-pet-dance-body-${id} 6s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
              transition: transform 0.3s ease;
            }

            .unsaid-dance-body-${id}:hover {
              transform: translateY(-4px) scale(1.06);
            }

            .unsaid-eye-left-${id},
            .unsaid-eye-right-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-eyes-${id} 6s infinite ease-in-out;
            }

            .unsaid-mouth-neutral-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-mouth-neutral-${id} 6s infinite ease-in-out;
            }

            .unsaid-mouth-smile-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-mouth-smile-${id} 6s infinite cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .unsaid-sparkle-top-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-top-${id} 6s infinite ease-out;
            }

            .unsaid-sparkle-cheek-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-cheek-${id} 6s infinite ease-out;
            }
          `}</style>
        )}
      </defs>

      {/* Dancing Pet Body */}
      <g className={animated ? `unsaid-dance-body-${id}` : ''}>
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

          {/* Neutral Mouth Capsule (visible when calm) */}
          <rect
            className={animated ? `unsaid-mouth-neutral-${id}` : ''}
            x="182"
            y="327"
            width="148"
            height="46"
            rx="14"
            fill={`url(#${pillGradId})`}
          />

          {/* Joyful Beaming Smile Arc (appears during the happy dancing hop!) */}
          {animated && (
            <path
              className={`unsaid-mouth-smile-${id}`}
              d="M 184 332 Q 256 394 328 332"
              fill="none"
              stroke={`url(#${pillGradId})`}
              strokeWidth="38"
              strokeLinecap="round"
            />
          )}

          {/* Top Celebration Star Sparkle */}
          {animated && (
            <path
              className={`unsaid-sparkle-top-${id}`}
              d="M 406 120 Q 406 148 378 148 Q 406 148 406 176 Q 406 148 434 148 Q 406 148 406 120 Z"
              fill="#ffffff"
              filter="drop-shadow(0 0 8px rgba(255, 255, 255, 0.95))"
            />
          )}

          {/* Cheerful Cheek Glow Sparkle */}
          {animated && (
            <path
              className={`unsaid-sparkle-cheek-${id}`}
              d="M 106 348 Q 106 362 92 362 Q 106 362 106 376 Q 106 362 120 362 Q 106 362 106 348 Z"
              fill="#ffffff"
              filter="drop-shadow(0 0 6px rgba(255, 255, 255, 0.85))"
            />
          )}
        </g>
      </g>
    </svg>
  );
};
