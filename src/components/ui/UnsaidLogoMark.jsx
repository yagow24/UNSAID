import React, { useId } from 'react';

/**
 * Official UNSAID App Icon Logo Mark
 * Minimal, geometric brand mark featuring:
 * - Dynamic JUMPING & DANCING animation (side-to-side groove steps, deep crouch wind-up, spring jump high into the air, cushion squash landing, and rebound)
 * - Cheerful curving smile transformation with ecstatic happy squinting eyes (^ _ ^)
 * - Celebration star bling sparkles during the high jump
 * - Slower, relaxed, cushioned organic pet eye blinks during rest
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
            /* 1. JUMPING & DANCING ANIMATION: Grooves, crouch anticipation, high spring jump, cushion landing & rebound (4.6s loop) */
            @keyframes unsaid-pet-jump-dance-${id} {
              /* Rest & idle start */
              0% {
                transform: translateY(0px) rotate(0deg) scale(1, 1);
              }

              /* Dance Beat 1: Step left with energetic head-tilt */
              7% {
                transform: translateY(-8px) rotate(-6deg) scale(1.02, 1.02);
              }
              13% {
                transform: translateY(3px) rotate(-1.5deg) scale(1.04, 0.96);
              }

              /* Dance Beat 2: Step right with energetic head-tilt */
              19% {
                transform: translateY(-8px) rotate(6deg) scale(1.02, 1.02);
              }
              25% {
                transform: translateY(3px) rotate(1.5deg) scale(1.04, 0.96);
              }

              /* Deep Crouch Wind-Up (Squash anticipation before the big jump!) */
              32% {
                transform: translateY(8px) rotate(0deg) scale(1.12, 0.86);
              }

              /* THE BIG JUMP: Springs up high with stretch! */
              37% {
                transform: translateY(-28px) rotate(-3deg) scale(0.92, 1.12);
              }
              /* Apex & Mid-Air Hangtime: Joyful float & beaming smile! */
              43% {
                transform: translateY(-44px) rotate(3deg) scale(1.08, 1.06);
              }
              48% {
                transform: translateY(-46px) rotate(-2deg) scale(1.08, 1.06);
              }
              52% {
                transform: translateY(-38px) rotate(1deg) scale(1.04, 1.04);
              }

              /* Impact Landing: Touchdown with juicy cushion squash! */
              57% {
                transform: translateY(8px) rotate(0deg) scale(1.12, 0.88);
              }

              /* Rebound Hop */
              63% {
                transform: translateY(-10px) rotate(-1deg) scale(0.98, 1.04);
              }
              69% {
                transform: translateY(2px) rotate(0deg) scale(1.02, 0.98);
              }
              73% {
                transform: translateY(0px) scale(1, 1);
              }

              /* Playful Wiggle Shimmy */
              78% {
                transform: translateY(-2px) rotate(-3deg);
              }
              82% {
                transform: translateY(-2px) rotate(3deg);
              }
              86% {
                transform: translateY(0px) rotate(0deg);
              }

              /* Calm respiration before next dance jump */
              93% {
                transform: translateY(-1px) rotate(0.5deg);
              }
              100% {
                transform: translateY(0px) rotate(0deg) scale(1, 1);
              }
            }

            /* 2. EYES: Dancing look, joyful squinting smile (^ ^) during high jump, and relaxed blink */
            @keyframes unsaid-pet-eyes-${id} {
              0%, 32% {
                transform: scaleY(1) translateY(0);
              }

              /* Eyes wide with excitement right before launch */
              34% {
                transform: scaleY(1.12) scaleX(1.04);
              }

              /* IN THE AIR (38% - 53%): ECSTATIC SMILE SQUINT! (^ ^) */
              38% {
                transform: scaleY(0.4) translateY(-6px);
              }
              43%, 49% {
                transform: scaleY(0.24) translateY(-10px);
              }
              53% {
                transform: scaleY(0.45) translateY(-4px);
              }

              /* Landing */
              57% {
                transform: scaleY(0.9) translateY(2px);
              }
              63%, 84% {
                transform: scaleY(1) translateY(0);
              }

              /* Smooth natural eyelid blink during rest */
              88% {
                transform: scaleY(0.08);
              }
              91% {
                transform: scaleY(1);
              }
              93% {
                transform: scaleY(0.2);
              }
              95% {
                transform: scaleY(1.04);
              }
              98%, 100% {
                transform: scaleY(1);
              }
            }

            /* 3. MOUTH: Transforms into a BIG CHEERFUL SMILE during the high jump! */
            @keyframes unsaid-pet-mouth-neutral-${id} {
              0%, 35% { opacity: 1; transform: scale(1); }
              38%, 54% { opacity: 0; transform: scale(0.5) translateY(-8px); }
              57%, 100% { opacity: 1; transform: scale(1); }
            }

            @keyframes unsaid-pet-mouth-smile-${id} {
              0%, 36% { opacity: 0; transform: scale(0.5) translateY(12px); }
              39% { opacity: 1; transform: scale(0.9) translateY(2px); }
              43%, 50% { opacity: 1; transform: scale(1.12) translateY(-4px); } /* BIG BEAMING SMILE */
              53% { opacity: 0.8; transform: scale(0.9) translateY(4px); }
              56%, 100% { opacity: 0; transform: scale(0.5) translateY(12px); }
            }

            /* 4. HIGH JUMP CELEBRATION SPARKLES */
            @keyframes unsaid-pet-bling-top-${id} {
              0%, 37% { opacity: 0; transform: scale(0) rotate(0deg); }
              41% { opacity: 1; transform: scale(1.35) rotate(45deg); }
              47% { opacity: 1; transform: scale(1.1) rotate(90deg); }
              53% { opacity: 0.8; transform: scale(0.7) rotate(135deg); }
              57%, 100% { opacity: 0; transform: scale(0) rotate(180deg); }
            }

            @keyframes unsaid-pet-bling-cheek-${id} {
              0%, 39% { opacity: 0; transform: scale(0); }
              43%, 51% { opacity: 0.95; transform: scale(1.1); }
              55% { opacity: 0; transform: scale(0); }
              100% { opacity: 0; }
            }

            .unsaid-jump-body-${id} {
              transform-origin: 256px 256px;
              animation: unsaid-pet-jump-dance-${id} 4.6s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
              transition: transform 0.3s ease;
            }

            .unsaid-jump-body-${id}:hover {
              transform: translateY(-8px) scale(1.08);
            }

            .unsaid-eye-left-${id},
            .unsaid-eye-right-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-eyes-${id} 4.6s infinite ease-in-out;
            }

            .unsaid-mouth-neutral-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-mouth-neutral-${id} 4.6s infinite ease-in-out;
            }

            .unsaid-mouth-smile-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-mouth-smile-${id} 4.6s infinite cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .unsaid-sparkle-top-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-top-${id} 4.6s infinite ease-out;
            }

            .unsaid-sparkle-cheek-${id} {
              transform-box: fill-box;
              transform-origin: 50% 50%;
              animation: unsaid-pet-bling-cheek-${id} 4.6s infinite ease-out;
            }
          `}</style>
        )}
      </defs>

      {/* Jumping & Dancing Pet Body */}
      <g className={animated ? `unsaid-jump-body-${id}` : ''}>
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

          {/* Neutral Mouth Capsule (visible when dancing & resting) */}
          <rect
            className={animated ? `unsaid-mouth-neutral-${id}` : ''}
            x="182"
            y="327"
            width="148"
            height="46"
            rx="14"
            fill={`url(#${pillGradId})`}
          />

          {/* Joyful Beaming Smile Arc (appears during the high jump!) */}
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

          {/* High Jump Celebration Sparkle (Top Right) */}
          {animated && (
            <path
              className={`unsaid-sparkle-top-${id}`}
              d="M 406 120 Q 406 148 378 148 Q 406 148 406 176 Q 406 148 434 148 Q 406 148 406 120 Z"
              fill="#ffffff"
              filter="drop-shadow(0 0 8px rgba(255, 255, 255, 0.95))"
            />
          )}

          {/* High Jump Cheek Glow Sparkle (Left) */}
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
