import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function CoffeeScannerScreen() {
  const handleChooseFromGallery = () => {
    // TODO: integrate image picker for gallery selection.
  };

  const handleTakePhoto = () => {
    // TODO: integrate camera capture flow.
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.text}>Coffee Scanner</Text>
        <View style={styles.buttonGroup}>
          <Pressable style={styles.button} onPress={handleChooseFromGallery}>
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={handleTakePhoto}>
            <Text style={styles.buttonText}>Take a Photo</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#1f6f5b',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CoffeeScannerScreen;
