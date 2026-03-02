import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { Category, Transaction } from '../types/transactions';
import ApiService from '../services/api';
import { formatCurrency } from '../utils/format';
import CategoryPickerModal from '../components/CategoryPickerModal';

type DateRangeKey = 'all' | '7d' | '30d' | '90d';
type TxnType = 'all' | 'debit' | 'credit';

interface RouteParams {
  categoryId?: number;
  categoryName?: string;
  startDate?: string;
  endDate?: string;
  initialMonthKey?: 'current';
}

interface MonthOption {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthOptions = (monthsBack: number = 6): MonthOption[] => {
  const now = new Date();
  const options: MonthOption[] = [];

  for (let offset = 0; offset < monthsBack; offset += 1) {
    const base = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    options.push({
      key: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`,
      label: base.toLocaleDateString('en-IN', { month: 'short' }),
      startDate: formatDate(start),
      endDate: formatDate(end),
    });
  }

  return options;
};

const getRangeDates = (key: DateRangeKey): { startDate?: string; endDate?: string } => {
  if (key === 'all') return {};
  const now = new Date();
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return { startDate: formatDate(start), endDate: formatDate(now) };
};

const TransactionsScreen = () => {
  const { colors, isDark } = useTheme();
  const { categories, refreshCategories } = useData();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;

  const monthOptions = useMemo(() => getMonthOptions(6), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(params.initialMonthKey === 'current' ? getCurrentMonthKey() : 'all');
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>('30d');
  const [selectedType, setSelectedType] = useState<TxnType>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(params.categoryId);

  const [filterCategoryPickerVisible, setFilterCategoryPickerVisible] = useState(false);
  const [editCategoryPickerVisible, setEditCategoryPickerVisible] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);

  const fetchTransactions = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const monthFilter = monthOptions.find((item) => item.key === selectedMonth);
      const dateFilter = selectedMonth !== 'all'
        ? { startDate: monthFilter?.startDate, endDate: monthFilter?.endDate }
        : getRangeDates(selectedRange);

      const res = await ApiService.getTransactions({
        start_date: params.startDate ?? dateFilter.startDate,
        end_date: params.endDate ?? dateFilter.endDate,
        category_id: selectedCategoryId,
        type: selectedType === 'all' ? undefined : selectedType,
        limit: 50,
      });

      setTransactions(res.transactions || []);
      setSummary(res.summary || null);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthOptions, params.endDate, params.startDate, selectedCategoryId, selectedMonth, selectedRange, selectedType]);

  useEffect(() => {
    // Categories already loaded by DataContext on login; refresh once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshCategories();
  }, []);

  useEffect(() => {
    fetchTransactions(true);
  }, [fetchTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions(false);
  }, [fetchTransactions]);

  const onEditCategoryTap = (txn: Transaction) => {
    setSelectedTxn(txn);
    setEditCategoryPickerVisible(true);
  };

  const onDeleteTxn = (txn: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Delete "${txn.merchant || txn.description || 'this transaction'}" for ${txn.transaction_type === 'debit' ? '-' : '+'}₹${Number(txn.amount).toLocaleString('en-IN')}?\n\nIf synced from SMS, it won't be re-created on next sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteTransaction(txn.id);
              setTransactions((prev) => prev.filter((t) => t.id !== txn.id));
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete transaction');
            }
          },
        },
      ],
    );
  };

  const onSelectTxnCategory = async (categoryId: number) => {
    if (!selectedTxn) return;
    setEditCategoryPickerVisible(false);

    try {
      const res = await ApiService.updateTransactionCategory(selectedTxn.id, categoryId);
      setTransactions((prev) => prev.map((txn) => (
        txn.id === selectedTxn.id
          ? {
              ...txn,
              category_id: categoryId,
              category_name: res.category_name,
              category_color: res.category_color,
              category_icon: res.category_icon,
            }
          : txn
      )));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update category');
    } finally {
      setSelectedTxn(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                { borderColor: colors.border, backgroundColor: colors.card },
                selectedMonth === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSelectedMonth('all')}
            >
              <Text style={[styles.filterChipText, { color: selectedMonth === 'all' ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All months</Text>
            </TouchableOpacity>
            {monthOptions.map((month) => (
              <TouchableOpacity
                key={month.key}
                style={[
                  styles.filterChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  selectedMonth === month.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedMonth(month.key)}
              >
                <Text style={[styles.filterChipText, { color: selectedMonth === month.key ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{month.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.filterRowInline}>
            {(['all', '7d', '30d', '90d'] as DateRangeKey[]).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.inlineChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  selectedRange === range && { borderColor: colors.primary },
                ]}
                onPress={() => {
                  setSelectedMonth('all');
                  setSelectedRange(range);
                }}
              >
                <Text style={[styles.inlineChipText, { color: selectedRange === range ? colors.primary : colors.textSecondary }]}>
                  {range === 'all' ? 'All dates' : `Last ${range.replace('d', 'd')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterRowInline}>
            {(['all', 'debit', 'credit'] as TxnType[]).map((txnType) => (
              <TouchableOpacity
                key={txnType}
                style={[
                  styles.inlineChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  selectedType === txnType && { borderColor: colors.primary },
                ]}
                onPress={() => setSelectedType(txnType)}
              >
                <Text style={[styles.inlineChipText, { color: selectedType === txnType ? colors.primary : colors.textSecondary }]}>
                  {txnType === 'all' ? 'All types' : txnType[0].toUpperCase() + txnType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.categoryFilterRow}>
            <TouchableOpacity
              style={[styles.categoryFilterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setFilterCategoryPickerVisible(true)}
            >
              <Text style={[styles.categoryFilterLabel, { color: colors.textSecondary }]}>Category</Text>
              <Text style={[styles.categoryFilterValue, { color: selectedCategory?.color || colors.text }]}>
                {selectedCategory?.name || params.categoryName || 'All categories'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: colors.border }]}
              onPress={() => setSelectedCategoryId(undefined)}
            >
              <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Showing {transactions.length} / 50 transactions</Text>
            <Text style={[styles.summaryAmount, { color: colors.error }]}>Spent {formatCurrency(Number(summary?.total_debit || 0), 0)}</Text>
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          {transactions.map((txn, index) => (
            <View key={txn.id}>
              <TouchableOpacity
                style={styles.txnRow}
                onLongPress={() => onDeleteTxn(txn)}
                activeOpacity={0.7}
                delayLongPress={400}
              >
                <View style={[styles.txnDot, { backgroundColor: txn.transaction_type === 'credit' ? colors.success : colors.error }]} />
                <View style={styles.txnInfo}>
                  <Text style={[styles.txnMerchant, { color: colors.text }]} numberOfLines={1}>{txn.merchant || txn.description || 'Transaction'}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.txnDate, { color: colors.textSecondary }]}>{new Date(txn.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                    <TouchableOpacity
                      onPress={() => onEditCategoryTap(txn)}
                      style={[styles.badge, { backgroundColor: (txn.category_color || colors.textSecondary) + '20' }]}
                    >
                      <Text style={[styles.badgeText, { color: txn.category_color || colors.textSecondary }]} numberOfLines={1}>{txn.category_name || 'Uncategorized'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.txnAmount, { color: txn.transaction_type === 'credit' ? colors.success : colors.error }]}>
                  {txn.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(txn.amount), 0)}
                </Text>
              </TouchableOpacity>
              {index < transactions.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}

          {transactions.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions found for selected filters.</Text>
          )}
        </View>
      </ScrollView>

      <CategoryPickerModal
        visible={filterCategoryPickerVisible}
        onClose={() => setFilterCategoryPickerVisible(false)}
        categories={categories}
        currentCategoryId={selectedCategoryId}
        onSelect={(categoryId) => {
          setSelectedCategoryId(categoryId);
          setFilterCategoryPickerVisible(false);
        }}
      />

      <CategoryPickerModal
        visible={editCategoryPickerVisible}
        onClose={() => {
          setEditCategoryPickerVisible(false);
          setSelectedTxn(null);
        }}
        categories={categories}
        currentCategoryId={selectedTxn?.category_id}
        onSelect={onSelectTxnCategory}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtersWrap: { paddingHorizontal: 16, paddingTop: 12 },
  filterRow: { marginBottom: 8 },
  filterRowInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  inlineChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  inlineChipText: { fontSize: 11, fontWeight: '600' },
  categoryFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  categoryFilterBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryFilterLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  categoryFilterValue: { fontSize: 14, fontWeight: '700' },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600' },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryText: { fontSize: 12, fontWeight: '600' },
  summaryAmount: { fontSize: 13, fontWeight: '700' },
  listCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  txnDot: { width: 8, height: 8, borderRadius: 4 },
  txnInfo: { flex: 1 },
  txnMerchant: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txnDate: { fontSize: 12 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 130,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginLeft: 16 },
  emptyText: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
});

export default TransactionsScreen;
