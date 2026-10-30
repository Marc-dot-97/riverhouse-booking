# Deploying Riverhouse to PROD – 10.10.1.2 (rh-bookings.primebridge.co.za)

```
 Browser / phone app ──HTTPS 443──► IIS (certificate) ──► Node app on 127.0.0.1:3000 ──► MySQL on 10.10.1.2
                                    web.config proxy        Windows service "Riverhouse"
```

Everything below happens **on the server** in your RDP session, unless it says "on your PC".
The server reads the code from your PC through `\\tsclient\C\Dev\riverhouse-booking`, so the RDP session must
share your C: drive (Remote Desktop → Local Resources → More → Drives → tick C:).

---

## First deploy (once)

### 1. Database – MySQL Workbench, connected to **10.10.1.2** as root

Run these files from `C:\Dev\riverhouse-booking\db` **in order**:

| # | File | Note |
|---|------|------|
| 1 | `001_create_database_and_user.sql` | Use a **new** strong password (not the Dev one). Keep it for step 3. Optional tightening: replace `'riverhouse_app'@'%'` with `'riverhouse_app'@'localhost'` in all 3 lines, because the app runs on the same server. |
| 2 | `002_tables.sql` | |
| 3 | `003_admin_and_email.sql` | |
| 4 | `004_signup_and_readonly.sql` | Adds Andromeda@ and Nasreen@ as read-only |
| 5 | `005_sessions.sql` | Keeps people signed in across restarts |

### 2. IIS add-ons (if not installed yet)

* URL Rewrite 2.1: https://www.iis.net/downloads/microsoft/url-rewrite
* Application Request Routing 3.0: https://www.iis.net/downloads/microsoft/application-request-routing

### 3. Install the app – PowerShell **as Administrator**

```powershell
powershell -ExecutionPolicy Bypass -File \\tsclient\C\Dev\riverhouse-booking\deploy\install.ps1
```

* **First run:** it copies the app to `C:\Apps\riverhouse-booking`, installs packages, creates `.env` and opens it in
  Notepad. Fill in `SESSION_SECRET` (the script shows how to make one) and `DB_PASSWORD` (from step 1), then save.
* **Run the same command again.** It checks the database, installs the Windows service **Riverhouse**
  (starts with Windows and restarts itself if it stops), and confirms the app answers on `http://127.0.0.1:3000/health`.

### 4. Connect IIS – PowerShell as Administrator

```powershell
powershell -ExecutionPolicy Bypass -File \\tsclient\C\Dev\riverhouse-booking\deploy\iis-setup.ps1
```

It finds the IIS site bound to `rh-bookings.primebridge.co.za` and turns on the ARR proxy. It points the site at
`C:\Apps\riverhouse-booking-iis`, a folder that holds only `web.config`, so no app files are ever served directly.
If it can't find the site: `...\iis-setup.ps1 -SiteName "Your IIS site name"`.

### 5. First admin + email (in `C:\Apps\riverhouse-booking`)

```powershell
cd C:\Apps\riverhouse-booking
npm run create-user        # add yourself as admin on PROD
npm run mail-signin        # sign the Leopardcreek@outlook.com mailbox in for PROD (same steps as on your PC)
npm run test-email -- marc@optimumgroup.co.za
```

> PROD has its own database, so it needs its own admin and its own mailbox sign-in.

### 6. Check

Open **https://rh-bookings.primebridge.co.za**. You should see the sign-in page with the padlock.
Sign in, book a test stay, cancel it, and check Admin → Emails.

---

## Every update after that

1. **On your PC:** test with `npm run dev`, then commit and push.
2. **On the server** (PowerShell as Administrator):
   ```powershell
   powershell -ExecutionPolicy Bypass -File \\tsclient\C\Dev\riverhouse-booking\deploy\update.ps1
   ```
   It backs up the current version (the last 5 are kept in `C:\Apps\_backups`), copies the new one, updates packages,
   restarts the service and checks it. Everyone stays signed in.
3. If the release includes a new `db\00x_*.sql`, run it on 10.10.1.2 in Workbench.

**Roll back:** copy the newest folder from `C:\Apps\_backups` over `C:\Apps\riverhouse-booking`, then
`C:\Tools\nssm\nssm.exe restart Riverhouse`.

## Day-to-day

| Task | Command (server, admin PowerShell) |
|------|-----------------------------------|
| Status | `Get-Service Riverhouse` |
| Restart | `C:\Tools\nssm\nssm.exe restart Riverhouse` |
| Logs | `Get-Content C:\Apps\riverhouse-booking\logs\riverhouse.log -Tail 50` (errors: `riverhouse-error.log`) |
| Change settings | edit `C:\Apps\riverhouse-booking\.env`, then restart |

## Notes

* The app listens only on `127.0.0.1:3000`; nothing outside the server can reach it except through IIS.
* Cookies are HTTPS-only in production, so opening `http://10.10.1.2:3000` directly won't keep you signed in. Always use the https address.
* The service runs as the low-privilege `LocalService` account.
* `.env` on the server is never overwritten by `update.ps1`, and never goes to GitHub.
