import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function CoffeeBeanIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5c4 0 7 3.5 7 8.5s-3 10.5-7 10.5-7-5.5-7-10.5 3-8.5 7-8.5Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        fill={filled ? (color as string) : 'none'}
        strokeLinejoin="round"
      />
      <Path
        d="M9.2 4.8c1.6 2.3 1.6 12.4 3.6 14.4"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
