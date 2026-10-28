// Shared rules for the "Book a stay" and "Change your stay" forms.
import { parseISO, nightsBetween } from "./dates.js";

export const MAX_NIGHTS = 60;

/** Reads the form fields into a plain object (always strings/numbers, never undefined). */
export function readStayForm(body) {
  return {
    checkIn: String(body.checkIn || ""),
    checkOut: String(body.checkOut || ""),
    guests: Number.parseInt(body.guests, 10),
    note: String(body.note || "").trim().slice(0, 500),
  };
}

/**
 * Checks the dates and guests. Returns { error } or { checkIn, checkOut } as dates.
 * lockedCheckIn: for a stay that has already started, the arrival day can't be changed.
 */
export function validateStay(values, today, { lockedCheckIn = null } = {}) {
  const checkIn = parseISO(values.checkIn);
  const checkOut = parseISO(values.checkOut);

  if (!checkIn || !checkOut) return { error: "Choose both an arrival and a departure date." };
  if (lockedCheckIn && values.checkIn !== lockedCheckIn) {
    return { error: "Your stay has already begun, so the arrival date stays as it is. You can still move your departure." };
  }
  if (!lockedCheckIn && values.checkIn < today) return { error: "Choose an arrival date from today onwards." };
  if (checkOut <= checkIn) return { error: "Choose a departure date after your arrival." };
  if (values.checkOut <= today) return { error: "Choose a departure date after today." };
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return { error: `A stay can be up to ${MAX_NIGHTS} nights. For longer, book it as two stays.` };
  if (!Number.isInteger(values.guests) || values.guests < 1 || values.guests > 30) {
    return { error: "Enter between 1 and 30 guests." };
  }
  return { checkIn, checkOut };
}
