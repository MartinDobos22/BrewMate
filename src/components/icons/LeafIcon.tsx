import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function LeafIcon({
  size = 24,
  color = '#4A6B4C',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4c0 9-6 16-15 16 0-9 6-16 15-16Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
      <Path
        d="M20 4 7 17"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
