import React, { useState } from 'react';
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
import { DEFAULT_API_HOST } from '../utils/api';
import { signInWithApple, signInWithGoogle } from '../utils/socialAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      const response = await fetch(`${DEFAULT_API_HOST}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const message = await getBackendErrorMessage(response);
        setErrorMessage(message);
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
        <Text style={styles.title}>Prihlásenie</Text>
        <Text style={styles.subtitle}>Vitaj späť v BrewMate.</Text>

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

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Prihlásiť</Text>}
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
    backgroundColor: '#0b0b0b',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5f5',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  errorText: {
    color: '#f87171',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#1f2937',
  },
  dividerText: {
    color: '#64748b',
    paddingHorizontal: 12,
  },
  socialButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  socialButtonText: {
    color: '#e2e8f0',
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
    color: '#94a3b8',
    marginRight: 6,
  },
  footerLink: {
    color: '#38bdf8',
    fontWeight: '600',
  },
});

export default LoginScreen;
