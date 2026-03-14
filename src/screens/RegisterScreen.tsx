import React, { useState } from 'react';
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
  useTheme,
  HelperText,
} from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../navigation/types';
import { apiFetch, DEFAULT_API_HOST } from '../utils/api';
import spacing from '../styles/spacing';

const MIN_PASSWORD_LENGTH = 6;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const theme = useTheme<MD3Theme>();

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
            Registrácia
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Začni s BrewMate ešte dnes.
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

          <TextInput
            mode="outlined"
            label="Potvrď heslo"
            secureTextEntry={!confirmPasswordVisible}
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            right={
              <TextInput.Icon
                icon={confirmPasswordVisible ? 'eye-off' : 'eye'}
                onPress={() => setConfirmPasswordVisible((v) => !v)}
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
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
          >
            Vytvoriť účet
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Už máš účet?
          </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            compact
          >
            Prihlásiť sa
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
});

export default RegisterScreen;
