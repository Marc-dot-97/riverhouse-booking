// Builds and sends the emails: booked / changed / cancelled, plus welcome and password reset.
import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import * as repo from "./repo.js";
import { sendEmails } from "./mailer.js";
import { formatRange, nightsBetween, toISO } from "./dates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, "..", "views", "email", "message.ejs");

const houseName = () => process.env.HOUSE_NAME || "Riverhouse";
const baseUrl = () => (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const NOTIFY_FOOTER = "You get these emails because you're an owner of the shared house. "
  + "You can switch them off under My account.";

/** Renders the HTML + plain-text versions of one email. */
async function build({ to, subject, kind, bookingId, greetingName, heading, lines, details = [], buttonText, buttonUrl, footer }) {
  const html = await ejs.renderFile(TEMPLATE, {
    subject, houseName: houseName(), greetingName, heading, lines, details, buttonText, buttonUrl, footer,
  });
  const text = [
    `Hi ${greetingName},`, "", heading, "",
    ...lines.flatMap((l) => [l, ""]),
    ...details.map((d) => `${d[0]}: ${d[1]}`),
    details.length ? "" : null,
    buttonUrl ? `${buttonText}: ${buttonUrl}` : null,
    "", "--", footer,
  ].filter((l) => l !== null).join("\n");
  return { to, subject, kind, bookingId, html, text };
}

function stayDetails(b) {
  const nights = nightsBetween(b.CheckIn, b.CheckOut);
  const rows = [
    ["Who", b.DisplayName],
    ["Dates", formatRange(b.CheckIn, b.CheckOut)],
    ["Nights", String(nights)],
    ["Guests", String(b.Guests)],
  ];
  if (b.Note) rows.push(["Note", b.Note]);
  return rows;
}

/**
 * Emails every family that wants notifications about a stay.
 * type: "booked" | "changed" | "cancelled"
 * booking: the stay as it is now (for "changed": after the change)
 * before: { CheckIn, CheckOut } for "changed"
 * actor: the signed-in person who did it ({ id, name })
 */
export async function notifyStay({ type, booking, before = null, actor }) {
  const recipients = await repo.emailRecipients();
  const range = formatRange(booking.CheckIn, booking.CheckOut);
  const nights = plural(nightsBetween(booking.CheckIn, booking.CheckOut), "night");
  const who = booking.DisplayName;
  const byAdmin = actor && actor.id !== booking.UserId ? ` (by ${actor.name})` : "";

  const subjects = {
    booked: `${houseName()}: ${who} booked ${range}`,
    changed: `${houseName()}: ${who} changed their stay to ${range}`,
    cancelled: `${houseName()}: ${who} cancelled ${range}`,
  };
  const calendarUrl = `${baseUrl()}/?m=${toISO(booking.CheckIn).slice(0, 7)}`;

  const messages = await Promise.all(recipients.map((r) => {
    const mine = r.UserId === booking.UserId;
    const headings = {
      booked: mine ? `Your stay is booked: ${range}` : `${who} will be at the house ${range}`,
      changed: mine ? `Your stay is now ${range}` : `${who} changed their stay to ${range}`,
      cancelled: mine ? `Your stay on ${range} is cancelled` : `${who} cancelled their stay`,
    };
    // Built only for the type being sent ("before" only exists for changes).
    const lines = {
      booked: () => [mine
        ? `You're booked for ${nights}${byAdmin}. Everyone else can now see your stay on the calendar.`
        : `${who} booked the house for ${nights}${byAdmin}. Those dates are no longer available.`],
      changed: () => [`It was ${formatRange(before.CheckIn, before.CheckOut)}; it is now ${range} (${nights})${byAdmin}.`,
        "Any nights it no longer covers are open for booking again."],
      cancelled: () => [`The stay on ${range} (${nights}) was cancelled${byAdmin}. Those dates are open for booking again.`],
    };
    return build({
      to: r.Email,
      subject: subjects[type],
      kind: type,
      bookingId: booking.BookingId,
      greetingName: r.DisplayName,
      heading: headings[type],
      lines: lines[type](),
      details: type === "cancelled" ? [] : stayDetails(booking),
      buttonText: "Open the calendar",
      buttonUrl: calendarUrl,
      footer: NOTIFY_FOOTER,
    });
  }));
  return sendEmails(messages);
}

/** Login details for a new family, or a new temporary password after a reset. */
export async function sendLoginDetails({ user, tempPassword, kind }) {
  const welcome = kind === "welcome";
  const message = await build({
    to: user.Email,
    subject: welcome ? `Your login for the ${houseName()} booking calendar` : `Your new ${houseName()} password`,
    kind,
    greetingName: user.DisplayName,
    heading: welcome ? "You can now book the shared house online" : "Your password has been reset",
    lines: [
      welcome
        ? "The house calendar shows who is going when, and lets you book, change or cancel your stays. Nobody can double-book."
        : "An administrator has reset your password. Use the temporary password below to sign in.",
      "You'll be asked to choose your own password the first time you sign in.",
    ],
    details: [["Email", user.Email], ["Temporary password", tempPassword, true]],
    buttonText: "Sign in",
    buttonUrl: `${baseUrl()}/login`,
    footer: "If you weren't expecting this email, you can ignore it.",
  });
  return sendEmails([message]);
}

export async function sendTestEmail(to) {
  const message = await build({
    to,
    subject: `${houseName()}: test email`,
    kind: "test",
    greetingName: "there",
    heading: "Email is working",
    lines: ["This is a test from the booking calendar. If you can read this, booking emails will arrive too."],
    buttonText: "Open the calendar",
    buttonUrl: baseUrl(),
    footer: "Sent from the admin page.",
  });
  return sendEmails([message]);
}
