// Small progressive enhancements. The app works without JavaScript too.

// 1. Install as an app (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker not registered:", err));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // 2. Copy buttons (Outlook link on My account)
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const field = document.querySelector(btn.dataset.copy);
      if (!field) return;
      try {
        await navigator.clipboard.writeText(field.value);
      } catch {
        field.select();
        document.execCommand("copy");
      }
      const old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = old; }, 1800);
    });
  });

  // 2b. Copy plain text (temporary password on the admin page)
  document.querySelectorAll("[data-copy-text]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const el = document.querySelector(btn.dataset.copyText);
      if (!el) return;
      try { await navigator.clipboard.writeText(el.textContent.trim()); } catch { /* ignore */ }
      const old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = old; }, 1800);
    });
  });

  // 2c. Admin colour picker: "own colour" chip updates its radio button
  document.querySelectorAll("input[type=color][data-sync]").forEach((picker) => {
    const radio = document.querySelector(picker.dataset.sync);
    const chip = picker.parentElement;
    const apply = () => {
      radio.value = picker.value;
      radio.checked = true;
      chip.style.background = picker.value;
    };
    picker.addEventListener("input", apply);
    if (radio.checked) chip.style.background = picker.value;
  });

  // 3. Booking form: keep "Leave" after "Arrive" and show the number of nights
  const checkIn = document.getElementById("checkIn");
  const checkOut = document.getElementById("checkOut");
  const nights = document.getElementById("nights");
  if (checkIn && checkOut && nights) {
    const day = 86400000;
    const parse = (v) => (v ? Date.parse(v + "T00:00:00Z") : NaN);
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const update = () => {
      const a = parse(checkIn.value);
      const b = parse(checkOut.value);
      if (!Number.isNaN(a)) {
        checkOut.min = iso(a + day);
        if (Number.isNaN(b) || b <= a) checkOut.value = iso(a + day);
      }
      const n = Math.round((parse(checkOut.value) - parse(checkIn.value)) / day);
      nights.textContent = n > 0 ? `${n} night${n === 1 ? "" : "s"}` : "";
    };
    checkIn.addEventListener("change", update);
    checkOut.addEventListener("change", update);
    update();
  }
});
