import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = {
  progress?: number;
  variant?: 'onSurface' | 'onPrimary';
  stageLabel?: string;
  elapsedLabel?: string;
  accessibilityLabel?: string;
};

const INDETERMINATE_FILL_RATIO = 0.4;
const INDETERMINATE_DURATION_MS = 1400;
const ANIMATE_DURATION_MS = 400;

function ProgressIndicatorInner({
  progress,
  variant = 'onSurface',
  stageLabel,
  elapsedLabel,
  accessibilityLabel,
}: Props) {
  const { colors, spacing, shape, typescale } = useTheme();

  const fillAnim = useRef(new Animated.Value(progress ?? 0)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  const isIndeterminate = progress === undefined;

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(prev => (prev === w ? prev : w));
  }, []);

  useEffect(() => {
    if (!isIndeterminate) {
      Animated.timing(fillAnim, {
        toValue: progress,
        duration: ANIMATE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [isIndeterminate, progress, fillAnim]);

  // Runs on the UI thread — not blocked by JS-heavy API calls.
  useEffect(() => {
    if (!isIndeterminate || trackWidth === 0) return;

    indeterminateAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(indeterminateAnim, {
        toValue: 1,
        duration: INDETERMINATE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isIndeterminate, indeterminateAnim, trackWidth]);

  const onPrimary = variant === 'onPrimary';

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignSelf: 'stretch',
          gap: spacing.xs,
        },
        track: {
          height: spacing.md,
          borderRadius: shape.full,
          overflow: 'hidden',
          backgroundColor: onPrimary ? 'transparent' : colors.primaryContainer,
        },
        trackOnPrimaryBg: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onPrimary,
          opacity: 0.24,
        },
        fillDetermined: {
          height: '100%',
          borderRadius: shape.full,
          backgroundColor: onPrimary ? colors.onPrimary : colors.primary,
        },
        indeterminateTrackInner: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: `${INDETERMINATE_FILL_RATIO * 100}%`,
          borderRadius: shape.full,
          backgroundColor: onPrimary ? colors.onPrimary : colors.primary,
        },
        metaRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        stageText: {
          ...typescale.bodySmall,
          color: onPrimary ? colors.onPrimary : colors.onSurfaceVariant,
        },
        elapsedText: {
          ...typescale.labelSmall,
          color: onPrimary ? colors.onPrimary : colors.onSurfaceVariant,
        },
      }),
    [colors, spacing, shape, typescale, onPrimary],
  );

  const fillWidthStyle = isIndeterminate
    ? undefined
    : {
        width: fillAnim.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%'],
        }),
      };

  const indeterminateTranslateX =
    isIndeterminate && trackWidth > 0
      ? indeterminateAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-(trackWidth * INDETERMINATE_FILL_RATIO), trackWidth],
        })
      : undefined;

  const hasMetaRow = stageLabel != null || elapsedLabel != null;

  return (
    <View
      style={s.container}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={
        isIndeterminate ? undefined : { min: 0, max: 100, now: progress }
      }
    >
      <View style={s.track} onLayout={onTrackLayout}>
        {onPrimary ? <View style={s.trackOnPrimaryBg} /> : null}
        {isIndeterminate ? (
          indeterminateTranslateX != null ? (
            <Animated.View
              style={[
                s.indeterminateTrackInner,
                { transform: [{ translateX: indeterminateTranslateX }] },
              ]}
            />
          ) : null
        ) : (
          <Animated.View style={[s.fillDetermined, fillWidthStyle]} />
        )}
      </View>

      {hasMetaRow ? (
        <View style={s.metaRow}>
          {stageLabel != null ? (
            <Text style={s.stageText}>{stageLabel}</Text>
          ) : null}
          {elapsedLabel != null ? (
            <Text style={s.elapsedText}>{elapsedLabel}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const ProgressIndicator = React.memo(ProgressIndicatorInner);
