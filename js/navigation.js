/* ==========================================================
   navigation.js – Transparente/solide Navigation, Hamburger-Menü
   Gehört zu: components.css (.site-nav), responsive.css (.nav-links)
   ========================================================== */

import { t } from "./i18n/i18n.js";

export function initNavigation() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const toggle = nav.querySelector(".nav-toggle");
  const hasHero = Boolean(document.querySelector(".hero"));

  // Auf Seiten mit Hero ist die Navigation erst transparent, sonst sofort solide
  function updateSolidState() {
    const solid = !hasHero || window.scrollY > 40;
    nav.classList.toggle("is-solid", solid && hasHero);
    nav.classList.toggle("is-static", !hasHero);
  }
  updateSolidState();
  window.addEventListener("scroll", updateSolidState, { passive: true });

  if (!toggle) return;

  function setMenu(open) {
    nav.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    updateToggleLabel();
  }

  // Beschriftung des Hamburger-Buttons je nach Zustand und Sprache
  function updateToggleLabel() {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-label", t(open ? "nav.menuClose" : "nav.menu"));
  }
  document.addEventListener("languagechange", updateToggleLabel);
  updateToggleLabel();

  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));

  // Menü schließen: Escape, Klick auf Link, größerer Bildschirm
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  nav.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
}
