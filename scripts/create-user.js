// Adds an owner (family) who can sign in and book.
// Run in the VS Code terminal:  npm run create-user
import "dotenv/config";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import * as repo from "../lib/repo.js";
import { getPool } from "../lib/db.js";

// Calendar colours (background, text) - taken from the site's palette.
const PALETTE = [
  ["#212934", "#FFFFFF"], ["#CCAB76", "#212934"], ["#4E6B57", "#FFFFFF"], ["#9A5238", "#FFFFFF"],
  ["#A9BDD0", "#212934"], ["#7A5A2F", "#FFFFFF"], ["#5B6E8C", "#FFFFFF"], ["#D9C3A5", "#212934"],
];

// Works both when you type the answers and when they're piped in.
const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) });
const lines = rl[Symbol.asyncIterator]();
async function ask(question) {
  output.write(question);
  const { value, done } = await lines.next();
  if (done) throw new Error("Input ended before all questions were answered.");
  if (!input.isTTY) output.write("\n");
  return value;
}

try {
  console.log("\nAdd a new owner to Riverhouse\n");
  const email = (await ask("Email address: ")).trim().toLowerCase();
  const displayName = (await ask('Name shown on the calendar (e.g. "Botha family"): ')).trim();
  const suggested = displayName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  const initials = ((await ask(`Initials for the calendar bar [${suggested}]: `)).trim() || suggested).toUpperCase().slice(0, 3);
  const password = await ask("Temporary password (min 10 characters - they can change it under My account): ");
  const isAdmin = /^y/i.test(await ask("Make this person an admin? (y/N): "));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email address doesn't look right.");
  if (!displayName) throw new Error("A name is required.");
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  if (await repo.findUserByEmail(email)) throw new Error("A user with that email already exists.");

  const { n } = await repo.countUsers();
  const [colour, textColour] = PALETTE[n % PALETTE.length];
  const userId = await repo.createUser({
    email, displayName, initials, colour, textColour,
    passwordHash: await bcrypt.hash(password, 12), isAdmin,
  });
  console.log(`\n✔ Created ${displayName} (${email}) as user #${userId}${isAdmin ? " - admin" : ""}. Colour ${colour}.\n`);
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
  await getPool().end().catch(() => {});
}
