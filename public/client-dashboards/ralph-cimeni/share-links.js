(function () {
  const bootstrap = window.__CLIENT_DASHBOARD__ || {};
  const shared = window.__SHARED_VIEW__ || null;

  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ---------- shared view: lock the page down ---------- */
  if (shared) {
    document.body.classList.add("shared-view");
    const banner = document.createElement("div");
    banner.className = "shared-banner";
    const range = shared.from && shared.to
      ? `${shared.from} to ${shared.to}`
      : shared.from ? `from ${shared.from}` : shared.to ? `up to ${shared.to}` : "All time";
    banner.innerHTML =
      `<div><strong>${esc(shared.panelLabel)}</strong>`
      + `<span>${esc(shared.organization)}${shared.brand ? ` &middot; ${esc(shared.brand)}` : ""} &middot; ${esc(range)}</span></div>`
      + `<span class="shared-tag">Shared report &middot; read only</span>`;
    document.querySelector("main")?.prepend(banner);

    // Pin the date inputs to the shared range and stop anyone changing them.
    const apply = () => {
      const pairs = [["adopsFrom", "adopsTo"], ["creativeFrom", "creativeTo"], ["spendFrom", "spendTo"], ["analysisFrom", "analysisTo"]];
      for (const [fromId, toId] of pairs) {
        const from = document.querySelector(`#${fromId}`);
        const to = document.querySelector(`#${toId}`);
        if (from && shared.from) { from.value = shared.from; from.dispatchEvent(new Event("change", { bubbles: true })); }
        if (to && shared.to) { to.value = shared.to; to.dispatchEvent(new Event("change", { bubbles: true })); }
        [from, to].forEach(input => { if (input) { input.readOnly = true; input.disabled = true; } });
      }
      document.querySelectorAll(".date-presets").forEach(node => node.setAttribute("hidden", "hidden"));
    };
    setTimeout(apply, 350);
    setTimeout(apply, 1500);
    return;
  }

  /* ---------- owner view: create share links ---------- */
  const token = bootstrap.token || window.__RMINDS_SIGN_TOKEN;
  if (!token || String(token).startsWith("share:")) return;

  const PANEL_DATES = {
    structure: ["adopsFrom", "adopsTo"],
    spending: ["spendFrom", "spendTo"],
    analysis: ["analysisFrom", "analysisTo"],
    creatives: ["creativeFrom", "creativeTo"],
    videoranking: ["vrankFrom", "vrankTo"]
  };
  const PANEL_LABELS = {
    structure: "Live structure", inputs: "Business results", budget: "Budget planning",
    spending: "Spending report", analysis: "Analysis summary", creatives: "Creative report",
    videoranking: "Video ads ranking", changes: "Change log"
  };

  const apiUrl = (params) => {
    const query = new URLSearchParams({ ...params, ...(bootstrap.apiClient ? { client: bootstrap.apiClient } : {}) });
    return `/api/client-share?${query}`;
  };

  let currentPanel = "structure";

  const modal = document.createElement("div");
  modal.className = "share-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="share-dialog" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
      <header><h3 id="shareTitle">Share this report</h3><button type="button" data-share-close aria-label="Close">&times;</button></header>
      <p class="share-intro">Anyone with the link sees only this one report, read only. No login, no sidebar, no other panels.</p>
      <div class="share-fields">
        <label>Report<select data-share-panel></select></label>
        <label>Business<select data-share-brand><option value="">All businesses</option></select></label>
        <label>From<input type="date" data-share-from></label>
        <label>To<input type="date" data-share-to></label>
        <label>Link expires<select data-share-expiry>
          <option value="">Never</option><option value="7">7 days</option>
          <option value="30" selected>30 days</option><option value="90">90 days</option>
        </select></label>
      </div>
      <div class="share-actions">
        <button type="button" class="share-create" data-share-create>Create link</button>
        <p class="share-message" data-share-message role="status"></p>
      </div>
      <div class="share-result" data-share-result hidden>
        <label>Shareable link<input type="text" data-share-url readonly></label>
        <button type="button" data-share-copy>Copy</button>
      </div>
      <details class="share-existing"><summary>Links you have already created</summary><div data-share-list></div></details>
    </div>`;
  document.body.appendChild(modal);

  const q = sel => modal.querySelector(sel);

  function openModal(panel) {
    currentPanel = panel;
    const panelSelect = q("[data-share-panel]");
    panelSelect.innerHTML = Object.entries(PANEL_LABELS)
      .map(([value, label]) => `<option value="${value}" ${value === panel ? "selected" : ""}>${esc(label)}</option>`).join("");

    const brandSelect = q("[data-share-brand]");
    const brands = (bootstrap.config && bootstrap.config.brands) || [];
    brandSelect.innerHTML = `<option value="">All businesses</option>`
      + brands.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join("");

    prefillDates(panel);
    q("[data-share-message]").textContent = "";
    q("[data-share-result]").hidden = true;
    modal.hidden = false;
    loadExisting();
  }

  function prefillDates(panel) {
    const ids = PANEL_DATES[panel];
    const from = ids && document.querySelector(`#${ids[0]}`);
    const to = ids && document.querySelector(`#${ids[1]}`);
    q("[data-share-from]").value = from && from.value ? from.value : "";
    q("[data-share-to]").value = to && to.value ? to.value : "";
  }

  async function loadExisting() {
    const list = q("[data-share-list]");
    list.innerHTML = `<p class="share-empty">Loading…</p>`;
    try {
      const response = await fetch(apiUrl({ token }), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load links.");
      const rows = (body.shares || []).filter(s => s.active);
      list.innerHTML = rows.length ? rows.map(s => `
        <div class="share-row">
          <div><strong>${esc(PANEL_LABELS[s.panel] || s.panel)}</strong>
            <span>${esc(s.brand || "All businesses")}${s.from || s.to ? ` &middot; ${esc(s.from || "start")} to ${esc(s.to || "today")}` : " &middot; all time"}
            ${s.expiresAt ? ` &middot; expires ${new Date(s.expiresAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}` : ""}</span></div>
          <button type="button" data-share-copy-existing="${esc(s.url)}">Copy</button>
          <button type="button" class="share-revoke" data-share-revoke="${esc(s.token)}">Revoke</button>
        </div>`).join("") : `<p class="share-empty">No active links yet.</p>`;
    } catch (error) {
      list.innerHTML = `<p class="share-empty">${esc(error instanceof Error ? error.message : "Could not load links.")}</p>`;
    }
  }

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text; document.body.appendChild(field); field.select();
      document.execCommand("copy"); field.remove();
    }
    if (button) {
      const original = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = original; }, 1600);
    }
  }

  modal.addEventListener("click", async event => {
    if (event.target === modal || event.target.closest("[data-share-close]")) { modal.hidden = true; return; }

    if (event.target.closest("[data-share-create]")) {
      const button = event.target.closest("[data-share-create]");
      const message = q("[data-share-message]");
      button.disabled = true; message.textContent = "Creating…";
      try {
        const response = await fetch(apiUrl({ token }), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panel: q("[data-share-panel]").value,
            brand: q("[data-share-brand]").value || null,
            from: q("[data-share-from]").value || null,
            to: q("[data-share-to]").value || null,
            expiresInDays: q("[data-share-expiry]").value ? Number(q("[data-share-expiry]").value) : null
          })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not create the link.");
        q("[data-share-url]").value = body.share.url;
        q("[data-share-result]").hidden = false;
        message.textContent = "";
        copy(body.share.url, null);
        loadExisting();
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : "Could not create the link.";
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-share-copy]")) { copy(q("[data-share-url]").value, event.target); return; }

    const existing = event.target.closest("[data-share-copy-existing]");
    if (existing) { copy(existing.dataset.shareCopyExisting, existing); return; }

    const revoke = event.target.closest("[data-share-revoke]");
    if (revoke) {
      revoke.disabled = true;
      await fetch(apiUrl({ token, share: revoke.dataset.shareRevoke }), { method: "DELETE" });
      loadExisting();
    }
  });

  modal.querySelector("[data-share-panel]").addEventListener("change", event => prefillDates(event.target.value));
  document.addEventListener("keydown", event => { if (event.key === "Escape") modal.hidden = true; });

  // Drop a Share button into every shareable panel.
  const PANEL_IDS = {
    adopsStructure: "structure", adopsInputs: "inputs", adopsBudget: "budget",
    adopsSpending: "spending", adopsAnalysis: "analysis", adopsCreatives: "creatives",
    adopsVideoRanking: "videoranking", adopsChanges: "changes"
  };
  for (const [id, panel] of Object.entries(PANEL_IDS)) {
    const section = document.querySelector(`#${id}`);
    if (!section) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "share-trigger";
    button.dataset.sharePanel = panel;
    button.innerHTML = `<span aria-hidden="true">&#128279;</span> Share this report`;
    button.addEventListener("click", () => openModal(panel));
    section.prepend(button);
  }
})();
