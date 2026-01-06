// ✅ metro.config.js - متوافق 100% مع Expo وبيئة Termux
const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const defaultConfig = getDefaultConfig(__dirname);
  const { resolver: { assetExts, sourceExts } } = defaultConfig;

  return {
    ...defaultConfig,
    resolver: {
      ...defaultConfig.resolver,
      assetExts: [...assetExts, 'png', 'jpg', 'jpeg', 'gif', 'svg'],
      sourceExts: [...sourceExts, 'cjs', 'mjs'],
    },
  };
})();
