import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { PieChart } from 'react-native-gifted-charts';
import { formatCurrency, formatCompactCurrency, formatPercent } from '../utils/format';

const DashboardScreen = () => {
  const { dashboard, loading, error, refreshDashboard } = useData();
  const { colors } = useTheme();

  if (loading && !dashboard) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={refreshDashboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare pie chart data
  const pieData = dashboard?.portfolio.summary.map((item, index) => ({
    value: item.current_value,
    label: item.category,
    color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'][index % 4],
  })) || [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshDashboard} tintColor={colors.primary} />
      }
    >
      {/* Portfolio Summary */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Portfolio Overview</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Invested</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(Number(dashboard?.portfolio.total_invested || 0))}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current Value</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(Number(dashboard?.portfolio.total_current_value || 0))}
            </Text>
          </View>
        </View>
        <View style={styles.gainLossRow}>
          <Text style={[styles.gainLossLabel, { color: colors.textSecondary }]}>Gain/Loss:</Text>
          <Text
            style={[
              styles.gainLossValue,
              {
                color:
                  (Number(dashboard?.portfolio.overall_gain_loss || 0)) >= 0
                    ? colors.success
                    : colors.error,
              },
            ]}
          >
            {(Number(dashboard?.portfolio.overall_gain_loss || 0)) >= 0 ? '+' : ''}
            {formatPercent(Number(dashboard?.portfolio.overall_gain_loss || 0))} ({formatCurrency(Number(dashboard?.portfolio.overall_gain_loss_amount || 0))})
          </Text>
        </View>

        {pieData.length > 0 && (
          <View style={styles.chartContainer}>
            <PieChart
              data={pieData}
              donut
              radius={100}
              innerRadius={60}
              centerLabelComponent={() => (
                <View style={styles.centerLabel}>
                  <Text style={[styles.centerLabelValue, { color: colors.text }]}>
                    {formatCompactCurrency(dashboard?.portfolio.total_current_value || 0)}
                  </Text>
                  <Text style={[styles.centerLabelText, { color: colors.textSecondary }]}>Total</Text>
                </View>
              )}
            />
          </View>
        )}
      </View>

      {/* Recent Transactions */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Transactions</Text>
        {dashboard?.recent_transactions.slice(0, 5).map((txn) => (
          <View key={txn.id} style={[styles.transactionItem, { borderBottomColor: colors.border }]}>
            <View style={styles.transactionLeft}>
              <Text style={[styles.transactionMerchant, { color: colors.text }]}>{txn.merchant || 'Transaction'}</Text>
              <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
                {new Date(txn.transaction_date).toLocaleDateString('en-IN')}
              </Text>
            </View>
            <Text
              style={[
                styles.transactionAmount,
                { color: txn.transaction_type === 'credit' ? colors.success : colors.error },
              ]}
            >
              {txn.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(txn.amount))}
            </Text>
          </View>
        ))}
      </View>

      {/* Upcoming EMIs */}
      {dashboard && dashboard.upcoming_emis.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Upcoming EMIs</Text>
          {dashboard.upcoming_emis.map((emi) => (
            <View key={emi.id} style={[styles.emiItem, { borderBottomColor: colors.border }]}>
              <View style={styles.emiLeft}>
                <Text style={[styles.emiName, { color: colors.text }]}>{emi.loan_name}</Text>
                <Text style={[styles.emiDate, { color: colors.warning }]}>
                  Due: {new Date(emi.next_payment_date).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <Text style={[styles.emiAmount, { color: colors.text }]}>{formatCurrency(Number(emi.emi_amount))}</Text>
            </View>
          ))}
        </View>
      )}
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
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
  card: {
    backgroundColor: '#fff',
    margin: 16,
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
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  gainLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  gainLossLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  gainLossValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  centerLabel: {
    alignItems: 'center',
  },
  centerLabelValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  centerLabelText: {
    fontSize: 12,
    color: '#666',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emiLeft: {
    flex: 1,
  },
  emiName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  emiDate: {
    fontSize: 12,
    color: '#FF9800',
  },
  emiAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
});

export default DashboardScreen;
