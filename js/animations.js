/* ==========================================================
   animations.js – Scroll-Reveal mit IntersectionObserver
   Elemente mit data-reveal werden sichtbar, sobald sie im Bild sind.
   Gehört zu: animations.css
   ========================================================== */

export function initAnimations() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) return;

  // Ohne Unterstützung oder bei reduzierter Bewegung sofort anzeigen
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || reduced) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target); // nur einmal animieren
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  items.forEach((el) => observer.observe(el));
}
