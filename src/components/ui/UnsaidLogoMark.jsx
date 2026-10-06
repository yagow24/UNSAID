import React from 'react';

/**
 * Official UNSAID App Icon Logo Mark
 * Minimal, geometric brand mark featuring the signature two vertical capsules
 * and centered horizontal pill on the vibrant UNSAID gradient canvas.
 */
export const UnsaidLogoMark = ({
  size,
  className = '',
  showShadow = true,
  alt = 'UNSAID',
}) => {
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
        <linearGradient id="unsaid-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ea8fc" />
          <stop offset="25%" stopColor="#6582fd" />
          <stop offset="60%" stopColor="#9a71f9" />
          <stop offset="100%" stopColor="#e696f8" />
        </linearGradient>

        <filter id="unsaid-logo-depth" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#190e4a" floodOpacity="0.24" />
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#24155b" floodOpacity="0.18" />
        </filter>

        <linearGradient id="unsaid-logo-pill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f5f4fc" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#unsaid-logo-bg)" />

      <g filter="url(#unsaid-logo-depth)">
        {/* Left Vertical Capsule */}
        <rect x="106" y="138" width="56" height="198" rx="16" fill="url(#unsaid-logo-pill)" />
        {/* Right Vertical Capsule */}
        <rect x="350" y="138" width="56" height="198" rx="16" fill="url(#unsaid-logo-pill)" />
        {/* Center Horizontal Capsule */}
        <rect x="182" y="327" width="148" height="46" rx="14" fill="url(#unsaid-logo-pill)" />
      </g>
    </svg>
  );
};
