// Riverhouse booking - shared house calendar
// Start in dev:  npm run dev   (then open http://localhost:3000)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";

import { requireLogin, requireAdmin, requireWriter, csrf, flash } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import calendarRoutes from "./routes/calendar.js";
import bookingRoutes from "./routes/bookings.js";
import accountRoutes from "./routes/account.js";
import icsRoutes from "./routes/ics.js";
import adminRoutes from "./routes/admin.js";
import welcomeRoutes from "./routes/welcome.js";

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

// Android app (Trusted Web Activity): proves the APK and this website belong together.
// Values come from .env once the APK is signed - see android/README.md.
app.get("/.well-known/assetlinks.json", (req, res) => {
  const pkg = process.env.ANDROID_PACKAGE_NAME || "za.co.primebridge.rhbookings";
  const prints = (process.env.ANDROID_CERT_SHA256 || "").split(",").map((p) => p.trim()).filter(Boolean);
  res.json(prints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints },
  }] : []);
});

// "Get the Android app" button appears once public/downloads/riverhouse.apk exists.
const apkFile = path.join(__dirname, "public", "downloads", "riverhouse.apk");
app.use((req, res, next) => {
  res.locals.androidApk = fs.existsSync(apkFile) ? "/downloads/riverhouse.apk" : null;
  next();
});

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: isProd ? "1d" : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".apk")) {
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", 'attachment; filename="riverhouse.apk"');
    }
    if (filePath.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
  },
}));
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
app.use("/welcome", requireLogin, welcomeRoutes);
app.use("/bookings", requireLogin, requireWriter, bookingRoutes);
app.use("/account", requireLogin, accountRoutes);
app.use("/admin", requireLogin, requireAdmin, adminRoutes);
app.use("/", requireLogin, calendarRoutes);

app.use((req, res) => {
  res.status(404).render("error", { title: "Page not found", message: "This page doesn't exist – it may have moved. The calendar is one click away." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const dbDown = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|PROTOCOL_CONNECTION_LOST|ER_ACCESS_DENIED_ERROR|ER_BAD_DB_ERROR|ER_NO_SUCH_TABLE/i
    .test(`${err.code} ${err.message}`);
  res.status(500).render("error", {
    title: dbDown ? "The calendar is resting" : "Something didn't go to plan",
    message: dbDown
      ? "We can't reach the booking database right now. Please try again in a moment – your bookings are safe."
      : "Please try again. If it keeps happening, let your house administrator know.",
  });
});

app.listen(port, () => {
  console.log(`Riverhouse booking running on http://localhost:${port}`);
});
