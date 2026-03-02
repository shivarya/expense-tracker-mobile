import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import ApiService from '../services/api';
import { Category } from '../types/transactions';

const TYPE_OPTIONS: Category['type'][] = ['expense', 'income', 'investment', 'transfer'];
const COLOR_OPTIONS = ['#FF4757', '#2B7BE5', '#00C48C', '#FFA502', '#9C27B0', '#FF6F61', '#17C0EB', '#786FA6'];
const ICON_OPTIONS = [
  'wallet-outline',
  'restaurant-outline',
  'cart-outline',
  'car-outline',
  'medical-outline',
  'home-outline',
  'card-outline',
  'cash-outline',
  'briefcase-outline',
  'trending-up-outline',
  'swap-horizontal-outline',
  'gift-outline',
];

interface CategoryForm {
  id?: number;
  name: string;
  type: Category['type'];
  icon: string;
  color: string;
  monthly_budget: string;
  is_system?: boolean;
}

const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const MasterCategoriesScreen = () => {
  const { colors, isDark } = useTheme();
  const { categories, refreshCategories } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CategoryForm | null>(null);

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories.forEach((cat) => {
      const key = `${cat.type}|${normalize(cat.name)}`;
      const existing = map.get(key) || [];
      existing.push(cat);
      map.set(key, existing);
    });
    return Array.from(map.values()).filter((group) => group.length > 1);
  }, [categories]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCategories();
    } finally {
      setRefreshing(false);
    }
  }, [refreshCategories]);

  const openCreateModal = () => {
    setEditing({
      name: '',
      type: 'expense',
      icon: 'wallet-outline',
      color: '#2B7BE5',
      monthly_budget: '0',
      is_system: false,
    });
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditing({
      id: category.id,
      name: category.name,
      type: category.type,
      icon: category.icon || 'wallet-outline',
      color: category.color || '#2B7BE5',
      monthly_budget: String(category.monthly_budget || 0),
      is_system: category.is_system,
    });
    setModalVisible(true);
  };

  const saveCategory = async () => {
    if (!editing) return;

    const name = editing.name.trim();
    if (!name) {
      Alert.alert('Validation', 'Category name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        type: editing.type,
        icon: editing.icon,
        color: editing.color,
        monthly_budget: Number(editing.monthly_budget || 0),
      };

      if (editing.id) {
        await ApiService.updateCategory(editing.id, payload);
      } else {
        await ApiService.createCategory(payload);
      }

      setModalVisible(false);
      setEditing(null);
      await refreshCategories();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteCategory(category.id);
              await refreshCategories();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const consolidateDuplicates = async () => {
    try {
      setSaving(true);
      const result = await ApiService.consolidateCategories();
      await refreshCategories();
      Alert.alert(
        'Consolidation Complete',
        `Merged ${result.merged_categories} duplicate categories across ${result.duplicate_groups} groups.`
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to consolidate categories');
    } finally {
      setSaving(false);
    }
  };

  const autoFixRogues = async () => {
    try {
      setSaving(true);
      const result = await ApiService.autoFixCategories();
      await refreshCategories();
      if (result.deleted === 0) {
        Alert.alert('All Clean', 'No rogue categories found.');
      } else {
        Alert.alert(
          'Auto-Fix Complete',
          `Removed ${result.deleted} rogue categor${result.deleted === 1 ? 'y' : 'ies'}, reassigned ${result.fixed} transaction${result.fixed === 1 ? '' : 's'}.`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Auto-fix failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={openCreateModal}
            disabled={saving}
          >
            <Ionicons name="add" size={16} color={isDark ? '#000' : '#fff'} />
            <Text style={[styles.actionButtonText, { color: isDark ? '#000' : '#fff' }]}>Add Category</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonOutline, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={consolidateDuplicates}
            disabled={saving}
          >
            <Ionicons name="git-merge-outline" size={16} color={colors.text} />
            <Text style={[styles.actionButtonOutlineText, { color: colors.text }]}>Consolidate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonOutline, { borderColor: '#FF5722', backgroundColor: colors.card }]}
            onPress={autoFixRogues}
            disabled={saving}
          >
            <Ionicons name="build-outline" size={16} color="#FF5722" />
            <Text style={[styles.actionButtonOutlineText, { color: '#FF5722' }]}>Auto-Fix</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Duplicate Groups</Text>
          {duplicateGroups.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No duplicate category names found.</Text>
          ) : (
            duplicateGroups.map((group, index) => (
              <View key={`dup-${index}`} style={styles.dupGroup}>
                <Text style={[styles.dupTitle, { color: colors.text }]}>
                  {group[0].type.toUpperCase()} • {group[0].name}
                </Text>
                <Text style={[styles.dupItems, { color: colors.textSecondary }]}>IDs: {group.map((x) => x.id).join(', ')}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Master Category List</Text>
          {sortedCategories.map((category, idx) => (
            <View key={category.id}>
              <View style={styles.row}>
                <View style={[styles.iconBadge, { backgroundColor: (category.color || colors.primary) + '22' }]}> 
                  <Ionicons name={(category.icon as any) || 'wallet-outline'} size={16} color={category.color || colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]}>{category.name}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {category.type} {category.is_system ? '• system' : '• custom'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEditModal(category)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {!category.is_system && (
                  <TouchableOpacity onPress={() => deleteCategory(category)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
              {idx < sortedCategories.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editing?.id ? 'Edit Category' : 'Add Category'}</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              value={editing?.name || ''}
              onChangeText={(text) => setEditing((prev) => (prev ? { ...prev, name: text } : prev))}
              placeholder="Category name"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.optionRow}>
              {TYPE_OPTIONS.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.smallChip,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    editing?.type === type && { borderColor: colors.primary },
                  ]}
                  onPress={() => setEditing((prev) => (prev ? { ...prev, type } : prev))}
                >
                  <Text style={[styles.smallChipText, { color: editing?.type === type ? colors.primary : colors.textSecondary }]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Color</Text>
            <View style={styles.optionRow}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color, borderColor: editing?.color === color ? colors.text : 'transparent' },
                  ]}
                  onPress={() => setEditing((prev) => (prev ? { ...prev, color } : prev))}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Icon</Text>
            <View style={styles.optionRow}>
              {ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconChoice,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    editing?.icon === icon && { borderColor: colors.primary },
                  ]}
                  onPress={() => setEditing((prev) => (prev ? { ...prev, icon } : prev))}
                >
                  <Ionicons name={icon as any} size={16} color={editing?.icon === icon ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={saveCategory} disabled={saving}>
                <Text style={[styles.modalBtnText, { color: isDark ? '#000' : '#fff' }]}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonText: { fontSize: 13, fontWeight: '700' },
  actionButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonOutlineText: { fontSize: 13, fontWeight: '700' },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  emptyText: { fontSize: 13, paddingVertical: 8 },
  dupGroup: { paddingVertical: 8 },
  dupTitle: { fontSize: 13, fontWeight: '700' },
  dupItems: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  iconBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6 },
  divider: { height: 1, marginLeft: 44 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  smallChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallChipText: { fontSize: 12, fontWeight: '600' },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  iconChoice: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  modalBtnText: { fontSize: 13, fontWeight: '700' },
});

export default MasterCategoriesScreen;
