# Vayumukhi Dairy — mobile (Capacitor)

## 📲 Getting an installable APK (no Android SDK needed)

The Android project is committed, and **GitHub Actions builds the APK for you** —
this repo's equivalent of FinTracker's `eas build --profile preview` link. You do
**not** need Android Studio or the SDK on your Mac.

### Option A — one-off build (fastest)
**Actions → Build Android APK → Run workflow.** ~5 minutes. The APK lands under
that run's **Artifacts** as `android-apk`. Downloadable for 90 days; requires a
GitHub login, so it's best for testing on your own devices.

Optionally pass a **server URL** to point the shell at a different origin
(staging, a custom domain) without editing any files.

### Option B — a public download link (share with the farm)
```bash
git tag v1.0.0
git push --tags
```
The workflow attaches the APK to a **GitHub Release**, giving a permanent,
login-free URL anyone can open on their phone:

```
https://github.com/saradhi0003/VMD/releases/latest
```

### Installing on the phone
1. Open the `.apk` link on the Android device.
2. Android warns about installing from an unknown source — allow it for your
   browser. (Expected: this is a sideload, not a Play Store install.)
3. Open **Vayumukhi Dairy** and sign in.

> The build is **debug-signed** so it installs without a keystore — the same
> role EAS's `preview`/`distribution: internal` profile plays. For the Play
> Store you need a signed release AAB; the workflow file documents that path.

### Why you rarely need a new APK
The shell loads the **hosted** web app (`server.url`), so shipping a web deploy
updates every installed phone instantly — no rebuild, no store review. That's the
same JS-vs-native split Expo's OTA gives you, without a second client to maintain.
Only native changes need a fresh APK: plugins, permissions, icon, `server.url`.

## 🍎 iOS

### You cannot build iOS on this Mac — and that's not fixable by config
The dev machine is a **MacBook Air (Early 2015, `MacBookAir7,2`)**. Apple dropped
that model in Ventura, so it is stuck on **macOS 12.7.6** → **Xcode 14.2** max.
**Capacitor 6 requires Xcode 15+**, which requires macOS 13.5+. There is no
upgrade path on this hardware.

So iOS builds run on a **GitHub-hosted macOS runner** instead
(`.github/workflows/mobile-ios.yml`, `macos-14` with a current Xcode). No local
Xcode is involved: **Actions → Build iOS app → Run workflow**.

### Getting it onto an iPhone — the honest options
Android sideloads with a debug signature. iOS does not: Apple requires a real
signing identity to run on a device. The workflow builds **unsigned** by default,
which proves it compiles and produces an artifact but will **not** install as-is.

| Option | Cost | Catch |
|---|---|---|
| **PWA — Safari → Share → Add to Home Screen** | free | No native camera plugin; the web `<input capture>` still works. **Works today, no build needed.** |
| Free Apple ID + [Sideloadly](https://sideloadly.io) / AltStore re-signs the `.ipa` | free | Install **expires after 7 days**, must be refreshed |
| Apple Developer Program → TestFlight | $99/yr | The only non-expiring route; workflow exports a signed `.ipa` once the secrets are set |

There is no free, non-expiring way to install a self-built iOS app. That's
Apple's rule, not a limitation here.

### Info.plist
Camera, photo library, Face ID and microphone usage strings are already set, plus
the `vmd://` URL scheme. iOS **rejects the app at launch** — not at first use —
if a linked framework can request a permission with no usage string, so these
must exist before the feature is ever exercised.

Remember to add `vmd://auth/callback` to **Supabase → Auth → URL Configuration →
Redirect URLs**.

---


A native iOS + Android shell that loads the **hosted** web app (`capacitor.config.ts` → `server.url`) in a
WebView, adding native **camera** (Smart Scan), **push notifications**, and **deep links**. The SSR app does
not need a static export. This folder is **standalone** (not part of the pnpm workspace, so it never affects
the Vercel build).

## Prerequisites
- Node 20+. **macOS + Xcode 15+** for iOS. **Android Studio** (+ JDK 17) for Android.
- Apple Developer account ($99/yr) and Google Play Console account ($25 one-time) for store submission.
- The web app deployed (e.g. `https://vmd-nu.vercel.app` or your custom domain).

## 1. Install + generate the native projects
```bash
cd mobile
npm install
# point the shell at your production domain first (edit capacitor.config.ts → server.url)
npx cap add ios
npx cap add android
npx cap sync
```

## 2. App icons & splash
Drop a 1024×1024 `icon.png` (and optional `splash.png`) in `mobile/resources/`, then:
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate            # writes iOS/Android icon + splash sets
```
(Use the brand mark — `apps/web/public/logo.svg` rendered to PNG, navy `#173a5c` background.)

## 3. Native capabilities (do once per platform)
- **Camera** (Smart Scan): iOS `Info.plist` → `NSCameraUsageDescription` ("Scan milk/feed sheets and
  receipts"); Android camera permission is added by the plugin. The web Smart Scan `<input capture>` works in
  the WebView; for a richer native picker use `@capacitor/camera`.
- **Push**: iOS — enable Push Notifications capability + APNs key in Xcode; Android — add the
  `google-services.json` (Firebase). Wire the token to a `device_tokens` table later (server side).
- **Deep links (auth)**: register scheme **`vmd://`** + Universal/App Links for `https://<domain>`.
  - iOS: `Info.plist` URL types + Associated Domains (`applinks:<domain>`).
  - Android: `AndroidManifest.xml` intent-filter for the scheme + `assetlinks.json`.
  - In **Supabase → Authentication → URL Configuration**, add to **Redirect URLs**:
    `https://<domain>/api/auth/callback`, `https://<domain>/auth/accept-invite`, and `vmd://auth/callback`.
  - Set `NEXT_PUBLIC_SITE_URL=https://<domain>` so magic-link/invite/OAuth return correctly.

## 4. Run on device / simulator
```bash
npx cap run ios          # or: npm run ios   → opens Xcode
npx cap run android      # or: npm run android → opens Android Studio
```
After any `server.url`/plugin change: `npx cap sync`.

## 5. Submit to the stores (your accounts)
**Apple App Store**
1. App Store Connect → new app, bundle id `in.vayumukhi.app`.
2. Archive in Xcode (Release, signing via your Developer account) → upload.
3. Screenshots (6.7" + 5.5"), description, **privacy policy URL**, App Privacy questionnaire.
4. Note guideline **4.2** (minimum functionality): the native **camera scan + push + offline** are what
   make this more than "just a website" — emphasise them in review notes.

**Google Play**
1. Play Console → create app; generate an **upload key**; build a signed **AAB** in Android Studio.
2. Store listing, screenshots, **Data safety** form, content rating, privacy policy URL.
3. Internal testing track → closed → production.

## Biometric app lock
The shell registers **`capacitor-native-biometric`**; the lock UI lives in the *web* app
(`apps/web/src/components/AppLock.tsx`). Because the shell loads the hosted site via `server.url`,
Capacitor injects the bridge into the remote page and the web app reaches plugins through
`window.Capacitor.Plugins` — so **no plugin package is needed in `apps/web`**, only here.

Behaviour: locks on cold start and after 60 s in the background; unlock with Face ID / fingerprint,
falling back to the device passcode. **If no biometric is enrolled, the user is let straight in** —
the Supabase session (AAL2) plus RLS are the real lock, and no one should be shut out of their own
farm by a broken sensor. Renders nothing in a browser.

```bash
cd mobile && npm install && npx cap sync   # after adding the plugin
```
iOS also needs `NSFaceIDUsageDescription` in `Info.plist` ("Unlock Vayumukhi Dairy").

## Notes
- This loads the live site, so app updates ship by deploying the web app — no store re-review for web
  changes (only native shell changes need a new build). This is the same JS-vs-native split Expo's OTA
  gives you, without a second client to maintain.
- Keep `allowNavigation` in `capacitor.config.ts` scoped to your domain + `*.supabase.co`.
