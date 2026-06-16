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
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, formatCompactCurrency } from '../utils/format';

const { width } = Dimensions.get('window');

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4CAF50', '#E91E63'];

const InvestmentsScreen = () => {
  const { investments, loading, error, refreshInvestments } = useData();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'stocks' | 'mf' | 'fd' | 'longterm'>('stocks');

  const labelTextStyle = { color: colors.textSecondary };
  const valueTextStyle = { color: colors.text };

  const getDateLabelForFDChart = (dateString: string) => {
    const dt = new Date(dateString);
    if (Number.isNaN(dt.getTime())) return '--';
    return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  const formatYAxisLabel = (label: string) => {
    const value = Number(label);
    if (Number.isNaN(value)) return label;
    if (Number.isInteger(value)) return value.toLocaleString('en-IN');
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

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
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.error} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.error }]} onPress={refreshInvestments}>
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
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Invested</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(summary.invested)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current Value</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(summary.current)}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gain/Loss</Text>
            <Text style={[styles.summaryGain, { color: gainLoss >= 0 ? colors.success : colors.error }]}>
              {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)} ({gainPct.toFixed(1)}%)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Holdings</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.count}</Text>
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
          <View key={stock.id} style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.investmentHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.investmentName, { color: colors.text }]}>{stock.symbol}</Text>
                {stock.company_name && (
                  <Text style={[styles.investmentSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
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
                <Text style={[styles.investmentLabel, { color: colors.textSecondary }]}>Qty × CMP</Text>
                <Text style={[styles.investmentValue, { color: colors.text }]}>
                  {qty} × ₹{cmp.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={[styles.investmentLabel, { color: colors.textSecondary }]}>Current Value</Text>
                <Text style={[styles.investmentValueBold, { color: colors.text }]}>
                  {formatCurrency(Number(stock.current_value))}
                </Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={[styles.investmentLabel, { color: colors.textSecondary }]}>P&L</Text>
                <Text
                  style={[styles.investmentGain, { color: gainPct >= 0 ? colors.success : colors.error }]}
                >
                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {investments?.stocks.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No stocks found</Text>
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
          <View key={fund.id} style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.investmentHeader}>
              <Text style={[styles.investmentName, { fontSize: 14, color: colors.text }]} numberOfLines={2}>
                {fund.fund_name}
              </Text>
            </View>
            <View style={styles.mfMetaRow}>
              <Text style={[styles.investmentSubtext, { color: colors.textSecondary }]}>{fund.amc}</Text>
              <View style={styles.mfBadges}>
                <View style={[styles.typeBadge, { backgroundColor: fund.plan_type === 'direct' ? colors.success : colors.warning }]}>
                  <Text style={styles.typeBadgeText}>{fund.plan_type?.toUpperCase()}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: '#2B7BE5', marginLeft: 4 }]}>
                  <Text style={styles.typeBadgeText}>{(fund.option_type || 'growth').toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.folioText, { color: colors.textSecondary }]}>Folio: {fund.folio_number}</Text>
            <View style={styles.investmentRow}>
              <View style={styles.investmentCol}>
                <Text style={[styles.investmentLabel, labelTextStyle]}>Units</Text>
                <Text style={[styles.investmentValue, valueTextStyle]}>{units.toFixed(3)}</Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={[styles.investmentLabel, labelTextStyle]}>NAV</Text>
                <Text style={[styles.investmentValue, valueTextStyle]}>₹{nav.toFixed(2)}</Text>
              </View>
              <View style={styles.investmentCol}>
                <Text style={[styles.investmentLabel, labelTextStyle]}>Value</Text>
                <Text style={[styles.investmentValueBold, valueTextStyle]}>
                  {formatCurrency(currentVal)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {investments?.mutual_funds.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No mutual funds found</Text>
      )}
    </View>
  );

  const renderFixedDeposits = () => (
    <View>
      {investments?.fixed_deposits.map((fd) => (
        <View key={fd.id} style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.investmentHeader}>
            <Text style={[styles.investmentName, { color: colors.text }]}>{fd.bank} FD</Text>
            <View style={[styles.statusBadge, { backgroundColor: fd.status === 'active' ? colors.success : colors.textSecondary }]}>
              <Text style={styles.statusBadgeText}>{fd.status}</Text>
            </View>
          </View>
          <View style={styles.investmentRow}>
            <View style={styles.investmentCol}>
              <Text style={[styles.investmentLabel, labelTextStyle]}>Principal</Text>
              <Text style={[styles.investmentValue, valueTextStyle]}>
                {formatCurrency(Number(fd.principal_amount))}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={[styles.investmentLabel, labelTextStyle]}>Maturity</Text>
              <Text style={[styles.investmentValueBold, valueTextStyle]}>
                {formatCurrency(Number(fd.maturity_value))}
              </Text>
            </View>
            <View style={styles.investmentCol}>
              <Text style={[styles.investmentLabel, labelTextStyle]}>Rate</Text>
              <Text style={[styles.investmentValue, valueTextStyle]}>{fd.interest_rate}%</Text>
            </View>
          </View>
          <Text style={[styles.maturityDate, { color: colors.warning }]}>
            Matures: {new Date(fd.maturity_date).toLocaleDateString('en-IN')}
          </Text>
        </View>
      ))}
      {investments?.fixed_deposits.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No fixed deposits found</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
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
                <View key={fund.id} style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.investmentHeader}>
                    <Text style={[styles.investmentName, { fontSize: 14, color: colors.text }]} numberOfLines={2}>
                      {fund.account_name}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: fund.status === 'active' ? colors.success : fund.status === 'matured' ? colors.warning : colors.textSecondary }]}>
                      <Text style={styles.statusBadgeText}>{fund.status}</Text>
                    </View>
                  </View>

                  {/* Account identifiers */}
                  <View style={styles.ltMetaRow}>
                    {fund.uan_number && (
                      <Text style={[styles.ltMetaText, { color: colors.textSecondary }]}>UAN: {fund.uan_number}</Text>
                    )}
                    {fund.pran_number && (
                      <Text style={[styles.ltMetaText, { color: colors.textSecondary }]}>PRAN: {fund.pran_number}</Text>
                    )}
                    {fund.account_number && !fund.uan_number && !fund.pran_number && (
                      <Text style={[styles.ltMetaText, { color: colors.textSecondary }]}>A/C: {fund.account_number}</Text>
                    )}
                  </View>

                  {/* Main values */}
                  <View style={styles.investmentRow}>
                    <View style={styles.investmentCol}>
                      <Text style={[styles.investmentLabel, labelTextStyle]}>Invested</Text>
                      <Text style={[styles.investmentValue, valueTextStyle]}>{formatCompactCurrency(invested)}</Text>
                    </View>
                    <View style={styles.investmentCol}>
                      <Text style={[styles.investmentLabel, labelTextStyle]}>Current Value</Text>
                      <Text style={[styles.investmentValueBold, valueTextStyle]}>{formatCompactCurrency(current)}</Text>
                    </View>
                    <View style={styles.investmentCol}>
                      <Text style={[styles.investmentLabel, labelTextStyle]}>Gain/Loss</Text>
                      <Text style={[styles.investmentGain, { color: gainLoss >= 0 ? colors.success : colors.error }]}>
                        {gainLoss >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {/* Breakdown row for PF/NPS */}
                  {(employerContrib > 0 || interestEarned > 0) && (
                    <View style={[styles.breakdownRow, { borderTopColor: colors.divider }]}>
                      {employerContrib > 0 && (
                        <View style={styles.breakdownItem}>
                          <Text style={[styles.breakdownLabel, labelTextStyle]}>Employer</Text>
                          <Text style={[styles.breakdownValue, valueTextStyle]}>{formatCompactCurrency(employerContrib)}</Text>
                        </View>
                      )}
                      {interestEarned > 0 && (
                        <View style={styles.breakdownItem}>
                          <Text style={[styles.breakdownLabel, labelTextStyle]}>Interest</Text>
                          <Text style={[styles.breakdownValue, { color: colors.success }]}>
                            {formatCompactCurrency(interestEarned)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Last contribution */}
                  {fund.last_contribution_date && (
                    <Text style={[styles.maturityDate, { color: colors.warning }]}>
                      Last contribution: {new Date(fund.last_contribution_date).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                  {fund.maturity_date && (
                    <Text style={[styles.maturityDate, { color: colors.warning }]}>
                      Matures: {new Date(fund.maturity_date).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {funds.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No long-term funds found</Text>
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

    const typeCounts = funds.reduce<Record<string, number>>((acc, fund) => {
      const type = (fund.fund_type || 'other').toUpperCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return funds.map((f, i) => ({
      value: Number(f.current_value || 0),
      text: formatCompactCurrency(Number(f.current_value || 0)),
      color: COLORS[i % COLORS.length],
      label: (() => {
        const type = (f.fund_type || 'other').toUpperCase();
        const accountName = (f.account_name || '').trim();
        const hasDuplicateType = (typeCounts[type] || 0) > 1;

        if (hasDuplicateType) {
          if (accountName && accountName.toUpperCase() !== type) {
            return accountName.length > 20 ? `${accountName.slice(0, 20)}...` : accountName;
          }

          const accountId = f.account_number || f.uan_number || f.pran_number || '';
          if (accountId) {
            const last4 = accountId.slice(-4);
            return `${type} ${last4 ? `•${last4}` : ''}`.trim();
          }

          return `${type} ${i + 1}`;
        }

        if (accountName && accountName.toUpperCase() !== type) {
          return accountName.length > 20 ? `${accountName.slice(0, 20)}...` : accountName;
        }

        return type;
      })(),
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
          frontColor: pct >= 0 ? colors.success : colors.error,
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
      .map((fd, index) => {
        const maturityValue = Number(fd.maturity_value) || 0;
        return {
          value: maturityValue,
          label: getDateLabelForFDChart(fd.maturity_date),
          frontColor: COLORS[index % COLORS.length],
          topLabelComponent: () => (
            <Text style={[styles.barTopLabel, { color: colors.textSecondary }]}>
              {formatCompactCurrency(maturityValue)}
            </Text>
          ),
        };
      });
  };

  const renderChart = () => {
    // Stocks: bar chart
    if (activeTab === 'stocks') {
      const data = getGainLossData();
      if (data.length === 0) return null;
      return (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>TOP MOVERS — P&L %</Text>
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
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }}
              xAxisColor={colors.border}
              noOfSections={4}
              maxValue={Math.max(...data.map(d => d.value)) * 1.2 || 10}
              formatYLabel={(label: string) => formatYAxisLabel(label)}
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
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>AMC ALLOCATION</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={data}
              donut
              radius={90}
              innerRadius={55}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                    {formatCompactCurrency(totalMF)}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Total</Text>
                </View>
              )}
            />
            <View style={styles.legendContainer}>
              {data.map((d, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]} numberOfLines={1}>{d.label}</Text>
                  <Text style={[styles.legendValue, { color: colors.text }]}>{d.text}</Text>
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
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>UPCOMING MATURITIES</Text>
          <Text style={[styles.chartHelperText, { color: colors.textSecondary }]}>Bars show maturity amount, X-axis shows month/year.</Text>
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
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }}
              xAxisColor={colors.border}
              noOfSections={4}
              maxValue={Math.max(...data.map(d => d.value)) * 1.2 || 10}
              formatYLabel={(label: string) => formatYAxisLabel(label)}
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
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>FUND ALLOCATION</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={data}
              donut
              radius={90}
              innerRadius={55}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                    {formatCompactCurrency(totalLT)}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>Total</Text>
                </View>
              )}
            />
            <View style={styles.legendContainer}>
              {data.map((d, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]} numberOfLines={1}>{d.label}</Text>
                  <Text style={[styles.legendValue, { color: colors.text }]}>{d.text}</Text>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          { key: 'stocks' as const, label: 'Stocks', count: tabSummary?.stocks.count },
          { key: 'mf' as const, label: 'MF', count: tabSummary?.mf.count },
          { key: 'fd' as const, label: 'FD', count: tabSummary?.fd.count },
          { key: 'longterm' as const, label: 'PF/NPS', count: tabSummary?.longterm.count },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.error }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === tab.key && { color: colors.error, fontWeight: '700' }]}>
              {tab.label}
            </Text>
            {(tab.count ?? 0) > 0 && (
              <Text style={[styles.tabCount, { color: colors.textSecondary }, activeTab === tab.key && { color: colors.error }]}>
                {tab.count}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshInvestments} tintColor={colors.error} />}
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
  },
  tabCount: {
    fontSize: 10,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  // Summary card
  summaryCard: {
    margin: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
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
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryGain: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Investment cards
  investmentCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
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
    flex: 1,
  },
  investmentSubtext: {
    fontSize: 12,
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
    marginBottom: 3,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  investmentValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  investmentValueBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  investmentGain: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Badges
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    borderRadius: 4,
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
    marginBottom: 4,
  },
  // Long-term specific
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
    fontFamily: 'monospace',
  },
  breakdownRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 24,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 10,
    marginBottom: 3,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  maturityDate: {
    fontSize: 11,
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 32,
  },
  // Charts
  chartCard: {
    margin: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  chartHelperText: {
    fontSize: 10,
    marginTop: -10,
    marginBottom: 10,
  },
  barTopLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
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
    flex: 1,
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default InvestmentsScreen;
