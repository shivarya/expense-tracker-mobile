import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useSMSSync } from '../hooks/useSMSSync';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';
import { MoreStackParamList } from '../navigation/MoreStackNavigator';

type MoreNavProp = NativeStackNavigationProp<MoreStackParamList, 'MoreHome'>;

const MoreScreen = () => {
  const navigation = useNavigation<MoreNavProp>();
  const { theme, setTheme, isDark, colors } = useTheme();
  const { syncSMS, isSyncing, lastSyncTime, resetSyncHistory, lastAutoSyncResult, isRealtimeBridgeAvailable } = useSMSSync();
  const { refreshAll } = useData();
  const { logout } = useAuth();
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and ALL your data including transactions, categories, and accounts. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type your confirmation: all data will be lost forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setIsDeletingAccount(true);
                      await ApiService.deleteAccount();
                      await logout();
                    } catch (error: any) {
                      setIsDeletingAccount(false);
                      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };
  
  const menuItems: { id: string; icon: string; label: string; screen: keyof MoreStackParamList }[] = [
    { id: 'contacts', icon: 'people-outline', label: 'Trusted Contacts', screen: 'TrustedContacts' },
    { id: 'categories', icon: 'pricetags-outline', label: 'Categories', screen: 'Categories' },
    { id: 'groups', icon: 'layers-outline', label: 'Transaction Groups', screen: 'Groups' },
  ];

  const handleThemeChange = (value: 'light' | 'dark' | 'auto') => {
    setTheme(value);
  };

  const handleSyncSMS = async () => {
    try {
      setSyncResult(null);
      const result = await syncSMS();
      
      if (result.success) {
        const message = `SMS Sync Complete!\n\nFound: ${result.count} bank SMS\nParsed: ${result.parsed} transactions\nSaved: ${result.saved} new (${result.savedDebitCount} debit, ${result.savedCreditCount} credit)\nSkipped: ${result.skipped} duplicates`;
        setSyncResult(message);
        Alert.alert('Success', message);
        
        // Refresh data to show new transactions
        await refreshAll();
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to sync SMS';
      Alert.alert('Error', errorMsg);
      setSyncResult(`Error: ${errorMsg}`);
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const date = new Date(lastSyncTime);
    return date.toLocaleString();
  };

  const formatLastAutoSync = () => {
    if (!lastAutoSyncResult?.timestamp) return 'Never';
    return new Date(lastAutoSyncResult.timestamp).toLocaleString();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* SMS Sync Section */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Sync</Text>
        
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: isSyncing ? colors.border : colors.primary }]}
          onPress={handleSyncSMS}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Ionicons name="phone-portrait-outline" size={24} color={colors.background} />
              <Text style={[styles.syncButtonText, { color: colors.background }]}>Sync SMS Transactions</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: colors.border }]}
          onPress={() => {
            Alert.alert(
              'Reset SMS Sync',
              'This will allow you to re-sync all SMS messages from the last 30 days. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetSyncHistory();
                    Alert.alert('Success', 'SMS sync history cleared. You can now sync all messages again.');
                  }
                }
              ]
            );
          }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.text} />
          <Text style={[styles.resetButtonText, { color: colors.text }]}>Reset Sync History</Text>
        </TouchableOpacity>

        <View style={styles.syncInfo}>
          <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
            Last synced: {formatLastSync()}
          </Text>
          <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
            Auto sync mode: Real-time + Daily fallback
          </Text>
          <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
            Real-time listener: {isRealtimeBridgeAvailable ? 'Enabled' : 'Unavailable in this build'}
          </Text>
          <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
            Last auto sync: {formatLastAutoSync()}
          </Text>
          {lastAutoSyncResult && (
            <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
              Last auto result: saved {lastAutoSyncResult.saved} ({lastAutoSyncResult.savedDebitCount} debit, {lastAutoSyncResult.savedCreditCount} credit)
            </Text>
          )}
          {syncResult && (
            <Text style={[styles.syncResult, { color: colors.text }]}>
              {syncResult}
            </Text>
          )}
        </View>

        <View style={[styles.infoCard, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Automatically reads bank SMS from your phone and creates expense transactions using AI.
          </Text>
        </View>
      </View>

      {/* Theme Settings */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        
        <TouchableOpacity
          style={[styles.themeOption, { borderBottomColor: colors.border }]}
          onPress={() => handleThemeChange('light')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="sunny-outline" size={24} color={theme === 'light' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Light Mode</Text>
          </View>
          {theme === 'light' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.themeOption, { borderBottomColor: colors.border }]}
          onPress={() => handleThemeChange('dark')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="moon-outline" size={24} color={theme === 'dark' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          {theme === 'dark' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.themeOption}
          onPress={() => handleThemeChange('auto')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="phone-portrait-outline" size={24} color={theme === 'auto' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Auto (System)</Text>
          </View>
          {theme === 'auto' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Features</Text>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={styles.menuLeft}>
              <Ionicons name={item.icon as any} size={24} color={colors.primary} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Regional Settings</Text>
        <View style={[styles.infoCard, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.text }]}>Currency</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>INR (₹)</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={[styles.infoLabel, { color: colors.text }]}>Number Format</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>Indian (1,23,456)</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        <View style={[styles.infoCard, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.text }]}>App Version</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>2.0.0</Text>
        </View>
        <View style={[styles.infoCard, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.text }]}>Build</Text>
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>Phase 5.1</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={[styles.infoLabel, { color: colors.text }]}>Backend Status</Text>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.infoValue, { color: colors.success }]}>Connected</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <TouchableOpacity
          style={[styles.deleteAccountButton, { opacity: isDeletingAccount ? 0.6 : 1 }]}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteAccountText}>
            {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.deleteAccountWarning, { color: colors.textSecondary }]}>
          Permanently deletes your account and all data. Cannot be undone.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Legal</Text>
        <TouchableOpacity
          style={[styles.legalItem, { borderBottomColor: colors.border }]}
          onPress={() => Linking.openURL('https://shivarya.dev/expense_tracker/terms.html')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Terms of Use</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.legalItem, { borderBottomColor: colors.border }]}
          onPress={() => Linking.openURL('https://shivarya.dev/expense_tracker/disclaimer.html')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Disclaimer</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalItem}
          onPress={() => Linking.openURL('https://shivarya.dev/expense_tracker/privacy.html')}
        >
          <View style={styles.menuLeft}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Privacy Policy</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.placeholderContainer}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Current Theme: {theme === 'auto' ? `Auto (${isDark ? 'Dark' : 'Light'})` : theme.charAt(0).toUpperCase() + theme.slice(1)}{'\n\n'}
          Additional screens coming soon:{'\n'}
          • EMI Management{'\n'}
          • Category Customization{'\n'}
          • Manual Data Sync{'\n'}
          • Settings & Preferences
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  themeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    marginLeft: 16,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  placeholderContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 24,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    paddingVertical: 14,
    marginVertical: 12,
  },
  deleteAccountText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  deleteAccountWarning: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  syncInfo: {
    marginBottom: 12,
  },
  syncInfoText: {
    fontSize: 12,
    marginBottom: 8,
  },
  syncResult: {
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
});

export default MoreScreen;
