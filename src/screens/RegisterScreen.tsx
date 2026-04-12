import React, { useMemo, useState } from 'react';
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
import { useTheme } from '../theme/useTheme';
import { CoffeeBeanIcon } from '../components/icons';
import { MD3Button } from '../components/md3';

const MIN_PASSWORD_LENGTH = 6;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    return 'Registrácia zlyhala.';
  };

  const validate = () => {
    if (!email.trim()) {
      setErrorMessage('Zadaj email.');
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage('Heslo musí mať aspoň 6 znakov.');
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Heslá sa nezhodujú.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await apiFetch(
        `${DEFAULT_API_HOST}/auth/register`,
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
          action: 'register',
        },
      );

      if (!response.ok) {
        const message = await getBackendErrorMessage(response);
        setErrorMessage(message);
        return;
      }

      navigation.navigate('Login', {
        prefillEmail: email.trim(),
        prefillPassword: password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registrácia zlyhala.';
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
        <Text style={s.title}>Registrácia</Text>
        <Text style={s.subtitle}>Začni s BrewMate ešte dnes.</Text>

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

        <View style={s.inputGroup}>
          <Text style={s.label}>Potvrď heslo</Text>
          <TextInput
            style={s.input}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.outline}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}

        <MD3Button
          label="Vytvoriť účet"
          onPress={handleRegister}
          disabled={loading}
          loading={loading}
        />

        <View style={s.footer}>
          <Text style={s.footerText}>Už máš účet?</Text>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={s.footerLink}>Prihlásiť sa</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default RegisterScreen;
