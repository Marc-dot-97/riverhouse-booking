// One-time sign-in so the app can send email as the house Outlook.com mailbox
// (MAIL_MODE=graph, or oauth2). No password is stored - Microsoft gives the app a token instead.
// Run:  npm run mail-signin     (needs MS_CLIENT_ID in .env - see README "Email")
import "dotenv/config";
import { signInFor, mailMode, tokenUrl, saveRefreshToken } from "../lib/mailer.js";
import { getPool } from "../lib/db.js";

const clientId = process.env.MS_CLIENT_ID;
const tenant = process.env.MS_TENANT || "consumers";
const mailbox = process.env.SMTP_USER || "Leopardcreek@outlook.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = mailMode() === "oauth2" ? "oauth2" : "graph";
const { scope, label } = signInFor(mode);

try {
  if (!clientId) throw new Error("Set MS_CLIENT_ID in .env first (the Application (client) ID from the app registration).");

  const start = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope }),
  }).then((r) => r.json());
  if (start.error) throw new Error(`${start.error}: ${start.error_description}`);

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(` 1. Open   ${start.verification_uri}`);
  console.log(` 2. Enter  ${start.user_code}`);
  console.log(` 3. Sign in as  ${mailbox}  and accept (permission: ${label}).`);
  console.log("────────────────────────────────────────────────────────────\n");
  console.log("Waiting for you to finish signing in...");

  let interval = (start.interval || 5) * 1000;
  const deadline = Date.now() + start.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    const res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: clientId,
        device_code: start.device_code,
      }),
    });
    const data = await res.json();
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") { interval += 5000; continue; }
    if (data.error) throw new Error(`${data.error}: ${data.error_description}`);
    if (!data.refresh_token) throw new Error("Microsoft didn't return a refresh token (is offline_access allowed?).");
    await saveRefreshToken(mode, data.refresh_token);
    console.log(`\n✔ Signed in. The app can now send email as ${mailbox} (mode: ${mode}).`);
    if (mailMode() === "log") console.log("  Now set MAIL_MODE=graph in .env and restart npm run dev.");
    console.log("  Check it with:  npm run test-email -- your@email.address\n");
    break;
  }
  if (Date.now() >= deadline) throw new Error("The sign-in code expired. Run npm run mail-signin again.");
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
