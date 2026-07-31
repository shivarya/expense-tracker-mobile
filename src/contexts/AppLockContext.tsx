import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

import { useAuth } from './AuthContext';

const LOCK_KEY = 'app_lock_enabled';
const AUTH_TOKEN_KEY = 'auth_token';
const SCREEN_CAPTURE_TAG = 'app-lock';
const APP_NAME = 'Expense Tracker';
// Re-lock only after the app has been away for longer than this. Short hops
// (copy an OTP, glance at an authenticator app) stay unlocked.
const GRACE_MS = 30_000;

interface AppLockContextType {
  /** Whether the user has turned the biometric lock on. */
  lockEnabled: boolean;
  /** The device can authenticate (hardware present + at least one biometric enrolled). */
  biometricAvailable: boolean;
  /** Human label for the available method, e.g. "Fingerprint" / "Face ID". */
  biometricLabel: string;
  /** App is currently locked and the overlay should demand a successful unlock. */
  locked: boolean;
  /** App is briefly covered (recents snapshot / within grace) — overlay shown, no prompt yet. */
  covered: boolean;
  /** A biometric prompt is currently on screen. */
  isAuthenticating: boolean;
  /** Turn the lock on/off. Enabling first verifies the user can pass. Returns the resulting enabled state. */
  setLockEnabled: (value: boolean) => Promise<boolean>;
  /** Trigger the biometric prompt; on success clears the lock. Returns whether it succeeded. */
  unlock: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

const labelForTypes = (types: LocalAuthentication.AuthenticationType[]): string => {
  const has = (t: LocalAuthentication.AuthenticationType) => types.includes(t);
  if (has(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
  }
  if (has(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }
  if (has(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometrics';
};

export const AppLockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [lockEnabled, setLockEnabledState] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Refs read inside the (mount-once) AppState handler to avoid stale closures.
  const lockEnabledRef = useRef(lockEnabled);
  const userRef = useRef(user);
  const biometricAvailableRef = useRef(biometricAvailable);
  const backgroundedAtRef = useRef<number>(0);
  // Suppresses the AppState churn the biometric prompt itself causes on Android
  // (the prompt briefly backgrounds the app) so it can't trigger a re-lock loop.
  const authInProgressRef = useRef(false);

  useEffect(() => {
    lockEnabledRef.current = lockEnabled;
  }, [lockEnabled]);

  useEffect(() => {
    biometricAvailableRef.current = biometricAvailable;
  }, [biometricAvailable]);

  useEffect(() => {
    userRef.current = user;
    // Logging out always clears the lock; the Login screen has its own gate.
    if (!user) {
      setLocked(false);
      setCovered(false);
    }
  }, [user]);

  // Probe device capability once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hasHardware, isEnrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        if (cancelled) return;
        setBiometricAvailable(hasHardware && isEnrolled);
        setBiometricLabel(labelForTypes(types));
      } catch {
        if (!cancelled) setBiometricAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the saved preference. On a cold start that restored an existing
  // session (token already in storage), lock immediately.
  useEffect(() => {
    (async () => {
      try {
        const [enabledRaw, token] = await Promise.all([
          AsyncStorage.getItem(LOCK_KEY),
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
        ]);
        const enabled = enabledRaw === 'true';
        setLockEnabledState(enabled);
        if (enabled && token) {
          setLocked(true);
        }
      } catch {
        // default: disabled
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  // Block screenshots + secure the recents snapshot whenever the lock is on.
  useEffect(() => {
    if (!prefsLoaded) return;
    (async () => {
      try {
        if (lockEnabled) {
          await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_TAG);
        } else {
          await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_TAG);
        }
      } catch {
        // best-effort; ignore on unsupported platforms
      }
    })();
  }, [lockEnabled, prefsLoaded]);

  const authenticate = useCallback(async (promptMessage: string): Promise<boolean> => {
    authInProgressRef.current = true;
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        // Allow the OS device passcode as a fallback so a flaky/removed
        // biometric can never lock the user out permanently.
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    } finally {
      setIsAuthenticating(false);
      // Clear the guard slightly later so the trailing AppState 'active'
      // from dismissing the prompt is still ignored.
      setTimeout(() => {
        authInProgressRef.current = false;
      }, 500);
    }
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    const ok = await authenticate(`Unlock ${APP_NAME}`);
    if (ok) {
      setLocked(false);
      setCovered(false);
    }
    return ok;
  }, [authenticate]);

  const setLockEnabled = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (value) {
        if (!biometricAvailableRef.current) return false;
        // Prove the user can pass before turning the gate on.
        const ok = await authenticate('Confirm to enable App Lock');
        if (!ok) return false;
      }
      setLockEnabledState(value);
      try {
        await AsyncStorage.setItem(LOCK_KEY, value ? 'true' : 'false');
      } catch {
        // ignore persistence failure; state still reflects the choice
      }
      if (!value) {
        setLocked(false);
        setCovered(false);
      }
      return value;
    },
    [authenticate]
  );

  // Single mount-once AppState listener; all dynamic values come from refs.
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (authInProgressRef.current) return;

      if (next === 'background' || next === 'inactive') {
        backgroundedAtRef.current = Date.now();
        if (lockEnabledRef.current && userRef.current) {
          setCovered(true);
        }
        return;
      }

      if (next === 'active') {
        if (lockEnabledRef.current && userRef.current) {
          const away = Date.now() - (backgroundedAtRef.current || 0);
          if (away > GRACE_MS) {
            setLocked(true);
          }
        }
        setCovered(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, []);

  return (
    <AppLockContext.Provider
      value={{
        lockEnabled,
        biometricAvailable,
        biometricLabel,
        locked,
        covered,
        isAuthenticating,
        setLockEnabled,
        unlock,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = (): AppLockContextType => {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
