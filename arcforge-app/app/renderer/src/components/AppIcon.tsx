/**
 * App logo (stylized "A") as inline SVG with fill="currentColor"
 * so it adapts to theme: light icon on dark background, dark icon on light background.
 */

import React from 'react';

/** Arcforge "A" icon — same shape as app/renderer/public/icon.svg */
const IconPath = () => (
  <path
    fill="currentColor"
    d="M2924 4964 c-21 -15 -193 -143 -381 -286 l-342 -259 -44 -82 c-25 -45 -127 -239 -227 -432 -101 -192 -204 -390 -230 -440 -26 -49 -96 -182 -155 -295 -59 -113 -150 -286 -203 -385 -52 -99 -114 -216 -137 -260 -23 -44 -115 -218 -204 -387 -129 -245 -160 -312 -155 -332 4 -19 72 -73 263 -211 141 -102 339 -246 441 -320 102 -75 195 -138 208 -141 12 -4 33 -3 47 0 19 5 266 186 570 418 28 22 221 168 430 325 209 158 395 298 413 312 24 19 32 33 30 51 l-3 25 -542 5 c-298 3 -544 8 -548 12 -7 6 239 474 585 1118 76 140 153 287 173 325 74 148 92 149 168 7 29 -53 66 -124 84 -157 18 -33 95 -177 172 -320 78 -143 206 -381 286 -530 79 -148 254 -472 387 -720 134 -247 276 -511 316 -585 40 -74 84 -144 99 -155 39 -30 15 -45 557 373 177 136 178 137 178 169 0 21 -151 313 -752 1453 -131 249 -319 607 -504 960 -50 96 -105 189 -121 205 -28 29 -684 527 -727 552 -36 21 -90 15 -132 -13z"
  />
);

export interface AppIconProps {
  /** Size in pixels (width and height). */
  size?: number;
  /** Extra class for color/placement (e.g. arcforge-titlebar-icon, arcforge-welcome-logo). */
  className?: string;
  /** Accessible label (empty for decorative). */
  'aria-label'?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  size = 24,
  className,
  'aria-label': ariaLabel,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 600 600"
    preserveAspectRatio="xMidYMid meet"
    className={className}
    aria-hidden={!ariaLabel}
    aria-label={ariaLabel}
    role={ariaLabel ? 'img' : undefined}
  >
    <g transform="translate(0,600) scale(0.1,-0.1)">
      <IconPath />
    </g>
  </svg>
);
