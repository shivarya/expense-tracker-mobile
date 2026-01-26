import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useSMSSync } from '../hooks/useSMSSync';
import { useData } from '../contexts/DataContext';

const MoreScreen = () => {
  const { theme, setTheme, isDark, colors } = useTheme();
  const { syncSMS, isSyncing, lastSyncTime } = useSMSSync();
  const { refreshAll } = useData();
  const [syncResult, setSyncResult] = useState<string | null>(null);
  
  const menuItems = [
    { id: 'emis', icon: 'cash-outline', label: 'EMI Tracking', screen: 'EMIs' },
    { id: 'categories', icon: 'pricetags-outline', label: 'Categories', screen: 'Categories' },
    { id: 'settings', icon: 'settings-outline', label: 'Settings', screen: 'Settings' },
  ];

  const handleThemeChange = (value: 'light' | 'dark' | 'auto') => {
    setTheme(value);
  };

  const handleSyncSMS = async () => {
    try {
      setSyncResult(null);
      const result = await syncSMS();
      
      if (result.success) {
        const message = `SMS Sync Complete!\n\nFound: ${result.count} bank SMS\nParsed: ${result.parsed} transactions\nSaved: ${result.saved} new\nSkipped: ${result.skipped} duplicates`;
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
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="phone-portrait-outline" size={24} color="#fff" />
              <Text style={styles.syncButtonText}>Sync SMS Transactions</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.syncInfo}>
          <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
            Last synced: {formatLastSync()}
          </Text>
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
          <TouchableOpacity key={item.id} style={[styles.menuItem, { borderBottomColor: colors.border }]}>
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
          <Text style={[styles.infoValue, { color: colors.textSecondary }]}>1.0.0</Text>
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
