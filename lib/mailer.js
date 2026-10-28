// Sends email from the house mailbox (Leopardcreek@outlook.com by default).
//
// MAIL_MODE in .env decides how:
//   log    - don't send; write the email to the terminal + email_log (default, safe for dev)
//   graph  - RECOMMENDED for Outlook.com: send through Microsoft Graph with a Microsoft sign-in
//            (permission "Mail.Send"). Set MS_CLIENT_ID, then run "npm run mail-signin" once.
//   oauth2 - send through Outlook.com SMTP with a Microsoft sign-in (permission "SMTP.Send")
//   smtp   - send with an SMTP username + password (or app password)
import nodemailer from "nodemailer";
import * as repo from "./repo.js";

export const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.Send offline_access";
export const SMTP_SCOPE = "https://outlook.office.com/SMTP.Send offline_access";

export const mailMode = () => (process.env.MAIL_MODE || "log").toLowerCase();
const mailUser = () => process.env.SMTP_USER || "Leopardcreek@outlook.com";
const mailFrom = () => process.env.MAIL_FROM || `"${process.env.HOUSE_NAME || "Riverhouse"}" <${mailUser()}>`;

/** Which Microsoft sign-in a mode uses ("log" and "graph" both use the Graph one). */
export function signInFor(mode = mailMode()) {
  return mode === "oauth2"
    ? { scope: SMTP_SCOPE, key: "mail.refreshToken.smtp", label: "SMTP.Send" }
    : { scope: GRAPH_SCOPE, key: "mail.refreshToken.graph", label: "Mail.Send" };
}

export function tokenUrl() {
  return `https://login.microsoftonline.com/${process.env.MS_TENANT || "consumers"}/oauth2/v2.0/token`;
}

const cache = {}; // key -> { accessToken, expiresAt }

/** Swaps the saved refresh token for a short-lived access token (and saves the new refresh token). */
async function accessToken(mode) {
  const { scope, key } = signInFor(mode);
  const hit = cache[key];
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.accessToken;
  if (!process.env.MS_CLIENT_ID) throw new Error("MS_CLIENT_ID is not set in .env");
  const refreshToken = await repo.getSetting(key);
  if (!refreshToken) throw new Error("The Outlook mailbox isn't signed in yet - run: npm run mail-signin");

  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.MS_CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken, scope }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Outlook sign-in has expired or was revoked (${data.error}). Run: npm run mail-signin`);
  if (data.refresh_token && data.refresh_token !== refreshToken) await repo.setSetting(key, data.refresh_token); // Microsoft rotates these
  cache[key] = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function saveRefreshToken(mode, token) {
  await repo.setSetting(signInFor(mode).key, token);
  delete cache[signInFor(mode).key];
}

// ---------- Senders ----------

/** Microsoft Graph: POST /me/sendMail as the signed-in mailbox. */
async function graphSender() {
  const token = await accessToken("graph");
  return async (m) => {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: m.subject,
          body: { contentType: "HTML", content: m.html },
          toRecipients: [{ emailAddress: { address: m.to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (res.status !== 202) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`Graph ${res.status}: ${data.error?.message || data.error?.code || res.statusText}`);
    }
  };
}

/** SMTP (password or OAuth2). */
async function smtpSender(mode) {
  const port = Number(process.env.SMTP_PORT || 587);
  const base = {
    host: process.env.SMTP_HOST || "smtp-mail.outlook.com",
    port,
    secure: port === 465,
    requireTLS: port !== 465 && process.env.SMTP_REQUIRE_TLS !== "false",
  };
  const auth = mode === "oauth2"
    ? { type: "OAuth2", user: mailUser(), accessToken: await accessToken("oauth2") }
    : (process.env.SMTP_PASSWORD ? { user: mailUser(), pass: process.env.SMTP_PASSWORD } : undefined);
  const transport = nodemailer.createTransport({ ...base, auth });
  const send = (m) => transport.sendMail({ from: mailFrom(), to: m.to, subject: m.subject, html: m.html, text: m.text });
  send.close = () => transport.close();
  return send;
}

/**
 * Sends a batch of emails one by one and records each in email_log.
 * Never throws - a mail problem must never break a booking.
 * messages: [{ to, subject, html, text, kind, bookingId }]
 */
export async function sendEmails(messages) {
  if (!messages.length) return { sent: 0, failed: 0 };
  const mode = mailMode();
  let send = null;
  let setupError = null;

  if (mode !== "log") {
    try { send = mode === "graph" ? await graphSender() : await smtpSender(mode); } catch (err) { setupError = err; }
  }

  let sent = 0;
  let failed = 0;
  for (const m of messages) {
    let status = "Sent";
    let error = null;
    try {
      if (mode === "log") {
        status = "Logged";
        console.log(`\n✉  [MAIL_MODE=log] To: ${m.to}\n   Subject: ${m.subject}\n   ${m.text.replace(/\n/g, "\n   ")}\n`);
      } else {
        if (setupError) throw setupError;
        await send(m);
      }
      sent += 1;
    } catch (err) {
      status = "Failed";
      error = err.message;
      failed += 1;
      console.error(`✖ Email to ${m.to} failed: ${err.message}`);
    }
    await repo.logEmail({ toEmail: m.to, subject: m.subject, kind: m.kind, status, error, bookingId: m.bookingId || null })
      .catch((e) => console.error("Could not write email_log:", e.message));
  }
  send?.close?.();
  return { sent, failed };
}
