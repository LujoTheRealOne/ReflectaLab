import { useEffect, useState, useCallback, useRef } from 'react';
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
const ONBOARDING_COMPLETED_AT_KEY = '@onboarding_completed_at';

export interface UseNotificationPermissionModalReturn {
  shouldShow: boolean;
  showModal: () => void;
  dismissModal: () => void;
  checkAndShowIfNeeded: () => Promise<void>;
}

/**
 * Production-grade notification permission modal hook
 * Handles showing notification permission prompts with proper state management
 */
export function useNotificationPermissionModal(): UseNotificationPermissionModalReturn {
  const [shouldShow, setShouldShow] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { permissionStatus } = useNotificationPermissions();
  const { firebaseUser } = useAuth();

  // Refs to prevent stale closures and track state
  const isInitializedRef = useRef(false);
  const isCheckingRef = useRef(false);
  const lastCheckParamsRef = useRef<string>('');

  /**
   * Check if push notifications are fully enabled
   * Returns true only if: system permission granted + user preference enabled + valid tokens
   */
  const checkPushNotificationsEnabled = useCallback(async (): Promise<boolean> => {
    const userId = firebaseUser?.uid;
    const currentPermissionStatus = permissionStatus;

    if (!userId) {
      console.log('🔍 [NotificationModal] No firebase user, returning false');
      return false;
    }

    try {
      // Check system permissions first (fastest check)
      console.log('🔍 [NotificationModal] Checking system permission status:', currentPermissionStatus);
      if (currentPermissionStatus !== 'granted') {
        console.log('🔍 [NotificationModal] System permissions not granted');
        return false;
      }

      // Check user account preference (slower Firestore check)
      console.log('🔍 [NotificationModal] Checking user account preferences...');
      const userDocRef = doc(db, 'users', userId);
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
      return Boolean(pushNotificationsEnabled && hasValidTokens);
    } catch (error) {
      console.error('❌ [NotificationModal] Error checking push notification status:', error);
      return false;
    }
  }, []); // No dependencies - uses latest values via closure

  /**
   * Show the notification permission modal
   */
  const showModal = useCallback(() => {
    try {
      // Validate navigation availability
      if (!navigation || typeof navigation.navigate !== 'function') {
        console.error('❌ [NotificationModal] Navigation not ready');
        return;
      }
      
      console.log('🎯 [NotificationModal] Showing notification permission modal');
      setShouldShow(true);
      navigation.navigate('NotificationPermission');
    } catch (error) {
      console.error('❌ [NotificationModal] Error navigating to notification permission:', error);
      setShouldShow(false); // Reset state on error
    }
  }, [navigation]);

  /**
   * Dismiss the notification permission modal
   */
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

  /**
   * Check if modal should be shown and show it if needed
   * This is the main logic function
   */
  const checkAndShowIfNeeded = useCallback(async (): Promise<void> => {
    const userId = firebaseUser?.uid;
    const currentPermissionStatus = permissionStatus;

    // Create a unique key for this check to prevent duplicate calls
    const checkParams = `${userId}-${currentPermissionStatus}`;
    
    // Skip if:
    // 1. No authenticated user
    // 2. Already checking (prevent concurrent execution)
    // 3. Same parameters as last check (prevent duplicate work)
    if (!userId) {
      console.log('🔍 [NotificationModal] No user, skipping check');
      return;
    }

    if (isCheckingRef.current) {
      console.log('🔍 [NotificationModal] Already checking, skipping');
      return;
    }

    if (lastCheckParamsRef.current === checkParams && isInitializedRef.current) {
      console.log('🔍 [NotificationModal] Same check parameters, skipping');
      return;
    }

    try {
      isCheckingRef.current = true;
      lastCheckParamsRef.current = checkParams;
      
      console.log('🔍 [NotificationModal] Starting permission check...', { userId, currentPermissionStatus });
      
      // Step 1: Check if push notifications are fully enabled
      const pushNotificationsEnabled = await checkPushNotificationsEnabled();
      console.log('📱 [NotificationModal] Push notifications enabled:', pushNotificationsEnabled);
      
      if (pushNotificationsEnabled) {
        console.log('✅ [NotificationModal] Push notifications already enabled, not showing modal');
        return;
      }

      // Step 2: Check storage for previous actions and onboarding completion
      const [shownTimestamp, dismissedTimestamp, onboardingCompletedAt] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATION_PERMISSION_SHOWN_KEY).catch(() => null),
        AsyncStorage.getItem(NOTIFICATION_PERMISSION_DISMISSED_KEY).catch(() => null),
        AsyncStorage.getItem(ONBOARDING_COMPLETED_AT_KEY).catch(() => null),
      ]);
      
      console.log('📦 [NotificationModal] Storage values - shown:', shownTimestamp, 'dismissed:', dismissedTimestamp, 'onboardingCompletedAt:', onboardingCompletedAt);

      // Step 3: Check if user just completed onboarding (within last 5 minutes)
      const justCompletedOnboarding = onboardingCompletedAt && !isNaN(parseInt(onboardingCompletedAt, 10)) 
        ? (Date.now() - parseInt(onboardingCompletedAt, 10)) < (5 * 60 * 1000) // 5 minutes
        : false;

      if (justCompletedOnboarding) {
        console.log('🎉 [NotificationModal] User just completed onboarding - prioritizing notification request');
        // Skip normal cooldown checks for recently completed onboarding
      } else {
        // Step 4: Apply normal dismissal cooldown (24 hours)
        if (dismissedTimestamp && !isNaN(parseInt(dismissedTimestamp, 10))) {
          const dismissedTime = parseInt(dismissedTimestamp, 10);
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (Date.now() - dismissedTime < twentyFourHours) {
            console.log('⏰ [NotificationModal] Recently dismissed, not showing again');
            return;
          }
        }
      }

      // Step 5: Apply longer cooldown for denied permissions (7 days) - unless just completed onboarding
      if (!justCompletedOnboarding && shownTimestamp && !isNaN(parseInt(shownTimestamp, 10)) && currentPermissionStatus === 'denied') {
        const shownTime = parseInt(shownTimestamp, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - shownTime < sevenDays) {
          console.log('🚫 [NotificationModal] Previously denied, waiting longer');
          return;
        }
      }

      // Step 6: Show the modal and mark as shown
      console.log('🎯 [NotificationModal] All checks passed - showing modal');
      showModal();
      
      // Mark as shown and clear onboarding completion flag
      try {
        await Promise.all([
          AsyncStorage.setItem(NOTIFICATION_PERMISSION_SHOWN_KEY, Date.now().toString()),
          justCompletedOnboarding ? AsyncStorage.removeItem(ONBOARDING_COMPLETED_AT_KEY) : Promise.resolve(),
        ]);
        console.log('✅ [NotificationModal] Marked as shown in storage');
        if (justCompletedOnboarding) {
          console.log('🧹 [NotificationModal] Cleared onboarding completion flag');
        }
      } catch (setError) {
        console.error('❌ [NotificationModal] Failed to mark as shown:', setError);
      }
    } catch (error) {
      console.error('❌ [NotificationModal] Error in checkAndShowIfNeeded:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, []); // No dependencies - uses latest values via closure

  /**
   * Initialize the hook once when user becomes available
   * Uses a single effect with proper dependency management
   */
  useEffect(() => {
    const userId = firebaseUser?.uid;
    const currentPermissionStatus = permissionStatus;

    // Only initialize once when we have a user and permission status is determined
    if (!userId || !currentPermissionStatus || currentPermissionStatus === 'undetermined') {
      console.log('🔍 [NotificationModal] Waiting for user and permission status...', { 
        hasUser: !!userId, 
        permissionStatus: currentPermissionStatus 
      });
      return;
    }

    // Prevent multiple initializations
    if (isInitializedRef.current) {
      console.log('🔍 [NotificationModal] Already initialized, skipping');
      return;
    }

    console.log('🚀 [NotificationModal] Initializing permission check...', { userId, currentPermissionStatus });
    isInitializedRef.current = true;

    // Check if user just completed onboarding for optimized timing
    const checkOnboardingStatus = async () => {
      try {
        const onboardingCompletedAt = await AsyncStorage.getItem(ONBOARDING_COMPLETED_AT_KEY);
        const justCompletedOnboarding = onboardingCompletedAt && !isNaN(parseInt(onboardingCompletedAt, 10)) 
          ? (Date.now() - parseInt(onboardingCompletedAt, 10)) < (5 * 60 * 1000) // 5 minutes
          : false;
        
        // Shorter delay for just completed onboarding users
        const delay = justCompletedOnboarding ? 1500 : 3000; // 1.5s vs 3s
        console.log('⏰ [NotificationModal] Using delay:', delay, 'ms (justCompletedOnboarding:', justCompletedOnboarding, ')');
        
        return delay;
      } catch (error) {
        console.error('❌ [NotificationModal] Error checking onboarding status:', error);
        return 3000; // Default delay
      }
    };

    // Dynamic delay based on onboarding completion status
    let timeoutId: NodeJS.Timeout | null = null;
    
    checkOnboardingStatus().then(delay => {
      timeoutId = setTimeout(() => {
        checkAndShowIfNeeded().catch(error => {
          console.error('❌ [NotificationModal] Error in delayed initialization:', error);
        });
      }, delay);
    });

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [firebaseUser?.uid, permissionStatus]); // Only depend on essential external values

  return {
    shouldShow,
    showModal,
    dismissModal,
    checkAndShowIfNeeded,
  };
}