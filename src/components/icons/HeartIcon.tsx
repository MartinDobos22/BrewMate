import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function HeartIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.5s-7.5-4.3-7.5-10.1a4.5 4.5 0 0 1 8-2.9 4.5 4.5 0 0 1 8 2.9c0 5.8-8.5 10.1-8.5 10.1Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
    </Svg>
  );
}
