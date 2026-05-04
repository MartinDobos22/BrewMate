import { renderHook, act } from '@testing-library/react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useImagePicker } from '../../../src/hooks/useImagePicker';

const mockGallery = launchImageLibrary as jest.Mock;
const mockCamera = launchCamera as jest.Mock;

beforeEach(() => {
  mockGallery.mockReset();
  mockCamera.mockReset();
});

describe('useImagePicker — cancel', () => {
  it('does not set errorMessage when user cancels gallery', async () => {
    mockGallery.mockResolvedValue({ didCancel: true });
    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });
    expect(result.current.errorMessage).toBe('');
  });

  it('does not set errorMessage when user cancels camera', async () => {
    mockCamera.mockResolvedValue({ didCancel: true });
    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.takePhoto();
    });
    expect(result.current.errorMessage).toBe('');
  });
});

describe('useImagePicker — timeout / error', () => {
  it('sets errorMessage and logs console.warn (not error) on gallery rejection', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGallery.mockRejectedValue(new Error('Image picker timed out.'));

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.errorMessage).toBe(
      'Načítanie obrázka trvalo príliš dlho. Skúste znova.',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[useImagePicker] gallery failed',
      expect.any(Error),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('sets errorMessage and logs console.warn (not error) on camera rejection', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCamera.mockRejectedValue(new Error('Image picker timed out.'));

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.takePhoto();
    });

    expect(result.current.errorMessage).toBe(
      'Načítanie fotky trvalo príliš dlho. Skúste znova.',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[useImagePicker] camera failed',
      expect.any(Error),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('sets errorMessage on native picker error code', async () => {
    mockGallery.mockResolvedValue({
      errorCode: 'permission',
      errorMessage: 'Permission denied.',
    });

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.errorMessage).toBe('Permission denied.');
  });
});

describe('useImagePicker — successful pick', () => {
  it('sets imageBase64 and imageUri on valid gallery response', async () => {
    mockGallery.mockResolvedValue({
      assets: [{ base64: 'abc123', uri: 'file://test.jpg' }],
    });

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.imageBase64).toBe('abc123');
    expect(result.current.imageUri).toBe('file://test.jpg');
    expect(result.current.errorMessage).toBe('');
  });

  it('sets errorMessage when image exceeds size limit', async () => {
    // MAX_BASE64_BYTES = 2_000_000; estimateBase64Bytes = ceil(len * 3 / 4)
    // Need len > 2_666_667 to exceed 2 MB
    const largeBase64 = 'A'.repeat(2_700_000);
    mockGallery.mockResolvedValue({
      assets: [{ base64: largeBase64, uri: 'file://large.jpg' }],
    });

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.errorMessage).toContain('príliš veľký');
    expect(result.current.imageBase64).toBe('');
  });
});

describe('useImagePicker — clearError / reset', () => {
  it('clearError sets errorMessage to empty string', async () => {
    mockGallery.mockRejectedValue(new Error('fail'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.errorMessage).not.toBe('');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.errorMessage).toBe('');
  });

  it('reset clears imageBase64, imageUri, and errorMessage', async () => {
    mockGallery.mockResolvedValue({
      assets: [{ base64: 'data', uri: 'file://img.jpg' }],
    });

    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pickFromGallery();
    });

    expect(result.current.imageBase64).toBe('data');

    act(() => {
      result.current.reset();
    });

    expect(result.current.imageBase64).toBe('');
    expect(result.current.imageUri).toBeNull();
    expect(result.current.errorMessage).toBe('');
  });
});
