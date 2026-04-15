import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

type StepStatus = 'completed' | 'active' | 'upcoming';

type Step = {
  label: string;
  status: StepStatus;
};

type Props = {
  steps: Step[];
};

function StepIndicator({ steps }: Props) {
  const { colors, typescale, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.sm,
          gap: 0,
        },
        stepGroup: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        circle: {
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        circleCompleted: {
          backgroundColor: colors.primary,
        },
        circleActive: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.primary,
        },
        circleUpcoming: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        circleText: {
          ...typescale.labelSmall,
          fontWeight: '700',
        },
        circleTextCompleted: {
          color: colors.onPrimary,
        },
        circleTextActive: {
          color: colors.primary,
        },
        circleTextUpcoming: {
          color: colors.outlineVariant,
        },
        label: {
          ...typescale.labelSmall,
          marginLeft: 4,
          marginRight: 2,
        },
        labelCompleted: {
          color: colors.primary,
          fontWeight: '600',
        },
        labelActive: {
          color: colors.onSurface,
          fontWeight: '600',
        },
        labelUpcoming: {
          color: colors.outlineVariant,
        },
        connector: {
          width: 16,
          height: 1,
          marginHorizontal: 2,
        },
        connectorCompleted: {
          backgroundColor: colors.primary,
        },
        connectorUpcoming: {
          backgroundColor: colors.outlineVariant,
        },
      }),
    [colors, typescale, spacing],
  );

  return (
    <View style={s.container}>
      {steps.map((step, index) => {
        const circleStyle = [
          s.circle,
          step.status === 'completed' && s.circleCompleted,
          step.status === 'active' && s.circleActive,
          step.status === 'upcoming' && s.circleUpcoming,
        ];
        const textStyle = [
          s.circleText,
          step.status === 'completed' && s.circleTextCompleted,
          step.status === 'active' && s.circleTextActive,
          step.status === 'upcoming' && s.circleTextUpcoming,
        ];
        const labelStyle = [
          s.label,
          step.status === 'completed' && s.labelCompleted,
          step.status === 'active' && s.labelActive,
          step.status === 'upcoming' && s.labelUpcoming,
        ];

        return (
          <View key={step.label} style={s.stepGroup}>
            {index > 0 ? (
              <View
                style={[
                  s.connector,
                  step.status === 'upcoming'
                    ? s.connectorUpcoming
                    : s.connectorCompleted,
                ]}
              />
            ) : null}
            <View style={circleStyle}>
              <Text style={textStyle}>
                {step.status === 'completed' ? '\u2713' : index + 1}
              </Text>
            </View>
            <Text style={labelStyle}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(StepIndicator);
