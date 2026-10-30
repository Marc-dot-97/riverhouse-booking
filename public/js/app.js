// Riverhouse – small progressive enhancements.
// Everything still works without JavaScript; this file adds feedback and motion.

// ---------- Install as an app (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker not registered:", err));
  });
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Install the app (PWA) ----------
// Chrome / Edge / Android offer an install prompt; we show our own "Install the app" button for it.
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  document.querySelectorAll("[data-install]:not([data-never])").forEach((b) => { b.hidden = false; });
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  document.querySelectorAll("[data-install]").forEach((b) => { b.hidden = true; });
  if (window.rhToast) window.rhToast("success", "Riverhouse is installed. Open it from your Start menu or home screen.");
});
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-install]");
  if (!btn || !installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  btn.hidden = true;
});

// Device-specific install options
document.addEventListener("DOMContentLoaded", () => {
  const ua = navigator.userAgent;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  document.querySelectorAll("[data-ios-only]").forEach((el) => { el.hidden = !isIOS || standalone; });
  // iPhone/iPad use Safari's "Add to Home Screen" instead of an install button.
  if (isIOS) document.querySelectorAll("[data-install]").forEach((el) => { el.setAttribute("data-never", ""); el.hidden = true; });
  // The APK button is for Android phones that aren't already in the app.
  document.querySelectorAll("[data-android-only]").forEach((el) => { el.hidden = !/Android/.test(ua) || standalone; });
});

// ---------- Show and hide: reveal content once, bottom-to-top ----------
// This class is what lets motion.css hide content until it animates in.
// It is set here (not in the page), so a stale or blocked script can never hide anything.
document.documentElement.classList.add("reveal-on");

function setUpReveal() {
  const items = $$("[data-reveal]");
  const showAll = () => items.forEach((el) => el.classList.add("is-revealed"));
  if (!("IntersectionObserver" in window)) return showAll();
  // Items already on screen get a gentle stagger in reading order.
  let order = 0;
  const onScreen = (el) => el.getBoundingClientRect().top < window.innerHeight;
  items.forEach((el) => {
    if (onScreen(el) && !el.style.getPropertyValue("--i")) el.style.setProperty("--i", order++);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      io.unobserve(entry.target); // animate once only
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
  items.forEach((el) => io.observe(el));
  // Safety net: anything on screen that still hasn't appeared after 1.2s is shown anyway.
  setTimeout(() => items.forEach((el) => { if (onScreen(el)) el.classList.add("is-revealed"); }), 1200);
}

// ---------- Notifications: toasts ----------
function dismissToast(toast) {
  if (!toast || toast.classList.contains("is-leaving")) return;
  toast.classList.add("is-leaving");
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}

function wireToast(toast) {
  $(".toast__close", toast)?.addEventListener("click", () => dismissToast(toast));
  const life = Number(toast.dataset.autohide);
  const timer = $(".toast__timer", toast);
  if (life && timer) {
    toast.style.setProperty("--toast-life", `${life}ms`);
    // The progress bar pauses while you hover or focus the toast; when it runs out, the toast leaves.
    timer.addEventListener("animationend", () => dismissToast(toast), { once: true });
  }
}

/** Show a toast from JavaScript, e.g. rhToast("success", "Copied"). */
window.rhToast = (type, text, life = 3500) => {
  const holder = $(".toasts");
  if (!holder) return;
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.setAttribute("role", type === "error" ? "alert" : "status");
  if (type !== "error") t.dataset.autohide = String(life);
  t.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${type === "error"
      ? '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 5v5M9 12.6v.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path class="toast__tick" d="M4.5 9.3l3 3 6-6.3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</span>
    <p class="toast__text"></p>
    <button class="toast__close" type="button" aria-label="Dismiss message"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    ${type !== "error" ? '<span class="toast__timer" aria-hidden="true"></span>' : ""}`;
  $(".toast__text", t).textContent = text;
  holder.appendChild(t);
  wireToast(t);
};

// ---------- Feedback: buttons show that something is happening ----------
function setUpLoadingButtons() {
  document.addEventListener("submit", (e) => {
    if (e.defaultPrevented) return;
    const btn = e.submitter || $("button[type=submit]", e.target);
    if (!btn || !btn.classList.contains("btn")) return;
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    if (btn.dataset.loadingText) {
      btn.dataset.originalText = btn.textContent.trim();
      btn.textContent = btn.dataset.loadingText;
    }
  });
  // Coming back with the browser's Back button restores the buttons.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    $$(".btn.is-loading").forEach((btn) => {
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    });
  });
}

// ---------- Superimposing: confirm dialog (cancel a stay) ----------
function setUpConfirmDialog() {
  const dialog = $("#confirmDialog");
  if (!dialog || typeof dialog.showModal !== "function") return; // falls back to the inline "Yes, cancel"
  let pendingForm = null;

  const close = () => {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    dialog.classList.add("is-closing");
    dialog.addEventListener("animationend", () => {
      dialog.classList.remove("is-closing");
      dialog.close();
    }, { once: true });
  };

  $$("details.confirm[data-confirm-title]").forEach((details) => {
    const summary = $("summary", details);
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      pendingForm = $("form", details);
      $("#confirmTitle").textContent = details.dataset.confirmTitle;
      $("#confirmText").textContent = details.dataset.confirmText || "";
      dialog.showModal();
      $("[data-close]", dialog).focus();
    });
  });

  $("#confirmGo").addEventListener("click", () => {
    const form = pendingForm;
    const go = $("#confirmGo");
    go.classList.add("is-loading");
    go.textContent = "Cancelling…";
    if (form) (form.requestSubmit ? form.requestSubmit() : form.submit());
  });
  $("[data-close]", dialog).addEventListener("click", close);
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); }); // Esc key
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); }); // click outside
}

// ---------- Transitions: month to month ----------
function setUpMonthNavigation() {
  const remember = (dir) => { try { sessionStorage.setItem("rh-dir", dir); } catch { /* ignore */ } };
  $$("[data-month-dir]").forEach((link) => {
    link.addEventListener("click", () => {
      const dir = link.dataset.monthDir;
      if (dir === "forward" || dir === "back") remember(dir);
    });
  });
  // Keyboard: ← and → change month (not while typing or in a dialog).
  const back = $('[data-month-dir="back"]');
  const forward = $('[data-month-dir="forward"]');
  if (!back || !forward) return;
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest("input, textarea, select, dialog[open]")) return;
    if (e.key === "ArrowLeft") { remember("back"); window.location.href = back.href; }
    if (e.key === "ArrowRight") { remember("forward"); window.location.href = forward.href; }
  });
}

// ---------- Highlight: bring the stay you just saved into view ----------
function setUpHighlight() {
  const el = $("#highlighted");
  if (!el) return;
  setTimeout(() => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 700);
}

document.addEventListener("DOMContentLoaded", () => {
  setUpReveal();
  $$(".toast").forEach(wireToast);
  setUpLoadingButtons();
  setUpConfirmDialog();
  setUpMonthNavigation();
  setUpHighlight();

  // Copy buttons (Outlook link, temporary password)
  const copy = async (btn, value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const tmp = document.createElement("textarea");
      tmp.value = value; document.body.appendChild(tmp); tmp.select();
      document.execCommand("copy"); tmp.remove();
    }
    const old = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.remove("is-copied"); void btn.offsetWidth; btn.classList.add("is-copied");
    setTimeout(() => { btn.textContent = old; }, 1800);
    window.rhToast("success", btn.dataset.copyMessage || "Copied to your clipboard.");
  };
  $$("[data-copy]").forEach((btn) => btn.addEventListener("click", () => {
    const field = $(btn.dataset.copy);
    if (field) copy(btn, field.value);
  }));
  $$("[data-copy-text]").forEach((btn) => btn.addEventListener("click", () => {
    const el = $(btn.dataset.copyText);
    if (el) copy(btn, el.textContent.trim());
  }));

  // Admin colour picker: the "own colour" chip updates its radio button
  $$("input[type=color][data-sync]").forEach((picker) => {
    const radio = $(picker.dataset.sync);
    const chip = picker.parentElement;
    const apply = () => { radio.value = picker.value; radio.checked = true; chip.style.background = picker.value; };
    picker.addEventListener("input", apply);
    if (radio.checked) chip.style.background = picker.value;
  });

  // "Add your family": live preview of the calendar bar
  const bar = $("[data-preview-bar]");
  if (bar) {
    const nameIn = $("#displayName");
    const initIn = $("#initials");
    const sync = () => {
      const picked = $('input[name="colour"]:checked');
      const chip = picked && picked.nextElementSibling;
      if (chip) { bar.style.background = picked.value; bar.style.color = getComputedStyle(chip).color; }
      $("[data-preview-name]", bar).textContent = nameIn.value.trim() || "Your family";
      const init = (initIn.value.trim() || "AB").toUpperCase().slice(0, 3);
      $$("[data-chip-text]").forEach((c) => { c.textContent = init; });
    };
    // Suggest initials from the family name until you type your own.
    let ownInitials = !!initIn.value;
    initIn.addEventListener("input", () => { ownInitials = true; sync(); });
    nameIn.addEventListener("input", () => {
      if (!ownInitials) initIn.value = nameIn.value.replace(/\bfamily\b/i, "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
      sync();
    });
    $$('input[name="colour"]').forEach((r) => r.addEventListener("change", sync));
    sync();
  }

  // Booking form: keep "Leave" after "Arrive" and show the number of nights
  const checkIn = $("#checkIn");
  const checkOut = $("#checkOut");
  const nights = $("#nights");
  if (checkIn && checkOut && nights) {
    const DAY = 86400000;
    const parse = (v) => (v ? Date.parse(`${v}T00:00:00Z`) : NaN);
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const update = (animate) => {
      const a = parse(checkIn.value);
      const b = parse(checkOut.value);
      if (!Number.isNaN(a)) {
        checkOut.min = iso(a + DAY);
        if (Number.isNaN(b) || b <= a) checkOut.value = iso(a + DAY);
      }
      const n = Math.round((parse(checkOut.value) - parse(checkIn.value)) / DAY);
      const text = n > 0 ? `${n} night${n === 1 ? "" : "s"} at the house` : "";
      if (text !== nights.textContent) {
        nights.textContent = text;
        if (animate) { nights.classList.remove("is-updated"); void nights.offsetWidth; nights.classList.add("is-updated"); }
      }
    };
    checkIn.addEventListener("change", () => update(true));
    checkOut.addEventListener("change", () => update(true));
    update(false);
  }
});
