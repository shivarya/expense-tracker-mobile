/**
 * Defensive wrapper around `expo-iap` (Google Play / App Store billing).
 *
 * Why expo-iap (not react-native-iap)? The v15 line is Nitro-Modules-based and
 * needs C++/CMake plumbing this Expo project doesn't have; the v12 line no
 * longer compiles against React Native 0.81. `expo-iap` is the Expo-blessed
 * library that supports the current Expo SDK without a custom dev client.
 *
 * Everything here degrades gracefully — `isBillingAvailable()` returns false if
 * the module isn't installed or the native runtime isn't present, so the rest
 * of the app never crashes importing it.
 */

export const PRODUCT_MONTHLY = 'premium_monthly';
export const PRODUCT_YEARLY = 'premium_yearly';
export const SUBSCRIPTION_SKUS = [PRODUCT_MONTHLY, PRODUCT_YEARLY];

let ExpoIap: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoIap = require('expo-iap');
} catch {
  ExpoIap = null;
}

export interface NormalizedPurchase {
  productId: string;
  purchaseToken: string;
  raw: any;
}

export function isBillingAvailable(): boolean {
  return !!ExpoIap && typeof ExpoIap.initConnection === 'function';
}

export async function initBilling(): Promise<boolean> {
  if (!isBillingAvailable()) return false;
  try {
    await ExpoIap.initConnection();
    return true;
  } catch {
    return false;
  }
}

export async function endBilling(): Promise<void> {
  if (!isBillingAvailable()) return;
  try { await ExpoIap.endConnection(); } catch {}
}

/** Fetch subscription product details for display. */
export async function getSubscriptionProducts(): Promise<any[]> {
  if (!isBillingAvailable()) return [];
  try {
    // expo-iap unifies inapp + subs under fetchProducts({ skus, type }).
    const products = await ExpoIap.fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

/**
 * Start a subscription purchase. Result is event-based — register listeners
 * with registerPurchaseListeners before calling this. For Android subscriptions
 * an offerToken is required (read from the product's subscriptionOfferDetails).
 */
export async function requestSubscription(sku: string, offerToken?: string): Promise<void> {
  if (!isBillingAvailable()) {
    throw new Error('In-app billing is not available in this build.');
  }
  await ExpoIap.requestPurchase({
    request: {
      android: {
        skus: [sku],
        subscriptionOffers: offerToken ? [{ sku, offerToken }] : undefined,
      },
      ios: {
        sku,
      },
    },
    type: 'subs',
  });
}

export function normalizePurchase(purchase: any): NormalizedPurchase {
  return {
    productId: purchase?.productId ?? (Array.isArray(purchase?.productIds) ? purchase.productIds[0] : '') ?? '',
    purchaseToken: purchase?.purchaseToken ?? purchase?.purchaseTokenAndroid ?? purchase?.transactionReceipt ?? '',
    raw: purchase,
  };
}

/** Restore: existing entitlements the user already owns. */
export async function getOwnedPurchases(): Promise<NormalizedPurchase[]> {
  if (!isBillingAvailable()) return [];
  try {
    const purchases = await ExpoIap.getAvailablePurchases();
    return (purchases ?? []).map(normalizePurchase).filter((p: NormalizedPurchase) => p.purchaseToken);
  } catch {
    return [];
  }
}

export async function finishPurchase(purchase: any): Promise<void> {
  if (!isBillingAvailable() || !ExpoIap.finishTransaction) return;
  try {
    await ExpoIap.finishTransaction({ purchase, isConsumable: false });
  } catch {}
}

/** Register purchase / error listeners. Returns an unsubscribe function. */
export function registerPurchaseListeners(
  onPurchase: (purchase: any) => void,
  onError: (error: any) => void
): () => void {
  if (!isBillingAvailable()) return () => {};
  const sub = ExpoIap.purchaseUpdatedListener?.(onPurchase);
  const errSub = ExpoIap.purchaseErrorListener?.(onError);
  return () => {
    try { sub?.remove?.(); } catch {}
    try { errSub?.remove?.(); } catch {}
  };
}

/** Pull the first Android offerToken for a subscription product, if present. */
export function firstOfferToken(product: any): string | undefined {
  // expo-iap shape: product.subscriptionOfferDetailsAndroid[0]?.offerToken
  // (also accept the legacy react-native-iap shape for safety).
  const offer =
    product?.subscriptionOfferDetailsAndroid?.[0] ??
    product?.subscriptionOfferDetails?.[0];
  return offer?.offerToken;
}
