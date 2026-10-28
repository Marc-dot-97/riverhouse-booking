// Builds an iCalendar (.ics) feed that Outlook, Google and Apple calendars can subscribe to.
import { toISO } from "./dates.js";

function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function fold(line) {
  const out = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > 74) {
      out.push(current);
      current = " " + ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

const icsDate = (date) => toISO(date).replace(/-/g, "");
const icsStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs({ houseName, bookings, host }) {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Riverhouse//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(houseName)} bookings`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const b of bookings) {
    const guests = b.Guests ? `${b.Guests} guest${b.Guests === 1 ? "" : "s"}` : "";
    const description = [guests, b.Note].filter(Boolean).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${b.BookingId}@${host}`,
      `DTSTAMP:${icsStamp(now)}`,
      `LAST-MODIFIED:${icsStamp(b.UpdatedAt || b.CreatedAt || now)}`,
      `DTSTART;VALUE=DATE:${icsDate(b.CheckIn)}`,
      `DTEND;VALUE=DATE:${icsDate(b.CheckOut)}`, // all-day end is exclusive = departure day
      `SUMMARY:${escapeText(`${b.DisplayName} at ${houseName}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "TRANSP:TRANSPARENT", // don't block the subscriber's own free/busy time
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
