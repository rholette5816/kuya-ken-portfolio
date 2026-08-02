(function () {
  const panel = document.querySelector("#adopsVideoRanking");
  if (!panel) return;

  const bootstrap = window.__CLIENT_DASHBOARD__ || {};
  const token = bootstrap.token || window.__RMINDS_SIGN_TOKEN || new URLSearchParams(location.search).get("sign");
  const apiUrl = (path, params) => {
    const query = new URLSearchParams({ ...params, ...(bootstrap.apiClient ? { client: bootstrap.apiClient } : {}) });
    return `${path}?${query}`;
  };

  let data = window.__VIDEO_RANKING__ || null;
  let loaded = false;

  const num = new Intl.NumberFormat("en-PH");
  const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
  const state = { brand: "", search: "", sort: "score" };

  const tierClass = tier => ({
    "Top attention": "vrank-tier-top",
    "Solid": "vrank-tier-solid",
    "Weak": "vrank-tier-weak",
    "Scroll-past": "vrank-tier-dead"
  })[tier] || "vrank-tier-weak";

  function renderTotals() {
    const graded = data.brands.reduce((sum, b) => sum + b.posts.length, 0);
    const impressions = data.brands.reduce((sum, b) => sum + b.totalImpressions, 0);
    const spend = data.brands.reduce((sum, b) => sum + b.totalSpend, 0);
    document.querySelector("#vrankTotals").innerHTML =
      `<div><span>Video posts ranked</span><strong>${graded}</strong></div>` +
      `<div><span>Not enough data</span><strong>${data.excluded.length}</strong></div>` +
      `<div><span>Lifetime impressions</span><strong>${num.format(impressions)}</strong></div>` +
      `<div><span>Lifetime spend</span><strong>${peso.format(spend)}</strong></div>`;
  }

  function renderMethod() {
    const synced = data.syncedAt
      ? new Date(data.syncedAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
      : data.generated;
    document.querySelector("#vrankMethod").innerHTML =
      `<details><summary>How the attention score works</summary><div class="vrank-method-body">` +
      `<p>Each video post is scored 0 to 100 on how well it holds attention, not on how much it sold. ` +
      `Every metric is ranked against all other video posts in the account, then weighted:</p>` +
      `<ul>` +
      `<li><strong>Completion rate, 35%</strong> — viewers who watched to the end, divided by viewers who started. The single strongest attention signal.</li>` +
      `<li><strong>ThruPlay rate, 25%</strong> — ThruPlays divided by impressions. Watched 15 seconds or finished.</li>` +
      `<li><strong>Engagement rate, 25%</strong> — all post engagement divided by impressions.</li>` +
      `<li><strong>Amplification, 15%</strong> — comments, shares, and saves divided by impressions. The hardest actions to earn.</li>` +
      `</ul>` +
      `<p>Hook rate (3-second plays) is shown for context but is not scored. In-feed autoplay pushes it to 80 to 98 percent on almost every post, so it does not separate good from bad.</p>` +
      `<p>Posts under ${num.format(data.minImpressions)} lifetime impressions are listed separately rather than ranked. ` +
      `Figures are lifetime and refresh automatically every day, so a newly published video appears here on the next sync. Last synced ${synced}.</p>` +
      `</div></details>`;
  }

  function renderTabs() {
    document.querySelector("#vrankBusinessTabs").innerHTML = data.brands.map(b =>
      `<button type="button" data-vrank-brand="${b.brand}" class="${b.brand === state.brand ? "active" : ""}"><span>${b.brand}</span><b>${b.posts.length} video post${b.posts.length > 1 ? "s" : ""}</b></button>`
    ).join("");
  }

  function current() {
    return data.brands.find(b => b.brand === state.brand) || data.brands[0];
  }

  function renderSummary() {
    const b = current();
    if (!b) return;
    document.querySelector("#vrankSummary").innerHTML =
      `<h3>${b.brand}</h3><p>${b.summary}</p>`;
  }

  function bar(pct, cap) {
    const width = Math.max(0, Math.min(100, (pct / cap) * 100));
    return `<span class="vrank-bar"><i style="width:${width.toFixed(1)}%"></i></span>`;
  }

  function renderList() {
    const b = current();
    if (!b) return;
    const term = state.search.trim().toLowerCase();
    let posts = b.posts.filter(p => !term || p.name.toLowerCase().includes(term));
    const key = { score: "score", hold: "holdRate", eng: "engRate", impressions: "impressions", spend: "spend" }[state.sort];
    posts = posts.slice().sort((x, y) => y[key] - x[key]);

    document.querySelector("#vrankList").innerHTML = posts.map(p => `
      <article class="vrank-card ${tierClass(p.tier)}">
        <div class="vrank-card-head">
          <div class="vrank-rank">#${p.rank}</div>
          <div class="vrank-title">
            <strong>${p.name}</strong>
            <span>${p.status} &middot; created ${p.created} &middot; ${p.ads} ad${p.ads > 1 ? "s" : ""} &middot; overall #${p.overallRank} of 36</span>
          </div>
          <div class="vrank-score">
            <strong>${p.score}</strong>
            <span class="vrank-tier">${p.tier}</span>
          </div>
        </div>
        <div class="vrank-metrics">
          <div><span>Completion</span><strong>${p.holdRate}%</strong>${bar(p.holdRate, 50)}</div>
          <div><span>ThruPlay</span><strong>${p.thruRate}%</strong>${bar(p.thruRate, 55)}</div>
          <div><span>Engagement</span><strong>${p.engRate}%</strong>${bar(p.engRate, 70)}</div>
          <div><span>Amplification</span><strong>${p.ampRate}%</strong>${bar(p.ampRate, 0.15)}</div>
          <div><span>Hook (context)</span><strong>${p.hookRate}%</strong></div>
        </div>
        <p class="vrank-verdict">${p.verdict}</p>
        <div class="vrank-foot">
          <span>${num.format(p.impressions)} impressions</span>
          <span>${num.format(p.completions)} full views</span>
          <span>${num.format(p.engagements)} engagements</span>
          <span>${num.format(p.comments)} comments</span>
          <span>${peso.format(p.spend)} spent</span>
          <a href="${p.link}" target="_blank" rel="noopener">Open post</a>
        </div>
      </article>`).join("") || `<p class="empty-branch">No video posts match that search.</p>`;
  }

  function renderExcluded() {
    const rows = data.excluded.map(e =>
      `<tr><td>${e.brand}</td><td>${e.name}</td><td>${num.format(e.impressions)}</td><td>${peso.format(e.spend)}</td><td>${e.status}</td></tr>`
    ).join("");
    document.querySelector("#vrankExcluded").innerHTML =
      `<details><summary>${data.excluded.length} posts not ranked, under ${num.format(data.minImpressions)} impressions</summary>` +
      `<table class="vrank-table"><thead><tr><th>Business</th><th>Creative</th><th>Impressions</th><th>Spend</th><th>Status</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>` +
      `<p class="vrank-note">These ran too little to judge. Give them real delivery before writing them off.</p></details>`;
  }

  function renderAll() {
    if (!data || !data.brands || !data.brands.length) {
      document.querySelector("#vrankList").innerHTML =
        `<p class="empty-branch">${data && data.error ? data.error : "No video posts found for this account yet."}</p>`;
      return;
    }
    if (!state.brand || !data.brands.some(item => item.brand === state.brand)) {
      state.brand = data.brands[0].brand;
    }
    renderTotals();
    renderMethod();
    renderExcluded();
    renderTabs();
    renderSummary();
    renderList();
  }

  async function load(force) {
    document.querySelector("#vrankList").innerHTML = `<p class="empty-branch">Loading video ranking…</p>`;
    try {
      const response = await fetch(apiUrl("/api/client-video-ranking", { token, ...(force ? { refresh: "1" } : {}) }), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Video ranking is unavailable.");
      data = body;
    } catch (error) {
      if (!data) {
        document.querySelector("#vrankList").innerHTML =
          `<p class="empty-branch">${error instanceof Error ? error.message : "Video ranking is unavailable."}</p>`;
        return;
      }
    }
    loaded = true;
    renderAll();
  }

  document.addEventListener("adops:panel", event => {
    if (event.detail === "videoranking" && !loaded) load(false);
  });

  panel.addEventListener("click", event => {
    const tab = event.target.closest("[data-vrank-brand]");
    if (!tab) return;
    state.brand = tab.dataset.vrankBrand;
    renderAll();
  });

  panel.addEventListener("input", event => {
    if (event.target.id === "vrankSearch") {
      state.search = event.target.value;
      renderList();
    }
  });

  panel.addEventListener("change", event => {
    if (event.target.id === "vrankSort") {
      state.sort = event.target.value;
      renderList();
    }
  });

  panel.addEventListener("click", event => {
    if (event.target.closest("[data-vrank-refresh]")) load(true);
  });

  if (document.querySelector("#adopsVideoRanking.active")) load(false);
  else if (data) renderAll();
})();
