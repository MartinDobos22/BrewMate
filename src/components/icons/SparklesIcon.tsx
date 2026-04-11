import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function SparklesIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Big sparkle */}
      <Path
        d="M12 3v3M12 13v3M6.5 9.5H9M15 9.5h2.5M8 5.5 9.5 7M14.5 12 16 13.5M8 13.5 9.5 12M14.5 7 16 5.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Small sparkle bottom-right */}
      <Path
        d="M17 16v2M16 17h2"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Tiny sparkle bottom-left */}
      <Path
        d="M6 19v1.5M5.25 19.75h1.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
