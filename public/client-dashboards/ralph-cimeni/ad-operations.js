(() => {
  const bootstrap = window.__CLIENT_DASHBOARD__ || {};
  const clientConfig = bootstrap.config || {};
  const clientStorageKey = clientConfig.slug || "rminds";
  const token = bootstrap.token || window.__RMINDS_SIGN_TOKEN || new URLSearchParams(location.search).get("sign");
  const apiUrl = (pathname, params = {}) => {
    const query = new URLSearchParams({ ...params, ...(bootstrap.apiClient ? { client: bootstrap.apiClient } : {}) });
    return `${pathname}?${query}`;
  };
  const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: clientConfig.currency || "PHP", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat("en-PH");
  const fallbackBusinesses = ["Patron Pub", "Awi Samgyupsal Buffet", "KapeHuan Takoma", "Iwayan Beach Resort", "AYO Fast Food - UB", "KapeHuan Alona", "Iwa Hotel"];
  const fallbackProfiles = {
    "Patron Pub": "business-profiles/patron-pub.jpg",
    "Awi Samgyupsal Buffet": "business-profiles/awi-samgyupsal.jpg",
    "KapeHuan Takoma": "business-profiles/kapehuan-takoma.jpg",
    "Iwayan Beach Resort": "business-profiles/iwayan-beach-resort.jpg",
    "AYO Fast Food - UB": "business-profiles/ayo-fast-food-ub.jpg",
    "KapeHuan Alona": "business-profiles/kapehuan-alona.jpg",
    "Iwa Hotel": "business-profiles/iwa-hotel.jpg"
  };
  const businesses = clientConfig.brands?.map(brand => brand.name) || fallbackBusinesses;
  const businessProfiles = clientConfig.brands ? Object.fromEntries(clientConfig.brands.map(brand => [brand.name, brand.profile])) : fallbackProfiles;
  let payload = null;
  let businessResults = [];
  let resultsReady = false;
  let selectedRevenueWeek = 0;
  const selectedBudgetWeeks = new Set([0, 1, 2]);
  const defaultBudgetColumns = ["name", "entered", "grossRevenue", "adSpend", "existingBudget", "spendRate", "returnMultiple", "targetBudget", "difference", "dailyTarget", "advisorBudget", "revenueReference", "advisorAction"];
  let budgetColumnOrder = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${clientStorageKey}BudgetColumnOrder`) || "[]");
      return Array.isArray(saved) && saved.length === defaultBudgetColumns.length && defaultBudgetColumns.every(key => saved.includes(key)) ? saved : [...defaultBudgetColumns];
    } catch { return [...defaultBudgetColumns]; }
  })();
  let budgetSortKey = "grossRevenue";
  let budgetSortDirection = -1;
  let loading = false;
  let selectedBusiness = businesses[0];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  function resultRecordsBetween(from, to, business = "all") {
    return businessResults.filter(item => item.weekStart <= to && item.weekEnd >= from && (business === "all" || item.business === business));
  }

  function resultTotals(from, to, business = "all") {
    return resultRecordsBetween(from, to, business).reduce((totals, item) => {
      totals.grossRevenue += Number(item.grossRevenue || 0);
      totals.weeks += 1;
      return totals;
    }, { grossRevenue: 0, weeks: 0 });
  }

  function revenueTargetPercent() {
    return Math.max(0.1, Number(document.querySelector("#revenueTargetPercent")?.value || localStorage.getItem(`${clientConfig.slug || "rminds"}RevenueTargetPercent`) || clientConfig.defaultTargetSpendPercent || 5));
  }

  function revenueMonthWeeks(monthValue) {
    const [year, month] = monthValue.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return [[1, 7], [8, 14], [15, 21], [22, lastDay]].map(([start, end], index) => ({
      index,
      start: `${monthValue}-${String(start).padStart(2, "0")}`,
      end: `${monthValue}-${String(end).padStart(2, "0")}`,
      label: `Week ${index + 1}`
    }));
  }

  function renderBusinessResults() {
    const monthValue = document.querySelector("#revenueMonth").value;
    if (!monthValue) return;
    const weeks = revenueMonthWeeks(monthValue);
    const week = weeks[selectedRevenueWeek] || weeks[0];
    const monthRecords = resultRecordsBetween(weeks[0].start, weeks[3].end);
    document.querySelector("#revenueWeekTabs").innerHTML = weeks.map(item => {
      const count = businesses.filter(name => businessResults.some(result => result.business === name && result.weekStart === item.start && result.weekEnd === item.end)).length;
      const state = count === businesses.length ? "complete" : count ? "partial" : "empty";
      return `<button type="button" class="${item.index === selectedRevenueWeek ? "active" : ""} ${state}" data-revenue-week="${item.index}"><span>${item.label}</span><strong>${new Date(`${item.start}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - ${new Date(`${item.end}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</strong><small>${count} of ${businesses.length} entered</small></button>`;
    }).join("");
    document.querySelector("#revenueWeekLabel").textContent = week.label;
    document.querySelector("#revenueWeekDates").textContent = `${new Date(`${week.start}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric" })} to ${new Date(`${week.end}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`;
    document.querySelector("#revenueBusinessInputs").innerHTML = businesses.map(name => {
      const record = businessResults.find(item => item.business === name && item.weekStart === week.start && item.weekEnd === week.end);
      return `<label class="${record ? "recorded" : ""}"><img src="${businessProfiles[name]}" alt=""><span><strong>${esc(name)}</strong><small>${record ? `Saved ${new Date(record.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}` : "Not entered"}</small></span><div><b>PHP</b><input type="number" min="0" step="0.01" inputmode="decimal" data-revenue-business="${esc(name)}" data-result-id="${esc(record?.id || "")}" value="${record ? esc(record.grossRevenue) : ""}" placeholder="0.00">${record ? `<button type="button" data-clear-revenue="${esc(record.id)}" title="Clear saved revenue">&times;</button>` : ""}</div></label>`;
    }).join("");
    const updateWeekTotal = () => {
      const total = [...document.querySelectorAll("[data-revenue-business]")].reduce((sum, input) => sum + (input.value === "" ? 0 : Number(input.value || 0)), 0);
      document.querySelector("#revenueWeekTotal").textContent = `${peso.format(total)} week total`;
    };
    document.querySelectorAll("[data-revenue-week]").forEach(button => button.addEventListener("click", () => {
      selectedRevenueWeek = Number(button.dataset.revenueWeek);
      renderBusinessResults();
    }));
    document.querySelectorAll("[data-revenue-business]").forEach(input => input.addEventListener("input", updateWeekTotal));
    document.querySelectorAll("[data-clear-revenue]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Clear this saved gross revenue entry?")) return;
      const response = await fetch(apiUrl("/api/client-business-results", { token, id: button.dataset.clearRevenue }), { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) { document.querySelector("#resultsInputStatus").textContent = body.error || "The entry could not be cleared."; return; }
      businessResults = businessResults.filter(item => item.id !== button.dataset.clearRevenue);
      document.querySelector("#resultsInputStatus").textContent = "Revenue entry cleared.";
      renderBusinessResults();
      if (payload) renderAnalysisFacts();
    }));
    updateWeekTotal();
    const monthRevenue = monthRecords.reduce((sum, item) => sum + Number(item.grossRevenue || 0), 0);
    const reportingBrands = new Set(monthRecords.map(item => item.business)).size;
    const completedWeeks = weeks.filter(item => businesses.every(name => businessResults.some(result => result.business === name && result.weekStart === item.start && result.weekEnd === item.end))).length;
    document.querySelector("#resultsSummary").innerHTML = `<div><span>Month gross revenue</span><strong>${peso.format(monthRevenue)}</strong></div><div><span>Businesses with entries</span><strong>${reportingBrands} / ${businesses.length}</strong></div><div><span>Completed weeks</span><strong>${completedWeeks} / 4</strong></div><div><span>Saved entries</span><strong>${monthRecords.length} / 28</strong></div>`;
    renderRevenueBudgetBalance();
    updateAdopsResultsSummary();
  }

  function renderRevenueBudgetBalance() {
    const monthValue = document.querySelector("#budgetPlanMonth")?.value;
    const weekRoot = document.querySelector("#revenueBudgetWeeks");
    const rowRoot = document.querySelector("#revenueBudgetRows");
    const headRoot = document.querySelector("#revenueBudgetHead");
    const columnRoot = document.querySelector("#budgetColumnOrder");
    if (!monthValue || !weekRoot || !rowRoot || !headRoot || !columnRoot) return;
    const weeks = revenueMonthWeeks(monthValue);
    weekRoot.innerHTML = weeks.map(week => `<label class="${selectedBudgetWeeks.has(week.index) ? "active" : ""}"><input type="checkbox" data-budget-week="${week.index}" ${selectedBudgetWeeks.has(week.index) ? "checked" : ""}><span>${week.label}</span><small>${new Date(`${week.start}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - ${new Date(`${week.end}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small></label>`).join("");
    document.querySelectorAll("[data-budget-week]").forEach(input => input.addEventListener("change", () => {
      const index = Number(input.dataset.budgetWeek);
      if (input.checked) selectedBudgetWeeks.add(index);
      else selectedBudgetWeeks.delete(index);
      renderRevenueBudgetBalance();
    }));
    const selectedWeeks = weeks.filter(week => selectedBudgetWeeks.has(week.index));
    if (!selectedWeeks.length) {
      rowRoot.innerHTML = '<tr><td colspan="9" class="results-empty">Choose at least one week to compare.</td></tr>';
      return;
    }
    const targetPercent = revenueTargetPercent();
    const totalDays = selectedWeeks.reduce((sum, week) => sum + Math.round((new Date(`${week.end}T12:00:00`) - new Date(`${week.start}T12:00:00`)) / 86400000) + 1, 0);
    const rows = businesses.map(name => {
      const records = selectedWeeks.map(week => businessResults.find(item => item.business === name && item.weekStart === week.start && item.weekEnd === week.end)).filter(Boolean);
      const grossRevenue = records.reduce((sum, item) => sum + Number(item.grossRevenue || 0), 0);
      const campaigns = payload?.snapshot?.campaigns?.filter(campaign => campaign.business === name) || [];
      const adSpend = selectedWeeks.reduce((sum, week) => sum + campaigns.reduce((campaignTotal, campaign) => campaignTotal + metricsBetween(campaign, week.start, week.end).spend, 0), 0);
      const spendingActiveCampaigns = campaigns.filter(campaign => campaign.effectiveStatus === "ACTIVE" && selectedWeeks.some(week => metricsBetween(campaign, week.start, week.end).spend > 0));
      const spendingActiveIds = new Set(spendingActiveCampaigns.map(campaign => campaign.id));
      const campaignBudget = spendingActiveCampaigns.reduce((sum, campaign) => sum + Number(campaign.dailyBudget || 0), 0);
      const adsetBudget = (payload?.snapshot?.adsets || []).filter(adset => {
        if (adset.business !== name || adset.effectiveStatus !== "ACTIVE" || !spendingActiveIds.has(adset.campaignId)) return false;
        const campaign = campaigns.find(item => item.id === adset.campaignId);
        return !Number(campaign?.dailyBudget || 0) && selectedWeeks.some(week => metricsBetween(adset, week.start, week.end).spend > 0);
      }).reduce((sum, adset) => sum + Number(adset.dailyBudget || 0), 0);
      const existingBudget = campaignBudget + adsetBudget;
      const targetBudget = grossRevenue * targetPercent / 100;
      const dailyTarget = totalDays ? targetBudget / totalDays : 0;
      const spendRate = grossRevenue ? adSpend / grossRevenue * 100 : null;
      const historicalDailySpend = totalDays ? adSpend / totalDays : 0;
      let advisorBudget = null;
      let advisorAction = "Enter revenue";
      if (grossRevenue > 0 && adSpend === 0) {
        advisorBudget = Math.min(existingBudget || dailyTarget, dailyTarget);
        advisorAction = "Test carefully";
      } else if (grossRevenue > 0 && spendRate > targetPercent) {
        advisorBudget = Math.min(existingBudget || dailyTarget, dailyTarget);
        advisorAction = "Reduce toward target";
      } else if (grossRevenue > 0 && existingBudget > dailyTarget * 1.05) {
        advisorBudget = dailyTarget;
        advisorAction = "Reduce to target";
      } else if (grossRevenue > 0 && existingBudget > 0 && existingBudget < dailyTarget * 0.9) {
        advisorBudget = Math.min(dailyTarget, existingBudget * 1.2);
        advisorAction = "Increase up to 20%";
      } else if (grossRevenue > 0 && existingBudget > 0) {
        advisorBudget = existingBudget;
        advisorAction = "Hold current budget";
      } else if (grossRevenue > 0) {
        advisorBudget = Math.min(dailyTarget, historicalDailySpend * 1.2);
        advisorAction = "Restart carefully";
      }
      const revenueReference = advisorBudget !== null && adSpend > 0 ? advisorBudget * totalDays * (grossRevenue / adSpend) : null;
      return {
        name,
        entered: records.length,
        grossRevenue,
        adSpend,
        existingBudget,
        spendRate,
        returnMultiple: adSpend ? grossRevenue / adSpend : null,
        targetBudget,
        difference: targetBudget - adSpend,
        dailyTarget,
        advisorBudget,
        revenueReference,
        advisorAction
      };
    });
    const totals = rows.reduce((sum, item) => ({
      name: "OVERALL ACCOUNT",
      entered: sum.entered + item.entered,
      grossRevenue: sum.grossRevenue + item.grossRevenue,
      adSpend: sum.adSpend + item.adSpend,
      existingBudget: sum.existingBudget + item.existingBudget,
      spendRate: null,
      returnMultiple: null,
      targetBudget: sum.targetBudget + item.targetBudget,
      difference: sum.difference + item.difference,
      dailyTarget: sum.dailyTarget + item.dailyTarget
    }), { entered: 0, grossRevenue: 0, adSpend: 0, existingBudget: 0, targetBudget: 0, difference: 0, dailyTarget: 0 });
    totals.spendRate = totals.grossRevenue ? totals.adSpend / totals.grossRevenue * 100 : null;
    totals.returnMultiple = totals.adSpend ? totals.grossRevenue / totals.adSpend : null;
    totals.advisorBudget = rows.reduce((sum, item) => sum + Number(item.advisorBudget || 0), 0);
    totals.revenueReference = rows.some(item => item.revenueReference !== null) ? rows.reduce((sum, item) => sum + Number(item.revenueReference || 0), 0) : null;
    totals.advisorAction = "Portfolio recommendation";
    const columns = {
      name: { label: "Business", value: item => item.name, cell: item => `<strong>${esc(item.name)}</strong>` },
      entered: { label: "Weeks entered", value: item => item.entered, cell: (item, overall) => overall ? `${item.entered} / ${businesses.length * selectedWeeks.length}` : `${item.entered} / ${selectedWeeks.length}` },
      grossRevenue: { label: "Gross revenue", value: item => item.grossRevenue, cell: item => peso.format(item.grossRevenue) },
      adSpend: { label: "Actual ad spend", value: item => item.adSpend, cell: item => peso.format(item.adSpend) },
      existingBudget: { label: "Existing running budget", value: item => item.existingBudget, cell: item => `${peso.format(item.existingBudget)}/day` },
      spendRate: { label: "Spend % of revenue", value: item => item.spendRate ?? -1, cell: item => item.spendRate === null ? "&mdash;" : `${item.spendRate.toFixed(2)}%` },
      returnMultiple: { label: "Revenue per PHP 1", value: item => item.returnMultiple ?? -1, cell: item => item.returnMultiple === null ? "&mdash;" : `${item.returnMultiple.toFixed(2)}x` },
      targetBudget: { label: "Target ad budget", value: item => item.targetBudget, cell: item => item.grossRevenue ? peso.format(item.targetBudget) : "&mdash;" },
      difference: { label: "Budget difference", value: item => item.difference, cell: item => item.grossRevenue ? `${item.difference >= 0 ? "+" : "-"}${peso.format(Math.abs(item.difference))}` : "&mdash;", className: item => item.difference >= 0 ? "within" : "over" },
      dailyTarget: { label: "Target daily budget", value: item => item.dailyTarget, cell: item => item.grossRevenue ? `${peso.format(item.dailyTarget)}/day` : "&mdash;" },
      advisorBudget: { label: "Advisor daily budget", value: item => item.advisorBudget ?? -1, cell: item => item.advisorBudget === null ? "&mdash;" : `<strong>${peso.format(item.advisorBudget)}/day</strong>`, className: () => "advisor-budget" },
      revenueReference: { label: "Revenue reference", value: item => item.revenueReference ?? -1, cell: item => item.revenueReference === null ? "&mdash;" : peso.format(item.revenueReference), className: () => "advisor-reference" },
      advisorAction: { label: "Advisor action", value: item => item.advisorAction, cell: item => esc(item.advisorAction), className: item => `advisor-action ${item.advisorAction.toLowerCase().replace(/[^a-z]+/g, "-")}` }
    };
    rows.sort((a, b) => {
      const first = columns[budgetSortKey].value(a);
      const second = columns[budgetSortKey].value(b);
      return (typeof first === "string" ? first.localeCompare(second) : first - second) * budgetSortDirection;
    });
    headRoot.innerHTML = budgetColumnOrder.map(key => `<th class="column-${key}"><button type="button" data-budget-sort="${key}">${columns[key].label}${budgetSortKey === key ? ` ${budgetSortDirection === 1 ? "↑" : "↓"}` : ""}</button></th>`).join("");
    document.querySelectorAll("[data-budget-sort]").forEach(button => button.addEventListener("click", () => {
      if (budgetSortKey === button.dataset.budgetSort) budgetSortDirection *= -1;
      else { budgetSortKey = button.dataset.budgetSort; budgetSortDirection = -1; }
      document.querySelector("#budgetRowSort").value = budgetSortKey;
      document.querySelector("#budgetSortDirection").textContent = budgetSortDirection === 1 ? "Ascending" : "Descending";
      renderRevenueBudgetBalance();
    }));
    const markup = (item, overall = false) => `<tr class="${overall ? "overall" : ""}">${budgetColumnOrder.map(key => `<td class="column-${key} ${columns[key].className?.(item) || ""}">${columns[key].cell(item, overall)}</td>`).join("")}</tr>`;
    rowRoot.innerHTML = rows.map(item => markup(item)).join("") + markup(totals, true);
    columnRoot.innerHTML = budgetColumnOrder.map((key, index) => `<div draggable="true" data-budget-column="${key}" title="Drag to reorder"><span>${columns[key].label}</span><button type="button" data-column-left="${key}" aria-label="Move ${columns[key].label} left" ${index === 0 ? "disabled" : ""}>&larr;</button><button type="button" data-column-right="${key}" aria-label="Move ${columns[key].label} right" ${index === budgetColumnOrder.length - 1 ? "disabled" : ""}>&rarr;</button></div>`).join("");
    let draggedColumn = "";
    document.querySelectorAll("[data-budget-column]").forEach(button => {
      button.addEventListener("dragstart", event => { draggedColumn = button.dataset.budgetColumn; event.dataTransfer.effectAllowed = "move"; });
      button.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
      button.addEventListener("drop", event => {
        event.preventDefault();
        const target = button.dataset.budgetColumn;
        if (!draggedColumn || draggedColumn === target) return;
        const next = budgetColumnOrder.filter(key => key !== draggedColumn);
        next.splice(next.indexOf(target), 0, draggedColumn);
        budgetColumnOrder = next;
        localStorage.setItem(`${clientStorageKey}BudgetColumnOrder`, JSON.stringify(budgetColumnOrder));
        renderRevenueBudgetBalance();
      });
    });
    const moveColumn = (key, amount) => {
      const index = budgetColumnOrder.indexOf(key);
      const target = index + amount;
      if (index < 0 || target < 0 || target >= budgetColumnOrder.length) return;
      [budgetColumnOrder[index], budgetColumnOrder[target]] = [budgetColumnOrder[target], budgetColumnOrder[index]];
      localStorage.setItem(`${clientStorageKey}BudgetColumnOrder`, JSON.stringify(budgetColumnOrder));
      renderRevenueBudgetBalance();
    };
    document.querySelectorAll("[data-column-left]").forEach(button => button.addEventListener("click", () => moveColumn(button.dataset.columnLeft, -1)));
    document.querySelectorAll("[data-column-right]").forEach(button => button.addEventListener("click", () => moveColumn(button.dataset.columnRight, 1)));
  }

  function updateAdopsResultsSummary() {
    const summary = document.querySelector("#adopsSummary");
    if (!summary || !payload) return;
    const now = new Date();
    const totals = resultTotals(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), isoDate(now));
    summary.querySelector("#adopsRevenueResult")?.remove();
    summary.insertAdjacentHTML("beforeend", `<div id="adopsRevenueResult"><span>Reported gross revenue</span><strong>${peso.format(totals.grossRevenue)}</strong><small>${totals.weeks} weekly record${totals.weeks === 1 ? "" : "s"} overlapping this month</small></div>`);
  }

  async function loadBusinessResults() {
    if (!token) return;
    try {
      const response = await fetch(apiUrl("/api/client-business-results", { token }), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Business results could not be loaded.");
      businessResults = Array.isArray(body.results) ? body.results : [];
      renderBusinessResults();
      if (payload) renderAnalysisFacts();
    } catch (error) {
      document.querySelector("#resultsInputStatus").textContent = error.message;
    }
  }

  function setupBusinessResults() {
    if (resultsReady) return;
    resultsReady = true;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.querySelector("#revenueMonth").value = currentMonth;
    document.querySelector("#budgetPlanMonth").value = currentMonth;
    const targetStorageKey = `${clientConfig.slug || "rminds"}RevenueTargetPercent`;
    document.querySelector("#revenueTargetPercent").value = localStorage.getItem(targetStorageKey) || String(clientConfig.defaultTargetSpendPercent || 5);
    const changeMonth = amount => {
      const [year, month] = document.querySelector("#revenueMonth").value.split("-").map(Number);
      const next = new Date(year, month - 1 + amount, 1);
      document.querySelector("#revenueMonth").value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      selectedRevenueWeek = 0;
      renderBusinessResults();
    };
    document.querySelector("#revenuePreviousMonth").addEventListener("click", () => changeMonth(-1));
    document.querySelector("#revenueNextMonth").addEventListener("click", () => changeMonth(1));
    document.querySelector("#revenueMonth").addEventListener("change", () => { selectedRevenueWeek = 0; renderBusinessResults(); });
    const changeBudgetMonth = amount => {
      const [year, month] = document.querySelector("#budgetPlanMonth").value.split("-").map(Number);
      const next = new Date(year, month - 1 + amount, 1);
      document.querySelector("#budgetPlanMonth").value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      renderRevenueBudgetBalance();
    };
    document.querySelector("#budgetPreviousMonth").addEventListener("click", () => changeBudgetMonth(-1));
    document.querySelector("#budgetNextMonth").addEventListener("click", () => changeBudgetMonth(1));
    document.querySelector("#budgetPlanMonth").addEventListener("change", renderRevenueBudgetBalance);
    const sortLabels = {
      name: "Business name",
      entered: "Weeks entered",
      grossRevenue: "Gross revenue",
      adSpend: "Actual ad spend",
      existingBudget: "Existing running budget",
      spendRate: "Spend % of revenue",
      returnMultiple: "Revenue per PHP 1",
      targetBudget: "Target ad budget",
      difference: "Budget difference",
      dailyTarget: "Target daily budget",
      advisorBudget: "Advisor daily budget",
      revenueReference: "Revenue reference",
      advisorAction: "Advisor action"
    };
    document.querySelector("#budgetRowSort").innerHTML = defaultBudgetColumns.map(key => `<option value="${key}" ${key === budgetSortKey ? "selected" : ""}>${sortLabels[key]}</option>`).join("");
    document.querySelector("#budgetRowSort").addEventListener("change", event => { budgetSortKey = event.target.value; renderRevenueBudgetBalance(); });
    document.querySelector("#budgetSortDirection").addEventListener("click", event => {
      budgetSortDirection *= -1;
      event.currentTarget.textContent = budgetSortDirection === 1 ? "Ascending" : "Descending";
      renderRevenueBudgetBalance();
    });
    document.querySelector("#resetBudgetColumns").addEventListener("click", () => {
      budgetColumnOrder = [...defaultBudgetColumns];
      localStorage.removeItem(`${clientStorageKey}BudgetColumnOrder`);
      renderRevenueBudgetBalance();
    });
    document.querySelector("#revenueTargetPercent").addEventListener("input", event => {
      localStorage.setItem(targetStorageKey, event.target.value);
      renderRevenueBudgetBalance();
      if (payload) renderAnalysisFacts();
    });
    document.querySelector("#businessResultsForm").addEventListener("submit", async event => {
      event.preventDefault();
      const status = document.querySelector("#resultsInputStatus");
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      const monthValue = document.querySelector("#revenueMonth").value;
      const week = revenueMonthWeeks(monthValue)[selectedRevenueWeek];
      const inputs = [...document.querySelectorAll("[data-revenue-business]")].filter(input => input.value !== "");
      if (!inputs.length) { status.textContent = "Enter at least one gross revenue amount first."; return; }
      submit.disabled = true;
      status.textContent = `Saving ${inputs.length} revenue ${inputs.length === 1 ? "entry" : "entries"}...`;
      try {
        for (const input of inputs) {
          const data = { id: input.dataset.resultId, business: input.dataset.revenueBusiness, weekStart: week.start, weekEnd: week.end, grossRevenue: Number(input.value) };
          const response = await fetch(apiUrl("/api/client-business-results", { token }), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || `${data.business} could not be saved.`);
          businessResults = [...businessResults.filter(item => item.id !== body.result.id), body.result];
        }
        businessResults.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.business.localeCompare(b.business));
        renderBusinessResults();
        if (payload) renderAnalysisFacts();
        status.textContent = `${week.label} gross revenue saved and connected to reporting.`;
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    document.addEventListener("adops:panel", event => {
      if (event.detail === "budget") window.setTimeout(renderRevenueBudgetBalance, 0);
    });
    loadBusinessResults();
  }

  function accountStatus(value) {
    return ({ 1: "Active", 2: "Disabled", 3: "Unsettled", 7: "Pending review", 8: "Pending settlement", 9: "Grace period", 100: "Pending closure", 101: "Closed" })[Number(value)] || `Status ${value}`;
  }

  function setDateRange(range) {
    const end = new Date();
    const start = new Date(end);
    if (range === "yesterday") start.setDate(start.getDate() - 1);
    if (range === "yesterday") end.setDate(end.getDate() - 1);
    if (range === "7") start.setDate(start.getDate() - 6);
    if (range === "30") start.setDate(start.getDate() - 29);
    if (range === "month") start.setDate(1);
    document.querySelector("#adopsFrom").value = isoDate(start);
    document.querySelector("#adopsTo").value = isoDate(end);
    document.querySelectorAll("[data-range]").forEach(button => button.classList.toggle("active", button.dataset.range === range));
    if (payload) { renderBusinessTabs(); renderTree(); }
  }

  function statusClass(value) {
    if (value === "ACTIVE") return "active";
    if (value === "PAUSED") return "paused";
    return "other";
  }

  function budget(item) {
    if (item.dailyBudget) return `${peso.format(item.dailyBudget)}/day`;
    if (item.lifetimeBudget) return `${peso.format(item.lifetimeBudget)} lifetime`;
    return item.budgetType === "ABO" ? "Ad set budget" : "Inherited";
  }

  function rangeMetrics(item, fromId = "adopsFrom", toId = "adopsTo") {
    const from = document.querySelector(`#${fromId}`).value;
    const to = document.querySelector(`#${toId}`).value;
    return (item.spend?.daily || []).reduce((total, day) => {
      if (day.date >= from && day.date <= to) {
        for (const key of ["spend", "results", "clicks", "linkClicks", "impressions", "reach", "engagements", "reactions", "comments", "shares", "saves", "videoStarts", "video100"]) total[key] += Number(day[key] || 0);
      }
      return total;
    }, { spend: 0, results: 0, clicks: 0, linkClicks: 0, impressions: 0, reach: 0, engagements: 0, reactions: 0, comments: 0, shares: 0, saves: 0, videoStarts: 0, video100: 0 });
  }

  function row(item, type, extra = "") {
    const metrics = rangeMetrics(item);
    const costPerResult = metrics.results ? peso.format(metrics.spend / metrics.results) : "&mdash;";
    const ctr = metrics.impressions ? `${(metrics.clicks / metrics.impressions * 100).toFixed(2)}%` : "&mdash;";
    const cpm = metrics.impressions ? peso.format(metrics.spend / metrics.impressions * 1000) : "&mdash;";
    return `<div class="lineage-row ${type}"><div class="lineage-name"><i></i><span><strong>${esc(item.name)}</strong><small>${type.toUpperCase()} &middot; ${esc(item.id)}${extra}</small></span></div><span class="delivery ${statusClass(item.effectiveStatus)}">${esc(item.effectiveStatus)}</span><span>${budget(item)}</span><span>${peso.format(metrics.spend)}</span><span>${number.format(metrics.results)}</span><span>${costPerResult}</span><span>${ctr}</span><span>${cpm}</span><span>${number.format(metrics.impressions)}</span></div>`;
  }

  function renderBusinessTabs() {
    const campaigns = payload.snapshot.campaigns;
    document.querySelector("#adopsBusinessTabs").innerHTML = businesses.map(name => {
      const funded = campaigns.filter(item => item.business === name && rangeMetrics(item).spend > 0).length;
      return `<button type="button" class="${name === selectedBusiness ? "active" : ""}" data-business="${esc(name)}"><img src="${businessProfiles[name]}" alt="" loading="lazy"><span class="business-tab-copy"><strong>${esc(name)}</strong><small>${funded} with spend</small></span></button>`;
    }).join("");
    document.querySelectorAll("[data-business]").forEach(button => button.addEventListener("click", () => {
      selectedBusiness = button.dataset.business;
      renderBusinessTabs();
      renderCreativeBusinessTabs();
      renderTree();
      renderCreativeReport();
    }));
    const unmapped = campaigns.filter(item => item.business === "Unmapped").length;
    const warning = document.querySelector("#adopsUnassigned");
    warning.hidden = !unmapped;
    warning.textContent = unmapped ? `${unmapped} campaigns need business assignment. They are kept outside the seven managed tabs.` : "";
  }

  function creativeLabel(metrics) {
    const ctr = metrics.impressions ? metrics.clicks / metrics.impressions * 100 : 0;
    const engagementRate = metrics.impressions ? metrics.engagements / metrics.impressions * 100 : 0;
    const videoViewRate = metrics.impressions ? metrics.videoStarts / metrics.impressions * 100 : 0;
    if (metrics.spend < 300 || metrics.impressions < 1000) return { key: "early", label: "Too early" };
    if (metrics.results >= 3 && ctr >= .8) return { key: "working", label: "Working" };
    if (ctr >= 1 || engagementRate >= 1 || videoViewRate >= 20 || metrics.results > 0) return { key: "potential", label: "Potential" };
    return { key: "not-working", label: "Not working" };
  }

  function creativeExplanation(metrics, state) {
    const ctr = metrics.impressions ? metrics.clicks / metrics.impressions * 100 : 0;
    const cost = metrics.results ? peso.format(metrics.spend / metrics.results) : "no recorded cost yet";
    if (state.key === "early") return "There is not enough spend or attention data to make a reliable decision.";
    if (state.key === "working") return `${number.format(metrics.results)} results at ${cost} per result, with a ${ctr.toFixed(2)}% click rate.`;
    if (state.key === "potential" && metrics.results === 0) return `It earns attention at a ${ctr.toFixed(2)}% click rate, but has no recorded result yet.`;
    if (state.key === "potential") return `It has ${number.format(metrics.results)} recorded result${metrics.results === 1 ? "" : "s"}, but the signal is not strong enough to scale yet.`;
    return `The ${ctr.toFixed(2)}% click rate and ${number.format(metrics.results)} results show weak response for the amount delivered.`;
  }

  function creativeNextStep(metrics, state) {
    if (state.key === "early") return "Keep running until it reaches at least 1,000 impressions and PHP 300 spend.";
    if (state.key === "working") return "Keep this post running. Test one new version with a different opening image or first three seconds.";
    if (state.key === "potential" && metrics.results === 0) return "Keep the main idea, then test a clearer offer and stronger action button.";
    if (state.key === "potential") return "Keep the strongest visual. Test a clearer headline or offer in the next version.";
    return "Stop or reduce spend. Replace the opening visual and make the offer immediately clear.";
  }

  function renderCreativeBusinessTabs() {
    const activeCampaignIds = new Set(payload.snapshot.campaigns.filter(item => item.effectiveStatus === "ACTIVE").map(item => item.id));
    document.querySelector("#creativeBusinessTabs").innerHTML = businesses.map(name => {
      const count = payload.snapshot.ads.filter(item => item.business === name && item.effectiveStatus === "ACTIVE" && activeCampaignIds.has(item.campaignId)).length;
      return `<button type="button" class="${name === selectedBusiness ? "active" : ""}" data-creative-business="${esc(name)}"><img src="${businessProfiles[name]}" alt="" loading="lazy"><span class="business-tab-copy"><strong>${esc(name)}</strong><small>${count} running</small></span></button>`;
    }).join("");
    document.querySelectorAll("[data-creative-business]").forEach(button => button.addEventListener("click", () => {
      selectedBusiness = button.dataset.creativeBusiness;
      renderBusinessTabs();
      renderCreativeBusinessTabs();
      renderCreativeReport();
    }));
  }

  function renderCreativeReport() {
    const { campaigns, ads } = payload.snapshot;
    const activeCampaignIds = new Set(campaigns.filter(item => item.effectiveStatus === "ACTIVE").map(item => item.id));
    const query = document.querySelector("#creativeSearch").value.trim().toLowerCase();
    const running = ads.filter(ad => ad.business === selectedBusiness && ad.effectiveStatus === "ACTIVE" && activeCampaignIds.has(ad.campaignId) && (!query || `${ad.name} ${ad.creative?.title} ${ad.creative?.body}`.toLowerCase().includes(query)));
    const counts = { working: 0, potential: 0, "not-working": 0, early: 0 };
    const cards = running.map(ad => {
      const metrics = rangeMetrics(ad, "creativeFrom", "creativeTo");
      const state = creativeLabel(metrics);
      counts[state.key] += 1;
      const ctr = metrics.impressions ? metrics.clicks / metrics.impressions * 100 : 0;
      const cpr = metrics.results ? peso.format(metrics.spend / metrics.results) : "&mdash;";
      const cpm = metrics.impressions ? peso.format(metrics.spend / metrics.impressions * 1000) : "&mdash;";
      const engagementRate = metrics.impressions ? metrics.engagements / metrics.impressions * 100 : 0;
      const videoRate = metrics.impressions ? metrics.videoStarts / metrics.impressions * 100 : 0;
      const campaign = campaigns.find(item => item.id === ad.campaignId);
      return `<article class="creative-report-card"><div class="creative-report-media">${ad.creative?.thumbnailUrl ? `<img src="${esc(ad.creative.thumbnailUrl)}" alt="" loading="lazy">` : '<div class="creative-placeholder">No preview</div>'}<span>${esc(ad.creative?.format || "CREATIVE")}</span></div><div class="creative-report-body"><div class="creative-report-title"><div><span class="creative-signal ${state.key}">${state.label}</span><h3>${esc(ad.name)}</h3><small>${esc(campaign?.name || "Campaign")}</small></div>${ad.postLink ? `<a href="${esc(ad.postLink)}" target="_blank" rel="noreferrer" title="Open funded post">&#8599;</a>` : ""}</div><p class="creative-copy">${esc(ad.creative?.title || ad.creative?.body || "No creative text returned by Meta.")}</p><div class="creative-hard-metrics"><div><span>Spend</span><strong>${peso.format(metrics.spend)}</strong></div><div><span>Results</span><strong>${number.format(metrics.results)}</strong></div><div><span>Cost / result</span><strong>${cpr}</strong></div><div><span>CTR</span><strong>${ctr.toFixed(2)}%</strong></div><div><span>CPM</span><strong>${cpm}</strong></div></div><div class="creative-soft-metrics"><span>Attention signals</span><b>${number.format(metrics.reactions)} reactions</b><b>${number.format(metrics.comments)} comments</b><b>${number.format(metrics.shares)} shares</b><b>${number.format(metrics.saves)} saves</b><b>${engagementRate.toFixed(2)}% engagement</b>${metrics.videoStarts ? `<b>${number.format(metrics.videoStarts)} video starts</b><b>${videoRate.toFixed(2)}% start rate</b><b>${number.format(metrics.video100)} completions</b>` : ""}</div><div class="creative-finding"><span>What the data says</span><p>${creativeExplanation(metrics, state)}</p></div><div class="creative-next"><span>Next test</span><p>${creativeNextStep(metrics, state)}</p></div></div></article>`;
    }).join("");
    document.querySelector("#creativeReportSummary").innerHTML = `<div><span>Running creatives</span><strong>${running.length}</strong></div><div><span>Working</span><strong>${counts.working}</strong></div><div><span>Potential</span><strong>${counts.potential}</strong></div><div><span>Not working</span><strong>${counts["not-working"]}</strong></div><div><span>Too early</span><strong>${counts.early}</strong></div>`;
    document.querySelector("#creativeReportGrid").innerHTML = cards || `<p class="empty-branch">No active creatives match this business and date selection.</p>`;
  }

  function campaignGoal(campaign, adsets) {
    const goals = new Set(adsets.filter(item => item.campaignId === campaign.id).map(item => item.optimizationGoal));
    const objective = campaign.objective || "";
    if (goals.has("CONVERSATIONS") || objective === "MESSAGES") return "Messages";
    if (goals.has("QUALITY_CALL")) return "Calls";
    if (goals.has("POST_ENGAGEMENT") || objective === "POST_ENGAGEMENT") return "Post Engagement";
    if (goals.has("THRUPLAY") || objective === "VIDEO_VIEWS") return "Video Views";
    if (goals.has("LINK_CLICKS") || goals.has("LANDING_PAGE_VIEWS") || objective.includes("TRAFFIC") || objective === "LINK_CLICKS") return "Traffic";
    if (goals.has("REACH") || goals.has("IMPRESSIONS") || objective.includes("AWARENESS") || objective === "REACH") return "Reach & Awareness";
    return "Other Goals";
  }

  const goalOrder = ["Messages", "Post Engagement", "Reach & Awareness", "Traffic", "Video Views", "Calls", "Other Goals"];

  function renderTree() {
    const { campaigns, adsets, ads } = payload.snapshot;
    const query = document.querySelector("#adopsSearch").value.trim().toLowerCase();
    const filtered = campaigns.filter(campaign => {
      if (campaign.business !== selectedBusiness) return false;
      if (rangeMetrics(campaign).spend <= 0) return false;
      const children = [...adsets.filter(item => item.campaignId === campaign.id), ...ads.filter(item => item.campaignId === campaign.id)];
      return !query || [campaign, ...children].some(item => `${item.name} ${item.id}`.toLowerCase().includes(query));
    });
    const total = filtered.reduce((sum, campaign) => sum + rangeMetrics(campaign).spend, 0);
    const campaignMarkup = campaign => {
      const campaignAdsets = adsets.filter(item => item.campaignId === campaign.id);
      const campaignAds = ads.filter(item => item.campaignId === campaign.id);
      return `<details class="campaign-branch"><summary>${row(campaign, "campaign", ` &middot; ${esc(campaign.objective)} &middot; ${campaign.budgetType} &middot; ${campaignAdsets.length} ad set${campaignAdsets.length === 1 ? "" : "s"}`)}</summary><div class="branch-children">${campaignAdsets.map(adset => `<details class="adset-branch"><summary>${row(adset, "adset", ` &middot; ${esc(adset.optimizationGoal)}`)}</summary><div class="branch-children">${campaignAds.filter(ad => ad.adsetId === adset.id).map(ad => row(ad, "ad", ad.postLink ? ` &middot; <a href="${esc(ad.postLink)}" target="_blank" rel="noreferrer">Funded post</a>` : "")).join("") || '<p class="empty-branch">No ads found</p>'}</div></details>`).join("") || '<p class="empty-branch">No ad sets found</p>'}</div></details>`;
    };
    const goalGroups = goalOrder.map(goal => {
      const group = filtered.filter(campaign => campaignGoal(campaign, adsets) === goal);
      if (!group.length) return "";
      const groupSpend = group.reduce((sum, campaign) => sum + rangeMetrics(campaign).spend, 0);
      const goalClass = goal.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
      return `<section class="goal-group ${goalClass}"><div class="goal-separator"><span><strong>${esc(goal)}</strong><small>${group.length} campaign${group.length === 1 ? "" : "s"}</small></span><b>${peso.format(groupSpend)} spend</b></div>${group.map(campaignMarkup).join("")}</section>`;
    }).join("");
    const html = `<div class="business-heading"><span><strong>${esc(selectedBusiness)}</strong><small>${filtered.length} campaigns with spend</small></span><b>${peso.format(total)} selected spend</b></div>${goalGroups}`;
    document.querySelector("#adopsTree").innerHTML = filtered.length ? html : `<div class="business-heading"><span><strong>${esc(selectedBusiness)}</strong><small>No campaigns with spend</small></span></div><p class="empty-branch">No campaign recorded spend during the selected dates.</p>`;
  }

  function renderChanges() {
    const business = document.querySelector("#changeBusiness").value;
    const query = document.querySelector("#changeSearch").value.trim().toLowerCase();
    const changes = payload.changes.filter(item => (business === "all" || item.business === business) && (!query || `${item.objectName} ${item.field} ${item.before} ${item.after}`.toLowerCase().includes(query)));
    document.querySelector("#changeList").innerHTML = changes.slice(0, 300).map(item => `<article class="change-row"><time>${new Date(item.timestamp).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</time><div><span>${esc(item.business)} &middot; ${esc(item.type)}</span><h3>${esc(item.objectName)}</h3><p><strong>${esc(item.field)}</strong> changed from <code>${esc(item.before ?? "None")}</code> to <code>${esc(item.after ?? "None")}</code></p></div></article>`).join("") || '<p class="empty-branch">No recorded changes yet. The first synchronization establishes the baseline.</p>';
  }

  const spendColors = ["#13795b", "#256e9e", "#a86615", "#a33d3d", "#7559a6", "#16858a", "#d46b36"];
  let spendingReady = false;
  let analysisReady = false;
  let latestAnalysisText = "";

  function currentDailyBudget(business = "all") {
    const { campaigns, adsets } = payload.snapshot;
    const campaignById = new Map(campaigns.map(campaign => [campaign.id, campaign]));
    const campaignBudget = campaigns
      .filter(campaign => campaign.effectiveStatus === "ACTIVE" && campaign.dailyBudget > 0 && (business === "all" || campaign.business === business))
      .reduce((sum, campaign) => sum + Number(campaign.dailyBudget || 0), 0);
    const adsetBudget = adsets
      .filter(adset => {
        const campaign = campaignById.get(adset.campaignId);
        return adset.effectiveStatus === "ACTIVE" && adset.dailyBudget > 0 && !campaign?.dailyBudget && campaign?.effectiveStatus === "ACTIVE" && (business === "all" || adset.business === business);
      })
      .reduce((sum, adset) => sum + Number(adset.dailyBudget || 0), 0);
    return campaignBudget + adsetBudget;
  }

  function spendDates() {
    const from = document.querySelector("#spendFrom").value;
    const to = document.querySelector("#spendTo").value;
    const dates = [];
    if (!from || !to || from > to) return dates;
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor <= end && dates.length < 90) {
      dates.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function dailySpend(business = "all") {
    const values = Object.fromEntries(spendDates().map(date => [date, 0]));
    payload.snapshot.campaigns
      .filter(campaign => business === "all" || campaign.business === business)
      .forEach(campaign => (campaign.spend?.daily || []).forEach(day => {
        if (day.date in values) values[day.date] += Number(day.spend || 0);
      }));
    return values;
  }

  function spendToday(business = "all") {
    return payload.snapshot.campaigns
      .filter(campaign => business === "all" || campaign.business === business)
      .reduce((sum, campaign) => sum + Number(campaign.spend?.today || 0), 0);
  }

  function selectedSpendSeries() {
    const comparing = document.querySelector("#spendCompare").checked;
    if (!comparing) {
      const value = document.querySelector("#spendBusiness").value;
      return [{ name: value === "all" ? "Overall ad account" : value, business: value, color: "#13795b", values: dailySpend(value) }];
    }
    const selected = [...document.querySelectorAll("[data-spend-brand]:checked")].map(input => input.value);
    return selected.map(name => ({ name, business: name, color: spendColors[businesses.indexOf(name)], values: dailySpend(name) }));
  }

  function spendingBrandAudit(dates, names) {
    const rows = names.map(name => {
      const values = dailySpend(name);
      const spend = dates.reduce((sum, date) => sum + Number(values[date] || 0), 0);
      const budget = currentDailyBudget(name);
      const average = dates.length ? spend / dates.length : 0;
      const daysWithSpend = dates.filter(date => Number(values[date] || 0) > 0).length;
      const activeCampaigns = payload.snapshot.campaigns.filter(campaign => campaign.business === name && campaign.effectiveStatus === "ACTIVE").length;
      return { name, spend, budget, average, daysWithSpend, activeCampaigns };
    }).sort((left, right) => right.spend - left.spend || left.name.localeCompare(right.name));
    const total = rows.reduce((sum, row) => sum + row.spend, 0);
    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      share: total ? row.spend / total * 100 : 0,
      budgetUse: row.budget ? row.average / row.budget * 100 : null
    }));
  }

  function renderSpendingBrandAudit(dates, comparing) {
    const panel = document.querySelector("#spendingBrandAudit");
    const selectedBusiness = document.querySelector("#spendBusiness").value;
    const names = comparing
      ? [...document.querySelectorAll("[data-spend-brand]:checked")].map(input => input.value)
      : selectedBusiness === "all" ? businesses : [];
    panel.hidden = !names.length;
    if (!names.length) return;
    const rows = spendingBrandAudit(dates, names);
    document.querySelector("#spendingBrandAuditKicker").textContent = comparing ? "Comparison audit" : "Overall account";
    document.querySelector("#spendingBrandAuditTitle").textContent = comparing ? "Brand spend ranking" : "Complete brand spend list";
    document.querySelector("#spendingBrandAuditNote").textContent = comparing
      ? "Selected brands are ranked by actual spend for the chosen dates. Use this as the reference point for budget and delivery audits."
      : "Every configured brand is included for the selected dates, including brands with no recorded spend.";
    document.querySelector("#spendingBrandAuditRows").innerHTML = rows.map(row => {
      const budgetUse = row.budgetUse === null ? "&mdash;" : `${row.budgetUse.toFixed(1)}%`;
      return `<tr><td><b class="spend-rank">${row.rank}</b></td><td><strong>${esc(row.name)}</strong><small>${row.spend ? "Recorded Meta delivery" : "No spend in range"}</small></td><td><strong>${peso.format(row.spend)}</strong></td><td><div class="spend-share"><i style="width:${Math.min(100, row.share)}%"></i></div><b>${row.share.toFixed(1)}%</b></td><td>${peso.format(row.average)}</td><td>${peso.format(row.budget)}</td><td class="${row.budgetUse !== null && row.budgetUse > 100 ? "over" : ""}">${budgetUse}</td><td>${number.format(row.daysWithSpend)} / ${number.format(dates.length)}</td><td>${number.format(row.activeCampaigns)}</td></tr>`;
    }).join("");
  }

  function drawSpendingChart(series, dates) {
    const canvas = document.querySelector("#spendingChart");
    const wrap = canvas.parentElement;
    const width = Math.max(640, wrap.clientWidth);
    const height = 340;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const margin = { top: 24, right: 24, bottom: 46, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const allValues = series.flatMap(item => dates.map(date => item.values[date] || 0));
    const maximum = Math.max(100, ...allValues);
    const axisMaximum = Math.ceil(maximum / 100) * 100;
    context.font = "10px Inter, Arial";
    context.lineWidth = 1;
    for (let step = 0; step <= 4; step++) {
      const y = margin.top + chartHeight * step / 4;
      const value = axisMaximum * (1 - step / 4);
      context.strokeStyle = "#e2e7e9";
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.stroke();
      context.fillStyle = "#68747f";
      context.textAlign = "right";
      context.fillText(peso.format(value), margin.left - 10, y + 3);
    }
    const x = index => margin.left + (dates.length <= 1 ? chartWidth / 2 : chartWidth * index / (dates.length - 1));
    const y = value => margin.top + chartHeight - (value / axisMaximum * chartHeight);
    const labelEvery = Math.max(1, Math.ceil(dates.length / 7));
    dates.forEach((date, index) => {
      if (index % labelEvery && index !== dates.length - 1) return;
      context.fillStyle = "#68747f";
      context.textAlign = "center";
      context.fillText(new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), x(index), height - 18);
    });
    series.forEach(item => {
      context.strokeStyle = item.color;
      context.lineWidth = 2.5;
      context.lineJoin = "round";
      context.beginPath();
      dates.forEach((date, index) => {
        const pointX = x(index);
        const pointY = y(item.values[date] || 0);
        if (!index) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      });
      context.stroke();
      dates.forEach((date, index) => {
        context.fillStyle = item.color;
        context.beginPath();
        context.arc(x(index), y(item.values[date] || 0), 3, 0, Math.PI * 2);
        context.fill();
      });
    });
    canvas.onmousemove = event => {
      if (!dates.length) return;
      const bounds = canvas.getBoundingClientRect();
      const position = Math.max(0, Math.min(chartWidth, event.clientX - bounds.left - margin.left));
      const index = Math.round(position / chartWidth * Math.max(1, dates.length - 1));
      const tooltip = document.querySelector("#spendingTooltip");
      tooltip.innerHTML = `<strong>${new Date(`${dates[index]}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</strong>${series.map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)}: <b>${peso.format(item.values[dates[index]] || 0)}</b></span>`).join("")}`;
      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(width - 190, Math.max(10, x(index) - 70))}px`;
      tooltip.style.top = `${margin.top + 8}px`;
    };
    canvas.onmouseleave = () => { document.querySelector("#spendingTooltip").hidden = true; };
  }

  function renderSpending() {
    if (!payload) return;
    const dates = spendDates();
    const series = selectedSpendSeries();
    const selectedBusinesses = series.map(item => item.business);
    const budget = selectedBusinesses.reduce((sum, name) => sum + currentDailyBudget(name), 0);
    const dailyTotals = dates.map(date => series.reduce((sum, item) => sum + Number(item.values[date] || 0), 0));
    const total = dailyTotals.reduce((sum, value) => sum + value, 0);
    const average = dates.length ? total / dates.length : 0;
    const today = isoDate(new Date());
    const todaySpend = dates.includes(today) ? dailyTotals[dates.indexOf(today)] : series.reduce((sum, item) => sum + spendToday(item.business), 0);
    const comparing = document.querySelector("#spendCompare").checked;
    document.querySelector("#spendingChartTitle").textContent = comparing ? `${dates.length}-day brand spend comparison` : `${dates.length}-day spend: ${series[0]?.name || "No brand selected"}`;
    document.querySelector("#spendingLegend").innerHTML = series.map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`).join("");
    document.querySelector("#spendingSummary").innerHTML = `<div><span>Current daily budget</span><strong>${peso.format(budget)}</strong><small>Active Meta budgets now</small></div><div><span>Selected-range spend</span><strong>${peso.format(total)}</strong><small>${dates.length} day${dates.length === 1 ? "" : "s"}</small></div><div><span>Average daily spend</span><strong>${peso.format(average)}</strong><small>Within selected dates</small></div><div><span>Spend today</span><strong>${peso.format(todaySpend)}</strong><small>${budget ? `${(todaySpend / budget * 100).toFixed(1)}% of current budget` : "No active daily budget"}</small></div><div><span>30-day budget reference</span><strong>${peso.format(budget * 30)}</strong><small>Current budget x 30</small></div>`;
    document.querySelector("#spendingRows").innerHTML = [...dates].reverse().map((date, reverseIndex) => {
      const actual = dailyTotals[dailyTotals.length - 1 - reverseIndex];
      const difference = budget - actual;
      const used = budget ? actual / budget * 100 : 0;
      return `<tr><td><strong>${new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong></td><td>${peso.format(budget)}<small>current reference</small></td><td><strong>${peso.format(actual)}</strong></td><td class="${difference < 0 ? "over" : "under"}">${difference < 0 ? `${peso.format(Math.abs(difference))} over` : `${peso.format(difference)} available`}</td><td><div class="budget-use"><i style="width:${Math.min(100, used)}%"></i></div><strong>${used.toFixed(1)}%</strong></td></tr>`;
    }).join("") || '<tr><td colspan="5">Choose a valid date range.</td></tr>';
    drawSpendingChart(series, dates);
    renderSpendingBrandAudit(dates, comparing);
  }

  function setSpendingRange(range) {
    const end = new Date();
    const start = new Date(end);
    if (range === "today") start.setTime(end.getTime());
    if (range === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
    if (range === "3") start.setDate(start.getDate() - 2);
    if (range === "7") start.setDate(start.getDate() - 6);
    if (range === "14") start.setDate(start.getDate() - 13);
    if (range === "30") start.setDate(start.getDate() - 29);
    if (range === "month") start.setDate(1);
    document.querySelector("#spendFrom").value = isoDate(start);
    document.querySelector("#spendTo").value = isoDate(end);
    document.querySelectorAll("[data-spend-range]").forEach(button => button.classList.toggle("active", button.dataset.spendRange === range));
    renderSpending();
  }

  function setupSpending() {
    if (spendingReady) return;
    spendingReady = true;
    document.querySelector("#spendBusiness").innerHTML = `<option value="all">Overall ad account</option>${businesses.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
    document.querySelector("#spendCompareBrands").innerHTML = businesses.map((name, index) => `<label><input type="checkbox" value="${esc(name)}" data-spend-brand ${index < 3 ? "checked" : ""}><span><i style="background:${spendColors[index]}"></i>${esc(name)}</span></label>`).join("");
    document.querySelector("#spendFrom").min = isoDate(new Date(Date.now() - 89 * 86400000));
    document.querySelector("#spendFrom").max = isoDate(new Date());
    document.querySelector("#spendTo").min = isoDate(new Date(Date.now() - 89 * 86400000));
    document.querySelector("#spendTo").max = isoDate(new Date());
    document.querySelector("#spendCompare").addEventListener("change", event => {
      document.querySelector("#spendCompareBrands").hidden = !event.target.checked;
      document.querySelector("#spendBusiness").disabled = event.target.checked;
      renderSpending();
    });
    document.querySelector("#spendBusiness").addEventListener("change", renderSpending);
    document.querySelectorAll("[data-spend-brand]").forEach(input => input.addEventListener("change", renderSpending));
    document.querySelectorAll("[data-spend-range]").forEach(button => button.addEventListener("click", () => setSpendingRange(button.dataset.spendRange)));
    for (const id of ["spendFrom", "spendTo"]) document.querySelector(`#${id}`).addEventListener("input", () => {
      document.querySelectorAll("[data-spend-range]").forEach(button => button.classList.remove("active"));
      renderSpending();
    });
    window.addEventListener("resize", () => {
      if (document.querySelector("#adopsSpending").classList.contains("active")) renderSpending();
    });
    document.addEventListener("adops:panel", event => {
      if (event.detail === "spending") window.setTimeout(renderSpending, 0);
    });
    setSpendingRange("14");
  }

  function metricsBetween(item, from, to) {
    return (item.spend?.daily || []).reduce((totals, day) => {
      if (day.date >= from && day.date <= to) {
        for (const key of ["spend", "results", "clicks", "linkClicks", "impressions", "reach", "engagements", "reactions", "comments", "shares", "saves", "videoStarts", "video100"]) totals[key] += Number(day[key] || 0);
      }
      return totals;
    }, { spend: 0, results: 0, clicks: 0, linkClicks: 0, impressions: 0, reach: 0, engagements: 0, reactions: 0, comments: 0, shares: 0, saves: 0, videoStarts: 0, video100: 0 });
  }

  function analysisDates() {
    const from = document.querySelector("#analysisFrom").value;
    const to = document.querySelector("#analysisTo").value;
    if (!from || !to || from > to) return null;
    const fromDate = new Date(`${from}T12:00:00`);
    const toDate = new Date(`${to}T12:00:00`);
    const days = Math.round((toDate - fromDate) / 86400000) + 1;
    const previousToDate = new Date(fromDate);
    previousToDate.setDate(previousToDate.getDate() - 1);
    const previousFromDate = new Date(previousToDate);
    previousFromDate.setDate(previousFromDate.getDate() - days + 1);
    return { from, to, days, previousFrom: isoDate(previousFromDate), previousTo: isoDate(previousToDate) };
  }

  function businessAnalysis(name, dates) {
    const campaigns = payload.snapshot.campaigns.filter(campaign => name === "all" || campaign.business === name);
    const current = campaigns.reduce((totals, campaign) => {
      const value = metricsBetween(campaign, dates.from, dates.to);
      for (const key of Object.keys(totals)) totals[key] += value[key];
      return totals;
    }, { spend: 0, results: 0, clicks: 0, linkClicks: 0, impressions: 0, reach: 0, engagements: 0, reactions: 0, comments: 0, shares: 0, saves: 0, videoStarts: 0, video100: 0 });
    const previous = campaigns.reduce((totals, campaign) => {
      const value = metricsBetween(campaign, dates.previousFrom, dates.previousTo);
      for (const key of Object.keys(totals)) totals[key] += value[key];
      return totals;
    }, { spend: 0, results: 0, clicks: 0, linkClicks: 0, impressions: 0, reach: 0, engagements: 0, reactions: 0, comments: 0, shares: 0, saves: 0, videoStarts: 0, video100: 0 });
    return {
      name: name === "all" ? "Overall ad account" : name,
      currentBudget: currentDailyBudget(name),
      current,
      previous,
      ctr: current.impressions ? current.clicks / current.impressions * 100 : 0,
      cpm: current.impressions ? current.spend / current.impressions * 1000 : 0,
      frequency: current.reach ? current.impressions / current.reach : 0,
      engagementRate: current.impressions ? current.engagements / current.impressions * 100 : 0,
      costPerEngagement: current.engagements ? current.spend / current.engagements : null,
      costPerThousandReached: current.reach ? current.spend / current.reach * 1000 : 0,
      costPerResult: current.results ? current.spend / current.results : null,
      spendChangePercent: previous.spend ? (current.spend - previous.spend) / previous.spend * 100 : null,
      resultChangePercent: previous.results ? (current.results - previous.results) / previous.results * 100 : null
    };
  }

  function recordedChanges(from, to, business = "all") {
    return payload.changes.filter(change => {
      const date = String(change.timestamp || "").slice(0, 10);
      return date >= from && date <= to && (business === "all" || change.business === business);
    });
  }

  function datesBetween(from, to) {
    const dates = [];
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor <= end && dates.length < 90) {
      dates.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function analysisDailySpend(business, dates) {
    const values = Object.fromEntries(dates.map(date => [date, 0]));
    payload.snapshot.campaigns
      .filter(campaign => campaign.business === business)
      .forEach(campaign => (campaign.spend?.daily || []).forEach(day => {
        if (day.date in values) values[day.date] += Number(day.spend || 0);
      }));
    return values;
  }

  function drawAnalysisChart(data) {
    const dates = datesBetween(data.dateFrom, data.dateTo);
    const selected = document.querySelector("#analysisBusiness").value;
    const names = selected === "all" ? businesses : [selected];
    const series = names.map(name => ({ name, color: spendColors[businesses.indexOf(name)], values: analysisDailySpend(name, dates) }));
    const canvas = document.querySelector("#analysisChart");
    const container = canvas.parentElement;
    const width = Math.max(640, container.clientWidth);
    const height = 300;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const margin = { top: 20, right: 22, bottom: 42, left: 66 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maximum = Math.max(100, ...series.flatMap(item => dates.map(date => item.values[date] || 0)));
    const axisMaximum = Math.ceil(maximum / 100) * 100;
    context.font = "9px Inter, Arial";
    for (let step = 0; step <= 4; step++) {
      const y = margin.top + chartHeight * step / 4;
      context.strokeStyle = "#e2e7e9";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.stroke();
      context.fillStyle = "#68747f";
      context.textAlign = "right";
      context.fillText(peso.format(axisMaximum * (1 - step / 4)), margin.left - 9, y + 3);
    }
    const x = index => margin.left + (dates.length <= 1 ? chartWidth / 2 : chartWidth * index / (dates.length - 1));
    const y = value => margin.top + chartHeight - value / axisMaximum * chartHeight;
    const labelEvery = Math.max(1, Math.ceil(dates.length / 7));
    dates.forEach((date, index) => {
      if (index % labelEvery && index !== dates.length - 1) return;
      context.fillStyle = "#68747f";
      context.textAlign = "center";
      context.fillText(new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), x(index), height - 16);
    });
    series.forEach(item => {
      context.strokeStyle = item.color;
      context.lineWidth = series.length === 1 ? 3 : 2;
      context.lineJoin = "round";
      context.beginPath();
      dates.forEach((date, index) => {
        const pointX = x(index);
        const pointY = y(item.values[date] || 0);
        if (!index) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      });
      context.stroke();
      dates.forEach((date, index) => {
        context.fillStyle = item.color;
        context.beginPath();
        context.arc(x(index), y(item.values[date] || 0), 2.5, 0, Math.PI * 2);
        context.fill();
      });
    });
    document.querySelector("#analysisChartTitle").textContent = selected === "all" ? `${dates.length}-day spend comparison for seven businesses` : `${dates.length}-day spend: ${selected}`;
    document.querySelector("#analysisChartLegend").innerHTML = series.map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`).join("");
  }

  function analysisData() {
    const dates = analysisDates();
    if (!dates) return null;
    const selected = document.querySelector("#analysisBusiness").value;
    const selectedName = selected === "all" ? "Overall ad account" : selected;
    const brands = businesses.map(name => businessAnalysis(name, dates));
    const selectedCampaigns = payload.snapshot.campaigns
      .filter(campaign => selected === "all" || campaign.business === selected)
      .map(campaign => {
        const current = metricsBetween(campaign, dates.from, dates.to);
        const previous = metricsBetween(campaign, dates.previousFrom, dates.previousTo);
        return {
          business: campaign.business,
          campaign: campaign.name,
          objective: campaign.objective,
          currentBudget: campaign.dailyBudget || 0,
          spend: current.spend,
          results: current.results,
          costPerResult: current.results ? current.spend / current.results : null,
          ctr: current.impressions ? current.clicks / current.impressions * 100 : 0,
          cpm: current.impressions ? current.spend / current.impressions * 1000 : 0,
          reach: current.reach,
          impressions: current.impressions,
          clicks: current.clicks,
          engagements: current.engagements,
          reactions: current.reactions,
          comments: current.comments,
          shares: current.shares,
          saves: current.saves,
          videoStarts: current.videoStarts,
          videoCompletions: current.video100,
          frequency: current.reach ? current.impressions / current.reach : 0,
          engagementRate: current.impressions ? current.engagements / current.impressions * 100 : 0,
          costPerEngagement: current.engagements ? current.spend / current.engagements : null,
          previousSpend: previous.spend,
          previousResults: previous.results
        };
      })
      .filter(campaign => campaign.spend > 0 || campaign.previousSpend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 50);
    const now = new Date();
    const weekStart = new Date(now);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    const weekFrom = isoDate(weekStart);
    const weekTo = isoDate(now);
    const simplifyChanges = changes => changes.slice(0, 120).map(change => ({
      date: change.timestamp,
      business: change.business,
      type: change.type,
      name: change.objectName,
      field: change.field,
      before: change.before,
      after: change.after
    }));
    const resultBrands = businesses.map(name => {
      const totals = resultTotals(dates.from, dates.to, name);
      const ad = brands.find(item => item.name === name);
      const targetBudget = totals.grossRevenue * revenueTargetPercent() / 100;
      return {
        business: name,
        grossRevenue: totals.grossRevenue,
        weeksReported: totals.weeks,
        adSpend: ad?.current.spend || 0,
        revenueToAdSpend: ad?.current.spend ? totals.grossRevenue / ad.current.spend : null,
        targetBudget,
        budgetDifference: targetBudget - (ad?.current.spend || 0)
      };
    });
    const selectedResultTotals = resultTotals(dates.from, dates.to, selected);
    return {
      dateFrom: dates.from,
      dateTo: dates.to,
      days: dates.days,
      previousDateFrom: dates.previousFrom,
      previousDateTo: dates.previousTo,
      business: selectedName,
      account: businessAnalysis(selected, dates),
      brands,
      businessResults: {
        source: "Client-supplied weekly business records",
        matchRule: "Whole weekly records overlapping the selected date range",
        targetAdSpendPercent: revenueTargetPercent(),
        grossRevenue: selectedResultTotals.grossRevenue,
        weeksReported: selectedResultTotals.weeks,
        brands: selected === "all" ? resultBrands : resultBrands.filter(item => item.business === selected),
        records: resultRecordsBetween(dates.from, dates.to, selected).map(item => ({
          business: item.business,
          weekStart: item.weekStart,
          weekEnd: item.weekEnd,
          grossRevenue: item.grossRevenue
        }))
      },
      campaigns: selectedCampaigns,
      changesInSelectedPeriod: simplifyChanges(recordedChanges(dates.from, dates.to, selected)),
      workCompletedThisWeek: {
        dateFrom: weekFrom,
        dateTo: weekTo,
        recordedMetaChanges: simplifyChanges(recordedChanges(weekFrom, weekTo, selected))
      },
      dataNote: "Budgets are current active daily Meta budgets. Historical performance fields are actual results for their stated dates. Reach is summed from campaign delivery and may include the same person across campaigns, so it is not deduplicated account reach. Gross revenue is manually supplied weekly by the client and is not a Meta-attributed conversion. Whole weekly records are included when they overlap the selected date range. Recorded changes are detected between dashboard Meta synchronizations."
    };
  }

  function renderAnalysisFacts() {
    if (!payload) return;
    const data = analysisData();
    if (!data) {
      document.querySelector("#analysisPeriodNote").textContent = "Choose a valid date range.";
      return;
    }
    const account = data.account;
    const spendDifference = account.previous.spend ? (account.current.spend - account.previous.spend) / account.previous.spend * 100 : null;
    const resultDifference = account.previous.results ? (account.current.results - account.previous.results) / account.previous.results * 100 : null;
    document.querySelector("#analysisPeriodNote").innerHTML = `<strong>${esc(data.business)}</strong><span>${data.dateFrom} to ${data.dateTo} compared with ${data.previousDateFrom} to ${data.previousDateTo}. ${data.workCompletedThisWeek.recordedMetaChanges.length} Meta change${data.workCompletedThisWeek.recordedMetaChanges.length === 1 ? "" : "s"} recorded this week.</span>`;
    document.querySelector("#analysisPrintBusiness").textContent = data.business;
    document.querySelector("#analysisPrintPeriod").textContent = `${new Date(`${data.dateFrom}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })} to ${new Date(`${data.dateTo}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`;
    document.querySelector("#analysisMetrics").innerHTML = `<div><span>Current daily budget</span><strong>${peso.format(account.currentBudget)}</strong></div><div><span>Spend</span><strong>${peso.format(account.current.spend)}</strong><small>${spendDifference === null ? "No previous spend" : `${spendDifference >= 0 ? "+" : ""}${spendDifference.toFixed(1)}% vs previous`}</small></div><div><span>Results</span><strong>${number.format(account.current.results)}</strong><small>${resultDifference === null ? "No previous results" : `${resultDifference >= 0 ? "+" : ""}${resultDifference.toFixed(1)}% vs previous`}</small></div><div><span>Cost / result</span><strong>${account.costPerResult === null ? "&mdash;" : peso.format(account.costPerResult)}</strong></div><div><span>CTR</span><strong>${account.ctr.toFixed(2)}%</strong></div><div><span>CPM</span><strong>${peso.format(account.cpm)}</strong></div>`;
    const visibleBrands = document.querySelector("#analysisBusiness").value === "all" ? data.brands : data.brands.filter(brand => brand.name === data.business);
    document.querySelector("#analysisBrandRows").innerHTML = visibleBrands.map(brand => {
      const change = brand.spendChangePercent;
      return `<tr><td><strong>${esc(brand.name)}</strong></td><td>${peso.format(brand.currentBudget)}/day</td><td>${peso.format(brand.current.spend)}</td><td>${number.format(brand.current.results)}</td><td>${brand.costPerResult === null ? "&mdash;" : peso.format(brand.costPerResult)}</td><td>${brand.ctr.toFixed(2)}%</td><td>${peso.format(brand.previous.spend)}</td><td class="${change !== null && change > 0 ? "increase" : "decrease"}">${change === null ? "&mdash;" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}</td></tr>`;
    }).join("");
    document.querySelector("#analysisAttentionSummary").innerHTML = `<div><span>Spend</span><strong>${peso.format(account.current.spend)}</strong></div><div><span>Reported reach*</span><strong>${number.format(account.current.reach)}</strong><small>Summed, not deduplicated</small></div><div><span>Impressions</span><strong>${number.format(account.current.impressions)}</strong></div><div><span>Frequency</span><strong>${account.frequency.toFixed(2)}x</strong></div><div><span>Engagements</span><strong>${number.format(account.current.engagements)}</strong><small>${account.engagementRate.toFixed(2)}% of impressions</small></div><div><span>Cost / engagement</span><strong>${account.costPerEngagement === null ? "&mdash;" : peso.format(account.costPerEngagement)}</strong></div><div><span>Clicks</span><strong>${number.format(account.current.clicks)}</strong><small>${account.ctr.toFixed(2)}% CTR</small></div><div><span>Video starts</span><strong>${number.format(account.current.videoStarts)}</strong><small>${number.format(account.current.video100)} completions</small></div>`;
    document.querySelector("#analysisAttentionRows").innerHTML = visibleBrands.map(brand => `<tr><td><strong>${esc(brand.name)}</strong></td><td>${peso.format(brand.current.spend)}</td><td>${number.format(brand.current.reach)}</td><td>${number.format(brand.current.impressions)}</td><td>${brand.frequency.toFixed(2)}x</td><td>${peso.format(brand.cpm)}</td><td>${number.format(brand.current.engagements)}</td><td>${brand.costPerEngagement === null ? "&mdash;" : peso.format(brand.costPerEngagement)}</td><td>${number.format(brand.current.clicks)}</td><td>${brand.ctr.toFixed(2)}%</td></tr>`).join("");
    const actual = data.businessResults;
    const revenueToSpend = account.current.spend ? actual.grossRevenue / account.current.spend : null;
    document.querySelector("#analysisResultsSummary").innerHTML = `<div><span>Gross revenue</span><strong>${peso.format(actual.grossRevenue)}</strong></div><div><span>Ad spend</span><strong>${peso.format(account.current.spend)}</strong></div><div><span>Revenue / ad spend</span><strong>${revenueToSpend === null ? "&mdash;" : `${revenueToSpend.toFixed(2)}x`}</strong></div><div><span>Weekly records included</span><strong>${number.format(actual.weeksReported)}</strong></div>`;
    document.querySelector("#analysisResultsRows").innerHTML = actual.brands.map(item => `<tr><td><strong>${esc(item.business)}</strong></td><td>${peso.format(item.grossRevenue)}</td><td>${peso.format(item.adSpend)}</td><td>${item.revenueToAdSpend === null ? "&mdash;" : `${item.revenueToAdSpend.toFixed(2)}x`}</td><td>${item.grossRevenue ? peso.format(item.targetBudget) : "&mdash;"}</td><td class="${item.budgetDifference >= 0 ? "decrease" : "increase"}">${item.grossRevenue ? `${item.budgetDifference >= 0 ? "+" : "-"}${peso.format(Math.abs(item.budgetDifference))}` : "&mdash;"}</td><td>${number.format(item.weeksReported)}</td></tr>`).join("");
    drawAnalysisChart(data);
  }

  function setAnalysisRange(range) {
    const end = new Date();
    const start = new Date(end);
    if (range === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
    if (range === "3") start.setDate(start.getDate() - 2);
    if (range === "7") start.setDate(start.getDate() - 6);
    if (range === "14") start.setDate(start.getDate() - 13);
    if (range === "30") start.setDate(start.getDate() - 29);
    if (range === "month") start.setDate(1);
    document.querySelector("#analysisFrom").value = isoDate(start);
    document.querySelector("#analysisTo").value = isoDate(end);
    document.querySelectorAll("[data-analysis-range]").forEach(button => button.classList.toggle("active", button.dataset.analysisRange === range));
    renderAnalysisFacts();
  }

  function showAnalysisReport(report) {
    latestAnalysisText = report?.text || "";
    document.querySelector("#analysisOutput").textContent = latestAnalysisText || "No generated analysis yet.";
    document.querySelector("#analysisGeneratedMeta").textContent = report?.generatedAt ? `${report.business} · ${report.dateFrom} to ${report.dateTo} · Generated ${new Date(report.generatedAt).toLocaleString("en-PH")}` : "Choose a date range and generate the report.";
    document.querySelector("#analysisPrintGenerated").textContent = report?.generatedAt ? new Date(report.generatedAt).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }) : "—";
    document.querySelector("#copyAnalysis").disabled = !latestAnalysisText;
    document.querySelector("#printAnalysis").disabled = !latestAnalysisText;
  }

  async function generateAnalysis() {
    const data = analysisData();
    const button = document.querySelector("#generateAnalysis");
    const status = document.querySelector("#analysisStatus");
    if (!data) { status.textContent = "Choose a valid date range first."; return; }
    button.disabled = true;
    button.textContent = "Generating...";
    status.textContent = "OpenAI is analyzing the selected performance data.";
    try {
      const response = await fetch(apiUrl("/api/client-analysis-summary", { token }), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The analysis could not be generated.");
      showAnalysisReport(body.report);
      status.textContent = "Analysis generated and saved.";
    } catch (error) {
      status.textContent = error.message || "The analysis could not be generated.";
    } finally {
      button.disabled = false;
      button.textContent = "Generate analysis";
    }
  }

  async function setupAnalysis() {
    if (analysisReady) return;
    analysisReady = true;
    document.querySelector("#analysisBusiness").innerHTML = `<option value="all">Overall ad account</option>${businesses.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
    for (const id of ["analysisFrom", "analysisTo"]) {
      document.querySelector(`#${id}`).min = isoDate(new Date(Date.now() - 89 * 86400000));
      document.querySelector(`#${id}`).max = isoDate(new Date());
      document.querySelector(`#${id}`).addEventListener("input", () => {
        document.querySelectorAll("[data-analysis-range]").forEach(button => button.classList.remove("active"));
        renderAnalysisFacts();
      });
    }
    document.querySelector("#analysisBusiness").addEventListener("change", renderAnalysisFacts);
    document.querySelectorAll("[data-analysis-range]").forEach(button => button.addEventListener("click", () => setAnalysisRange(button.dataset.analysisRange)));
    document.querySelector("#generateAnalysis").addEventListener("click", generateAnalysis);
    document.querySelector("#copyAnalysis").addEventListener("click", async () => {
      await navigator.clipboard.writeText(latestAnalysisText);
      document.querySelector("#analysisStatus").textContent = "Analysis copied.";
    });
    document.querySelector("#printAnalysis").addEventListener("click", () => {
      document.body.classList.add("print-analysis");
      window.print();
    });
    window.addEventListener("afterprint", () => document.body.classList.remove("print-analysis"));
    window.addEventListener("resize", () => {
      if (document.querySelector("#adopsAnalysis").classList.contains("active")) renderAnalysisFacts();
    });
    document.addEventListener("adops:panel", event => {
      if (event.detail === "analysis") window.setTimeout(renderAnalysisFacts, 0);
    });
    setAnalysisRange("7");
    try {
      const response = await fetch(apiUrl("/api/client-analysis-summary", { token }), { cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.report) showAnalysisReport(body.report);
    } catch {}
  }

  function render(data) {
    payload = data;
    const { snapshot } = data;
    document.querySelector("#adopsContent").hidden = false;
    document.querySelector("#adopsSync").innerHTML = `<strong>${esc(snapshot.account.name)} &middot; ${esc(snapshot.account.currency)}</strong><span>Last synchronized ${new Date(snapshot.syncedAt).toLocaleString("en-PH")} &middot; Auto-refresh every 5 minutes${data.syncError ? ` &middot; Sync warning: ${esc(data.syncError)}` : ""}</span>`;
    document.querySelector("#refreshAdops").hidden = !data.canRefresh;
    const billingStatus = accountStatus(snapshot.account.account_status);
    const balance = Number(snapshot.account.balance || 0) / 100;
    document.querySelector("#metaBillingStatus").innerHTML = `<div><span>Meta billing status</span><strong class="billing-account-status ${billingStatus === "Active" ? "active" : "attention"}">${esc(billingStatus)}</strong></div><div><span>Balance to pay</span><strong>${peso.format(balance)}</strong><small>Reported by Meta at last sync</small></div>`;
    const activeCampaigns = snapshot.campaigns.filter(item => item.effectiveStatus === "ACTIVE").length;
    const activeAds = snapshot.ads.filter(item => item.effectiveStatus === "ACTIVE").length;
    const activeBudget = snapshot.campaigns.filter(item => item.effectiveStatus === "ACTIVE").reduce((sum, item) => sum + item.dailyBudget, 0) + snapshot.adsets.filter(item => item.effectiveStatus === "ACTIVE" && !snapshot.campaigns.find(campaign => campaign.id === item.campaignId)?.dailyBudget).reduce((sum, item) => sum + item.dailyBudget, 0);
    const todaySpend = snapshot.campaigns.reduce((sum, item) => sum + item.spend.today, 0);
    const monthSpend = snapshot.campaigns.reduce((sum, item) => sum + item.spend.month, 0);
    document.querySelector("#adopsSummary").innerHTML = `<div><span>Active campaigns</span><strong>${activeCampaigns}</strong></div><div><span>Active ads</span><strong>${activeAds}</strong></div><div><span>Active daily budget</span><strong>${peso.format(activeBudget)}</strong></div><div><span>Spend today</span><strong>${peso.format(todaySpend)}</strong></div><div><span>Spend this month</span><strong>${peso.format(monthSpend)}</strong></div>`;
    updateAdopsResultsSummary();
    renderRevenueBudgetBalance();
    document.querySelector("#changeBusiness").innerHTML = `<option value="all">All businesses</option>${businesses.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
    renderBusinessTabs();
    renderTree();
    renderCreativeBusinessTabs();
    renderCreativeReport();
    renderChanges();
    setupSpending();
    renderSpending();
    setupAnalysis();
    renderAnalysisFacts();
  }

  async function load(force = false) {
    if (!token) { document.querySelector("#adopsGate").hidden = false; return; }
    if (loading) return;
    loading = true;
    try {
      document.querySelector("#adopsSync").textContent = force ? "Refreshing Meta data..." : "Loading campaign structure...";
      const response = await fetch(apiUrl("/api/client-ad-operations", { token, ...(force ? { refresh: "1" } : {}) }), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { document.querySelector("#adopsGate").hidden = false; document.querySelector("#adopsGate").textContent = result.error || "Ad operations could not be loaded."; return; }
      render(result);
      if (result.refreshDeferred) document.querySelector("#adopsSync").querySelector("span").textContent += " · Next Meta sync pending cooldown";
    } catch {
      document.querySelector("#adopsSync").textContent = "Live data refresh failed. Retrying automatically.";
    } finally {
      loading = false;
    }
  }

  const today = new Date();
  setupBusinessResults();
  setDateRange("month");
  function setCreativeDateRange(range) {
    const end = new Date();
    const start = new Date(end);
    if (range === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
    if (range === "7") start.setDate(start.getDate() - 6);
    if (range === "30") start.setDate(start.getDate() - 29);
    if (range === "month") start.setDate(1);
    document.querySelector("#creativeFrom").value = isoDate(start);
    document.querySelector("#creativeTo").value = isoDate(end);
    document.querySelectorAll("[data-creative-range]").forEach(button => button.classList.toggle("active", button.dataset.creativeRange === range));
    if (payload) renderCreativeReport();
  }
  setCreativeDateRange("month");
  document.querySelector("#adopsFrom").min = isoDate(new Date(Date.now() - 89 * 86400000));
  document.querySelector("#adopsTo").max = isoDate(today);
  document.querySelector("#creativeFrom").min = isoDate(new Date(Date.now() - 89 * 86400000));
  document.querySelector("#creativeTo").max = isoDate(today);
  document.querySelectorAll("[data-range]").forEach(button => button.addEventListener("click", () => setDateRange(button.dataset.range)));
  document.querySelectorAll("[data-creative-range]").forEach(button => button.addEventListener("click", () => setCreativeDateRange(button.dataset.creativeRange)));
  for (const id of ["adopsFrom", "adopsTo"]) document.querySelector(`#${id}`)?.addEventListener("input", () => {
    document.querySelectorAll("[data-range]").forEach(button => button.classList.remove("active"));
    renderBusinessTabs();
    renderTree();
  });
  for (const id of ["creativeFrom", "creativeTo"]) document.querySelector(`#${id}`)?.addEventListener("input", () => {
    document.querySelectorAll("[data-creative-range]").forEach(button => button.classList.remove("active"));
    renderCreativeReport();
  });
  document.querySelector("#adopsSearch")?.addEventListener("input", renderTree);
  document.querySelector("#creativeSearch")?.addEventListener("input", renderCreativeReport);
  for (const id of ["changeBusiness", "changeSearch"]) document.querySelector(`#${id}`)?.addEventListener("input", renderChanges);
  document.querySelector("#refreshAdops")?.addEventListener("click", () => load(true));
  load();
  window.setInterval(() => load(true), 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
})();
