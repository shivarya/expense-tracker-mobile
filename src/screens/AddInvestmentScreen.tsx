import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';

type Kind = 'fd' | 'long_term';
type FundType = 'pf' | 'nps' | 'ppf' | 'sukanya' | 'vpf';

const BANKS = ['hdfc', 'sbi', 'icici', 'idfc', 'rbl', 'axis', 'kotak', 'other'];
const FUND_TYPES: FundType[] = ['pf', 'nps', 'ppf', 'sukanya', 'vpf'];

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const num = (v: string): number => {
  const n = parseFloat((v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const AddInvestmentScreen = () => {
  const { colors } = useTheme();
  const { refreshAll } = useData();
  const navigation = useNavigation<any>();

  const [kind, setKind] = useState<Kind>('fd');
  const [saving, setSaving] = useState(false);

  // Fixed deposit
  const [bank, setBank] = useState('hdfc');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [maturityValue, setMaturityValue] = useState('');
  const [fdNumber, setFdNumber] = useState('');

  // Long-term fund
  const [fundType, setFundType] = useState<FundType>('pf');
  const [accountName, setAccountName] = useState('');
  const [invested, setInvested] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [interestEarned, setInterestEarned] = useState('');

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    keyboardType: KeyboardTypeOptions = 'default',
    placeholder = ''
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setter}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
      />
    </View>
  );

  const chips = (options: string[], selected: string, onSelect: (v: string) => void) => (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const isSel = selected === o;
        return (
          <TouchableOpacity
            key={o}
            style={[styles.chip, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : colors.background }]}
            onPress={() => onSelect(o)}
          >
            <Text style={[styles.chipText, { color: isSel ? colors.background : colors.text }]}>{o.toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const submitFd = async () => {
    if (num(principal) <= 0 || num(maturityValue) <= 0 || num(tenure) <= 0) {
      Alert.alert('Missing fields', 'Principal, tenure (months) and maturity value are required.');
      return;
    }
    if (!startDate || !maturityDate) {
      Alert.alert('Missing dates', 'Enter start and maturity dates (YYYY-MM-DD).');
      return;
    }
    await ApiService.createFixedDeposit({
      bank,
      fd_number: fdNumber || null,
      principal_amount: num(principal),
      interest_rate: num(rate),
      tenure_months: Math.round(num(tenure)),
      start_date: startDate,
      maturity_date: maturityDate,
      maturity_value: num(maturityValue),
      status: 'active',
    });
  };

  const submitLongTerm = async () => {
    if (!accountName.trim()) {
      Alert.alert('Missing field', 'Account name is required.');
      return;
    }
    if (num(invested) <= 0 && num(currentValue) <= 0) {
      Alert.alert('Missing amounts', 'Enter invested amount and/or current value.');
      return;
    }
    await ApiService.createLongTermFund({
      fund_type: fundType,
      account_name: accountName.trim(),
      account_number: accountNo || null,
      pran_number: fundType === 'nps' ? accountNo || null : null,
      uan_number: fundType === 'pf' ? accountNo || null : null,
      invested_amount: num(invested),
      current_value: num(currentValue),
      interest_earned: num(interestEarned),
      status: 'active',
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (kind === 'fd') {
        await submitFd();
      } else {
        await submitLongTerm();
      }
      await refreshAll();
      Alert.alert('Saved', kind === 'fd' ? 'Fixed deposit added.' : 'Long-term fund added.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.chipRow}>
        {(['fd', 'long_term'] as Kind[]).map((k) => {
          const isSel = kind === k;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.tab, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : colors.background }]}
              onPress={() => setKind(k)}
            >
              <Text style={[styles.tabText, { color: isSel ? colors.background : colors.text }]}>
                {k === 'fd' ? 'Fixed Deposit' : 'PF / NPS / PPF'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        {kind === 'fd' ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Bank</Text>
            {chips(BANKS, bank, setBank)}
            {field('Principal Amount (₹)', principal, setPrincipal, 'numeric', 'e.g. 100000')}
            {field('Interest Rate (% p.a.)', rate, setRate, 'numeric', 'e.g. 7.1')}
            {field('Tenure (months)', tenure, setTenure, 'numeric', 'e.g. 24')}
            {field('Start Date (YYYY-MM-DD)', startDate, setStartDate, 'default', '2026-01-15')}
            {field('Maturity Date (YYYY-MM-DD)', maturityDate, setMaturityDate, 'default', '2028-01-15')}
            {field('Maturity Value (₹)', maturityValue, setMaturityValue, 'numeric', 'e.g. 114000')}
            {field('FD Number (optional)', fdNumber, setFdNumber)}
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Fund Type</Text>
            {chips(FUND_TYPES, fundType, (v) => setFundType(v as FundType))}
            {field('Account Name', accountName, setAccountName, 'default', 'e.g. EPF - Employer')}
            {field('Invested / Contributions (₹)', invested, setInvested, 'numeric')}
            {field('Current Value (₹)', currentValue, setCurrentValue, 'numeric')}
            {field(
              fundType === 'nps' ? 'PRAN (optional)' : fundType === 'pf' ? 'UAN (optional)' : 'Account No (optional)',
              accountNo,
              setAccountNo
            )}
            {field('Interest Earned (₹, optional)', interestEarned, setInterestEarned, 'numeric')}
          </>
        )}

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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  section: { borderRadius: 12, padding: 16, gap: 12 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontWeight: '700' },
  tab: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '700' },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
});

export default AddInvestmentScreen;
