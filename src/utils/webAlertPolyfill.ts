import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a complete no-op (see
// node_modules/react-native-web/src/exports/Alert/index.js) — there's no
// browser equivalent of RN's native modal alert, so it silently does
// nothing. Every screen in this app imports Alert directly from
// 'react-native' and calls Alert.alert(title, message[, buttons]) for both
// success/error feedback and destructive-action confirmations (140 call
// sites across 16 files, all using the same shape: plain title/message, or
// title/message + exactly [Cancel, action] buttons — no 3+ button alerts
// anywhere in this app). Rather than touching every call site, this patches
// the shared Alert singleton once at app bootstrap so every existing call
// site starts working automatically.

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const body = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(body);
    return;
  }

  if (buttons.length === 1) {
    window.alert(body);
    buttons[0].onPress?.();
    return;
  }

  // Two-button confirmations: the cancel-styled button maps to window.confirm's
  // Cancel, and the remaining (default/destructive) button to its OK. Browser
  // button labels won't match the app's custom text (e.g. "Disconnect"), but
  // the semantics are preserved, which is what matters for correctness.
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b !== cancelButton) || buttons[0];

  if (window.confirm(body)) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}

export function installWebAlertPolyfill() {
  if (Platform.OS !== 'web') return;
  (Alert as unknown as { alert: typeof webAlert }).alert = webAlert;
}
