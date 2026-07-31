import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, ActivityIndicator, KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import ApiService from '../services/api';
import { Goal, MonthlyPlan } from '../types/goals';
import { formatCompactCurrency, formatCurrency, formatDateLong } from '../utils/format';

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

const num = (v: string): number => {
  const n = parseFloat((v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const GOAL_TYPE_LABEL: Record<Goal['goal_type'], string> = {
  debt_payoff: 'Debt Payoff',
  savings: 'Savings Target',
  net_worth: 'Net Worth Target',
  spend_cap: 'Monthly Spend Cap',
};

const GoalsScreen = () => {
  const { colors, isDark } = useTheme();
  const { goals, refreshGoals } = useData();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [editingSettings, setEditingSettings] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      setLoadingPlan(true);
      const data = await ApiService.getMonthlyPlan();
      setPlan(data);
    } catch (error: any) {
      console.error('Monthly plan error:', error);
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshGoals();
      loadPlan();
    }, [refreshGoals, loadPlan])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshGoals(), loadPlan()]);
    setRefreshing(false);
  };

  const openSettingsEditor = () => {
    setIncomeInput(plan?.monthly_income != null ? String(plan.monthly_income) : '');
    setOtherInput(plan?.monthly_other_commitments != null ? String(plan.monthly_other_commitments) : '');
    setEditingSettings(true);
  };

  const saveSettings = async () => {
    if (num(incomeInput) <= 0) {
      Alert.alert('Missing income', 'Enter your monthly take-home income.');
      return;
    }
    try {
      setSavingSettings(true);
      const updated = await ApiService.updateMonthlyPlanSettings({
        monthly_income: num(incomeInput),
        monthly_other_commitments: num(otherInput),
      });
      setPlan(updated);
      setEditingSettings(false);
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Could not save.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const deleteGoal = (goal: Goal) => {
    Alert.alert('Delete Goal', `Delete "${goal.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(goal.id);
            await ApiService.deleteGoal(goal.id);
            await Promise.all([refreshGoals(), loadPlan()]);
          } catch (error: any) {
            Alert.alert('Error', getApiErrorMessage(error, 'Failed to delete goal'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const progressBar = (percent: number, fillColor: string) => (
    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(100, Math.max(0, percent * 100))}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );

  const statusRow = (percent: number, onTrack: boolean, trackLabel = 'On Track', offTrackLabel = 'Needs Action') => (
    <View style={styles.statusRow}>
      <Text style={[styles.percentText, { color: colors.text }]}>{Math.round(Math.min(999, percent * 100))}%</Text>
      <View style={[styles.badge, { backgroundColor: (onTrack ? colors.success : colors.warning) + '22' }]}>
        <Text style={[styles.badgeText, { color: onTrack ? colors.success : colors.warning }]}>
          {onTrack ? trackLabel : offTrackLabel}
        </Text>
      </View>
    </View>
  );

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    keyboardType: KeyboardTypeOptions = 'numeric',
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

  const renderMonthlyPlan = () => {
    if (loadingPlan && !plan) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!plan) return null;

    if (!plan.is_configured || editingSettings) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <Text style={[styles.planTitle, { color: colors.text }]}>Set Up Your Monthly Plan</Text>
          <Text style={[styles.planHint, { color: colors.textSecondary }]}>
            Tell us your income and fixed commitments so we can tell you exactly how much to save and invest each month.
          </Text>
          {field('Monthly Take-Home Income (₹)', incomeInput, setIncomeInput, 'numeric', 'e.g. 237142')}
          {field('Other Fixed Monthly Commitments (₹)', otherInput, setOtherInput, 'numeric', 'e.g. 30500 (SIPs, house help, etc)')}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editingSettings && (
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setEditingSettings(false)}
              >
                <Text style={[styles.saveBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, backgroundColor: colors.primary, opacity: savingSettings ? 0.7 : 1 }]}
              onPress={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              ) : (
                <Text style={[styles.saveBtnText, { color: isDark ? '#000' : '#fff' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const surplus = plan.available_surplus ?? 0;
    const isShort = surplus < 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.planTitle, { color: colors.text }]}>This Month's Plan</Text>
          <TouchableOpacity onPress={openSettingsEditor} hitSlop={8}>
            <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.planLineRow}>
          <Text style={[styles.planLineLabel, { color: colors.textSecondary }]}>Income</Text>
          <Text style={[styles.planLineValue, { color: colors.text }]}>{formatCurrency(plan.monthly_income || 0, 0)}</Text>
        </View>
        <View style={styles.planLineRow}>
          <Text style={[styles.planLineLabel, { color: colors.textSecondary }]}>Housing Loan EMIs</Text>
          <Text style={[styles.planLineValue, { color: colors.text }]}>−{formatCurrency(plan.housing_loan_emi_total, 0)}</Text>
        </View>
        {plan.short_term_emi_total > 0 && (
          <View style={styles.planLineRow}>
            <Text style={[styles.planLineLabel, { color: colors.textSecondary }]}>Card EMIs (temporary)</Text>
            <Text style={[styles.planLineValue, { color: colors.warning }]}>−{formatCurrency(plan.short_term_emi_total, 0)}</Text>
          </View>
        )}
        <View style={styles.planLineRow}>
          <Text style={[styles.planLineLabel, { color: colors.textSecondary }]}>Other Commitments</Text>
          <Text style={[styles.planLineValue, { color: colors.text }]}>−{formatCurrency(plan.monthly_other_commitments, 0)}</Text>
        </View>
        <View style={styles.planLineRow}>
          <Text style={[styles.planLineLabel, { color: colors.textSecondary }]}>Discretionary Cap</Text>
          <Text style={[styles.planLineValue, { color: colors.text }]}>−{formatCurrency(plan.spend_cap_target, 0)}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.planLineRow}>
          <Text style={[styles.planLineLabel, { color: colors.text, fontWeight: '700' }]}>
            {isShort ? 'Short This Month' : 'Available Surplus'}
          </Text>
          <Text style={[styles.planLineValue, { color: isShort ? colors.error : colors.success, fontWeight: '700' }]}>
            {formatCurrency(Math.abs(surplus), 0)}
          </Text>
        </View>

        {plan.short_term_emi_total > 0 && (
          <Text style={[styles.planHint, { color: colors.textSecondary }]}>
            Card EMIs (Amazon Pay / MakeMyTrip / etc) are temporary and roll off on their own — don't add new ones, and this deficit resolves itself.
          </Text>
        )}

        {!isShort && plan.allocations.length > 0 && (
          <>
            <Text style={[styles.planSubTitle, { color: colors.text }]}>Suggested Split</Text>
            {plan.allocations.map((a) => (
              <View key={`${a.goal_type}-${a.goal_id}`} style={styles.allocationRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.allocationName, { color: colors.text }]}>{a.name}</Text>
                  <Text style={[styles.allocationNote, { color: colors.textSecondary }]}>
                    needs {formatCurrency(a.monthly_need, 0)}/mo{a.lumpsum_target ? ` toward ${formatCurrency(a.lumpsum_target, 0)} lumpsum` : ''}
                  </Text>
                </View>
                <Text style={[styles.allocationAmount, { color: colors.primary }]}>{formatCurrency(a.suggested_amount, 0)}/mo</Text>
              </View>
            ))}
            {plan.leftover_to_buffer > 0 && (
              <View style={styles.allocationRow}>
                <Text style={[styles.allocationName, { color: colors.text }]}>Emergency Buffer</Text>
                <Text style={[styles.allocationAmount, { color: colors.success }]}>{formatCurrency(plan.leftover_to_buffer, 0)}/mo</Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderDebtPayoff = (goal: Goal) => {
    const p = goal.progress;
    if (p.linked_loan_missing) {
      return <Text style={[styles.warnText, { color: colors.error }]}>Linked loan not found.</Text>;
    }
    const onTrack = p.is_on_track !== false;
    return (
      <>
        {goal.target_date && statusRow(p.progress_percent, onTrack)}
        {progressBar(p.progress_percent, colors.success)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCurrency(p.amount_paid_off || 0, 0)} of {formatCurrency(p.principal_amount || 0, 0)} paid off
        </Text>
        {goal.target_date && (
          <View style={[styles.callout, { backgroundColor: onTrack ? colors.success + '1A' : colors.warning + '1A' }]}>
            <Text style={[styles.calloutText, { color: onTrack ? colors.success : colors.warning }]}>
              Projected payoff: {p.projected_payoff_date ? formatDateLong(p.projected_payoff_date) : '—'} (target: {formatDateLong(goal.target_date)})
            </Text>
            {!onTrack && !p.target_date_passed && (
              <Text style={[styles.calloutSubText, { color: colors.textSecondary }]}>
                To hit your target: raise EMI to {formatCurrency(p.required_emi || 0, 0)}/mo (current {formatCurrency(p.current_emi || 0, 0)}), OR prepay {formatCurrency(p.lumpsum_needed || 0, 0)} lumpsum now.
              </Text>
            )}
          </View>
        )}
      </>
    );
  };

  const renderSavings = (goal: Goal) => {
    const p = goal.progress;
    return (
      <>
        {statusRow(p.progress_percent, !!p.is_achieved, 'Achieved', 'In Progress')}
        {progressBar(p.progress_percent, colors.info)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCurrency(p.current_amount || 0, 0)} of {formatCurrency(p.target_amount || 0, 0)}
        </Text>
        {p.required_monthly_contribution != null && !p.is_achieved && (
          <Text style={[styles.calloutSubText, { color: colors.textSecondary }]}>
            Need {formatCurrency(p.required_monthly_contribution, 0)}/month to hit {goal.target_date ? formatDateLong(goal.target_date) : 'target'}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.logButton, { borderColor: colors.border }]}
          onPress={() => navigation.navigate('AddGoal', { goalId: goal.id, mode: 'contribution' })}
        >
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.logButtonText, { color: colors.primary }]}>Log Contribution</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderNetWorth = (goal: Goal) => {
    const p = goal.progress;
    const onTrack = p.is_on_track !== false;
    return (
      <>
        {statusRow(p.progress_percent, onTrack)}
        {progressBar(p.progress_percent, colors.success)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCompactCurrency(p.current_amount || 0)} of {formatCompactCurrency(p.target_amount || 0)}
          {p.is_scoped ? ' (scoped)' : ''}
        </Text>
        {goal.target_date && (
          <View style={[styles.callout, { backgroundColor: onTrack ? colors.success + '1A' : colors.warning + '1A' }]}>
            <Text style={[styles.calloutText, { color: onTrack ? colors.success : colors.warning }]}>
              Projected by {formatDateLong(goal.target_date)}: {formatCompactCurrency(p.projected_value_at_target_date || 0)}
            </Text>
            {!onTrack && !!p.required_monthly_contribution && (
              <Text style={[styles.calloutSubText, { color: colors.textSecondary }]}>
                To hit your target: invest {formatCurrency(p.required_monthly_contribution, 0)}/mo total
                {p.assumed_monthly_contribution ? ` (${formatCurrency(p.additional_monthly_contribution_needed || 0, 0)}/mo more than your current ${formatCurrency(p.assumed_monthly_contribution, 0)})` : ''}.
              </Text>
            )}
          </View>
        )}
      </>
    );
  };

  const renderSpendCap = (goal: Goal) => {
    const p = goal.progress;
    const overOrProjectedOver = p.is_over_cap || p.is_projected_to_exceed;
    return (
      <>
        {statusRow(p.progress_percent, !overOrProjectedOver, 'Within Cap', 'Over Cap')}
        {progressBar(p.progress_percent, overOrProjectedOver ? colors.error : colors.info)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCurrency(p.current_amount || 0, 0)} of {formatCurrency(p.target_amount || 0, 0)} this month
        </Text>
        <Text style={[styles.calloutSubText, { color: overOrProjectedOver ? colors.warning : colors.textSecondary }]}>
          {p.days_remaining} days left — projected: {formatCurrency(p.run_rate_projection || 0, 0)}
        </Text>
      </>
    );
  };

  const renderProgress = (goal: Goal) => {
    switch (goal.goal_type) {
      case 'debt_payoff':
        return renderDebtPayoff(goal);
      case 'savings':
        return renderSavings(goal);
      case 'net_worth':
        return renderNetWorth(goal);
      case 'spend_cap':
        return renderSpendCap(goal);
      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {renderMonthlyPlan()}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AddGoal')}
      >
        <Ionicons name="add-circle-outline" size={20} color={isDark ? '#000' : '#fff'} />
        <Text style={[styles.addButtonText, { color: isDark ? '#000' : '#fff' }]}>Add Goal</Text>
      </TouchableOpacity>

      {goals.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No goals yet. Tap + Add Goal to set one.</Text>
      ) : (
        goals.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('AddGoal', { goalId: goal.id })}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                <Text style={[styles.goalType, { color: colors.textSecondary }]}>{GOAL_TYPE_LABEL[goal.goal_type]}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteGoal(goal)} disabled={deletingId === goal.id} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {renderProgress(goal)}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  addButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addButtonText: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  goalName: { fontSize: 15, fontWeight: '700' },
  goalType: { fontSize: 11, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  percentText: { fontSize: 18, fontWeight: '800' },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4, marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressCaption: { fontSize: 13, fontWeight: '600' },
  warnText: { fontSize: 13, fontWeight: '600' },
  callout: { borderRadius: 8, padding: 10, marginTop: 8, gap: 4 },
  calloutText: { fontSize: 13, fontWeight: '700' },
  calloutSubText: { fontSize: 12, marginTop: 4 },
  logButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logButtonText: { fontSize: 13, fontWeight: '700' },
  planTitle: { fontSize: 16, fontWeight: '800' },
  planSubTitle: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  planHint: { fontSize: 12, lineHeight: 17 },
  planLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLineLabel: { fontSize: 13 },
  planLineValue: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 2 },
  allocationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  allocationName: { fontSize: 13, fontWeight: '600' },
  allocationNote: { fontSize: 11, marginTop: 1 },
  allocationAmount: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
});

export default GoalsScreen;
