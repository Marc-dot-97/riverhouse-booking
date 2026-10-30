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
5. Rename the `.apk` to `riverhouse.apk` and put it on the server at `C:\\Apps\\riverhouse-booking\\public\\downloads\\riverhouse.apk`.
   The sign-in page and My account then show a **Get the Android app** button.

## Option C – Android Studio (you have it installed)

1. **One-time Android Studio setup:** open Android Studio once and finish the setup wizard. It installs the Android SDK to
   `C:\Users\<you>\AppData\Local\Android\Sdk`.
2. **Generate the project** (VS Code terminal, after the site is live):
   ```powershell
   npm install -g @bubblewrap/cli
   cd C:\Dev\riverhouse-booking\android
   bubblewrap init --manifest https://rh-bookings.primebridge.co.za/manifest.webmanifest
   ```
   * When asked for the JDK, let Bubblewrap install its own JDK 17. Android Studio's built-in JDK is newer than Bubblewrap expects.
   * When asked for the Android SDK, point it to `C:\Users\<you>\AppData\Local\Android\Sdk`.
   * Accept the values from `twa-manifest.json` (package `za.co.primebridge.rhbookings`).
   * Let it **create a signing key**: file `riverhouse-upload.keystore`, alias `riverhouse`. Store both passwords in your password manager.
3. **Build in Android Studio:** File → Open → `C:\Dev\riverhouse-booking\android`, then let Gradle sync.
   **Build → Generate Signed App Bundle / APK → APK**, choose `riverhouse-upload.keystore`, then **release**.
   The APK lands in `android\app\release\app-release.apk`.
   Or skip Android Studio's menus and run `bubblewrap build` in the same folder.
4. **Fingerprint for the website:** `bubblewrap fingerprint list`, or in PowerShell:
   `& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore riverhouse-upload.keystore -alias riverhouse`.
   Copy the **SHA256** line into the server's `.env` as `ANDROID_CERT_SHA256=`, then restart the service.
5. **Publish the APK:** copy it to the server as `C:\Apps\riverhouse-booking\public\downloads\riverhouse.apk`.
   `update.ps1` never deletes it. The **Get the Android app** button appears on Android phones.

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
