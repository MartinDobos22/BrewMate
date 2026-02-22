import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { signInWithApple, signInWithGoogle } from '../utils/socialAuth';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function LoginScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [didPrefill, setDidPrefill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { refreshSession } = useAuth();

  useEffect(() => {
    if (didPrefill) {
      return;
    }

    const prefillEmail = route.params?.prefillEmail;
    const prefillPassword = route.params?.prefillPassword;

    if (prefillEmail) {
      setEmail(prefillEmail);
    }

    if (prefillPassword) {
      setPassword(prefillPassword);
    }

    if (prefillEmail || prefillPassword) {
      setDidPrefill(true);
    }
  }, [didPrefill, route.params?.prefillEmail, route.params?.prefillPassword]);

  const getBackendErrorMessage = async (response: Response) => {
    try {
      const data = await response.json();
      if (data?.error) {
        return data.error as string;
      }
      if (data?.message) {
        return data.message as string;
      }
    } catch (parseError) {
      console.warn('Failed to parse error response.', parseError);
    }

    return 'Login failed.';
  };

  const handleLogin = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        },
        {
          feature: 'Auth',
          action: 'login',
        },
      );

      if (!response.ok) {
        const message = await getBackendErrorMessage(response);
        setErrorMessage(message);
      } else {
        await refreshSession();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      await signInWithGoogle();
      await refreshSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      await signInWithApple();
      await refreshSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple sign-in failed.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTag}>☕ BrewMate</Text>
          <Text style={styles.title}>Prihlásenie</Text>
          <Text style={styles.subtitle}>Vitaj späť v BrewMate.</Text>
        </View>

        <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Heslo</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Prihlásiť</Text>}
        </Pressable>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>alebo</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={[styles.socialButton, loading && styles.disabledButton]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.socialButtonText}>Pokračovať s Google</Text>
        </Pressable>

        <Pressable
          style={[styles.socialButton, loading && styles.disabledButton]}
          onPress={handleAppleLogin}
          disabled={loading}
        >
          <Text style={styles.socialButtonText}>Pokračovať s Apple</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Nemáš účet?</Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Zaregistruj sa</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F1EC',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#F5F1EC',
  },
  hero: {
    backgroundColor: '#EDE0D4',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
  },
  heroTag: {
    color: '#6B4F3A',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD3C9',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#271508',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B5C52',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#6B5C52',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1C1917',
    borderWidth: 1,
    borderColor: '#C8BAB0',
  },
  errorText: {
    color: '#BA1A1A',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#6B4F3A',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#271508',
  },
  dividerText: {
    color: '#6B5C52',
    paddingHorizontal: 12,
  },
  socialButton: {
    backgroundColor: '#271508',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C8BAB0',
  },
  socialButtonText: {
    color: '#DDD3C9',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#6B5C52',
    marginRight: 6,
  },
  footerLink: {
    color: '#6B4F3A',
    fontWeight: '600',
  },
});

export default LoginScreen;
