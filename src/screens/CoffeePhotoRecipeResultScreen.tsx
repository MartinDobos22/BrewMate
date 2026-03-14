import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipeResult'>;

const APPROVAL_THRESHOLD = 70;

function CoffeePhotoRecipeResultScreen({ route, navigation }: Props) {
  const { analysis, selectedPreparation, strengthPreference, recipe, likePrediction } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const canSave = useMemo(() => likePrediction.score >= APPROVAL_THRESHOLD, [likePrediction.score]);

  const handleSaveRecipe = async () => {
    if (!canSave || saveState === 'saving') {
      return;
    }

    try {
      setSaveState('saving');
      setErrorMessage('');

      const response = await apiFetch(
        `${DEFAULT_API_HOST}/api/coffee-recipes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            analysis,
            recipe,
            selectedPreparation,
            strengthPreference,
            likeScore: likePrediction.score,
            approved: true,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nepodarilo sa uložiť recept.');
      }

      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Nepodarilo sa uložiť recept.');
    }
  };

  const scoreColor = likePrediction.score >= APPROVAL_THRESHOLD ? '#4A9B6E' : '#C08B3E';
  const scoreBgColor = likePrediction.score >= APPROVAL_THRESHOLD ? '#E8F5ED' : '#FFF8F0';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Title */}
        <Text style={styles.title}>{recipe.title}</Text>

        {/* AI Prediction Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>AI predikcia chuti</Text>

          <View style={[styles.scoreRow, { backgroundColor: scoreBgColor }]}>
            <Text style={styles.scoreLabel}>Pravdepodobnosť, že ti bude chutiť</Text>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{likePrediction.score}%</Text>
          </View>

          <Text style={styles.predictionVerdict}>{likePrediction.verdict}</Text>
          <Text style={styles.predictionReason}>{likePrediction.reason}</Text>

          {!canSave ? (
            <View style={styles.warningRow}>
              <Text style={styles.warningText}>
                Recept sa dá uložiť až od {APPROVAL_THRESHOLD}%.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Parameters Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Parametre</Text>

          <View style={styles.paramGrid}>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Metóda</Text>
              <Text style={styles.paramValue}>{selectedPreparation}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Sila</Text>
              <Text style={styles.paramValue}>{strengthPreference}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Dávka</Text>
              <Text style={styles.paramValue}>{recipe.dose}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Voda</Text>
              <Text style={styles.paramValue}>{recipe.water}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Mletie</Text>
              <Text style={styles.paramValue}>{recipe.grind}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Teplota</Text>
              <Text style={styles.paramValue}>{recipe.waterTemp}</Text>
            </View>
            <View style={[styles.paramItem, styles.paramItemFull]}>
              <Text style={styles.paramLabel}>Čas</Text>
              <Text style={styles.paramValue}>{recipe.totalTime}</Text>
            </View>
          </View>
        </View>

        {/* Steps Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Postup</Text>
          {recipe.steps.map((step: string, index: number) => (
            <View key={`${step}-${index}`} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Barista Tips Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Barista tipy</Text>
          {recipe.baristaTips.map((tip: string, index: number) => (
            <View key={`${tip}-${index}`} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable
          style={[styles.primaryButton, (!canSave || saveState === 'saving') && styles.buttonDisabled]}
          onPress={handleSaveRecipe}
          disabled={!canSave || saveState === 'saving'}
        >
          <Text style={styles.primaryButtonText}>
            {saveState === 'saving' ? 'Ukladám…' : 'Uložiť recept'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.outlineButton}
          onPress={() => navigation.navigate('CoffeeRecipesSaved')}
        >
          <Text style={styles.outlineButtonText}>Prejsť na Saved Recipes</Text>
        </Pressable>

        {saveState === 'saved' ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>Recept uložený.</Text>
          </View>
        ) : null}

        {saveState === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  // Title
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 14,
  },

  // AI Prediction
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  predictionVerdict: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
    lineHeight: 22,
  },
  predictionReason: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  warningRow: {
    marginTop: 12,
    backgroundColor: '#FFF8F0',
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#C08B3E',
    fontWeight: '600',
  },

  // Parameters grid
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    minWidth: '47%',
    flex: 1,
  },
  paramItemFull: {
    flexBasis: '100%',
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  paramValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B7355',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },

  // Tips
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B7355',
    marginTop: 8,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },

  // Primary button
  primaryButton: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // Outline button
  outlineButton: {
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: '#2C2C2C',
    fontWeight: '600',
    fontSize: 15,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  // Success / Error banners
  successBox: {
    backgroundColor: '#E8F5ED',
    borderRadius: 12,
    padding: 14,
  },
  successText: {
    color: '#4A9B6E',
    fontWeight: '600',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#FDF2F2',
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    color: '#D64545',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default CoffeePhotoRecipeResultScreen;
