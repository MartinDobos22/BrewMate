import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function ScanIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Corner brackets */}
      <Path
        d="M3 8V5a2 2 0 0 1 2-2h3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 3h3a2 2 0 0 1 2 2v3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 16v3a2 2 0 0 1-2 2h-3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 21H5a2 2 0 0 1-2-2v-3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center viewfinder dot */}
      <Circle
        cx="12"
        cy="12"
        r="2.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
