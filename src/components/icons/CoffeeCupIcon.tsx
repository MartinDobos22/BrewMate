import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function CoffeeCupIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Steam */}
      <Path
        d="M8 2c.6 1.2-.6 2-0 3.2"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12 2c.6 1.2-.6 2-0 3.2"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M16 2c.6 1.2-.6 2-0 3.2"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Cup body */}
      <Path
        d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {/* Handle */}
      <Path
        d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Saucer */}
      <Path
        d="M3 21h15"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
