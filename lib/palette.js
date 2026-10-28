// Calendar colours (background + readable text colour), taken from the site's palette.
export const PALETTE = [
  { bg: "#212934", fg: "#FFFFFF", name: "Navy" },
  { bg: "#CCAB76", fg: "#212934", name: "Gold" },
  { bg: "#4E6B57", fg: "#FFFFFF", name: "Bush green" },
  { bg: "#9A5238", fg: "#FFFFFF", name: "Clay" },
  { bg: "#A9BDD0", fg: "#212934", name: "Sky" },
  { bg: "#7A5A2F", fg: "#FFFFFF", name: "Bronze" },
  { bg: "#5B6E8C", fg: "#FFFFFF", name: "Slate blue" },
  { bg: "#D9C3A5", fg: "#212934", name: "Sand" },
  { bg: "#2F5D62", fg: "#FFFFFF", name: "River teal" },
  { bg: "#8C6E8F", fg: "#FFFFFF", name: "Dusk" },
];

export const isHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(String(v || ""));

/** Navy or white text, whichever reads better on the given background. */
export function textColourFor(bg) {
  const known = PALETTE.find((p) => p.bg.toLowerCase() === String(bg).toLowerCase());
  if (known) return known.fg;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? "#212934" : "#FFFFFF";
}

/** The first palette colour no active family is using yet (or cycle round). */
export function nextFreeColour(usedColours, count) {
  const used = new Set(usedColours.map((c) => c.toLowerCase()));
  return PALETTE.find((p) => !used.has(p.bg.toLowerCase())) || PALETTE[count % PALETTE.length];
}
