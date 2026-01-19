import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';

// حل مشكلة crypto الرئيسية
if (typeof global.crypto === 'undefined') {
  global.crypto = Crypto;
}

// Polyfills آمنة لجميع البيئات
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof global.TextEncoder === 'undefined') {
  try {
    global.TextEncoder = require('text-encoding').TextEncoder;
  } catch (e) {
    console.warn('TextEncoder polyfill failed:', e);
    global.TextEncoder = class {
      encode() { return new Uint8Array(); }
    };
  }
}

if (typeof global.TextDecoder === 'undefined') {
  try {
    global.TextDecoder = require('text-encoding').TextDecoder;
  } catch (e) {
    console.warn('TextDecoder polyfill failed:', e);
    global.TextDecoder = class {
      decode() { return ''; }
    };
  }
}
