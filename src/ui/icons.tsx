/**
 * Drawn icon set — one consistent 1.5px stroke on a 16-unit grid.
 * No emoji, no unicode glyphs standing in for icons.
 */

import type { ReactNode } from 'react';

type P = { size?: number; className?: string };

function Svg({ size = 15, className, children }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M5 3.5 12 8l-7 4.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPause = (p: P) => (
  <Svg {...p}>
    <rect x="4.5" y="3.5" width="2.4" height="9" rx="0.3" fill="currentColor" stroke="none" />
    <rect x="9.1" y="3.5" width="2.4" height="9" rx="0.3" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconReset = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 8a4.5 4.5 0 1 1-1.4-3.25" />
    <path d="M12.6 2.3v2.7h-2.7" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.2 14.5 13.3H1.5z" />
    <path d="M8 6.4v3" />
    <circle cx="8" cy="11.2" r="0.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconClear = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M3 8.5 6.5 12 13 4.5" />
  </Svg>
);

export const IconVehicle = (p: P) => (
  <Svg {...p}>
    <rect x="2.2" y="6" width="11.6" height="4.5" rx="1" />
    <path d="M4.5 6l1-2.2h5l1 2.2" />
    <circle cx="5" cy="11" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="11" cy="11" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconNode = (p: P) => (
  <Svg {...p}>
    <circle cx="3.2" cy="8" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12.8" cy="4" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12.8" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <path d="M4.4 7.4 11.6 4.4M4.4 8.6l7.2 3" />
  </Svg>
);
