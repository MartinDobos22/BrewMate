import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

const SECTION_LABELS = {
  profileSummary: 'Profil chutí',
  recommendedStyle: 'Odporúčaný štýl kávy',
  recommendedOrigins: 'Odporúčaný pôvod',
  brewingTips: 'Tipy na prípravu',
};

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeeQuestionnaireResult'>;

function CoffeeQuestionnaireResultScreen({ route }: Props) {
  const { answers, profile } = route.params;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Výsledok dotazníka</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI odporúčanie</Text>
          {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(
            (key) => (
              <View key={key} style={styles.profileBlock}>
                <Text style={styles.profileLabel}>{SECTION_LABELS[key]}</Text>
                <Text style={styles.profileText}>{profile[key]}</Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vaše odpovede</Text>
          {answers.map((item) => (
            <View key={item.question} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{item.question}</Text>
              <Text style={styles.answerValue}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  profileBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f6f5b',
    marginBottom: 6,
  },
  profileText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  answerRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  answerQuestion: {
    fontWeight: '600',
    marginBottom: 4,
  },
  answerValue: {
    color: '#374151',
  },
});

export default CoffeeQuestionnaireResultScreen;
