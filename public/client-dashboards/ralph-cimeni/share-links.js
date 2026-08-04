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
    //
    // The panels listen on "input", not "change". Dispatching the wrong event
    // silently left every panel on its own default range while this banner
    // announced the shared one, which is exactly the mismatch this fixes.
    const DATE_PAIRS = [
      ["adopsFrom", "adopsTo"], ["creativeFrom", "creativeTo"],
      ["spendFrom", "spendTo"], ["analysisFrom", "analysisTo"],
      ["vrankFrom", "vrankTo"]
    ];

    const apply = () => {
      for (const [fromId, toId] of DATE_PAIRS) {
        for (const [id, value] of [[fromId, shared.from], [toId, shared.to]]) {
          const input = document.querySelector(`#${id}`);
          if (!input || !value) continue;
          // The panels clamp to the last 90 days; widen so a shared range sticks.
          if (input.min && value < input.min) input.min = value;
          if (input.max && value > input.max) input.max = value;
          if (input.value !== value) {
            input.disabled = false;
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          input.readOnly = true;
          input.disabled = true;
          input.title = "Fixed by the person who shared this report";
        }
      }
      // Replay every other frozen control: search text, sort, month, business
      // selectors. Same "input" event the panels actually listen for.
      for (const [id, value] of Object.entries(shared.view || {})) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) continue;
        const control = document.querySelector(`#${id}`);
        if (!control || control.value === value) continue;
        control.disabled = false;
        control.value = value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        control.readOnly = true;
        control.disabled = true;
      }

      // Restore the selected business tab by clicking it, so the panel runs its
      // own selection logic rather than us faking the highlight.
      if (shared.tab && shared.tabAttribute) {
        const selector = `[${shared.tabAttribute}="${String(shared.tab).replace(/"/g, '\\"')}"]`;
        const tab = document.querySelector(selector);
        if (tab && !tab.classList.contains("active")) tab.click();
      }

      // Presets would silently override the shared range if clicked.
      document.querySelectorAll(".date-presets").forEach(node => node.setAttribute("hidden", "hidden"));
    };

    // Panels initialise asynchronously and set their own default range, so
    // re-apply until the values stop being overwritten.
    apply();
    const ticker = setInterval(apply, 400);
    setTimeout(() => clearInterval(ticker), 12000);
    document.addEventListener("adops:panel", () => setTimeout(apply, 120));
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

  // Everything that makes up "how I set it up", captured at share time.
  const PANEL_CONTROLS = {
    structure: ["adopsFrom", "adopsTo", "adopsSearch"],
    inputs: ["revenueMonth"],
    budget: ["budgetPlanMonth", "revenueTargetPercent", "budgetRowSort", "budgetSortDirection", "budgetColumnOrder"],
    spending: ["spendFrom", "spendTo", "spendBusiness", "spendCompare"],
    analysis: ["analysisFrom", "analysisTo", "analysisBusiness"],
    creatives: ["creativeFrom", "creativeTo", "creativeSearch"],
    videoranking: ["vrankFrom", "vrankTo", "vrankSearch", "vrankSort"],
    changes: ["changeBusiness", "changeSearch"]
  };
  const PANEL_TABS = {
    structure: "data-business",
    creatives: "data-creative-business",
    videoranking: "data-vrank-brand"
  };

  function captureView(panel) {
    const view = {};
    for (const id of PANEL_CONTROLS[panel] || []) {
      const control = document.querySelector(`#${id}`);
      if (control && control.value !== "" && control.value != null) view[id] = control.value;
    }
    let tab = null;
    const attribute = PANEL_TABS[panel];
    if (attribute) {
      const active = document.querySelector(`[${attribute}].active`);
      if (active) tab = active.getAttribute(attribute);
    }
    return { view, tab };
  }

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
        <label class="share-history-note"><span data-share-history></span></label>
        <label class="share-history-note"><span data-share-frozen></span></label>
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

  // How far back each panel actually holds data. Offering a wider range would
  // produce a link that opens to an empty report.
  const PANEL_HISTORY_DAYS = { videoranking: 365, structure: 90, spending: 90, analysis: 90, creatives: 90 };

  function prefillDates(panel) {
    const ids = PANEL_DATES[panel];
    const from = ids && document.querySelector(`#${ids[0]}`);
    const to = ids && document.querySelector(`#${ids[1]}`);
    const fromField = q("[data-share-from]");
    const toField = q("[data-share-to]");
    fromField.value = from && from.value ? from.value : "";
    toField.value = to && to.value ? to.value : "";

    const days = PANEL_HISTORY_DAYS[panel];
    const today = new Date().toISOString().slice(0, 10);
    const earliest = days ? new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10) : "";
    for (const field of [fromField, toField]) {
      field.min = earliest;
      field.max = today;
      field.disabled = !days;
    }
    const captured = captureView(panel);
    const frozen = Object.keys(captured.view).filter(id => !/(From|To)$/.test(id)).length + (captured.tab ? 1 : 0);
    const summary = q("[data-share-frozen]");
    if (summary) {
      summary.textContent = frozen
        ? `Your current view is frozen into the link: ${captured.tab ? `business "${captured.tab}", ` : ""}plus ${frozen - (captured.tab ? 1 : 0)} other filter${frozen - (captured.tab ? 1 : 0) === 1 ? "" : "s"}. The recipient cannot change any of it.`
        : "Your current view is frozen into the link. The recipient cannot change it.";
    }
    const note = q("[data-share-history]");
    note.textContent = days
      ? `This report holds ${days} days of history. Dates before ${earliest} are not available.`
      : "This report has no date range. The link will always show current data.";
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
            expiresInDays: q("[data-share-expiry]").value ? Number(q("[data-share-expiry]").value) : null,
            ...captureView(q("[data-share-panel]").value)
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
