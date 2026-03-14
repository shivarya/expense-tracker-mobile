const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const appJsonPath = path.join(rootDir, 'app.json');
const androidGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function syncAndroidVersionName(version) {
  if (!fs.existsSync(androidGradlePath)) {
    return;
  }

  const gradleContent = fs.readFileSync(androidGradlePath, 'utf8');
  const versionNameRegex = /versionName\s+"[^"]+"/;

  if (!versionNameRegex.test(gradleContent)) {
    throw new Error('android/app/build.gradle does not contain a versionName entry');
  }

  const updated = gradleContent.replace(versionNameRegex, `versionName "${version}"`);
  fs.writeFileSync(androidGradlePath, updated, 'utf8');
  console.log(`Synced android/app/build.gradle versionName -> ${version}`);
}

function syncVersion() {
  const pkg = readJson(packageJsonPath);
  const app = readJson(appJsonPath);

  if (!pkg.version) {
    throw new Error('package.json version is missing');
  }

  if (!app.expo) {
    throw new Error('app.json expo config is missing');
  }

  app.expo.version = pkg.version;
  writeJson(appJsonPath, app);
  console.log(`Synced app.json expo.version -> ${pkg.version}`);
  syncAndroidVersionName(pkg.version);
}

syncVersion();