import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DEFAULT_API_HOST } from '../utils/api';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function HomeScreen({ navigation }: Props) {
  const { clearSession } = useAuth();

  const handleScanPress = () => {
    navigation.navigate('CoffeeScanner');
  };

  const handleQuestionnairePress = () => {
    navigation.navigate('CoffeeQuestionnaire');
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${DEFAULT_API_HOST}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('[Auth] Logout failed.', response.status);
        return;
      }

      await clearSession();
    } catch (error) {
      console.warn('[Auth] Logout failed.', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>BrewMate</Text>
        <Pressable style={styles.button} onPress={handleScanPress}>
          <Text style={styles.buttonText}>Scan Coffee</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleQuestionnairePress}>
          <Text style={styles.buttonText}>Chuťový dotazník</Text>
        </Pressable>
        <Pressable style={styles.buttonOutline} onPress={handleLogout}>
          <Text style={styles.buttonOutlineText}>Odhlásiť sa</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
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
