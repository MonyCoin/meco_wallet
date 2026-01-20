// polyfill.js - متوافق مع expo-random
import { Buffer } from 'buffer';

// ========== BUFFER ==========
global.Buffer = Buffer;

// ========== PROCESS ==========
global.process = global.process || {};
global.process.env = global.process.env || {};
global.process.env.NODE_ENV = process.env.NODE_ENV || 'production';
global.process.version = 'v16.0.0';

// ========== CRYPTO with expo-random ==========
if (!global.crypto) {
  try {
    // استخدام expo-random الجديد
    const { getRandomBytes } = require('expo-random');
    global.crypto = {
      getRandomValues: (array) => {
        const bytes = getRandomBytes(array.length);
        for (let i = 0; i < array.length; i++) {
          array[i] = bytes[i];
        }
        return array;
      }
    };
    console.log('✅ Crypto: Using expo-random');
  } catch (error) {
    // Fallback بسيط
    console.warn('⚠️ Crypto: Using fallback (expo-random not available)');
    global.crypto = {
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      }
    };
  }
}

// ========== TEXT ENCODING ==========
if (!global.TextEncoder || !global.TextDecoder) {
  try {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    console.log('✅ TextEncoder/TextDecoder loaded');
  } catch (error) {
    console.warn('⚠️ Text encoding not available');
  }
}

// ========== GLOBALS ==========
if (!global.setImmediate) {
  global.setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);
}

if (!global.clearImmediate) {
  global.clearImmediate = (id) => clearTimeout(id);
}

if (!global.btoa) {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}

if (!global.atob) {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

if (typeof __dirname === 'undefined') {
  global.__dirname = '/';
}

if (typeof __filename === 'undefined') {
  global.__filename = '';
}

console.log('✅ Polyfills loaded successfully with expo-random');
