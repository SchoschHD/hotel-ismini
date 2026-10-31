/* ==========================================================
   tabs.js – Zugängliche Tabs (z. B. Speisekarte)
   HTML: <div data-tabs> mit [role=tablist] > [role=tab][aria-controls]
         und Panels [role=tabpanel]. Bedienung per Klick und Pfeiltasten.
   ========================================================== */

export function initTabs() {
  document.querySelectorAll("[data-tabs]").forEach(setupTabs);
}

function setupTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

  function select(index, moveFocus = false) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    if (moveFocus) tabs[index].focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % tabs.length, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      if (e.key === "Home") { e.preventDefault(); select(0, true); }
      if (e.key === "End") { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });

  select(0);
}
