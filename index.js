/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { initSentry } from './src/sentry';
import App from './App';
import { name as appName } from './app.json';

initSentry();

AppRegistry.registerComponent(appName, () => App);
