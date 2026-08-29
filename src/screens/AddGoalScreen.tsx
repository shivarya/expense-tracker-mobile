import React, { useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { GoalType } from '../types/goals';

const GOAL_TYPES: GoalType[] = ['debt_payoff', 'savings', 'net_worth', 'spend_cap'];
const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  debt_payoff: 'Debt Payoff',
  savings: 'Savings',
  net_worth: 'Net Worth',
  spend_cap: 'Spend Cap',
};

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const num = (v: string): number => {
  const n = parseFloat((v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const AddGoalScreen = () => {
  const { colors } = useTheme();
  const { emis, categories, refreshAll } = useData();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const goalId: number | undefined = route.params?.goalId;
  const isContributionMode = route.params?.mode === 'contribution';
  const isEdit = !!goalId && !isContributionMode;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [goalType, setGoalType] = useState<GoalType>('debt_payoff');
  const [name, setName] = useState('');

  // debt_payoff
  const [emiId, setEmiId] = useState<number | null>(null);

  // savings / net_worth / spend_cap
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startAmount, setStartAmount] = useState('0');
  const [assumedReturn, setAssumedReturn] = useState('10');
  const [assumedContribution, setAssumedContribution] = useState('');
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<number[]>([]);

  // contribution mini-form
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10));
  const [contribNote, setContribNote] = useState('');

  useEffect(() => {
    if (!goalId) return;
    (async () => {
      try {
        setLoading(true);
        const goal = await ApiService.getGoal(goalId);
        setGoalType(goal.goal_type);
        setName(goal.name);
        setEmiId(goal.emi_id ?? null);
        setTargetAmount(goal.target_amount != null ? String(goal.target_amount) : '');
        setTargetDate(goal.target_date || '');
        setStartAmount(String(goal.start_amount ?? 0));
        setAssumedReturn(goal.assumed_annual_return_percent != null ? String(goal.assumed_annual_return_percent) : '10');
        setAssumedContribution(goal.assumed_monthly_contribution != null ? String(goal.assumed_monthly_contribution) : '');
        setExcludedCategoryIds(goal.excluded_category_ids || []);
      } catch (error: any) {
        Alert.alert('Error', getApiErrorMessage(error, 'Failed to load goal'));
      } finally {
        setLoading(false);
      }
    })();
  }, [goalId]);

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

  const chips = <T extends string>(options: T[], selected: T | null, onSelect: (v: T) => void, labels?: Record<T, string>) => (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const isSel = selected === o;
        return (
          <TouchableOpacity
            key={o}
            style={[styles.chip, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : colors.background }]}
            onPress={() => onSelect(o)}
          >
            <Text style={[styles.chipText, { color: isSel ? colors.background : colors.text }]}>
              {labels ? labels[o] : o.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const toggleExcludedCategory = (categoryId: number) => {
    setExcludedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleSaveContribution = async () => {
    if (num(contribAmount) <= 0) {
      Alert.alert('Missing amount', 'Enter the contribution amount.');
      return;
    }
    if (!contribDate) {
      Alert.alert('Missing date', 'Enter the contribution date (YYYY-MM-DD).');
      return;
    }
    try {
      setSaving(true);
      await ApiService.addGoalContribution(goalId!, {
        amount: num(contribAmount),
        contributed_at: contribDate,
        note: contribNote || undefined,
      });
      await refreshAll();
      Alert.alert('Logged', 'Contribution logged.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Could not log contribution.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Goal name is required.');
      return;
    }

    const payload: any = { goal_type: goalType, name: name.trim() };

    if (goalType === 'debt_payoff') {
      if (!emiId) {
        Alert.alert('Missing field', 'Select which loan this goal tracks.');
        return;
      }
      payload.emi_id = emiId;
      if (targetDate) payload.target_date = targetDate;
    } else if (goalType === 'savings') {
      if (num(targetAmount) <= 0 || !targetDate) {
        Alert.alert('Missing fields', 'Target amount and target date are required.');
        return;
      }
      payload.target_amount = num(targetAmount);
      payload.target_date = targetDate;
      payload.start_amount = num(startAmount);
    } else if (goalType === 'net_worth') {
      if (num(targetAmount) <= 0 || !targetDate) {
        Alert.alert('Missing fields', 'Target amount and target date are required.');
        return;
      }
      payload.target_amount = num(targetAmount);
      payload.target_date = targetDate;
      payload.assumed_annual_return_percent = num(assumedReturn) || 10;
      payload.assumed_monthly_contribution = num(assumedContribution) || 0;
    } else if (goalType === 'spend_cap') {
      if (num(targetAmount) <= 0) {
        Alert.alert('Missing field', 'Enter the monthly cap amount.');
        return;
      }
      payload.target_amount = num(targetAmount);
      payload.excluded_category_ids = excludedCategoryIds;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await ApiService.updateGoal(goalId!, payload);
      } else {
        await ApiService.createGoal(payload);
      }
      await refreshAll();
      Alert.alert('Saved', isEdit ? 'Goal updated.' : 'Goal created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Could not save goal.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isContributionMode) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          {field('Amount (₹)', contribAmount, setContribAmount, 'numeric', 'e.g. 20000')}
          {field('Date (YYYY-MM-DD)', contribDate, setContribDate, 'default', '2026-08-15')}
          {field('Note (optional)', contribNote, setContribNote)}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSaveContribution}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.background} />
                <Text style={[styles.saveBtnText, { color: colors.background }]}>Log Contribution</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {!isEdit && (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Goal Type</Text>
          {chips(GOAL_TYPES, goalType, setGoalType, GOAL_TYPE_LABEL)}
        </>
      )}

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        {field('Goal Name', name, setName, 'default', 'e.g. Close Home Loan')}

        {goalType === 'debt_payoff' && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Which Loan?</Text>
            <View style={styles.chipRow}>
              {emis.map((emi) => {
                const isSel = emiId === emi.id;
                return (
                  <TouchableOpacity
                    key={emi.id}
                    style={[styles.chip, { borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : colors.background }]}
                    onPress={() => setEmiId(emi.id)}
                  >
                    <Text style={[styles.chipText, { color: isSel ? colors.background : colors.text }]}>{emi.loan_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {field('Target Payoff Date (YYYY-MM-DD)', targetDate, setTargetDate, 'default', '2031-07-31')}
          </>
        )}

        {goalType === 'savings' && (
          <>
            {field('Target Amount (₹)', targetAmount, setTargetAmount, 'numeric', 'e.g. 350000')}
            {field('Target Date (YYYY-MM-DD)', targetDate, setTargetDate, 'default', '2027-07-31')}
            {field('Starting Amount (₹, optional)', startAmount, setStartAmount, 'numeric')}
          </>
        )}

        {goalType === 'net_worth' && (
          <>
            {field('Target Amount (₹)', targetAmount, setTargetAmount, 'numeric', 'e.g. 10000000')}
            {field('Target Date (YYYY-MM-DD)', targetDate, setTargetDate, 'default', '2038-06-01')}
            {field('Assumed Annual Return (%)', assumedReturn, setAssumedReturn, 'numeric', '10')}
            {field('Assumed Monthly Contribution (₹, optional)', assumedContribution, setAssumedContribution, 'numeric')}
          </>
        )}

        {goalType === 'spend_cap' && (
          <>
            {field('Monthly Cap (₹)', targetAmount, setTargetAmount, 'numeric', 'e.g. 50000')}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Tracks all discretionary expense categories by default (everything except Rent/EMI).
            </Text>

            <Text style={[styles.label, { color: colors.text, marginTop: 8 }]}>Exclude Categories (optional)</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Tap a category to leave it out of this cap entirely — its spend won't count here, but still shows up everywhere else.
            </Text>
            <View style={styles.chipRow}>
              {categories
                .filter((c) => c.type === 'expense' && c.name !== 'Rent/EMI')
                .map((c) => {
                  const isExcluded = excludedCategoryIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chip,
                        { borderColor: isExcluded ? colors.error : colors.border, backgroundColor: isExcluded ? colors.error : colors.background },
                      ]}
                      onPress={() => toggleExcludedCategory(c.id)}
                    >
                      <Text style={[styles.chipText, { color: isExcluded ? colors.background : colors.text }]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSaveGoal}
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
  hint: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontWeight: '700' },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
});

export default AddGoalScreen;
