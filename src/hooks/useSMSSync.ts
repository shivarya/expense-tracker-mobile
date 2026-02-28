import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api from '../services/api';

interface SMSMessage {
  _id: string;
  address: string;
  body: string;
  date: number;
  type?: string;
}

const BANK_KEYWORDS = ['hdfc', 'sbi', 'icici', 'idfc', 'rbl', 'axis', 'kotak', 'credited', 'debited'];
const LAST_SYNC_KEY = 'sms_last_sync_timestamp';

const getSmsAndroidModule = () => {
  try {
    const module = require('react-native-get-sms-android');
    return module?.default || module;
  } catch (error) {
    console.warn('[useSMSSync] SMS module unavailable:', error);
    return null;
  }
};

export const useSMSSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    loadLastSyncTime();
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

  const isBankSMS = (message: SMSMessage): boolean => {
    const sender = message.address?.toLowerCase() || '';
    const body = message.body?.toLowerCase() || '';
    
    return BANK_KEYWORDS.some(keyword => 
      sender.includes(keyword) || body.includes(keyword)
    );
  };

  const requestSMSPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
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

  const syncSMS = async () => {
    setIsSyncing(true);
    
    try {
      // Request permission
      const hasPermission = await requestSMSPermission();
      if (!hasPermission) {
        throw new Error('SMS permission denied');
      }

      // Get SMS from last sync or last 30 days
      const minDate = lastSyncTime || Date.now() - (30 * 24 * 60 * 60 * 1000);
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
        return { success: true, count: 0, parsed: 0, saved: 0, skipped: 0 };
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

      // Update last sync time
      const newSyncTime = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, newSyncTime.toString());
      setLastSyncTime(newSyncTime);

      return {
        success: true,
        count: bankSMS.length,
        parsed: response.data?.data?.parsed_transactions || 0,
        saved: response.data?.data?.saved_transactions || 0,
        skipped: response.data?.data?.skipped_duplicates || 0
      };

    } catch (error: any) {
      console.error('SMS sync error:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const forwardSingleSMS = async (message: SMSMessage) => {
    try {
      if (!isBankSMS(message)) {
        return false; // Not a bank SMS
      }

      await api.post('/parse/sms/webhook', {
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

  const resetSyncHistory = async () => {
    try {
      await AsyncStorage.removeItem(LAST_SYNC_KEY);
      setLastSyncTime(null);
      console.log('SMS sync history cleared');
    } catch (error) {
      console.error('Failed to reset sync history:', error);
    }
  };

  return {
    syncSMS,
    isSyncing,
    lastSyncTime,
    forwardSingleSMS,
    requestSMSPermission,
    resetSyncHistory
  };
};
