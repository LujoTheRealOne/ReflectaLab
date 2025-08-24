import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { UseRevenueCatResult, RevenueCatCustomerInfo, RevenueCatOffering } from '@/types/revenuecat';

type PurchasesOffering = RevenueCatOffering;

const REVENUECAT_ENTITLEMENT_ID = 'reflecta_pro'; // entitlement identifier in RC

export function useRevenueCat(userId?: string | null): UseRevenueCatResult {
  const [initialized, setInitialized] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<RevenueCatCustomerInfo>({ entitlements: { active: {} } });
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | undefined>(undefined);
  const [offeringsError, setOfferingsError] = useState<string | undefined>(undefined);
  const [appUserID, setAppUserID] = useState<string | undefined>(undefined);
  const configuredRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Configure RevenueCat SDK only once
  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

    const configureSDK = async () => {
      try {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
        if (!apiKey) {
          console.warn('RevenueCat API key not found in environment variables');
          return;
        }
        console.log('🔧 Configuring RevenueCat SDK...');
        Purchases.configure({ apiKey });
        
        // Add customer info listener
        const remove = Purchases.addCustomerInfoUpdateListener((ci) => {
          setCustomerInfo((ci as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
        });
        
        // Cleanup function will be handled in component unmount
        return remove;
      } catch (e) {
        console.warn('Failed to configure RevenueCat:', e);
      }
    };

    const removeListener = configureSDK();
    
    return () => {
      if (removeListener && typeof removeListener === 'function') {
        (removeListener as unknown as () => void)();
      }
    };
  }, []);

  // Fetch offerings with retry logic
  const fetchOfferingsWithRetry = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      console.log(`🛒 Fetching offerings (attempt ${retryCount + 1}/${maxRetries})...`);
      const offerings = await Purchases.getOfferings();
      setCurrentOffering(offerings.current as unknown as PurchasesOffering | undefined);
      setOfferingsError(undefined);
      retryCountRef.current = 0; // Reset on success
      console.log('✅ Offerings fetched successfully');
    } catch (e: any) {
      console.warn(`❌ Failed to fetch offerings (attempt ${retryCount + 1}):`, e?.message);
      setOfferingsError(e?.message || 'Failed to fetch offerings');
      
      // Retry with exponential backoff if we haven't exceeded max retries
      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms...`);
        setTimeout(() => {
          fetchOfferingsWithRetry(retryCount + 1);
        }, delay);
      } else {
        console.error('🚫 Max retry attempts reached for offerings');
      }
    }
  }, [maxRetries]);

  // Initialize user and fetch data when userId changes
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }
    
    const initializeUser = async () => {
      try {
        // Skip if userId hasn't changed
        if (prevUserIdRef.current === userId) return;
        
        console.log('🔄 RevenueCat user initialization:', { from: prevUserIdRef.current, to: userId });
        prevUserIdRef.current = userId;
        
        if (userId) {
          // Wait a bit for SDK to be configured
          initTimeoutRef.current = setTimeout(async () => {
            try {
              console.log('🔑 Logging in user to RevenueCat...');
              await Purchases.logIn(userId);
              
              // Fetch user data
              try {
                const id = await Purchases.getAppUserID();
                if (id) setAppUserID(id);
              } catch {}
              
              const info = await Purchases.getCustomerInfo();
              setCustomerInfo((info as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
              
              // Fetch offerings with retry
              await fetchOfferingsWithRetry(0);
              
              setInitialized(true);
              console.log('✅ RevenueCat user initialization complete');
            } catch (e) {
              console.warn('RevenueCat user init error:', e);
              setInitialized(true); // Still mark as initialized to prevent blocking
            }
          }, 500); // 500ms delay to ensure SDK is configured
        } else {
          // Handle logout
          if (prevUserIdRef.current) {
            console.log('🚪 RevenueCat logout triggered');
            await Purchases.logOut();
          }
          setInitialized(false);
          setCurrentOffering(undefined);
          setOfferingsError(undefined);
          setAppUserID(undefined);
        }
      } catch (e) {
        console.warn('RevenueCat initialization error:', e);
      }
    };
    
    initializeUser();
    
    // Cleanup function
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [userId, fetchOfferingsWithRetry]);

  const isPro = useMemo(() => {
    if (!customerInfo) return false;
    const entitlements = customerInfo.entitlements?.active || {};
    if (entitlements[REVENUECAT_ENTITLEMENT_ID]) return true;
    const keys = Object.keys(entitlements);
    // Fallback: if any active entitlement contains 'pro' treat as pro
    if (keys.some(k => k.toLowerCase().includes('pro'))) return true;
    return false;
  }, [customerInfo]);

  const activeEntitlementIds = useMemo(() => {
    if (!customerInfo) return [];
    return Object.keys(customerInfo.entitlements?.active || {});
  }, [customerInfo]);

  const refresh = useCallback(async () => {
    try {
      console.log('🔄 Refreshing RevenueCat data...');
      
      // Refresh user ID
      try {
        const id = await Purchases.getAppUserID();
        if (id) setAppUserID(id);
      } catch {}
      
      // Refresh customer info
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo((info as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
      
      // Refresh offerings with retry logic
      await fetchOfferingsWithRetry(0);
      
      console.log('✅ RevenueCat refresh complete');
    } catch (e: any) {
      console.warn('RevenueCat refresh error:', e);
      // Don't throw here, let UI handle the error state
    }
  }, [fetchOfferingsWithRetry]);

  const presentPaywall = async (opts?: { offering?: PurchasesOffering; requiredEntitlementIdentifier?: string }) => {
    try {
      const anyOpts: any = opts?.offering ? { offering: opts.offering as any } : undefined;
      const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall(anyOpts);
      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          await refresh();
          return true;
        default:
          return false;
      }
    } catch {
      return false;
    }
  };

  const presentPaywallIfNeeded = async (requiredEntitlementIdentifier?: string, offering?: PurchasesOffering) => {
    try {
      const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: requiredEntitlementIdentifier || REVENUECAT_ENTITLEMENT_ID,
        offering: offering as any,
      } as any);
      
      console.log('💳 Paywall result:', result);
      
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        console.log('✅ Purchase successful, refreshing customer info');
        await refresh();
        return true;
      }
      
      console.log('❌ Paywall not completed:', result);
      return false; // Only return true if actually purchased/restored
    } catch (e) {
      console.log('❌ Paywall error:', e);
      return false;
    }
  };

  const restorePurchases = async () => {
    try {
      await Purchases.restorePurchases();
      await refresh();
      return true;
    } catch {
      return false;
    }
  };

  return {
    initialized,
    isPro,
    customerInfo,
    currentOffering,
    offeringsError,
    activeEntitlementIds,
    appUserID,
    refresh,
    presentPaywall,
    presentPaywallIfNeeded,
    restorePurchases,
  };
}


