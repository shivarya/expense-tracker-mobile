import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import ApiService from '../services/api';
import { Subscription } from '../types/subscriptions';
import { formatCurrency, formatDateLong } from '../utils/format';

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const CYCLE_LABEL: Record<Subscription['billing_cycle'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const SubscriptionsScreen = () => {
  const { colors, isDark } = useTheme();
  const { subscriptions, refreshSubscriptions } = useData();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingUrlId, setEditingUrlId] = useState<number | null>(null);
  const [urlInput, setUrlInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      refreshSubscriptions();
    }, [refreshSubscriptions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshSubscriptions();
    setRefreshing(false);
  };

  const runScan = async () => {
    try {
      setScanning(true);
      const result = await ApiService.scanForSubscriptions();
      await refreshSubscriptions();
      Alert.alert(
        'Scan Complete',
        result.created > 0
          ? `Found ${result.created} new subscription${result.created === 1 ? '' : 's'}.`
          : 'No new subscriptions found. This looks for merchants charging you a similar amount on a regular cycle — it improves automatically as more transaction history builds up.'
      );
    } catch (error: any) {
      Alert.alert('Scan failed', getApiErrorMessage(error, 'Could not scan for subscriptions.'));
    } finally {
      setScanning(false);
    }
  };

  const cancelSubscription = (sub: Subscription) => {
    Alert.alert(
      'Cancel Subscription',
      `Opens ${sub.display_name}'s cancellation page in your browser.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Link',
          onPress: async () => {
            if (sub.cancel_url) {
              await Linking.openURL(sub.cancel_url);
            }
            Alert.alert('Did you cancel it?', `Mark "${sub.display_name}" as cancelled so it stops showing as active?`, [
              { text: 'Not yet', style: 'cancel' },
              {
                text: 'Yes, mark cancelled',
                onPress: async () => {
                  try {
                    setBusyId(sub.id);
                    await ApiService.updateSubscription(sub.id, { status: 'deactivated' });
                    await refreshSubscriptions();
                  } catch (error: any) {
                    Alert.alert('Error', getApiErrorMessage(error, 'Failed to update subscription'));
                  } finally {
                    setBusyId(null);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const dismissSubscription = (sub: Subscription) => {
    Alert.alert(
      'Not a Subscription',
      `Mark "${sub.display_name}" as not a subscription? It will be removed from this list and won't be detected again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Not a Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId(sub.id);
              await ApiService.updateSubscription(sub.id, { status: 'dismissed' });
              await refreshSubscriptions();
            } catch (error: any) {
              Alert.alert('Error', getApiErrorMessage(error, 'Failed to update subscription'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const startEditUrl = (sub: Subscription) => {
    setUrlInput(sub.cancel_url || '');
    setEditingUrlId(sub.id);
  };

  const saveUrl = async (sub: Subscription) => {
    try {
      setBusyId(sub.id);
      await ApiService.updateSubscription(sub.id, { cancel_url: urlInput.trim() || undefined });
      await refreshSubscriptions();
      setEditingUrlId(null);
    } catch (error: any) {
      Alert.alert('Error', getApiErrorMessage(error, 'Failed to save link'));
    } finally {
      setBusyId(null);
    }
  };

  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const otherSubs = subscriptions.filter((s) => s.status !== 'active');
  const estimatedMonthlyTotal = activeSubs.reduce((sum, s) => {
    const amt = Number(s.average_amount);
    if (s.billing_cycle === 'weekly') return sum + amt * 4.33;
    if (s.billing_cycle === 'quarterly') return sum + amt / 3;
    if (s.billing_cycle === 'annual') return sum + amt / 12;
    return sum + amt;
  }, 0);

  const renderCard = (sub: Subscription) => {
    const avatarLetter = sub.display_name.trim().charAt(0).toUpperCase() || '?';
    const isBusy = busyId === sub.id;

    return (
      <View key={sub.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{avatarLetter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subName, { color: colors.text }]}>{sub.display_name}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { borderColor: colors.border }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{CYCLE_LABEL[sub.billing_cycle]}</Text>
              </View>
              {sub.status === 'deactivated' && (
                <View style={[styles.badge, { borderColor: colors.warning }]}>
                  <Text style={[styles.badgeText, { color: colors.warning }]}>Cancelled</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.subAmount, { color: colors.text }]}>{formatCurrency(Number(sub.average_amount), 0)}</Text>
        </View>

        {sub.status === 'active' && sub.next_expected_date && (
          <Text style={[styles.nextDate, { color: colors.textSecondary }]}>
            Next expected: {formatDateLong(sub.next_expected_date)}
          </Text>
        )}
        <Text style={[styles.occurrenceCaption, { color: colors.textSecondary }]}>
          Seen {sub.occurrence_count}× · since {formatDateLong(sub.first_transaction_date)}
        </Text>

        {editingUrlId === sub.id ? (
          <View style={styles.urlEditRow}>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="Cancellation link"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.urlInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <TouchableOpacity onPress={() => saveUrl(sub)} disabled={isBusy} hitSlop={8}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingUrlId(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => startEditUrl(sub)} style={styles.linkRow}>
            <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.linkText, { color: colors.textSecondary }]} numberOfLines={1}>
              {sub.cancel_url || 'Add cancellation link'}
            </Text>
          </TouchableOpacity>
        )}

        {sub.status === 'active' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => cancelSubscription(sub)}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={15} color={colors.warning} />
                  <Text style={[styles.actionBtnText, { color: colors.warning }]}>Deactivate</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => dismissSubscription(sub)}
              disabled={isBusy}
            >
              <Ionicons name="close-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Not a Subscription</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {activeSubs.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>ESTIMATED MONTHLY SPEND</Text>
          <Text style={[styles.summaryAmount, { color: colors.text }]}>{formatCurrency(estimatedMonthlyTotal, 0)}</Text>
          <Text style={[styles.summaryCaption, { color: colors.textSecondary }]}>
            across {activeSubs.length} active subscription{activeSubs.length === 1 ? '' : 's'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.scanButton, { backgroundColor: colors.primary, opacity: scanning ? 0.7 : 1 }]}
        onPress={runScan}
        disabled={scanning}
      >
        {scanning ? (
          <ActivityIndicator color={isDark ? '#000' : '#fff'} />
        ) : (
          <>
            <Ionicons name="search-outline" size={18} color={isDark ? '#000' : '#fff'} />
            <Text style={[styles.scanButtonText, { color: isDark ? '#000' : '#fff' }]}>
              {subscriptions.length === 0 ? 'Scan for Subscriptions' : 'Re-scan for Subscriptions'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.addManualButton, { borderColor: colors.border }]}
        onPress={() => navigation.navigate('AddSubscription')}
      >
        <Ionicons name="add-outline" size={16} color={colors.text} />
        <Text style={[styles.addManualButtonText, { color: colors.text }]}>Add Subscription Manually</Text>
      </TouchableOpacity>

      {subscriptions.length === 0 && !scanning && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Looks for recurring merchant charges (Netflix, gym, insurance, SaaS...) in your transaction history based on
          repeating amounts and cadence. Tap above to run it.
        </Text>
      )}

      {activeSubs.map(renderCard)}

      {otherSubs.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CANCELLED</Text>
          {otherSubs.map(renderCard)}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: 'center', gap: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  summaryAmount: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  summaryCaption: { fontSize: 12 },
  scanButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  scanButtonText: { fontSize: 15, fontWeight: '700' },
  addManualButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addManualButtonText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 12, lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  subName: { fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  subAmount: { fontSize: 16, fontWeight: '800' },
  nextDate: { fontSize: 13, fontWeight: '600' },
  occurrenceCaption: { fontSize: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontSize: 12, flex: 1 },
  urlEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urlInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});

export default SubscriptionsScreen;
