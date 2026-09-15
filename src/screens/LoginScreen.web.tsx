import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { GoogleSignin, renderGoogleButton } from '../services/googleAuthBridge';

// Web variant: Google Identity Services renders its own button into a DOM
// container and calls back with an ID token, rather than native's imperative
// signIn()/getTokens() two-step — see googleAuthBridge.web.ts.
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';

const LoginScreen: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonHostRef = useRef<View>(null);

  useEffect(() => {
    const container = buttonHostRef.current as unknown as HTMLElement | null;
    if (!container) return;

    if (!GOOGLE_WEB_CLIENT_ID) {
      setError('Google Sign-In is not configured for this build.');
      return;
    }

    let cancelled = false;
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    renderGoogleButton(container, async (idToken) => {
      if (cancelled) return;
      try {
        setError(null);
        setLoading(true);
        await loginWithGoogle(idToken);
      } catch (err: any) {
        setError(err?.message || 'Failed to login. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) setError(err?.message || 'Google Sign-In is unavailable.');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>💰</Text>
          <Text style={styles.title}>Expense Tracker</Text>
          <Text style={styles.subtitle}>Track your finances</Text>
        </View>

        <View style={styles.featuresContainer}>
          <FeatureItem icon="📊" text="View expense analytics" />
          <FeatureItem icon="💳" text="Track investments" />
          <FeatureItem icon="📈" text="Monitor portfolio" />
          <FeatureItem icon="🎯" text="Manage transactions" />
        </View>

        <View style={styles.googleButtonHost} ref={buttonHostRef} />
        {loading && <ActivityIndicator style={styles.loadingIndicator} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.privacy}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
};

interface FeatureItemProps {
  icon: string;
  text: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  featuresContainer: {
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
  },
  googleButtonHost: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44,
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  error: {
    fontSize: 13,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
  },
  privacy: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default LoginScreen;
