import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import {useAuth} from '../context/AuthContext';
import TasteProfileBars from '../components/TasteProfileBars';
import {DEFAULT_TASTE_VECTOR, normalizeTasteVector, TasteVector,} from '../utils/tasteVector';
import {
  CoffeeProfilePayload,
  loadLatestCoffeeProfile,
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
} from '../utils/localSave';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function HomeScreen({ navigation }: Props) {
  const { clearSession } = useAuth();
  const [userProfile, setUserProfile] = useState<QuestionnaireResultPayload['profile'] | null>(
    null,
  );
  const [coffeeProfile, setCoffeeProfile] = useState<CoffeeProfilePayload['coffeeProfile'] | null>(
    null,
  );

  const handleScanPress = () => {
    navigation.navigate('CoffeeScanner');
  };

  const handleQuestionnairePress = () => {
    navigation.navigate('CoffeeQuestionnaire');
  };

  const handlePhotoRecipePress = () => {
    navigation.navigate('CoffeePhotoRecipe');
  };

  const handleLogout = async () => {
    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
        },
        {
          feature: 'Auth',
          action: 'logout',
        },
      );

      if (!response.ok) {
        console.warn('[Auth] Logout failed.', response.status);
        return;
      }

      await clearSession();
    } catch (error) {
      console.warn('[Auth] Logout failed.', error);
    }
  };

  const loadSavedProfiles = useCallback(async () => {
    const [latestQuestionnaire, latestCoffee] = await Promise.all([
      loadLatestQuestionnaireResult(),
      loadLatestCoffeeProfile(),
    ]);
    setUserProfile(latestQuestionnaire?.payload?.profile ?? null);
    setCoffeeProfile(latestCoffee?.payload?.coffeeProfile ?? null);
  }, []);

  useEffect(() => {
    loadSavedProfiles();
    return navigation.addListener('focus', loadSavedProfiles);
  }, [loadSavedProfiles, navigation]);

  const userVector = useMemo<TasteVector>(
    () => normalizeTasteVector(userProfile?.tasteVector ?? DEFAULT_TASTE_VECTOR),
    [userProfile],
  );

  const matchScore = useMemo(() => {
    if (!userProfile?.tasteVector || !coffeeProfile?.tasteVector) {
      return null;
    }

    const user = normalizeTasteVector(userProfile.tasteVector);
    const coffee = normalizeTasteVector(coffeeProfile.tasteVector);
    type TasteAxis = Exclude<keyof TasteVector, 'confidence'>;
    const axes: TasteAxis[] = [
      'acidity',
      'sweetness',
      'bitterness',
      'body',
      'fruity',
      'roast',
    ];
    const avgDiff =
      axes.reduce((sum, key) => sum + Math.abs(user[key] - coffee[key]), 0)
      / axes.length;
    return Math.round(100 - avgDiff);
  }, [coffeeProfile?.tasteVector, userProfile?.tasteVector]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>BrewMate</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tvoj chuťový profil</Text>
          {!userProfile ? (
            <Text style={styles.placeholder}>
              Vyplňte dotazník, aby sme nastavili váš chuťový profil.
            </Text>
          ) : null}
          <TasteProfileBars vector={userVector} />
          {matchScore !== null ? (
            <Text style={styles.matchScore}>Zhoda: {matchScore}%</Text>
          ) : null}
        </View>

        <Pressable style={styles.button} onPress={handleScanPress}>
          <Text style={styles.buttonText}>Scan Coffee</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handlePhotoRecipePress}>
          <Text style={styles.buttonText}>Foto recept</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleQuestionnairePress}>
          <Text style={styles.buttonText}>Chuťový dotazník</Text>
        </Pressable>
        <Pressable style={styles.buttonOutline} onPress={handleLogout}>
          <Text style={styles.buttonOutlineText}>Odhlásiť sa</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  placeholder: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
  },
  matchScore: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f6f5b',
  },
  button: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    borderColor: '#1f6f5b',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonOutlineText: {
    color: '#1f6f5b',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
