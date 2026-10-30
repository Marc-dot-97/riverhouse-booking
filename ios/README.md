# iPhone / iPad app (IPA) for Riverhouse

Apple handles apps differently from Android, so the iPhone has **two routes**.

## Route 1 – Home Screen app (works today, no Apple account, no cost) ✅ recommended

The website is already a full iPhone web app: it opens full-screen with its own icon, a navy
status bar, the safe-area spacing for the notch, and an offline page.

On the iPhone:
1. Open **Safari** and go to `https://rh-bookings.primebridge.co.za`.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Open **Riverhouse** from the home screen. It runs without Safari's address bar.

The site shows these steps on iPhones (sign-in page and My account). Updates appear automatically,
and there's nothing to reinstall.

## Route 2 – A real IPA (App Store / TestFlight)

An `.ipa` can't be side-loaded like an Android APK. Apple requires:

| Requirement | Why |
|---|---|
| **Apple Developer Program**, $99/year (Optimum's account, or the client's) | Every IPA must be signed by Apple |
| **A Mac with Xcode** (or a cloud Mac, e.g. Codemagic, MacinCloud) | IPAs can only be built and signed on macOS |
| **A distribution channel** | IPAs only install through the **App Store**, **TestFlight** (up to 10,000 testers, builds last 90 days), **Apple Business Manager / custom app** (private App Store listing for one organisation), or **Ad Hoc** (up to 100 registered devices per year) |

> **Note on App Store review:** Apple often rejects apps that only wrap a website (guideline 4.2, "minimum functionality").
> For a private family calendar, **TestFlight** or a **custom app through Apple Business Manager** are the realistic routes.
> Both avoid the public App Store.

### Build steps (on a Mac)

1. Go to https://www.pwabuilder.com and enter `https://rh-bookings.primebridge.co.za` → **Package for stores** → **iOS**.
   * Bundle ID: `za.co.primebridge.rhbookings`
   * App name: `Riverhouse`
   * URL: `https://rh-bookings.primebridge.co.za`
2. Download and unzip the package on a Mac, then open `src/Riverhouse.xcworkspace` in Xcode
   (run `pod install` in `src/` first if Xcode asks).
3. Xcode → **Signing & Capabilities** → choose your Apple Developer team.
4. **Product → Archive** → **Distribute App**:
   * **TestFlight & App Store Connect**: invite the families by email and they install through the TestFlight app.
   * **Ad Hoc**: export the `.ipa`. Install it only on devices whose UDIDs are registered in your developer account.
   * **Custom App** (Apple Business Manager): a private listing only your organisation can see.
5. Keep the signing certificate and provisioning profiles in the developer account. You need them for every update.

### When to rebuild the IPA

Only when the icon, name, colours or start address change. Website changes appear in the app automatically.
