/* ==========================================================
   booking.js – Buchungsablauf (booking.html)

   WICHTIG: Der Browser berechnet weder Preise noch Verfügbarkeit.
   Alle Zahlen kommen vom Server:
     GET  /api/availability   -> freie Zimmer, Nächte, Preise
     POST /api/bookings       -> speichert die Buchung (HTTP 201)
   Eine Bestätigung wird nur gezeigt, wenn der Server 201 und eine
   Buchungsnummer zurückgibt.

   Ablauf: Schritt 1 Daten -> 2 Zimmer -> 3 Angaben -> 4 Bestätigung
   Gehört zu: booking.html, css/booking.css, js/i18n/i18n.js
   ========================================================== */
import { t, getLanguage } from "./i18n/i18n.js";

// Bei Live Server/VS Code Preview liegt die Website oft auf Port 5500,
// während die API auf dem lokalen Backend-Port 3000 läuft.
const API_ORIGIN = window.location.protocol === "file:" ||
  (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) &&
    window.location.port !== "3000") ? "http://localhost:3000" : "";
const API = { availability: `${API_ORIGIN}/api/availability`, bookings: `${API_ORIGIN}/api/bookings` };

// Zimmer-Kennung aus der Datenbank -> Übersetzungsschlüssel für den Namen
const ROOM_NAME_KEYS = { garden: "rooms.r1", sea: "rooms.r2", suite: "rooms.r3" };

/** Heutiges Datum in Athen (YYYY-MM-DD). Reine Kalendertage, keine Uhrzeiten. */
function todayInAthens() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
}

/** Fügt zu einem YYYY-MM-DD Datum Tage hinzu (rechnet in UTC, ohne Sommerzeit-Fehler). */
function addDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const formatMoney = (cents, currency = "EUR") =>
  new Intl.NumberFormat(getLanguage(), { style: "currency", currency }).format(cents / 100);

const formatDate = (iso) =>
  new Intl.DateTimeFormat(getLanguage(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

/** Ersetzt {a}, {n} usw. in einem übersetzten Text. */
function fill(key, values) {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, v), t(key));
}

export function initBooking() {
  const root = document.querySelector("[data-booking]");
  if (!root) return;

  const $ = (selector) => root.querySelector(selector);
  const searchForm = $("[data-search-form]");
  const detailsForm = $("[data-details-form]");

  // Zustand des Ablaufs
  const state = { search: null, rooms: [], nights: 0, selected: null, booking: null, step: 1 };

  /* ---------- Schritte anzeigen ---------- */
  function showStep(n, silent = false) {
    state.step = n;
    root.querySelectorAll("[data-step]").forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
    root.querySelectorAll("[data-stepper]").forEach((li) => {
      const step = Number(li.dataset.stepper);
      if (step === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      li.classList.toggle("is-done", step < n);
    });
    if (silent) return; // beim ersten Laden nicht scrollen oder Fokus setzen
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    (n === 4 ? $("[data-done]") : root.querySelector(`[data-step="${n}"] h2, [data-step="${n}"] input`))?.focus?.({ preventScroll: true });
  }

  /* ---------- Schritt 1: Eingaben ---------- */
  const today = todayInAthens();
  function updateDateLanguage() {
    const language = getLanguage();
    [searchForm.elements.checkIn, searchForm.elements.checkOut].forEach((input) => {
      input.lang = language;
    });
  }
  updateDateLanguage();
  searchForm.elements.checkIn.min = today;
  searchForm.elements.checkOut.min = addDays(today, 1);

  // Abreise muss immer nach der Anreise liegen
  searchForm.elements.checkIn.addEventListener("change", (e) => {
    const checkOut = searchForm.elements.checkOut;
    if (!e.target.value) return;
    checkOut.min = addDays(e.target.value, 1);
    if (checkOut.value && checkOut.value <= e.target.value) checkOut.value = addDays(e.target.value, 1);
  });

  // Vorauswahl aus ?room=garden (Link von der Zimmerseite)
  const presetRoom = new URLSearchParams(window.location.search).get("room");
  if (presetRoom && ROOM_NAME_KEYS[presetRoom]) searchForm.elements.category.value = presetRoom;

  function setError(form, field, key) {
    const input = form.elements[field];
    const message = form.querySelector(`[data-error-for="${field}"]`);
    if (input) input.setAttribute("aria-invalid", String(Boolean(key)));
    if (message) message.textContent = key ? t(key) : "";
  }

  function readSearch() {
    const f = searchForm.elements;
    return {
      checkIn: f.checkIn.value, checkOut: f.checkOut.value,
      adults: Number(f.adults.value), children: Number(f.children.value),
      rooms: Number(f.rooms.value), category: f.category.value,
    };
  }

  /** Schnelle Prüfung im Browser. Die verbindliche Prüfung macht der Server. */
  function validateSearch(s) {
    const checks = {
      checkIn: !s.checkIn || s.checkIn < today ? "book.err.checkin" : null,
      checkOut: !s.checkOut || s.checkOut <= s.checkIn ? "book.err.checkout" : null,
      adults: !(s.adults >= 1 && s.adults <= 10) ? "book.err.adults" : null,
      children: !(s.children >= 0 && s.children <= 10) ? "book.err.children" : null,
      rooms: !(s.rooms >= 1 && s.rooms <= 5) ? "book.err.rooms" : null,
    };
    Object.entries(checks).forEach(([field, key]) => setError(searchForm, field, key));
    return Object.values(checks).every((v) => v === null);
  }

  /* ---------- Verfügbarkeit abfragen ---------- */
  async function searchAvailability() {
    const status = $("[data-search-form] .form-status");
    const submit = searchForm.querySelector('button[type="submit"]');
    const search = readSearch();
    status.className = "form-status";
    if (!validateSearch(search)) { searchForm.querySelector('[aria-invalid="true"]')?.focus(); return; }

    submit.disabled = true;
    status.textContent = t("book.searching");
    try {
      const params = new URLSearchParams({
        checkIn: search.checkIn, checkOut: search.checkOut,
        adults: search.adults, children: search.children, rooms: search.rooms,
      });
      if (search.category) params.set("category", search.category);

      const response = await fetch(`${API.availability}?${params}`);
      if (response.status === 422) throw Object.assign(new Error("invalid"), { kind: "invalid" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();

      state.search = search;
      state.rooms = data.rooms || [];
      state.nights = data.nights;
      status.textContent = "";
      if (!state.rooms.length) {
        $("[data-results]").replaceChildren(); // alte Ergebnisse nicht stehen lassen
        status.textContent = t("book.err.noRooms");
        status.classList.add("is-error");
        return;
      }
      renderResults();
      showStep(2);
    } catch (error) {
      status.textContent = t(error.kind === "invalid" ? "book.err.invalid" : "book.err.server");
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  }

  searchForm.addEventListener("submit", (e) => { e.preventDefault(); searchAvailability(); });

  /* ---------- Schritt 2: Ergebnisse anzeigen ---------- */
  const roomName = (room) => (ROOM_NAME_KEYS[room.slug] ? t(ROOM_NAME_KEYS[room.slug]) : room.name);
  const nightsLabel = (n) => `${n} ${t(n === 1 ? "book.night" : "book.nights")}`;

  function renderResults() {
    const list = $("[data-results]");
    list.replaceChildren();
    $("[data-results-summary]").textContent =
      `${formatDate(state.search.checkIn)} – ${formatDate(state.search.checkOut)} · ${nightsLabel(state.nights)} · ` +
      fill("book.summary.guests", { a: state.search.adults, c: state.search.children });

    state.rooms.forEach((room) => {
      const li = document.createElement("li");
      li.className = "result";

      const info = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = roomName(room);
      const meta = document.createElement("p");
      meta.className = "result__meta";
      meta.textContent = fill("book.capacity", { n: room.maxGuests });
      info.append(title, meta);

      const price = document.createElement("div");
      price.className = "result__price";
      const strong = document.createElement("strong");
      strong.textContent = formatMoney(room.totalPrice, room.currency);
      const per = document.createElement("span");
      per.className = "result__meta";
      per.textContent = `${t("book.total")} · ${formatMoney(room.pricePerNight, room.currency)} ${t("book.perNight")}`;
      price.append(strong, per);
      if (room.isSample) {
        const tag = document.createElement("span");
        tag.className = "demo-tag";
        tag.textContent = t("book.samplePrice");
        price.append(document.createElement("br"), tag);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--primary";
      button.textContent = t("book.select");
      button.addEventListener("click", () => selectRoom(room));

      li.append(info, price, button);
      list.append(li);
    });
  }

  function selectRoom(room) {
    state.selected = room;
    renderSummary($("[data-summary]"));
    $("[data-details-status]").textContent = "";
    showStep(3);
  }

  /* ---------- Schritt 3: Übersicht und Angaben ---------- */
  function renderSummary(dl, bookingNumber) {
    dl.replaceChildren();
    const s = state.search;
    const rows = [
      [t("book.room"), roomName(state.selected)],
      [t("book.checkin"), formatDate(s.checkIn)],
      [t("book.checkout"), formatDate(s.checkOut)],
      [t("book.nights").replace(/^./, (c) => c.toUpperCase()), String(state.nights)],
      [t("book.guests"), fill("book.summary.guests", { a: s.adults, c: s.children })],
      [t("book.rooms"), String(s.rooms)],
      [t("book.total"), formatMoney(state.selected.totalPrice, state.selected.currency)],
    ];
    rows.forEach(([label, value], i) => {
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = value;
      if (i === rows.length - 1) { dt.className = dd.className = "summary__total"; }
      dl.append(dt, dd);
    });
  }

  function validateDetails() {
    const f = detailsForm.elements;
    const checks = {
      firstName: f.firstName.value.trim().length < 1 ? "book.err.firstName" : null,
      lastName: f.lastName.value.trim().length < 1 ? "book.err.lastName" : null,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()) ? "book.err.email" : null,
      consent: !f.consent.checked ? "book.err.consent" : null,
    };
    Object.entries(checks).forEach(([field, key]) => setError(detailsForm, field, key));
    return Object.values(checks).every((v) => v === null);
  }

  detailsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("[data-details-status]");
    const submit = detailsForm.querySelector('button[type="submit"]');
    status.className = "form-status";
    if (!validateDetails()) { detailsForm.querySelector('[aria-invalid="true"]')?.focus(); return; }

    const f = detailsForm.elements;
    const s = state.search;
    // Es wird nur die Zimmer-ID gesendet. Den Preis berechnet der Server selbst.
    const payload = {
      roomId: state.selected.id,
      checkIn: s.checkIn, checkOut: s.checkOut,
      adults: s.adults, children: s.children, rooms: s.rooms,
      firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(),
      email: f.email.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim(),
      language: getLanguage(),
    };

    submit.disabled = true;
    status.textContent = t("book.confirming");
    try {
      const response = await fetch(API.bookings, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (response.status === 409) throw Object.assign(new Error("conflict"), { kind: "conflict" });
      if (response.status === 422) throw Object.assign(new Error("invalid"), { kind: "invalid" });
      if (response.status !== 201) throw new Error("HTTP " + response.status);

      const data = await response.json();
      if (!data.bookingNumber) throw new Error("Keine Buchungsnummer");

      // Erst jetzt ist die Buchung wirklich gespeichert
      state.booking = data;
      state.selected = { ...state.selected, totalPrice: data.totalPrice ?? state.selected.totalPrice };
      $("[data-booking-number]").textContent = data.bookingNumber;
      renderSummary($("[data-done-summary]"));
      detailsForm.reset();
      status.textContent = "";
      showStep(4);
    } catch (error) {
      status.classList.add("is-error");
      if (error.kind === "conflict") {
        // Zimmer ist inzwischen vergeben: zurück zur Auswahl mit frischen Daten
        status.textContent = t("book.err.conflict");
        showStep(1);
        $("[data-search-form] .form-status").textContent = t("book.err.conflict");
        $("[data-search-form] .form-status").classList.add("is-error");
      } else {
        status.textContent = t(error.kind === "invalid" ? "book.err.invalid" : "book.err.server");
      }
    } finally {
      submit.disabled = false;
    }
  });

  /* ---------- Navigation zwischen den Schritten ---------- */
  root.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "to-step-1") showStep(1);
    if (action === "to-step-2") showStep(2);
    if (action === "restart") { state.selected = null; state.booking = null; showStep(1); }
  });

  // Beim Sprachwechsel dynamische Inhalte neu schreiben (Datum, Währung, Texte)
  document.addEventListener("languagechange", () => {
    updateDateLanguage();
    if (state.rooms.length && state.search) renderResults();
    if (state.selected && state.step === 3) renderSummary($("[data-summary]"));
    if (state.booking && state.step === 4) renderSummary($("[data-done-summary]"));
  });

  showStep(1, true);
}
