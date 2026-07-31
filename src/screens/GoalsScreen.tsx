import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import ApiService from '../services/api';
import { Goal } from '../types/goals';
import { formatCompactCurrency, formatCurrency, formatDateLong } from '../utils/format';

const getApiErrorMessage = (error: any, fallback: string): string =>
  (typeof error?.response?.data?.error === 'string' && error.response.data.error) || error?.message || fallback;

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

  useFocusEffect(
    useCallback(() => {
      refreshGoals();
    }, [refreshGoals])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshGoals();
    setRefreshing(false);
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
            await refreshGoals();
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

  const renderDebtPayoff = (goal: Goal) => {
    const p = goal.progress;
    if (p.linked_loan_missing) {
      return <Text style={[styles.warnText, { color: colors.error }]}>Linked loan not found.</Text>;
    }
    const onTrack = p.is_on_track !== false;
    return (
      <>
        {progressBar(p.progress_percent, colors.success)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCurrency(p.amount_paid_off || 0, 0)} of {formatCurrency(p.principal_amount || 0, 0)} paid off
        </Text>
        {goal.target_date && (
          <View style={[styles.callout, { backgroundColor: onTrack ? colors.success + '1A' : colors.warning + '1A' }]}>
            <Text style={[styles.calloutText, { color: onTrack ? colors.success : colors.warning }]}>
              Projected payoff: {p.projected_payoff_date ? formatDateLong(p.projected_payoff_date) : '—'}
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
        {progressBar(p.progress_percent, colors.success)}
        <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
          {formatCompactCurrency(p.current_amount || 0)} of {formatCompactCurrency(p.target_amount || 0)}
        </Text>
        {goal.target_date && (
          <Text style={[styles.calloutSubText, { color: onTrack ? colors.success : colors.warning }]}>
            Projected by {formatDateLong(goal.target_date)}: {formatCompactCurrency(p.projected_value_at_target_date || 0)}
          </Text>
        )}
      </>
    );
  };

  const renderSpendCap = (goal: Goal) => {
    const p = goal.progress;
    const overOrProjectedOver = p.is_over_cap || p.is_projected_to_exceed;
    return (
      <>
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
});

export default GoalsScreen;
