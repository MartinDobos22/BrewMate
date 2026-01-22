import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { saveCoffeeProfile } from '../utils/localSave';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

function OcrResultScreen({ route }: Props) {
  const { rawText, correctedText, coffeeProfile } = route.params;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = useCallback(async () => {
    try {
      setSaveState('saving');
      await saveCoffeeProfile({ rawText, correctedText, coffeeProfile });
      setSaveState('saved');
    } catch (error) {
      console.error('[OcrResult] Failed to save locally', error);
      setSaveState('error');
    }
  }, [coffeeProfile, correctedText, rawText]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Výsledok OCR</Text>

        <View style={styles.saveRow}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              saveState === 'saving' && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saveState === 'saving'}
          >
            <Text style={styles.saveButtonText}>
              {saveState === 'saving' ? 'Ukladám...' : 'Uložiť lokálne'}
            </Text>
          </Pressable>
          {saveState === 'saved' ? (
            <Text style={styles.saveHint}>Uložené do zariadenia.</Text>
          ) : null}
          {saveState === 'error' ? (
            <Text style={styles.saveError}>Uloženie zlyhalo.</Text>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Oskenovaný text</Text>
          <Text style={styles.text}>{rawText}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Opravený text</Text>
          <Text style={styles.text}>{correctedText}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Chuťový profil</Text>
          <Text style={styles.profileTitle}>Chuťové tóny</Text>
          <Text style={styles.text}>
            {coffeeProfile.flavorNotes.length > 0
              ? coffeeProfile.flavorNotes.join(', ')
              : 'Neurčené'}
          </Text>
          <Text style={styles.profileTitle}>Profil chuti</Text>
          <Text style={styles.text}>{coffeeProfile.tasteProfile}</Text>
          <Text style={styles.profileTitle}>Odborný popis</Text>
          <Text style={styles.text}>{coffeeProfile.expertSummary}</Text>
          <Text style={styles.profileTitle}>Popis pre laika</Text>
          <Text style={styles.text}>{coffeeProfile.laymanSummary}</Text>
          <Text style={styles.profileTitle}>Komu bude chutiť</Text>
          <Text style={styles.text}>{coffeeProfile.preferenceHint}</Text>
          <Text style={styles.profileTitle}>Prečo tieto tóny</Text>
          <Text style={styles.text}>{coffeeProfile.reasoning}</Text>
          <Text style={styles.profileTitle}>Istota</Text>
          <Text style={styles.text}>
            {Math.round(coffeeProfile.confidence * 100)}%
          </Text>
          {coffeeProfile.missingInfo?.length ? (
            <>
              <Text style={styles.profileTitle}>Chýbajúce informácie</Text>
              <Text style={styles.text}>
                {coffeeProfile.missingInfo.join(', ')}
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  saveRow: {
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  saveHint: {
    marginTop: 8,
    color: '#14532d',
    fontWeight: '600',
  },
  saveError: {
    marginTop: 8,
    color: '#b91c1c',
    fontWeight: '600',
  },
  block: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    color: '#1f6f5b',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2b2b2b',
  },
});

export default OcrResultScreen;
