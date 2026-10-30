# Riverhouse booking – handover for the next Claude Cowork session

> **For Claude:** read this whole file first. It describes the project, every decision made so far, and where things stand.
> The project is in `C:\Dev\riverhouse-booking` on Marc's Windows 11 PC (GitHub: `Marc-dot-97/riverhouse-booking`, branch `main`).
> **No secrets are in this file.** Passwords live only in `.env` files and in the person's head, never in chat or Git.
> Last updated: 30 Oct 2026, after commit `700386f`.

---

## 1. What this is

A private **booking calendar for a shared (timeshare) house** used by several families of the client
(the house is associated with **Leopard Creek Country Club**). It replaces a shared MS/Outlook calendar.

* Families sign in, see **who is going when**, and **book / change / cancel** stays.
* **Two stays can never overlap.** This is enforced in the database transaction. A family may arrive on the day the previous one leaves.
* The look follows the **Leopard Creek website palette and fonts**. Their logo and taglines are **not** used: the product name
  **"Riverhouse"** and the small river/roof icon are our own.
* Hosting: Optimum Shared Services hosts it for the client.
  **PROD URL:** `https://rh-bookings.primebridge.co.za` (IIS on **10.10.1.2**, port 443, certificate already in IIS).

### People
* **Marc** (marc@optimumgroup.co.za): developer and owner of this work at Optimum. Trained on Angela Yu's (London App Brewery) full-stack course.
  Works in VS Code and Visual Studio 2026 on Windows 11, and uses Git/GitHub.
* **Read-only users (by request):** `Andromeda@optimumgroup.co.za`, `Nasreen@optimumgroup.co.za`. They can see the calendar but can't book.
* House mailbox that sends emails: **`Leopardcreek@outlook.com`** (personal Outlook.com account).

---

## 2. How we work (important for Claude)

* Claude edits files **directly in `C:\Dev\riverhouse-booking`** through the Cowork device bridge (the folder `C:\Dev` is connected).
* **Marc runs all terminal commands himself** in the VS Code terminal (PowerShell): `npm install`, `npm run dev`, `git`, etc.
  Claude's shell on the PC is a Linux VM. It **cannot reach the LAN/MySQL servers (10.10.1.x)**, can't delete files, and
  git breaks there, so Claude must not run git or npm on the user's behalf.
* Claude tests against a **throwaway MySQL 8 in its own cloud workspace** (copies of the project files) and uses Playwright for screenshots.
  The real Dev DB (10.10.1.4) and PROD DB (10.10.1.2) are only reachable from Marc's PC or the servers.
* **Chrome tests** run in Marc's Chrome via Claude in Chrome against `http://localhost:3000`, using test logins from
  `.test-users.local.json` (created with `npm run seed-test`, git-ignored). **Never use Marc's own saved password.**
* ⚠️ **nodemon does NOT restart when `.env` changes** (and touching files from Claude's side doesn't reliably trigger it on Windows).
  After any `.env` change, Marc must press **Ctrl+C and run `npm run dev` again**. Before a browser test, set `MAIL_MODE=log`
  and restart, or real emails go out (this happened once).
* Ask before doing anything that sends email, changes cloud/Entra settings, or touches the servers.
* Marc's preferences: clear step-by-step instructions that say **where** each thing runs (PC vs server, VS Code terminal vs
  MySQL Workbench), concise answers, and questions as needed.
* Copy/tone: see §8.

---

## 3. Stack and structure

* **Node.js + Express + EJS** (Angela Yu style, ES modules `"type": "module"`), **MySQL 8/9** via `mysql2/promise`.
* Packages: `express`, `ejs`, `express-session`, `mysql2`, `bcryptjs`, `dotenv`, `nodemailer` (v10). Dev: `nodemon`. Node ≥ 20 (server has v24.19).
* No front-end framework: vanilla CSS/JS, progressive enhancement (works without JS).

```
index.js               Express app: static, security headers, sessions, routes, /.well-known/assetlinks.json, error pages
lib/db.js              mysql2 pool (DATE columns returned as "YYYY-MM-DD" strings, timezone Z)
lib/repo.js            ALL SQL (parameterised). createBooking/updateBooking use a transaction + SELECT ... FOR UPDATE on booking_lock
lib/dates.js           UTC date helpers, month grid (Mon-first, 42 cells), free ranges, SA time zone "today"
lib/validate.js        booking form rules (max 60 nights, guests 1–30, started-stay rules)
lib/auth.js            requireLogin (re-reads user each request), requireAdmin, requireWriter (blocks read-only), CSRF, flash, login rate-limit
lib/session-store.js   MySQL session store (table "sessions"); used when NODE_ENV=production or SESSION_STORE=mysql
lib/mailer.js          email transport: MAIL_MODE log | graph | oauth2 | smtp; logs every email to email_log; never throws
lib/notify.js          booked/changed/cancelled emails to all families; welcome/reset; admin "someone signed up"; test email
lib/ics.js             Outlook/iCal feed builder
lib/palette.js         10 calendar colours + text colour + nextFreeColour
routes/                auth (login, signup, logout) · welcome (step 2 "Add your family") · calendar · bookings · account · admin · ics
views/                 EJS pages + partials (head, header/sidebar, footer+confirm dialog, toasts, get-app, logo) + email/message.ejs
public/css/styles.css  base styles (Leopard-Creek palette)     public/css/motion.css  all animations + timing tokens
public/js/app.js       reveal-on-scroll, toasts, loading buttons, confirm dialog, month keys, install prompts, colour preview
public/sw.js           service worker (network-first; offline page)  public/manifest.webmanifest (PWA, screenshots, shortcuts)
db/001–005             MySQL scripts (see §5)          scripts/   create-user, check-db, seed-test, mail-signin, send-test-email
test/                  node --test unit tests (11 passing)
deploy/                PROD kit: install.ps1, update.ps1, iis-setup.ps1, web.config, env.production.example, README.md
android/               TWA (APK) config + README (PWABuilder / Bubblewrap / Android Studio)
ios/README.md          iPhone: Home-Screen web app now; IPA route (needs Apple Developer + Mac)
```

### npm scripts
`npm run dev` (nodemon) · `npm start` · `npm test` · `npm run check-db` · `npm run create-user` · `npm run seed-test` ·
`npm run mail-signin` · `npm run test-email -- someone@x.com`

---

## 4. Environment (`.env`; template `.env.example`, PROD template `deploy/env.production.example`)

`PORT, NODE_ENV, HOST, SESSION_SECRET, BASE_URL, DB_HOST, DB_PORT, DB_NAME (riverhouse_booking), DB_USER (riverhouse_app),
DB_PASSWORD, DB_SSL, HOUSE_NAME (Riverhouse), MAIL_MODE, SMTP_USER (Leopardcreek@outlook.com), MAIL_FROM, SMTP_HOST, SMTP_PORT,
SMTP_PASSWORD, MS_CLIENT_ID, MS_TENANT (consumers), SESSION_STORE, ANDROID_PACKAGE_NAME, ANDROID_CERT_SHA256`

* **Dev (Marc's PC):** `DB_HOST=10.10.1.4`, `MAIL_MODE=graph` (real sending works), sessions in memory.
* **PROD:** `NODE_ENV=production`, `HOST=127.0.0.1` (only IIS can reach the app), `PORT=3010`,
  `BASE_URL=https://rh-bookings.primebridge.co.za`, `DB_HOST=127.0.0.1` (MySQL on the same server), sessions in MySQL,
  secure HTTPS-only cookies, `trust proxy` on.
* **Entra app for email:** "Riverhouse booking mail", Application (client) ID **`b069c2bf-5774-403e-98f0-c2d27c0a12d4`**
  (not secret), in the Optimum tenant, audience "any org + personal Microsoft accounts", public client flows = Yes,
  delegated Microsoft Graph permissions **User.Read, offline_access, Mail.Send**. `MS_TENANT=consumers`.
  `npm run mail-signin` (device-code sign-in as Leopardcreek@outlook.com) saves a refresh token in the DB table `app_settings`
  (key `mail.refreshToken.graph`). **Each database needs its own mail sign-in** (Dev done; PROD still to do).
  Office 365 Exchange Online "SMTP.Send" wasn't available for this personal-account app, which is why we use **Graph**.

---

## 5. Database (MySQL; database `riverhouse_booking`, app user `riverhouse_app` with SELECT/INSERT/UPDATE/DELETE only)

Run as root in **MySQL Workbench**, in order. All scripts are re-runnable.

| Script | Creates / changes |
|---|---|
| 001_create_database_and_user.sql | DB (utf8mb4) + user `riverhouse_app`@`%` (password placeholder edited by hand) |
| 002_tables.sql | `users`, `bookings` (CheckIn = arrival day, CheckOut = departure day, exclusive; Status Confirmed/Cancelled; CHECK constraints), `booking_lock` (1 row) |
| 003_admin_and_email.sql | users.`MustChangePassword`, users.`EmailNotifications`, `email_log`, `app_settings` |
| 004_signup_and_readonly.sql | users.`IsReadOnly`, users.`ProfileComplete`, `readonly_emails` (andromeda@ and nasreen@optimumgroup.co.za) |
| 005_sessions.sql | `sessions` (SessionId, Expires ms, Data JSON) |

Status:
* **Dev DB 10.10.1.4** (server name PrimeBridgeDev, MySQL 9.7.2): 001–004 run. 005 is optional on Dev (only used if `SESSION_STORE=mysql`).
  Contains Marc's admin account (Breedt family), test users owner1/owner2@riverhouse.test (`seed-test`), and some cancelled test bookings.
* **PROD DB 10.10.1.2:** ✅ **001–005 run (30 Oct)** with a new, separate password. No users yet.

Key rules in code: overlap = `new.CheckIn < existing.CheckOut AND new.CheckOut > existing.CheckIn` among Confirmed bookings;
create/update lock `booking_lock` row with `FOR UPDATE` (tested: 10 simultaneous requests → exactly 1 succeeds).
IcsToken is a random UUID v4 from the app. Passwords are bcrypt (cost 12).

---

## 6. Features built (all committed)

1. **Design 1 – Month calendar** (picked from 4 mock-ups on a Claude Design canvas): sidebar (Calendar, My account, Admin, Book a stay),
   month grid with coloured bars per family (full name on desktop, initials on phone), "Who's going this month", "Open dates",
   Today/prev/next, past days hatched. Responsive (phone layout tested).
2. **Book a stay**: date pickers, nights counter, guests, note; clash message names the family; arrival on someone's departure day allowed.
3. **Change dates**: owner (or admin) can move/shorten/extend; a stay that has started keeps its arrival date; finished/cancelled can't change.
4. **Cancel** (soft cancel, Status=Cancelled) with a confirm dialog (bottom sheet on phones).
5. **Outlook/iCal feed**: private per-user link on My account (`/ics/<token>.ics`); admin can regenerate it.
6. **Admin page**: families list, add family (temp password shown once + optional welcome email, must change at first sign-in),
   edit (name, initials, colour, email, admin, view-only, active, emails on/off), reset password, new Outlook link, email log + test email.
   Guards: you can't remove your own admin rights, deactivate yourself or make yourself read-only, and there's always ≥1 active admin.
7. **Emails** (MAIL_MODE=graph from Leopardcreek@outlook.com): booked/changed/cancelled to every family with emails on;
   welcome/reset; "new sign-up" to admins; branded HTML + text; opt-out on My account; failures logged, never block bookings.
8. **Sign-up** (open to anyone with the link, per Marc): `/signup` (email + password ×2) → `/welcome` "Add your family"
   (name, initials, colour, live bar preview). The sign-in page is the landing page; the two pages link to each other. Emails on the
   `readonly_emails` list get a **View only** account and skip step 2.
9. **Read-only accounts**: see the calendar, who's going and notes; no booking, changing, cancelling or Admin (blocked server-side by `requireWriter` too).
10. **Functional animation** (`motion.css`, Audi-style motion principles adapted): timing tokens; reveal-on-scroll (once, staggered);
    calendar bars draw left→right; month slide (also ← → keys); toasts (auto-hide 6.5 s, pause on hover); loading buttons;
    error shake; floating labels; "new since your last visit" badge count + dots; highlight glow on the stay you just saved;
    signal badges (green circle OK, yellow rhombus warning, red triangle error). "Always animate" (Marc chose not to honour reduced-motion).
11. **Tone of voice** applied to all copy and emails (see §8).
12. **PWA**: manifest with screenshots/shortcuts, service worker (network-first so updates apply immediately), "Install the app" button
    (Chrome/Edge/Android), iPhone Home-Screen meta tags + apple-touch-icon + safe-area spacing, iPhone install hint.
13. **Android APK (TWA)**: `android/twa-manifest.json` (package `za.co.primebridge.rhbookings`, host rh-bookings.primebridge.co.za),
    `/.well-known/assetlinks.json` served from `.env` (ANDROID_CERT_SHA256). "Get the Android app" button appears on Android when
    `public/downloads/riverhouse.apk` exists. Marc has **Android Studio** installed at `C:\Program Files\Android\Android Studio`.
14. **iPhone IPA**: documented only (`ios/README.md`): needs an Apple Developer account ($99/yr) and a Mac; distribute via TestFlight / custom app.
    Home-Screen web app works today.
15. **Production hardening**: MySQL session store, bind to 127.0.0.1, secure cookies behind IIS (X-Forwarded-Proto), security headers.

### Bugs found and fixed along the way (don't reintroduce)
* A stale service-worker script + new CSS left pages blank → content is now hidden for animation only after `app.js` adds `html.reveal-on`, with a 1.2 s safety net.
* Cross-document View Transitions threw "opt-in disabled" errors after form posts → removed.
* `[hidden]` was overridden by `.btn { display:inline-flex }` → global `[hidden]{display:none!important}`.
* `node --test` picked up `scripts/test-email.js` → renamed to `send-test-email.js`.
* Bar labels clipped by animation fill → animations use `backwards` fill, and the highlight uses an inset box-shadow.

---

## 7. Deployment to PROD (10.10.1.2) – where we are

Architecture: `Browser/app → IIS :443 (certificate, web.config reverse proxy via URL Rewrite + ARR) → Node on 127.0.0.1:3010
(Windows service "Riverhouse" via NSSM, account LocalService, logs in C:\Apps\riverhouse-booking\logs) → MySQL on the same server`.
The server reads the code from Marc's PC over RDP drive redirection: **`\\tsclient\C\Dev\riverhouse-booking`**.

Full runbook: **`deploy/README.md`**. Steps and status:

| # | Step | Status |
|---|------|--------|
| 1 | MySQL Workbench on **10.10.1.2**: run db 001–005 (new PROD password) | ✅ **Done** |
| 2 | Install IIS add-ons **URL Rewrite 2.1** and **Application Request Routing 3.0** (if missing) | ⏳ Next |
| 3 | On the server, PowerShell **as Administrator**: `powershell -ExecutionPolicy Bypass -File \\tsclient\C\Dev\riverhouse-booking\deploy\install.ps1`. The first run creates `C:\Apps\riverhouse-booking\.env` and opens Notepad: fill in `SESSION_SECRET` (new random string) + `DB_PASSWORD` (PROD), save, then **run it again** to check the DB, install and start the service, and run the health check | ⏳ |
| 4 | `deploy\iis-setup.ps1`: enables the ARR proxy, allows the `HTTP_X_FORWARDED_PROTO` server variable, finds the IIS site bound to rh-bookings.primebridge.co.za (or use `-SiteName`), and points it at `C:\Apps\RH-Bookings` (only web.config) | ⏳ |
| 5 | In `C:\Apps\riverhouse-booking`: `npm run create-user` (Marc as admin) · `npm run mail-signin` (as Leopardcreek@outlook.com, InPrivate) · `npm run test-email -- marc@optimumgroup.co.za` | ⏳ |
| 6 | Open https://rh-bookings.primebridge.co.za, sign in, test booking/cancel, check Admin → Emails | ⏳ |
| 7 | Build the APK (see `android/README.md`, Option C Android Studio or A PWABuilder) → put the SHA-256 in the server `.env` → restart → copy the APK to `C:\Apps\riverhouse-booking\public\downloads\riverhouse.apk` | ⏳ |

Later releases: commit on the PC → on the server run `deploy\update.ps1` (backs up to `C:\Apps\_backups`, keeps 5, copies with robocopy /MIR
while keeping .env/logs/downloads/node_modules, `npm ci --omit=dev` with a fallback that copies node_modules from the PC, restarts and checks health).
Service commands: `Get-Service Riverhouse`, `C:\Tools\nssm\nssm.exe restart Riverhouse`.

What has been checked and what hasn't:
* Checked: the PowerShell scripts parse, web.config is valid XML, production mode was tested in Claude's workspace (MySQL sessions survive a restart, Secure cookie, proxy headers).
* **Not yet run on the real Windows Server.** Expect possible first-run issues: NSSM download blocked (manual copy to `C:\Tools\nssm\nssm.exe`),
  `sc.exe config ... obj= LocalService`, ARR settings, IIS site detection, and whether the server can resolve its own public name.

---

## 8. Brand, design and tone

* Colours (`:root` in styles.css): navy `#212934`, ink `#181D24`, gold `#B4975A`, light gold `#CCAB76`, bronze text `#7A5A2F`,
  cream `#F9F0EC`, stone `#E7E4E2`, muted `#5F6A73`; signal red `#D4372C` / green `#2E8B57` / yellow `#E8A92B` (badges only).
* Fonts (Google Fonts): **Noto Serif Display** (headings, italic accent word), **Jost** (labels, uppercase, letter-spaced), **Figtree** (body).
* Motion tokens: 120/200/320/480 ms, 45 ms stagger, ease-out `cubic-bezier(.2,.8,.2,1)`.
* **Tone of voice** (adapted from Audi brand guidelines for Optimum): confident, clear, cultivated, inspiring and appreciative. Active sentences,
  address the user as "you", no exaggeration or superlatives, gender-neutral, short structured text, warm but understated.
  Example: "Your stay is booked: Mon 9 – Fri 13 Nov, 4 nights. Everyone can see it on the calendar now."
* Don't use Leopard Creek's logo or taglines. Don't use any real company's branding beyond the colour/typography inspiration.

---

## 9. Open items / ideas

* Finish PROD steps 2–7 (above).
* Deactivate or remove the test users (owner1/owner2@riverhouse.test) on Dev when no longer needed. Don't create them on PROD.
* Optional: point Dev's sessions to MySQL too (`SESSION_STORE=mysql` + run 005 on Dev).
* The welcome email subject reads "Welcome to the Riverhouse house calendar". Consider dropping one "house".
* Sender display name shows "Leopard Creek" (the Outlook.com account name). Change it in that account's profile if "Riverhouse" is preferred.
* Phase 2 ideas mentioned earlier: two-way Outlook sync (Graph Calendars.ReadWrite), password reset by email link, iPhone IPA via TestFlight.
