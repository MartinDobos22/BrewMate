import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../navigation/types';
import {useAuth} from '../context/AuthContext';
import {useLogout} from '../hooks/useLogout';
import {loadLatestQuestionnaireResult, QuestionnaireResultPayload} from '../utils/localSave';
import TasteProfileBars from '../components/TasteProfileBars';
import {DEFAULT_TASTE_VECTOR, normalizeTasteVector} from '../utils/tasteVector';
import BottomNavBar from '../components/BottomNavBar';
import {MD3Button} from '../components/md3';
import {SparklesIcon} from '../components/icons';
import {useTheme} from '../theme/useTheme';
import {elevation} from '../theme/theme';
import {BOTTOM_NAV_SAFE_PADDING} from '../constants/ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function ProfileScreen({navigation}: Props) {
  const {user} = useAuth();
  const {logout, isLoggingOut} = useLogout();
  const {colors, typescale, shape} = useTheme();
  const [profile, setProfile] = useState<QuestionnaireResultPayload['profile'] | null>(null);

  const loadProfile = useCallback(async () => {
    const latest = await loadLatestQuestionnaireResult();
    setProfile(latest?.payload?.profile ?? null);
  }, []);

  useEffect(() => {
    loadProfile();
    return navigation.addListener('focus', loadProfile);
  }, [loadProfile, navigation]);

  const userVector = normalizeTasteVector(profile?.tasteVector ?? DEFAULT_TASTE_VECTOR);

  const initial = useMemo(() => {
    const fromName = user?.name?.trim().charAt(0);
    if (fromName) return fromName.toUpperCase();
    const fromEmail = user?.email?.trim().charAt(0);
    if (fromEmail) return fromEmail.toUpperCase();
    return '?';
  }, [user?.name, user?.email]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: BOTTOM_NAV_SAFE_PADDING + 24,
        },
        profileCard: {
          borderRadius: shape.extraLarge,
          padding: 24,
          marginBottom: 16,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          ...elevation.level1.shadow,
        },
        avatarCircle: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        avatarText: {
          ...typescale.headlineMedium,
          color: colors.onPrimary,
        },
        userName: {
          ...typescale.headlineSmall,
          color: colors.onPrimaryContainer,
          marginBottom: 4,
        },
        userEmail: {
          ...typescale.bodyMedium,
          color: colors.onPrimaryContainer,
          opacity: 0.78,
        },
        sectionCard: {
          borderRadius: shape.extraLarge,
          padding: 18,
          marginBottom: 14,
          backgroundColor: colors.surfaceContainerLow,
          ...elevation.level1.shadow,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        },
        sectionTitle: {
          ...typescale.titleLarge,
          color: colors.onSurface,
        },
        profileBlock: {
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.large,
          padding: 16,
          marginBottom: 12,
        },
        profileLabel: {
          ...typescale.labelLarge,
          color: colors.primary,
          marginBottom: 6,
        },
        profileText: {
          ...typescale.bodyMedium,
          color: colors.onSurface,
          lineHeight: 22,
        },
        placeholder: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
          lineHeight: 22,
          marginBottom: 12,
        },
        buttonRow: {
          marginTop: 8,
        },
        logoutWrap: {
          marginTop: 4,
        },
      }),
    [colors, shape, typescale],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Používateľ'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <SparklesIcon size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Chuťový profil</Text>
          </View>

          {profile ? (
            <>
              <View style={styles.profileBlock}>
                <Text style={styles.profileLabel}>Profil chutí</Text>
                <Text style={styles.profileText}>{profile.profileSummary}</Text>
              </View>
              <View style={styles.profileBlock}>
                <Text style={styles.profileLabel}>Odporúčaný štýl</Text>
                <Text style={styles.profileText}>{profile.recommendedStyle}</Text>
              </View>
              <TasteProfileBars vector={userVector} />
            </>
          ) : (
            <Text style={styles.placeholder}>
              Ešte nemáš vyplnený chuťový dotazník. Vyplň ho a získaj
              personalizované odporúčania.
            </Text>
          )}

          <View style={styles.buttonRow}>
            <MD3Button
              label={profile ? 'Vyplniť dotazník znova' : 'Vyplniť chuťový dotazník'}
              variant="filled"
              icon={<SparklesIcon size={18} color={colors.onPrimary} />}
              onPress={() => navigation.navigate('CoffeeQuestionnaire')}
            />
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <MD3Button
            label={isLoggingOut ? 'Odhlasujem…' : 'Odhlásiť sa'}
            variant="outlined"
            onPress={logout}
            disabled={isLoggingOut}
            loading={isLoggingOut}
          />
        </View>
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

export default ProfileScreen;
