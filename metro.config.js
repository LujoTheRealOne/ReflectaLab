const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable DOM components support
config.resolver.platforms = ['ios', 'android', 'web'];

// Add CSS support
config.resolver.assetExts.push('css');

// Add alias support
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
  '@/components': path.resolve(__dirname, './components'),
  '@/styles': path.resolve(__dirname, './styles'),
  '@/constants': path.resolve(__dirname, './constants'),
  '@/hooks': path.resolve(__dirname, './hooks'),
  '@/navigation': path.resolve(__dirname, './navigation'),
  '@/screens': path.resolve(__dirname, './screens'),
  '@/assets': path.resolve(__dirname, './assets'),
};

module.exports = config; 