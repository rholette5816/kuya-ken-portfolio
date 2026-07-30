(() => {
  if (window.__CLIENT_DASHBOARD__?.config?.modules?.onboarding === false) return;
  const businesses = ["Patron Pub", "Awi Samgyupsal Buffet", "KapeHuan Takoma", "Iwayan Beach Resort", "AYO Fast Food - UB", "KapeHuan Alona", "Iwa Hotel"];
  const token = window.__RMINDS_SIGN_TOKEN || new URLSearchParams(location.search).get("sign");
  const localKey = token ? `ralphOnboardingFocused:${token}` : "";
  let answers = {};
  let activeScope = "general";

  const general = [
    ["Primary decision-maker", "Name, Messenger contact, and what they may approve"],
    ["Finance contact", "Name and contact for invoices and payment confirmation"],
    ["Communication setup", "Messenger group link or confirmed participants"],
    ["Approval process", "Who approves campaigns, creatives, offers, and expected response time"],
    ["Portfolio priority", "Rank the seven businesses from highest to lowest priority"],
    ["Portfolio media budget", "Maximum daily or monthly Meta spend approved across all businesses"],
    ["Budget flexibility", "How much may be moved between campaigns without new approval?"],
    ["Weekly reporting", "Responsible person, reporting cutoff, and submission method"],
    ["Dashboard recipients", "Names and email addresses that should receive reporting access"],
    ["Customer-source survey", "Who will ask customers how they found the business, and where will answers be recorded?"],
    ["Creative assets", "Shared folder link and the person responsible for supplying photos, menus, rates, and logos"],
    ["Important operating dates", "Closures, events, seasonal periods, launches, or deadlines affecting the portfolio"]
  ];

  const businessQuestions = [
    ["Business links and location", "Facebook Page, Instagram, Google Maps, website or booking link, and branch address"],
    ["Primary advertising result", "Messages, reservations, bookings, walk-ins, purchases, directions, or awareness"],
    ["Target customer and area", "Main customer profile and geographic targeting area"],
    ["Priority offer", "Product, service, package, regular price, promotional price, and offer validity"],
    ["Operations and capacity", "Operating hours, peak and weak periods, capacity, inventory, or availability limits"],
    ["Lead or booking process", "Contact person, response channel, booking steps, and expected response time"],
    ["Advertising budget", "Approved starting daily budget and maximum daily budget without new approval"],
    ["Proven advertising", "Post links, campaigns, or ads that should be protected, tested, repaired, or stopped"],
    ["Creative readiness", "Available photos, videos, menus, rates, testimonials, logo, and missing assets"],
    ["Success measurement", "Meaningful result, acceptable cost, revenue or booking target, and known tracking limits"],
    ["Restrictions and notes", "Claims to avoid, disclaimers, seasonality, competitor concerns, or other important context"]
  ];

  const scopes = { general, ...Object.fromEntries(businesses.map(name => [name, businessQuestions])) };
  const keyFor = (scope, index) => `focused:${scope}:${index}`;
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function progress() {
    const total = Object.values(scopes).reduce((sum, questions) => sum + questions.length, 0);
    const answered = Object.entries(scopes).reduce((sum, [scope, questions]) => sum + questions.filter((_, index) => {
      const answer = answers[keyFor(scope, index)];
      return answer?.na || answer?.detail?.trim();
    }).length, 0);
    const percent = Math.round((answered / total) * 100);
    document.querySelector("#onboardingProgress").innerHTML = `<strong>${percent}% complete</strong><span>${answered} of ${total} essential answers completed</span>`;
  }

  function persist() {
    if (localKey) localStorage.setItem(localKey, JSON.stringify(answers));
    progress();
  }

  function render(scope) {
    activeScope = scope;
    document.querySelectorAll("#onboardingTabs button").forEach(button => button.classList.toggle("active", button.dataset.scope === scope));
    const title = scope === "general" ? "General portfolio setup" : scope;
    const intro = scope === "general" ? "Complete these once for the whole portfolio." : "Answer only what the advertiser needs to plan, launch, and measure this business.";
    document.querySelector("#onboardingQuestions").innerHTML = `<div class="focused-heading"><h3>${title}</h3><p>${intro}</p></div><div class="focused-grid">${scopes[scope].map(([label, help], index) => {
      const key = keyFor(scope, index);
      const answer = answers[key] || { detail: "", na: false };
      return `<label class="focused-question ${answer.na ? "na" : ""}" data-key="${escapeHtml(key)}"><strong>${label}</strong><span>${help}</span><textarea rows="3" ${answer.na ? "disabled" : ""} placeholder="Enter the confirmed answer">${escapeHtml(answer.detail)}</textarea><em><input type="checkbox" ${answer.na ? "checked" : ""}> Not applicable</em></label>`;
    }).join("")}</div>`;
  }

  async function save(status) {
    const message = document.querySelector("#onboardingStatus");
    message.textContent = status === "submitted" ? "Submitting..." : "Saving...";
    const response = await fetch("/api/client-onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, answers, status, version: "focused-v1" }) });
    const result = await response.json();
    if (!response.ok) { message.textContent = result.error || "Onboarding could not be saved."; return; }
    message.textContent = `${status === "submitted" ? "Onboarding submitted" : "Draft saved"} · ${new Date(result.updatedAt).toLocaleString("en-PH")}`;
  }

  async function initialize() {
    if (!token) {
      document.querySelector("#onboardingGate").hidden = false;
      document.querySelector("#onboardingProgress").textContent = "Private client link required";
      return;
    }
    const response = await fetch(`/api/client-onboarding?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const record = await response.json();
    if (!response.ok) throw new Error(record.error || "Onboarding could not be opened.");
    try { answers = { ...JSON.parse(localStorage.getItem(localKey) || "{}"), ...(record.answers || {}) }; } catch { answers = record.answers || {}; }
    const tabs = [{ id: "general", label: "General" }, ...businesses.map(name => ({ id: name, label: name }))];
    document.querySelector("#onboardingTabs").innerHTML = tabs.map(tab => `<button type="button" data-scope="${escapeHtml(tab.id)}">${tab.label}</button>`).join("");
    document.querySelector("#onboardingShell").hidden = false;
    render("general");
    progress();
  }

  document.querySelector("#onboardingTabs")?.addEventListener("click", event => {
    const button = event.target.closest("[data-scope]");
    if (button) render(button.dataset.scope);
  });
  document.querySelector("#onboardingQuestions")?.addEventListener("input", event => {
    const field = event.target.closest("[data-key]");
    if (!field) return;
    const checkbox = field.querySelector('input[type="checkbox"]');
    const textarea = field.querySelector("textarea");
    answers[field.dataset.key] = { detail: textarea.value, na: checkbox.checked };
    textarea.disabled = checkbox.checked;
    field.classList.toggle("na", checkbox.checked);
    persist();
  });
  document.querySelector("#saveOnboarding")?.addEventListener("click", () => save("draft"));
  document.querySelector("#printOnboarding")?.addEventListener("click", () => { document.body.classList.add("print-onboarding"); window.print(); });
  window.addEventListener("afterprint", () => document.body.classList.remove("print-onboarding"));
  document.querySelector("#onboardingForm")?.addEventListener("submit", event => { event.preventDefault(); save("submitted"); });
  initialize().catch(error => { document.querySelector("#onboardingGate").hidden = false; document.querySelector("#onboardingGate").textContent = error.message; });
})();
