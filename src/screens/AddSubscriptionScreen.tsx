import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SubscriptionBillingCycle } from '../types/subscriptions';

const CYCLES: SubscriptionBillingCycle[] = ['weekly', 'monthly', 'quarterly', 'annual'];
const CYCLE_LABEL: Record<SubscriptionBillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const num = (v: string): number => {
  const n = parseFloat((v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const AddSubscriptionScreen = () => {
  const { colors } = useTheme();
  const { refreshSubscriptions } = useData();
  const navigation = useNavigation<any>();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<SubscriptionBillingCycle>('annual');
  const [cancelUrl, setCancelUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Enter the subscription name.');
      return;
    }
    if (num(amount) <= 0) {
      Alert.alert('Missing field', 'Enter the amount.');
      return;
    }
    try {
      setSaving(true);
      await ApiService.createSubscription({
        display_name: name.trim(),
        average_amount: num(amount),
        billing_cycle: cycle,
        cancel_url: cancelUrl.trim() || undefined,
      });
      await refreshSubscriptions();
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Could not add subscription.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          For a subscription you already know about that hasn't been auto-detected yet — usually a quarterly or annual
          charge with only one payment in your history so far, which isn't enough on its own to tell it's recurring.
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: colors.text }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. LIC, Amazon Prime, Car Insurance"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: colors.text }]}>Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="e.g. 14018"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: colors.text }]}>Billing Cycle</Text>
          <View style={styles.chipRow}>
            {CYCLES.map((c) => {
              const isSel = cycle === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : colors.background }]}
                  onPress={() => setCycle(c)}
                >
                  <Text style={[styles.chipText, { color: isSel ? colors.background : colors.text }]}>{CYCLE_LABEL[c]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: colors.text }]}>Cancellation Link (optional)</Text>
          <TextInput
            value={cancelUrl}
            onChangeText={setCancelUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Leave blank to auto-fill with a search link"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color={colors.background} />
            <Text style={[styles.saveBtnText, { color: colors.background }]}>Save</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  section: { borderRadius: 12, padding: 16, gap: 12 },
  label: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontWeight: '700' },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
});

export default AddSubscriptionScreen;
