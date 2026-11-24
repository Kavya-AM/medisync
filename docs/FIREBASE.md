# Push reminders when the mobile app is closed

The app and server already contain the code. You only need to connect your own Firebase project.

1. console.firebase.google.com > Add project (free).
2. Add an **Android app**. The package name is `applicationId` in `mobile/android/app/build.gradle` (or `build.gradle.kts`).
3. Download `google-services.json` and put it in `mobile/android/app/`.
4. Add the Google services plugin to Gradle:
   - `mobile/android/settings.gradle`, inside `plugins { }`: `id "com.google.gms.google-services" version "4.4.2" apply false`
   - `mobile/android/app/build.gradle`, inside `plugins { }`: `id "com.google.gms.google-services"`
5. Project settings > Service accounts > Generate new private key. Open the downloaded file, copy everything onto ONE line, and set it as `FIREBASE_SERVICE_ACCOUNT` in `server/.env`.
6. Restart the server. It should print "Push reminders on".
7. Run the app on a real phone or an emulator with Google Play, log in, allow notifications, and add a reminder for 2 minutes ahead.

If Firebase is not set up, the app still runs. It only skips push.
