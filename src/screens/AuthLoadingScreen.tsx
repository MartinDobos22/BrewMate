import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function AuthLoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1f6f5b" />
      <Text style={styles.text}>Načítavam účet...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0b',
  },
  text: {
    marginTop: 12,
    color: '#e2e8f0',
    fontSize: 16,
  },
});

export default AuthLoadingScreen;
