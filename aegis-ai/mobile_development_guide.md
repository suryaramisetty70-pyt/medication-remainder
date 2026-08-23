# Aegis AI: Mobile App Development & Production Guide

This guide details the exact steps to compile, run, debug, and publish the **Aegis AI Mobile App** using Capacitor and Android Studio.

---

## 🚀 Quick Start: Running on Device or Emulator

To run the application on an Android Emulator or a physical device connected via USB:

### 1. Build and Sync Web Assets
Every time you make changes to the React-TS frontend code, you must build the web bundle and sync it to the Android wrapper:
```powershell
npm run build
npx cap sync
```

### 2. Open in Android Studio
Launch Android Studio and open the native project directory:
```powershell
npx cap open android
```
*(This command automatically launches Android Studio pointing to the `/android` folder).*

### 3. Connect to the Local FastAPI Backend (Critical)
When running on an emulator or a physical phone, the device cannot access `localhost` or `127.0.0.1`. You must point the API base URL to your laptop's local network IP address:

1. Find your local IP address in PowerShell:
   ```powershell
   ipconfig
   ```
   *(Look for `IPv4 Address` under your active Wi-Fi/Ethernet adapter, e.g., `192.168.1.45`)*.
2. Update the `.env` file in the `aegis-ai/` directory:
   ```env
   VITE_API_BASE_URL=http://192.168.1.45:8000
   ```
3. Update the FastAPI backend to listen on all interfaces (`0.0.0.0`) instead of `127.0.0.1`. In `backend/main.py`:
   ```python
   uvicorn.run("main:app", host="0.0.0.5", port=8000, reload=True)
   # Change to:
   uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
   ```
4. Build and sync again:
   ```powershell
   npm run build
   npx cap sync
   ```

---

## 🎨 Branding: Customizing App Icons and Splash Screens

Capacitor has an automated asset generator plugin (`@capacitor/assets`) that generates all required icon sizes and launch screens for Android and iOS in a single command.

### 1. Install Asset Generator
Run the following in the `aegis-ai` folder:
```powershell
npm install -D @capacitor/assets
```

### 2. Prepare Source Images
Create an `assets/` folder in the root of your project and place your source design images:
*   `assets/icon-only.png` (min 1024x1024 px, no transparent margins)
*   `assets/splash.png` (min 2732x2732 px, centered logo)

### 3. Run Generator
Run the generator script:
```powershell
npx capacitor-assets generate --android
```
*(This automatically crops, scales, and copies all resource files into the `android/app/src/main/res/` folder structures).*

---

## 🔔 Native Notification Setup

Android notifications require a transparent status bar icon to display correctly. In [`capacitor.config.ts`](file:///C:/Users/surya/.gemini/antigravity/scratch/smart-medication-reminder/aegis-ai/capacitor.config.ts), we configured:
```typescript
LocalNotifications: {
  smallIcon: "ic_stat_aegis",
  iconColor: "#22d3ee"
}
```

### Adding `ic_stat_aegis` to Android Resource Drawables
1. Prepare a transparent PNG icon (solid white shapes with transparency, 96x96 px).
2. Save it inside the Android project drawable directory:
   `android/app/src/main/res/drawable/ic_stat_aegis.png`

---

## 📦 Building a Release APK for Installation

To compile a standalone `.apk` package that you can send and install directly on your phone:

1. Open the project in Android Studio:
   ```powershell
   npx cap open android
   ```
2. Wait for Gradle to finish syncing.
3. In the top menu bar, select:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. Once completed, Android Studio will show a balloon notification with a **Locate** link. Click it to find your built `app-debug.apk` file!
