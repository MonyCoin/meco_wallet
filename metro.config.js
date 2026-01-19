const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const defaultConfig = getDefaultConfig(__dirname);
  
  return {
    ...defaultConfig,
    resolver: {
      ...defaultConfig.resolver,
      assetExts: [...defaultConfig.resolver.assetExts, 'png', 'jpg', 'jpeg', 'gif', 'svg'],
      sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs', 'mjs'],
      extraNodeModules: {
        'crypto': require.resolve('expo-crypto'),
        'stream': require.resolve('stream-browserify'),
        'vm': require.resolve('vm-browserify'),
        'buffer': require.resolve('buffer'),
      }
    },
  };
})();
