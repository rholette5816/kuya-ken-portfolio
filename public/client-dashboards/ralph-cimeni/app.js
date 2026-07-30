const data = window.DASHBOARD_DATA;
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const pageById = Object.fromEntries(data.pages.map(page => [page.id, page]));

function renderSpendChart() {
  const root = document.querySelector("#spendChart");
  const max = Math.max(...data.pages.map(page => page.spend));
  root.innerHTML = data.pages.filter(page => page.spend > 0).map(page => `
    <div class="bar-row">
      <div class="bar-label"><strong>${page.name}</strong><span>${peso.format(page.spend)}</span></div>
      <div class="bar-track"><i style="width:${(page.spend / max) * 100}%;background:${page.color}"></i></div>
    </div>`).join("");
}

function renderFilters() {
  const root = document.querySelector("#pageFilters");
  const available = data.pages.filter(page => data.creatives.some(creative => creative.page === page.id));
  root.innerHTML = `<button class="filter active" data-page="all">All Pages</button>` + available.map(page =>
    `<button class="filter" data-page="${page.id}">${page.name}</button>`).join("");
  root.addEventListener("click", event => {
    const button = event.target.closest(".filter");
    if (!button) return;
    root.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderCreatives(button.dataset.page);
  });
}

function metric(label, value) {
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function renderCreatives(filter = "all") {
  const root = document.querySelector("#creativeList");
  const pages = data.pages.filter(page => filter === "all" ? data.creatives.some(item => item.page === page.id) : page.id === filter);
  root.innerHTML = pages.map(page => {
    const items = data.creatives.filter(item => item.page === page.id);
    return `<section class="page-section">
      <div class="page-title"><span style="background:${page.color}"></span><div><small>PAGE EVIDENCE</small><h3>${page.name}</h3></div><strong>${peso.format(page.spend)} historical spend</strong></div>
      <div class="creative-grid">${items.map(item => `
        <article class="creative-card ${item.rating}">
          <a class="creative-image" href="${item.link}" target="_blank" rel="noreferrer">
            <img src="${item.image}" alt="${item.title} ad creative preview">
            <span class="media-tag">${item.role}</span>
          </a>
          <div class="creative-body">
            <div class="creative-heading"><div><span class="status ${item.rating}">${item.rating}</span><h4>${item.title}</h4></div><a href="${item.link}" target="_blank" rel="noreferrer" title="Open funded Facebook post">↗</a></div>
            <div class="creative-metrics">
              ${metric("Spend", peso.format(item.spend))}
              ${metric("Impressions", compact.format(item.impressions))}
              ${metric("CTR", `${item.ctr.toFixed(2)}%`)}
              ${metric("Messages", compact.format(item.messages))}
            </div>
            <div class="evidence-copy"><span>Why this matters</span><p>${item.why}</p></div>
            <details><summary>Metrics and iteration plan</summary>
              <div class="detail-metrics">
                ${metric("Engagement", compact.format(item.engagement))}
                ${metric("CPE", `₱${item.cpe.toFixed(2)}`)}
                ${metric("Reactions", compact.format(item.reactions))}
                ${metric("Comments", compact.format(item.comments))}
                ${metric("Shares", compact.format(item.shares))}
              </div>
              <p class="caveat"><strong>What it does not prove:</strong> ${item.caveat}</p>
              <ol>${item.iterate.map(step => `<li>${step}</li>`).join("")}</ol>
            </details>
          </div>
        </article>`).join("")}</div>
    </section>`;
  }).join("");
}

function renderBudgets() {
  const root = document.querySelector("#budgetRows");
  root.innerHTML = data.pages.filter(page => page.budget > 0).map(page => `
    <div class="budget-row"><span><i style="background:${page.color}"></i>${page.name}</span><strong>${peso.format(page.budget)}/day</strong></div>`).join("");
}

function activateAdopsPanel(panelId = "structure") {
  const panels = { structure: "#adopsStructure", inputs: "#adopsInputs", budget: "#adopsBudget", spending: "#adopsSpending", analysis: "#adopsAnalysis", creatives: "#adopsCreatives", approvals: "#adopsApprovals", changes: "#adopsChanges" };
  const selector = panels[panelId] || panels.structure;
  document.querySelectorAll(".adops-panel").forEach(item => item.classList.remove("active"));
  document.querySelector(selector)?.classList.add("active");
  document.dispatchEvent(new CustomEvent("adops:panel", { detail: panelId }));
}

const dashboardBootstrap = window.__CLIENT_DASHBOARD__ || {};
const routeBase = dashboardBootstrap.basePath || "/rminds";
const routePaths = {
  overview: `${routeBase}/audit`,
  creatives: `${routeBase}/evidence`,
  execution: `${routeBase}/plan`,
  agreement: `${routeBase}/agreement`,
  billing: `${routeBase}/billing`,
  onboarding: `${routeBase}/onboarding`,
  "ad-operations-structure": `${routeBase}/live`,
  "ad-operations-inputs": `${routeBase}/inputs`,
  "ad-operations-budget": `${routeBase}/budget`,
  "ad-operations-spending": `${routeBase}/spend`,
  "ad-operations-analysis": `${routeBase}/analyze`,
  "ad-operations-creatives": `${routeBase}/report`,
  "ad-operations-approvals": `${routeBase}/approve`,
  "ad-operations-changes": `${routeBase}/log`
};

function activateView(routeId, shouldScroll = true) {
  const isAdopsRoute = routeId === "ad-operations" || routeId.startsWith("ad-operations-");
  const viewId = isAdopsRoute ? "ad-operations" : routeId;
  const adopsPanel = isAdopsRoute ? routeId.replace(/^ad-operations-?/, "") || "structure" : "";
  document.querySelectorAll(".nav-item, .view, .nav-group").forEach(item => item.classList.remove("active"));
  const button = isAdopsRoute
    ? document.querySelector(`.nav-item[data-adops-nav="${adopsPanel}"]`) || document.querySelector('.nav-item[data-adops-nav="structure"]')
    : document.querySelector(`.nav-item[data-view="${viewId}"]`);
  const view = document.querySelector(`#${viewId}`);
  if (!button || !view) return;
  button.classList.add("active");
  const group = button.closest(".nav-group");
  if (group) {
    group.classList.add("active");
    group.open = true;
  }
  view.classList.add("active");
  if (isAdopsRoute) activateAdopsPanel(adopsPanel);
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  const routeId = button.dataset.adopsNav ? `ad-operations-${button.dataset.adopsNav}` : button.dataset.view;
  history.pushState({ routeId }, "", routePaths[routeId] || routeBase);
  activateView(routeId);
  if (window.innerWidth <= 760) button.closest(".nav-group")?.removeAttribute("open");
}));

const privateClientLink = window.__RMINDS_SIGN_TOKEN || new URLSearchParams(window.location.search).get("sign");
const defaultView = window.__RMINDS_INITIAL_ROUTE || (privateClientLink ? "ad-operations-structure" : "overview");

window.addEventListener("popstate", event => activateView(event.state?.routeId || window.__RMINDS_INITIAL_ROUTE || defaultView));
window.addEventListener("hashchange", () => activateView(window.location.hash.slice(1) || defaultView));

document.querySelector("#printButton").addEventListener("click", () => window.print());
document.querySelector("#presentButton").addEventListener("click", () => {
  document.body.classList.toggle("presentation");
  document.querySelector("#presentButton").textContent = document.body.classList.contains("presentation") ? "Exit presentation" : "Presentation mode";
});

renderSpendChart();
renderFilters();
renderCreatives();
renderBudgets();
activateView(window.location.hash.slice(1) || defaultView, false);
setTimeout(() => window.scrollTo(0, 0), 100);

const billingPeso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function billingStatus(installment, payment) {
  if (payment) return "paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${installment.dueDate}T00:00:00`);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + 3);
  if (today > graceEnd) return "overdue";
  if (today >= due) return "due";
  return "upcoming";
}

function safeText(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function loadBilling() {
  const response = await fetch("/api/client-billing", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Billing record could not be loaded.");
  const paymentById = Object.fromEntries(data.payments.map(payment => [payment.id, payment]));
  const paid = data.installments.filter(item => paymentById[item.id]).reduce((sum, item) => sum + item.amount, 0);
  const total = data.installments.reduce((sum, item) => sum + item.amount, 0);
  const next = data.installments.find(item => !paymentById[item.id]);
  document.querySelector("#billingSummary").innerHTML = `
    <div><span>Contract value</span><strong>${billingPeso.format(total)}</strong></div>
    <div><span>Amount paid</span><strong>${billingPeso.format(paid)}</strong></div>
    <div><span>Remaining</span><strong>${billingPeso.format(total - paid)}</strong></div>
    <div><span>Next payment</span><strong>${next ? `${billingPeso.format(next.amount)} · ${new Date(`${next.dueDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : "Fully paid"}</strong></div>`;

  document.querySelector("#billingLedger").innerHTML = data.installments.map(item => {
    const payment = paymentById[item.id];
    const status = billingStatus(item, payment);
    const proof = payment?.hasReceipt ? `<details class="billing-proof saved"><summary>View payment proof</summary><a href="/api/client-billing/receipt?id=${encodeURIComponent(item.id)}" target="_blank" rel="noreferrer"><img src="/api/client-billing/receipt?id=${encodeURIComponent(item.id)}" alt="Payment proof for ${safeText(item.description)}" loading="lazy"></a><small>Saved as transaction proof</small></details>` : !payment ? `<form class="billing-proof-upload" data-receipt-id="${item.id}"><label>Payment screenshot<input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required></label><div class="billing-proof-preview" hidden><img alt="Selected payment proof preview"></div><button type="submit">Upload and mark paid</button><p role="status"></p></form>` : "";
    const details = payment ? `<p>Received ${new Date(`${payment.paidAt}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "medium" })} via ${safeText(payment.method)}${payment.reference ? ` · Ref. ${safeText(payment.reference)}` : ""}</p>${payment.note ? `<small>${safeText(payment.note)}</small>` : ""}` : "";
    const controls = data.canManage ? `<details class="billing-manage"><summary>${payment ? "Edit payment" : "Record payment"}</summary><form data-billing-id="${item.id}"><label>Date received<input name="paidAt" type="date" value="${payment?.paidAt || new Date().toISOString().slice(0, 10)}" required></label><label>Method<input name="method" value="${safeText(payment?.method || "Bank transfer")}" required></label><label>Reference<input name="reference" value="${safeText(payment?.reference)}"></label><label>Note<input name="note" value="${safeText(payment?.note)}"></label><div><button type="submit">Save payment</button>${payment ? `<button type="button" data-clear-payment="${item.id}">Clear payment</button>` : ""}</div><p role="status"></p></form></details>` : "";
    return `<article class="billing-row"><div class="billing-date"><strong>${new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</strong><span>${new Date(`${item.dueDate}T00:00:00`).getFullYear()}</span></div><div class="billing-description"><span class="billing-status ${status}">${status}</span><h3>${item.description}</h3>${details}${proof}</div><strong class="billing-amount">${billingPeso.format(item.amount)}</strong>${controls}</article>`;
  }).join("");
}

function paymentProofData(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error("Choose a JPG, PNG, or WebP screenshot.")); return; }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", .84));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The screenshot could not be read.")); };
    image.src = url;
  });
}

document.querySelector("#billingLedger")?.addEventListener("change", event => {
  const input = event.target.closest(".billing-proof-upload input[type=file]");
  if (!input?.files?.[0]) return;
  const preview = input.closest("form").querySelector(".billing-proof-preview");
  preview.querySelector("img").src = URL.createObjectURL(input.files[0]);
  preview.hidden = false;
});

document.querySelector("#billingLedger")?.addEventListener("submit", async event => {
  const form = event.target.closest("form[data-receipt-id]");
  if (!form) return;
  event.preventDefault();
  const status = form.querySelector('[role="status"]');
  const button = form.querySelector("button");
  status.textContent = "Saving payment proof...";
  button.disabled = true;
  try {
    const receipt = await paymentProofData(form.elements.receipt.files[0]);
    const response = await fetch("/api/client-billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receipt", id: form.dataset.receiptId, receipt }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Payment proof could not be saved.");
    await loadBilling();
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});

document.querySelector("#billingLedger")?.addEventListener("submit", async event => {
  const form = event.target.closest("form[data-billing-id]");
  if (!form) return;
  event.preventDefault();
  const status = form.querySelector('[role="status"]');
  status.textContent = "Saving...";
  const values = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/client-billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "paid", id: form.dataset.billingId, ...values }) });
  const result = await response.json();
  if (!response.ok) { status.textContent = result.error || "Payment could not be saved."; return; }
  await loadBilling();
});

document.querySelector("#billingLedger")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-clear-payment]");
  if (!button || !window.confirm("Clear this payment record?")) return;
  const response = await fetch("/api/client-billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", id: button.dataset.clearPayment }) });
  if (response.ok) await loadBilling();
});

if (dashboardBootstrap.config?.modules?.billing !== false) loadBilling().catch(error => { document.querySelector("#billingLedger").innerHTML = `<p class="billing-loading">${safeText(error.message)}</p>`; });

async function loadAgreement() {
  const frame = document.querySelector("#agreementFrame");
  if (!frame) return;

  try {
    const response = await fetch("/client-dashboards/ralph-cimeni/agreement.html", { cache: "no-store" });
    if (!response.ok) throw new Error(`Agreement request failed with ${response.status}`);
    frame.srcdoc = await response.text();
  } catch (error) {
    frame.srcdoc = `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px;color:#9b2c2c"><strong>The agreement could not be displayed.</strong><p>${error.message}</p></body></html>`;
  }
}

if (dashboardBootstrap.config?.modules?.agreement !== false) loadAgreement();

const signToken = window.__RMINDS_SIGN_TOKEN || new URLSearchParams(window.location.search).get("sign");
const draftPrefix = signToken ? `ralphAgreement:${signToken}:` : "ralphAgreement:kevin:";
const signatureState = new Map();

function setupSignaturePad(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = "#17222a";
  let drawing = false;
  let dirty = false;

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  canvas.addEventListener("pointerdown", event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
    dirty = true;
  });
  canvas.addEventListener("pointerup", () => {
    drawing = false;
    if (dirty) localStorage.setItem(`${draftPrefix}${canvas.id}`, canvas.toDataURL("image/png"));
  });
  canvas.addEventListener("pointercancel", () => { drawing = false; });

  signatureState.set(canvas.id, {
    isDirty: () => dirty,
    clear: () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
      localStorage.removeItem(`${draftPrefix}${canvas.id}`);
    },
    dataUrl: () => canvas.toDataURL("image/png")
  });

  const saved = localStorage.getItem(`${draftPrefix}${canvas.id}`);
  if (saved) {
    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dirty = true;
    };
    image.src = saved;
  }
}

setupSignaturePad(document.querySelector("#clientSignature"));
setupSignaturePad(document.querySelector("#advertiserSignature"));

document.querySelectorAll("[data-clear]").forEach(button => {
  button.addEventListener("click", () => signatureState.get(button.dataset.clear)?.clear());
});

const agreementForm = document.querySelector("#agreementForm");

function showCompletedAgreement(record) {
  agreementForm.hidden = true;
  const complete = document.querySelector("#agreementComplete");
  complete.hidden = false;
  document.querySelector("#agreementReceipt").textContent = `Record ${record.recordId} was saved on ${new Date(record.signedAt).toLocaleString("en-PH")}. Copies were sent to both parties.`;
}

function prepareIdImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Attach a valid government ID image for both parties."));
      return;
    }
    if (file.size > 8_000_000) {
      reject(new Error("Each ID image must be smaller than 8 MB."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("One of the ID images could not be read."));
    };
    image.src = objectUrl;
  });
}

function setupIdPreview(inputId, previewId) {
  const input = document.querySelector(`#${inputId}`);
  const preview = document.querySelector(`#${previewId}`);
  input?.addEventListener("change", async () => {
    preview.hidden = true;
    if (!input.files[0]) return;
    try {
      const prepared = await prepareIdImage(input.files[0]);
      preview.querySelector("img").src = prepared;
      localStorage.setItem(`${draftPrefix}${inputId}`, prepared);
      preview.hidden = false;
    } catch (error) {
      input.setCustomValidity(error.message);
      input.reportValidity();
    }
  });
  input?.addEventListener("input", () => input.setCustomValidity(""));
  const saved = localStorage.getItem(`${draftPrefix}${inputId}`);
  if (saved) {
    preview.querySelector("img").src = saved;
    preview.hidden = false;
  }
}

setupIdPreview("clientId", "clientIdPreview");
setupIdPreview("advertiserId", "advertiserIdPreview");
document.querySelectorAll("[data-clear-id]").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.clearId}`);
    input.value = "";
    localStorage.removeItem(`${draftPrefix}${button.dataset.clearId}`);
    button.closest(".id-preview").hidden = true;
  });
});
let signingRecord = null;

async function configureSigningStep() {
  const clientField = document.querySelector("#clientName").closest("fieldset");
  const advertiserField = document.querySelector("#advertiserName").closest("fieldset");
  const heading = agreementForm.querySelector(".signature-heading");
  if (signToken) {
    const response = await fetch(`/api/client-agreement?token=${encodeURIComponent(signToken)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The signing request could not be opened.");
    signingRecord = result;
    if (result.status === "executed") {
      localStorage.setItem("ralphCimeniSignedAgreement", JSON.stringify(result));
      showCompletedAgreement(result);
      return;
    }
    advertiserField.hidden = true;
    clientField.querySelector(".id-upload").hidden = true;
    const clientIdPreview = clientField.querySelector(".id-preview");
    clientIdPreview.querySelector("img").src = result.clientId;
    clientIdPreview.querySelector("span").textContent = "Government ID attached by Kevin";
    clientIdPreview.querySelector("[data-clear-id]").hidden = true;
    clientIdPreview.hidden = false;
    document.querySelector("#clientId").required = false;
    document.querySelector("#advertiserId").required = false;
    heading.querySelector("h2").textContent = "Rye, sign the agreement";
    heading.querySelector("p").textContent = "Kevin has signed and supplied both government IDs. Review the agreement, then add your signature to complete it.";
    document.querySelector("#submitAgreement").textContent = "Complete signed agreement";
  } else {
    clientField.querySelector(".canvas-wrap").hidden = true;
    clientField.querySelector("[data-clear]").hidden = true;
    heading.querySelector("h2").textContent = "Kevin, prepare the agreement";
    heading.querySelector("p").textContent = "Add your signature and both government IDs. Rye will receive a private link to add her signature.";
    document.querySelector("#submitAgreement").textContent = "Save and send to Rye";
  }
}

configureSigningStep().catch(error => {
  document.querySelector("#agreementStatus").textContent = error.message;
  document.querySelector("#agreementStatus").classList.add("error");
  document.querySelector("#submitAgreement").disabled = true;
});

window.addEventListener("rminds:confidential-unlocked", () => {
  document.querySelector("#agreementStatus").textContent = "";
  document.querySelector("#submitAgreement").disabled = false;
  loadAgreement();
  loadBilling().catch(error => { document.querySelector("#billingLedger").innerHTML = `<p class="billing-loading">${safeText(error.message)}</p>`; });
  configureSigningStep().catch(error => {
    document.querySelector("#agreementStatus").textContent = error.message;
    document.querySelector("#agreementStatus").classList.add("error");
  });
});

agreementForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#agreementStatus");
  const submit = document.querySelector("#submitAgreement");
  const clientPad = signatureState.get("clientSignature");
  const advertiserPad = signatureState.get("advertiserSignature");
  status.classList.remove("error");

  const requiredPad = signToken ? clientPad : advertiserPad;
  if (!requiredPad?.isDirty()) {
    status.textContent = signToken ? "Rye's signature is required." : "Kevin's signature is required.";
    status.classList.add("error");
    return;
  }
  if (!document.querySelector("#agreementConsent").checked) {
    status.textContent = "Confirm that both parties have read and accepted the agreement.";
    status.classList.add("error");
    return;
  }

  let payload;
  if (signToken) {
    payload = { action: "complete", token: signToken, clientName: document.querySelector("#clientName").value.trim(), clientSignature: clientPad.dataUrl(), consent: true, companyWebsite: agreementForm.elements.companyWebsite.value };
  } else {
    status.textContent = "Preparing ID attachments...";
    try {
      const clientId = localStorage.getItem(`${draftPrefix}clientId`) || await prepareIdImage(document.querySelector("#clientId").files[0]);
      const advertiserId = localStorage.getItem(`${draftPrefix}advertiserId`) || await prepareIdImage(document.querySelector("#advertiserId").files[0]);
      payload = { action: "create", advertiserName: document.querySelector("#advertiserName").value.trim(), advertiserSignature: advertiserPad.dataUrl(), clientId, advertiserId, consent: true, agreementVersion: "2026-07-18-v1", companyWebsite: agreementForm.elements.companyWebsite.value };
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
      return;
    }
  }

  submit.disabled = true;
  status.textContent = "Saving the signed agreement...";
  try {
    const response = await fetch("/api/client-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The agreement could not be saved.");

    if (signToken) {
      localStorage.setItem("ralphCimeniSignedAgreement", JSON.stringify(result.record));
      showCompletedAgreement(result.record);
    } else {
      agreementForm.hidden = true;
      const complete = document.querySelector("#agreementComplete");
      complete.hidden = false;
      complete.querySelector("h2").textContent = "Private signing link created";
      document.querySelector("#agreementReceipt").textContent = `Record ${result.recordId} was securely saved. Test the private link, then send it to Rye yourself.`;
      const actions = complete.querySelector(".completion-actions");
      actions.innerHTML = "";
      const link = document.createElement("input");
      link.className = "signing-link";
      link.value = result.signingUrl;
      link.readOnly = true;
      link.setAttribute("aria-label", "Private signing link");
      const copy = document.createElement("button");
      copy.className = "ghost-button";
      copy.type = "button";
      copy.textContent = "Copy link";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(result.signingUrl);
        copy.textContent = "Copied";
      });
      const test = document.createElement("a");
      test.className = "ghost-button agreement-link";
      test.href = result.signingUrl;
      test.target = "_blank";
      test.rel = "noreferrer";
      test.textContent = "Test signing page";
      actions.append(link, copy, test);
      actions.hidden = false;
    }
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
    submit.disabled = false;
  }
});

function openSignedAgreement(print = false) {
  const record = localStorage.getItem("ralphCimeniSignedAgreement");
  if (!record) return;
  window.open(`/client-dashboards/ralph-cimeni/agreement.html?signed=1${print ? "&print=1" : ""}`, "_blank", "noopener,noreferrer");
}

document.querySelector("#openSignedAgreement")?.addEventListener("click", () => openSignedAgreement());
document.querySelector("#printSignedAgreement")?.addEventListener("click", () => openSignedAgreement(true));
