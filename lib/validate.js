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

  if (!checkIn || !checkOut) return { error: "Please choose both an arrival and a departure date." };
  if (lockedCheckIn && values.checkIn !== lockedCheckIn) {
    return { error: "This stay has already started, so the arrival date can't change. You can still change the departure date." };
  }
  if (!lockedCheckIn && values.checkIn < today) return { error: "The arrival date can't be in the past." };
  if (checkOut <= checkIn) return { error: "The departure date must be after the arrival date." };
  if (values.checkOut <= today) return { error: "The departure date must be after today." };
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return { error: `A single stay can be at most ${MAX_NIGHTS} nights.` };
  if (!Number.isInteger(values.guests) || values.guests < 1 || values.guests > 30) {
    return { error: "Guests must be between 1 and 30." };
  }
  return { checkIn, checkOut };
}
