import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  Divider,
  useTheme,
  Appbar,
  ActivityIndicator,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import TasteProfileBars from '../components/TasteProfileBars';
import {
  DEFAULT_TASTE_VECTOR,
  normalizeTasteVector,
  TasteVector,
} from '../utils/tasteVector';
import {
  loadLatestCoffeeProfile,
  loadLatestQuestionnaireResult,
  QuestionnaireResultPayload,
  CoffeeProfilePayload,
} from '../utils/localSave';
import spacing from '../styles/spacing';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

function ProfileHomeScreen({ navigation }: Props) {
  const { clearSession } = useAuth();
  const theme = useTheme<MD3Theme>();

  const [userProfile, setUserProfile] = useState<QuestionnaireResultPayload['profile'] | null>(
    null,
  );
  const [coffeeProfile, setCoffeeProfile] = useState<CoffeeProfilePayload['coffeeProfile'] | null>(
    null,
  );
  const [logoutLoading, setLogoutLoading] = useState(false);

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

  const handleQuestionnairePress = () => {
    navigation.navigate('CoffeeQuestionnaire');
  };

  const handleJournalPress = () => {
    navigation.navigate('CoffeeJournal');
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
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
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header
        style={{ backgroundColor: theme.colors.background }}
        elevated={false}
      >
        <Appbar.Content title="Profil" titleStyle={{ color: theme.colors.onSurface }} />
      </Appbar.Header>

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Taste Profile Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Tvoj chuťový profil
            </Text>

            {!userProfile ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Vyplňte dotazník, aby sme nastavili váš chuťový profil.
              </Text>
            ) : null}

            <TasteProfileBars vector={userVector} />

            {matchScore !== null ? (
              <Text variant="titleSmall" style={[styles.matchScore, { color: theme.colors.primary }]}>
                Zhoda s aktuálnou kávou: {matchScore}%
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        {/* Navigation Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Možnosti
            </Text>

            <Button
              mode="contained"
              onPress={handleQuestionnairePress}
              style={styles.navButton}
              contentStyle={styles.navButtonContent}
              icon="clipboard-list-outline"
            >
              Chuťový dotazník
            </Button>

            <Button
              mode="contained-tonal"
              onPress={handleJournalPress}
              style={styles.navButton}
              contentStyle={styles.navButtonContent}
              icon="book-open-variant"
            >
              Kávovar denník
            </Button>
          </Card.Content>
        </Card>

        {/* Account Section */}
        <Card mode="elevated" elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Účet
            </Text>

            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              onPress={handleLogout}
              loading={logoutLoading}
              disabled={logoutLoading}
              style={[styles.logoutButton, { borderColor: theme.colors.error }]}
              contentStyle={styles.navButtonContent}
              textColor={theme.colors.error}
              icon="logout"
            >
              Odhlásiť sa
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sectionCard: {
    borderRadius: spacing.lg,
  },
  cardContent: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  matchScore: {
    marginTop: spacing.sm,
  },
  navButton: {
    borderRadius: spacing.md,
  },
  navButtonContent: {
    paddingVertical: spacing.sm,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  logoutButton: {
    borderRadius: spacing.md,
  },
});

export default ProfileHomeScreen;
