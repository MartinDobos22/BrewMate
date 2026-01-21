import { Platform } from 'react-native';
import Config from 'react-native-config';

const LOCAL_API_HOST =
  Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://localhost:3000',
    default: 'http://localhost:3000',
  }) ?? 'http://localhost:3000';

const RENDER_API_HOST = 'https://brewmate-fe.onrender.com';

export const DEFAULT_API_HOST =
  Config.EXPO_PUBLIC_API_HOST?.trim() || (__DEV__ ? LOCAL_API_HOST : RENDER_API_HOST);
