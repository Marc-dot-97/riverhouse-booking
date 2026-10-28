// Riverhouse booking - shared house calendar
// Start in dev:  npm run dev   (then open http://localhost:3000)
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";

import { requireLogin, requireAdmin, csrf, flash } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import calendarRoutes from "./routes/calendar.js";
import bookingRoutes from "./routes/bookings.js";
import accountRoutes from "./routes/account.js";
import icsRoutes from "./routes/ics.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change-me") {
  if (isProd) throw new Error("Set SESSION_SECRET in .env before running in production.");
  console.warn("⚠  SESSION_SECRET is not set - using a temporary one (fine for local dev only).");
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
if (isProd) app.set("trust proxy", 1); // behind IIS / a reverse proxy

// Basic security headers
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
  });
  next();
});

app.use((req, res, next) => {
  res.locals.houseName = process.env.HOUSE_NAME || "Riverhouse";
  res.locals.title = "";
  res.locals.active = "";
  res.locals.flash = null;
  next();
});

app.use(express.static(path.join(__dirname, "public"), { maxAge: isProd ? "1d" : 0 }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Outlook calendar feed: no login, no session needed
app.use("/ics", icsRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(session({
  name: "rh.sid",
  secret: process.env.SESSION_SECRET || "dev-only-" + Math.random().toString(36).slice(2),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 30, // stay signed in for 30 days
  },
}));

app.use(flash);
app.use(csrf);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use(authRoutes);
app.use("/bookings", requireLogin, bookingRoutes);
app.use("/account", requireLogin, accountRoutes);
app.use("/admin", requireLogin, requireAdmin, adminRoutes);
app.use("/", requireLogin, calendarRoutes);

app.use((req, res) => {
  res.status(404).render("error", { title: "Not found", message: "We couldn't find that page." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const dbDown = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|PROTOCOL_CONNECTION_LOST|ER_ACCESS_DENIED_ERROR|ER_BAD_DB_ERROR|ER_NO_SUCH_TABLE/i
    .test(`${err.code} ${err.message}`);
  res.status(500).render("error", {
    title: dbDown ? "Can't reach the database" : "Something went wrong",
    message: dbDown
      ? "The booking database isn't reachable right now. Check the DB_ settings in .env and that you can reach the MySQL server."
      : "Please try again. If it keeps happening, let the administrator know.",
  });
});

app.listen(port, () => {
  console.log(`Riverhouse booking running on http://localhost:${port}`);
});
