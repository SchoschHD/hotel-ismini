/* ==========================================================
   gallery.js – Lightbox für Galerien
   HTML: <button class="gallery-item" data-gallery="name" data-full="bild.webp" data-caption-key="...">
   Gehört zu: components.css (.lightbox). Texte kommen aus i18n.js.
   ========================================================== */
import { t } from "./i18n/i18n.js";

export function initGalleries() {
  const items = [...document.querySelectorAll(".gallery-item[data-gallery]")];
  if (!items.length) return;

  const box = createLightbox();
  const img = box.querySelector("img");
  const caption = box.querySelector("figcaption");
  let group = [];
  let index = 0;
  let lastFocus = null;

  function show(i) {
    index = (i + group.length) % group.length;
    const item = group[index];
    const thumb = item.querySelector("img");
    img.src = item.dataset.full || thumb.currentSrc || thumb.src;
    img.alt = thumb.alt;
    caption.textContent = thumb.alt;
  }

  function open(item) {
    lastFocus = document.activeElement;
    group = items.filter((el) => el.dataset.gallery === item.dataset.gallery);
    box.classList.add("is-open");
    document.body.style.overflow = "hidden";
    show(group.indexOf(item));
    refreshLabels();
    box.querySelector(".lightbox__close").focus();
  }

  function close() {
    box.classList.remove("is-open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  }

  function refreshLabels() {
    box.querySelector(".lightbox__close").setAttribute("aria-label", t("gallery.close"));
    box.querySelector(".lightbox__prev").setAttribute("aria-label", t("gallery.prev"));
    box.querySelector(".lightbox__next").setAttribute("aria-label", t("gallery.next"));
  }

  items.forEach((item) => item.addEventListener("click", () => open(item)));
  box.querySelector(".lightbox__close").addEventListener("click", close);
  box.querySelector(".lightbox__prev").addEventListener("click", () => show(index - 1));
  box.querySelector(".lightbox__next").addEventListener("click", () => show(index + 1));
  box.addEventListener("click", (e) => { if (e.target === box) close(); });

  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") show(index + 1);
    if (e.key === "ArrowLeft") show(index - 1);
    // Fokus in der Lightbox halten
    if (e.key === "Tab") {
      const buttons = [...box.querySelectorAll("button")];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("languagechange", refreshLabels);
}

function createLightbox() {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = `
    <button type="button" class="lightbox__btn lightbox__close">&times;</button>
    <button type="button" class="lightbox__btn lightbox__prev">&#8249;</button>
    <figure><img alt=""><figcaption></figcaption></figure>
    <button type="button" class="lightbox__btn lightbox__next">&#8250;</button>`;
  document.body.appendChild(box);
  return box;
}
