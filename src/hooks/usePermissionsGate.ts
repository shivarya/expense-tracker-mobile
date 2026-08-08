import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export interface PermissionsGateState {
  isChecking: boolean;
  allGranted: boolean;
  smsGranted: boolean;
  notificationsGranted: boolean;
  permanentlyDenied: boolean;
}

const checkAll = async (): Promise<Omit<PermissionsGateState, 'isChecking' | 'permanentlyDenied'>> => {
  if (Platform.OS !== 'android') {
    return { allGranted: true, smsGranted: true, notificationsGranted: true };
  }

  const [readSms, receiveSms, notifStatus] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
    Notifications.getPermissionsAsync(),
  ]);

  const smsGranted = readSms && receiveSms;
  const notificationsGranted = notifStatus.status === 'granted';

  return { allGranted: smsGranted && notificationsGranted, smsGranted, notificationsGranted };
};

/**
 * Hard-gates app entry on READ_SMS + RECEIVE_SMS + notifications — the three
 * permissions the real-time auto-detect/notify feature depends on. Re-checks
 * whenever the app returns to foreground, so granting via system Settings
 * (after a permanent denial) is picked up without needing a manual retry.
 */
export const usePermissionsGate = () => {
  const [state, setState] = useState<PermissionsGateState>({
    isChecking: true,
    allGranted: Platform.OS !== 'android',
    smsGranted: Platform.OS !== 'android',
    notificationsGranted: Platform.OS !== 'android',
    permanentlyDenied: false,
  });

  const refresh = useCallback(async () => {
    const result = await checkAll();
    setState((prev) => ({ ...prev, ...result, isChecking: false }));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const requestAll = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    const smsResults = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    const notifResult = await Notifications.requestPermissionsAsync();

    const smsPermanentlyDenied = Object.values(smsResults).some(
      (result) => result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );
    const notifPermanentlyDenied = !notifResult.granted && notifResult.canAskAgain === false;

    const result = await checkAll();
    setState({
      ...result,
      isChecking: false,
      permanentlyDenied: smsPermanentlyDenied || notifPermanentlyDenied,
    });
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { ...state, requestAll, openSettings };
};
