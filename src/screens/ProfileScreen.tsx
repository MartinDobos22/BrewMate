import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useAuth} from '../context/AuthContext';
import {apiFetch, DEFAULT_API_HOST} from '../utils/api';
import {loadLatestQuestionnaireResult, QuestionnaireResultPayload} from '../utils/localSave';
import TasteProfileBars from '../components/TasteProfileBars';
import {DEFAULT_TASTE_VECTOR, normalizeTasteVector} from '../utils/tasteVector';
import BottomNavBar from '../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function ProfileScreen({navigation}: Props) {
  const {user, clearSession} = useAuth();
  const [profile, setProfile] = useState<QuestionnaireResultPayload['profile'] | null>(null);

  const loadProfile = useCallback(async () => {
    const latest = await loadLatestQuestionnaireResult();
    setProfile(latest?.payload?.profile ?? null);
  }, []);

  useEffect(() => {
    loadProfile();
    return navigation.addListener('focus', loadProfile);
  }, [loadProfile, navigation]);

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

  const userVector = normalizeTasteVector(profile?.tasteVector ?? DEFAULT_TASTE_VECTOR);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'Používateľ'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
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
              Ešte nemáš vyplnený chuťový dotazník. Vyplň ho a získaj personalizované odporúčania.
            </Text>
          )}

          <Pressable
            style={styles.questionnaireButton}
            onPress={() => navigation.navigate('CoffeeQuestionnaire')}>
            <Text style={styles.questionnaireButtonText}>
              {profile ? 'Vyplniť dotazník znova' : 'Vyplniť chuťový dotazník'}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Odhlásiť sa</Text>
        </Pressable>
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F1EB',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 106,
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    backgroundColor: '#EEDFCF',
    borderWidth: 1,
    borderColor: '#D7C2AB',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6B4F3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#23180E',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6D5D4C',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#FFFBFF',
    borderWidth: 1,
    borderColor: '#E7DCD1',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    color: '#2C1F13',
    fontWeight: '700',
  },
  profileBlock: {
    backgroundColor: '#F5F1EC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDD3C9',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4F3A',
    marginBottom: 6,
  },
  profileText: {
    fontSize: 14,
    color: '#271508',
    lineHeight: 20,
  },
  placeholder: {
    color: '#6A5B50',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  questionnaireButton: {
    marginTop: 8,
    backgroundColor: '#6B4F3A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  questionnaireButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#70523D',
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#70523D',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ProfileScreen;
