import React from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type IconProps = {
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  filled?: boolean;
};

export function CoffeeBeanIcon({
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

export function CoffeeCupIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
      <Path
        d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M3 21h15"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PortafilterIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="10"
        cy="10"
        r="5.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M15.2 11.8 21 17.5a1.5 1.5 0 0 1-2 2l-5.7-5.7"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function ScanIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8V5a2 2 0 0 1 2-2h3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 3h3a2 2 0 0 1 2 2v3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 16v3a2 2 0 0 1-2 2h-3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 21H5a2 2 0 0 1-2-2v-3"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="12"
        r="2.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function SparklesIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v3M12 13v3M6.5 9.5H9M15 9.5h2.5M8 5.5 9.5 7M14.5 12 16 13.5M8 13.5 9.5 12M14.5 7 16 5.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M17 16v2M16 17h2"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M6 19v1.5M5.25 19.75h1.5"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LeafIcon({
  size = 24,
  color = '#4A6B4C',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 4c0 9-6 16-15 16 0-9 6-16 15-16Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
      <Path
        d="M20 4 7 17"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FlameIcon({
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

export function HomeIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
  filled = false,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11.5 12 4l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-8.5Z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? (color as string) : 'none'}
      />
      <Path
        d="M9.5 21.5v-6h5v6"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ProfileIcon({
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

export function ArrowRightIcon({
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

export function PlusIcon({
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

export function WarningIcon({
  size = 24,
  color = '#6B4F3A',
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={color as string}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
