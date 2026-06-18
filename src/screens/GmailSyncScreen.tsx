import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { BillingStatus, GmailSyncJob, GmailSyncRange, StatementPasswordCandidate } from '../types/transactions';

const RANGES: { value: GmailSyncRange; label: string }[] = [
  { value: '1m', label: '1 Month' },
  { value: '2m', label: '2 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

const getApiErrorMessage = (error: any, fallback: string): string => {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
    return serverMessage;
  }
  return error?.message || fallback;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const GmailSyncScreen = () => {
  const { colors } = useTheme();
  const { refreshAll } = useData();
  const navigation = useNavigation<any>();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [authorizedAt, setAuthorizedAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GmailSyncJob[]>([]);
  const [candidates, setCandidates] = useState<StatementPasswordCandidate[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  const [selectedRange, setSelectedRange] = useState<GmailSyncRange>('6m');
  const [newPassword, setNewPassword] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddingPassword, setIsAddingPassword] = useState(false);

  const statusColor = (status: GmailSyncJob['status']): string => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'failed':
        return colors.error;
      case 'processing':
        return colors.info;
      default:
        return colors.textSecondary;
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const [status, jobList, candidateList, billingStatus] = await Promise.all([
        ApiService.getGmailStatus(),
        ApiService.getGmailJobs(),
        ApiService.getStatementPasswordCandidates(),
        ApiService.getBillingStatus().catch(() => null),
      ]);
      setGmailConnected(!!status.connected);
      setAuthorizedAt(status.authorized_at ?? null);
      setJobs(jobList);
      setCandidates(candidateList);
      if (billingStatus) setBilling(billingStatus);
    } catch (error: any) {
      // Non-fatal: surface once, keep the screen usable.
      console.warn('[GmailSync] load failed:', getApiErrorMessage(error, 'load failed'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const result = await ApiService.connectGmail();
      setGmailConnected(!!result.connected);
      await loadAll();
      Alert.alert('Gmail connected', result.email ? `Connected as ${result.email}.` : 'Gmail access granted.');
    } catch (error: any) {
      Alert.alert('Connect failed', getApiErrorMessage(error, 'Could not connect Gmail.'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Gmail', 'The server will stop fetching statements from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await ApiService.disconnectGmail();
            setGmailConnected(false);
            setAuthorizedAt(null);
            Alert.alert('Disconnected', 'Gmail access removed.');
          } catch (error: any) {
            Alert.alert('Failed', getApiErrorMessage(error, 'Could not disconnect Gmail.'));
          }
        },
      },
    ]);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const result = await ApiService.triggerGmailSync(selectedRange);
      await loadAll();
      Alert.alert(
        result.already_queued ? 'Already running' : 'Sync queued',
        result.already_queued
          ? 'A Gmail sync is already in progress. Pull to refresh to see progress.'
          : 'Your Gmail sync is queued and will run shortly. Pull to refresh to see progress.'
      );
    } catch (error: any) {
      Alert.alert('Sync failed', getApiErrorMessage(error, 'Could not queue Gmail sync.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddPassword = async () => {
    if (newPassword.trim().length === 0) {
      Alert.alert('Password required', 'Enter a password to add to the pool.');
      return;
    }
    try {
      setIsAddingPassword(true);
      await ApiService.addStatementPasswordCandidates([
        { password: newPassword.trim(), label: newLabel.trim() || undefined },
      ]);
      setNewPassword('');
      setNewLabel('');
      await loadAll();
    } catch (error: any) {
      Alert.alert('Add failed', getApiErrorMessage(error, 'Could not save password.'));
    } finally {
      setIsAddingPassword(false);
    }
  };

  const handleDeletePassword = (id: number) => {
    Alert.alert('Remove password', 'Remove this password from the pool?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await ApiService.deleteStatementPasswordCandidate({ id });
            setCandidates((prev) => prev.filter((c) => c.id !== id));
          } catch (error: any) {
            Alert.alert('Failed', getApiErrorMessage(error, 'Could not remove password.'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Gmail connection */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Gmail Auto-Sync</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Connect read-only Gmail so the server can automatically fetch your statement emails
          (mutual funds today; credit cards, CDSL & NPS coming soon).
        </Text>

        <View style={styles.statusRow}>
          <Ionicons
            name={gmailConnected ? 'checkmark-circle' : 'alert-circle-outline'}
            size={18}
            color={gmailConnected ? colors.success : colors.textSecondary}
          />
          <Text style={[styles.statusText, { color: gmailConnected ? colors.success : colors.textSecondary }]}>
            {gmailConnected ? `Connected${authorizedAt ? ` · ${formatDateTime(authorizedAt)}` : ''}` : 'Not connected'}
          </Text>
        </View>

        {gmailConnected ? (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleDisconnect}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Disconnect Gmail</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isConnecting ? 0.7 : 1 }]}
            disabled={isConnecting}
            onPress={handleConnect}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="mail-outline" size={18} color={colors.background} />
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Connect Gmail</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Manual sync */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Run a Sync</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Choose how far back to look, then queue a fetch. It runs in the background.
        </Text>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const isSelected = selectedRange === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.rangeChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => setSelectedRange(r.value)}
              >
                <Text style={[styles.rangeChipText, { color: isSelected ? colors.background : colors.text }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {billing?.enforced && !billing?.premium ? (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Ionicons name="sparkles-outline" size={18} color={colors.background} />
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Upgrade to Premium</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Gmail Auto-Sync is a premium feature.
            </Text>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSyncing || !gmailConnected ? 0.6 : 1 }]}
              onPress={handleSync}
              disabled={isSyncing || !gmailConnected}
            >
              {isSyncing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={18} color={colors.background} />
                  <Text style={[styles.primaryButtonText, { color: colors.background }]}>Sync Now</Text>
                </>
              )}
            </TouchableOpacity>
            {!gmailConnected && (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>Connect Gmail first to enable syncing.</Text>
            )}
          </>
        )}
      </View>

      {/* Password pool */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Statement Passwords</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Add the passwords your statement PDFs use (e.g. DOB, PAN). The server tries each when
          opening locked PDFs. Passwords are encrypted and never shown again.
        </Text>

        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Password to try"
          placeholderTextColor={colors.placeholder}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        <TextInput
          value={newLabel}
          onChangeText={setNewLabel}
          placeholder="Label (optional, e.g. DOB)"
          placeholderTextColor={colors.placeholder}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isAddingPassword ? 0.7 : 1 }]}
          disabled={isAddingPassword}
          onPress={handleAddPassword}
        >
          {isAddingPassword ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Ionicons name="add-outline" size={18} color={colors.background} />
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Add Password</Text>
            </>
          )}
        </TouchableOpacity>

        {candidates.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>No passwords saved yet.</Text>
        ) : (
          candidates.map((c) => (
            <View key={c.id} style={[styles.listRow, { borderColor: colors.border }]}>
              <Ionicons name="key-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.listRowText, { color: colors.text }]} numberOfLines={1}>
                {c.label || 'Saved password'}
              </Text>
              <TouchableOpacity onPress={() => handleDeletePassword(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Sync log */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sync Log</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Recent Gmail syncs. Pull down to refresh.
        </Text>

        {jobs.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>No syncs yet.</Text>
        ) : (
          jobs.map((job) => (
            <View key={job.id} style={[styles.jobCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={styles.jobHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(job.status) }]}>
                  <Text style={styles.statusBadgeText}>{job.status.toUpperCase()}</Text>
                </View>
                <Text style={[styles.jobDate, { color: colors.textSecondary }]}>{formatDateTime(job.created_at)}</Text>
              </View>

              <Text style={[styles.jobLine, { color: colors.textSecondary }]}>
                Range: {job.params?.range ?? '—'}
                {job.status === 'processing' ? ` · ${job.progress}%` : ''}
              </Text>
              <Text style={[styles.jobLine, { color: colors.textSecondary }]}>
                Saved {job.saved_items} · Processed {job.processed_items} · Skipped {job.skipped_items}
              </Text>
              {!!job.error_message && (
                <Text style={[styles.jobLine, { color: job.status === 'failed' ? colors.error : colors.textSecondary }]}>
                  {job.status === 'failed' ? 'Reason: ' : 'Notes: '}
                  {job.error_message}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  section: { borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionDescription: { fontSize: 13, lineHeight: 19 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  rangeChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listRowText: { flex: 1, fontSize: 14 },
  jobCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  jobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  jobDate: { fontSize: 12 },
  jobLine: { fontSize: 13 },
});

export default GmailSyncScreen;
