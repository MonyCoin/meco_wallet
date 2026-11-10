// أيقونة اتجاهية تنعكس تلقائياً مع اللغة (RTL): back ↔ forward
// تُستخدم لأسهم الرجوع والتقدم والقوائم حتى يكون الاتجاه موحداً في كل التطبيق.
import React from 'react';
import { I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FLIP = {
  'arrow-back':      'arrow-forward',
  'arrow-forward':   'arrow-back',
  'chevron-back':    'chevron-forward',
  'chevron-forward': 'chevron-back',
};

export default function DirIcon({ name, ...props }) {
  const resolved = I18nManager.isRTL && FLIP[name] ? FLIP[name] : name;
  return <Ionicons name={resolved} {...props} />;
}
