import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './IconProps';

export default function PlusIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2.5,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
