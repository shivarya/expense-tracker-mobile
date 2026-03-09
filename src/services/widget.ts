import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import ApiService from './api';
import { WidgetSummary } from '../types/widget';

interface WidgetBridgeNativeModule {
  updateWidgetSnapshot: (snapshotJson: string) => Promise<void>;
  clearWidgetSnapshot: () => Promise<void>;
  updateWidgetSession: (baseUrl: string, token: string) => Promise<void>;
  clearWidgetSession: () => Promise<void>;
  requestWidgetRefresh: () => Promise<void>;
}

const REQUEST_THROTTLE_MS = 2500;

let lastRefreshAt = 0;

const getWidgetBridge = (): WidgetBridgeNativeModule | null => {
  if (Platform.OS !== 'android') {
    return null;
  }

  const module = (NativeModules as any)?.SmsBridge as WidgetBridgeNativeModule | undefined;
  if (!module?.updateWidgetSnapshot || !module?.updateWidgetSession) {
    return null;
  }

  return module;
};

export const syncWidgetSession = async (): Promise<boolean> => {
  const bridge = getWidgetBridge();
  if (!bridge) {
    return false;
  }

  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    await clearWidgetSession();
    return false;
  }

  try {
    await bridge.updateWidgetSession(ApiService.getBaseURL(), token);
    return true;
  } catch (error) {
    console.warn('[WidgetService] Failed to sync widget session:', error);
    return false;
  }
};

export const clearWidgetSession = async (): Promise<void> => {
  const bridge = getWidgetBridge();
  if (!bridge) {
    return;
  }

  try {
    await bridge.clearWidgetSnapshot();
    await bridge.clearWidgetSession();
    await bridge.requestWidgetRefresh();
  } catch (error) {
    console.warn('[WidgetService] Failed to clear widget session:', error);
  }
};

export const refreshWidgetSummary = async (): Promise<WidgetSummary | null> => {
  const bridge = getWidgetBridge();
  if (!bridge) {
    return null;
  }

  const sessionReady = await syncWidgetSession();
  if (!sessionReady) {
    return null;
  }

  try {
    const summary = await ApiService.getWidgetSummary();
    await bridge.updateWidgetSnapshot(JSON.stringify(summary));
    await bridge.requestWidgetRefresh();
    lastRefreshAt = Date.now();
    return summary;
  } catch (error) {
    console.warn('[WidgetService] Failed to refresh widget summary:', error);
    try {
      await bridge.requestWidgetRefresh();
    } catch (_) {
      // Ignore refresh signal failures when the snapshot call already failed.
    }
    return null;
  }
};

export const requestWidgetSummaryRefresh = async (force: boolean = false): Promise<WidgetSummary | null> => {
  const now = Date.now();
  if (!force && now - lastRefreshAt < REQUEST_THROTTLE_MS) {
    return null;
  }

  return refreshWidgetSummary();
};