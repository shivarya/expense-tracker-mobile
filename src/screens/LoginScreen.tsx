import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

let GoogleSignin: any;
let statusCodes: any;
try {
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes;
} catch (error) {
  console.warn('[LoginScreen] Google Sign-In module unavailable:', error);
}

// Get Google Client ID from app config (loaded from .env)
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';

const LoginScreen: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Configure Google Sign-In
    if (GoogleSignin?.configure) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!GoogleSignin) {
      Alert.alert(
        'Google Sign-In Unavailable',
        'Google Sign-In is not available in this build. Please install the latest app build.'
      );
      return;
    }

    if (GOOGLE_WEB_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      Alert.alert(
        'Configuration Required',
        'Please add your Google Client ID in LoginScreen.tsx'
      );
      return;
    }

    try {
      setLoading(true);

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get user info and ID token
      await GoogleSignin.signIn();

      // Get ID token for backend authentication
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;

      // Send to backend
      await loginWithGoogle(idToken);

      Alert.alert('Success', 'Login successful!');
    } catch (error: any) {
      let errorMessage = 'Failed to login. Please try again.';

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = 'Sign in cancelled';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = 'Sign in already in progress';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services not available';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Login Error', errorMessage);
      console.error('[LoginScreen] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>💰</Text>
          <Text style={styles.title}>Expense Tracker</Text>
          <Text style={styles.subtitle}>Track your finances</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem icon="📊" text="View expense analytics" />
          <FeatureItem icon="💳" text="Track investments" />
          <FeatureItem icon="📈" text="Monitor portfolio" />
          <FeatureItem icon="🎯" text="Manage transactions" />
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  privacy: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default LoginScreen;
