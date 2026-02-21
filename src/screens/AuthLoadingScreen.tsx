import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

function AuthLoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6B4F3A" />
      <Text style={styles.text}>Načítavam účet...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F3EE',
  },
  text: {
    marginTop: 12,
    color: '#E3DED6',
    fontSize: 16,
  },
});

export default AuthLoadingScreen;
