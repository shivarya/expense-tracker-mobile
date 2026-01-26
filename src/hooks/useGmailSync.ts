import { useEffect, useState } from 'react';
import { api } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_GMAIL_SYNC_KEY = 'gmail_last_sync_timestamp';

export const useGmailSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    loadLastSyncTime();
    checkAuthorization();
  }, []);

  const loadLastSyncTime = async () => {
    try {
      const timestamp = await AsyncStorage.getItem(LAST_GMAIL_SYNC_KEY);
      if (timestamp) {
        setLastSyncTime(parseInt(timestamp));
      }
    } catch (error) {
      console.error('Failed to load last Gmail sync time:', error);
    }
  };

  const checkAuthorization = async () => {
    try {
      const response = await api.get('/api/parse/email/gmail/status');
      setIsAuthorized(response.data?.authorized || false);
    } catch (error) {
      console.error('Failed to check Gmail authorization:', error);
      setIsAuthorized(false);
    }
  };

  const authorizeGmail = async (): Promise<{ success: boolean; authUrl?: string; error?: string }> => {
    try {
      const response = await api.get('/api/parse/email/gmail/setup');
      
      if (response.data.success && response.data.data?.authUrl) {
        return {
          success: true,
          authUrl: response.data.data.authUrl
        };
      }

      return {
        success: false,
        error: response.data.message || 'Failed to get authorization URL'
      };
    } catch (error: any) {
      console.error('Gmail authorization error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to authorize Gmail'
      };
    }
  };

  const syncGmail = async (): Promise<{
    success: boolean;
    count?: number;
    saved?: number;
    error?: string;
  }> => {
    if (isSyncing) {
      return { success: false, error: 'Sync already in progress' };
    }

    setIsSyncing(true);

    try {
      // Call the Gmail fetch endpoint
      const response = await api.post('/api/parse/email/gmail/fetch', {
        maxResults: 50, // Fetch last 50 emails
        query: 'from:(camsonline.com OR kfintech.com) subject:(statement OR account statement)'
      });

      if (response.data.success) {
        const currentTime = Date.now();
        await AsyncStorage.setItem(LAST_GMAIL_SYNC_KEY, currentTime.toString());
        setLastSyncTime(currentTime);

        const data = response.data.data || {};
        return {
          success: true,
          count: data.emailsProcessed || 0,
          saved: data.transactionsSaved || 0
        };
      }

      return {
        success: false,
        error: response.data.message || 'Gmail sync failed'
      };
    } catch (error: any) {
      console.error('Gmail sync error:', error);
      
      let errorMessage = 'Failed to sync Gmail';
      
      if (error.response?.status === 401) {
        errorMessage = 'Gmail not authorized. Please authorize first.';
        setIsAuthorized(false);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncGmail,
    authorizeGmail,
    isSyncing,
    lastSyncTime,
    isAuthorized,
    checkAuthorization
  };
};
