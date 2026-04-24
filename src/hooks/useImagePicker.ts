import { useCallback, useState } from 'react';
import {
  Asset,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

const PICKER_TIMEOUT_MS = 30_000;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.6;
const MAX_BASE64_BYTES = 2_000_000;

const estimateBase64Bytes = (base64: string) => Math.ceil((base64.length * 3) / 4);

const withPickerTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Image picker timed out.'));
        }, PICKER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

type UseImagePickerOutput = {
  imageBase64: string;
  imageUri: string | null;
  isPicking: boolean;
  errorMessage: string;
  pickFromGallery: () => Promise<void>;
  takePhoto: () => Promise<void>;
  setImage: (base64: string, uri?: string | null) => void;
  clearError: () => void;
  reset: () => void;
};

// Encapsulates the camera + gallery + timeout + size-validation flow used by
// the scan screen. The returned state mirrors what the screen used to hold
// inline; callers only need to render buttons + pass through the handlers.
export function useImagePicker(): UseImagePickerOutput {
  const [imageBase64, setImageBase64] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPicking, setIsPicking] = useState(false);

  const handleResponse = useCallback((response: ImagePickerResponse) => {
    if (response.didCancel) {
      setErrorMessage('Výber bol zrušený.');
      return;
    }
    if (response.errorCode) {
      setErrorMessage(response.errorMessage || 'Nastala chyba pri výbere obrázka.');
      return;
    }
    const asset: Asset | undefined = response.assets?.[0];
    if (!asset?.base64) {
      setErrorMessage('Nepodarilo sa načítať obrázok. Skúste znova.');
      return;
    }
    if (estimateBase64Bytes(asset.base64) > MAX_BASE64_BYTES) {
      setErrorMessage(
        'Obrázok je stále príliš veľký. Skúste prosím menší záber alebo orežte etiketu.',
      );
      return;
    }
    setErrorMessage('');
    setImageBase64(asset.base64);
    setImageUri(asset.uri ?? null);
  }, []);

  const pickFromGallery = useCallback(async () => {
    setIsPicking(true);
    try {
      const response = await withPickerTimeout(
        launchImageLibrary({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
        }),
      );
      handleResponse(response);
    } catch (err) {
      console.error('[useImagePicker] gallery failed', err);
      setErrorMessage('Načítanie obrázka trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  }, [handleResponse]);

  const takePhoto = useCallback(async () => {
    setIsPicking(true);
    try {
      const response = await withPickerTimeout(
        launchCamera({
          mediaType: 'photo',
          includeBase64: true,
          quality: IMAGE_QUALITY,
          maxWidth: MAX_IMAGE_DIMENSION,
          maxHeight: MAX_IMAGE_DIMENSION,
          saveToPhotos: true,
        }),
      );
      handleResponse(response);
    } catch (err) {
      console.error('[useImagePicker] camera failed', err);
      setErrorMessage('Načítanie fotky trvalo príliš dlho. Skúste znova.');
    } finally {
      setIsPicking(false);
    }
  }, [handleResponse]);

  const setImage = useCallback((base64: string, uri: string | null = null) => {
    setImageBase64(base64);
    setImageUri(uri);
    setErrorMessage('');
  }, []);

  const clearError = useCallback(() => setErrorMessage(''), []);

  const reset = useCallback(() => {
    setImageBase64('');
    setImageUri(null);
    setErrorMessage('');
  }, []);

  return {
    imageBase64,
    imageUri,
    isPicking,
    errorMessage,
    pickFromGallery,
    takePhoto,
    setImage,
    clearError,
    reset,
  };
}

export const IMAGE_PICKER_LIMITS = {
  PICKER_TIMEOUT_MS,
  MAX_IMAGE_DIMENSION,
  IMAGE_QUALITY,
  MAX_BASE64_BYTES,
};
