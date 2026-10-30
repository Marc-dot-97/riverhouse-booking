# Database scripts (MySQL 8)

Run these **in order**, connected to the MySQL server as **root** (or another admin account).

| # | File | What it does |
|---|------|--------------|
| 1 | `001_create_database_and_user.sql` | Creates the `riverhouse_booking` database and the `riverhouse_app` login the website uses. **Edit the password placeholder first.** |
| 2 | `002_tables.sql` | Creates the `users`, `bookings` and `booking_lock` tables. |
| 4 | `004_signup_and_readonly.sql` | Sign-up + read-only: adds `IsReadOnly` and `ProfileComplete` to `users`, and the `readonly_emails` list (Andromeda@ and Nasreen@optimumgroup.co.za). |
| 5 | `005_sessions.sql` | Sign-in sessions in the database. Required on PROD; optional on Dev (only used there if `.env` has `SESSION_STORE=mysql`). |
| 3 | `003_admin_and_email.sql` | Admin page + email: adds `MustChangePassword` and `EmailNotifications` to `users`, and the `email_log` and `app_settings` tables. |

All scripts are safe to re-run. You need **MySQL 8.0.16 or newer** (`SELECT VERSION();`).

**MySQL Workbench:** File → Open SQL Script → pick the file → press the lightning bolt
(**Execute all**, `Ctrl+Shift+Enter`). Then do the same for the next file.

**mysql command line** (PowerShell, in `C:\Dev\riverhouse-booking`):

```powershell
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/001_create_database_and_user.sql"
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/002_tables.sql"
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/003_admin_and_email.sql"
mysql -h 10.10.1.4 -P 3306 -u root -p -e "source db/004_signup_and_readonly.sql"
```

(PowerShell doesn't support `mysql ... < file.sql`, so use `-e "source ..."` as shown.)

For PROD later: run the same two scripts on the PROD MySQL server with a **different**
strong password, and put that password only in the PROD `.env`.
