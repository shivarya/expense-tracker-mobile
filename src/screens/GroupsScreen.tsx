import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import ApiService from '../services/api';
import { TransactionGroup, TransactionGroupRule } from '../types/transactions';

const parseKeywords = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const presetHighlights = [
  { id: 'credit-card', title: 'Credit Cards', icon: 'card-outline' as const, subtitle: 'All card spends and bills' },
  { id: 'home', title: 'Home', icon: 'home-outline' as const, subtitle: 'Rent, utilities, groceries' },
  { id: 'travel', title: 'Travel', icon: 'airplane-outline' as const, subtitle: 'Trips, cabs, fuel' },
];

const GroupsScreen = () => {
  const { colors, isDark } = useTheme();
  const { categories, accounts, refreshAccounts, refreshCategories } = useData();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);

  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [merchantKeywords, setMerchantKeywords] = useState('');
  const [paymentMethodKeywords, setPaymentMethodKeywords] = useState('');

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [includeCreditCardSmart, setIncludeCreditCardSmart] = useState(false);
  const [includeDebit, setIncludeDebit] = useState(true);
  const [includeCredit, setIncludeCredit] = useState(true);

  const activeExpenseCategories = useMemo(
    () => categories.filter((item) => item.type === 'expense' || item.type === 'income' || item.type === 'transfer'),
    [categories]
  );

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      let [groupData] = await Promise.all([
        ApiService.getTransactionGroups(),
        refreshAccounts(),
        refreshCategories(),
      ]);

      if (groupData.length === 0) {
        try {
          await ApiService.createGroupPresets();
          groupData = await ApiService.getTransactionGroups();
        } catch {
          // Keep manual creation available if preset generation fails.
        }
      }

      setGroups(groupData);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [refreshAccounts, refreshCategories]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const resetForm = useCallback(() => {
    setEditingGroupId(null);
    setName('');
    setDescription('');
    setMerchantKeywords('');
    setPaymentMethodKeywords('');
    setSelectedCategoryIds([]);
    setSelectedAccountIds([]);
    setIncludeCreditCardSmart(false);
    setIncludeDebit(true);
    setIncludeCredit(true);
  }, []);

  const hydrateForm = useCallback((group: TransactionGroup) => {
    setEditingGroupId(group.id);
    setName(group.name || '');
    setDescription(group.description || '');

    const categoryIds = group.rules
      .filter((rule) => rule.rule_type === 'category_id')
      .map((rule) => Number(rule.rule_value))
      .filter((val) => Number.isFinite(val));

    const accountIds = group.rules
      .filter((rule) => rule.rule_type === 'account_id')
      .map((rule) => Number(rule.rule_value))
      .filter((val) => Number.isFinite(val));

    setSelectedCategoryIds(categoryIds);
    setSelectedAccountIds(accountIds);

    setIncludeCreditCardSmart(
      group.rules.some((rule) => rule.rule_type === 'account_type' && rule.rule_value === 'credit_card')
    );

    const txnTypeRules = group.rules
      .filter((rule) => rule.rule_type === 'transaction_type')
      .map((rule) => rule.rule_value);

    if (txnTypeRules.length === 0) {
      setIncludeDebit(true);
      setIncludeCredit(true);
    } else {
      setIncludeDebit(txnTypeRules.includes('debit'));
      setIncludeCredit(txnTypeRules.includes('credit'));
    }

    const merchant = group.rules
      .filter((rule) => rule.rule_type === 'merchant_keyword')
      .map((rule) => rule.rule_value)
      .join(', ');

    const payment = group.rules
      .filter((rule) => rule.rule_type === 'payment_method_keyword')
      .map((rule) => rule.rule_value)
      .join(', ');

    setMerchantKeywords(merchant);
    setPaymentMethodKeywords(payment);
  }, []);

  const toggleNumberSelection = (value: number, values: number[], setter: (v: number[]) => void) => {
    if (values.includes(value)) {
      setter(values.filter((item) => item !== value));
      return;
    }
    setter([...values, value]);
  };

  const buildRules = (): TransactionGroupRule[] => {
    const rules: TransactionGroupRule[] = [];

    selectedCategoryIds.forEach((categoryId) => {
      rules.push({ rule_type: 'category_id', rule_value: String(categoryId) });
    });

    selectedAccountIds.forEach((accountId) => {
      rules.push({ rule_type: 'account_id', rule_value: String(accountId) });
    });

    if (includeCreditCardSmart) {
      rules.push({ rule_type: 'account_type', rule_value: 'credit_card' });
      rules.push({ rule_type: 'payment_method_keyword', rule_value: 'card' });
    }

    if (includeDebit && !includeCredit) {
      rules.push({ rule_type: 'transaction_type', rule_value: 'debit' });
    }
    if (!includeDebit && includeCredit) {
      rules.push({ rule_type: 'transaction_type', rule_value: 'credit' });
    }

    parseKeywords(merchantKeywords).forEach((keyword) => {
      rules.push({ rule_type: 'merchant_keyword', rule_value: keyword.toLowerCase() });
    });

    parseKeywords(paymentMethodKeywords).forEach((keyword) => {
      rules.push({ rule_type: 'payment_method_keyword', rule_value: keyword.toLowerCase() });
    });

    const deduped = uniq(rules.map((rule) => `${rule.rule_type}|${rule.rule_value}`)).map((key) => {
      const [rule_type, rule_value] = key.split('|');
      return { rule_type: rule_type as TransactionGroupRule['rule_type'], rule_value };
    });

    return deduped;
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Group name is required.');
      return;
    }

    if (!includeDebit && !includeCredit) {
      Alert.alert('Validation', 'Choose at least one transaction type.');
      return;
    }

    const rules = buildRules();
    if (rules.length === 0) {
      Alert.alert('Validation', 'Choose at least one rule (category, account, smart card, or keywords).');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: includeCreditCardSmart ? 'card-outline' : 'layers-outline',
        color: includeCreditCardSmart ? '#EF5350' : '#5B5FEF',
        rules,
      };

      if (editingGroupId) {
        await ApiService.updateTransactionGroup(editingGroupId, payload);
      } else {
        await ApiService.createTransactionGroup(payload);
      }

      await loadGroups();
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (group: TransactionGroup) => {
    Alert.alert(
      'Delete Group',
      `Delete ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteTransactionGroup(group.id);
              if (editingGroupId === group.id) {
                resetForm();
              }
              await loadGroups();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const createPresets = async () => {
    try {
      setSaving(true);
      const result = await ApiService.createGroupPresets();
      await loadGroups();
      Alert.alert('Presets', `Created ${result.created}, skipped ${result.skipped}.`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create presets');
    } finally {
      setSaving(false);
    }
  };

  const getRuleLabel = (rule: TransactionGroupRule) => {
    if (rule.rule_type === 'account_type') {
      return rule.rule_value === 'credit_card' ? 'Credit card activity' : `Account type: ${rule.rule_value}`;
    }
    if (rule.rule_type === 'category_id') {
      const category = categories.find((item) => item.id === Number(rule.rule_value));
      return category ? `Category: ${category.name}` : 'Category rule';
    }
    if (rule.rule_type === 'account_id') {
      const account = accounts.find((item) => item.id === Number(rule.rule_value));
      return account ? `Account: ${account.account_name || account.bank}` : 'Account rule';
    }
    if (rule.rule_type === 'merchant_keyword') {
      return `Merchant: ${rule.rule_value}`;
    }
    if (rule.rule_type === 'payment_method_keyword') {
      return `Payment: ${rule.rule_value}`;
    }
    if (rule.rule_type === 'transaction_type') {
      return `Type: ${rule.rule_value}`;
    }
    return 'Rule';
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.formHeaderRow}>
          <Text style={[styles.title, { color: colors.text }]}>Preset Groups</Text>
          <TouchableOpacity onPress={createPresets} disabled={saving}>
            <Text style={[styles.resetText, { color: colors.primary }]}>{saving ? 'Working...' : 'Apply'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.presetSub, { color: colors.textSecondary }]}>Start with ready-made filters and fine-tune later.</Text>

        <View style={styles.presetGrid}>
          {presetHighlights.map((preset) => (
            <View key={preset.id} style={[styles.presetCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name={preset.icon} size={18} color={colors.primary} />
              <Text style={[styles.presetTitle, { color: colors.text }]}>{preset.title}</Text>
              <Text style={[styles.presetHint, { color: colors.textSecondary }]}>{preset.subtitle}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.formHeaderRow}>
          <Text style={[styles.title, { color: colors.text }]}>{editingGroupId ? 'Edit Group' : 'Create Group'}</Text>
          {editingGroupId ? (
            <TouchableOpacity onPress={resetForm}>
              <Text style={[styles.resetText, { color: colors.primary }]}>New</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Group name (e.g., Home Expenses)"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
        />

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
        />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Categories</Text>
        <View style={styles.wrapRow}>
          {activeExpenseCategories.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggleNumberSelection(item.id, selectedCategoryIds, setSelectedCategoryIds)}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.background },
                selectedCategoryIds.includes(item.id) && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
              ]}
            >
              <Text style={[styles.chipText, { color: selectedCategoryIds.includes(item.id) ? colors.primary : colors.textSecondary }]}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Accounts</Text>
        <View style={styles.wrapRow}>
          {accounts.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggleNumberSelection(item.id, selectedAccountIds, setSelectedAccountIds)}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.background },
                selectedAccountIds.includes(item.id) && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
              ]}
            >
              <Text style={[styles.chipText, { color: selectedAccountIds.includes(item.id) ? colors.primary : colors.textSecondary }]}>
                {item.account_name || `${item.bank} ${item.account_type}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.switchRow, { borderColor: colors.border }]}
          onPress={() => setIncludeCreditCardSmart((prev) => !prev)}
        >
          <View style={styles.switchLabelWrap}>
            <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.switchLabel, { color: colors.text }]}>Smart Credit Card Rule</Text>
          </View>
          <Ionicons name={includeCreditCardSmart ? 'checkbox' : 'square-outline'} size={22} color={includeCreditCardSmart ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Transaction Types</Text>
        <View style={styles.inlineRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, { borderColor: colors.border }, includeDebit && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]}
            onPress={() => setIncludeDebit((prev) => !prev)}
          >
            <Text style={[styles.toggleText, { color: includeDebit ? colors.primary : colors.textSecondary }]}>Debit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, { borderColor: colors.border }, includeCredit && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]}
            onPress={() => setIncludeCredit((prev) => !prev)}
          >
            <Text style={[styles.toggleText, { color: includeCredit ? colors.primary : colors.textSecondary }]}>Credit</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={merchantKeywords}
          onChangeText={setMerchantKeywords}
          placeholder="Merchant keywords, comma separated"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
        />

        <TextInput
          value={paymentMethodKeywords}
          onChangeText={setPaymentMethodKeywords}
          placeholder="Payment method keywords, comma separated"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: saving ? colors.border : colors.primary }]}
          disabled={saving}
          onPress={onSave}
        >
          <Text style={[styles.primaryBtnText, { color: isDark ? '#000' : '#fff' }]}>{editingGroupId ? 'Update Group' : 'Create Group'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          disabled={saving}
          onPress={createPresets}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Re-apply Presets</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>Your Groups</Text>
        {groups.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No groups yet. Create one above.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.id} style={[styles.groupRow, { borderBottomColor: colors.border }]}> 
              <View style={styles.groupMetaWrap}>
                <View style={[styles.groupColorBar, { backgroundColor: group.color || colors.primary }]} />
                <View style={styles.groupMeta}>
                  <View style={styles.groupTitleRow}>
                    <Ionicons name={(group.icon as any) || 'layers-outline'} size={14} color={group.color || colors.primary} />
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                    {group.is_preset ? <Text style={[styles.presetBadge, { color: colors.primary }]}>PRESET</Text> : null}
                  </View>
                  <Text style={[styles.groupSub, { color: colors.textSecondary }]}>
                    {group.rule_count ?? group.rules.length} rules
                  </Text>
                  <Text style={[styles.groupRulePreview, { color: colors.textSecondary }]} numberOfLines={1}>
                    {(group.rules || []).slice(0, 2).map(getRuleLabel).join(' • ') || 'No rules'}
                  </Text>
                </View>
              </View>
              <View style={styles.inlineRow}>
                <TouchableOpacity onPress={() => hydrateForm(group)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(group)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  resetText: { fontSize: 14, fontWeight: '700' },
  presetSub: { fontSize: 12, marginTop: -4, marginBottom: 8 },
  presetGrid: { flexDirection: 'row', gap: 8 },
  presetCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  presetTitle: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  presetHint: { fontSize: 10, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  switchRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  toggleText: { fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, paddingVertical: 8 },
  groupRow: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupMetaWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  groupColorBar: {
    width: 4,
    borderRadius: 3,
    marginRight: 8,
  },
  groupMeta: { flex: 1, paddingRight: 12 },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: { fontSize: 15, fontWeight: '700' },
  presetBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  groupSub: { fontSize: 12, marginTop: 2 },
  groupRulePreview: { fontSize: 11, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GroupsScreen;
