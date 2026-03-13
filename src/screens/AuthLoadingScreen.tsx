import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function AuthLoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C2C2C" />
      <Text style={styles.text}>Načítavam účet...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  text: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '400',
    color: '#6B6B6B',
  },
});

export default AuthLoadingScreen;
