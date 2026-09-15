// Native passthrough for the platform-split Google Sign-In surface. See
// googleAuthBridge.web.ts for the browser (Google Identity Services) version —
// Metro picks whichever file matches the build platform automatically.
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export { GoogleSignin, statusCodes };
