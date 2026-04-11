import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function HomeIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11.5 12 4l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-8.5Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
      <Path
        d="M9.5 21.5v-6h5v6"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
