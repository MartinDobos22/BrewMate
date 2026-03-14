import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Divider,
  useTheme,
  HelperText,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import { signInWithApple, signInWithGoogle } from '../utils/socialAuth';
import { useAuth } from '../context/AuthContext';
import spacing from '../styles/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function LoginScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [didPrefill, setDidPrefill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { refreshSession } = useAuth();
  const theme = useTheme<MD3Theme>();

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
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="displaySmall" style={{ color: theme.colors.onSurface }}>
            Prihlásenie
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Vitaj späť v BrewMate.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

          <TextInput
            mode="outlined"
            label="Heslo"
            secureTextEntry={!passwordVisible}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
              />
            }
          />

          {errorMessage ? (
            <HelperText type="error" visible>
              {errorMessage}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
          >
            Prihlásiť
          </Button>
        </View>

        <View style={styles.dividerRow}>
          <Divider style={styles.dividerLine} />
          <Text variant="bodySmall" style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>
            alebo
          </Text>
          <Divider style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <Button
            mode="outlined"
            onPress={handleGoogleLogin}
            disabled={loading}
            style={styles.socialButton}
            contentStyle={styles.buttonContent}
            icon="google"
          >
            Pokračovať s Google
          </Button>

          <Button
            mode="outlined"
            onPress={handleAppleLogin}
            disabled={loading}
            style={styles.socialButton}
            contentStyle={styles.buttonContent}
            icon="apple"
          >
            Pokračovať s Apple
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Nemáš účet?
          </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Register')}
            compact
          >
            Zaregistruj sa
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'transparent',
  },
  inputOutline: {
    borderRadius: spacing.md,
  },
  primaryButton: {
    borderRadius: spacing.md,
    marginTop: spacing.sm,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
  },
  dividerText: {
    flexShrink: 0,
  },
  socialButtons: {
    gap: spacing.md,
  },
  socialButton: {
    borderRadius: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
});

export default LoginScreen;
