import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionsGate } from '../hooks/usePermissionsGate';

const PermissionRow: React.FC<{ icon: string; label: string; granted: boolean }> = ({ icon, label, granted }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={20} color={colors.textSecondary} style={styles.rowIcon} />
      <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
      <Ionicons
        name={granted ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={granted ? colors.success : colors.textSecondary}
      />
    </View>
  );
};

const PermissionsGateScreen: React.FC = () => {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { smsGranted, notificationsGranted, permanentlyDenied, requestAll, openSettings } = usePermissionsGate();
  const [requesting, setRequesting] = useState(false);

  const handleGrant = async () => {
    setRequesting(true);
    try {
      await requestAll();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: colors.card }]}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Permissions needed</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Expense Tracker needs these to automatically detect bank transactions and alert you the moment one comes in.
        </Text>

        <View style={[styles.list, { backgroundColor: colors.card }]}>
          <PermissionRow icon="chatbubble-ellipses-outline" label="Read & receive SMS" granted={smsGranted} />
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <PermissionRow icon="notifications-outline" label="Notifications" granted={notificationsGranted} />
        </View>

        {permanentlyDenied ? (
          <>
            <Text style={[styles.deniedNote, { color: colors.warning }]}>
              One or more permissions were denied. Open Settings to enable them, then come back.
            </Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={openSettings}>
              <Text style={[styles.buttonText, { color: colors.background }]}>Open Settings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleGrant}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.background }]}>Grant Permissions</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  list: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 4,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  deniedNote: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PermissionsGateScreen;
