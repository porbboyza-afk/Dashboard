# MyDash Sync Companion

Android-only sync bridge for MyDash.

```text
Garmin Connect Android
-> Health Connect
-> MyDash Sync Companion
-> Firebase Realtime Database
-> MyDash Web Dashboard
```

This app is not a full mobile dashboard. It imports Health Connect exercise sessions and wellness fields into the existing MyDash Firebase user path.

## Build

```powershell
cd C:\Users\pucca\Dashboard-GitHub\android-sync-companion
.\gradlew.bat assembleDebug
```

The debug APK is generated at:

```text
app\build\outputs\apk\debug\app-debug.apk
```

## Local Config

The app uses Firebase package:

```text
com.pucca.mydashsync
```

`app/google-services.json` is required locally but is ignored by git.

## First Device Test

1. Install Garmin Connect and Health Connect on the Android phone.
2. Confirm Garmin Connect writes activity data to Health Connect.
3. Enable Developer options and USB debugging.
4. Check device:

```powershell
C:\Users\pucca\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
```

5. Install debug APK:

```powershell
C:\Users\pucca\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r app\build\outputs\apk\debug\app-debug.apk
```

6. Sign in with the same Google/Firebase account used by MyDash Web.
7. Grant Health Connect permissions.
8. Run `Sync last 30 days`.
9. Refresh MyDash Web and verify imported workouts under `users/{uid}/workouts`.

## Current Sync Coverage

- Health Connect import currently reads the last 30 days.
- Exercise sync imports distance, duration, average heart rate, calories, average cadence when Health Connect provides samples, source app, and deterministic Health Connect IDs.
- Wellness sync fills missing Daily Wellness fields only:
  - sleep hours
  - resting heart rate
  - HRV RMSSD
  - weight
  - SpO2
- Existing manual wellness values are not overwritten.
- Auto sync is scheduled with WorkManager every 12 hours when the user is signed in and permissions are granted.
- Route and laps are not imported yet.
- On the tested phone, Garmin/Health Connect returned zero cadence samples; the app still attempts cadence import when available.
- Google Sign-In API currently uses the legacy GoogleSignIn client. It builds, but can be migrated to Credential Manager later.
- `gradle.properties` forces Gradle JVM locale to `en-US`; this avoids an AGP zip timestamp bug on Thai locale machines.
