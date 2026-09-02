import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { PieChart } from 'react-native-gifted-charts';
import { formatCurrency, formatCompactCurrency, formatPercent, toLocalDateString } from '../utils/format';
import ApiService from '../services/api';
import { Category } from '../types/transactions';
import CategoryPickerModal from '../components/CategoryPickerModal';

const CHART_COLORS = ['#FF4757', '#2B7BE5', '#FFA502', '#00C48C', '#9C27B0', '#FF6B6B'];

const DashboardScreen = () => {
  const { dashboard, accounts, emis, loading, error, refreshDashboard } = useData();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [monthExpenses, setMonthExpenses] = useState<number>(0);
  const [monthCount, setMonthCount] = useState<number>(0);
  const [monthLoading, setMonthLoading] = useState(false);

  // Net worth / portfolio value are hidden by default — someone glancing at
  // the screen shouldn't see these at a glance; tap the eye to reveal.
  const [showFinancials, setShowFinancials] = useState(false);
  const mask = (value: string) => (showFinancials ? value : '••••••');

  // Category picker state
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [localTransactions, setLocalTransactions] = useState<any[]>([]);

  const fetchCurrentMonthExpenses = async () => {
    try {
      setMonthLoading(true);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const result = await ApiService.getTransactions({ start_date: toLocalDateString(start), end_date: toLocalDateString(end), type: 'debit', limit: 200 });
      const total = result.summary?.total_debit
        ?? result.transactions?.reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
        ?? 0;
      setMonthExpenses(Number(total));
      setMonthCount(result.transactions?.length ?? 0);
    } catch (e) {
      // silent - non-critical
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCurrentMonthExpenses();
  }, [user]);

  // Fetch categories once
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await ApiService.getCategories();
        setCategories(cats);
      } catch (_) { /* silent */ }
    };
    if (user) loadCategories();
  }, [user]);

  // Sync local transactions from dashboard
  useEffect(() => {
    if (dashboard?.recent_transactions) {
      setLocalTransactions(dashboard.recent_transactions);
    }
  }, [dashboard?.recent_transactions]);

  const handleCategoryTap = useCallback((txn: any) => {
    setSelectedTxn(txn);
    setShowCategoryPicker(true);
  }, []);

  const handleCategorySelect = useCallback(async (categoryId: number) => {
    if (!selectedTxn) return;
    setShowCategoryPicker(false);
    try {
      const result = await ApiService.updateTransactionCategory(selectedTxn.id, categoryId);
      // Update local state immediately
      setLocalTransactions(prev =>
        prev.map(t =>
          t.id === selectedTxn.id
            ? { ...t, category_id: categoryId, category_name: result.category_name, category_color: result.category_color, category_icon: result.category_icon }
            : t
        )
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update category');
    }
    setSelectedTxn(null);
  }, [selectedTxn]);

  const handleRefresh = async () => {
    await refreshDashboard();
    await fetchCurrentMonthExpenses();
  };

  const openCurrentMonthTransactions = () => {
    navigation.navigate('Expenses', {
      initial: false,
      screen: 'Transactions',
      params: {
        headerTitle: 'Transactions',
        initialMonthKey: 'current',
      },
    });
  };

  if (loading && !dashboard) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.error} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  if (error && !dashboard) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.error }]} onPress={handleRefresh}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const portfolio = dashboard?.portfolio;
  const totalCurrent = Number(portfolio?.total_current_value || 0);
  const totalInvested = Number(portfolio?.total_invested || 0);
  const gainLossAmt = Number(portfolio?.overall_gain_loss_amount || 0);
  const gainLossPct = Number(portfolio?.overall_gain_loss || 0);
  const isGain = gainLossAmt >= 0;

  const savingsBalance = accounts
    .filter(a => a.account_type === 'savings' || a.account_type === 'current')
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const creditCardDebt = accounts
    .filter(a => a.account_type === 'credit_card')
    .reduce((sum, a) => sum + (Number(a.credit_limit || 0) - Number(a.available_credit || 0)), 0);
  const homeLoanDebt = emis
    .filter(e => e.loan_type === 'home' && e.status === 'active')
    .reduce((sum, e) => sum + Number(e.remaining_principal ?? e.principal_amount), 0);
  const netWorth = totalCurrent + savingsBalance - creditCardDebt - homeLoanDebt;
  const hasLiabilities = creditCardDebt > 0 || homeLoanDebt > 0;

  const pieData = (portfolio?.summary || []).map((item: any, i: number) => ({
    value: Number(item.current_value),
    label: item.category,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.error} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
          {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Net Worth (true figure: portfolio + cash − credit card debt − loan balances) */}
      {hasLiabilities && (
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}>
          <View style={styles.heroLabelRow}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NET WORTH</Text>
            <TouchableOpacity onPress={() => setShowFinancials(v => !v)} hitSlop={10}>
              <Ionicons name={showFinancials ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.heroValue, { color: colors.text }]}>
            {mask(formatCompactCurrency(netWorth))}
          </Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Text style={[styles.heroMetaLabel, { color: colors.textSecondary }]}>ASSETS</Text>
              <Text style={[styles.heroMetaValue, { color: colors.success }]}>
                {mask(formatCompactCurrency(totalCurrent + savingsBalance))}
              </Text>
            </View>
            <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroMetaItem}>
              <Text style={[styles.heroMetaLabel, { color: colors.textSecondary }]}>LIABILITIES</Text>
              <Text style={[styles.heroMetaValue, { color: colors.error }]}>
                {mask('−' + formatCompactCurrency(creditCardDebt + homeLoanDebt))}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Portfolio Value Hero Card (investments only — stocks + MF + FD + long-term) */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroLabelRow}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PORTFOLIO VALUE</Text>
          <TouchableOpacity onPress={() => setShowFinancials(v => !v)} hitSlop={10}>
            <Ionicons name={showFinancials ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.heroValue, { color: colors.text }]}>
          {mask(formatCompactCurrency(totalCurrent))}
        </Text>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <Text style={[styles.heroMetaLabel, { color: colors.textSecondary }]}>INVESTED</Text>
            <Text style={[styles.heroMetaValue, { color: colors.text }]}>{mask(formatCompactCurrency(totalInvested))}</Text>
          </View>
          <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroMetaItem}>
            <Text style={[styles.heroMetaLabel, { color: colors.textSecondary }]}>RETURNS</Text>
            <Text style={[styles.heroMetaValue, { color: isGain ? colors.success : colors.error }]}>
              {mask((isGain ? '+' : '') + formatPercent(gainLossPct))}
            </Text>
          </View>
          <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroMetaItem}>
            <Text style={[styles.heroMetaLabel, { color: colors.textSecondary }]}>P&L</Text>
            <Text style={[styles.heroMetaValue, { color: isGain ? colors.success : colors.error }]}>
              {mask((isGain ? '+' : '') + formatCompactCurrency(gainLossAmt))}
            </Text>
          </View>
        </View>
      </View>

      {/* Current Month Expenses */}
      <TouchableOpacity
        style={[styles.monthCard, { backgroundColor: colors.error }]}
        activeOpacity={0.9}
        onPress={openCurrentMonthTransactions}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.monthLabel}>{monthName.toUpperCase()} SPENT</Text>
          <Text style={styles.monthValue}>
            {monthLoading ? '...' : formatCompactCurrency(monthExpenses)}
          </Text>
          {!monthLoading && monthCount > 0 && (
            <Text style={styles.monthSub}>{monthCount} transactions this month</Text>
          )}
          {!monthLoading && monthCount === 0 && (
            <Text style={styles.monthSub}>No expenses recorded yet</Text>
          )}
        </View>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>THIS{'\n'}MONTH</Text>
        </View>
      </TouchableOpacity>

      {/* Portfolio Split */}
      {pieData.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PORTFOLIO SPLIT</Text>
          <View style={styles.pieRow}>
            <PieChart
              data={pieData}
              donut
              radius={80}
              innerRadius={50}
              centerLabelComponent={() => (
                <View style={styles.pieCenterLabel}>
                  <Text style={[styles.pieCenterValue, { color: colors.text }]}>
                    {formatCompactCurrency(totalCurrent)}
                  </Text>
                  <Text style={[styles.pieCenterSub, { color: colors.textSecondary }]}>total</Text>
                </View>
              )}
            />
            <View style={styles.pieLegend}>
              {pieData.map((item: any, i: number) => {
                const pct = totalCurrent > 0 ? ((item.value / totalCurrent) * 100).toFixed(0) : '0';
                return (
                  <View key={i} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <View style={styles.legendContent}>
                      <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                      <Text style={[styles.legendValue, { color: colors.text }]}>{formatCompactCurrency(item.value)}</Text>
                    </View>
                    <Text style={[styles.legendPct, { color: colors.textSecondary }]}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RECENT TRANSACTIONS</Text>
        {(localTransactions || []).slice(0, 8).map((txn: any, i: number, arr: any[]) => (
          <View key={txn.id}>
            <View style={styles.txnRow}>
              <View style={[styles.txnIcon, {
                backgroundColor: txn.transaction_type === 'credit'
                  ? colors.success + '22'
                  : colors.error + '22',
              }]}>
                <Text style={[styles.txnArrow, {
                  color: txn.transaction_type === 'credit' ? colors.success : colors.error,
                }]}>
                  {txn.transaction_type === 'credit' ? '↙' : '↗'}
                </Text>
              </View>
              <View style={styles.txnInfo}>
                <Text style={[styles.txnMerchant, { color: colors.text }]} numberOfLines={1}>
                  {txn.merchant || txn.description || 'Transaction'}
                </Text>
                <View style={styles.txnSubRow}>
                  <Text style={[styles.txnDate, { color: colors.textSecondary }]}>
                    {new Date(txn.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleCategoryTap(txn)}
                    activeOpacity={0.6}
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: (txn.category_color || colors.textSecondary) + '18' },
                    ]}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: txn.category_color || colors.textSecondary }]} />
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        { color: txn.category_color || colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {txn.category_name || 'Uncategorized'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.txnAmount, {
                color: txn.transaction_type === 'credit' ? colors.success : colors.error,
              }]}>
                {txn.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(txn.amount))}
              </Text>
            </View>
            {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
          </View>
        ))}
        {(!localTransactions || localTransactions.length === 0) && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent transactions</Text>
        )}
      </View>

      {/* Category Picker Modal */}
      <CategoryPickerModal
        visible={showCategoryPicker}
        onClose={() => { setShowCategoryPicker(false); setSelectedTxn(null); }}
        categories={categories}
        onSelect={handleCategorySelect}
        currentCategoryId={selectedTxn?.category_id}
      />

      {/* Upcoming EMIs */}
      {dashboard && dashboard.upcoming_emis.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>UPCOMING EMIS</Text>
          {dashboard.upcoming_emis.map((emi: any, i: number, arr: any[]) => {
            const paid = Number(emi.paid_installments) || 0;
            const total = Number(emi.total_installments) || 0;
            const progress = total > 0 ? paid / total : 0;
            const loanColors: Record<string, string> = {
              home: colors.success,
              personal: colors.warning,
              car: '#2B7BE5',
              consumer_durable: '#9C27B0',
            };
            const badgeColor = loanColors[emi.loan_type] || colors.textSecondary;
            return (
              <View key={emi.id}>
                <View style={styles.emiRow}>
                  <View style={styles.emiInfo}>
                    <View style={styles.emiNameRow}>
                      <Text style={[styles.emiName, { color: colors.text }]}>{emi.loan_name}</Text>
                      {emi.loan_type && (
                        <View style={[styles.loanBadge, { borderColor: badgeColor }]}>
                          <Text style={[styles.loanBadgeText, { color: badgeColor }]}>
                            {emi.loan_type.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.emiDue, { color: colors.warning }]}>
                      {'Due ' + new Date(emi.next_payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                    {total > 0 && (
                      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { width: (progress * 100) + '%' as any, backgroundColor: colors.success }]} />
                      </View>
                    )}
                    {total > 0 && (
                      <Text style={[styles.emiProgress, { color: colors.textSecondary }]}>{paid}/{total} paid</Text>
                    )}
                  </View>
                  <Text style={[styles.emiAmount, { color: colors.text }]}>{formatCurrency(Number(emi.emi_amount))}</Text>
                </View>
                {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 24 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateLabel: {
    fontSize: 13,
    marginTop: 3,
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroMetaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroMetaDivider: {
    width: 1,
    height: 36,
  },
  monthCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  monthValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.8,
  },
  monthSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
  },
  monthBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginLeft: 12,
    alignItems: 'center',
  },
  monthBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 20,
  },
  pieCenterLabel: { alignItems: 'center' },
  pieCenterValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  pieCenterSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  pieLegend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendContent: { flex: 1 },
  legendLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnArrow: {
    fontSize: 18,
    fontWeight: '700',
  },
  txnInfo: { flex: 1 },
  txnMerchant: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  txnDate: {
    fontSize: 12,
  },
  txnSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
    maxWidth: 120,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    marginLeft: 50,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  emiInfo: { flex: 1 },
  emiNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  emiName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  loanBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  loanBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emiDue: {
    fontSize: 12,
    marginBottom: 6,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  emiProgress: { fontSize: 11 },
  emiAmount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bottomPad: { height: 16 },
});

export default DashboardScreen;
