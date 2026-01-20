import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OcrResult'>;

function OcrResultScreen({ route }: Props) {
  const { rawText, correctedText } = route.params;

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
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2b2b2b',
  },
});

export default OcrResultScreen;
