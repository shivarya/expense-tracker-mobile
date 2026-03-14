import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import ApiService from '../services/api';
import { formatCurrency } from '../utils/format';
import { TransactionGroup } from '../types/transactions';

type Period = 'cm' | '1m' | '3m' | '6m' | '1y';

interface CategoryExpense {
  category_id?: number;
  category: string;
  amount: number;
  percentage: number;
  color?: string;
  icon?: string;
  transaction_count?: number;
}

interface ExpenseData {
  total_expenses: number;
  by_category: CategoryExpense[];
}

const periodLabels: Record<Period, string> = {
  'cm': 'This Month',
  '1m': '1 month',
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
};

const CategoriesSpendScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const initialPeriod = ((route.params as any)?.period || '6m') as Period;
  const initialGroupId = (route.params as any)?.groupId as number | undefined;

  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(initialGroupId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ExpenseData | null>(null);

  const categories = useMemo(() => (data?.by_category || []).filter((item) => Number(item.amount) > 0), [data?.by_category]);

  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const res = await ApiService.getExpenseSummary(period, selectedGroupId);
      setData(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedGroupId]);

  const fetchGroups = useCallback(async () => {
    try {
      const groupData = await ApiService.getTransactionGroups();
      setGroups(groupData);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const openCategoryTransactions = (category: CategoryExpense) => {
    navigation.navigate('Transactions', {
      categoryId: category.category_id,
      categoryName: category.category,
      groupId: selectedGroupId,
      headerTitle: category.category,
    });
  };

  const openMasterCategories = () => {
    navigation.navigate('MasterCategories');
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.periodRow}>
          {(['cm', '1m', '3m', '6m', '1y'] as Period[]).map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.periodPill,
                { borderColor: colors.border, backgroundColor: colors.card },
                period === item && { borderColor: colors.primary, backgroundColor: colors.primary },
              ]}
              onPress={() => setPeriod(item)}
            >
              <Text style={[styles.periodText, { color: period === item ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{periodLabels[item]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
          <TouchableOpacity
            style={[
              styles.groupPill,
              { borderColor: colors.border, backgroundColor: colors.card },
              selectedGroupId === undefined && { borderColor: colors.primary, backgroundColor: colors.primary },
            ]}
            onPress={() => setSelectedGroupId(undefined)}
          >
            <Text style={[styles.groupPillText, { color: selectedGroupId === undefined ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All groups</Text>
          </TouchableOpacity>
          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupPill,
                { borderColor: colors.border, backgroundColor: colors.card },
                selectedGroupId === group.id && { borderColor: colors.primary, backgroundColor: colors.primary },
              ]}
              onPress={() => setSelectedGroupId(group.id)}
            >
              <Text style={[styles.groupPillText, { color: selectedGroupId === group.id ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{group.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={[styles.manageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openMasterCategories}
            activeOpacity={0.75}
          >
            <Text style={[styles.manageBtnTitle, { color: colors.text }]}>Manage Master Categories</Text>
            <Text style={[styles.manageBtnSub, { color: colors.textSecondary }]}>Consolidate duplicates, add or edit categories</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>TOTAL SPEND</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(Number(data?.total_expenses || 0), 0)}</Text>
          <Text style={[styles.summarySub, { color: colors.textSecondary }]}>{categories.length} categories</Text>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          {categories.map((item, index) => (
            <View key={`${item.category}-${index}`}>
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openCategoryTransactions(item)}>
                <View style={[styles.icon, { backgroundColor: (item.color || colors.primary) + '20' }]}>
                  <Text style={styles.iconText}>{item.icon || '📦'}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]}>{item.category}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.transaction_count || 0} txns • {Number(item.percentage || 0).toFixed(1)}%</Text>
                </View>
                <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(Number(item.amount), 0)}</Text>
              </TouchableOpacity>
              {index < categories.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  periodPill: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  periodText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  groupRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  groupPillText: { fontSize: 12, fontWeight: '600' },
  actionsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  manageBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manageBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  manageBtnSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  summaryTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  summaryValue: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  summarySub: { fontSize: 12, marginTop: 3 },
  listCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginLeft: 46 },
});

export default CategoriesSpendScreen;
