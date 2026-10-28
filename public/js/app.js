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
