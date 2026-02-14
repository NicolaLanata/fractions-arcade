(function () {
  "use strict";

  if (typeof FRACTIONS_ARCADE_ALL_ITEMS === "undefined") return;

  const listEl = document.getElementById("recordList");
  const countEl = document.getElementById("recordCount");
  const resetBtn = document.getElementById("resetRecords");

  const records = FRACTIONS_ARCADE_ALL_ITEMS
    .filter((item) => item.bestKey)
    .map((item) => ({ key: item.bestKey, title: item.title }));

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function fmt(ms) {
    if (!Number.isFinite(ms)) return "--";
    const t = ms / 1000;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const tenths = Math.floor((t - Math.floor(t)) * 10 + 1e-9);
    return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
  }

  function summarize(raw) {
    if (!raw) return "No record";
    const obj = safeParse(raw);
    if (!obj || typeof obj !== "object") return "Invalid data";

    const g = Number(obj.greens ?? obj.g);
    const y = Number(obj.yellows ?? obj.y);
    const t = Number(obj.timeMs);

    if (Number.isFinite(g) && Number.isFinite(y) && Number.isFinite(t)) {
      return `${g}G ${y}Y in ${fmt(t)}`;
    }
    if (Number.isFinite(g) && Number.isFinite(t)) {
      return `${g}G in ${fmt(t)}`;
    }
    if (Number.isFinite(obj.score)) {
      return `Score ${obj.score}`;
    }
    return "Saved";
  }

  function render() {
    if (!listEl) return;

    let stored = 0;
    listEl.innerHTML = records.map((r) => {
      const raw = localStorage.getItem(r.key);
      if (raw) stored += 1;
      return `
        <div class="arcade-user-chip" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;width:100%;">
          <span><strong>${r.title}</strong><br><span style="opacity:.8">${r.key}</span></span>
          <span>${summarize(raw)}</span>
        </div>
      `;
    }).join("");

    if (countEl) countEl.textContent = `${stored} / ${records.length}`;
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const ok = window.confirm("Reset all saved best-score records for Fractions Arcade on this device?");
      if (!ok) return;
      records.forEach((r) => localStorage.removeItem(r.key));
      render();
    });
  }

  render();
})();
