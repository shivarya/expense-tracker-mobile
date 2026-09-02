import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, formatCompactCurrency, toLocalDateString } from '../utils/format';
import ApiService from '../services/api';
import { TransactionGroup } from '../types/transactions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// CRED-style muted palette for categories
const CATEGORY_COLORS = [
  '#FF4757', '#5B5FEF', '#FFA502', '#00C48C',
  '#9C27B0', '#FF6F61', '#17C0EB', '#A3CB38',
  '#FDA7DF', '#786FA6',
];

const CATEGORY_ICONS: Record<string, string> = {
  'food': '🍔', 'Food & Dining': '🍽️', 'Food': '🍽️',
  'transport': '🚗', 'Transport': '🚗',
  'shopping': '🛍️', 'Shopping': '🛍️',
  'entertainment': '🎬', 'Entertainment': '🎬',
  'bills': '📱', 'Bills & Utilities': '📱', 'Bills': '📱',
  'health': '🏥', 'Health': '🏥',
  'education': '📚', 'Education': '📚',
  'travel': '✈️', 'Travel': '✈️',
  'groceries': '🛒', 'Groceries': '🛒',
  'fuel': '⛽', 'Fuel': '⛽',
  'rent': '🏠', 'Rent': '🏠',
  'home improvement': '🛠️', 'Home Improvement': '🛠️',
  'home maintenance': '🛠️', 'Home Maintenance': '🛠️',
  'Insurance': '🛡️', 'EMI': '💳',
  'Investments': '📈', 'Transfers': '↔️',
  'Uncategorized': '📦',
};

interface CategoryExpense {
  category_id?: number;
  category: string;
  amount: number;
  percentage: number;
  color?: string;
  icon?: string;
  transaction_count?: number;
}

interface MonthlyExpense {
  month: string;
  total: number;
  debit: number;
  credit: number;
}

interface ExpenseData {
  total_expenses: number;
  total_income: number;
  net_savings: number;
  by_category: CategoryExpense[];
  monthly_trends: MonthlyExpense[];
}

type Period = 'cm' | '1m' | '3m' | '6m' | '1y';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getMonthLabel = (monthStr: string) => {
  const parts = (monthStr ?? '').split('-');
  if (parts.length === 2) {
    const idx = parseInt(parts[1], 10) - 1;
    return MONTH_NAMES[idx] ?? monthStr;
  }
  return (monthStr ?? '').substring(0, 3);
};

const getCategoryIcon = (name: string) =>
  CATEGORY_ICONS[name] ?? CATEGORY_ICONS[name?.toLowerCase()] ?? '📦';

const toISODate = (date: Date) => toLocalDateString(date);

/** Fill in missing months so the chart always shows every month in the period */
const fillMissingMonths = (trends: MonthlyExpense[], startDate: string): MonthlyExpense[] => {
  if (!startDate) return trends;
  const now = new Date();
  const start = new Date(startDate);
  // Move to first day of month
  start.setDate(1);
  const allMonths: string[] = [];
  const cursor = new Date(start);
  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    allMonths.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const dataMap = new Map(trends.map(t => [t.month, t]));
  return allMonths.map(month => dataMap.get(month) ?? { month, total: 0, debit: 0, credit: 0 });
};

const ExpensesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExpenseData | null>(null);
  const [period, setPeriod] = useState<Period>('6m');
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<Period>('6m');
  const [draftGroupId, setDraftGroupId] = useState<number | undefined>(undefined);
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  const fetchGroups = useCallback(async () => {
    try {
      let groupData = await ApiService.getTransactionGroups();

      if (groupData.length === 0) {
        await ApiService.createGroupPresets();
        groupData = await ApiService.getTransactionGroups();
      }

      setGroups(groupData);
    } catch {
      // Keep screen functional even if group endpoint is unavailable.
      setGroups([]);
    }
  }, []);

  const openGroupsManager = () => {
    navigation.navigate('More', { screen: 'Groups' });
  };

  const openFilterModal = () => {
    setDraftPeriod(period);
    setDraftGroupId(selectedGroupId);
    setFilterModalVisible(true);
  };

  const applyFilterModal = () => {
    setPeriod(draftPeriod);
    setSelectedGroupId(draftGroupId);
    setFilterModalVisible(false);
  };

  const resetActiveFilters = () => {
    setPeriod('6m');
    setSelectedGroupId(undefined);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ApiService.getExpenseSummary(period, selectedGroupId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load expense data');
    } finally {
      setLoading(false);
    }
  }, [period, selectedGroupId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // --- Loading ---
  if (loading && !data) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading expenses...</Text>
      </View>
    );
  }

  // --- Error ---
  if (error && !data) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 40, marginBottom: 8 }}>😵</Text>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchData}>
          <Text style={[styles.retryBtnText, { color: isDark ? '#000' : '#fff' }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Data ---
  const byCategory: CategoryExpense[] = (data?.by_category ?? []).filter((c: any) => Number(c.amount) > 0);
  const rawMonthlyTrends: MonthlyExpense[] = data?.monthly_trends ?? [];
  const monthlyTrends = fillMissingMonths(rawMonthlyTrends, (data as any)?.start_date ?? '');
  const totalExpenses = Number(data?.total_expenses || 0);
  const grossExpenses = Number((data as any)?.gross_expenses || totalExpenses);
  const refundOffsets = Number((data as any)?.refund_offsets || 0);
  const totalIncome = Number(data?.total_income || 0);
  const netSavings = Number(data?.net_savings || 0);

  // Assign colors — prefer server color, else pick from palette
  const categoriesWithColors = byCategory.map((item, i) => ({
    ...item,
    _color: (item.color && item.color !== '#9E9E9E') ? item.color : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const pieData = categoriesWithColors.map((item) => ({
    value: Number(item.amount),
    color: item._color,
    text: '',
  }));

  const avgMonthly = monthlyTrends.length > 0
    ? monthlyTrends.reduce((s, m) => s + Number(m.debit ?? m.total ?? 0), 0) / monthlyTrends.length
    : 0;

  const maxMonthly = monthlyTrends.length > 0
    ? Math.max(...monthlyTrends.map(m => Number(m.debit ?? m.total ?? 0)))
    : 0;

  // Current month vs previous month comparison
  const currentMonthSpend = monthlyTrends.length > 0
    ? Number(monthlyTrends[monthlyTrends.length - 1].debit ?? monthlyTrends[monthlyTrends.length - 1].total ?? 0)
    : 0;
  const prevMonthSpend = monthlyTrends.length > 1
    ? Number(monthlyTrends[monthlyTrends.length - 2].debit ?? monthlyTrends[monthlyTrends.length - 2].total ?? 0)
    : 0;
  const monthChange = prevMonthSpend > 0
    ? ((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100
    : 0;

  const barData = monthlyTrends.map((item, i) => ({
    value: Number(item.debit ?? item.total ?? 0),
    label: getMonthLabel(item.month),
    frontColor: i === monthlyTrends.length - 1 ? colors.error : (isDark ? '#333' : '#E0E0E0'),
    topLabelComponent: i === monthlyTrends.length - 1 ? () => (
      <Text style={{ fontSize: 9, color: colors.error, fontWeight: '700', marginBottom: 4 }}>
        {formatCompactCurrency(Number(item.debit ?? item.total ?? 0))}
      </Text>
    ) : undefined,
  }));

  const periodLabels: Record<Period, string> = { 'cm': 'This Month', '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year' };

  const getStartDateForPeriod = (periodValue: Period) => {
    const now = new Date();
    const start = new Date(now);
    if (periodValue === 'cm') { start.setDate(1); }
    if (periodValue === '1m') start.setMonth(now.getMonth() - 1);
    if (periodValue === '3m') start.setMonth(now.getMonth() - 3);
    if (periodValue === '6m') start.setMonth(now.getMonth() - 6);
    if (periodValue === '1y') start.setFullYear(now.getFullYear() - 1);
    return toISODate(start);
  };

  const openTransactions = (category?: CategoryExpense) => {
    navigation.navigate('Transactions', {
      categoryId: category?.category_id,
      categoryName: category?.category,
      groupId: selectedGroupId,
      groupName: selectedGroup?.name,
      headerTitle: category?.category || 'Transactions',
      startDate: getStartDateForPeriod(period),
      endDate: toISODate(new Date()),
    });
  };

  const openCategoriesSpend = () => {
    navigation.navigate('CategoriesSpend', { period, groupId: selectedGroupId });
  };

  const openMasterCategories = () => {
    navigation.navigate('MasterCategories');
  };

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.filterSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.filterSummaryHeader}>
          <Text style={[styles.filterSummaryTitle, { color: colors.text }]}>Expense Filters</Text>
          <TouchableOpacity onPress={openFilterModal} activeOpacity={0.75}>
            <Text style={[styles.filterSummaryAction, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterSummaryBadgesRow}>
          <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>Month: {periodLabels[period]}</Text>
          </View>
          <View style={[styles.filterSummaryBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.filterSummaryBadgeText, { color: colors.textSecondary }]}>Group: {selectedGroup?.name || 'All groups'}</Text>
          </View>
        </View>
        <Text style={[styles.filterHintText, { color: colors.textSecondary }]}>Month and group are combined using AND.</Text>
        <TouchableOpacity style={styles.filterResetBtn} onPress={resetActiveFilters} activeOpacity={0.75}>
          <Text style={[styles.filterResetText, { color: colors.textSecondary }]}>Reset to default</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 && (
        <View style={[styles.groupEmptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
          <Text style={[styles.groupEmptyTitle, { color: colors.text }]}>Create Preset Groups</Text>
          <Text style={[styles.groupEmptySub, { color: colors.textSecondary }]}>Add Credit Cards, Home, and Travel filters instantly.</Text>
          <TouchableOpacity
            style={[styles.groupEmptyBtn, { backgroundColor: colors.primary }]}
            onPress={fetchGroups}
            activeOpacity={0.8}
          >
            <Text style={[styles.groupEmptyBtnText, { color: isDark ? '#000' : '#fff' }]}>Create Presets</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========= Hero Spend Card ========= */}
      <View style={[styles.heroCard, { backgroundColor: isDark ? '#1A1A1A' : '#111' }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>TOTAL SPENT</Text>
            <Text style={styles.heroAmount}>{formatCurrency(totalExpenses, 0)}</Text>
            {refundOffsets > 0 ? (
              <Text style={styles.heroRefundHint}>
                {`Net of ${formatCompactCurrency(refundOffsets)} refunds (gross ${formatCompactCurrency(grossExpenses)})`}
              </Text>
            ) : null}
            {monthChange !== 0 && (
              <View style={styles.heroChangeRow}>
                <Text style={{ color: monthChange > 0 ? '#FF4757' : '#00C48C', fontSize: 12, fontWeight: '700' }}>
                  {monthChange > 0 ? '↑' : '↓'} {Math.abs(monthChange).toFixed(0)}%
                </Text>
                <Text style={styles.heroChangeSub}> vs last month</Text>
              </View>
            )}
          </View>
          {pieData.length > 0 && (
            <View style={styles.heroDonut}>
              <PieChart
                data={pieData}
                donut
                radius={46}
                innerRadius={30}
                centerLabelComponent={() => (
                  <Text style={styles.heroDonutCenter}>
                    {categoriesWithColors.length}
                  </Text>
                )}
              />
              <Text style={styles.heroDonutLabel}>categories</Text>
            </View>
          )}
        </View>

        {/* Spent vs Received mini bar */}
        <View style={styles.heroBar}>
          <View style={[styles.heroBarFill, {
            width: totalExpenses + totalIncome > 0
              ? `${(totalExpenses / (totalExpenses + totalIncome)) * 100}%`
              : '50%' as any,
            backgroundColor: '#FF4757',
            borderTopLeftRadius: 4,
            borderBottomLeftRadius: 4,
          }]} />
          <View style={[styles.heroBarFill, {
            width: totalExpenses + totalIncome > 0
              ? `${(totalIncome / (totalExpenses + totalIncome)) * 100}%`
              : '50%' as any,
            backgroundColor: '#00C48C',
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }]} />
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <View style={[styles.heroStatDot, { backgroundColor: '#FF4757' }]} />
            <Text style={styles.heroStatLabel}>Net Spent</Text>
            <Text style={styles.heroStatValue}>{formatCompactCurrency(totalExpenses)}</Text>
          </View>
          <View style={styles.heroStat}>
            <View style={[styles.heroStatDot, { backgroundColor: '#00C48C' }]} />
            <Text style={styles.heroStatLabel}>Received</Text>
            <Text style={styles.heroStatValue}>{formatCompactCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.heroStat}>
            <View style={[styles.heroStatDot, { backgroundColor: netSavings >= 0 ? '#00C48C' : '#FF4757' }]} />
            <Text style={styles.heroStatLabel}>Savings</Text>
            <Text style={[styles.heroStatValue, { color: netSavings >= 0 ? '#00C48C' : '#FF4757' }]}>
              {netSavings >= 0 ? '+' : ''}{formatCompactCurrency(Math.abs(netSavings))}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => openTransactions()}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickActionTitle, { color: colors.text }]}>View Transactions</Text>
          <Text style={[styles.quickActionSub, { color: colors.textSecondary }]}>Filter by month, date, category</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openCategoriesSpend}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickActionTitle, { color: colors.text }]}>All Categories Spend</Text>
          <Text style={[styles.quickActionSub, { color: colors.textSecondary }]}>Full category-wise breakdown</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openMasterCategories}
          activeOpacity={0.75}
        >
          <Text style={[styles.quickActionTitle, { color: colors.text }]}>Master Categories</Text>
          <Text style={[styles.quickActionSub, { color: colors.textSecondary }]}>Consolidate duplicates and edit list</Text>
        </TouchableOpacity>
      </View>

      {/* ========= Top Categories Grid ========= */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending by Category</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {byCategory.length > 0 ? `${byCategory.length} categories tracked` : 'No category data yet'}
        </Text>

        {categoriesWithColors.length > 0 ? (
          <View style={styles.categoryGrid}>
            {categoriesWithColors.slice(0, 6).map((item, i) => {
              const pct = totalExpenses > 0 ? (Number(item.amount) / totalExpenses) * 100 : 0;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.categoryCard, { backgroundColor: isDark ? '#141414' : '#FAFAFA', borderColor: colors.border }]}
                  activeOpacity={0.75}
                  onPress={() => openTransactions(item)}
                >
                  <View style={styles.categoryCardTop}>
                    <View style={[styles.categoryIconCircle, { backgroundColor: item._color + '18' }]}>
                      <Text style={styles.categoryIconText}>{getCategoryIcon(item.category)}</Text>
                    </View>
                    <Text style={[styles.categoryPct, { color: item._color }]}>{pct.toFixed(0)}%</Text>
                  </View>
                  <Text style={[styles.categoryCardName, { color: colors.text }]} numberOfLines={1}>
                    {item.category}
                  </Text>
                  <Text style={[styles.categoryCardAmount, { color: colors.textSecondary }]}>
                    {formatCompactCurrency(Number(item.amount))}
                  </Text>
                  <View style={[styles.categoryProgressBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.categoryProgressFill, {
                      width: `${Math.min(pct, 100)}%` as any,
                      backgroundColor: item._color,
                    }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.noDataBlock}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📊</Text>
            <Text style={[styles.noDataTitle, { color: colors.text }]}>No spending data</Text>
            <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
              Sync your SMS to auto-categorize expenses
            </Text>
          </View>
        )}
      </View>

      {/* ========= Category Breakdown List ========= */}
      {categoriesWithColors.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Category Breakdown</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Detailed spending per category
          </Text>
          {categoriesWithColors.map((item, i) => {
            const pct = totalExpenses > 0 ? (Number(item.amount) / totalExpenses) * 100 : 0;
            return (
              <View key={i}>
                <TouchableOpacity style={styles.breakdownRow} activeOpacity={0.75} onPress={() => openTransactions(item)}>
                  <View style={[styles.breakdownIcon, { backgroundColor: item._color + '18' }]}>
                    <Text style={{ fontSize: 18 }}>{getCategoryIcon(item.category)}</Text>
                  </View>
                  <View style={styles.breakdownInfo}>
                    <View style={styles.breakdownNameRow}>
                      <Text style={[styles.breakdownName, { color: colors.text }]}>{item.category}</Text>
                      <Text style={[styles.breakdownAmount, { color: colors.text }]}>
                        {formatCurrency(Number(item.amount), 0)}
                      </Text>
                    </View>
                    <View style={styles.breakdownMetaRow}>
                      <Text style={[styles.breakdownTxns, { color: colors.textSecondary }]}>
                        {item.transaction_count ? `${item.transaction_count} txns` : ''}
                      </Text>
                      <Text style={[styles.breakdownPctText, { color: item._color }]}>{pct.toFixed(1)}%</Text>
                    </View>
                    <View style={[styles.breakdownBar, { backgroundColor: colors.border }]}>
                      <View style={[styles.breakdownBarFill, {
                        width: `${Math.min(pct, 100)}%` as any,
                        backgroundColor: item._color,
                      }]} />
                    </View>
                  </View>
                </TouchableOpacity>
                {i < categoriesWithColors.length - 1 && (
                  <View style={[styles.breakdownDivider, { backgroundColor: colors.divider }]} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ========= Monthly Spending ========= */}
      {barData.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.monthlyHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Spending</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {monthlyTrends.length} month trend
              </Text>
            </View>
            {avgMonthly > 0 && (
              <View style={[styles.avgPill, { backgroundColor: isDark ? '#1A2F1A' : '#E8F8F0' }]}>
                <Text style={[styles.avgPillText, { color: colors.success }]}>
                  avg {formatCompactCurrency(avgMonthly)}/mo
                </Text>
              </View>
            )}
          </View>

          {/* Monthly mini tiles */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthlyScroll}>
            {monthlyTrends.slice().reverse().map((m, i) => {
              const spend = Number(m.debit ?? m.total ?? 0);
              const pctOfMax = maxMonthly > 0 ? (spend / maxMonthly) * 100 : 0;
              const isLatest = i === 0;
              return (
                <View key={i} style={[styles.monthTile, {
                  backgroundColor: isLatest
                    ? (isDark ? '#1C0F0F' : '#FFF0F0')
                    : (isDark ? '#141414' : '#FAFAFA'),
                  borderColor: isLatest ? colors.error + '44' : colors.border,
                }]}>
                  <Text style={[styles.monthTileLabel, { color: isLatest ? colors.error : colors.textSecondary }]}>
                    {getMonthLabel(m.month)}
                  </Text>
                  <View style={[styles.monthTileBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.monthTileBarFill, {
                      height: `${Math.max(pctOfMax, 8)}%` as any,
                      backgroundColor: isLatest ? colors.error : (isDark ? '#444' : '#CCC'),
                    }]} />
                  </View>
                  <Text style={[styles.monthTileAmount, {
                    color: isLatest ? colors.error : colors.text,
                  }]}>
                    {formatCompactCurrency(spend)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Bar chart */}
          <View style={styles.barChartContainer}>
            <BarChart
              data={barData}
              width={Math.max(SCREEN_WIDTH - 80, barData.length * 56)}
              height={160}
              barWidth={28}
              spacing={24}
              roundedTop
              roundedBottom={false}
              xAxisThickness={1}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }}
              xAxisColor={colors.border}
              noOfSections={4}
              maxValue={maxMonthly > 0 ? maxMonthly * 1.3 : 100}
              formatYLabel={(label: string) => {
                const val = Number(label);
                if (val >= 100000) return `${(val / 100000).toFixed(0)}L`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                return label;
              }}
              rulesType="dashed"
              rulesColor={colors.border}
              dashWidth={3}
              dashGap={4}
            />
          </View>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>

    <Modal
      visible={filterModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Expense Filters</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Text style={[styles.modalClose, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalHint, { color: colors.textSecondary }]}>Month and group are applied together with AND.</Text>

          <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>Month</Text>
          <View style={styles.modalWrapRow}>
            {(['cm', '1m', '3m', '6m', '1y'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.modalChip,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  draftPeriod === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setDraftPeriod(p)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.modalChipText,
                  { color: draftPeriod === p ? (isDark ? '#000' : '#fff') : colors.textSecondary },
                ]}>
                  {periodLabels[p]}
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
          <ScrollView style={styles.modalGroupScroll} contentContainerStyle={styles.modalWrapRow}>
            <TouchableOpacity
              style={[
                styles.modalChip,
                { backgroundColor: colors.background, borderColor: colors.border },
                draftGroupId === undefined && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setDraftGroupId(undefined)}
              activeOpacity={0.75}
            >
              <Text style={[styles.modalChipText, { color: draftGroupId === undefined ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>All groups</Text>
            </TouchableOpacity>

            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.modalChip,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  draftGroupId === group.id && { backgroundColor: group.color || colors.primary, borderColor: group.color || colors.primary },
                ]}
                onPress={() => setDraftGroupId(group.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.modalChipText, { color: draftGroupId === group.id ? (isDark ? '#000' : '#fff') : colors.textSecondary }]}>{group.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
              onPress={() => {
                setDraftPeriod('6m');
                setDraftGroupId(undefined);
              }}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: colors.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={applyFilterModal}
            >
              <Text style={[styles.modalPrimaryBtnText, { color: isDark ? '#000' : '#fff' }]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 32, paddingTop: 8 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, marginTop: 12, fontWeight: '500' },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 28,
  },
  retryBtnText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },

  filterSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterSummaryTitle: { fontSize: 14, fontWeight: '700' },
  filterSummaryAction: { fontSize: 13, fontWeight: '700' },
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
  filterResetBtn: { marginTop: 8, alignSelf: 'flex-start' },
  filterResetText: { fontSize: 12, fontWeight: '600' },
  groupEmptyCard: {
    marginHorizontal: 16,
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
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalClose: { fontSize: 13, fontWeight: '600' },
  modalHint: { fontSize: 11, marginTop: 6, marginBottom: 10 },
  modalSectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  modalWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalChipText: { fontSize: 12, fontWeight: '600' },
  modalGroupHeader: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalManageText: { fontSize: 12, fontWeight: '700' },
  modalGroupScroll: { maxHeight: 180 },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
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

  // Hero card
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroRefundHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    fontWeight: '500',
  },
  heroChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heroChangeSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  heroDonut: {
    alignItems: 'center',
    marginLeft: 12,
  },
  heroDonutCenter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  heroDonutLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
    fontWeight: '500',
  },
  heroBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 14,
  },
  heroBarFill: {
    height: '100%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroStatDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  heroStatValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  quickActionsRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  quickActionBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickActionSub: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Generic card
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 16,
  },

  // Category grid (CRED-style cards)
  // Available = SCREEN_WIDTH - 32 (margin) - 2 (border) - 40 (padding) = SCREEN_WIDTH - 74
  // 3 cards with 2 gaps of 8 = 16px → card = floor((SCREEN_WIDTH - 74 - 16) / 3)
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: Math.floor((SCREEN_WIDTH - 90) / 3),
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconText: {
    fontSize: 15,
  },
  categoryPct: {
    fontSize: 11,
    fontWeight: '800',
  },
  categoryCardName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 14,
  },
  categoryCardAmount: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 16,
  },
  categoryProgressBg: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Breakdown list
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  breakdownIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  breakdownName: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  breakdownMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownTxns: {
    fontSize: 11,
    fontWeight: '500',
  },
  breakdownPctText: {
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownDivider: {
    height: 1,
    marginLeft: 54,
  },

  // Monthly section
  monthlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avgPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  avgPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthlyScroll: {
    marginBottom: 20,
  },
  monthTile: {
    width: 72,
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  monthTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  monthTileBarBg: {
    width: 8,
    height: 50,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  monthTileBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  monthTileAmount: {
    fontSize: 10,
    fontWeight: '700',
  },
  barChartContainer: {
    marginTop: 4,
  },

  // No data
  noDataBlock: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  noDataText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
    paddingHorizontal: 16,
  },

  bottomPad: { height: 24 },
});

export default ExpensesScreen;
