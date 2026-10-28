// Creates (or resets) two TEST owners for local/QA testing, with fresh random passwords.
// Run:  npm run seed-test
// The logins are written to .test-users.local.json (git-ignored). Never run this on PROD.
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { getPool } from "../lib/db.js";

if (process.env.NODE_ENV === "production") {
  console.error("✖ Refusing to create test users with NODE_ENV=production.");
  process.exit(1);
}

const TEST_USERS = [
  { email: "owner1@riverhouse.test", displayName: "Test Owner One", initials: "T1", colour: "#212934", textColour: "#FFFFFF", isAdmin: true },
  { email: "owner2@riverhouse.test", displayName: "Test Owner Two", initials: "T2", colour: "#CCAB76", textColour: "#212934", isAdmin: false },
];

const out = [];
try {
  for (const u of TEST_USERS) {
    const password = "Test-" + crypto.randomBytes(9).toString("base64url");
    const hash = await bcrypt.hash(password, 12);
    const existing = await repo.findUserByEmail(u.email);
    if (existing) {
      await repo.updatePasswordHash(existing.UserId, hash);
      console.log(`↻ Reset password for ${u.email}`);
    } else {
      await repo.createUser({ ...u, passwordHash: hash });
      console.log(`✔ Created ${u.email}${u.isAdmin ? " (admin)" : ""}`);
    }
    out.push({ email: u.email, password, isAdmin: u.isAdmin });
  }
  fs.writeFileSync(".test-users.local.json", JSON.stringify(out, null, 2));
  console.log("\nLogins saved to .test-users.local.json (git-ignored).");
} catch (err) {
  console.error("✖", err.code || "", err.message);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
