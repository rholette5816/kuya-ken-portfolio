(() => {
  if (window.__CLIENT_DASHBOARD__?.config?.modules?.creativeApprovals === false) return;
  const bootstrap = window.__CLIENT_DASHBOARD__ || {};
  const token = bootstrap.token || window.__RMINDS_SIGN_TOKEN || new URLSearchParams(location.search).get("sign") || "";
  const approvalUrl = () => `/api/client-creative-approvals?token=${encodeURIComponent(token)}${bootstrap.apiClient ? `&client=${encodeURIComponent(bootstrap.apiClient)}` : ""}`;
  const businesses = [
    ["Patron Pub","patron","business-profiles/patron-pub.jpg","A Panglao night-out favorite."],
    ["Awi Samgyupsal Buffet","awi","business-profiles/awi-samgyupsal.jpg","A barkada buffet favorite in Tagbilaran."],
    ["KapeHuan Takoma","kht","business-profiles/kapehuan-takoma.jpg","A go-to coffee stop for work and catch-ups."],
    ["Iwayan Beach Resort","iwa","business-profiles/iwayan-beach-resort.jpg","Chosen for relaxed stays close to Alona."],
    ["AYO Fast Food - UB","ayo","business-profiles/ayo-fast-food-ub.jpg","A student-friendly food stop beside UB."],
    ["KapeHuan Alona","kha","business-profiles/kapehuan-alona.jpg","Loved for coffee with an Alona view."],
    ["Iwa Hotel","iwh","business-profiles/iwa-hotel.jpg","A practical choice for Tagbilaran stays."]
  ].map(([name,key,profile,proof])=>({name,key,profile,proof}));
  const copy = {
    patron:[["Free entrance, live music, and cold drinks. Bring the barkada and make tonight count at Patron Pub.","Your Panglao night starts here"],["Live music is on tonight. Message the crew, claim your table, and enjoy a proper Panglao night out.","Tonight deserves Patron"],["Looking for the Panglao nightlife spot? Good music, cold drinks, and free entrance are waiting.","The night is better at Patron"]],
    awi:[["Unlimited samgyup starts at ₱399. Add hotpot for ₱499 and come hungry with the whole crew.","Unlimited cravings from ₱399"],["Pork or beef: which plate wins for you? Comment your pick, then message us to reserve your buffet table.","Pick your unlimited favorite"],["Four people, one sulit feast. Enjoy the barkada rate from ₱399 each or add hotpot for ₱499.","The barkada feast starts at ₱399"]],
    kht:[["Coffee, Wi-Fi, sockets, and a quiet seat whenever you need one. KapeHuan Takoma is open 24/7.","Your 24/7 coffee workspace"],["Make your coffee break sweeter with fresh cake and coffee, served 24/7 at KapeHuan Takoma.","Coffee + cake, served 24/7"],["Pair your coffee with a slice of cake, any hour you like. Message us for cake orders and availability.","Coffee and cake, 24/7"]],
    iwa:[["Trade screen time for beach time. Enjoy the pool, cozy rooms, and family moments close to Alona.","More family time by the sea"],["Stay close to Alona without staying in the crowd. Slow mornings and a peaceful escape are waiting.","Close to Alona, far from the crowd"],["Planning a group getaway? Bring everyone together with beachfront views, cozy rooms, and space to unwind.","Your group beach escape"]],
    ayo:[["Treat yourself to a creamy Biscoff sundae for only ₱75. Find AYO beside the UB Gym or order through Grab or Maxim.","Biscoff happiness for ₱75"],["Start the day full without overspending. Morning meals begin at ₱69, right beside the UB Gym.","A complete morning meal from ₱69"],["Breakfast, lunch, or dinner: get a complete, satisfying meal made for a student-friendly budget.","Sulit meals for every study day"]],
    kha:[["Step away from the Alona crowd and settle in with good coffee, quiet moments, and an ocean view.","Alona's hidden coffee gem"],["Slow down with coffee as the sun sets over Alona. Your best golden-hour seat is ready.","Coffee tastes better at sunset"],["Coffee in hand, feet in the sand. Make your next Alona break simple and unhurried.","Beach days need better coffee"]],
    iwh:[["Stay close to what matters: only minutes from ICM and downtown Tagbilaran, with a comfortable room waiting.","Stay near everything"],["No long waits and no complicated arrival. Check in quickly with 24/7 assistance and Wi-Fi ready.","Fast, easy hotel check-in"],["Get a clean and comfortable room from ₱800 per night without stretching your travel budget.","Clean rooms from ₱800"]]
  };
  const hashes={patron:["b949cedefd","a4c9d3af50","3543936bc2"],awi:["6887c95be5","ac98adef5a","dc03cabb8d"],kht:["50c6e57ffe","b2155ffb72","86d2530b36"],iwa:["15492b3b3e","2572bff2d2","a4fa64cdd2"],ayo:["bad256211e","3eec474455","2146e45965"],kha:["b56183ba9f","9085e9e4fb","922d71767c"],iwh:["1078316207","2206477eb9","cae5f706e8"]};
  const creatives=businesses.flatMap(b=>copy[b.key].map((c,i)=>({id:`${b.key}${i+1}-${hashes[b.key][i]}`,business:b.name,key:b.key,profile:b.profile,image:`approval-creatives/${b.key}${i+1}.jpg`,primary:c[0],headline:c[1],description:b.proof})));
  let approvals={},selectedBusiness=businesses[0].name;
  const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const state=c=>approvals[c.id]||{status:"pending",note:""};
  function totals(){const n={approved:0,revision:0,rejected:0,pending:0};creatives.forEach(c=>n[state(c).status]++);document.querySelector("#approvalTotals").innerHTML=Object.entries(n).reverse().map(([k,v])=>`<span><b>${v}</b> ${k==="revision"?"Revision":k}</span>`).join("")}
  function tabs(){document.querySelector("#approvalBusinessTabs").innerHTML=businesses.map(b=>{const g=creatives.filter(c=>c.business===b.name),a=g.filter(c=>state(c).status==="approved").length;return `<button type="button" class="${b.name===selectedBusiness?"active":""}" data-approval-business="${esc(b.name)}"><img src="${b.profile}" alt=""><span>${esc(b.name)}</span><b>${a} of ${g.length} approved</b></button>`}).join("");document.querySelectorAll("[data-approval-business]").forEach(x=>x.onclick=()=>{selectedBusiness=x.dataset.approvalBusiness;render()})}
  function cards() {
    const filter = document.querySelector("#approvalFilter").value;
    const group = creatives.filter(creative => creative.business === selectedBusiness);
    const visible = group.filter(creative => filter === "all" || state(creative).status === filter);
    document.querySelector("#approvalBusinessName").textContent = selectedBusiness;
    document.querySelector("#approvalBusinessCount").textContent = `${visible.length} creative${visible.length === 1 ? "" : "s"} shown`;
    document.querySelector("#approvalGrid").innerHTML = visible.length ? visible.map(creative => {
      const approval = state(creative);
      return `<article class="approval-card status-${approval.status}" data-creative-id="${creative.id}" data-selected-status="${approval.status}">
        <div class="meta-ad"><header><img src="${creative.profile}" alt=""><div><strong>${esc(creative.business)}</strong><span>Sponsored · Public</span></div><b>•••</b></header><p class="meta-primary">${esc(creative.primary)}</p><img class="meta-creative" src="${creative.image}" alt="${esc(creative.headline)} creative"><div class="meta-link"><div><small>${esc(creative.business.toUpperCase())}</small><strong>${esc(creative.headline)}</strong><span>${esc(creative.description)}</span></div><button type="button" tabindex="-1">Send Message</button></div><div class="meta-social"><span>Like</span><span>Comment &nbsp; Share</span></div></div>
        <div class="approval-review"><div class="approval-state"><span class="approval-badge ${approval.status}">${approval.status === "revision" ? "Needs revision" : approval.status}</span>${approval.updatedAt ? `<time>Saved ${new Date(approval.updatedAt).toLocaleString("en-PH")}</time>` : ""}</div><p class="approval-instruction">1. Choose a decision &nbsp; 2. Add a comment &nbsp; 3. Submit the review</p><div class="approval-actions"><button type="button" class="${approval.status === "approved" ? "selected" : ""}" data-status="approved">Approve</button><button type="button" class="${approval.status === "revision" ? "selected" : ""}" data-status="revision">Needs revision</button><button type="button" class="${approval.status === "rejected" ? "selected" : ""}" data-status="rejected">Reject</button></div><label>Comment<textarea maxlength="600" placeholder="Explain what is approved or what needs to change...">${esc(approval.note)}</textarea></label><button type="button" class="approval-submit">Submit review</button><p class="card-approval-message" role="status"></p></div>
      </article>`;
    }).join("") : `<div class="approval-empty">No creatives match this status.</div>`;
    document.querySelectorAll(".approval-actions button").forEach(button => button.onclick = selectStatus);
    document.querySelectorAll(".approval-submit").forEach(button => button.onclick = save);
  }
  function render(){totals();tabs();cards()}
  function selectStatus(event) {
    const card = event.currentTarget.closest("[data-creative-id]");
    card.dataset.selectedStatus = event.currentTarget.dataset.status;
    card.querySelectorAll(".approval-actions button").forEach(button => button.classList.toggle("selected", button === event.currentTarget));
    card.querySelector(".card-approval-message").textContent = "Decision selected. Add your comment, then submit.";
  }
  async function save(event) {
    const card = event.currentTarget.closest("[data-creative-id]");
    const creativeId = card.dataset.creativeId;
    const status = card.dataset.selectedStatus;
    const note = card.querySelector("textarea").value.trim();
    const message = card.querySelector(".card-approval-message");
    if (!status || status === "pending") {
      message.textContent = "Choose Approve, Needs revision, or Reject first.";
      return;
    }
    if ((status === "revision" || status === "rejected") && !note) {
      message.textContent = "Please add a comment explaining what needs to change.";
      card.querySelector("textarea").focus();
      return;
    }
    card.querySelectorAll("button").forEach(button => button.disabled = true);
    message.textContent = "Submitting review...";
    try {
      const response = await fetch(approvalUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creativeId, status, note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save decision.");
      approvals[creativeId] = body.approval;
      document.querySelector("#approvalMessage").textContent = "Review submitted and saved.";
      render();
    } catch (error) {
      message.textContent = error.message;
      card.querySelectorAll("button").forEach(button => button.disabled = false);
    }
  }
  async function init(){document.querySelector("#approvalFilter").onchange=cards;if(token)try{const r=await fetch(approvalUrl(),{cache:"no-store"}),body=await r.json();if(!r.ok)throw new Error(body.error);approvals=body.approvals||{}}catch(error){document.querySelector("#approvalMessage").textContent=error.message||"Approval history could not be loaded."}else document.querySelector("#approvalMessage").textContent="Open the private dashboard link to save approvals.";render()}
  init();
})();
