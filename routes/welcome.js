// Step 2 of sign-up: "Add your family" - the name, initials and colour shown on the calendar.
import express from "express";
import * as repo from "../lib/repo.js";
import { PALETTE, isHex, textColourFor, nextFreeColour } from "../lib/palette.js";

const router = express.Router();

function render(res, { values, error = null, status = 200 }) {
  res.status(status).render("welcome", { title: "Add your family", values, error, palette: PALETTE });
}

router.get("/", async (req, res, next) => {
  try {
    if (req.session.user.profileComplete) return res.redirect("/");
    const used = await repo.usedColours();
    render(res, { values: { displayName: "", initials: "", colour: nextFreeColour(used, used.length).bg } });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.session.user.profileComplete) return res.redirect("/");
    const values = {
      displayName: String(req.body.displayName || "").trim().slice(0, 100),
      initials: String(req.body.initials || "").trim().toUpperCase().slice(0, 3),
      colour: isHex(req.body.colour) ? req.body.colour.toUpperCase() : "",
    };
    let error = null;
    if (!values.displayName) error = "Enter your family's name as it should appear on the calendar.";
    else if (!/^[A-Z0-9]{1,3}$/.test(values.initials)) error = "Use 1 to 3 letters or numbers for your initials.";
    else if (!values.colour) error = "Choose a colour for your stays.";
    if (error) return render(res, { values, error, status: 400 });

    await repo.completeProfile(req.session.user.id, { ...values, textColour: textColourFor(values.colour) });
    req.flash("success", `Welcome, ${values.displayName}. The calendar is yours – choose a free day to book your first stay.`);
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});

export default router;
