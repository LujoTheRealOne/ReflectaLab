import { useEffect, useMemo, useRef, useState } from 'react';
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
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

    const init = async () => {
      // Configure SDK
      try {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
        if (!apiKey) {
          console.warn('RevenueCat API key not found in environment variables');
          return;
        }
        Purchases.configure({ apiKey });
      } catch (e) {
        console.warn('Failed to configure RevenueCat:', e);
      }

      // If we don't have a userId yet, wait for it to arrive in the userId effect
      if (!userId) {
        setInitialized(false);
        return;
      }

      // Ensure correct app user before first fetch
      try {
        await Purchases.logIn(userId);
      } catch {}

      // Initial load for logged-in user
      try {
        try {
          const id = await Purchases.getAppUserID();
          if (id) setAppUserID(id);
        } catch {}
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo((info as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
        const offerings = await Purchases.getOfferings();
        setCurrentOffering(offerings.current as unknown as PurchasesOffering | undefined);
        setOfferingsError(undefined);
      } catch (e: any) {
        setCurrentOffering(undefined);
        setOfferingsError(e?.message || 'Failed to fetch offerings');
      } finally {
        setInitialized(true);
      }
    };

    init();

    const remove = Purchases.addCustomerInfoUpdateListener((ci) => {
      setCustomerInfo((ci as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
    });
    return () => {
      if (typeof remove === 'function') {
        (remove as unknown as () => void)();
      }
    };
  }, []);

  // Keep Purchases user in sync - only login, avoid logout unless really needed
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Debounce the sync to prevent rapid successive calls
    syncTimeoutRef.current = setTimeout(async () => {
      const sync = async () => {
      try {
        // Only make changes if userId actually changed
        if (prevUserIdRef.current === userId) return;
        
        console.log('🔄 RevenueCat user sync:', { from: prevUserIdRef.current, to: userId });
        
        if (userId && userId !== prevUserIdRef.current) {
          await Purchases.logIn(userId);
          // Refresh customer info after login
          try {
            const id = await Purchases.getAppUserID();
            if (id) setAppUserID(id);
            const info = await Purchases.getCustomerInfo();
            setCustomerInfo((info as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
            const offerings = await Purchases.getOfferings();
            setCurrentOffering(offerings.current as unknown as PurchasesOffering | undefined);
            setOfferingsError(undefined);
          } catch (e: any) {
            setCurrentOffering(undefined);
            setOfferingsError(e?.message || 'Failed to fetch offerings');
          }
          setInitialized(true);
          prevUserIdRef.current = userId;
        } else if (!userId && prevUserIdRef.current) {
          // Only logout if we had a real user before
          console.log('🚪 RevenueCat logout triggered');
          await Purchases.logOut();
          setInitialized(false);
          prevUserIdRef.current = userId;
        }
      } catch (e) {
        console.warn('RevenueCat sync error:', e);
        }
      };
      
      await sync();
    }, 150); // 150ms debounce
    
    // Cleanup function
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [userId]);

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

  const refresh = async () => {
    try {
      try {
        const id = await Purchases.getAppUserID();
        if (id) setAppUserID(id);
      } catch {}
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo((info as unknown as RevenueCatCustomerInfo) || { entitlements: { active: {} } });
      const offerings = await Purchases.getOfferings();
      setCurrentOffering(offerings.current as unknown as PurchasesOffering | undefined);
      setOfferingsError(undefined);
    } catch (e: any) {
      setCurrentOffering(undefined);
      setOfferingsError(e?.message || 'Failed to fetch offerings');
    }
  };

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


