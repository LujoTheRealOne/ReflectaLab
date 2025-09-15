import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc } from 'firebase/firestore';

import { useNotificationPermissions } from './useNotificationPermissions';
import { useAuth } from './useAuth';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { db } from '@/lib/firebase';

type NavigationProp = StackNavigationProp<AppStackParamList>;

const NOTIFICATION_PERMISSION_SHOWN_KEY = 'notification_permission_shown';
const NOTIFICATION_PERMISSION_DISMISSED_KEY = 'notification_permission_dismissed';

export interface UseNotificationPermissionModalReturn {
  shouldShow: boolean;
  showModal: () => void;
  dismissModal: () => void;
  checkAndShowIfNeeded: () => Promise<void>;
}

export function useNotificationPermissionModal(): UseNotificationPermissionModalReturn {
  const [shouldShow, setShouldShow] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { permissionStatus } = useNotificationPermissions();
  const { firebaseUser } = useAuth();

  // Check if push notifications are fully enabled (both system permissions and user preference)
  const checkPushNotificationsEnabled = useCallback(async (): Promise<boolean> => {
    if (!firebaseUser?.uid) {
      console.log('🔍 [NotificationModal] No firebase user, returning false');
      return false;
    }

    try {
      // Check system permissions
      console.log('🔍 [NotificationModal] Checking system permission status:', permissionStatus);
      if (permissionStatus !== 'granted') {
        console.log('🔍 [NotificationModal] System permissions not granted');
        return false;
      }

      // Check user account preference
      console.log('🔍 [NotificationModal] Checking user account preferences...');
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('🔍 [NotificationModal] User document does not exist');
        return false;
      }
      
      const userData = userDoc.data();
      console.log('🔍 [NotificationModal] User data loaded successfully');

      // Check if user has enabled push notifications in their account
      const pushNotificationsEnabled = userData?.mobilePushNotifications?.enabled;
      const hasValidTokens = userData?.mobilePushNotifications?.expoPushTokens?.length > 0;

      console.log('🔍 [NotificationModal] Push enabled:', pushNotificationsEnabled, 'Has tokens:', hasValidTokens);

      // User needs both: system permission granted AND account preference enabled AND valid tokens
      return pushNotificationsEnabled && hasValidTokens;
    } catch (error) {
      console.error('❌ [NotificationModal] Error checking push notification status:', error);
      return false;
    }
  }, [firebaseUser?.uid, permissionStatus]);

  const showModal = useCallback(() => {
    setShouldShow(true);
    navigation.navigate('NotificationPermission');
  }, [navigation]);

  const dismissModal = useCallback(async () => {
    console.log('❌ [NotificationModal] Dismissing modal');
    setShouldShow(false);
    
    // Mark as dismissed to prevent showing again for this session
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_DISMISSED_KEY, Date.now().toString());
      console.log('✅ [NotificationModal] Modal dismissed and saved to storage');
    } catch (error) {
      console.error('❌ [NotificationModal] Failed to save dismissal to storage:', error);
    }
  }, []);

  const checkAndShowIfNeeded = useCallback(async () => {
    // Only check for authenticated users
    if (!firebaseUser?.uid) {
      return;
    }

    try {
      console.log('🔍 [NotificationModal] Checking if modal should be shown...');
      
      // Check if push notifications are fully enabled (system + user preference + tokens)
      const pushNotificationsEnabled = await checkPushNotificationsEnabled();
      console.log('📱 [NotificationModal] Push notifications enabled:', pushNotificationsEnabled);
      
      if (pushNotificationsEnabled) {
        console.log('✅ [NotificationModal] Push notifications already enabled, not showing modal');
        return;
      }

      // Check if modal was already shown in this session or recently dismissed
      let shownKey: string | null = null;
      let dismissedKey: string | null = null;
      
      try {
        [shownKey, dismissedKey] = await Promise.all([
          AsyncStorage.getItem(NOTIFICATION_PERMISSION_SHOWN_KEY),
          AsyncStorage.getItem(NOTIFICATION_PERMISSION_DISMISSED_KEY),
        ]);
        console.log('📦 [NotificationModal] Storage values - shown:', shownKey, 'dismissed:', dismissedKey);
      } catch (storageError) {
        console.error('❌ [NotificationModal] AsyncStorage error:', storageError);
        // Clear corrupted data and continue
        try {
          await AsyncStorage.multiRemove([NOTIFICATION_PERMISSION_SHOWN_KEY, NOTIFICATION_PERMISSION_DISMISSED_KEY]);
        } catch (clearError) {
          console.error('❌ [NotificationModal] Failed to clear storage:', clearError);
        }
      }

      // If dismissed recently (within 24 hours), don't show again
      if (dismissedKey && !isNaN(parseInt(dismissedKey, 10))) {
        const dismissedTime = parseInt(dismissedKey, 10);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < twentyFourHours) {
          console.log('⏰ [NotificationModal] Recently dismissed, not showing again');
          return;
        }
      }

      // If shown before and user denied, wait longer (7 days) before showing again
      if (shownKey && !isNaN(parseInt(shownKey, 10)) && permissionStatus === 'denied') {
        const shownTime = parseInt(shownKey, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - shownTime < sevenDays) {
          console.log('🚫 [NotificationModal] Previously denied, waiting longer');
          return;
        }
      }

      // Show the modal
      console.log('🎯 [NotificationModal] Showing notification permission modal');
      showModal();
      
      // Mark as shown
      try {
        await AsyncStorage.setItem(NOTIFICATION_PERMISSION_SHOWN_KEY, Date.now().toString());
      } catch (setError) {
        console.error('❌ [NotificationModal] Failed to mark as shown:', setError);
      }
    } catch (error) {
      console.error('❌ [NotificationModal] Error checking notification permission modal:', error);
    }
  }, [firebaseUser?.uid, permissionStatus, checkPushNotificationsEnabled, showModal]);

  // Auto-check when user logs in or permission status changes
  useEffect(() => {
    // Small delay to ensure navigation is ready
    console.log('⏰ [NotificationModal] Setting up auto-check...');
    const timeoutId = setTimeout(() => {
      console.log('⏰ [NotificationModal] Auto-check timeout triggered');
      checkAndShowIfNeeded();
    }, 1000); // Reduced from 2 seconds to 1 second

    return () => {
      console.log('⏰ [NotificationModal] Clearing auto-check timeout');
      clearTimeout(timeoutId);
    };
  }, [checkAndShowIfNeeded]);

  return {
    shouldShow,
    showModal,
    dismissModal,
    checkAndShowIfNeeded,
  };
}
