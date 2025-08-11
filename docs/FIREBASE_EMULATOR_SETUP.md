# Firebase Emulator Setup for Local Development

This Expo app is configured to use Firebase emulators during development, ensuring you never accidentally modify production data while developing locally.

## 📋 Prerequisites

Make sure you have Firebase CLI installed:
```bash
npm install -g firebase-tools
```

## 🚀 Getting Started

### Option 1: Manual Setup (Two Terminals)

1. **Start Firebase Emulators** (Terminal 1):
   ```bash
   npm run emulators
   ```
   This starts:
   - Auth emulator on `localhost:9099`
   - Firestore emulator on `localhost:8080`
   - Storage emulator on `localhost:9199`
   - Emulator UI on `localhost:4000`

2. **Start Expo Development Server** (Terminal 2):
   ```bash
   npm start
   ```

### Option 2: One Command Setup (Recommended)

If you have `concurrently` installed:
```bash
npm install --save-dev concurrently
npm run dev:with-emulators
```

## ✅ Verify It's Working

When you start your Expo app in development mode, you should see console logs like:

```
🔥 Firebase Client SDK (Expo): Connecting to emulators...
   ✅ Auth emulator connected: http://localhost:9099
   ✅ Firestore emulator connected: localhost:8080
   ✅ Storage emulator connected: localhost:9199
🎯 Firebase emulators setup complete for Expo development
```

## 🌐 Emulator UI

Access the Firebase Emulator UI at: **http://localhost:4000**

Here you can:
- View/manage Auth users
- Browse Firestore collections
- Monitor Storage files
- See logs and interactions

## 🔧 Troubleshooting

### Emulators Not Connecting
- Ensure emulators are running before starting Expo
- Check that ports 9099, 8080, 9199, and 4000 are not in use by other services

### Port Conflicts
If you need to change emulator ports, update both:
1. `reflecta-lab/firebase.json` (emulator configuration)
2. `lib/firebase.ts` (connection URLs in the emulator setup)

### Production vs Development
- **Development**: `__DEV__` flag is `true` → uses emulators
- **Production**: `__DEV__` flag is `false` → uses real Firebase

## 📁 Configuration Files

- `lib/firebase.ts` - Main Firebase configuration with emulator connection logic
- `reflecta-lab/firebase.json` - Emulator ports and settings
- `package.json` - Scripts for running emulators

## 🛡️ Safety

✅ **Safe**: Your production Firebase data is never touched during development
✅ **Isolated**: All development data stays local in emulators
✅ **Clean**: Emulator data is reset when you restart the emulators 