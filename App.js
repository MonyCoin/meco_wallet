// App.js - النسخة البسيطة والمستقرة
import './polyfill';
import './i18n';
import React from 'react';
import AppContainer from './AppContainer';

// اختبار سريع عند البدء
console.log('🚀 MECO Wallet starting...');

export default function App() {
  return <AppContainer />;
}
