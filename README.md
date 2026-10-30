# Riverhouse – shared house booking calendar

Month-calendar booking system for the shared (timeshare) house. Owners sign in, see who is going
when, and book, change or cancel stays. **Two stays can never overlap.** Bookings are saved one at a time inside a database
transaction, so even two people clicking Book at the same moment can't double-book. Someone can still arrive on the same day the previous family leaves.

Stack (London App Brewery / Angela Yu style): **Node.js + Express + EJS**, data in **MySQL 8**.
It can also be installed as a desktop app (PWA) and shows up in Outlook through a calendar feed.

---

## 0. One-time setup on your PC (Windows 11)

Open **PowerShell** or the **VS Code terminal** (`Ctrl + '`) and check:

```powershell
node -v      # needs v20 or newer (v22 LTS recommended)
npm -v
git --version
```

If Node is missing, install the LTS version from https://nodejs.org.

You also need one way to run SQL against MySQL. Any one of these works:

* **MySQL Workbench** (easiest), or
* the **mysql command line** (comes with MySQL Server / MySQL Shell), or
* the VS Code extension **MySQL** (cweijan). VS Code suggests it when you open the folder.

## 1. Create the database (MySQL)

Where: **MySQL Workbench**, connected to the **Dev/QA MySQL server `10.10.1.4`**, port **3306**,
as **root** or another admin account.

1. Open `db/001_create_database_and_user.sql`. Replace `<<CHOOSE_A_STRONG_PASSWORD>>` with a strong password
   (keep the quotes around it), then run the whole script with the lightning bolt (`Ctrl+Shift+Enter`).
   This creates the `riverhouse_booking` database and the `riverhouse_app` user the website signs in with.
2. Open `db/002_tables.sql` and run it the same way. This creates the `users`, `bookings` and `booking_lock` tables.

Check it worked: the **Schemas** panel (refresh it) should show `riverhouse_booking` with the 3 tables.

**Using the mysql command line instead** (PowerShell, in `C:\Dev\riverhouse-booking`):

```powershell
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/001_create_database_and_user.sql"
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/002_tables.sql"
```

> Your PC must be able to reach MySQL on port **3306**. Test it in PowerShell:
> `Test-NetConnection 10.10.1.4 -Port 3306`. It should show `TcpTestSucceeded : True`.
> If it doesn't, the server admin needs to:
>
> * set `bind-address = 0.0.0.0` (or the server's IP) in the MySQL config (`my.cnf` / `my.ini`) and restart MySQL, and
> * allow port 3306 through the server's firewall.
>
> You need **MySQL 8.0.16 or newer**. Check with `SELECT VERSION();`.

## 2. Settings file (.env)

Where: the **VS Code terminal**, in `C:\Dev\riverhouse-booking`.

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # paste result into SESSION_SECRET
code .env
```

In `.env` set:

| Setting | Value |
|---------|-------|
| `DB_HOST` | `10.10.1.4` (already filled in) |
| `DB_PORT` | `3306` |
| `DB_NAME` | `riverhouse_booking` |
| `DB_USER` | `riverhouse_app` |
| `DB_PASSWORD` | the password you put in script 001 |
| `SESSION_SECRET` | the long random string from the command above |

Never commit `.env`. It is already listed in `.gitignore`.

## 3. Install, connect, add people, run

```powershell
npm install            # downloads packages into node_modules
npm run check-db       # should print "✔ Connected" with the MySQL version and riverhouse_booking
npm test               # date/overlap/Outlook-feed unit tests
npm run create-user    # run once per family; make yourself an admin
npm run seed-test      # optional: two TEST logins for trying things out (saved in .test-users.local.json)
npm run dev            # starts the site with auto-restart (nodemon)
```

Open **http://localhost:3000** and sign in. Stop the server with `Ctrl + C`.
You can also start it with the debugger from VS Code: Run and Debug → **Run Riverhouse (debug)**.

If `npm run check-db` fails, it tells you what's wrong: a wrong password, a missing database (run 001),
missing tables (run 002), or no network route to port 3306.

## 3b. Admin page and emails (after the first install)

**Database update (once):** in MySQL Workbench, connected to `10.10.1.4` as root, open and run
`db/003_admin_and_email.sql`. It adds two columns to `users` and the `email_log` and `app_settings` tables.
It is safe to run again.

**Admin page:** signed in as an admin, click **Admin** in the menu.

* **Add a family:** fill in the name, email, initials and colour. The app makes a temporary password,
  shows it once, and (optionally) emails it. The family must choose their own password at first sign-in.
* **Edit:** change the name, initials, colour or email; make someone an admin; switch their emails off;
  or untick **Active** to stop them signing in (their stays stay on the calendar).
* **Reset password:** gives a new temporary password (shown once, optionally emailed).
* **New Outlook link:** if someone's private calendar link was shared by mistake.
* **Emails:** the last 30 emails with Sent / Failed / Logged, and a "Send me a test email" button.

Safety rules: you can't remove your own admin rights or deactivate yourself, and there is always at least one active admin.

### Email from Leopardcreek@outlook.com

Every family with emails switched on gets a message when a stay is **booked, changed or cancelled**
(owners can switch this off under My account). If email isn't working, bookings still save; the
failure shows in the admin page's email log.

`MAIL_MODE` in `.env` controls sending:

| MAIL_MODE | What happens |
|-----------|--------------|
| `log` (default) | Nothing is sent. Emails are printed in the terminal and listed as "Logged". Use for development. |
| `graph` (recommended) | Sends through Microsoft Graph as Leopardcreek@outlook.com, using a Microsoft sign-in (no password stored). |
| `oauth2` | Sends through Outlook.com SMTP with a Microsoft sign-in. Needs the SMTP.Send permission, which the portal often doesn't offer for apps that allow personal accounts. |
| `smtp` | Sends with a username + password. Microsoft is retiring password sign-in for Outlook.com, so use this only as a last resort. |

**Setting up `graph` (one time, about 10 minutes):**

1. Go to https://entra.microsoft.com, signed in with your **Optimum** admin account → **App registrations** → **New registration**.
   * Name: `Riverhouse booking mail`
   * Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   * Redirect URI: leave empty → **Register**.
2. Copy the **Application (client) ID**.
3. **Authentication** → **Advanced settings** → **Allow public client flows** = **Yes** → Save.
4. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:
   * type `Mail.Send` in the filter → tick **Mail.Send**
   * type `offline_access` → tick **offline_access** (under OpenId permissions)
   * → **Add permissions**. (No admin consent is needed - Leopardcreek@outlook.com approves it when signing in.)
5. In `.env` set:
   ```
   MAIL_MODE=graph
   SMTP_USER=Leopardcreek@outlook.com
   MAIL_FROM="Riverhouse" <Leopardcreek@outlook.com>
   MS_CLIENT_ID=<the Application (client) ID>
   MS_TENANT=consumers
   ```
6. In the VS Code terminal run `npm run mail-signin`. It prints a web address and a code.
   Open the address, enter the code, and sign in as **Leopardcreek@outlook.com** (not your work account). Then accept.
7. Test it: `npm run test-email -- marc@optimumgroup.co.za`, or use **Admin → Send me a test email**.

The sign-in is saved in the database (`app_settings`), so it works on any PC or server that uses the
same database. If it ever stops (for example, the Outlook.com password was changed), run `npm run mail-signin` again.

## Look, motion and voice

* **Look:** colours and fonts follow the client's site palette (`public/css/styles.css`).
* **Motion:** `public/css/motion.css` holds every animation and one shared set of timings
  (`--t-instant` 120 ms, `--t-quick` 200 ms, `--t-base` 320 ms, `--t-slow` 480 ms, `--t-stagger` 45 ms).
  Each animation has a job:
  * **Feedback:** buttons press and show "Booking your stay…", errors give a short shake, and toasts confirm what happened (auto-hide, pause on hover).
  * **Highlight:** a red badge counts stays booked or changed since your last visit, a dot marks them on the calendar, and your newly saved stay glows.
  * **Meaning:** floating labels on the sign-in form.
  * **Position and transitions:** months slide in from the side you travel to (also with ← and →), pages cross-fade, and content rises into view once.
  * **Superimposing:** "Cancel stay" opens a dialog on desktop and a bottom sheet on phones.
* **Voice:** copy is confident, clear and warm. Active sentences, "you", no exaggeration, and gender-neutral.

## 3c. Sign-up, read-only accounts and the app (database update 004)

**Database (once):** in MySQL Workbench, connected to `10.10.1.4` as root, run `db/004_signup_and_readonly.sql`.

* **Sign-up:** the sign-in page is the landing page and has a **Create an account** button; the sign-up page links back.
  Step 1 asks for an email and password. Step 2, **Add your family**, asks for the family name, initials and
  colour, with a live preview of the calendar bar. Admins get an email for every new account and see it on the Admin page.
* **Read-only accounts:** email addresses in the `readonly_emails` table (Andromeda@ and Nasreen@optimumgroup.co.za)
  automatically get a **View only** account when they sign up. They see the calendar, who's going and notes, but can't book,
  change, cancel or open Admin. They skip the family step. An admin can also tick **View only** on any account.
  To add more read-only people later:
  `INSERT INTO readonly_emails (Email) VALUES ('someone@example.com');`
* **Install (PWA):** Chrome, Edge and Android show **Install the app** (in the menu and on My account). On iPhone, use Safari → Share → Add to Home Screen.
* **iPhone / iPad:** the site works as a full-screen home-screen app now (Safari → Share → Add to Home Screen).
  For a real IPA (TestFlight / App Store / custom app), see `ios/README.md`. It needs an Apple Developer account and a Mac.
* **Android APK:** see `android/README.md`. Once `public/downloads/riverhouse.apk` exists on the server, the sign-in page
  and My account show **Get the Android app** on Android phones.

## 4. GitHub

Create an **empty private** repository on github.com. Don't add a README, .gitignore or licence there,
because the project already has them. Then in the VS Code terminal:

```powershell
git init
git add .
git commit -m "Riverhouse booking: month calendar, no-overlap bookings, Outlook feed, PWA"
git branch -M main
git remote add origin https://github.com/<your-account>/riverhouse-booking.git
git push -u origin main
```

Suggested branches: `main` → PROD, `dev` → Dev/QA server, feature branches for new work.

## 5. Install as a desktop app (PWA)

* **Edge:** open the site → `…` menu → **Apps** → **Install this site as an app**.
* **Chrome:** click the install icon at the right of the address bar.

The app gets its own window, a Start-menu and taskbar icon, and a "Book a stay" shortcut.
Browsers allow installing from `localhost` and from **HTTPS** sites, so the Dev and PROD servers need an HTTPS address.

## 6. Outlook

Every owner has a private calendar link under **My account**. Outlook subscribes to it and shows all house bookings.

* **Classic Outlook (Windows):** Calendar → Add Calendar → From Internet → paste the link.
* **New Outlook / Outlook on the web:** Add calendar → Subscribe from web → paste the link.

New Outlook and Outlook on the web download the feed from Microsoft's cloud. They can only reach a
**public HTTPS** address, not `localhost` or the internal `10.10.x.x` server. Classic Outlook can reach internal addresses.

## Project layout

| Path | What it is |
|------|------------|
| `index.js` | Starts Express, sessions, routes |
| `routes/` | `auth` (login), `calendar` (month view), `bookings` (book/cancel), `account`, `ics` (Outlook feed) |
| `lib/` | `db.js` (MySQL pool), `repo.js` (all SQL queries), `dates.js`, `auth.js` (login guard, CSRF), `ics.js` |
| `views/` | EJS pages + `partials/` |
| `public/` | CSS, JS, PWA manifest, service worker, icons |
| `db/` | MySQL scripts to run in MySQL Workbench |
| `scripts/` | `create-user`, `check-db`, `seed-test`, `mail-signin`, `send-test-email` (npm run test-email) |
| `test/` | Unit tests (`npm test`) |

## Roadmap

* Two-way Outlook sync (Microsoft Graph). This needs an Entra ID app registration in the client's Microsoft 365 tenant.
* Deploy to Dev/QA (`10.10.1.4`), then PROD
