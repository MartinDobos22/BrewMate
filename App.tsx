import React from 'react';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { brewMateTheme } from './src/theme/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

const navigationTheme = {
  dark: false,
  colors: {
    primary: brewMateTheme.colors.primary,
    background: brewMateTheme.colors.background,
    card: brewMateTheme.colors.surface,
    text: brewMateTheme.colors.onSurface,
    border: brewMateTheme.colors.outlineVariant,
    notification: brewMateTheme.colors.error,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={brewMateTheme}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={brewMateTheme.colors.background}
        />
        <AuthProvider>
          <NavigationContainer theme={navigationTheme}>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
