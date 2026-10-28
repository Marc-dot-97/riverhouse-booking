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
| `scripts/` | `create-user`, `check-db` |
| `test/` | Unit tests (`npm test`) |

## Roadmap

* Admin page (add or reset owners from the browser instead of the terminal)
* Email to all owners when a stay is booked or cancelled
* Two-way Outlook sync (Microsoft Graph). This needs an Entra ID app registration in the client's Microsoft 365 tenant.
* Deploy to Dev/QA (`10.10.1.4`), then PROD
