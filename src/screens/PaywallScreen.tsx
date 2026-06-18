import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { BillingStatus } from '../types/transactions';
import {
  PRODUCT_MONTHLY,
  PRODUCT_YEARLY,
  initBilling,
  endBilling,
  getSubscriptionProducts,
  requestSubscription,
  registerPurchaseListeners,
  normalizePurchase,
  finishPurchase,
  getOwnedPurchases,
  firstOfferToken,
  isBillingAvailable,
} from '../services/billing';

const PLAN_FALLBACK: Record<string, { title: string; price: string; note?: string }> = {
  [PRODUCT_MONTHLY]: { title: 'Monthly', price: '₹99 / month' },
  [PRODUCT_YEARLY]: { title: 'Yearly', price: '₹799 / year', note: 'Save ~33%' },
};

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const PaywallScreen = () => {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setBilling(await ApiService.getBillingStatus());
    } catch {
      /* keep prior */
    }
  }, []);

  const handlePurchase = useCallback(async (purchase: any) => {
    const { productId, purchaseToken } = normalizePurchase(purchase);
    if (!purchaseToken) return;
    try {
      const status = await ApiService.verifyPurchase(productId, purchaseToken);
      setBilling(status);
      await finishPurchase(purchase);
      Alert.alert('Premium active', 'Thank you! Your subscription is now active.');
    } catch (error: any) {
      Alert.alert('Verification failed', getApiErrorMessage(error, 'Could not verify the purchase.'));
    } finally {
      setBuying(null);
    }
  }, []);

  const unsubRef = useRef<() => void>(() => {});

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshStatus();
      const ok = await initBilling();
      setBillingReady(ok);
      if (ok) {
        setProducts(await getSubscriptionProducts());
        unsubRef.current = registerPurchaseListeners(handlePurchase, (err: any) => {
          setBuying(null);
          if (err?.code !== 'E_USER_CANCELLED') {
            Alert.alert('Purchase error', err?.message || 'The purchase could not be completed.');
          }
        });
      }
      setLoading(false);
    })();
    return () => {
      unsubRef.current?.();
      endBilling();
    };
  }, [handlePurchase, refreshStatus]);

  const priceFor = (sku: string): string => {
    const product = products.find((p) => p.productId === sku);
    const phase = product?.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0];
    return phase?.formattedPrice || PLAN_FALLBACK[sku]?.price || '';
  };

  const buy = async (sku: string) => {
    if (!billingReady) {
      Alert.alert('Unavailable', 'In-app purchases are not available in this build yet.');
      return;
    }
    const product = products.find((p) => p.productId === sku);
    setBuying(sku);
    try {
      await requestSubscription(sku, firstOfferToken(product));
    } catch (error: any) {
      setBuying(null);
      Alert.alert('Purchase failed', getApiErrorMessage(error, 'Could not start the purchase.'));
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const owned = await getOwnedPurchases();
      for (const p of owned) {
        try {
          setBilling(await ApiService.verifyPurchase(p.productId, p.purchaseToken));
        } catch {
          /* skip */
        }
      }
      Alert.alert('Restore', owned.length ? 'Purchases restored.' : 'No previous purchases found.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isPremium = !!billing?.premium;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.card }]}>
        <Ionicons name="sparkles" size={32} color={colors.primary} />
        <Text style={[styles.heroTitle, { color: colors.text }]}>Expense Tracker Premium</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
          Automatic Gmail statement sync (credit cards, mutual funds, CDSL, NPS) and AI-grade
          categorization — hands-free.
        </Text>
      </View>

      {isPremium ? (
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>You have Premium</Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
              {billing?.enforced === false
                ? 'Premium is currently enabled for all users.'
                : `${billing?.status ?? 'active'}${billing?.expiry_time ? ` · renews/expires ${billing.expiry_time}` : ''}`}
            </Text>
          </View>
        </View>
      ) : (
        <>
          {[PRODUCT_YEARLY, PRODUCT_MONTHLY].map((sku) => (
            <TouchableOpacity
              key={sku}
              style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => buy(sku)}
              disabled={buying !== null}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.planTitle, { color: colors.text }]}>
                  {PLAN_FALLBACK[sku]?.title}
                  {PLAN_FALLBACK[sku]?.note ? `  ·  ${PLAN_FALLBACK[sku]?.note}` : ''}
                </Text>
                <Text style={[styles.planPrice, { color: colors.textSecondary }]}>{priceFor(sku)}</Text>
              </View>
              {buying === sku ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={[styles.buyBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.buyBtnText, { color: colors.background }]}>Subscribe</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            7-day free trial, then auto-renews. Cancel anytime in Google Play. Billed via your
            Play account.
          </Text>

          <TouchableOpacity style={styles.restoreBtn} onPress={restore} disabled={restoring}>
            {restoring ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.restoreText, { color: colors.primary }]}>Restore purchases</Text>
            )}
          </TouchableOpacity>

          {!isBillingAvailable() && (
            <Text style={[styles.fineprint, { color: colors.warning }]}>
              In-app purchases aren’t available in this build yet. Update the app from the Play
              Store once Premium is live.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  hero: { borderRadius: 14, padding: 20, alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  statusCard: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 16 },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusSub: { fontSize: 13, marginTop: 2 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 16 },
  planTitle: { fontSize: 16, fontWeight: '700' },
  planPrice: { fontSize: 14, marginTop: 2 },
  buyBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  buyBtnText: { fontSize: 14, fontWeight: '700' },
  fineprint: { fontSize: 12, lineHeight: 17 },
  restoreBtn: { alignItems: 'center', paddingVertical: 10 },
  restoreText: { fontSize: 14, fontWeight: '600' },
});

export default PaywallScreen;
