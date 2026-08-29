# Minimum Standards mobile app

The React Native client for Minimum Standards. Product context and repository-level
architecture are documented in the [root README](../../README.md).

## Development

Use Node 20 or later and complete the React Native platform setup for iOS or Android.

```bash
npm install
npm run ios       # or npm run android
```

The app depends on the local packages under `../../packages` and requires Firebase
client configuration for a development project. Firestore-rules tests run separately
through the repository's emulator-backed test package.
