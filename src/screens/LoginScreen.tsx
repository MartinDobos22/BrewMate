import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useTheme } from '../theme/useTheme';
import { CoffeeBeanIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

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

  const { colors, typescale, shape, spacing } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          flexGrow: 1,
          paddingHorizontal: spacing.xxl,
          paddingVertical: spacing.xxl,
          justifyContent: 'center',
          gap: spacing.lg,
        },
        logoRow: {
          alignItems: 'center',
          marginBottom: spacing.sm,
        },
        title: {
          ...typescale.headlineLarge,
          color: colors.onSurface,
          textAlign: 'center',
        },
        subtitle: {
          ...typescale.bodyLarge,
          color: colors.onSurfaceVariant,
          textAlign: 'center',
        },
        inputGroup: {
          gap: spacing.xs + 2,
        },
        label: {
          ...typescale.labelMedium,
          color: colors.onSurfaceVariant,
        },
        input: {
          backgroundColor: colors.surfaceContainerLowest,
          borderRadius: shape.medium,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          ...typescale.bodyLarge,
          color: colors.onSurface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        },
        errorText: {
          ...typescale.bodySmall,
          color: colors.error,
          fontWeight: '600',
        },
        dividerContainer: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        divider: {
          flex: 1,
          height: 1,
          backgroundColor: colors.outlineVariant,
        },
        dividerText: {
          ...typescale.bodySmall,
          color: colors.onSurfaceVariant,
          paddingHorizontal: spacing.md,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.xs + 2,
        },
        footerText: {
          ...typescale.bodyMedium,
          color: colors.onSurfaceVariant,
        },
        footerLink: {
          ...typescale.labelLarge,
          color: colors.primary,
        },
      }),
    [colors, typescale, shape, spacing],
  );

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.logoRow}>
          <CoffeeBeanIcon size={48} color={colors.primary} />
        </View>
        <Text style={s.title}>Prihlásenie</Text>
        <Text style={s.subtitle}>Vitaj späť v BrewMate.</Text>

        <View style={s.inputGroup}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="name@example.com"
            placeholderTextColor={colors.outline}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={s.inputGroup}>
          <Text style={s.label}>Heslo</Text>
          <TextInput
            style={s.input}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.outline}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}

        <MD3Button
          label="Prihlásiť"
          onPress={handleLogin}
          disabled={loading}
          loading={loading}
        />

        <View style={s.dividerContainer}>
          <View style={s.divider} />
          <Text style={s.dividerText}>alebo</Text>
          <View style={s.divider} />
        </View>

        <MD3Button
          label="Pokračovať s Google"
          variant="outlined"
          onPress={handleGoogleLogin}
          disabled={loading}
        />

        <MD3Button
          label="Pokračovať s Apple"
          variant="outlined"
          onPress={handleAppleLogin}
          disabled={loading}
        />

        <View style={s.footer}>
          <Text style={s.footerText}>Nemáš účet?</Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={s.footerLink}>Zaregistruj sa</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;
