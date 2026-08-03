# 📱 How to Build the Native Android App Lock APK (`AppLock-Release.apk`)

To lock **physical native apps on your Android phone** (like opening native WhatsApp, Instagram, or Banking apps directly from your phone's Android home screen), Android security policy requires a **Native Android APK (`.apk`)**.

Web browsers (Chrome/Safari) intentionally block websites from spying on background apps. Packaging this exact codebase into a native APK gives it **Usage Access** and **Draw Over Other Apps** permissions.

---

## ⚡ Option 1: 1-Click Online APK Generation (No Setup Required)

1. Open **[PWABuilder.com](https://www.pwabuilder.com/)** in your browser.
2. Enter your live URL: `https://ss-edits.github.io/App-Lock/`
3. Click **Start** ➔ **Package for Android**.
4. Click **Download APK**.
5. Transfer the generated `app-release.apk` file to your Android phone and tap **Install**!

---

## 🛠️ Option 2: Build Native APK locally using Capacitor & Android Studio

Run the following commands in terminal inside `C:\Users\Siddharth S\Desktop\APP LOCK`:

```bash
# 1. Install Capacitor CLI & Core
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Add Android Platform
npx cap add android

# 3. Copy our Web Assets to Android
npx cap copy

# 4. Open in Android Studio to build APK
npx cap open android
```

### Granting Android Permissions on your Phone:
Once installed on your Android phone, grant these 2 permissions in Phone Settings:
1. **Usage Access Permission**: Settings ➔ Security ➔ Usage Access ➔ Enable for **App Lock**.
2. **Draw Over Apps Permission**: Settings ➔ Apps ➔ Display over other apps ➔ Enable for **App Lock**.

Now, whenever you tap any locked app on your phone, **App Lock** automatically pops up its lock screen overlay in real-time!
