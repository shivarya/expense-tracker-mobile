import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
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

const ExpensesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExpenseData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '1y'>('6m');
  const { colors } = useTheme();

  const fetchExpenseData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await ApiService.getExpenseSummary(selectedPeriod);
      setData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load expense data');
      console.error('[ExpensesScreen] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseData();
  }, [selectedPeriod]);

  if (loading && !data) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading expenses...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchExpenseData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Safe aliases for incoming data (API may omit fields in some dev schemas)
  const byCategory = data?.by_category ?? [];
  const monthlyTrends = data?.monthly_trends ?? [];

  // Prepare category pie chart data
  const pieData = (byCategory as any[]).map((item, index) => ({
    value: Number(item.amount ?? 0),
    label: item.category ?? 'Uncategorized',
    color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6],
  }));

  // Prepare monthly bar chart data
  const barData = (monthlyTrends as any[]).map((item) => ({
    value: Number(item.debit ?? item.total ?? 0),
    label: (item.month ?? '').substring(0, 3),
    frontColor: colors.error,
  }));

  // Prepare monthly line chart data
  const lineData = (monthlyTrends as any[]).map((item, index) => ({
    value: Number(item.total ?? 0),
    dataPointText: formatCompactCurrency(Number(item.total ?? 0)),
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchExpenseData} tintColor={colors.primary} />
      }
    >
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.error }]}>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(Number(data?.total_expenses || 0))}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.success }]}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(Number(data?.total_income || 0))}
          </Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.primary, marginBottom: 16 }]}>
        <Text style={styles.summaryLabel}>Net Savings</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(Number(data?.net_savings || 0))}
        </Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, { backgroundColor: colors.surface, borderColor: colors.border }, selectedPeriod === '3m' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSelectedPeriod('3m')}
        >
          <Text style={[styles.periodText, { color: colors.text }, selectedPeriod === '3m' && styles.periodTextActive]}>
            3M
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, { backgroundColor: colors.surface, borderColor: colors.border }, selectedPeriod === '6m' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSelectedPeriod('6m')}
        >
          <Text style={[styles.periodText, { color: colors.text }, selectedPeriod === '6m' && styles.periodTextActive]}>
            6M
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, { backgroundColor: colors.surface, borderColor: colors.border }, selectedPeriod === '1y' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSelectedPeriod('1y')}
        >
          <Text style={[styles.periodText, { color: colors.text }, selectedPeriod === '1y' && styles.periodTextActive]}>
            1Y
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Breakdown Pie Chart */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Expense by Category</Text>
        {pieData.length > 0 ? (
          <>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieData}
                donut
                radius={100}
                innerRadius={60}
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text style={[styles.centerLabelValue, { color: colors.text }]}>
                      {formatCompactCurrency(Number(data?.total_expenses || 0))}
                    </Text>
                    <Text style={[styles.centerLabelText, { color: colors.textSecondary }]}>Total</Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.legendContainer}>
              {(pieData || []).map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendText, { color: colors.text }]}>
                    {item.label} ({formatCurrency(Number(item.value))})
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No expense data available</Text>
        )}
      </View>

      {/* Monthly Expense Bar Chart */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Monthly Expenses</Text>
        {barData.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={barData}
              width={Math.max(width - 60, barData.length * 50)}
              height={220}
              barWidth={35}
              spacing={20}
              roundedTop
              xAxisThickness={1}
              yAxisThickness={1}
              yAxisTextStyle={{ color: colors.textSecondary }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              noOfSections={4}
              maxValue={(barData.length ? Math.max(...barData.map(d => d.value)) * 1.2 : 0)}
            />
          </ScrollView>
        ) : (
          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No monthly data available</Text>
        )}
      </View>

      {/* Monthly Trend Line Chart */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Expense Trend</Text>
        {lineData.length > 0 ? (
          <LineChart
            data={lineData}
            width={width - 80}
            height={220}
            spacing={50}
            initialSpacing={10}
            color={colors.primary}
            thickness={3}
            dataPointsColor={colors.primary}
            dataPointsRadius={5}
            textShiftY={-10}
            textFontSize={12}
            textColor={colors.textSecondary}
            yAxisThickness={1}
            xAxisThickness={1}
            yAxisTextStyle={{ color: colors.textSecondary }}
            noOfSections={4}
          />
        ) : (
          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No trend data available</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  periodButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  periodText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  centerLabel: {
    alignItems: 'center',
  },
  centerLabelValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  centerLabelText: {
    fontSize: 12,
    color: '#666',
  },
  legendContainer: {
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 32,
  },
});

export default ExpensesScreen;
