# CNTRD — Android APK

A thin Android WebView wrapper around the live CNTRD site. Ships as a
downloadable `.apk` so users can install CNTRD from their phone without
going through the Play Store.

## For users — install on your phone

1. Grab the APK from the latest release:
   **https://github.com/amosley0221/CNTRD/releases/tag/android-latest**
2. Tap `cntrd.apk` to install. Android will prompt you to allow
   "Install from unknown sources" the first time.
3. Open **CNTRD** from your app drawer. Sign in on the site as normal.

The app loads `https://cntrd-618y.onrender.com/v2/feed` in a full-screen
WebView — everything (auth, feed, plays, messages, push, service worker)
lives on the server and works identically to Chrome, minus the browser
chrome.

## For developers

### Local build

Requires **JDK 17** and the **Android SDK** (SDK 34, build-tools 34.0.0).

```bash
cd android
gradle wrapper --gradle-version 8.6
./gradlew assembleRelease
# APK lands at:
#   android/app/build/outputs/apk/release/app-release.apk
```

### CI build

`.github/workflows/android-apk.yml` runs on every push to the deploy
branch that touches `android/**` and publishes the resulting APK to the
[`android-latest`](https://github.com/amosley0221/CNTRD/releases/tag/android-latest)
release. Same tag on every build, so the download URL is stable.

Tag is force-updated each run (`softprops/action-gh-release@v2` with
`make_latest: true`) — no release spam.

### Signing

The build uses the standard Android **debug signing config** — good enough
for sideload distribution but Play Store won't accept it. To ship to
Play, generate a proper keystore and:

1. Add `CNTRD_KEYSTORE_BASE64`, `CNTRD_KEYSTORE_PASSWORD`,
   `CNTRD_KEY_ALIAS`, `CNTRD_KEY_PASSWORD` as GitHub Secrets.
2. Decode the keystore in the workflow before `assembleRelease`.
3. Point `signingConfig` in `app/build.gradle` at a `release` signing
   block reading those env vars.

Not worth doing until we actually want a Play Store listing.

### What changes if the site URL changes

Edit `START_URL` in
`android/app/src/main/java/com/cntrd/app/MainActivity.java`, bump the
`versionCode` in `android/app/build.gradle`, commit — CI produces a new
APK.

### Icons

Launcher icons are copied straight from the PWA
(`public/icons/icon-192.png`). To refresh, replace that file and re-copy
into each `android/app/src/main/res/mipmap-*/ic_launcher.png`.

## App shell behavior

The WebView is wrapped in enough native chrome that it doesn't read as a
browser:

- **Launch screen.** `Theme.CNTRD.Splash` paints cream + the CNTRD mark
  via `windowBackground` before the process is warm, so there's no white
  flash. `MainActivity.onCreate()` calls `setTheme(R.style.Theme_CNTRD)`
  immediately so the splash drawable isn't retained behind the WebView.
- **Branded failure screen.** `onReceivedError` / `onReceivedHttpError`
  (main frame only) swap in a native cream screen with the `cntrd.`
  wordmark, a reason, and a RETRY button — instead of Chrome's dinosaur
  page. Distinguishes "you're offline" from "the server isn't
  responding" from an HTTP 5xx.
- **Offline reads.** Cache mode is connectivity-aware: `LOAD_DEFAULT`
  when online, `LOAD_CACHE_ELSE_NETWORK` when not, re-evaluated on
  `onResume`. The last feed the user loaded still renders with no
  connection.

The error screen is built in code rather than XML so the app keeps zero
androidx dependencies and the APK stays under 2 MB.

## Road to the Play Store

Not blocking anything today — the APK sideloads fine. When we want a
listing:

1. **Real signing key.** Generate a keystore, add
   `CNTRD_KEYSTORE_BASE64`, `CNTRD_KEYSTORE_PASSWORD`, `CNTRD_KEY_ALIAS`,
   `CNTRD_KEY_PASSWORD` as GitHub Secrets, decode it in the workflow
   before `assembleRelease`, and point a `release` signing block at them.
   **Back the keystore up** — losing it means never updating the listing
   again.
2. **Convert to a Trusted Web Activity.** Google's policy discourages
   plain WebView wrappers with no added value; TWA is the blessed path
   for shipping a PWA. It needs one static file on the site:
   `/.well-known/assetlinks.json` containing the app's package name and
   signing-key fingerprint. No user-visible site change.
   TWA also gets the splash screen and offline handling from the web
   manifest + service worker, so some of the native shell above becomes
   redundant at that point.
3. **Build an App Bundle** (`bundleRelease` → `.aab`) rather than an
   APK; Play requires AAB for new listings.
4. **Store listing assets** — feature graphic, screenshots, privacy
   policy URL. The privacy policy is the usual long pole.
