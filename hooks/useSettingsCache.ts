import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { settingsCache, CachedSettingsData } from '@/services/settingsCache';
import * as Application from 'expo-application';

export interface UseSettingsCacheReturn {
  cachedData: CachedSettingsData | null;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  updateUserData: (data: any) => Promise<void>;
  updateSubscriptionData: (data: any) => Promise<void>;
  updatePermissionsData: (data: any) => Promise<void>;
}

// Global state for settings cache
let globalCachedData: CachedSettingsData | null = null;
let globalIsLoading = true;
let globalListeners: Set<() => void> = new Set();
let currentUserId: string | null = null;
let isInitialized = false;

// Notify all listeners about state changes
function notifyListeners() {
  globalListeners.forEach(listener => listener());
}

// Update global state
function updateGlobalState(updates: {
  cachedData?: CachedSettingsData | null;
  isLoading?: boolean;
}) {
  let hasChanges = false;
  
  if (updates.cachedData !== undefined && updates.cachedData !== globalCachedData) {
    globalCachedData = updates.cachedData;
    hasChanges = true;
  }
  if (updates.isLoading !== undefined && updates.isLoading !== globalIsLoading) {
    globalIsLoading = updates.isLoading;
    hasChanges = true;
  }
  
  if (hasChanges) {
    notifyListeners();
  }
}

// Initialize settings cache for user
async function initializeSettingsCache(userId: string) {
  if (currentUserId === userId && isInitialized) {
    console.log('⚙️ Settings cache already initialized for user:', userId);
    return;
  }

  console.log('⚙️ Initializing settings cache for user:', userId);
  currentUserId = userId;

  try {
    // Load cached data first (instant display)
    const cachedData = await settingsCache.getCachedSettings(userId);
    
    if (cachedData && settingsCache.isCacheValid(cachedData)) {
      console.log('⚙️ Using valid cached settings');
      updateGlobalState({ cachedData, isLoading: false });
    } else {
      console.log('⚙️ Using default settings (cache invalid or missing)');
      const defaultCache = settingsCache.getDefaultCache(userId);
      updateGlobalState({ cachedData: defaultCache, isLoading: false });
    }

    isInitialized = true;
  } catch (err) {
    console.error('❌ Settings cache initialization failed:', err);
    const defaultCache = settingsCache.getDefaultCache(userId);
    updateGlobalState({ cachedData: defaultCache, isLoading: false });
  }
}

// Clear settings cache
function clearSettingsCache() {
  console.log('🧹 Clearing global settings cache');
  globalCachedData = null;
  globalIsLoading = true;
  currentUserId = null;
  isInitialized = false;
  notifyListeners();
}

// Background sync of live data
async function backgroundSyncSettings(
  userId: string,
  authData: any,
  subscriptionData: any,
  permissionsData: any
) {
  try {
    console.log('🔄 Background syncing settings data...');
    
    const appVersion = Application.nativeApplicationVersion || '1.0.0';
    
    const freshData: CachedSettingsData = {
      userData: {
        user: authData.user,
        firebaseUser: authData.firebaseUser,
      },
      subscriptionData: {
        isPro: subscriptionData.isPro || false,
        initialized: subscriptionData.initialized || false,
        customerInfo: subscriptionData.customerInfo,
        activeSubscriptions: subscriptionData.activeSubscriptions || [],
        currentOffering: subscriptionData.currentOffering,
      },
      permissionsData: {
        notificationStatus: permissionsData.permissionStatus || 'undetermined',
        expoPushToken: permissionsData.expoPushToken || null,
        lastChecked: new Date().toISOString(),
      },
      appVersion,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    await settingsCache.setCachedSettings(userId, freshData);
    updateGlobalState({ cachedData: freshData });
    
    console.log('✅ Settings background sync completed');
  } catch (error) {
    console.error('❌ Settings background sync failed:', error);
  }
}

export function useSettingsCache(): UseSettingsCacheReturn {
  const { user, firebaseUser } = useAuth();
  const { initialized: rcInitialized, isPro, customerInfo, activeSubscriptions, currentOffering } = useRevenueCat();
  const { permissionStatus, expoPushToken } = useNotificationPermissions();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  // Initialize cache when user changes
  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeSettingsCache(firebaseUser.uid);
    } else {
      clearSettingsCache();
    }
  }, [firebaseUser?.uid]);

  // Disable automatic background sync - only manual refresh will update settings
  // useEffect(() => {
  //   if (
  //     firebaseUser?.uid && 
  //     rcInitialized && 
  //     isInitialized && 
  //     user // Wait for all critical data
  //   ) {
  //     backgroundSyncSettings(
  //       firebaseUser.uid,
  //       { user, firebaseUser },
  //       { isPro, initialized: rcInitialized, customerInfo, activeSubscriptions, currentOffering },
  //       { permissionStatus, expoPushToken }
  //     );
  //   }
  // }, [
  //   firebaseUser?.uid,
  //   user,
  //   rcInitialized,
  //   isPro,
  //   customerInfo,
  //   permissionStatus,
  //   expoPushToken,
  // ]);

  // Public methods
  const refreshSettings = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Manual settings refresh requested - syncing with server');
    updateGlobalState({ isLoading: true });

    try {
      // Only sync when manually requested
      await backgroundSyncSettings(
        firebaseUser.uid,
        { user, firebaseUser },
        { isPro, initialized: rcInitialized, customerInfo, activeSubscriptions, currentOffering },
        { permissionStatus, expoPushToken }
      );
      console.log('✅ Manual settings refresh completed');
    } catch (err) {
      console.error('❌ Manual settings refresh failed:', err);
    } finally {
      updateGlobalState({ isLoading: false });
    }
  }, [
    firebaseUser?.uid,
    user,
    isPro,
    rcInitialized,
    customerInfo,
    activeSubscriptions,
    currentOffering,
    permissionStatus,
    expoPushToken,
  ]);

  const updateUserData = useCallback(async (data: any) => {
    if (!firebaseUser?.uid) return;
    await settingsCache.updateUserData(firebaseUser.uid, data);
  }, [firebaseUser?.uid]);

  const updateSubscriptionData = useCallback(async (data: any) => {
    if (!firebaseUser?.uid) return;
    await settingsCache.updateSubscriptionData(firebaseUser.uid, data);
  }, [firebaseUser?.uid]);

  const updatePermissionsData = useCallback(async (data: any) => {
    if (!firebaseUser?.uid) return;
    await settingsCache.updatePermissionsData(firebaseUser.uid, data);
  }, [firebaseUser?.uid]);

  return {
    cachedData: globalCachedData,
    isLoading: globalIsLoading,
    refreshSettings,
    updateUserData,
    updateSubscriptionData,
    updatePermissionsData,
  };
}

export default useSettingsCache;
