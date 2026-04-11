import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function ArrowRightIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M13 5l7 7-7 7"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
