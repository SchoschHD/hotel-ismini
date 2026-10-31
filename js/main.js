/* ==========================================================
   main.js – Einstiegspunkt. Wird von jeder HTML-Seite geladen:
   <script type="module" src="js/main.js"></script>
   Startet die Module, die auf der Seite gebraucht werden.
   ========================================================== */
import { initI18n } from "./i18n/i18n.js";
import { initNavigation } from "./navigation.js";
import { initAnimations } from "./animations.js";
import { initSliders } from "./slider.js";
import { initGalleries } from "./gallery.js";
import { initTabs } from "./tabs.js";

document.documentElement.classList.remove("no-js");

// Sprache zuerst, damit alle Texte stimmen, bevor andere Module sie lesen
initI18n();
initNavigation();
initAnimations();
initSliders();
initGalleries();
initTabs();

if (document.querySelector("[data-reservation]")) {
  import("./reservation.js").then((m) => m.initReservation());
}
// Seitenspezifische Module werden nur bei Bedarf geladen
if (document.querySelector("[data-booking]")) {
  import("./booking.js").then((m) => m.initBooking());
}
if (document.querySelector("[data-cookie-consent]") || document.querySelector("[data-cookie-settings]")) {
  import("./cookie-consent.js").then((m) => m.initCookieConsent());
}
