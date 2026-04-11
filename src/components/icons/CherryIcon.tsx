import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function CherryIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Stem */}
      <Path
        d="M14 4c-2 3-4 5-5 9"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M14 4c2 3 3 5 4 9"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Left cherry */}
      <Circle
        cx="8.5"
        cy="16.5"
        r="4"
        stroke={color as string}
        strokeWidth={strokeWidth}
        fill={filled ? (color as string) : 'none'}
      />
      {/* Right cherry */}
      <Circle
        cx="17"
        cy="16.5"
        r="4"
        stroke={color as string}
        strokeWidth={strokeWidth}
        fill={filled ? (color as string) : 'none'}
      />
    </Svg>
  );
}
