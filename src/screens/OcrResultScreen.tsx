import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

function OcrResultScreen({ route }: Props) {
  const { rawText, correctedText, coffeeProfile } = route.params;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Výsledok OCR</Text>

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
