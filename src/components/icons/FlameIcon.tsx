import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function FlameIcon({
  size = 24,
  color = '#B3261E',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5s5.5 5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.5-4.5 1.5-4.5s.5 1.5 2 1.5c0-3 2-5 2-8Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
    </Svg>
  );
}
