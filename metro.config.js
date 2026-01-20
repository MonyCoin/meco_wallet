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
        'buffer': require.resolve('buffer'),
        'process': require.resolve('process/browser'),
        'url': require.resolve('url'),
        'assert': require.resolve('assert'),
        'util': require.resolve('util'),
        'events': require.resolve('events/'),
        'fs': false,
        'child_process': false,
        'net': false,
        'tls': false,
      }
    },
  };
})();
