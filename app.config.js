const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const appJson = require('./app.json');
const releaseVersion = require('./release-version.json');

const API_URL_DEV = process.env.API_URL_DEV || process.env.API_URL_DEV_PHYSICAL || 'http://10.0.2.2:8000';
const API_URL_PROD = process.env.API_URL_PROD || 'https://your-production-url.com/api';
const ENABLE_API_DEBUG = (process.env.ENABLE_API_DEBUG || 'false').toLowerCase() === 'true';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

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
