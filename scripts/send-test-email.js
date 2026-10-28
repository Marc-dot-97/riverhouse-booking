// Sends one test email (named send-test-email.js so "npm test" does not run it):  npm run test-email -- someone@example.com
import "dotenv/config";
import { sendTestEmail } from "../lib/notify.js";
import { mailMode } from "../lib/mailer.js";
import { getPool } from "../lib/db.js";

const to = process.argv[2];
try {
  if (!to || !to.includes("@")) throw new Error("Usage: npm run test-email -- someone@example.com");
  console.log(`Sending a test email to ${to} (MAIL_MODE=${mailMode()})...`);
  const { sent, failed } = await sendTestEmail(to);
  if (failed) throw new Error("Sending failed - see the error above. The admin page's email log has it too.");
  if (mailMode() === "log") console.log("ℹ MAIL_MODE=log only prints emails. Set MAIL_MODE=graph in .env (after npm run mail-signin) to really send.");
  else console.log(`✔ Sent (${sent}). Check the inbox (and junk folder) of ${to}.`);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
