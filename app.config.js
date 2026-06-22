const fs = require('fs');
const path = require('path');
// Resolve .env relative to this file, not process.cwd() — Gradle's `export:embed`
// invokes app.config.js from a different cwd, so process.cwd() was silently
// missing .env and falling back to defaults (which baked the placeholder
// "your-production-url" into release builds).
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const appJson = require('./app.json');
const releaseVersion = require('./release-version.json');

// Defaults are the REAL production URL / OAuth client so a build is never
// broken just because env didn't propagate. .env / EAS env can still override.
const API_URL_DEV = process.env.API_URL_DEV || process.env.API_URL_DEV_PHYSICAL || 'http://10.0.2.2:8000';
const API_URL_PROD = process.env.API_URL_PROD || 'https://shivarya.dev/expense_tracker';
const ENABLE_API_DEBUG = (process.env.ENABLE_API_DEBUG || 'false').toLowerCase() === 'true';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '473762682694-temn315hduj5tmvprin69srkrr5kdqpl.apps.googleusercontent.com';

module.exports = ({ config }) => ({
  expo: {
    ...appJson.expo,
    version: releaseVersion.version,
    android: {
      ...appJson.expo?.android,
      versionCode: releaseVersion.versionCode,
    },
    extra: {
      ...appJson.expo?.extra, // Preserve existing properties including eas.projectId
      apiUrlDev: API_URL_DEV,
      apiUrlProd: API_URL_PROD,
      enableApiDebug: ENABLE_API_DEBUG,
      googleClientId: GOOGLE_CLIENT_ID,
    },
  },
});
