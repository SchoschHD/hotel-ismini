/* ==========================================================
   slider.js – Crossfade-Bildwechsel
   HTML: <div class="slider" data-slider> mit Kindern .slider__slide
   Gehört zu: components.css (.slider)
   ========================================================== */

export function initSliders() {
  document.querySelectorAll("[data-slider]").forEach(setupSlider);
}

function setupSlider(root) {
  const slides = [...root.querySelectorAll(".slider__slide")];
  if (slides.length < 2) { slides[0]?.classList.add("is-active"); return; }

  let index = 0;
  const autoplayMs = Number(root.dataset.autoplay || 0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = null;

  // Bedienelemente werden per JavaScript ergänzt
  const dots = document.createElement("div");
  dots.className = "slider__dots";
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slider__dot";
    dot.setAttribute("aria-label", `${i + 1} / ${slides.length}`);
    dot.addEventListener("click", () => { show(i); restart(); });
    dots.appendChild(dot);
  });
  root.appendChild(dots);

  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
      slide.setAttribute("aria-hidden", String(i !== index));
    });
    [...dots.children].forEach((dot, i) => dot.setAttribute("aria-current", String(i === index)));
  }

  function restart() {
    clearInterval(timer);
    if (autoplayMs && !reduced) timer = setInterval(() => show(index + 1), autoplayMs);
  }

  // Pfeiltasten, wenn der Slider den Fokus hat
  root.setAttribute("tabindex", "0");
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { show(index + 1); restart(); }
    if (e.key === "ArrowLeft") { show(index - 1); restart(); }
  });
  root.addEventListener("mouseenter", () => clearInterval(timer));
  root.addEventListener("mouseleave", restart);

  show(0);
  restart();
}
