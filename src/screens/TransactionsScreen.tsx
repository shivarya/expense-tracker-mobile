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
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { Category, Transaction, TransactionGroup } from '../types/transactions';
import ApiService from '../services/api';
import { formatCurrency } from '../utils/format';
import CategoryPickerModal from '../components/CategoryPickerModal';

type DateRangeKey = 'all' | '7d' | '30d' | '90d';
type TxnType = 'all' | 'debit' | 'credit';

interface RouteParams {
  categoryId?: number;
  categoryName?: string;
  groupId?: number;
  groupName?: string;
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
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;

  const monthOptions = useMemo(() => getMonthOptions(6), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(params.initialMonthKey === 'current' ? getCurrentMonthKey() : 'all');
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>('30d');
  const [selectedType, setSelectedType] = useState<TxnType>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(params.categoryId);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(params.groupId);
  const [useRouteDateOverride, setUseRouteDateOverride] = useState(Boolean(params.startDate || params.endDate));

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftMonth, setDraftMonth] = useState<string>(selectedMonth);
  const [draftRange, setDraftRange] = useState<DateRangeKey>(selectedRange);
  const [draftType, setDraftType] = useState<TxnType>(selectedType);
  const [draftGroupId, setDraftGroupId] = useState<number | undefined>(selectedGroupId);

  const [filterCategoryPickerVisible, setFilterCategoryPickerVisible] = useState(false);
  const [editCategoryPickerVisible, setEditCategoryPickerVisible] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
  const selectedGroup = groups.find((item) => item.id === selectedGroupId);

  const fetchGroups = useCallback(async () => {
    try {
      let list = await ApiService.getTransactionGroups();

      if (list.length === 0) {
        try {
          await ApiService.createGroupPresets();
        } catch {
          // Ignore and re-fetch; backend may already have seeded groups.
        }
        list = await ApiService.getTransactionGroups();
      }

      setGroups(list);
    } catch {
      setGroups([]);
    }
  }, []);

  const openGroupsManager = () => {
    navigation.navigate('More', { screen: 'Groups' });
  };

  const fetchTransactions = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const monthFilter = monthOptions.find((item) => item.key === selectedMonth);
      const dateFilter = selectedMonth !== 'all'
        ? { startDate: monthFilter?.startDate, endDate: monthFilter?.endDate }
        : getRangeDates(selectedRange);

      const res = await ApiService.getTransactions({
        start_date: useRouteDateOverride ? params.startDate : dateFilter.startDate,
        end_date: useRouteDateOverride ? params.endDate : dateFilter.endDate,
        category_id: selectedCategoryId,
        group_id: selectedGroupId,
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
  }, [monthOptions, params.endDate, params.startDate, selectedCategoryId, selectedGroupId, selectedMonth, selectedRange, selectedType, useRouteDateOverride]);

  const openFilterModal = () => {
    setDraftMonth(selectedMonth);
    setDraftRange(selectedRange);
    setDraftType(selectedType);
    setDraftGroupId(selectedGroupId);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setSelectedMonth(draftMonth);
    setSelectedRange(draftRange);
    setSelectedType(draftType);
    setSelectedGroupId(draftGroupId);
    setUseRouteDateOverride(false);
    setFilterModalVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftMonth('all');
    setDraftRange('30d');
    setDraftType('all');
    setDraftGroupId(undefined);
  };

  const selectedMonthLabel = selectedMonth === 'all'
    ? (selectedRange === 'all' ? 'All dates' : `Last ${selectedRange}`)
    : (monthOptions.find((item) => item.key === selectedMonth)?.label || 'Month');
  const selectedTypeLabel = selectedType === 'all' ? 'All types' : selectedType[0].toUpperCase() + selectedType.slice(1);

  useEffect(() => {
    // Categories already loaded by DataContext on login; refresh once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshCategories();
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
          <View style={[styles.filterSummaryCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.filterSummaryHeader}>
              <Text style={[styles.filterSummaryTitle, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={openFilterModal}>
                <Text style={[styles.filterSummaryEdit, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.filterSummaryBadgesRow}>
              <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>{selectedMonthLabel}</Text>
              </View>
              <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>{selectedTypeLabel}</Text>
              </View>
              <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>{selectedGroup?.name || 'All groups'}</Text>
              </View>
            </View>
            <Text style={[styles.filterHintText, { color: colors.textSecondary }]}>Month and group are applied together (AND).</Text>
          </View>

          {groups.length === 0 && (
            <View style={[styles.groupEmptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
              <Text style={[styles.groupEmptyTitle, { color: colors.text }]}>No groups yet</Text>
              <Text style={[styles.groupEmptySub, { color: colors.textSecondary }]}>Create preset groups to filter transactions faster.</Text>
              <TouchableOpacity
                style={[styles.groupEmptyBtn, { backgroundColor: colors.primary }]}
                onPress={fetchGroups}
                activeOpacity={0.8}
              >
                <Text style={[styles.groupEmptyBtnText, { color: isDark ? '#000' : '#fff' }]}>Create Presets</Text>
              </TouchableOpacity>
            </View>
          )}

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
              onPress={() => {
                setUseRouteDateOverride(false);
                setSelectedCategoryId(undefined);
                setSelectedGroupId(undefined);
                setSelectedMonth('all');
                setSelectedRange('30d');
                setSelectedType('all');
              }}
            >
              <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {selectedGroup ? (
            <View style={[styles.groupInfoRow, { borderColor: colors.border, backgroundColor: colors.card }]}> 
              <Text style={[styles.groupInfoText, { color: colors.textSecondary }]}>Group: {selectedGroup.name}</Text>
            </View>
          ) : null}

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

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Filters combine using AND. Apply to update results.</Text>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  draftMonth === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setDraftMonth('all')}
              >
                <Text style={[styles.filterChipText, { color: draftMonth === 'all' ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All months</Text>
              </TouchableOpacity>
              {monthOptions.map((month) => (
                <TouchableOpacity
                  key={month.key}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    draftMonth === month.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setDraftMonth(month.key)}
                >
                  <Text style={[styles.filterChipText, { color: draftMonth === month.key ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{month.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Date Range</Text>
            <View style={styles.filterRowInline}>
              {(['all', '7d', '30d', '90d'] as DateRangeKey[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.inlineChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    draftRange === range && { borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    setDraftMonth('all');
                    setDraftRange(range);
                  }}
                >
                  <Text style={[styles.inlineChipText, { color: draftRange === range ? colors.primary : colors.textSecondary }]}>
                    {range === 'all' ? 'All dates' : `Last ${range}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.filterRowInline}>
              {(['all', 'debit', 'credit'] as TxnType[]).map((txnType) => (
                <TouchableOpacity
                  key={txnType}
                  style={[
                    styles.inlineChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    draftType === txnType && { borderColor: colors.primary },
                  ]}
                  onPress={() => setDraftType(txnType)}
                >
                  <Text style={[styles.inlineChipText, { color: draftType === txnType ? colors.primary : colors.textSecondary }]}>
                    {txnType === 'all' ? 'All types' : txnType[0].toUpperCase() + txnType.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalGroupHeader}>
              <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Group</Text>
              <TouchableOpacity onPress={openGroupsManager}>
                <Text style={[styles.modalManageText, { color: colors.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  draftGroupId === undefined && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setDraftGroupId(undefined)}
              >
                <Text style={[styles.filterChipText, { color: draftGroupId === undefined ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All groups</Text>
              </TouchableOpacity>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    draftGroupId === group.id && { backgroundColor: group.color || colors.primary, borderColor: group.color || colors.primary },
                  ]}
                  onPress={() => setDraftGroupId(group.id)}
                >
                  <Text style={[styles.filterChipText, { color: draftGroupId === group.id ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{group.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={[styles.modalSecondaryBtn, { borderColor: colors.border }]} onPress={resetDraftFilters}>
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]} onPress={applyFilters}>
                <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  filterSummaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filterSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterSummaryTitle: { fontSize: 14, fontWeight: '700' },
  filterSummaryEdit: { fontSize: 13, fontWeight: '700' },
  filterSummaryBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterSummaryBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterSummaryBadgeText: { fontSize: 12, fontWeight: '600' },
  filterHintText: { fontSize: 11, marginTop: 8 },
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
  groupChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
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
  groupInfoRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  groupInfoText: { fontSize: 12, fontWeight: '600' },
  groupEmptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  groupEmptyTitle: { fontSize: 14, fontWeight: '700' },
  groupEmptySub: { fontSize: 12, marginTop: 3, marginBottom: 8 },
  groupEmptyBtn: {
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  groupEmptyBtnText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    maxHeight: '84%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalClose: { fontSize: 13, fontWeight: '600' },
  modalHint: { fontSize: 11, marginTop: 6, marginBottom: 10 },
  modalSectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  modalGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  modalManageText: { fontSize: 12, fontWeight: '700' },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalSecondaryBtnText: { fontSize: 13, fontWeight: '700' },
  modalPrimaryBtn: {
    flex: 2,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalPrimaryBtnText: { fontSize: 13, fontWeight: '700' },
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
