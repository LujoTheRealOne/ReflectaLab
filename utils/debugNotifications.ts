import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PERMISSION_SHOWN_KEY = 'notification_permission_shown';
const NOTIFICATION_PERMISSION_DISMISSED_KEY = 'notification_permission_dismissed';

/**
 * Debug utility to clear notification permission AsyncStorage data
 * Call this if you're experiencing JSON parse errors or blank screens
 */
export async function clearNotificationPermissionData() {
  try {
    console.log('🧹 [DEBUG] Clearing notification permission data...');
    
    // Get current values for debugging
    const [shownKey, dismissedKey] = await Promise.all([
      AsyncStorage.getItem(NOTIFICATION_PERMISSION_SHOWN_KEY),
      AsyncStorage.getItem(NOTIFICATION_PERMISSION_DISMISSED_KEY),
    ]);
    
    console.log('🧹 [DEBUG] Current values - shown:', shownKey, 'dismissed:', dismissedKey);
    
    // Clear the data
    await AsyncStorage.multiRemove([
      NOTIFICATION_PERMISSION_SHOWN_KEY,
      NOTIFICATION_PERMISSION_DISMISSED_KEY,
    ]);
    
    console.log('✅ [DEBUG] Notification permission data cleared successfully');
  } catch (error) {
    console.error('❌ [DEBUG] Failed to clear notification permission data:', error);
  }
}

/**
 * Debug utility to inspect all AsyncStorage keys
 */
export async function inspectAsyncStorage() {
  try {
    console.log('🔍 [DEBUG] Inspecting AsyncStorage...');
    const keys = await AsyncStorage.getAllKeys();
    console.log('🔍 [DEBUG] All AsyncStorage keys:', keys);
    
    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        console.log(`🔍 [DEBUG] ${key}:`, value);
      } catch (error) {
        console.error(`❌ [DEBUG] Error reading ${key}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ [DEBUG] Failed to inspect AsyncStorage:', error);
  }
}

// These functions can be imported and used in components for debugging
