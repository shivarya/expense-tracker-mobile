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

const AccountsScreen = () => {
  const { accounts, loading, refreshAccounts } = useData();

  if (loading && accounts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAccounts} />}
    >
      {accounts.map((account) => (
        <View key={account.id} style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View>
              <Text style={styles.accountName}>{account.account_name}</Text>
              <Text style={styles.accountBank}>
                {account.bank.toUpperCase()} • {account.account_type}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: account.status === 'active' ? '#4CAF50' : '#999' },
              ]}
            >
              <Text style={styles.statusText}>{account.status}</Text>
            </View>
          </View>

          <View style={styles.accountDetails}>
            {account.account_type === 'credit_card' ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Credit Limit</Text>
                  <Text style={styles.detailValue}>
                    ₹{account.credit_limit?.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Available</Text>
                  <Text style={styles.detailValue}>
                    ₹{account.available_credit?.toLocaleString('en-IN')}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Balance</Text>
                <Text style={styles.detailValue}>
                  ₹{account.balance.toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}

      {accounts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No accounts found</Text>
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
  },
  accountCard: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  accountBank: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  accountDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default AccountsScreen;
