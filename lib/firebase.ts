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

// Ensure persistent auth on React Native by using AsyncStorage
// initializeAuth must be called only once and before getAuth on RN
const auth = (() => {
  if (Platform.OS !== 'web') {
    try {
      const a = initializeAuth(app);
      console.log('🔐 Firebase Auth initialized with default persistence');
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

// Connect to emulators in development
if (__DEV__) {
  // Simple flag to prevent multiple connection attempts
  let emulatorsConnected = false;
  
  if (!emulatorsConnected) {
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
      // Emulator connection might already be established
      console.log('   ⚠️ Auth emulator connection skipped (likely already connected)');
    }

    try {
      // Connect to Firestore emulator
      connectFirestoreEmulator(db, emulatorHost, 8080);
      console.log(`   ✅ Firestore emulator connected: ${emulatorHost}:8080`);
    } catch (error) {
      // Emulator connection might already be established
      console.log('   ⚠️ Firestore emulator connection skipped (likely already connected)');
    }

    try {
      // Connect to Storage emulator
      connectStorageEmulator(storage, emulatorHost, 9199);
      console.log(`   ✅ Storage emulator connected: ${emulatorHost}:9199`);
    } catch (error) {
      // Emulator connection might already be established
      console.log('   ⚠️ Storage emulator connection skipped (likely already connected)');
    }
    
    emulatorsConnected = true;
    console.log('🎯 Firebase emulators setup complete for Expo development');
  }
} else {
  console.log('🔥 Firebase Client SDK (Expo): Using production Firebase services');
}

export { db, auth, storage };