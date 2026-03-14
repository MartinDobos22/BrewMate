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
        <View style={styles.header}>
          <Text style={styles.title}>Prihlásenie</Text>
          <Text style={styles.subtitle}>Vitaj späť v BrewMate.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="name@example.com"
              placeholderTextColor="#999999"
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
              placeholderTextColor="#999999"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Prihlásiť</Text>}
          </Pressable>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>alebo</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialButtons}>
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
        </View>

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
    backgroundColor: '#FAFAFA',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  form: {
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  errorText: {
    fontSize: 13,
    color: '#D64545',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  dividerText: {
    fontSize: 13,
    color: '#999999',
    paddingHorizontal: 12,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  disabledButton: {
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
    color: '#6B6B6B',
    marginRight: 4,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B7355',
  },
});

export default LoginScreen;
