/* ==========================================================
   reservation.js – Reservierungsanfrage (Restaurant)
   Prüft Eingaben im Browser (nur für schnelles Feedback) und sendet
   sie an POST /api/restaurant-requests. Die echte Prüfung passiert im
   Backend (Phase 4). Erfolg wird nur gemeldet, wenn der Server
   die Anfrage tatsächlich bestätigt (HTTP 201).
   ========================================================== */
import { t } from "./i18n/i18n.js";

const API_URL = "/api/restaurant-requests";

/** Heutiges Datum in Athen als YYYY-MM-DD (Zeitzone Europe/Athens). */
function todayInAthens() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
}

export function initReservation() {
  const form = document.querySelector("[data-reservation]");
  if (!form) return;

  const status = form.querySelector(".form-status");
  const submit = form.querySelector('button[type="submit"]');
  const dateInput = form.elements.date;
  const updateDateLanguage = () => { dateInput.lang = document.documentElement.lang || "en"; };
  updateDateLanguage();
  dateInput.min = todayInAthens();

  // Regeln: Feldname -> [Prüffunktion, Fehlerschlüssel]
  const rules = {
    name: [(v) => v.trim().length >= 2, "res.err.name"],
    email: [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), "res.err.email"],
    date: [(v) => v >= todayInAthens(), "res.err.date"],
    time: [(v) => v !== "", "res.err.time"],
    guests: [(v) => Number(v) >= 1 && Number(v) <= 12, "res.err.guests"],
  };

  function validate() {
    let valid = true;
    for (const [field, [check, errorKey]] of Object.entries(rules)) {
      const input = form.elements[field];
      const ok = check(input.value);
      input.setAttribute("aria-invalid", String(!ok));
      form.querySelector(`[data-error-for="${field}"]`).textContent = ok ? "" : t(errorKey);
      if (!ok) valid = false;
    }
    return valid;
  }

  // Fehlertexte beim Sprachwechsel aktualisieren
  document.addEventListener("languagechange", () => {
    updateDateLanguage();
    if (form.querySelector('[aria-invalid="true"]')) validate();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "form-status";
    if (!validate()) {
      status.textContent = t("res.fix");
      status.classList.add("is-error");
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submit.disabled = true;
    status.textContent = t("res.sending");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), language: document.documentElement.lang }),
      });
      if (response.status !== 201) throw new Error("HTTP " + response.status);
      status.textContent = t("res.ok");
      status.classList.add("is-ok");
      form.reset();
    } catch (error) {
      // Kein Erfolg melden, wenn der Server die Anfrage nicht gespeichert hat
      status.textContent = t("res.err.server");
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  });
}
