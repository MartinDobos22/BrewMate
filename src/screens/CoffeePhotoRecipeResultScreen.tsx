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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{recipe.title}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>AI predikcia chuti</Text>
          <Text style={styles.highlight}>Pravdepodobnosť, že ti bude chutiť: {likePrediction.score}%</Text>
          <Text style={styles.text}>{likePrediction.verdict}</Text>
          <Text style={styles.text}>{likePrediction.reason}</Text>
          {!canSave ? (
            <Text style={styles.warning}>Recept sa dá uložiť až od {APPROVAL_THRESHOLD}%.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parametre</Text>
          <Text style={styles.text}>Metóda: {selectedPreparation}</Text>
          <Text style={styles.text}>Sila: {strengthPreference}</Text>
          <Text style={styles.text}>Dávka: {recipe.dose}</Text>
          <Text style={styles.text}>Voda: {recipe.water}</Text>
          <Text style={styles.text}>Mletie: {recipe.grind}</Text>
          <Text style={styles.text}>Teplota: {recipe.waterTemp}</Text>
          <Text style={styles.text}>Čas: {recipe.totalTime}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Postup</Text>
          {recipe.steps.map((step: string, index: number) => (
            <Text key={`${step}-${index}`} style={styles.text}>{index + 1}. {step}</Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Barista tipy</Text>
          {recipe.baristaTips.map((tip: string, index: number) => (
            <Text key={`${tip}-${index}`} style={styles.text}>• {tip}</Text>
          ))}
        </View>

        <Pressable
          style={[styles.primaryButton, (!canSave || saveState === 'saving') && styles.buttonDisabled]}
          onPress={handleSaveRecipe}
          disabled={!canSave || saveState === 'saving'}
        >
          <Text style={styles.primaryButtonText}>{saveState === 'saving' ? 'Ukladám…' : 'Uložiť recept'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('CoffeeRecipesSaved')}>
          <Text style={styles.secondaryButtonText}>Prejsť na Saved Recipes</Text>
        </Pressable>

        {saveState === 'saved' ? <Text style={styles.success}>Recept uložený.</Text> : null}
        {saveState === 'error' ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#3E2F25' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3DED6', borderRadius: 16, padding: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#3E2F25' },
  text: { fontSize: 14, color: '#6F6A64', marginBottom: 4 },
  highlight: { fontWeight: '700', color: '#6B4F3A', marginBottom: 8 },
  warning: { color: '#b45309', fontWeight: '600' },
  primaryButton: { backgroundColor: '#6B4F3A', borderRadius: 16, alignItems: 'center', paddingVertical: 12 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#6B4F3A', borderRadius: 16, alignItems: 'center', paddingVertical: 12 },
  secondaryButtonText: { color: '#6B4F3A', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  success: { color: '#8A9A5B', fontWeight: '600' },
  error: { color: '#B3261E', fontWeight: '600' },
});

export default CoffeePhotoRecipeResultScreen;
