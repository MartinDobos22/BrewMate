import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function PortafilterIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Basket */}
      <Circle
        cx="10"
        cy="10"
        r="5.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
      />
      {/* Handle */}
      <Path
        d="M15.2 11.8 21 17.5a1.5 1.5 0 0 1-2 2l-5.7-5.7"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Spout hole */}
      <Circle
        cx="10"
        cy="10"
        r="1.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
