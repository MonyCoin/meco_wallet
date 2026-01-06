import 'react-native-get-random-values';
import './shim';
import './i18n';
import React from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import AppContainer from './AppContainer';

export default function App() {
  if (__DEV__) {
    useKeepAwake();
  }

  return <AppContainer />;
}
