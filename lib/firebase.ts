// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, initializeAuth } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyCQXH2oz7CfCUcFabyU-nNupCL-T7AYzBM",
  authDomain: "reflecta-labs-v2.firebaseapp.com",
  projectId: "reflecta-labs-v2",
  storageBucket: "reflecta-labs-v2.firebasestorage.app",
  messagingSenderId: "733781858573",
  appId: "1:733781858573:web:e9531b0c4de9434070f844"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// 🚀 OPTIMIZATION: Ensure persistent auth on React Native with AsyncStorage
// initializeAuth must be called only once and before getAuth on RN
const auth = (() => {
  if (Platform.OS !== 'web') {
    try {
      // Import AsyncStorage for persistence
      const ReactNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getReactNativePersistence } = require('firebase/auth');
      
      const a = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
      });
      console.log('🔐 Firebase Auth initialized with AsyncStorage persistence');
      return a;
    } catch (_e) {
      // initializeAuth throws if called more than once; fall back to getAuth
      const a = getAuth(app);
      console.log('🔐 Firebase Auth obtained via getAuth (initializeAuth already called)');
      return a;
    }
  }
  // Web uses default persistence
  return getAuth(app);
})();

const storage = getStorage(app);

// Connect to emulators in development (optimized for faster startup)
if (__DEV__) {
  // Global flag to prevent multiple connection attempts across app restarts
  const EMULATOR_CONNECTED_KEY = '__firebase_emulators_connected__';
  
  if (!(global as any)[EMULATOR_CONNECTED_KEY]) {
    // Use environment variable for emulator host (for physical device development)
    // Default to localhost for emulator/simulator, use your dev machine IP for physical device
    const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
    
    console.log('🔥 Firebase Client SDK (Expo): Connecting to emulators...');
    console.log(`   📱 Using emulator host: ${emulatorHost}`);
    
    try {
      // Connect to Auth emulator
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
      console.log(`   ✅ Auth emulator connected: http://${emulatorHost}:9099`);
    } catch (error) {
      // Emulator connection might already be established - no need to log
    }

    try {
      // Connect to Firestore emulator
      connectFirestoreEmulator(db, emulatorHost, 8080);
      console.log(`   ✅ Firestore emulator connected: ${emulatorHost}:8080`);
    } catch (error) {
      // Emulator connection might already be established - no need to log
    }

    try {
      // Connect to Storage emulator
      connectStorageEmulator(storage, emulatorHost, 9199);
      console.log(`   ✅ Storage emulator connected: ${emulatorHost}:9199`);
    } catch (error) {
      // Emulator connection might already be established - no need to log
    }
    
    // Mark as connected globally to prevent future connection attempts
    (global as any)[EMULATOR_CONNECTED_KEY] = true;
    console.log('🎯 Firebase emulators setup complete for Expo development');
  } else {
    console.log('🔥 Firebase emulators already connected - skipping setup');
  }
} else {
  console.log('🔥 Firebase Client SDK (Expo): Using production Firebase services');
}

export { db, auth, storage };