/**
 * Web stub for billing.ts. In-app billing (Google Play/App Store) has no web
 * equivalent, so every export here is an inert no-op — this file exists so
 * `require('expo-iap')` is never even attempted in the web bundle (a bundle-
 * time resolution risk the native file's try/catch can't help with, unlike
 * a plain runtime failure).
 */

export const PRODUCT_MONTHLY = 'premium_monthly';
export const PRODUCT_YEARLY = 'premium_yearly';
export const SUBSCRIPTION_SKUS = [PRODUCT_MONTHLY, PRODUCT_YEARLY];

export interface NormalizedPurchase {
  productId: string;
  purchaseToken: string;
  raw: any;
}

export function isBillingAvailable(): boolean {
  return false;
}

export async function initBilling(): Promise<boolean> {
  return false;
}

export async function endBilling(): Promise<void> {}

export async function getSubscriptionProducts(): Promise<any[]> {
  return [];
}

export async function requestSubscription(_sku: string, _offerToken?: string): Promise<void> {
  throw new Error('In-app billing is not available on web.');
}

export function normalizePurchase(purchase: any): NormalizedPurchase {
  return {
    productId: purchase?.productId ?? '',
    purchaseToken: purchase?.purchaseToken ?? '',
    raw: purchase,
  };
}

export async function getOwnedPurchases(): Promise<NormalizedPurchase[]> {
  return [];
}

export async function finishPurchase(_purchase: any): Promise<void> {}

export function registerPurchaseListeners(
  _onPurchase: (purchase: any) => void,
  _onError: (error: any) => void
): () => void {
  return () => {};
}

export function firstOfferToken(_product: any): string | undefined {
  return undefined;
}
