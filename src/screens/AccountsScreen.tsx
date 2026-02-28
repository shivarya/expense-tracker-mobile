import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency } from '../utils/format';

const BANK_COLORS: Record<string, string> = {
  hdfc: '#004C8F',
  sbi: '#266BB2',
  icici: '#F37021',
  idfc: '#8B0000',
  rbl: '#CC0000',
  axis: '#97144D',
  kotak: '#EF3829',
  federal: '#008000',
};

const getBankColor = (bank: string) => BANK_COLORS[bank.toLowerCase()] || '#333333';

const AccountsScreen = () => {
  const { accounts, loading, refreshAccounts } = useData();
  const { colors, isDark } = useTheme();

  if (loading && accounts.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.error} />
      </View>
    );
  }

  const creditCards = accounts.filter(a => a.account_type === 'credit_card');
  const savings = accounts.filter(a => a.account_type !== 'credit_card');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshAccounts} tintColor={colors.error} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Credit Cards */}
      {creditCards.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CREDIT CARDS</Text>
          {creditCards.map((account) => {
            const bankColor = getBankColor(account.bank);
            const limit = Number(account.credit_limit || 0);
            const available = Number(account.available_credit || 0);
            const used = limit - available;
            const usedPct = limit > 0 ? (used / limit) : 0;
            return (
              <View key={account.id} style={[styles.creditCard, { backgroundColor: bankColor }]}>
                {/* Card number emulation */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardBankName}>{account.bank.toUpperCase()}</Text>
                  <View style={[styles.statusDot, {
                    backgroundColor: account.status === 'active' ? '#00C48C' : '#aaa',
                  }]} />
                </View>
                <Text style={styles.cardChipRow}>••••  ••••  ••••  <Text style={styles.cardChipDigits}>1234</Text></Text>
                <Text style={styles.cardName}>{account.account_name}</Text>
                <View style={styles.cardDivider} />
                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>LIMIT</Text>
                    <Text style={styles.cardStatValue}>{formatCurrency(limit)}</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>AVAILABLE</Text>
                    <Text style={[styles.cardStatValue, { color: '#00FF88' }]}>{formatCurrency(available)}</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatLabel}>USED</Text>
                    <Text style={[styles.cardStatValue, { color: usedPct > 0.8 ? '#FF4757' : '#FFE' }]}>{formatCurrency(used)}</Text>
                  </View>
                </View>
                {/* Usage bar */}
                <View style={styles.usageBarBg}>
                  <View style={[styles.usageBarFill, {
                    width: (usedPct * 100) + '%' as any,
                    backgroundColor: usedPct > 0.8 ? '#FF4757' : '#00FF88',
                  }]} />
                </View>
                <Text style={styles.usageLabel}>{(usedPct * 100).toFixed(0)}% utilised</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Savings / Bank Accounts */}
      {savings.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BANK ACCOUNTS</Text>
          {savings.map((account, i) => (
            <View key={account.id} style={[styles.bankCard, {
              backgroundColor: colors.card,
              borderColor: colors.border,
            }]}>
              <View style={styles.bankCardLeft}>
                <View style={[styles.bankIcon, { backgroundColor: getBankColor(account.bank) }]}>
                  <Text style={styles.bankIconText}>{account.bank.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={[styles.bankName, { color: colors.text }]}>{account.account_name}</Text>
                  <Text style={[styles.bankMeta, { color: colors.textSecondary }]}>
                    {account.bank.toUpperCase()} • {account.account_type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.bankCardRight}>
                <Text style={[styles.bankBalance, { color: colors.text }]}>
                  {formatCurrency(Number(account.balance))}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: account.status === 'active' ? colors.success + '22' : colors.border }]}>
                  <Text style={[styles.statusPillText, { color: account.status === 'active' ? colors.success : colors.textSecondary }]}>
                    {account.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {accounts.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon]}>🏦</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No accounts yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Your bank accounts will appear here after syncing
          </Text>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 24, paddingTop: 8 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  // Credit Card
  creditCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 20,
    borderRadius: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardBankName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardChipRow: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardChipDigits: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  cardName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardStat: { flex: 1 },
  cardStatLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  usageBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  usageLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Bank accounts
  bankCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  bankIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  bankName: {
    fontSize: 15,
    fontWeight: '600',
  },
  bankMeta: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  bankCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bankBalance: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  bottomPad: { height: 16 },
});

export default AccountsScreen;
