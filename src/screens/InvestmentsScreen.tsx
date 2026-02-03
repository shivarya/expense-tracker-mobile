import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useData } from '../contexts/DataContext';

const { width } = Dimensions.get('window');

const InvestmentsScreen = () => {
  const { investments, loading, error, refreshInvestments } = useData();
  const [activeTab, setActiveTab] = useState<'stocks' | 'mf' | 'fd' | 'longterm'>('stocks');

  if (loading && !investments) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshInvestments}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderStocks = () => (
    <View>
      {investments?.stocks.map((stock) => (
        <View key={stock.id} style={styles.investmentCard}>
          <View style={styles.investmentHeader}>
            <Text style={styles.investmentName}>{stock.symbol}</Text>
            <Text style={styles.investmentPlatform}>{stock.platform}</Text>
          </View>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Invested</Text>
              <Text style={styles.investmentValue}>
                ₹{stock.invested_amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Current</Text>
              <Text style={styles.investmentValue}>
                ₹{stock.current_value.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Gain/Loss</Text>
              <Text
                style={[
                  styles.investmentGain,
                  { color: (Number(stock.gain_loss_percent) || 0) >= 0 ? '#4CAF50' : '#F44336' },
                ]}
              >
                {stock.gain_loss_percent != null && !isNaN(Number(stock.gain_loss_percent)) ? (
                  <>
                    {Number(stock.gain_loss_percent) >= 0 ? '+' : ''}
                    {Number(stock.gain_loss_percent).toFixed(2)}%
                  </>
                ) : (
                  'N/A'
                )}
              </Text>
            </View>
          </View>
        </View>
      ))}
      {investments?.stocks.length === 0 && (
        <Text style={styles.emptyText}>No stocks found</Text>
      )}
    </View>
  );

  const renderMutualFunds = () => (
    <View>
      {investments?.mutual_funds.map((fund) => (
        <View key={fund.id} style={styles.investmentCard}>
          <Text style={styles.investmentName}>{fund.fund_name}</Text>
          <Text style={styles.investmentSubtext}>
            {fund.amc} • Folio: {fund.folio_number}
          </Text>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Invested</Text>
              <Text style={styles.investmentValue}>
                ₹{fund.invested_amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Current</Text>
              <Text style={styles.investmentValue}>
                ₹{fund.current_value.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Gain/Loss</Text>
              <Text
                style={[
                  styles.investmentGain,
                  { color: (Number(fund.gain_loss_percent) || 0) >= 0 ? '#4CAF50' : '#F44336' },
                ]}
              >
                {fund.gain_loss_percent != null && !isNaN(Number(fund.gain_loss_percent)) ? (
                  <>
                    {Number(fund.gain_loss_percent) >= 0 ? '+' : ''}
                    {Number(fund.gain_loss_percent).toFixed(2)}%
                  </>
                ) : (
                  'N/A'
                )}
              </Text>
            </View>
          </View>
        </View>
      ))}
      {investments?.mutual_funds.length === 0 && (
        <Text style={styles.emptyText}>No mutual funds found</Text>
      )}
    </View>
  );

  const renderFixedDeposits = () => (
    <View>
      {investments?.fixed_deposits.map((fd) => (
        <View key={fd.id} style={styles.investmentCard}>
          <View style={styles.investmentHeader}>
            <Text style={styles.investmentName}>{fd.bank} FD</Text>
            <Text
              style={[
                styles.statusBadge,
                { backgroundColor: fd.status === 'active' ? '#4CAF50' : '#999' },
              ]}
            >
              {fd.status}
            </Text>
          </View>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Principal</Text>
              <Text style={styles.investmentValue}>
                ₹{fd.principal_amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Maturity</Text>
              <Text style={styles.investmentValue}>
                ₹{fd.maturity_value.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Rate</Text>
              <Text style={styles.investmentValue}>{fd.interest_rate}%</Text>
            </View>
          </View>
          <Text style={styles.maturityDate}>
            Matures: {new Date(fd.maturity_date).toLocaleDateString('en-IN')}
          </Text>
        </View>
      ))}
      {investments?.fixed_deposits.length === 0 && (
        <Text style={styles.emptyText}>No fixed deposits found</Text>
      )}
    </View>
  );

  const renderLongTerm = () => (
    <View>
      {investments?.long_term_funds.map((fund) => (
        <View key={fund.id} style={styles.investmentCard}>
          <View style={styles.investmentHeader}>
            <Text style={styles.investmentName}>{fund.fund_type.toUpperCase()}</Text>
            <Text style={styles.statusBadge}>{fund.status}</Text>
          </View>
          <Text style={styles.investmentSubtext}>{fund.account_name}</Text>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Invested</Text>
              <Text style={styles.investmentValue}>
                ₹{fund.invested_amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Current</Text>
              <Text style={styles.investmentValue}>
                ₹{fund.current_value.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          {fund.maturity_date && (
            <Text style={styles.maturityDate}>
              Matures: {new Date(fund.maturity_date).toLocaleDateString('en-IN')}
            </Text>
          )}
        </View>
      ))}
      {investments?.long_term_funds.length === 0 && (
        <Text style={styles.emptyText}>No long-term funds found</Text>
      )}
    </View>
  );

  // Prepare gain/loss chart data for current tab
  const getGainLossData = () => {
    let data: any[] = [];
    if (activeTab === 'stocks') {
      data = investments?.stocks
        .filter(stock => stock.gain_loss_percent != null)
        .map((stock) => ({
          value: Math.abs(stock.gain_loss_percent),
          label: stock.symbol.substring(0, 5),
          frontColor: stock.gain_loss_percent >= 0 ? '#4CAF50' : '#F44336',
        })) || [];
    } else if (activeTab === 'mf') {
      data = investments?.mutual_funds
        .filter(fund => fund.gain_loss_percent != null)
        .map((fund) => ({
          value: Math.abs(fund.gain_loss_percent),
          label: fund.fund_name.substring(0, 10),
          frontColor: fund.gain_loss_percent >= 0 ? '#4CAF50' : '#F44336',
        })) || [];
    }
    return data.slice(0, 5); // Show top 5
  };

  // Prepare maturity timeline for FDs
  const getMaturityTimeline = () => {
    if (activeTab !== 'fd') return [];
    
    const fds = investments?.fixed_deposits.filter(fd => fd.status === 'active') || [];
    return fds
      .sort((a, b) => new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime())
      .slice(0, 5)
      .map((fd, index) => ({
        value: fd.maturity_value,
        label: new Date(fd.maturity_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        frontColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
      }));
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stocks' && styles.activeTab]}
          onPress={() => setActiveTab('stocks')}
        >
          <Text style={[styles.tabText, activeTab === 'stocks' && styles.activeTabText]}>
            Stocks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mf' && styles.activeTab]}
          onPress={() => setActiveTab('mf')}
        >
          <Text style={[styles.tabText, activeTab === 'mf' && styles.activeTabText]}>MF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'fd' && styles.activeTab]}
          onPress={() => setActiveTab('fd')}
        >
          <Text style={[styles.tabText, activeTab === 'fd' && styles.activeTabText]}>FD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'longterm' && styles.activeTab]}
          onPress={() => setActiveTab('longterm')}
        >
          <Text style={[styles.tabText, activeTab === 'longterm' && styles.activeTabText]}>
            PF/NPS
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInvestments} />}
      >
        {/* Gain/Loss Chart for Stocks and MF */}
        {(activeTab === 'stocks' || activeTab === 'mf') && getGainLossData().length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top 5 - Gain/Loss %</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getGainLossData()}
                width={Math.max(width - 60, getGainLossData().length * 60)}
                height={200}
                barWidth={45}
                spacing={25}
                roundedTop
                xAxisThickness={1}
                yAxisThickness={1}
                yAxisTextStyle={{ color: '#666' }}
                xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
                noOfSections={4}
                maxValue={Math.max(...getGainLossData().map(d => d.value)) * 1.2}
              />
            </ScrollView>
          </View>
        )}

        {/* Maturity Timeline for FDs */}
        {activeTab === 'fd' && getMaturityTimeline().length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Upcoming Maturities</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={getMaturityTimeline()}
                width={Math.max(width - 60, getMaturityTimeline().length * 60)}
                height={200}
                barWidth={45}
                spacing={25}
                roundedTop
                xAxisThickness={1}
                yAxisThickness={1}
                yAxisTextStyle={{ color: '#666' }}
                xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
                noOfSections={4}
                maxValue={Math.max(...getMaturityTimeline().map(d => d.value)) * 1.2}
              />
            </ScrollView>
          </View>
        )}

        {activeTab === 'stocks' && renderStocks()}
        {activeTab === 'mf' && renderMutualFunds()}
        {activeTab === 'fd' && renderFixedDeposits()}
        {activeTab === 'longterm' && renderLongTerm()}
      </ScrollView>
    </View>
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
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 16,
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
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  investmentCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  investmentPlatform: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  investmentSubtext: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  investmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  investmentCol: {
    flex: 1,
  },
  investmentLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  investmentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  investmentGain: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    color: '#fff',
    textTransform: 'uppercase',
  },
  maturityDate: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 32,
  },
  chartCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
});

export default InvestmentsScreen;
