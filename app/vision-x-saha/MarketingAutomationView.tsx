"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tone = "good" | "warn" | "bad" | "info" | "muted";
type Tab = "overview" | "audience" | "sequences" | "operations" | "changelog";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`vxs-badge ${tone}`}>{children}</span>;
}

function count(value: unknown) {
  return Number(value || 0).toLocaleString("en-PH");
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function label(value: unknown) {
  return String(value || "Not recorded").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function when(value: unknown) {
  if (!value) return "Not scheduled";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Not scheduled" : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function segmentTone(segment: string): Tone {
  if (["vip", "repeat", "recent_delivered"].includes(segment)) return "good";
  if (["dormant", "failed_winback", "inquiry"].includes(segment)) return "warn";
  if (segment === "excluded" || segment === "open_issue") return "bad";
  return "muted";
}

export default function MarketingAutomationView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [segment, setSegment] = useState("all");
  const [eligibility, setEligibility] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vision-x-saha/marketing", { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The marketing system could not be loaded.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The marketing system could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateConfig = (key: string, value: unknown) => {
    setData((current: any) => current ? { ...current, config: { ...current.config, [key]: value } } : current);
  };

  const updateSequence = (id: string, key: string, value: unknown) => {
    setData((current: any) => current ? {
      ...current,
      config: {
        ...current.config,
        sequences: current.config.sequences.map((sequence: any) => sequence.id === id ? { ...sequence, [key]: value } : sequence)
      }
    } : current);
  };

  const updateStep = (sequenceId: string, stepId: string, template: string) => {
    setData((current: any) => current ? {
      ...current,
      config: {
        ...current.config,
        sequences: current.config.sequences.map((sequence: any) => sequence.id === sequenceId ? {
          ...sequence,
          steps: sequence.steps.map((step: any) => step.id === stepId ? { ...step, template } : step)
        } : sequence)
      }
    } : current);
  };

  const save = async () => {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/vision-x-saha/marketing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_settings", config: data.config })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Settings could not be saved.");
      setData((current: any) => ({ ...current, config: body.config }));
      setNotice(body.message || "Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const filteredAudience = useMemo(() => {
    const rows = data?.audience || [];
    return rows.filter((row: any) => {
      if (segment !== "all" && row.segment !== segment) return false;
      if (eligibility === "eligible" && !row.eligible) return false;
      if (eligibility === "waiting" && row.eligible) return false;
      return true;
    }).slice(0, 200);
  }, [data, eligibility, segment]);

  if (loading && !data) return <><header className="vxs-section-header"><div><p>Lifecycle marketing</p><h2>SMS Marketing</h2><span>Preparing the customer segmentation preview.</span></div></header><div className="vxs-demo-note"><strong>Loading</strong><span>Reading existing CRM customer history. No messages are being sent.</span></div></>;
  if (!data) return <><header className="vxs-section-header"><div><p>Lifecycle marketing</p><h2>SMS Marketing</h2><span>Customer segmentation and Mel automation.</span></div></header><div className="vxs-demo-note"><strong>Unable to load</strong><span>{error || "The marketing dashboard is unavailable."}</span><button className="vxs-refresh" onClick={() => void load()}>Retry</button></div></>;

  const config = data.config;
  const summary = data.summary || {};
  const readiness = data.readiness || {};
  const analytics = data.analytics || {};
  const segments = Object.entries(summary.bySegment || {}).sort((left: any, right: any) => right[1] - left[1]);

  return <>
    <header className="vxs-section-header"><div><p>Lifecycle marketing</p><h2>SMS Marketing</h2><span>Partition existing customers by history, feed replies to Mel, and attribute orders to each sequence.</span></div><div className="vxs-header-actions"><button className="vxs-secondary" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing" : "Refresh preview"}</button><button className="vxs-primary" onClick={save} disabled={saving}>{saving ? "Saving" : "Save setup"}</button></div></header>

    {config.activationLocked
      ? <section className="vxs-marketing-lock"><div><Badge tone="warn">Activation locked</Badge><strong>No enrollment, marketing SMS, Pancake writes, or bulk alerts can run.</strong><span>The system stays in preview mode until the server activation flag is set.</span></div><div><span>Mode</span><strong>{label(config.mode)}</strong><small>Server lock active</small></div></section>
      : <section className="vxs-marketing-lock" style={{ borderColor: config.mode === "live" ? "#b42318" : undefined }}><div><Badge tone={config.mode === "live" ? "bad" : config.mode === "dry_run" ? "info" : "good"}>{config.mode === "live" ? "Live sending" : config.mode === "dry_run" ? "Dry run" : "Activation unlocked"}</Badge><strong>{config.mode === "live" ? "Live mode sends real SMS to customers at the scheduled time." : config.mode === "dry_run" ? "Dry run previews enrollments and messages. Nothing is sent." : "Choose a mode, then Save setup to apply."}</strong><span>Set the mode, enable enrollment and SMS sending for live, then press Save setup. Opt-outs via do not contact and STOP are always honored.</span></div><div className="vxs-marketing-activation" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}><label>Mode<select value={config.mode} onChange={event => updateConfig("mode", event.target.value)}><option value="off">Off</option><option value="dry_run">Dry run (no sends)</option><option value="live">Live (sends SMS)</option></select></label><label className="vxs-marketing-switch"><input type="checkbox" checked={config.enrollmentEnabled} onChange={event => updateConfig("enrollmentEnabled", event.target.checked)} /><span>Enrollment</span></label><label className="vxs-marketing-switch"><input type="checkbox" checked={config.smsSendingEnabled} onChange={event => updateConfig("smsSendingEnabled", event.target.checked)} /><span>SMS sending</span></label></div></section>}
    {notice ? <div className="vxs-sms-notice good"><Badge tone="good">Saved</Badge><span>{notice}</span></div> : null}
    {error ? <div className="vxs-sms-notice bad"><Badge tone="bad">Error</Badge><span>{error}</span></div> : null}

    <nav className="vxs-sms-tabs vxs-marketing-tabs" aria-label="SMS marketing sections">{([
      ["overview", "Overview"], ["audience", "Audience"], ["sequences", "Sequences"], ["operations", "Operations"], ["changelog", "Changelog"]
    ] as Array<[Tab, string]>).map(([id, name]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{name}</button>)}</nav>

    {tab === "overview" ? <>
      <section className="vxs-customer-summary vxs-marketing-summary"><div><span>Customers evaluated</span><strong>{count(summary.evaluated)}</strong></div><div><span>Eligible when activated</span><strong>{count(summary.eligible)}</strong></div><div><span>Protected from marketing</span><strong>{count(summary.protected)}</strong></div><div><span>Excluded</span><strong>{count(summary.excluded)}</strong></div><div><span>Active enrollments</span><strong>{count(data.enrollments?.length)}</strong></div></section>
      <div className="vxs-two-col">
        <section className="vxs-card"><div className="vxs-card-head"><div><p>Audience partition</p><h3>Customers by lifecycle</h3></div><small>Calculated from live CRM history</small></div><div className="vxs-marketing-segment-grid">{segments.map(([name, total]: any) => <button key={name} onClick={() => { setSegment(name); setTab("audience"); }}><Badge tone={segmentTone(name)}>{label(name)}</Badge><strong>{count(total)}</strong><span>View customers</span></button>)}</div></section>
        <section className="vxs-card"><div className="vxs-card-head"><div><p>System readiness</p><h3>Safe build status</h3></div><Badge tone={config.activationLocked ? "warn" : "good"}>{config.activationLocked ? "Locked" : "Ready"}</Badge></div><div className="vxs-marketing-readiness">{[
          ["Customer source", readiness.customerSource], ["Segmentation engine", readiness.segmentation], ["InfoTXT", readiness.infoTxt], ["Mel AI", readiness.mel], ["Pancake POS", readiness.pancake]
        ].map(([name, ready]) => <div key={String(name)}><span>{name}</span><Badge tone={ready ? "good" : "warn"}>{ready ? "Connected" : "Needs setup"}</Badge></div>)}</div></section>
      </div>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Automation path</p><h3>What happens after activation</h3></div></div><div className="vxs-marketing-flow"><div><b>1</b><strong>CRM history</strong><span>Evaluate every customer</span></div><div><b>2</b><strong>One segment</strong><span>Choose the right sequence</span></div><div><b>3</b><strong>InfoTXT</strong><span>Send the scheduled message</span></div><div><b>4</b><strong>Mel</strong><span>Handle replies and orders</span></div><div><b>5</b><strong>Pancake</strong><span>Create confirmed orders</span></div><div><b>6</b><strong>Results</strong><span>Track delivery and revenue</span></div></div></section>
    </> : null}

    {tab === "audience" ? <>
      <section className="vxs-card vxs-marketing-toolbar"><label>Segment<select value={segment} onChange={event => setSegment(event.target.value)}><option value="all">All segments</option>{segments.map(([name]) => <option key={name} value={name}>{label(name)}</option>)}</select></label><label>Eligibility<select value={eligibility} onChange={event => setEligibility(event.target.value)}><option value="all">All customers</option><option value="eligible">Eligible when activated</option><option value="waiting">Not eligible now</option></select></label><div><span>Preview rows</span><strong>{count(filteredAudience.length)}</strong><small>Maximum 200 displayed</small></div></section>
      <section className="vxs-card vxs-customer-table-card"><div className="vxs-card-head"><div><h3>Enrollment preview</h3><span>Evaluation only. No customer is enrolled.</span></div><Badge tone="warn">Preview</Badge></div><div className="vxs-customer-table-wrap"><div className="vxs-table vxs-marketing-table"><div className="vxs-tr vxs-th"><span>Customer</span><span>Segment</span><span>Eligibility</span><span>Priority</span><span>Sequence</span><span>Reason</span><span>First SMS preview</span></div>{filteredAudience.map((row: any) => <div className="vxs-tr" key={row.customerId}><span><strong>{row.name}</strong><small>{row.phoneMasked}</small></span><span><Badge tone={segmentTone(row.segment)}>{label(row.segment)}</Badge></span><span><Badge tone={row.eligible ? "good" : "muted"}>{row.eligible ? "Eligible" : "Waiting"}</Badge><small>{row.nextEligibleDate ? when(row.nextEligibleDate) : ""}</small></span><span><strong>{row.priorityScore}</strong></span><span><strong>{row.sequenceId ? label(row.sequenceId) : "None"}</strong></span><span><small>{row.reason}</small></span><span><small>{row.preview || "No message scheduled"}</small></span></div>)}</div></div></section>
    </> : null}

    {tab === "sequences" ? <>
      <section className="vxs-card vxs-marketing-settings"><div className="vxs-card-head"><div><p>Launch limits</p><h3>Sequence controls</h3></div><Badge tone="warn">Activation locked</Badge></div><div className="vxs-marketing-setting-grid"><label>Daily enrollment limit<input type="number" min="1" max="5000" value={config.dailyEnrollmentLimit} onChange={event => updateConfig("dailyEnrollmentLimit", Number(event.target.value))} /></label><label>Bulk handoff quantity<input type="number" min="20" max="1000" value={config.bulkOrderThreshold} onChange={event => updateConfig("bulkOrderThreshold", Number(event.target.value))} /></label><label>Bulk alert mobile<input value={config.bulkAlertNumber} onChange={event => updateConfig("bulkAlertNumber", event.target.value)} /></label><label>Sending starts<input type="time" value={config.quietStart} onChange={event => updateConfig("quietStart", event.target.value)} /></label><label>Sending ends<input type="time" value={config.quietEnd} onChange={event => updateConfig("quietEnd", event.target.value)} /></label><label>SMS cost (PHP each)<input type="number" min="0" max="50" step="0.05" value={config.smsUnitCostPhp} onChange={event => updateConfig("smsUnitCostPhp", Number(event.target.value))} /></label></div></section>
      <div className="vxs-marketing-sequences">{config.sequences.map((sequence: any) => <section className="vxs-card" key={sequence.id}><div className="vxs-card-head"><div><p>{label(sequence.segment)}</p><h3>{sequence.name}</h3></div><label className="vxs-marketing-switch"><input type="checkbox" checked={sequence.enabled} onChange={event => updateSequence(sequence.id, "enabled", event.target.checked)} /><span>{sequence.enabled ? "Included" : "Disabled"}</span></label></div><div className="vxs-marketing-sequence-meta"><span>{sequence.discountPercent}% standard offer</span><span>{sequence.cooldownDays} day cooldown</span><span>{sequence.steps.length} step(s)</span></div>{sequence.steps.map((step: any) => <label className="vxs-marketing-step" key={step.id}><span><strong>{step.label}</strong><small>{step.delayDays ? `${step.delayDays} days after the previous step` : "First message"}</small></span><textarea maxLength={459} value={step.template} onChange={event => updateStep(sequence.id, step.id, event.target.value)} /><small>{step.template.length} characters. Customer-facing URLs are removed when saved.</small></label>)}</section>)}</div>
    </> : null}

    {tab === "operations" ? <>
      {analytics.totals.sent === 0 && analytics.totals.enrolled === 0
        ? <div className="vxs-demo-note"><strong>No sends yet</strong><span>Success metrics populate after the first send. In live or dry-run mode the batch runs at {config.quietStart} to {config.quietEnd} Manila time.</span></div>
        : null}
      <section className="vxs-customer-summary vxs-marketing-summary"><div><span>Messages sent</span><strong>{count(analytics.totals.sent)}</strong></div><div><span>Delivery rate</span><strong>{analytics.rates.deliverability}%</strong></div><div><span>Reply rate</span><strong>{analytics.rates.replyRate}%</strong></div><div><span>Order rate</span><strong>{analytics.rates.orderRate}%</strong></div><div><span>Orders</span><strong>{count(analytics.totals.ordered)}</strong></div><div><span>Revenue</span><strong>{money(analytics.totals.revenue)}</strong></div></section>
      <section className="vxs-customer-summary vxs-marketing-summary"><div><span>SMS cost</span><strong>{money(analytics.economics.totalCost)}</strong><small>at {money(analytics.economics.smsUnitCostPhp)}/SMS</small></div><div><span>Net profit</span><strong>{money(analytics.economics.netProfit)}</strong></div><div><span>ROI</span><strong>{analytics.economics.roi ? `${analytics.economics.roi}x` : "-"}</strong></div><div><span>Replies</span><strong>{count(analytics.totals.replied)}</strong></div><div><span>Reply to order</span><strong>{analytics.rates.replyToOrder}%</strong></div><div><span>Bulk handoffs</span><strong>{count(analytics.totals.bulkHandoffs)}</strong></div></section>

      <div className="vxs-two-col">
        <section className="vxs-card"><div className="vxs-card-head"><div><p>Conversion funnel</p><h3>Enrolled to order</h3></div></div><div className="vxs-marketing-flow"><div><b>{count(analytics.totals.enrolled)}</b><strong>Enrolled</strong><span>Entered a sequence</span></div><div><b>{count(analytics.totals.sent)}</b><strong>Sent</strong><span>SMS accepted</span></div><div><b>{count(analytics.totals.replied)}</b><strong>Replied</strong><span>{analytics.rates.replyRate}% of sent</span></div><div><b>{count(analytics.totals.ordered)}</b><strong>Ordered</strong><span>{analytics.rates.orderRate}% of sent</span></div></div></section>
        <section className="vxs-card"><div className="vxs-card-head"><div><p>Per segment</p><h3>What actually converts</h3></div><small>Ranked by revenue</small></div><div className="vxs-customer-table-wrap"><div className="vxs-table"><div className="vxs-tr vxs-th"><span>Segment</span><span>Sent</span><span>Replies</span><span>Orders</span><span>Order %</span><span>Revenue</span></div>{analytics.bySegment.length ? analytics.bySegment.map((row: any) => <div className="vxs-tr" key={row.segment}><span><Badge tone={segmentTone(row.segment)}>{label(row.segment)}</Badge></span><span>{count(row.sent)}</span><span>{count(row.replied)}</span><span>{count(row.ordered)}</span><span>{row.orderRate}%</span><span>{money(row.revenue)}</span></div>) : <div className="vxs-tr"><span>No segment activity yet</span><span></span><span></span><span></span><span></span><span></span></div>}</div></div></section>
      </div>

      <section className="vxs-card"><div className="vxs-card-head"><div><p>Last 14 days</p><h3>Sends and orders</h3></div><small>Asia/Manila</small></div><div className="vxs-marketing-trend">{analytics.daily.map((day: any) => { const peak = Math.max(1, ...analytics.daily.map((d: any) => d.sent)); return <div className="vxs-trend-col" key={day.date} title={`${day.date}: ${day.sent} sent, ${day.ordered} orders, ${money(day.revenue)}`}><div className="vxs-trend-bars"><span className="sent" style={{ height: `${Math.round((day.sent / peak) * 100)}%` }}></span><span className="ordered" style={{ height: `${Math.round((day.ordered / peak) * 100)}%` }}></span></div><small>{day.date.slice(5)}</small></div>; })}</div><div className="vxs-trend-legend"><span><i className="sent"></i>Sent</span><span><i className="ordered"></i>Orders</span></div></section>

      <section className="vxs-card"><div className="vxs-card-head"><div><p>Mel routing</p><h3>Reply handling</h3></div></div><div className="vxs-rule-list"><p><b>Normal questions</b><span>Mel answers over SMS using the customer and order history.</span></p><p><b>Planting guide</b><span>Mel tells the customer to search the Facebook page. No URL is sent.</span></p><p><b>Plant issue</b><span>Mel offers 20% for failed plants or 30% for dead or rotten arrivals.</span></p><p><b>Normal order</b><span>Mel collects details, gets YES, and creates the Pancake order.</span></p><p><b>20 units or more</b><span>Mel stops order creation and prepares an alert for {config.bulkAlertNumber}.</span></p></div></section>
    </> : null}

    {tab === "changelog" ? <section className="vxs-card"><div className="vxs-card-head"><div><p>Release history</p><h3>VISION X SAHA SMS Marketing</h3></div><Badge tone="info">Version 1.1.0</Badge></div><div className="vxs-marketing-changelog"><article><time>October 15, 2026</time><div><strong>Success metrics and go-live controls</strong><ul><li>Added success analytics: delivery, reply and order rates, revenue, SMS cost, net profit, and ROI.</li><li>Added per-segment performance and a 14-day sends-and-orders trend.</li><li>Added in-dashboard activation controls (Off, Dry run, Live) and 7 PM Manila send timing.</li><li>Tuned win-back copy to a friendly single-segment SMS with a STOP opt-out.</li></ul></div></article><article><time>October 15, 2026</time><div><strong>Marketing foundation built</strong><ul><li>Added live CRM customer evaluation and lifecycle segmentation.</li><li>Added enrollment preview, sequence editor, operations view, and activation lock.</li><li>Added Mel routing rules for normal orders, plant issues, planting-guide questions, and bulk handoff.</li><li>Added 10%, 20%, and 30% offer policies.</li><li>Added InfoTXT, Mel, Pancake, and bulk-alert readiness checks.</li><li>Kept every outbound and write action disabled until owner activation.</li></ul></div></article></div></section> : null}
  </>;
}
