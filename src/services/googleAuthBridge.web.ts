// Web implementation of the native GoogleSignin surface, backed by Google
// Identity Services (GIS). This mirrors only the methods api.ts and
// LoginScreen.web.tsx actually call — it is not a full native-API shim, and
// deliberately keeps the real @react-native-google-signin/google-signin
// package out of the web bundle entirely.

type CredentialCallback = (idToken: string) => void;

let gisScriptPromise: Promise<void> | null = null;
let configuredClientId: string | null = null;
let lastIdToken: string | null = null;
let externalCallback: CredentialCallback | null = null;

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google Identity Services requires a browser environment'));
      return;
    }
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

function handleCredentialResponse(response: { credential: string }) {
  lastIdToken = response.credential;
  if (externalCallback) externalCallback(response.credential);
}

async function ensureInitialized(): Promise<void> {
  if (!configuredClientId) throw new Error('GoogleSignin.configure() was not called');
  await loadGisScript();
  (window as any).google.accounts.id.initialize({
    client_id: configuredClientId,
    callback: handleCredentialResponse,
  });
}

export const GoogleSignin = {
  configure(opts: { webClientId: string }) {
    configuredClientId = opts.webClientId || null;
  },

  async hasPlayServices(): Promise<boolean> {
    // No equivalent concept on web; nothing to check.
    return true;
  },

  async signIn(): Promise<void> {
    // GIS's primary flow is rendering its own button (see renderGoogleButton
    // below), not an imperative call — LoginScreen.web.tsx uses that instead.
    throw new Error('Use the rendered Google button on web, not an imperative signIn() call.');
  },

  async signInSilently(): Promise<void> {
    // No reliable web equivalent post third-party-cookie deprecation (GIS's
    // One Tap/FedCM auto-select is unreliable across browsers). Deliberate
    // scope cut: web sessions re-prompt login after the 30-day JWT expires
    // instead of silently refreshing.
    throw new Error('Silent refresh is not supported on web');
  },

  async getTokens(): Promise<{ idToken: string | null }> {
    return { idToken: lastIdToken };
  },
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

/**
 * Web-only: renders the real Google Sign-In button into `container` and
 * invokes `onCredential` with the ID token once the user completes sign-in.
 * Used by LoginScreen.web.tsx instead of the native imperative signIn()/
 * getTokens() two-step, since GIS's ID-token flow is fundamentally
 * render-a-button-and-get-a-callback, not an imperative call.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void,
  options?: { theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; width?: number }
): Promise<void> {
  externalCallback = onCredential;
  await ensureInitialized();
  (window as any).google.accounts.id.renderButton(container, {
    theme: options?.theme || 'outline',
    size: options?.size || 'large',
    width: options?.width || 320,
  });
}
