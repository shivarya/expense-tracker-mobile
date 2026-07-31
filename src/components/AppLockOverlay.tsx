import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useAppLock } from '../contexts/AppLockContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Full-screen overlay rendered above the navigator while the app is locked or
 * briefly covered (recents snapshot / grace window). When `locked`, it auto-
 * triggers the biometric prompt once; on failure it stays up with a retry
 * button and a "Log out" escape hatch so the user can never be locked out.
 */
const AppLockOverlay: React.FC = () => {
  const { colors } = useTheme();
  const { locked, isAuthenticating, unlock, biometricLabel } = useAppLock();
  const { logout } = useAuth();

  // Auto-prompt once per lock event; don't loop after a failed/cancelled prompt.
  const autoPromptedRef = useRef(false);

  useEffect(() => {
    if (locked && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      void unlock();
    }
    if (!locked) {
      autoPromptedRef.current = false;
    }
  }, [locked, unlock]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: colors.text }]}>Expense Tracker</Text>

        <View style={[styles.lockBadge, { backgroundColor: colors.card }]}>
          <Ionicons name="lock-closed" size={28} color={colors.primary} />
        </View>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {locked ? 'Locked for your privacy' : ''}
        </Text>

        {/* Only show interactive controls when actually locked (not a brief cover). */}
        {locked && (
          <>
            <TouchableOpacity
              style={[styles.unlockButton, { backgroundColor: colors.primary }]}
              onPress={() => unlock()}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="finger-print" size={22} color={colors.background} />
                  <Text style={[styles.unlockButtonText, { color: colors.background }]}>
                    Unlock with {biometricLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
              <Text style={[styles.logoutText, { color: colors.textSecondary }]}>Log out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 28,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 36,
    minHeight: 18,
    textAlign: 'center',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
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

export default AppLockOverlay;
