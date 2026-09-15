const { Platform } = require('react-native');

// Ensures React Native's runtime globals (FormData, Blob, URL, fetch, etc.) are
// installed BEFORE any other module imports them. Without this, axios 1.13+'s
// top-level FormData reference crashes the app on launch under the New
// Architecture with `ReferenceError: Property 'FormData' doesn't exist`.
// Native-only: this pulls in RN's Fabric renderer internals, which have no web
// build, and web already has native FormData/Blob/URL/fetch globals anyway.
if (Platform.OS !== 'web') {
  require('react-native/Libraries/Core/InitializeCore');
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;

registerRootComponent(App);
