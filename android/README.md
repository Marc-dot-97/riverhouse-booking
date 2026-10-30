# Android app (APK) for Riverhouse

The Android app is a **Trusted Web Activity (TWA)**: a small Android wrapper that opens
`https://rh-bookings.primebridge.co.za` full-screen, with no browser bar, using Chrome on the phone.
Every change to the website shows in the app straight away. The app itself never needs rebuilding for that.

**Before you start:** the site must be live on `https://rh-bookings.primebridge.co.za` with a valid
certificate, and opening `https://rh-bookings.primebridge.co.za/manifest.webmanifest` must show the manifest.

---

## Option A – PWABuilder (easiest, no Android tools needed)

1. Go to https://www.pwabuilder.com and enter `https://rh-bookings.primebridge.co.za`.
2. Click **Package for stores** → **Android** → **Generate Package**.
   * Package ID: `za.co.primebridge.rhbookings`
   * App name: `Riverhouse`
   * Signing key: **Create new** (or upload `riverhouse-upload.keystore` if you already made one).
3. Download the zip. Inside you'll find:
   * `*.apk`: the installable app (side-load or share)
   * `*.aab`: only needed if you ever publish to Google Play
   * `signing.keystore` + `signing-key-info.txt`: **keep these safe** (password manager or a secure
     share, **not** in GitHub). You need the same key for every future update.
   * `assetlinks.json`: holds your key's SHA-256 fingerprint.
4. Copy the fingerprint from `assetlinks.json` (`"sha256_cert_fingerprints"`) into the server's `.env`:
   ```
   ANDROID_PACKAGE_NAME=za.co.primebridge.rhbookings
   ANDROID_CERT_SHA256=AB:CD:EF:...   (the long value)
   ```
   Restart the site. Check that https://rh-bookings.primebridge.co.za/.well-known/assetlinks.json shows it.
   (This proves to Android that the app and the website belong together. Without it, the app shows a browser bar.)
5. Rename the `.apk` to `riverhouse.apk` and put it in `public/downloads/` on the server.
   The sign-in page and My account then show a **Get the Android app** button.

## Option B – Bubblewrap CLI (from your PC, VS Code terminal)

Needs Node (you have it). Bubblewrap downloads Java 17 and the Android SDK itself on first run (about 1 GB).

```powershell
npm install -g @bubblewrap/cli
cd C:\Dev\riverhouse-booking\android
bubblewrap init --manifest https://rh-bookings.primebridge.co.za/manifest.webmanifest
#   accept the defaults it reads from twa-manifest.json; let it create a new signing key
#   (keystore riverhouse-upload.keystore, alias riverhouse) - remember both passwords
bubblewrap build
#   -> app-release-signed.apk
bubblewrap fingerprint list   # shows the SHA-256 fingerprint for .env (ANDROID_CERT_SHA256)
```

Then do steps 4–5 from Option A.

## Installing on a phone

* Open `https://rh-bookings.primebridge.co.za` on the phone → **Get the Android app** → open the download.
* Android asks to allow installs from Chrome ("unknown apps"). Allow it once, then tap **Install**.
* Prefer not to side-load? In Chrome, use **⋮ → Add to Home screen / Install app**. This gives the same app without an APK.

**iPhone:** Apple doesn't allow APKs. In Safari, use **Share → Add to Home Screen** for the same app.

## Updating the app later

You only rebuild when the icon, name or colours change. Bump `appVersionCode` (and `appVersionName`)
in `twa-manifest.json`, then rebuild with the **same keystore**.
