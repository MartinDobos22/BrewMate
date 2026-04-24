import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { captureException } from '../sentry';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error', error, info.componentStack);
    captureException(error, { componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>☕️</Text>
          <Text style={styles.title}>Niečo sa pokazilo</Text>
          <Text style={styles.message}>
            V aplikácii nastala neočakávaná chyba. Skús to prosím znova.
          </Text>
          {__DEV__ && this.state.error ? (
            <Text style={styles.details}>{this.state.error.message}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Skúsiť znova</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#23180E',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#4C4137',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  details: {
    fontSize: 12,
    color: '#8C6F5A',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#6B4F3A',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ErrorBoundary;
