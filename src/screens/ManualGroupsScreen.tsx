import React, { useCallback, useEffect, useState } from 'react';
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
import ApiService from '../services/api';
import { ManualTransactionGroup } from '../types/transactions';

const ManualGroupsScreen = () => {
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [groups, setGroups] = useState<ManualTransactionGroup[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const list = await ApiService.getManualTransactionGroups();
      setGroups(list || []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load manual groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const createGroup = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Group name is required.');
      return;
    }

    try {
      setSaving(true);
      await ApiService.createManualTransactionGroup({
        name: trimmedName,
        description: description.trim() || undefined,
      });

      setName('');
      setDescription('');
      await loadGroups();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create manual group');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = (group: ManualTransactionGroup) => {
    Alert.alert(
      'Delete Manual Group',
      `Delete "${group.name}"? This removes all links from transactions as well.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(group.id);
              await ApiService.deleteManualTransactionGroup(group.id);
              await loadGroups();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete manual group');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Create Manual Group</Text>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Use manual groups for trips, events, and custom collections across any transactions.</Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Group name"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          maxLength={80}
        />

        <TextInput
          style={[
            styles.input,
            styles.inputMultiline,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Description (optional)"
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary, opacity: saving ? 0.8 : 1 }]}
          onPress={createGroup}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={isDark ? '#000' : '#fff'} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color={isDark ? '#000' : '#fff'} />
              <Text style={[styles.createButtonText, { color: isDark ? '#000' : '#fff' }]}>Create Group</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Existing Manual Groups</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : groups.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No manual groups yet. Create your first one above.</Text>
        ) : (
          groups.map((group, index) => (
            <View
              key={group.id}
              style={[
                styles.groupRow,
                { borderBottomColor: colors.border },
                index === groups.length - 1 && styles.groupRowLast,
              ]}
            >
              <View style={styles.groupDetails}>
                <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                {!!group.description && (
                  <Text style={[styles.groupDescription, { color: colors.textSecondary }]}>{group.description}</Text>
                )}
                <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
                  {group.transaction_count || 0} linked transaction{(group.transaction_count || 0) === 1 ? '' : 's'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: colors.border }]}
                onPress={() => deleteGroup(group)}
                disabled={deletingId === group.id}
              >
                {deletingId === group.id ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
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
    paddingBottom: 16,
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
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 10,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    marginTop: 6,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 10,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  groupRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  groupDetails: {
    flex: 1,
    paddingRight: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 13,
    marginTop: 3,
  },
  groupCount: {
    fontSize: 12,
    marginTop: 5,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ManualGroupsScreen;
