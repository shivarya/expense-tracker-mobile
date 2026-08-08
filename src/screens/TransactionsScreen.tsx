import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import {
  Category,
  Transaction,
  TransactionGroup,
  ManualTransactionGroup,
  RefundAllocation,
} from '../types/transactions';
import ApiService from '../services/api';
import { formatCurrency, formatOriginalCurrency } from '../utils/format';
import CategoryPickerModal from '../components/CategoryPickerModal';

type DateRangeKey = 'all' | '7d' | '30d' | '90d';
type TxnType = 'all' | 'debit' | 'credit';

interface RouteParams {
  categoryId?: number;
  categoryName?: string;
  groupId?: number;
  manualGroupId?: number;
  groupName?: string;
  type?: 'debit' | 'credit';
  startDate?: string;
  endDate?: string;
  initialMonthKey?: 'current';
  focusTransactionId?: number;
  focusMerchant?: string;
  focusAmount?: number;
  focusCategoryId?: number;
  focusDescription?: string;
}

interface MonthOption {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface SplitDraftLine {
  category_id: number;
  amountText: string;
  notes?: string;
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

const parseTxnDate = (value: string): Date | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = /(Z|[+\-]\d{2}:?\d{2})$/.test(raw)
    ? raw
    : raw.replace(' ', 'T') + 'Z';

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTxnDateLocal = (value: string): string => {
  const date = parseTxnDate(value);
  if (!date) return value;
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
};

const formatTxnTimeLocal = (value: string): string => {
  const date = parseTxnDate(value);
  if (!date) return '--';
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
};

const formatTxnDateTimeLocal = (value: string): string => {
  const date = parseTxnDate(value);
  if (!date) return value;
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

const formatTxnSource = (source?: string): string => {
  switch (source) {
    case 'sms':
      return 'SMS';
    case 'sms_webhook':
      return 'SMS Realtime';
    case 'statement_pdf':
      return 'Statement PDF';
    case 'web_scrape':
      return 'Web Scrape';
    case 'email':
      return 'Email';
    case 'manual':
      return 'Manual';
    default:
      return source || 'Unknown';
  }
};

const formatTxnDisplayName = (txn: Transaction): string => {
  return txn.merchant || txn.description || `Txn #${txn.id}`;
};

const parseAmountInput = (value: string): number => {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100) / 100;
};

const isValidFilterAmountInput = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0;
};

const parseOptionalFilterAmount = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;

  return Math.round(parsed * 100) / 100;
};

const PAGE_SIZE = 50;

const TransactionsScreen = () => {
  const { colors, isDark } = useTheme();
  const { categories, refreshCategories } = useData();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params ?? {}) as RouteParams;

  const monthOptions = useMemo(() => getMonthOptions(6), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [paginationOffset, setPaginationOffset] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [manualGroups, setManualGroups] = useState<ManualTransactionGroup[]>([]);

  const [selectedMonth, setSelectedMonth] = useState<string>(params.initialMonthKey === 'current' ? getCurrentMonthKey() : 'all');
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>('30d');
  const [selectedType, setSelectedType] = useState<TxnType>(params.type || 'all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(params.categoryId);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(params.groupId);
  const [selectedManualGroupId, setSelectedManualGroupId] = useState<number | undefined>(params.manualGroupId);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [maxAmount, setMaxAmount] = useState<number | undefined>(undefined);
  const [useRouteDateOverride, setUseRouteDateOverride] = useState(Boolean(params.startDate || params.endDate));

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftMonth, setDraftMonth] = useState<string>(selectedMonth);
  const [draftRange, setDraftRange] = useState<DateRangeKey>(selectedRange);
  const [draftType, setDraftType] = useState<TxnType>(selectedType);
  const [draftGroupId, setDraftGroupId] = useState<number | undefined>(selectedGroupId);
  const [draftManualGroupId, setDraftManualGroupId] = useState<number | undefined>(selectedManualGroupId);
  const [draftSearchKeyword, setDraftSearchKeyword] = useState<string>('');
  const [draftMinAmountText, setDraftMinAmountText] = useState<string>('');
  const [draftMaxAmountText, setDraftMaxAmountText] = useState<string>('');

  const [filterCategoryPickerVisible, setFilterCategoryPickerVisible] = useState(false);
  const [editCategoryPickerVisible, setEditCategoryPickerVisible] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editNameText, setEditNameText] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [manualGroupModalVisible, setManualGroupModalVisible] = useState(false);
  const [manualGroupSelection, setManualGroupSelection] = useState<number[]>([]);
  const [manualGroupSaving, setManualGroupSaving] = useState(false);
  const [manualGroupCreateText, setManualGroupCreateText] = useState('');
  const [manualGroupCreating, setManualGroupCreating] = useState(false);

  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [splitSaving, setSplitSaving] = useState(false);
  const [splitCategoryPickerVisible, setSplitCategoryPickerVisible] = useState(false);
  const [activeSplitIndex, setActiveSplitIndex] = useState<number | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraftLine[]>([]);

  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundCandidates, setRefundCandidates] = useState<Transaction[]>([]);
  const [refundAllocations, setRefundAllocations] = useState<RefundAllocation[]>([]);
  const [selectedRefundExpenseId, setSelectedRefundExpenseId] = useState<number | null>(null);
  const [refundAmountText, setRefundAmountText] = useState('');
  const hasLoadedOnceRef = useRef(false);

  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
  const selectedGroup = groups.find((item) => item.id === selectedGroupId);
  const selectedManualGroup = manualGroups.find((item) => item.id === selectedManualGroupId);
  const selectedRefundExpense = refundCandidates.find((item) => item.id === selectedRefundExpenseId) || null;

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

  const fetchManualGroups = useCallback(async () => {
    try {
      const list = await ApiService.getManualTransactionGroups();
      setManualGroups(list || []);
    } catch {
      setManualGroups([]);
    }
  }, []);

  const openGroupsManager = () => {
    navigation.navigate('More', { screen: 'Groups' });
  };

  const buildFetchParams = useCallback((offset: number = 0) => {
    const monthFilter = monthOptions.find((item) => item.key === selectedMonth);
    const dateFilter = selectedMonth !== 'all'
      ? { startDate: monthFilter?.startDate, endDate: monthFilter?.endDate }
      : getRangeDates(selectedRange);

    return {
      start_date: useRouteDateOverride ? params.startDate : dateFilter.startDate,
      end_date: useRouteDateOverride ? params.endDate : dateFilter.endDate,
      category_id: selectedCategoryId,
      group_id: selectedGroupId,
      manual_group_id: selectedManualGroupId,
      type: selectedType === 'all' ? undefined : selectedType,
      keyword: searchKeyword || undefined,
      min_amount: minAmount,
      max_amount: maxAmount,
      limit: PAGE_SIZE,
      offset,
    };
  }, [maxAmount, minAmount, monthOptions, params.endDate, params.startDate, searchKeyword, selectedCategoryId, selectedGroupId, selectedManualGroupId, selectedMonth, selectedRange, selectedType, useRouteDateOverride]);

  const fetchTransactions = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const res = await ApiService.getTransactions(buildFetchParams(0));
      const fetchedTransactions = res.transactions || [];
      const totalCount = Number(res.summary?.total_count || 0);

      setTransactions(fetchedTransactions);
      setSummary(res.summary || null);
      setPaginationOffset(fetchedTransactions.length);
      setHasMore(fetchedTransactions.length < totalCount);
      hasLoadedOnceRef.current = true;
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildFetchParams]);

  const loadMoreTransactions = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const res = await ApiService.getTransactions(buildFetchParams(paginationOffset));
      const incoming = res.transactions || [];
      const totalCount = Number(res.summary?.total_count || 0);
      let mergedCount = paginationOffset;

      setTransactions((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        incoming.forEach((txn) => {
          if (!seen.has(txn.id)) {
            merged.push(txn);
          }
        });
        mergedCount = merged.length;
        return merged;
      });

      setPaginationOffset(mergedCount);
      setHasMore(mergedCount < totalCount && incoming.length > 0);

      if (res.summary) {
        setSummary(res.summary);
      }
    } catch {
      // Avoid noisy toasts during scroll-driven pagination retries.
    } finally {
      setLoadingMore(false);
    }
  }, [buildFetchParams, hasMore, loading, loadingMore, paginationOffset, refreshing]);

  const onTransactionsScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 260) {
      loadMoreTransactions();
    }
  }, [loadMoreTransactions]);

  const openFilterModal = () => {
    setDraftMonth(selectedMonth);
    setDraftRange(selectedRange);
    setDraftType(selectedType);
    setDraftGroupId(selectedGroupId);
    setDraftManualGroupId(selectedManualGroupId);
    setDraftSearchKeyword(searchKeyword);
    setDraftMinAmountText(minAmount != null ? String(minAmount) : '');
    setDraftMaxAmountText(maxAmount != null ? String(maxAmount) : '');
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    if (!isValidFilterAmountInput(draftMinAmountText) || !isValidFilterAmountInput(draftMaxAmountText)) {
      Alert.alert('Validation', 'Enter valid amount values.');
      return;
    }

    const parsedMinAmount = parseOptionalFilterAmount(draftMinAmountText);
    const parsedMaxAmount = parseOptionalFilterAmount(draftMaxAmountText);

    if (parsedMinAmount !== undefined && parsedMaxAmount !== undefined && parsedMinAmount > parsedMaxAmount) {
      Alert.alert('Validation', 'Min amount cannot be greater than max amount.');
      return;
    }

    setSelectedMonth(draftMonth);
    setSelectedRange(draftRange);
    setSelectedType(draftType);
    setSelectedGroupId(draftGroupId);
    setSelectedManualGroupId(draftManualGroupId);
    setSearchKeyword(draftSearchKeyword.trim());
    setMinAmount(parsedMinAmount);
    setMaxAmount(parsedMaxAmount);
    setUseRouteDateOverride(false);
    setFilterModalVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftMonth('all');
    setDraftRange('30d');
    setDraftType('all');
    setDraftGroupId(undefined);
    setDraftManualGroupId(undefined);
    setDraftSearchKeyword('');
    setDraftMinAmountText('');
    setDraftMaxAmountText('');
  };

  const selectedMonthLabel = selectedMonth === 'all'
    ? (selectedRange === 'all' ? 'All dates' : `Last ${selectedRange}`)
    : (monthOptions.find((item) => item.key === selectedMonth)?.label || 'Month');
  const selectedTypeLabel = selectedType === 'all' ? 'All types' : selectedType[0].toUpperCase() + selectedType.slice(1);
  const selectedSearchLabel = searchKeyword ? `Search: ${searchKeyword}` : null;
  const selectedAmountLabel = useMemo(() => {
    if (minAmount === undefined && maxAmount === undefined) {
      return null;
    }

    const minText = minAmount !== undefined ? `₹${minAmount.toLocaleString('en-IN')}` : 'Any';
    const maxText = maxAmount !== undefined ? `₹${maxAmount.toLocaleString('en-IN')}` : 'Any';
    return `Amount: ${minText} - ${maxText}`;
  }, [maxAmount, minAmount]);

  useEffect(() => {
    // Categories already loaded by DataContext on login; refresh once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshCategories();
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchManualGroups();
  }, [fetchManualGroups]);

  useEffect(() => {
    fetchTransactions(true);
  }, [fetchTransactions]);

  useEffect(() => {
    if (params.initialMonthKey === 'current') {
      setSelectedMonth(getCurrentMonthKey());
    }
    if (params.type) {
      setSelectedType(params.type);
    }
    if (typeof params.categoryId === 'number') {
      setSelectedCategoryId(params.categoryId);
    }
    if (typeof params.groupId === 'number') {
      setSelectedGroupId(params.groupId);
    }
    if (typeof params.manualGroupId === 'number') {
      setSelectedManualGroupId(params.manualGroupId);
    }

    if (params.startDate || params.endDate) {
      setUseRouteDateOverride(true);
    }
  }, [params.categoryId, params.endDate, params.groupId, params.initialMonthKey, params.manualGroupId, params.startDate, params.type]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnceRef.current) {
        fetchTransactions(false);
      }
    }, [fetchTransactions])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions(false);
  }, [fetchTransactions]);

  const onEditCategoryTap = (txn: Transaction) => {
    if (txn.has_split) {
      Alert.alert('Split Transaction', 'This transaction is split across multiple categories. Use Manage Split in transaction details.');
      return;
    }
    setSelectedTxn(txn);
    setEditCategoryPickerVisible(true);
  };

  useEffect(() => {
    if (!params.focusTransactionId) return;

    const focusId = params.focusTransactionId;
    const existing = transactions.find((txn) => txn.id === focusId);

    const txn: Transaction = existing || {
      id: focusId,
      account_id: 0,
      category_id: params.focusCategoryId ?? 0,
      transaction_type: 'debit',
      amount: params.focusAmount ?? 0,
      merchant: params.focusMerchant,
      description: params.focusDescription,
      transaction_date: new Date().toISOString(),
      source: 'sms',
    };

    onEditCategoryTap(txn);
    navigation.setParams({
      focusTransactionId: undefined,
      focusMerchant: undefined,
      focusAmount: undefined,
      focusCategoryId: undefined,
      focusDescription: undefined,
    });
    // Only re-run when a new focusTransactionId arrives (e.g. a fresh notification tap);
    // intentionally ignores `transactions` so this doesn't re-fire once the list loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focusTransactionId]);

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

  const openTxnDetails = (txn: Transaction) => {
    setDetailTxn(txn);
    setDetailModalVisible(true);
  };

  const closeTxnDetails = () => {
    setDetailModalVisible(false);
    setDetailTxn(null);
  };

  const openManualGroupModal = async (txn: Transaction) => {
    setDetailTxn(txn);
    setDetailModalVisible(false);
    setManualGroupSelection((txn.manual_groups || []).map((group) => group.id));
    setManualGroupCreateText('');
    setManualGroupModalVisible(true);

    await fetchManualGroups();
  };

  const closeManualGroupModal = () => {
    setManualGroupModalVisible(false);
    setManualGroupSelection([]);
    setManualGroupCreateText('');
  };

  const toggleManualGroupSelection = (groupId: number) => {
    setManualGroupSelection((prev) => (
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    ));
  };

  const createManualGroupFromModal = async () => {
    const name = manualGroupCreateText.trim();
    if (!name) {
      Alert.alert('Validation', 'Enter a group name.');
      return;
    }

    try {
      setManualGroupCreating(true);
      const created = await ApiService.createManualTransactionGroup({ name });
      await fetchManualGroups();
      setManualGroupSelection((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setManualGroupCreateText('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create manual group');
    } finally {
      setManualGroupCreating(false);
    }
  };

  const saveManualGroupSelection = async () => {
    if (!detailTxn) return;

    try {
      setManualGroupSaving(true);
      const response = await ApiService.updateTransactionManualGroups(detailTxn.id, manualGroupSelection);
      const groupsForTxn = response.manual_groups || [];

      setTransactions((prev) => prev.map((txn) => (
        txn.id === detailTxn.id
          ? {
              ...txn,
              manual_groups: groupsForTxn,
            }
          : txn
      )));

      setDetailTxn((prev) => (prev ? { ...prev, manual_groups: groupsForTxn } : prev));
      closeManualGroupModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save manual groups');
    } finally {
      setManualGroupSaving(false);
    }
  };

  const openEditNameModal = (txn: Transaction) => {
    setDetailModalVisible(false);
    setDetailTxn(txn);
    setEditNameText((txn.merchant || '').trim());
    setEditNameModalVisible(true);
  };

  const closeEditNameModal = () => {
    setEditNameModalVisible(false);
    setEditNameText('');
  };

  const saveEditedName = async () => {
    if (!detailTxn) return;

    const merchant = editNameText.trim();
    if (!merchant) {
      Alert.alert('Validation', 'Transaction name cannot be empty.');
      return;
    }

    try {
      setNameSaving(true);
      const res = await ApiService.updateTransactionName(detailTxn.id, merchant);

      setTransactions((prev) => prev.map((txn) => (
        txn.id === detailTxn.id
          ? {
              ...txn,
              merchant: res.merchant,
            }
          : txn
      )));

      setDetailTxn((prev) => (prev ? { ...prev, merchant: res.merchant } : prev));
      closeEditNameModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update transaction name');
    } finally {
      setNameSaving(false);
    }
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

  const openSplitEditor = async (txn: Transaction) => {
    if (txn.transaction_type !== 'debit') {
      Alert.alert('Not Supported', 'Only debit transactions can be split.');
      return;
    }

    try {
      const res = await ApiService.getTransactionSplits(txn.id);
      const drafts: SplitDraftLine[] = res.splits.length > 0
        ? res.splits.map((line) => ({
            category_id: line.category_id,
            amountText: String(line.amount),
            notes: line.notes || undefined,
          }))
        : [{ category_id: txn.category_id, amountText: String(Number(txn.amount || 0)) }];

      setSplitDrafts(drafts);
      setDetailTxn(txn);
      setDetailModalVisible(false);
      setSplitModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load splits');
    }
  };

  const addSplitDraftLine = () => {
    const fallbackCategoryId = detailTxn?.category_id || categories[0]?.id;
    if (!fallbackCategoryId) {
      Alert.alert('No Categories', 'Create a category first before splitting transactions.');
      return;
    }
    setSplitDrafts((prev) => [...prev, { category_id: fallbackCategoryId, amountText: '' }]);
  };

  const removeSplitDraftLine = (index: number) => {
    setSplitDrafts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateSplitDraftLine = (index: number, patch: Partial<SplitDraftLine>) => {
    setSplitDrafts((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  };

  const closeSplitModal = () => {
    setSplitModalVisible(false);
    setSplitDrafts([]);
    setActiveSplitIndex(null);
  };

  const saveSplitDrafts = async () => {
    if (!detailTxn) return;

    if (splitDrafts.length === 0) {
      Alert.alert('Validation', 'Add at least one split line.');
      return;
    }

    const payload: Array<{ category_id: number; amount: number; notes?: string }> = [];
    let total = 0;

    for (const line of splitDrafts) {
      if (!line.category_id) {
        Alert.alert('Validation', 'Each split line needs a category.');
        return;
      }

      const amount = parseAmountInput(line.amountText || '');
      if (amount <= 0) {
        Alert.alert('Validation', 'Each split line needs a positive amount.');
        return;
      }

      payload.push({
        category_id: line.category_id,
        amount,
        notes: line.notes,
      });
      total += amount;
    }

    const parentAmount = Math.round(Number(detailTxn.amount || 0) * 100) / 100;
    const totalRounded = Math.round(total * 100) / 100;
    if (Math.abs(totalRounded - parentAmount) > 0.01) {
      Alert.alert('Validation', `Split total ${formatCurrency(totalRounded, 2)} must equal parent amount ${formatCurrency(parentAmount, 2)}.`);
      return;
    }

    try {
      setSplitSaving(true);
      const res = await ApiService.updateTransactionSplits(detailTxn.id, payload);
      setTransactions((prev) => prev.map((txn) => (
        txn.id === detailTxn.id
          ? {
              ...txn,
              has_split: res.is_split,
              split_count: res.split_count,
              split_total: res.split_total,
            }
          : txn
      )));
      closeSplitModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save split lines');
    } finally {
      setSplitSaving(false);
    }
  };

  const openRefundAllocator = async (txn: Transaction) => {
    if (txn.transaction_type !== 'credit') {
      Alert.alert('Not Supported', 'Refund allocation is only available for credit transactions.');
      return;
    }

    try {
      const [allocationRes, debitRes] = await Promise.all([
        ApiService.getRefundAllocations(txn.id),
        ApiService.getTransactions({
          type: 'debit',
          start_date: getRangeDates('90d').startDate,
          end_date: formatDate(new Date()),
          limit: 100,
        }),
      ]);

      const candidates = (debitRes.transactions || []).filter((item) => item.id !== txn.id);
      setRefundCandidates(candidates);
      setRefundAllocations(allocationRes.allocations || []);

      const firstExisting = allocationRes.allocations?.[0];
      if (firstExisting) {
        setSelectedRefundExpenseId(firstExisting.expense_transaction_id);
        setRefundAmountText(String(firstExisting.amount));
      } else {
        setSelectedRefundExpenseId(candidates[0]?.id ?? null);
        setRefundAmountText('');
      }

      setDetailTxn(txn);
      setDetailModalVisible(false);
      setRefundModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load refund allocation data');
    }
  };

  const closeRefundModal = () => {
    setRefundModalVisible(false);
    setRefundCandidates([]);
    setRefundAllocations([]);
    setSelectedRefundExpenseId(null);
    setRefundAmountText('');
  };

  const saveRefundAllocation = async () => {
    if (!detailTxn) return;
    if (selectedRefundExpenseId == null) {
      Alert.alert('Validation', 'Choose a target expense transaction.');
      return;
    }

    const amount = parseAmountInput(refundAmountText);
    if (amount <= 0) {
      Alert.alert('Validation', 'Enter a valid refund allocation amount.');
      return;
    }

    const refundAmount = Number(detailTxn.amount || 0);
    if (amount - refundAmount > 0.01) {
      Alert.alert('Validation', `Allocation cannot exceed refund amount ${formatCurrency(refundAmount, 2)}.`);
      return;
    }

    try {
      setRefundSaving(true);
      const res = await ApiService.updateRefundAllocations(detailTxn.id, [{
        expense_transaction_id: selectedRefundExpenseId,
        amount,
      }]);

      setRefundAllocations(res.allocations || []);
      setTransactions((prev) => prev.map((txn) => (
        txn.id === detailTxn.id
          ? {
              ...txn,
              refund_allocated_out: res.total_allocated,
              refund_targets_count: res.allocations?.length || 0,
            }
          : txn
      )));

      closeRefundModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save refund allocation');
    } finally {
      setRefundSaving(false);
    }
  };

  const clearRefundAllocation = async () => {
    if (!detailTxn) return;

    try {
      setRefundSaving(true);
      const res = await ApiService.updateRefundAllocations(detailTxn.id, []);
      setRefundAllocations(res.allocations || []);
      setTransactions((prev) => prev.map((txn) => (
        txn.id === detailTxn.id
          ? {
              ...txn,
              refund_allocated_out: 0,
              refund_targets_count: 0,
            }
          : txn
      )));
      closeRefundModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to clear refund allocation');
    } finally {
      setRefundSaving(false);
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
        onScroll={onTransactionsScroll}
        scrollEventThrottle={16}
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
              <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>{selectedManualGroup?.name || 'All trip/event groups'}</Text>
              </View>
              {selectedSearchLabel ? (
                <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]} numberOfLines={1}>{selectedSearchLabel}</Text>
                </View>
              ) : null}
              {selectedAmountLabel ? (
                <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]} numberOfLines={1}>{selectedAmountLabel}</Text>
                </View>
              ) : null}
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
                setSelectedManualGroupId(undefined);
                setSelectedMonth('all');
                setSelectedRange('30d');
                setSelectedType('all');
                setSearchKeyword('');
                setMinAmount(undefined);
                setMaxAmount(undefined);
                setDraftSearchKeyword('');
                setDraftMinAmountText('');
                setDraftMaxAmountText('');
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

          {selectedManualGroup ? (
            <View style={[styles.groupInfoRow, { borderColor: colors.border, backgroundColor: colors.card }]}> 
              <Text style={[styles.groupInfoText, { color: colors.textSecondary }]}>Trip/Event Group: {selectedManualGroup.name}</Text>
            </View>
          ) : null}

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>Showing {transactions.length} / {Number(summary?.total_count || transactions.length)} transactions</Text>
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
                    <Text style={[styles.txnDate, { color: colors.textSecondary }]}>{formatTxnDateLocal(txn.transaction_date)} • {formatTxnTimeLocal(txn.transaction_date)}</Text>
                    <TouchableOpacity
                      onPress={() => onEditCategoryTap(txn)}
                      style={[styles.badge, { backgroundColor: (txn.category_color || colors.textSecondary) + '20' }]}
                    >
                      <Text style={[styles.badgeText, { color: txn.category_color || colors.textSecondary }]} numberOfLines={1}>{txn.category_name || 'Uncategorized'}</Text>
                    </TouchableOpacity>
                    {txn.has_split ? (
                      <View style={[styles.miniTag, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[styles.miniTagText, { color: colors.textSecondary }]}>Split</Text>
                      </View>
                    ) : null}
                    {(txn.manual_groups || []).length > 0 ? (
                      <View style={[styles.miniTag, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[styles.miniTagText, { color: colors.textSecondary }]}>{(txn.manual_groups || []).length} group{(txn.manual_groups || []).length > 1 ? 's' : ''}</Text>
                      </View>
                    ) : null}
                    {Number(txn.refund_allocated_out || 0) > 0 ? (
                      <View style={[styles.miniTag, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <Text style={[styles.miniTagText, { color: colors.textSecondary }]}>Refund linked</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.txnRight}>
                  <Text style={[styles.txnAmount, { color: txn.transaction_type === 'credit' ? colors.success : colors.error }]}> 
                    {txn.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(txn.amount), 0)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openTxnDetails(txn)}
                    style={[styles.eyeButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              {index < transactions.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}

          {transactions.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions found for selected filters.</Text>
          )}

          {loadingMore ? (
            <View style={styles.loadMoreWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>Loading more transactions...</Text>
            </View>
          ) : hasMore ? (
            <View style={styles.loadMoreWrap}>
              <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>Scroll to load more</Text>
            </View>
          ) : transactions.length > 0 ? (
            <View style={styles.loadMoreWrap}>
              <Text style={[styles.loadMoreText, { color: colors.textSecondary }]}>All matching transactions loaded</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTxnDetails}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transaction Details</Text>
              <TouchableOpacity onPress={closeTxnDetails}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            {detailTxn ? (
              <View style={styles.detailWrap}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  {detailTxn.merchant || detailTxn.description || 'Transaction'}
                </Text>
                <Text style={[styles.detailAmount, { color: detailTxn.transaction_type === 'credit' ? colors.success : colors.error }]}>
                  {detailTxn.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(detailTxn.amount), 0)}
                </Text>
                {formatOriginalCurrency(detailTxn.original_amount, detailTxn.original_currency) ? (
                  <Text style={[styles.detailForeign, { color: colors.textSecondary }]}>
                    Originally {formatOriginalCurrency(detailTxn.original_amount, detailTxn.original_currency)}
                  </Text>
                ) : null}

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{detailTxn.transaction_type}</Text>
                </View>
                {formatOriginalCurrency(detailTxn.original_amount, detailTxn.original_currency) ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Original amount</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatOriginalCurrency(detailTxn.original_amount, detailTxn.original_currency)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatTxnDateTimeLocal(detailTxn.transaction_date)}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Category</Text>
                  <Text style={[styles.detailValue, { color: detailTxn.category_color || colors.text }]}>{detailTxn.category_name || 'Uncategorized'}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Account</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
                    {detailTxn.account_name || [detailTxn.bank, detailTxn.account_type].filter(Boolean).join(' • ') || 'Unknown account'}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Source</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatTxnSource(detailTxn.source)}</Text>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Trip/Event Groups</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {(detailTxn.manual_groups || []).length > 0
                      ? (detailTxn.manual_groups || []).map((group) => group.name).join(', ')
                      : 'Not linked'}
                  </Text>
                </View>

                {detailTxn.has_split ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Split</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {detailTxn.split_count || 0} lines • {formatCurrency(Number(detailTxn.split_total || detailTxn.amount), 2)}
                    </Text>
                  </View>
                ) : null}

                {detailTxn.transaction_type === 'debit' && Number(detailTxn.refund_allocated_amount || 0) > 0 ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Refund offsets</Text>
                    <Text style={[styles.detailValue, { color: colors.success }]}>
                      -{formatCurrency(Number(detailTxn.refund_allocated_amount || 0), 2)}
                    </Text>
                  </View>
                ) : null}

                {detailTxn.transaction_type === 'credit' && Number(detailTxn.refund_allocated_out || 0) > 0 ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Allocated to expenses</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatCurrency(Number(detailTxn.refund_allocated_out || 0), 2)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.detailActionsRow}>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => openManualGroupModal(detailTxn)}
                  >
                    <Text style={[styles.detailActionText, { color: colors.text }]}>Link Group</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => openEditNameModal(detailTxn)}
                  >
                    <Text style={[styles.detailActionText, { color: colors.text }]}>Edit Name</Text>
                  </TouchableOpacity>

                  {detailTxn.transaction_type === 'debit' ? (
                    <TouchableOpacity
                      style={[styles.detailActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => openSplitEditor(detailTxn)}
                    >
                      <Text style={[styles.detailActionText, { color: colors.text }]}>Manage Split</Text>
                    </TouchableOpacity>
                  ) : null}

                  {detailTxn.transaction_type === 'credit' ? (
                    <TouchableOpacity
                      style={[styles.detailActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => openRefundAllocator(detailTxn)}
                    >
                      <Text style={[styles.detailActionText, { color: colors.text }]}>Allocate Refund</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={editNameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditNameModal}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Transaction Name</Text>
                <TouchableOpacity onPress={closeEditNameModal} disabled={nameSaving}>
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.editorInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Merchant or transaction name"
                placeholderTextColor={colors.textSecondary}
                value={editNameText}
                onChangeText={setEditNameText}
                editable={!nameSaving}
                maxLength={500}
                autoFocus
                returnKeyType="done"
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                  onPress={closeEditNameModal}
                  disabled={nameSaving}
                >
                  <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary, opacity: nameSaving ? 0.7 : 1 }]}
                  onPress={saveEditedName}
                  disabled={nameSaving}
                >
                  <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>{nameSaving ? 'Saving...' : 'Save Name'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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

            <View style={styles.modalGroupHeader}>
              <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Trip/Event Group</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  draftManualGroupId === undefined && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setDraftManualGroupId(undefined)}
              >
                <Text style={[styles.filterChipText, { color: draftManualGroupId === undefined ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All trip/event groups</Text>
              </TouchableOpacity>
              {manualGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    draftManualGroupId === group.id && { backgroundColor: group.color || colors.primary, borderColor: group.color || colors.primary },
                  ]}
                  onPress={() => setDraftManualGroupId(group.id)}
                >
                  <Text style={[styles.filterChipText, { color: draftManualGroupId === group.id ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{group.name}</Text>
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

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Search</Text>
            <TextInput
              style={[styles.modalFilterInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Merchant, description, account, bank"
              placeholderTextColor={colors.textSecondary}
              value={draftSearchKeyword}
              onChangeText={setDraftSearchKeyword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Amount Range</Text>
            <View style={styles.amountFilterRow}>
              <TextInput
                style={[styles.amountFilterInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={draftMinAmountText}
                onChangeText={setDraftMinAmountText}
              />
              <Text style={[styles.amountFilterDash, { color: colors.textSecondary }]}>to</Text>
              <TextInput
                style={[styles.amountFilterInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Max"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={draftMaxAmountText}
                onChangeText={setDraftMaxAmountText}
              />
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

      <Modal
        visible={splitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSplitModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Split</Text>
              <TouchableOpacity onPress={closeSplitModal} disabled={splitSaving}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            {detailTxn ? (
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Parent amount: {formatCurrency(Number(detailTxn.amount || 0), 2)}</Text>
            ) : null}

            <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator={false}>
              {splitDrafts.map((line, index) => {
                const category = categories.find((item) => item.id === line.category_id);
                return (
                  <View key={`${line.category_id}-${index}`} style={[styles.editorCard, { borderColor: colors.border, backgroundColor: colors.background }]}> 
                    <View style={styles.editorCardHeader}>
                      <Text style={[styles.editorCardTitle, { color: colors.text }]}>Line {index + 1}</Text>
                      {splitDrafts.length > 1 ? (
                        <TouchableOpacity onPress={() => removeSplitDraftLine(index)} disabled={splitSaving}>
                          <Text style={[styles.editorDeleteText, { color: colors.error }]}>Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[styles.editorSelectBtn, { borderColor: colors.border }]}
                      onPress={() => {
                        setActiveSplitIndex(index);
                        setSplitCategoryPickerVisible(true);
                      }}
                      disabled={splitSaving}
                    >
                      <Text style={[styles.editorSelectLabel, { color: colors.textSecondary }]}>Category</Text>
                      <Text style={[styles.editorSelectValue, { color: category?.color || colors.text }]}>{category?.name || 'Select category'}</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={[styles.editorInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                      placeholder="Amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={line.amountText}
                      editable={!splitSaving}
                      onChangeText={(text) => updateSplitDraftLine(index, { amountText: text })}
                    />
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.editorSecondaryBtn, { borderColor: colors.border }]}
              onPress={addSplitDraftLine}
              disabled={splitSaving}
            >
              <Text style={[styles.editorSecondaryBtnText, { color: colors.textSecondary }]}>Add Split Line</Text>
            </TouchableOpacity>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={closeSplitModal}
                disabled={splitSaving}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary, opacity: splitSaving ? 0.7 : 1 }]}
                onPress={saveSplitDrafts}
                disabled={splitSaving}
              >
                <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>{splitSaving ? 'Saving...' : 'Save Split'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={refundModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRefundModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Allocate Refund</Text>
              <TouchableOpacity onPress={closeRefundModal} disabled={refundSaving}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            {detailTxn ? (
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Refund amount: {formatCurrency(Number(detailTxn.amount || 0), 2)}</Text>
            ) : null}

            {refundAllocations.length > 0 ? (
              <Text style={[styles.modalHint, { color: colors.success }]}>Currently allocated: {formatCurrency(Number(refundAllocations.reduce((sum, item) => sum + Number(item.amount || 0), 0)), 2)}</Text>
            ) : null}

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Choose Expense Transaction</Text>
            <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator={false}>
              {refundCandidates.map((txn) => {
                const active = txn.id === selectedRefundExpenseId;
                return (
                  <TouchableOpacity
                    key={txn.id}
                    style={[
                      styles.expensePickRow,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      active && { borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedRefundExpenseId(txn.id)}
                    disabled={refundSaving}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.expensePickTitle, { color: colors.text }]} numberOfLines={1}>{formatTxnDisplayName(txn)}</Text>
                      <Text style={[styles.expensePickSub, { color: colors.textSecondary }]}>{formatTxnDateLocal(txn.transaction_date)} • {txn.category_name || 'Uncategorized'}</Text>
                    </View>
                    <Text style={[styles.expensePickAmt, { color: colors.error }]}>{formatCurrency(Number(txn.amount || 0), 0)}</Text>
                  </TouchableOpacity>
                );
              })}

              {refundCandidates.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent debit transactions found.</Text>
              ) : null}
            </ScrollView>

            {selectedRefundExpense ? (
              <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Target: {formatTxnDisplayName(selectedRefundExpense)}</Text>
            ) : null}

            <TextInput
              style={[styles.editorInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="Allocation amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={refundAmountText}
              editable={!refundSaving}
              onChangeText={setRefundAmountText}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={clearRefundAllocation}
                disabled={refundSaving}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary, opacity: refundSaving ? 0.7 : 1 }]}
                onPress={saveRefundAllocation}
                disabled={refundSaving}
              >
                <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>{refundSaving ? 'Saving...' : 'Save Allocation'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={manualGroupModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeManualGroupModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Link Trip/Event Groups</Text>
              <TouchableOpacity onPress={closeManualGroupModal} disabled={manualGroupSaving || manualGroupCreating}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>One transaction can belong to multiple groups.</Text>

            <View style={styles.manualCreateRow}>
              <TextInput
                style={[styles.manualCreateInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Create group (Trip Goa, Wedding, Event)"
                placeholderTextColor={colors.textSecondary}
                value={manualGroupCreateText}
                editable={!manualGroupSaving && !manualGroupCreating}
                onChangeText={setManualGroupCreateText}
              />
              <TouchableOpacity
                style={[styles.manualCreateBtn, { backgroundColor: colors.primary, opacity: manualGroupCreating ? 0.7 : 1 }]}
                onPress={createManualGroupFromModal}
                disabled={manualGroupSaving || manualGroupCreating}
              >
                <Text style={[styles.manualCreateBtnText, { color: isDark ? '#000' : '#fff' }]}>{manualGroupCreating ? '...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator={false}>
              {manualGroups.map((group) => {
                const active = manualGroupSelection.includes(group.id);
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.manualGroupPickRow,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      active && { borderColor: group.color || colors.primary },
                    ]}
                    onPress={() => toggleManualGroupSelection(group.id)}
                    disabled={manualGroupSaving || manualGroupCreating}
                  >
                    <View style={styles.manualGroupPickLeft}>
                      <View style={[styles.manualGroupDot, { backgroundColor: group.color || colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.manualGroupPickTitle, { color: colors.text }]} numberOfLines={1}>{group.name}</Text>
                        <Text style={[styles.manualGroupPickSub, { color: colors.textSecondary }]}>{group.transaction_count || 0} tx</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? (group.color || colors.primary) : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}

              {manualGroups.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No manual groups yet. Create one above.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={closeManualGroupModal}
                disabled={manualGroupSaving || manualGroupCreating}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary, opacity: manualGroupSaving ? 0.7 : 1 }]}
                onPress={saveManualGroupSelection}
                disabled={manualGroupSaving || manualGroupCreating}
              >
                <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>{manualGroupSaving ? 'Saving...' : 'Save Groups'}</Text>
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

      <CategoryPickerModal
        visible={splitCategoryPickerVisible}
        onClose={() => {
          setSplitCategoryPickerVisible(false);
          setActiveSplitIndex(null);
        }}
        categories={categories}
        currentCategoryId={activeSplitIndex != null ? splitDrafts[activeSplitIndex]?.category_id : undefined}
        onSelect={(categoryId) => {
          if (activeSplitIndex != null) {
            updateSplitDraftLine(activeSplitIndex, { category_id: categoryId });
          }
          setSplitCategoryPickerVisible(false);
          setActiveSplitIndex(null);
        }}
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
  modalKeyboardWrap: {
    width: '100%',
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
  modalFilterInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 8,
  },
  amountFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  amountFilterInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  amountFilterDash: {
    fontSize: 12,
    fontWeight: '700',
  },
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
  loadMoreWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadMoreText: { fontSize: 12, fontWeight: '600' },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  txnDot: { width: 8, height: 8, borderRadius: 4 },
  txnInfo: { flex: 1 },
  txnMerchant: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  txnDate: { fontSize: 12 },
  txnRight: { alignItems: 'flex-end', gap: 7 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 130,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  miniTag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniTagText: { fontSize: 9, fontWeight: '700' },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  eyeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailWrap: { marginTop: 12 },
  detailTitle: { fontSize: 16, fontWeight: '700' },
  detailAmount: { fontSize: 18, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  detailForeign: { fontSize: 13, fontWeight: '500', marginTop: -8, marginBottom: 12 },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  detailActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailActionBtn: {
    minWidth: '31%',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailActionText: { fontSize: 12, fontWeight: '700' },
  editorScroll: {
    maxHeight: 280,
    marginBottom: 8,
  },
  editorCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  editorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editorCardTitle: { fontSize: 12, fontWeight: '700' },
  editorDeleteText: { fontSize: 12, fontWeight: '700' },
  editorSelectBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  editorSelectLabel: { fontSize: 10, fontWeight: '700' },
  editorSelectValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  editorInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  editorSecondaryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  editorSecondaryBtnText: { fontSize: 12, fontWeight: '700' },
  expensePickRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  expensePickTitle: { fontSize: 13, fontWeight: '700' },
  expensePickSub: { fontSize: 11, marginTop: 2 },
  expensePickAmt: { fontSize: 12, fontWeight: '700' },
  manualCreateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  manualCreateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  manualCreateBtn: {
    minWidth: 64,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  manualCreateBtnText: { fontSize: 12, fontWeight: '700' },
  manualGroupPickRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  manualGroupPickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  manualGroupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  manualGroupPickTitle: { fontSize: 13, fontWeight: '700' },
  manualGroupPickSub: { fontSize: 11, marginTop: 2 },
  divider: { height: 1, marginLeft: 16 },
  emptyText: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
});

export default TransactionsScreen;
