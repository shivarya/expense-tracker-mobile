import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import api from '../services/api';

interface SMSMessage {
  _id: string;
  address: string;
  body: string;
  date: number;
  type?: string;
}

interface RealtimeSMSMessage {
  sender: string;
  body: string;
  date: number;
}

type SyncMode = 'manual' | 'auto_daily' | 'auto_realtime';

interface SyncResult {
  success: boolean;
  mode: SyncMode;
  count: number;
  parsed: number;
  saved: number;
  skipped: number;
  savedDebitCount: number;
  savedCreditCount: number;
  savedDebitAmount: number;
  savedCreditAmount: number;
  didSkip?: boolean;
  skipReason?: string;
  error?: string;
}

interface AutoSyncSnapshot extends SyncResult {
  timestamp: number;
}

interface UseSMSSyncOptions {
  enableRealtimeListener?: boolean;
}

interface SmsBridgeNativeModule {
  drainPendingSMS: () => Promise<RealtimeSMSMessage[]>;
}

const BANK_KEYWORDS = ['hdfc', 'sbi', 'icici', 'idfc', 'rbl', 'axis', 'kotak', 'credited', 'debited'];
const LAST_SYNC_KEY = 'sms_last_sync_timestamp';
const AUTO_LAST_SYNC_DATE_KEY = 'sms_auto_last_sync_date';
const AUTO_LAST_RESULT_KEY = 'sms_auto_last_result';
const AUTO_NOTIFICATION_CHANNEL = 'sms-sync-auto';
const REALTIME_EVENT_NAME = 'SMSIncoming';
const REALTIME_SYNC_DEBOUNCE_MS = 12000;

let notificationsConfigured = false;

const getSmsAndroidModule = () => {
  try {
    const module = require('react-native-get-sms-android');
    return module?.default || module;
  } catch (error) {
    console.warn('[useSMSSync] SMS module unavailable:', error);
    return null;
  }
};

const getSmsBridgeModule = (): SmsBridgeNativeModule | null => {
  try {
    const module = (NativeModules as any)?.SmsBridge;
    if (module?.drainPendingSMS) {
      return module as SmsBridgeNativeModule;
    }
    return null;
  } catch (error) {
    console.warn('[useSMSSync] Realtime SMS bridge unavailable:', error);
    return null;
  }
};

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ensureNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    if (!notificationsConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationsConfigured = true;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return false;
    }

    await Notifications.setNotificationChannelAsync(AUTO_NOTIFICATION_CHANNEL, {
      name: 'Auto SMS Sync',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      lightColor: '#2B7BE5',
      sound: null,
    });

    return true;
  } catch (error) {
    console.warn('[useSMSSync] Notification setup failed:', error);
    return false;
  }
};

const sendAutoSyncSummaryNotification = async (result: SyncResult): Promise<void> => {
  if (result.mode === 'manual') {
    return;
  }

  if (result.count <= 0 && result.saved <= 0) {
    return;
  }

  const allowed = await ensureNotificationPermissions();
  if (!allowed) {
    return;
  }

  const title = result.mode === 'auto_realtime' ? 'New SMS Synced' : 'Daily SMS Sync Complete';
  const body = `Found ${result.count} SMS | Saved ${result.saved} (${result.savedDebitCount} debit, ${result.savedCreditCount} credit)`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          mode: result.mode,
          count: result.count,
          saved: result.saved,
          debit: result.savedDebitCount,
          credit: result.savedCreditCount,
        },
      },
      trigger: null,
      identifier: `sms-sync-${result.mode}-${Date.now()}`,
    });
  } catch (error) {
    console.warn('[useSMSSync] Failed to send auto-sync notification:', error);
  }
};

export const useSMSSync = (options: UseSMSSyncOptions = {}) => {
  const { enableRealtimeListener = false } = options;
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastAutoSyncResult, setLastAutoSyncResult] = useState<AutoSyncSnapshot | null>(null);
  const [isRealtimeBridgeAvailable, setIsRealtimeBridgeAvailable] = useState(false);

  const realtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    loadLastSyncTime();
    loadAutoSyncResult();
    setIsRealtimeBridgeAvailable(Platform.OS === 'android' && !!getSmsBridgeModule());
  }, []);

  const loadLastSyncTime = async () => {
    try {
      const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (timestamp) {
        setLastSyncTime(parseInt(timestamp));
      }
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  };

  const loadAutoSyncResult = async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTO_LAST_RESULT_KEY);
      if (!raw) {
        setLastAutoSyncResult(null);
        return;
      }

      const parsed = JSON.parse(raw) as AutoSyncSnapshot;
      if (parsed && typeof parsed.timestamp === 'number') {
        setLastAutoSyncResult(parsed);
      }
    } catch (error) {
      console.error('Failed to load auto sync result:', error);
    }
  };

  const isBankSMS = (message: SMSMessage): boolean => {
    const sender = message.address?.toLowerCase() || '';
    const body = message.body?.toLowerCase() || '';
    
    return BANK_KEYWORDS.some(keyword => 
      sender.includes(keyword) || body.includes(keyword)
    );
  };

  const requestSMSPermission = async (silent: boolean = false): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (alreadyGranted) {
        return true;
      }

      if (silent) {
        return false;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'This app needs access to your SMS to automatically track bank transactions',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  };

  const persistAutoSyncResult = useCallback(async (result: SyncResult) => {
    if (result.mode === 'manual') {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const snapshot: AutoSyncSnapshot = {
      ...result,
      timestamp: Date.now(),
    };

    await AsyncStorage.multiSet([
      [AUTO_LAST_SYNC_DATE_KEY, today],
      [AUTO_LAST_RESULT_KEY, JSON.stringify(snapshot)],
    ]);

    setLastAutoSyncResult(snapshot);
  }, []);

  const syncSMS = useCallback(async (opts?: { mode?: SyncMode; notify?: boolean; silent?: boolean }): Promise<SyncResult> => {
    const mode: SyncMode = opts?.mode ?? 'manual';
    const shouldNotify = opts?.notify ?? mode !== 'manual';
    const silent = opts?.silent ?? mode !== 'manual';

    if (syncInFlightRef.current) {
      return {
        success: false,
        mode,
        count: 0,
        parsed: 0,
        saved: 0,
        skipped: 0,
        savedDebitCount: 0,
        savedCreditCount: 0,
        savedDebitAmount: 0,
        savedCreditAmount: 0,
        didSkip: true,
        skipReason: 'sync_in_progress',
      };
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);
    
    try {
      // Request permission
      const hasPermission = await requestSMSPermission(silent);
      if (!hasPermission) {
        if (mode === 'manual') {
          throw new Error('SMS permission denied');
        }

        const deniedResult: SyncResult = {
          success: false,
          mode,
          count: 0,
          parsed: 0,
          saved: 0,
          skipped: 0,
          savedDebitCount: 0,
          savedCreditCount: 0,
          savedDebitAmount: 0,
          savedCreditAmount: 0,
          didSkip: true,
          skipReason: 'permission_denied',
          error: 'SMS permission denied',
        };

        await persistAutoSyncResult(deniedResult);
        return deniedResult;
      }

      // Read directly from AsyncStorage (not state) to avoid race condition
      // where state may not yet reflect the persisted timestamp
      const storedTimestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const lastSync = storedTimestamp ? parseInt(storedTimestamp, 10) : null;
      const minDate = lastSync || Date.now() - (30 * 24 * 60 * 60 * 1000);
      const SmsAndroid = getSmsAndroidModule();

      if (!SmsAndroid?.list) {
        throw new Error('SMS sync is not available in this build. Please install the latest compatible build.');
      }
      
      const messages = await new Promise<SMSMessage[]>((resolve, reject) => {
        const filter = {
          box: 'inbox',
          minDate: minDate,
          maxCount: 100
        };

        SmsAndroid.list(
          JSON.stringify(filter),
          (fail: string) => {
            console.error('SMS list error:', fail);
            reject(new Error(fail));
          },
          (count: number, smsList: string) => {
            try {
              const smsArray = JSON.parse(smsList);
              resolve(smsArray);
            } catch (parseError) {
              reject(new Error('Failed to parse SMS list'));
            }
          }
        );
      });

      // Filter bank SMS
      const bankSMS = messages.filter(isBankSMS);

      if (bankSMS.length === 0) {
        console.log('No bank SMS found');
        const newSyncTime = Date.now();
        await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime.toString());
        setLastSyncTime(newSyncTime);

        const emptyResult: SyncResult = {
          success: true,
          mode,
          count: 0,
          parsed: 0,
          saved: 0,
          skipped: 0,
          savedDebitCount: 0,
          savedCreditCount: 0,
          savedDebitAmount: 0,
          savedCreditAmount: 0,
        };

        await persistAutoSyncResult(emptyResult);
        return emptyResult;
      }

      console.log(`Found ${bankSMS.length} bank SMS messages`);

      // Format for server
      const formattedMessages = bankSMS.map(msg => ({
        sender: msg.address,
        body: msg.body,
        date: new Date(msg.date).toISOString()
      }));

      // Send to server for parsing
      const response = await api.parseSMS(formattedMessages);
      const payload = response?.data?.data || {};

      const result: SyncResult = {
        success: true,
        mode,
        count: bankSMS.length,
        parsed: toNumber(payload.parsed_transactions),
        saved: toNumber(payload.saved_transactions),
        skipped: toNumber(payload.skipped_duplicates),
        savedDebitCount: toNumber(payload.saved_debit_count),
        savedCreditCount: toNumber(payload.saved_credit_count),
        savedDebitAmount: toNumber(payload.saved_debit_amount),
        savedCreditAmount: toNumber(payload.saved_credit_amount),
      };

      // Update last sync time
      const newSyncTime = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime.toString());
      setLastSyncTime(newSyncTime);

      await persistAutoSyncResult(result);

      if (shouldNotify && mode !== 'manual') {
        await sendAutoSyncSummaryNotification(result);
      }

      return result;

    } catch (error: any) {
      console.error('SMS sync error:', error);
      if (mode === 'manual') {
        throw error;
      }

      const failedResult: SyncResult = {
        success: false,
        mode,
        count: 0,
        parsed: 0,
        saved: 0,
        skipped: 0,
        savedDebitCount: 0,
        savedCreditCount: 0,
        savedDebitAmount: 0,
        savedCreditAmount: 0,
        error: error?.message || 'Auto SMS sync failed',
      };

      await persistAutoSyncResult(failedResult);
      return failedResult;
    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [persistAutoSyncResult]);

  const scheduleRealtimeSync = useCallback(() => {
    if (realtimeTimeoutRef.current) {
      return;
    }

    realtimeTimeoutRef.current = setTimeout(async () => {
      realtimeTimeoutRef.current = null;
      const result = await syncSMS({ mode: 'auto_realtime', silent: true, notify: true });
      if (!result.success) {
        console.warn('[useSMSSync] Realtime sync did not succeed:', result.error || result.skipReason || 'unknown');
      }
    }, REALTIME_SYNC_DEBOUNCE_MS);
  }, [syncSMS]);

  const runDailyAutoSyncIfNeeded = useCallback(async (): Promise<SyncResult> => {
    const today = new Date().toISOString().slice(0, 10);
    const lastAutoSyncDate = await AsyncStorage.getItem(AUTO_LAST_SYNC_DATE_KEY);

    if (lastAutoSyncDate === today) {
      return {
        success: true,
        mode: 'auto_daily',
        count: 0,
        parsed: 0,
        saved: 0,
        skipped: 0,
        savedDebitCount: 0,
        savedCreditCount: 0,
        savedDebitAmount: 0,
        savedCreditAmount: 0,
        didSkip: true,
        skipReason: 'already_synced_today',
      };
    }

    return syncSMS({ mode: 'auto_daily', silent: true, notify: true });
  }, [syncSMS]);

  const forwardSingleSMS = async (message: SMSMessage) => {
    try {
      if (!isBankSMS(message)) {
        return false; // Not a bank SMS
      }

      await api.parseSMSWebhook({
        sender: message.address,
        body: message.body,
        date: new Date(message.date).toISOString()
      });

      return true;
    } catch (error) {
      console.error('Failed to forward SMS:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!enableRealtimeListener || Platform.OS !== 'android') {
      return;
    }

    const bridge = getSmsBridgeModule();
    if (!bridge) {
      return;
    }

    const emitter = new NativeEventEmitter((NativeModules as any).SmsBridge);
    const subscription = emitter.addListener(REALTIME_EVENT_NAME, (incoming: RealtimeSMSMessage) => {
      const asSMS: SMSMessage = {
        _id: String(Date.now()),
        address: incoming?.sender || '',
        body: incoming?.body || '',
        date: Number(incoming?.date || Date.now()),
      };

      if (isBankSMS(asSMS)) {
        scheduleRealtimeSync();
      }
    });

    const drainPendingQueue = () => {
      bridge
        .drainPendingSMS()
        .then((pending) => {
          if (Array.isArray(pending) && pending.length > 0) {
            scheduleRealtimeSync();
          }
        })
        .catch((error) => {
          console.warn('[useSMSSync] Failed to drain pending realtime SMS:', error);
        });
    };

    // Drain any SMS captured while JS runtime was not active.
    drainPendingQueue();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainPendingQueue();
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
        realtimeTimeoutRef.current = null;
      }
    };
  }, [enableRealtimeListener, scheduleRealtimeSync]);

  const resetSyncHistory = async () => {
    try {
      await AsyncStorage.multiRemove([LAST_SYNC_KEY, AUTO_LAST_SYNC_DATE_KEY, AUTO_LAST_RESULT_KEY]);
      setLastSyncTime(null);
      setLastAutoSyncResult(null);
      console.log('SMS sync history cleared');
    } catch (error) {
      console.error('Failed to reset sync history:', error);
    }
  };

  return {
    syncSMS,
    isSyncing,
    lastSyncTime,
    lastAutoSyncResult,
    runDailyAutoSyncIfNeeded,
    isRealtimeBridgeAvailable,
    forwardSingleSMS,
    requestSMSPermission,
    resetSyncHistory
  };
};
