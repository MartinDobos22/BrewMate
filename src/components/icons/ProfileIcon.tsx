import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function ProfileIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8.5"
        r="4"
        stroke={color as string}
        strokeWidth={strokeWidth}
        fill={filled ? (color as string) : 'none'}
      />
      <Path
        d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
