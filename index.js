// Ensures React Native's runtime globals (FormData, Blob, URL, fetch, etc.) are
// installed BEFORE any other module imports them. Without this, axios 1.13+'s
// top-level FormData reference crashes the app on launch under the New
// Architecture with `ReferenceError: Property 'FormData' doesn't exist`.
import 'react-native/Libraries/Core/InitializeCore';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
