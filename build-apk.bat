@echo off
cd /d "%~dp0"
echo Building production APK from: %CD%
eas build --platform android --profile production --wait
