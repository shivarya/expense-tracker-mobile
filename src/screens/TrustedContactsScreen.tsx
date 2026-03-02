import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import ApiService from '../services/api';
import { TrustedContact } from '../types/transactions';

interface ContactForm {
  id?: number;
  name: string;
  upi_id: string;
  notes: string;
}

const emptyForm = (): ContactForm => ({ name: '', upi_id: '', notes: '' });

const TrustedContactsScreen = () => {
  const { colors } = useTheme();

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ContactForm>(emptyForm());

  const loadContacts = useCallback(async () => {
    try {
      const data = await ApiService.getTrustedContacts();
      setContacts(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  }, [loadContacts]);

  const openAdd = () => {
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (contact: TrustedContact) => {
    setForm({
      id: contact.id,
      name: contact.name,
      upi_id: contact.upi_id ?? '',
      notes: contact.notes ?? '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        upi_id: form.upi_id.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (form.id) {
        const updated = await ApiService.updateTrustedContact(form.id, payload);
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await ApiService.createTrustedContact(payload);
        setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: TrustedContact) => {
    Alert.alert(
      'Delete Contact',
      `Remove "${contact.name}" from trusted contacts? Future SMS transfers to/from this contact may not be auto-categorized as Transfer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteTrustedContact(contact.id);
              setContacts((prev) => prev.filter((c) => c.id !== contact.id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TrustedContact }) => (
    <View style={[styles.item, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={[styles.itemIcon, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name="person-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
        {item.upi_id ? (
          <Text style={[styles.itemSub, { color: colors.textSecondary }]}>{item.upi_id}</Text>
        ) : null}
        {item.notes ? (
          <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>{item.notes}</Text>
        ) : null}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
          <Ionicons name="pencil-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color="#ef5350" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Info banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.bannerText, { color: colors.text }]}>
          Transactions to/from these contacts are automatically categorized as{' '}
          <Text style={{ fontWeight: '600' }}>Transfer</Text> during SMS sync.
        </Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No trusted contacts yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add your own UPI IDs, names, or account holders so self-transfers are recognised automatically.
            </Text>
          </View>
        }
        contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : undefined}
      />

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {form.id ? 'Edit Contact' : 'Add Trusted Contact'}
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="e.g. Ashish Tripathi"
              placeholderTextColor={colors.textSecondary}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>UPI ID (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="e.g. 7607433733@axl"
              placeholderTextColor={colors.textSecondary}
              value={form.upi_id}
              onChangeText={(v) => setForm((f) => ({ ...f, upi_id: v }))}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              placeholder="e.g. My HDFC savings account"
              placeholderTextColor={colors.textSecondary}
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
                )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 13, marginTop: 2 },
  itemNotes: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  itemActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyContainer: { flexGrow: 1 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600' },
});

export default TrustedContactsScreen;
