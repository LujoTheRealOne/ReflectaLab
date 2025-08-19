export type RevenueCatActiveEntitlements = Record<string, unknown>;

export type RevenueCatCustomerInfo = {
  entitlements: {
    active: RevenueCatActiveEntitlements;
  };
  // you can add more fields if needed later
};

export type RevenueCatPackage = {
  identifier: string;
  // add product info fields if you need them in UI later
};

export type RevenueCatOffering = {
  identifier?: string;
  availablePackages?: RevenueCatPackage[];
} | undefined;

export type UseRevenueCatResult = {
  initialized: boolean;
  isPro: boolean;
  customerInfo: RevenueCatCustomerInfo; // never null
  currentOffering?: RevenueCatOffering; // optional if not available
  offeringsError?: string; // optional if no error
  activeEntitlementIds: string[];
  appUserID?: string;
  refresh: () => Promise<void>;
  presentPaywall: (opts?: { offering?: RevenueCatOffering; requiredEntitlementIdentifier?: string }) => Promise<boolean>;
  presentPaywallIfNeeded: (requiredEntitlementIdentifier?: string, offering?: RevenueCatOffering) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
};

/**
 * RevenueCat Event Types for Subscription Lifecycle Tracking
 */
export type RevenueCatEvent = 
  | { type: 'SUBSCRIPTION_PURCHASED'; entitlementId: string; productId: string; price: number; currency: string }
  | { type: 'SUBSCRIPTION_RENEWED'; entitlementId: string; productId: string }
  | { type: 'SUBSCRIPTION_CANCELLED'; entitlementId: string; reason: 'USER_INITIATED' | 'BILLING_ERROR' | 'REFUND' }
  | { type: 'TRIAL_STARTED'; entitlementId: string; trialDays: number }
  | { type: 'TRIAL_ENDED'; entitlementId: string; converted: boolean }
  | { type: 'PAYWALL_SHOWN'; offeringId?: string; source: 'COACHING' | 'VOICE_TRANSCRIPTION' | 'SETTINGS' }
  | { type: 'PAYWALL_DISMISSED'; offeringId?: string; reason: 'USER_CANCELLED' | 'PURCHASED' | 'ERROR' }
  | { type: 'PURCHASE_RESTORED'; entitlementIds: string[] }
  | { type: 'BILLING_ISSUE_DETECTED'; entitlementId: string }
  | { type: 'SUBSCRIPTION_EXPIRED'; entitlementId: string };

/**
 * Event listener interface for subscription events
 */
export interface RevenueCatEventListener {
  onEvent: (event: RevenueCatEvent) => void;
}

/**
 * Constants for entitlement and product IDs
 */
export const ENTITLEMENT_IDS = {
  PRO: 'reflecta_pro',
} as const;

export const PRODUCT_IDS = {
  PRO_MONTHLY: 'pro_monthly',
  PRO_YEARLY: 'pro_yearly',
  PRO_MONTHLY_SUB: 'pro_monthly_sub',
  SUBSCRIPTION_YEARLY: 'subscription_yearly',
} as const;

/**
 * Helper function to check if user has active entitlement
 */
export function hasActiveEntitlement(
  customerInfo: RevenueCatCustomerInfo,
  entitlementId: string
): boolean {
  return !!customerInfo.entitlements?.active?.[entitlementId];
}

