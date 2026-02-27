import React, { useState, useMemo } from 'react';
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
import { formatCurrency, formatCompactCurrency } from '../utils/format';

const { width } = Dimensions.get('window');

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4CAF50', '#E91E63'];

const InvestmentsScreen = () => {
  const { investments, loading, error, refreshInvestments } = useData();
  const [activeTab, setActiveTab] = useState<'stocks' | 'mf' | 'fd' | 'longterm'>('stocks');

  // Compute tab summaries
  const tabSummary = useMemo(() => {
    if (!investments) return null;
    const stocks = investments.stocks || [];
    const mf = investments.mutual_funds || [];
    const fd = investments.fixed_deposits || [];
    const lt = investments.long_term_funds || [];

    return {
      stocks: {
        count: stocks.length,
        invested: stocks.reduce((s, i) => s + Number(i.invested_amount || 0), 0),
        current: stocks.reduce((s, i) => s + Number(i.current_value || 0), 0),
      },
      mf: {
        count: mf.length,
        invested: mf.reduce((s, i) => s + Number(i.invested_amount || 0), 0),
        current: mf.reduce((s, i) => s + Number(i.current_value || 0), 0),
      },
      fd: {
        count: fd.length,
        invested: fd.reduce((s, i) => s + Number(i.principal_amount || 0), 0),
        current: fd.reduce((s, i) => s + Number(i.maturity_value || 0), 0),
      },
      longterm: {
        count: lt.length,
        invested: lt.reduce((s, i) => s + Number(i.invested_amount || 0), 0),
        current: lt.reduce((s, i) => s + Number(i.current_value || 0), 0),
      },
    };
  }, [investments]);

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

  // Summary card for current tab
  const renderSummaryCard = () => {
    const summary = tabSummary?.[activeTab];
    if (!summary || summary.count === 0) return null;
    const gainLoss = summary.current - summary.invested;
    const gainPct = summary.invested > 0 ? (gainLoss / summary.invested) * 100 : 0;

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Invested</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.invested)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Current Value</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.current)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gain/Loss</Text>
            <Text style={[styles.summaryGain, { color: gainLoss >= 0 ? '#4CAF50' : '#F44336' }]}>
              {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)} ({gainPct.toFixed(1)}%)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Holdings</Text>
            <Text style={styles.summaryValue}>{summary.count}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStocks = () => (
    <View>
      {investments?.stocks.map((stock) => {
        const gainPct = Number(stock.gain_loss_percent) || 0;
        const qty = Number(stock.quantity) || 0;
        const cmp = Number(stock.current_price) || Number(stock.average_price) || 0;
        return (
          <View key={stock.id} style={styles.investmentCard}>
            <View style={styles.investmentHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.investmentName}>{stock.symbol}</Text>
                {stock.company_name && (
                  <Text style={styles.investmentSubtext} numberOfLines={1}>
                    {stock.company_name}
                  </Text>
                )}
              </View>
              <View style={[styles.platformBadge, { backgroundColor: stock.platform === 'zerodha' ? '#387ED1' : stock.platform === 'groww' ? '#5367FF' : '#666' }]}>
                <Text style={styles.platformBadgeText}>{stock.platform?.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.investmentRow}>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>Qty × CMP</Text>
                <Text style={styles.investmentValue}>
                  {qty} × ₹{cmp.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>Current Value</Text>
                <Text style={styles.investmentValueBold}>
                  {formatCurrency(Number(stock.current_value))}
                </Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>P&L</Text>
                <Text
                  style={[styles.investmentGain, { color: gainPct >= 0 ? '#4CAF50' : '#F44336' }]}
                >
                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {investments?.stocks.length === 0 && (
        <Text style={styles.emptyText}>No stocks found</Text>
      )}
    </View>
  );

  const renderMutualFunds = () => (
    <View>
      {investments?.mutual_funds.map((fund) => {
        const units = Number(fund.units) || 0;
        const nav = Number(fund.nav) || 0;
        const currentVal = Number(fund.current_value) || 0;
        return (
          <View key={fund.id} style={styles.investmentCard}>
            <View style={styles.investmentHeader}>
              <Text style={[styles.investmentName, { fontSize: 14 }]} numberOfLines={2}>
                {fund.fund_name}
              </Text>
            </View>
            <View style={styles.mfMetaRow}>
              <Text style={styles.investmentSubtext}>{fund.amc}</Text>
              <View style={styles.mfBadges}>
                <View style={[styles.typeBadge, { backgroundColor: fund.plan_type === 'direct' ? '#4CAF50' : '#FF9800' }]}>
                  <Text style={styles.typeBadgeText}>{fund.plan_type?.toUpperCase()}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: '#2196F3', marginLeft: 4 }]}>
                  <Text style={styles.typeBadgeText}>{(fund.option_type || 'growth').toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.folioText}>Folio: {fund.folio_number}</Text>
            <View style={styles.investmentRow}>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>Units</Text>
                <Text style={styles.investmentValue}>{units.toFixed(3)}</Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>NAV</Text>
                <Text style={styles.investmentValue}>₹{nav.toFixed(2)}</Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={styles.investmentLabel}>Value</Text>
                <Text style={styles.investmentValueBold}>
                  {formatCurrency(currentVal)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
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
            <View style={[styles.statusBadge, { backgroundColor: fd.status === 'active' ? '#4CAF50' : '#999' }]}>
              <Text style={styles.statusBadgeText}>{fd.status}</Text>
            </View>
          </View>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Principal</Text>
              <Text style={styles.investmentValue}>
                {formatCurrency(Number(fd.principal_amount))}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={styles.investmentLabel}>Maturity</Text>
              <Text style={styles.investmentValueBold}>
                {formatCurrency(Number(fd.maturity_value))}
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

  const renderLongTerm = () => {
    const funds = investments?.long_term_funds || [];
    // Group by fund_type
    const grouped: Record<string, typeof funds> = {};
    funds.forEach((f) => {
      const type = (f.fund_type || 'other').toLowerCase();
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(f);
    });

    const typeLabels: Record<string, string> = {
      pf: 'Provident Fund (EPF)',
      nps: 'National Pension System',
      ppf: 'Public Provident Fund',
      vpf: 'Voluntary PF',
      sukanya: 'Sukanya Samriddhi',
    };

    const typeIcons: Record<string, string> = {
      pf: '🏛️', nps: '📊', ppf: '🏦', vpf: '💼', sukanya: '👧',
    };

    return (
      <View>
        {Object.entries(grouped).map(([type, typeFunds]) => (
          <View key={type}>
            <Text style={styles.sectionTitle}>
              {typeIcons[type] || '📈'} {typeLabels[type] || type.toUpperCase()}
            </Text>
            {typeFunds.map((fund) => {
              const invested = Number(fund.invested_amount) || 0;
              const current = Number(fund.current_value) || 0;
              const gainLoss = current - invested;
              const gainPct = invested > 0 ? (gainLoss / invested) * 100 : 0;
              const employerContrib = Number(fund.employer_contribution) || 0;
              const interestEarned = Number(fund.interest_earned) || 0;

              return (
                <View key={fund.id} style={styles.investmentCard}>
                  <View style={styles.investmentHeader}>
                    <Text style={[styles.investmentName, { fontSize: 14 }]} numberOfLines={2}>
                      {fund.account_name}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: fund.status === 'active' ? '#4CAF50' : fund.status === 'matured' ? '#FF9800' : '#999' }]}>
                      <Text style={styles.statusBadgeText}>{fund.status}</Text>
                    </View>
                  </View>

                  {/* Account identifiers */}
                  <View style={styles.ltMetaRow}>
                    {fund.uan_number && (
                      <Text style={styles.ltMetaText}>UAN: {fund.uan_number}</Text>
                    )}
                    {fund.pran_number && (
                      <Text style={styles.ltMetaText}>PRAN: {fund.pran_number}</Text>
                    )}
                    {fund.account_number && !fund.uan_number && !fund.pran_number && (
                      <Text style={styles.ltMetaText}>A/C: {fund.account_number}</Text>
                    )}
                  </View>

                  {/* Main values */}
                  <View style={styles.investmentRow}>
                    <View style={styles.investmentCol}>
                      <Text style={styles.investmentLabel}>Invested</Text>
                      <Text style={styles.investmentValue}>{formatCompactCurrency(invested)}</Text>
                    </View>
                    <View style={styles.investmentCol}>
                      <Text style={styles.investmentLabel}>Current Value</Text>
                      <Text style={styles.investmentValueBold}>{formatCompactCurrency(current)}</Text>
                    </View>
                    <View style={styles.investmentCol}>
                      <Text style={styles.investmentLabel}>Gain/Loss</Text>
                      <Text style={[styles.investmentGain, { color: gainLoss >= 0 ? '#4CAF50' : '#F44336' }]}>
                        {gainLoss >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {/* Breakdown row for PF/NPS */}
                  {(employerContrib > 0 || interestEarned > 0) && (
                    <View style={styles.breakdownRow}>
                      {employerContrib > 0 && (
                        <View style={styles.breakdownItem}>
                          <Text style={styles.breakdownLabel}>Employer</Text>
                          <Text style={styles.breakdownValue}>{formatCompactCurrency(employerContrib)}</Text>
                        </View>
                      )}
                      {interestEarned > 0 && (
                        <View style={styles.breakdownItem}>
                          <Text style={styles.breakdownLabel}>Interest</Text>
                          <Text style={[styles.breakdownValue, { color: '#4CAF50' }]}>
                            {formatCompactCurrency(interestEarned)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Last contribution */}
                  {fund.last_contribution_date && (
                    <Text style={styles.maturityDate}>
                      Last contribution: {new Date(fund.last_contribution_date).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                  {fund.maturity_date && (
                    <Text style={styles.maturityDate}>
                      Matures: {new Date(fund.maturity_date).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {funds.length === 0 && (
          <Text style={styles.emptyText}>No long-term funds found</Text>
        )}
      </View>
    );
  };

  // Allocation pie chart for MF by AMC
  const getMFAllocationData = () => {
    if (activeTab !== 'mf') return [];
    const mfs = investments?.mutual_funds || [];
    const amcMap: Record<string, number> = {};
    mfs.forEach((mf) => {
      const amc = mf.amc || 'Other';
      amcMap[amc] = (amcMap[amc] || 0) + Number(mf.current_value || 0);
    });
    return Object.entries(amcMap)
      .sort((a, b) => b[1] - a[1])
      .map(([amc, value], i) => ({
        value,
        text: formatCompactCurrency(value),
        color: COLORS[i % COLORS.length],
        label: amc.replace(' Mutual Fund', ''),
      }));
  };

  // Long-term allocation pie
  const getLTAllocationData = () => {
    if (activeTab !== 'longterm') return [];
    const funds = investments?.long_term_funds || [];
    return funds.map((f, i) => ({
      value: Number(f.current_value || 0),
      text: formatCompactCurrency(Number(f.current_value || 0)),
      color: COLORS[i % COLORS.length],
      label: f.fund_type?.toUpperCase(),
    }));
  };

  // Gain/Loss chart for stocks
  const getGainLossData = () => {
    if (activeTab !== 'stocks') return [];
    return (investments?.stocks || [])
      .filter(s => Number(s.gain_loss_percent) !== 0)
      .sort((a, b) => Math.abs(Number(b.gain_loss_percent)) - Math.abs(Number(a.gain_loss_percent)))
      .slice(0, 6)
      .map((stock) => {
        const pct = Number(stock.gain_loss_percent);
        return {
          value: Math.abs(pct),
          label: stock.symbol.substring(0, 6),
          frontColor: pct >= 0 ? '#4CAF50' : '#F44336',
        };
      });
  };

  // Maturity timeline for FDs
  const getMaturityTimeline = () => {
    if (activeTab !== 'fd') return [];
    const fds = investments?.fixed_deposits.filter(fd => fd.status === 'active') || [];
    return fds
      .sort((a, b) => new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime())
      .slice(0, 5)
      .map((fd, index) => ({
        value: Number(fd.maturity_value),
        label: new Date(fd.maturity_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        frontColor: COLORS[index % COLORS.length],
      }));
  };

  const renderChart = () => {
    // Stocks: bar chart
    if (activeTab === 'stocks') {
      const data = getGainLossData();
      if (data.length === 0) return null;
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Top Movers - P&L %</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={data}
              width={Math.max(width - 60, data.length * 60)}
              height={180}
              barWidth={40}
              spacing={20}
              roundedTop
              xAxisThickness={1}
              yAxisThickness={1}
              yAxisTextStyle={{ color: '#666', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...data.map(d => d.value)) * 1.2 || 10}
            />
          </ScrollView>
        </View>
      );
    }

    // MF: pie by AMC
    if (activeTab === 'mf') {
      const data = getMFAllocationData();
      if (data.length === 0) return null;
      const totalMF = data.reduce((s, d) => s + d.value, 0);
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>AMC Allocation</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={data}
              donut
              radius={90}
              innerRadius={55}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                    {formatCompactCurrency(totalMF)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#999' }}>Total</Text>
                </View>
              )}
            />
            <View style={styles.legendContainer}>
              {data.map((d, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>{d.label}</Text>
                  <Text style={styles.legendValue}>{d.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // FD: maturity timeline
    if (activeTab === 'fd') {
      const data = getMaturityTimeline();
      if (data.length === 0) return null;
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Upcoming Maturities</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={data}
              width={Math.max(width - 60, data.length * 60)}
              height={180}
              barWidth={40}
              spacing={20}
              roundedTop
              xAxisThickness={1}
              yAxisThickness={1}
              yAxisTextStyle={{ color: '#666', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#666', fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...data.map(d => d.value)) * 1.2 || 10}
            />
          </ScrollView>
        </View>
      );
    }

    // Long-term: pie by type
    if (activeTab === 'longterm') {
      const data = getLTAllocationData();
      if (data.length === 0) return null;
      const totalLT = data.reduce((s, d) => s + d.value, 0);
      return (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Fund Allocation</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={data}
              donut
              radius={90}
              innerRadius={55}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                    {formatCompactCurrency(totalLT)}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#999' }}>Total</Text>
                </View>
              )}
            />
            <View style={styles.legendContainer}>
              {data.map((d, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.legendText}>{d.label}</Text>
                  <Text style={styles.legendValue}>{d.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        {([
          { key: 'stocks' as const, label: 'Stocks', count: tabSummary?.stocks.count },
          { key: 'mf' as const, label: 'MF', count: tabSummary?.mf.count },
          { key: 'fd' as const, label: 'FD', count: tabSummary?.fd.count },
          { key: 'longterm' as const, label: 'PF/NPS', count: tabSummary?.longterm.count },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
            {(tab.count ?? 0) > 0 && (
              <Text style={[styles.tabCount, activeTab === tab.key && styles.activeTabCount]}>
                {tab.count}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInvestments} />}
      >
        {renderSummaryCard()}
        {renderChart()}
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
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  tabCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  activeTabCount: {
    color: '#2196F3',
  },
  scrollView: {
    flex: 1,
  },
  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryGain: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Investment cards
  investmentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  investmentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  investmentSubtext: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  investmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  investmentCol: {
    flex: 1,
  },
  investmentLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 3,
  },
  investmentValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  investmentValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  investmentGain: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Badges
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  platformBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  // MF specific
  mfMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mfBadges: {
    flexDirection: 'row',
  },
  folioText: {
    fontSize: 11,
    color: '#bbb',
    marginBottom: 4,
  },
  // Long-term specific
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#555',
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  ltMetaRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 12,
  },
  ltMetaText: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  breakdownRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 24,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 3,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  maturityDate: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 32,
  },
  // Charts
  chartCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    marginLeft: 16,
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
});

export default InvestmentsScreen;
