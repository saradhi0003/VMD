# Vayumukhi Dairy — mobile (Capacitor)

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

## Notes
- This loads the live site, so app updates ship by deploying the web app — no store re-review for web
  changes (only native shell changes need a new build).
- Keep `allowNavigation` in `capacitor.config.ts` scoped to your domain + `*.supabase.co`.
