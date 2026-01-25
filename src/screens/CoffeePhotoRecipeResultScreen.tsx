import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CoffeePhotoRecipeResult'>;

function CoffeePhotoRecipeResultScreen({ route }: Props) {
  const {
    analysis,
    selectedPreparation,
    strengthPreference,
    recipe,
  } = route.params;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.subtitle}>
          {selectedPreparation} • {strengthPreference}
        </Text>

        <View style={styles.block}>
          <Text style={styles.label}>Chuťový profil</Text>
          <Text style={styles.text}>
            {analysis.flavorNotes.length
              ? analysis.flavorNotes.join(', ')
              : 'Neurčené'}
          </Text>
          <Text style={styles.text}>{analysis.tasteProfile}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Základné nastavenie</Text>
          <Text style={styles.text}>Dávka: {recipe.dose}</Text>
          <Text style={styles.text}>Voda: {recipe.water}</Text>
          <Text style={styles.text}>Mletie: {recipe.grind}</Text>
          <Text style={styles.text}>Teplota vody: {recipe.waterTemp}</Text>
          <Text style={styles.text}>Celkový čas: {recipe.totalTime}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Postup krok za krokom</Text>
          {recipe.steps.map((step: string, index: number) => (
            <View key={`${step}-${index + 1}`} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Tipy baristu</Text>
          {recipe.baristaTips.map((tip: string, index: number) => (
            <Text key={`${tip}-${index + 1}`} style={styles.text}>
              • {tip}
            </Text>
          ))}
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4a4a4a',
    marginBottom: 16,
  },
  block: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#1f2933',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1f6f5b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2933',
  },
});

export default CoffeePhotoRecipeResultScreen;
