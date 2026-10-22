"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomersView from "./CustomersView";
import MarketingAutomationView from "./MarketingAutomationView";
import PostLibraryView from "./PostLibraryView";
import WaybillPrintCenter from "./WaybillPrintCenter";

type View = "command" | "guide" | "januploader" | "orders" | "print" | "complaints" | "customers" | "sms" | "marketing" | "ltv" | "inventory" | "capital" | "billing" | "advertising" | "posts" | "traffic" | "integrations" | "contract";
type Tone = "good" | "warn" | "bad" | "info" | "muted";
type ReportingPeriod = "today" | "7d" | "mtd" | "billing" | "initial_settlement" | "current_settlement";
type Provider = { connected: boolean; data?: any; error?: string };
type LiveData = {
  generatedAt: string;
  meta: Provider;
  pancake: Provider;
  landing: Provider;
  traffic: Provider;
  sheet: Provider;
  capi: Provider;
  reconciliation?: {
    period?: { key: ReportingPeriod; label: string; start: string; end: string; timezone: string };
    posLandingOrders: number | null;
    sheetLoggedOrders: number | null;
    orderLogDifference: number | null;
    orderLogsMatch: boolean;
    matchedOrders?: number | null;
    posOnly?: Array<{ id: string; createdAt: string; value: number; status: string; page: string }>;
    sheetOnly?: Array<{ id: string; createdAt: string; value: number; source: string }>;
    sheetRowsComplete?: boolean;
    note?: string;
  };
};

const LANDING_PAGE_URL = "https://www.securecodexpress.xyz/visionsaha";
const LIVE_SAHA_URL = "https://www.securecodexpress.xyz/livesaha";
const REGION7_VISION_URL = "https://www.securecodexpress.xyz/region7lakatan?src=visionxsaha";
const navigation: { id: View; label: string; group: string }[] = [
  { id: "command", label: "Command Center", group: "Overview" },
  { id: "guide", label: "System Guide", group: "Overview" },
  { id: "januploader", label: "Jan Uploader", group: "AI Employees" },
  { id: "sms", label: "Mel SMS AI", group: "AI Employees" },
  { id: "marketing", label: "SMS Marketing", group: "AI Employees" },
  { id: "ltv", label: "LTV & Growth", group: "Growth" },
  { id: "orders", label: "Orders", group: "Operations" },
  { id: "print", label: "Print Center", group: "Operations" },
  { id: "complaints", label: "Courier Complaints", group: "Operations" },
  { id: "customers", label: "Customers", group: "Operations" },
  { id: "inventory", label: "Inventory", group: "Operations" },
  { id: "capital", label: "Capital", group: "Finance" },
  { id: "billing", label: "Billing Report", group: "Finance" },
  { id: "advertising", label: "Advertising", group: "Growth" },
  { id: "posts", label: "Post Library", group: "Growth" },
  { id: "traffic", label: "Landing Traffic", group: "Growth" },
  { id: "integrations", label: "Integrations", group: "System" },
  { id: "contract", label: "Agreement", group: "System" }
];

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`vxs-badge ${tone}`}>{children}</span>;
}

function SectionHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <header className="vxs-section-header"><div><p>{eyebrow}</p><h2>{title}</h2><span>{copy}</span></div>{action}</header>;
}

function php(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function phpPrecise(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function number(value: unknown) {
  return Number(value || 0).toLocaleString("en-PH");
}

function percent(value: unknown) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function label(value: unknown) {
  return String(value || "Not reported").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function dateTime(value: unknown) {
  if (!value) return "Time unavailable";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-PH");
}

function declaredCapitalAmount(entry: any) {
  const recorded = Number(entry?.amount || 0);
  if (recorded > 0) return recorded;
  const text = [entry?.description, entry?.quantity, entry?.notes].filter(Boolean).join(" ");
  const quantity = text.match(/([\d,]+)\s*pcs/i)?.[1];
  const unitCost = text.match(/@\s*(?:PHP|₱)?\s*([\d,.]+)/i)?.[1];
  if (quantity && unitCost && /(lakatan|inventory|stock)/i.test(text)) return Number(quantity.replaceAll(",", "")) * Number(unitCost.replaceAll(",", ""));
  if (/advertising capital/i.test(text) && String(entry?.contributor || "").toLowerCase() === "rustan") return 50000;
  return 0;
}

function statusTone(status: string): Tone {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("return") || normalized.includes("cancel") || normalized.includes("fail") || normalized.includes("reject")) return "bad";
  if (normalized.includes("deliver") || normalized.includes("sent") || normalized.includes("active")) return "good";
  if (normalized.includes("new") || normalized.includes("confirm") || normalized.includes("pack")) return "warn";
  return "info";
}

const stageLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packing: "Packing",
  pushed_to_courier: "Pushed to courier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed_delivery: "Failed delivery",
  returning: "Returning",
  returned: "Returned",
  cancelled: "Cancelled"
};

function stageLabel(value: string) {
  return stageLabels[value] || String(value || "Unknown").replaceAll("_", " ");
}

function LoadingState({ loading, error, refresh }: { loading: boolean; error?: string; refresh: () => void }) {
  return <div className="vxs-demo-note"><strong>{loading ? "Connecting" : "Data unavailable"}</strong><span>{loading ? "Loading the live source." : error || "The source did not return data."}</span><button className="vxs-refresh" onClick={refresh} disabled={loading}>{loading ? "Checking" : "Retry"}</button></div>;
}

function Metrics({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return <section className="vxs-mini-metrics">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}

function CopyPhone({ phone }: { phone?: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const value = String(phone || "").trim();

  async function copy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  if (!value) return <small>No phone number</small>;
  return <button type="button" className={`vxs-copy-phone ${copyState}`} onClick={copy} onMouseDown={event => event.stopPropagation()} aria-label={`Copy customer contact number ${value}`} title="Click to copy customer contact number"><b>{value}</b><small>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Click to copy"}</small></button>;
}

function RecentOrders({ orders, limit = 12 }: { orders: any[]; limit?: number }) {
  if (!orders.length) return <p className="vxs-empty">No orders were returned by Pancake POS.</p>;
  return <div className="vxs-table">
    <div className="vxs-tr vxs-th"><span>Order</span><span>Customer</span><span>Offer</span><span>Value</span><span>Status</span><span>Age</span></div>
    {orders.slice(0, limit).map(order => <div className="vxs-tr" key={order.id}>
      <span><strong>#{order.id}</strong><small>{order.landingPage ? "Landing page" : "Other source"}</small></span>
      <span><strong>{order.customer}</strong><CopyPhone phone={order.phone} /></span>
      <span><strong>{order.bundle}</strong><small>{order.hasUpsell ? "Includes upsell" : "Base order"}</small></span>
      <span><strong>{php(order.value)}</strong></span>
      <span><Badge tone={statusTone(order.status || order.stage)}>{order.status || stageLabel(order.stage)}</Badge></span>
      <span><strong>{Number(order.ageHours || 0).toFixed(1)}h</strong><small>{order.needsAction ? "Needs action" : dateTime(order.createdAt)}</small></span>
    </div>)}
  </div>;
}

function visibleOrderTags(order: any) {
  const saved = Array.isArray(order.tags) ? order.tags.filter(Boolean) : [];
  if (saved.length) return saved;
  return ["failed_delivery", "returning", "returned"].includes(order.stage) ? ["For complain"] : [];
}

function DetailedOrders({ orders, onSelect, onConversation }: { orders: any[]; onSelect: (order: any) => void; onConversation: (order: any) => void }) {
  if (!orders.length) return <p className="vxs-empty vxs-orders-empty">No orders match this filter.</p>;
  return <div className="vxs-table">
    <div className="vxs-tr vxs-th vxs-order-tr"><span>Order</span><span>Customer</span><span>Goods</span><span>COD</span><span>POS</span><span>Courier</span><span>Fulfillment</span><span>Last update</span><span>Tags</span><span>Messages</span></div>
    {orders.map(order => <div role="button" tabIndex={0} className={`vxs-tr vxs-order-tr${order.needsAction ? " needs-action" : ""}`} key={order.id} onClick={() => onSelect(order)} onKeyDown={event => { if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return; event.preventDefault(); onSelect(order); }} aria-label={`Open courier timeline for order ${order.id}`}>
      <span><strong>#{order.id}</strong><small>{dateTime(order.createdAt)}</small></span>
      <span><strong>{order.customer}</strong><CopyPhone phone={order.phone} /></span>
      <span><strong>{number(order.quantity)} pcs</strong><small>{order.hasUpsell ? "Base order + upsell" : order.bundle}</small></span>
      <span><strong>{php(order.value)}</strong><small>{order.landingPage ? "Landing page" : "Other source"}</small></span>
      <span><Badge tone={statusTone(order.posStatus)}>{order.posStatus}</Badge></span>
      <span><strong>{order.courier}</strong><small>{order.tracking || "No tracking yet"}</small><small>{number(order.courierEventCount)} movement(s)</small></span>
      <span><Badge tone={statusTone(order.stage)}>{stageLabel(order.stage)}</Badge><small>{Number(order.stageAgeHours || 0).toFixed(1)}h in stage</small></span>
      <span><strong>{order.latestCourierUpdate}</strong><small>{order.latestCourierNote || (order.needsAction ? "Needs follow-up" : dateTime(order.courierUpdatedAt || order.updatedAt))}</small><small className="vxs-view-timeline">View timeline →</small></span>
      <span className="vxs-order-tags">{visibleOrderTags(order).length ? visibleOrderTags(order).map((tag: string) => <small key={tag}>{tag}</small>) : <small className="empty">No tag</small>}</span>
      <span className="vxs-order-chat-cell"><button type="button" className="vxs-order-chat-button" onClick={event => { event.stopPropagation(); onConversation(order); }} aria-label={`Open SMS chat for order ${order.id}`}>SMS chat</button><small>InfoTXT record</small></span>
    </div>)}
  </div>;
}

type CourierEventType = "pickup" | "departure" | "arrival" | "delivering" | "delivered" | "failed" | "return" | "movement";

function courierEventType(update: any): CourierEventType {
  const text = `${update?.title || ""} ${update?.note || ""}`.toLowerCase();
  if (/return registration|returning|return to sender|\brts\b|returned/.test(text)) return "return";
  if (/delivery failed|failed delivery|unsuccessful|reject|refus|undeliver/.test(text)) return "failed";
  if (/delivered|received by consignee|successfully delivered/.test(text)) return "delivered";
  if (/delivering|out for delivery/.test(text)) return "delivering";
  if (/pickup|picked up|collected/.test(text)) return "pickup";
  if (/arrival|arrived/.test(text)) return "arrival";
  if (/departure|departed/.test(text)) return "departure";
  return "movement";
}

function eventTime(value: unknown) {
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function durationLabel(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Time unavailable";
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${remainingMinutes}m`;
  return `${remainingMinutes}m`;
}

function exceptionGuidance(note: string) {
  const text = note.toLowerCase();
  if (/turned off|phone.*off/.test(text)) return { meaning: "The courier could not reach the customer because the phone was off.", action: "Call again, send an SMS, and confirm the phone number before the next attempt." };
  if (/no one answers|no answer/.test(text)) return { meaning: "The rider called or visited, but the customer did not answer.", action: "Contact the customer now and confirm an available delivery window." };
  if (/change of delivery time|reschedul|delivery time/.test(text)) return { meaning: "The customer requested a different delivery time.", action: "Confirm the requested schedule and monitor the next out-for-delivery scan." };
  if (/without opening|reject|refus/.test(text)) return { meaning: "The parcel was rejected before completion of delivery.", action: "Contact the customer for the exact reason and preserve any courier proof before deciding on a reattempt." };
  if (/packaging|not standardized/.test(text)) return { meaning: "The courier flagged the parcel packaging.", action: "Review the attached proof and correct the warehouse packing process before reshipment." };
  if (note.trim()) return { meaning: `Courier reason: ${note.trim()}`, action: "Review the courier proof and contact the customer or courier before the next movement." };
  return { meaning: "The courier marked the delivery attempt unsuccessful without a detailed reason.", action: "Check the official J&T tracker and contact the customer before a reattempt or return." };
}

function analyzeCourierJourney(order: any, updates: any[]) {
  const chronological = [...updates].sort((a, b) => eventTime(a.at) - eventTime(b.at));
  const totals = chronological.reduce((result, update) => {
    result[courierEventType(update)] += 1;
    return result;
  }, { pickup: 0, departure: 0, arrival: 0, delivering: 0, delivered: 0, failed: 0, return: 0, movement: 0 } as Record<CourierEventType, number>);
  const seen = { pickup: 0, departure: 0, arrival: 0, delivering: 0, delivered: 0, failed: 0, return: 0, movement: 0 } as Record<CourierEventType, number>;
  const enriched = chronological.map((update, index) => {
    const type = courierEventType(update);
    seen[type] += 1;
    const previous = chronological[index - 1];
    const elapsed = previous && eventTime(previous.at) && eventTime(update.at) ? durationLabel(eventTime(update.at) - eventTime(previous.at)) : "";
    let title = "Courier movement recorded";
    let detail = elapsed ? `${elapsed} since the previous recorded scan.` : "This is the first recorded courier scan.";
    let next = "Watch for the next carrier scan.";

    if (type === "pickup") {
      title = "Parcel collected from the sender";
      detail = `J&T accepted the parcel into its network${elapsed ? ` ${elapsed} after the previous system event` : ""}.`;
      next = "Next expected: departure from the origin facility.";
    } else if (type === "arrival") {
      title = `Arrived at courier facility ${seen.arrival} of ${totals.arrival}`;
      detail = `${elapsed ? `Travel from the previous scan took ${elapsed}. ` : ""}The parcel entered another sorting or delivery facility. Pancake did not provide the branch name.`;
      next = "Next expected: facility departure or dispatch for final delivery.";
    } else if (type === "departure") {
      title = `Departed courier facility ${seen.departure} of ${totals.departure}`;
      detail = `${elapsed ? `Processing or travel since the previous scan took ${elapsed}. ` : ""}The parcel left a sorting facility for its next route leg. Pancake did not provide the branch name.`;
      next = "Next expected: arrival at the next facility.";
    } else if (type === "delivering") {
      title = `Out for delivery - attempt ${seen.delivering}`;
      detail = `${elapsed ? `The final-mile dispatch happened ${elapsed} after the previous scan. ` : ""}A rider has the parcel for delivery to the customer.`;
      next = "Next expected: delivered, a failed-attempt reason, or a reschedule.";
    } else if (type === "delivered") {
      title = "Delivered to the customer";
      detail = `${elapsed ? `Delivery completed ${elapsed} after the previous scan. ` : ""}${totals.delivering ? `The history shows ${totals.delivering} out-for-delivery attempt${totals.delivering === 1 ? "" : "s"}.` : "The courier marked the parcel complete."}`;
      next = "Journey complete. No courier follow-up is required unless the customer disputes receipt.";
    } else if (type === "failed") {
      const guidance = exceptionGuidance(String(update.note || ""));
      title = `Delivery attempt ${Math.max(seen.delivering, seen.failed)} was unsuccessful`;
      detail = `${elapsed ? `The failure was recorded ${elapsed} after the previous scan. ` : ""}${guidance.meaning}`;
      next = guidance.action;
    } else if (type === "return") {
      title = "Return-to-sender process registered";
      detail = `${elapsed ? `Return handling began ${elapsed} after the previous scan. ` : ""}${totals.failed ? `The history contains ${totals.failed} failed delivery event${totals.failed === 1 ? "" : "s"}.` : "The courier moved the parcel into its return flow."}`;
      next = "Monitor until the parcel is physically returned, then inspect it before restocking.";
    }

    return { ...update, type, title, detail, next, elapsed, rawTitle: String(update.title || "Courier update") };
  });

  const firstTimestamp = chronological.find(update => eventTime(update.at))?.at;
  const lastTimestamp = [...chronological].reverse().find(update => eventTime(update.at))?.at;
  const journeyTime = firstTimestamp && lastTimestamp ? durationLabel(eventTime(lastTimestamp) - eventTime(firstTimestamp)) : "Unavailable";
  const latestType = chronological.length ? courierEventType(chronological[chronological.length - 1]) : "movement";
  let assessment = { tone: "info" as Tone, label: "In progress", headline: "Courier journey is still moving.", action: "Monitor the next scan and use the official tracker when a facility name is required." };
  if (latestType === "delivered") assessment = { tone: "good", label: "Complete", headline: `Delivered after ${journeyTime} of recorded movement.`, action: "No courier action is needed unless there is a customer dispute." };
  else if (latestType === "return") assessment = { tone: "bad", label: "Return risk", headline: "The parcel has entered return-to-sender processing.", action: "Do not restock yet. Wait for physical receipt and inspection." };
  else if (latestType === "failed") assessment = { tone: "bad", label: "Action needed", headline: "The latest delivery attempt failed.", action: exceptionGuidance(String(chronological[chronological.length - 1]?.note || "")).action };
  else if (latestType === "delivering") assessment = { tone: "warn", label: "Final mile", headline: `Delivery attempt ${totals.delivering} is in progress.`, action: "Keep the customer reachable and monitor for completion or a failure reason." };
  else if (order.needsAction) assessment = { tone: "bad", label: "Stalled", headline: `No newer courier scan for ${Number(order.stageAgeHours || 0).toFixed(1)} hours.`, action: "Open the official tracker and escalate to J&T if the same stage remains unchanged." };

  return { totals, enriched: enriched.reverse(), journeyTime, assessment };
}

function RiderContact({ order }: { order: any }) {
  const [contact, setContact] = useState<{ phone: string; telHref: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setContact(null);
    setLoading(false);
    setNotice("");
  }, [order.id]);

  async function reveal() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/vision-x-saha/rider-contact?orderId=${encodeURIComponent(String(order.id))}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The rider contact could not be retrieved.");
      if (!body.available) {
        setNotice(body.message || "The courier has not supplied a rider contact number.");
        return;
      }
      setContact({ phone: String(body.phone || ""), telHref: String(body.telHref || "") });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The rider contact could not be retrieved.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPhone() {
    if (!contact?.phone) return;
    try {
      await navigator.clipboard.writeText(contact.phone);
      setNotice("Rider number copied.");
    } catch {
      setNotice("Copy was blocked by the browser. Select the number manually.");
    }
  }

  return <div className="vxs-rider-contact">
    <div><span>Rider contact</span><strong>{contact?.phone || order.riderPhoneMasked || "Not provided by courier"}</strong></div>
    {order.riderPhoneAvailable ? <div className="vxs-rider-contact-actions">{contact ? <><button type="button" onClick={copyPhone}>Copy</button><a href={contact.telHref}>Call rider</a></> : <button type="button" onClick={reveal} disabled={loading}>{loading ? "Retrieving…" : "Reveal number"}</button>}</div> : null}
    {notice ? <small aria-live="polite">{notice}</small> : null}
  </div>;
}

function CourierTimelineDrawer({ order, onClose, onOpenConversation }: { order: any; onClose: () => void; onOpenConversation: () => void }) {
  const [smsProof, setSmsProof] = useState<any>(null);
  const [smsProofLoading, setSmsProofLoading] = useState(true);
  const [smsProofError, setSmsProofError] = useState("");
  const [orderActivity, setOrderActivity] = useState<any>(null);
  const [orderActivityLoading, setOrderActivityLoading] = useState(true);
  const [orderActivityError, setOrderActivityError] = useState("");
  const [complaintCreating, setComplaintCreating] = useState(false);
  const [complaintNotice, setComplaintNotice] = useState("");
  const updates = Array.isArray(order.courierUpdates) ? order.courierUpdates : [];
  const journey = analyzeCourierJourney(order, updates);
  const facilityScans = journey.totals.arrival + journey.totals.departure;
  const exceptions = journey.totals.failed + journey.totals.return;

  const loadSmsProof = useCallback(async (silent = false) => {
    if (!silent) setSmsProofLoading(true);
    try {
      const response = await fetch(`/api/vision-x-saha/sms-automation?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "SMS proof could not be loaded.");
      setSmsProof(body.proof || null);
      setSmsProofError("");
    } catch (error) {
      setSmsProofError(error instanceof Error ? error.message : "SMS proof could not be loaded.");
    } finally {
      if (!silent) setSmsProofLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    setSmsProof(null);
    setSmsProofError("");
    void loadSmsProof();
  }, [loadSmsProof]);

  const loadOrderActivity = useCallback(async () => {
    setOrderActivityLoading(true);
    try {
      const response = await fetch(`/api/vision-x-saha/order-activity?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Order activity could not be loaded.");
      setOrderActivity(body);
      setOrderActivityError("");
    } catch (error) {
      setOrderActivityError(error instanceof Error ? error.message : "Order activity could not be loaded.");
    } finally {
      setOrderActivityLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    setOrderActivity(null);
    setOrderActivityError("");
    void loadOrderActivity();
  }, [loadOrderActivity]);

  const createComplaint = async () => {
    setComplaintCreating(true); setComplaintNotice("");
    try {
      const response = await fetch("/api/vision-x-saha/courier-complaints", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", order, activity: orderActivity }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Complaint case could not be created.");
      setComplaintNotice(`${body.case?.id || "Complaint case"} saved as Draft. Open Courier Complaints to copy and submit it.`);
    } catch (error) { setComplaintNotice(error instanceof Error ? error.message : "Complaint case could not be created."); }
    finally { setComplaintCreating(false); }
  };

  const proofSummary = smsProof?.summary;
  const proofMessages = Array.isArray(smsProof?.messages) ? smsProof.messages : [];
  const otherSms = Array.isArray(smsProof?.otherActivity) ? smsProof.otherActivity : [];
  const smsTone = (status: string): Tone => ["dispatched", "sent"].includes(status) ? "good"
    : ["failed", "not_recorded"].includes(status) ? "bad"
      : ["skipped", "paused", "scheduled", "not_due", "submitting"].includes(status) ? "warn"
        : ["accepted", "queued"].includes(status) ? "info" : "muted";
  const smsStatus = (status: string) => status === "dispatched" || status === "sent" ? "Dispatched"
    : status === "accepted" || status === "queued" ? "Accepted, queued"
      : status === "not_due" || status === "scheduled" ? "Scheduled"
        : status === "not_recorded" ? "No audit record"
          : status === "paused" ? "Paused, not sent"
            : status === "dry_run" ? "Dry run only"
              : status === "submitting" ? "Submitting"
                : status === "skipped" ? "Skipped"
                  : status === "failed" ? "Failed" : label(status);
  const attemptTypeLabel = (type: string) => type === "out_for_delivery" ? "Out for delivery"
    : type === "failed_delivery" ? "Delivery failed"
      : type === "returning" ? "Return started"
        : type === "delivered" ? "Delivered" : label(type);
  return <div className="vxs-drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="vxs-drawer vxs-courier-drawer" role="dialog" aria-modal="true" aria-label={`Courier timeline for order ${order.id}`} onMouseDown={event => event.stopPropagation()}>
    <header><div><p>Courier movement intelligence</p><h2>Order #{order.id}</h2></div><button type="button" aria-label="Close timeline" onClick={onClose}>×</button></header>
    <section className="vxs-courier-summary"><div className="vxs-courier-title"><div><strong>{order.courier}</strong><span>{order.tracking || "No tracking number"}</span></div><Badge tone={statusTone(order.stage)}>{stageLabel(order.stage)}</Badge></div><dl><div><dt>Customer</dt><dd>{order.customer}</dd></div><div><dt>Goods</dt><dd>{number(order.quantity)} pcs</dd></div><div><dt>COD</dt><dd>{php(order.value)}</dd></div><div><dt>Latest scan</dt><dd>{dateTime(order.courierUpdatedAt)}</dd></div>{order.estimatedDeliveryAt ? <div><dt>Courier ETA</dt><dd>{dateTime(order.estimatedDeliveryAt)}</dd></div> : null}{order.sortCode ? <div><dt>Sort code</dt><dd>{order.sortCode}</dd></div> : null}{order.deliveryRider ? <div><dt>Assigned rider</dt><dd>{order.deliveryRider}</dd></div> : null}</dl><RiderContact order={order} />{order.trackingLink ? <a className="vxs-courier-track" href={order.trackingLink} target="_blank" rel="noreferrer">Open official J&amp;T tracker ↗</a> : null}</section>
    {updates.length ? <section className={`vxs-courier-assessment ${journey.assessment.tone}`}><div><p>Operational assessment</p><Badge tone={journey.assessment.tone}>{journey.assessment.label}</Badge></div><strong>{journey.assessment.headline}</strong><span>{journey.assessment.action}</span><div className="vxs-courier-metrics"><div><small>Recorded journey</small><b>{journey.journeyTime}</b></div><div><small>Facility scans</small><b>{facilityScans}</b></div><div><small>Delivery attempts</small><b>{journey.totals.delivering}</b></div><div><small>Exceptions</small><b>{exceptions}</b></div></div></section> : null}
    <section className="vxs-order-activity">
      <div className="vxs-courier-section-head"><div><p>InfoTXT conversation</p><h3>Customer and rider message record</h3></div><button type="button" className="vxs-text-button" onClick={onOpenConversation}>Open full SMS chat</button></div>
      {orderActivityError ? <div className="vxs-sms-proof-error"><strong>Conversation unavailable</strong><span>{orderActivityError}</span></div> : null}
      {orderActivityLoading && !orderActivity ? <div className="vxs-sms-proof-loading"><strong>Checking InfoTXT records</strong><span>Preparing the linked customer and rider conversation.</span></div> : null}
      {orderActivity && !orderActivity.messages?.length ? <div className="vxs-sms-proof-loading"><strong>No linked InfoTXT messages yet</strong><span>New automated messages and customer replies will appear in the full SMS chat once InfoTXT records them.</span></div> : null}
      {orderActivity?.messages?.length ? <div className="vxs-conversation-link"><div><strong>{number(orderActivity.messages.length)} InfoTXT message{orderActivity.messages.length === 1 ? "" : "s"} linked</strong><span>Open the full SMS chat to read the customer and rider conversation.</span></div><button type="button" className="vxs-secondary" onClick={onOpenConversation}>Open SMS chat</button></div> : null}
      <div className="vxs-complaint-action"><div><strong>Need courier investigation?</strong><span>Creates a private draft with this tracking number, courier timeline, and InfoTXT proof. It does not send anything to the courier.</span></div><button type="button" className="vxs-secondary" onClick={() => void createComplaint()} disabled={complaintCreating || !order.tracking}>{complaintCreating ? "Building case" : "Build complaint case"}</button></div>
      {complaintNotice ? <small className="vxs-complaint-notice">{complaintNotice}</small> : null}
    </section>
    <section className="vxs-order-activity">
      <div className="vxs-courier-section-head"><div><p>Final-mile audit</p><h3>Delivery attempts and rider assignment</h3></div>{orderActivity?.deliveryEvents?.length ? <Badge tone="good">Recorded</Badge> : <Badge tone="muted">Waiting</Badge>}</div>
      {orderActivity && !orderActivity.deliveryEvents?.length ? <div className="vxs-sms-proof-loading"><strong>No final-mile event has been recorded</strong><span>The rider is logged only after the courier marks this parcel out for delivery.</span></div> : null}
      {orderActivity?.deliveryEvents?.length ? <ol className="vxs-delivery-attempts">{orderActivity.deliveryEvents.map((event: any) => <li key={event.id} className={event.type}><i aria-hidden="true" /><div><div><strong>Attempt {event.attempt}: {attemptTypeLabel(event.type)}</strong><Badge tone={event.type === "delivered" ? "good" : event.type === "failed_delivery" || event.type === "returning" ? "bad" : "warn"}>{attemptTypeLabel(event.type)}</Badge></div><time>{dateTime(event.occurredAt)}</time><p>{event.courierStatus}{event.courierNote ? `: ${event.courierNote}` : ""}</p>{event.type === "out_for_delivery" ? <small>{event.riderName || "Courier did not supply rider name"}{event.riderPhoneMasked ? ` | Rider contact recorded: ${event.riderPhoneMasked}` : " | Rider number not supplied by courier"}</small> : null}</div></li>)}</ol> : null}
      <small className="vxs-order-activity-note">A repeated courier refresh cannot create a duplicate attempt. A later out-for-delivery scan becomes the next attempt.</small>
    </section>
    <section className="vxs-sms-proof">
      <div className="vxs-courier-section-head"><div><p>Mel SMS AI audit</p><h3>SMS automation proof</h3></div><button type="button" className="vxs-text-button" onClick={() => void loadSmsProof()} disabled={smsProofLoading}>{smsProofLoading ? "Checking" : "Refresh proof"}</button></div>
      {smsProofError ? <div className="vxs-sms-proof-error"><strong>Proof unavailable</strong><span>{smsProofError}</span><button type="button" onClick={() => void loadSmsProof()}>Try again</button></div> : null}
      {!smsProofError && smsProofLoading && !smsProof ? <div className="vxs-sms-proof-loading"><strong>Checking every SMS audit record</strong><span>Matching courier scans with InfoTXT status records.</span></div> : null}
      {proofSummary ? <>
        <div className="vxs-sms-proof-summary"><div><span>Due SMS</span><strong>{number(proofSummary.due)}</strong></div><div><span>Dispatched</span><strong>{number(proofSummary.dispatched)}</strong></div><div><span>Provider queue</span><strong>{number(proofSummary.accepted)}</strong></div><div><span>Scheduled</span><strong>{number(proofSummary.scheduled)}</strong></div><div><span>Issues</span><strong>{number(Number(proofSummary.failed || 0) + Number(proofSummary.skipped || 0) + Number(proofSummary.notRecorded || 0))}</strong></div><div><span>Coverage</span><strong>{Number(proofSummary.coverage || 0).toFixed(1)}%</strong></div></div>
        <div className="vxs-sms-proof-note"><Badge tone={smsProof.mode === "live" ? "good" : "warn"}>{smsProof.mode === "live" ? "Automation live" : `${label(smsProof.mode)} mode`}</Badge><span>Dispatched means InfoTXT released the SMS to the mobile network. It does not confirm that the handset received or opened it.</span></div>
        {proofMessages.length ? <div className="vxs-sms-checklist">{proofMessages.map((message: any) => <article className={smsTone(message.status)} key={message.id}><i aria-hidden="true" /><div className="vxs-sms-check-main"><div className="vxs-sms-check-head"><div><strong>{message.eventLabel}</strong><span>{message.recipient === "rider" ? "Rider SMS" : "Customer SMS"} to {message.destinationMasked}</span></div><Badge tone={smsTone(message.status)}>{smsStatus(message.status)}</Badge></div><dl><div><dt>Courier event</dt><dd>{message.courierStatus}</dd></div><div><dt>Event time</dt><dd>{dateTime(message.eventAt)}</dd></div>{message.dueAt && message.dueAt !== message.eventAt ? <div><dt>SMS due</dt><dd>{dateTime(message.dueAt)}</dd></div> : null}{message.createdAt ? <div><dt>Automation attempt</dt><dd>{dateTime(message.createdAt)}</dd></div> : null}{message.providerSmsId ? <div><dt>InfoTXT ID</dt><dd>{message.providerSmsId}</dd></div> : null}{message.lastCheckedAt ? <div><dt>Provider checked</dt><dd>{dateTime(message.lastCheckedAt)}</dd></div> : null}</dl><p>{message.reason}</p></div></article>)}</div> : <div className="vxs-sms-proof-loading"><strong>No courier-triggered SMS is expected yet</strong><span>The checklist begins after tracking and courier movements are available.</span></div>}
        {otherSms.length ? <details className="vxs-sms-other"><summary>{number(otherSms.length)} other order SMS record(s)</summary><div>{otherSms.map((message: any) => <article key={message.id}><div><strong>{message.eventLabel}</strong><span>{label(message.source)} to {message.recipient}</span></div><Badge tone={smsTone(message.status)}>{smsStatus(message.status)}</Badge><small>{dateTime(message.updatedAt || message.createdAt)}{message.providerSmsId ? `, InfoTXT ID ${message.providerSmsId}` : ""}</small></article>)}</div></details> : null}
        <small className="vxs-sms-proof-freshness">Proof refreshed {dateTime(smsProof.generatedAt)}{proofSummary.lastActivityAt ? `. Last SMS activity ${dateTime(proofSummary.lastActivityAt)}.` : "."}</small>
      </> : null}
    </section>
    <section><div className="vxs-courier-section-head"><div><p>Newest first · interpreted</p><h3>{number(updates.length)} courier movement(s)</h3></div>{order.needsAction ? <Badge tone="bad">Needs follow-up</Badge> : <Badge tone="good">Monitored</Badge>}</div>
      {updates.length ? <ol className="vxs-courier-timeline vxs-courier-timeline-detailed">{journey.enriched.map((update: any, index: number) => <li className={String(update.kind || "movement")} key={update.id || `${update.at}-${index}`}><i aria-hidden="true" /><div><div className="vxs-courier-event-head"><strong>{update.title}</strong>{update.elapsed ? <Badge tone="muted">+{update.elapsed}</Badge> : null}</div><time>{dateTime(update.at)}</time><p className="vxs-courier-explanation">{update.detail}</p><div className="vxs-courier-next"><b>{update.type === "failed" || update.type === "return" ? "Required action" : "What this means next"}</b><span>{update.next}</span></div>{update.note ? <div className="vxs-courier-raw"><b>Courier reason</b><span>{update.note}</span></div> : null}<small className="vxs-courier-raw-title">Raw Pancake status: {update.rawTitle}</small>{Array.isArray(update.images) && update.images.length ? <div className="vxs-courier-proofs">{update.images.map((src: string, imageIndex: number) => <a href={src} target="_blank" rel="noreferrer" key={`${src}-${imageIndex}`}><img src={src} alt={`Courier proof ${imageIndex + 1} for ${update.rawTitle}`} loading="lazy" /></a>)}</div> : null}</div></li>)}</ol> : <div className="vxs-courier-empty"><strong>{order.tracking ? "Waiting for the first courier scan" : "Not yet pushed to courier"}</strong><span>{order.tracking ? "Pancake has assigned a tracking number but has not returned movement history yet." : "The movement timeline will begin after a courier and tracking number are assigned."}</span></div>}
    </section>
    <section className="vxs-courier-source"><strong>Data boundary</strong><span>Pancake supplies each courier status, timestamp, reason, and proof image, but it does not supply J&amp;T facility or branch names. Transit-leg labels and durations above are calculated from the verified scan sequence; use the official J&amp;T tracker for facility-level detail. This view refreshes every 20 seconds.</span></section>
  </aside></div>;
}

function JanUploaderCard({ refreshOrders }: { refreshOrders: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/vision-x-saha/jan-uploader", { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const status = data?.status || (loading ? "loading" : "error");
  const tone: Tone = status === "active" ? "good" : status === "attention" ? "bad" : status === "standby" ? "warn" : "muted";
  const statusLabel = status === "active" ? "Active" : status === "attention" ? "Needs review" : status === "standby" ? "Standby" : status === "loading" ? "Loading" : status === "not_configured" ? "Not configured" : "Unavailable";
  const last = data?.lastRun;

  return <section className="vxs-card" style={{ marginTop: 16 }}>
    <div className="vxs-card-head"><div><p>AI department · autopilot</p><h3>Jan Uploader AI</h3></div><Badge tone={tone}>{statusLabel}</Badge></div>
    <div className="vxs-demo-note" style={{ marginBottom: 12 }}><strong>Courier upload autopilot</strong><span>Ships clean orders to Bigate J&amp;T · {data?.schedule || "Every other day at 7:00 AM PHT"}</span></div>
    <div className="vxs-header-actions" style={{ marginBottom: 12 }}><CourierUpload refreshOrders={() => { refreshOrders(); load(); }} /><button className="vxs-secondary" onClick={load} disabled={loading}>{loading ? "Refreshing" : "Refresh logs"}</button></div>
    {last ? <Metrics rows={[["Last run", last.timestamp || "—"], ["Shipped", number(last.shipped)], ["Failed", number(last.failed)], ["Abandoned", number(last.abandoned)]]} /> : <p className="vxs-empty">No runs logged yet. First scheduled run is the next even day at 7:00 AM.</p>}
    {data?.runs?.length ? <div className="vxs-status-grid" style={{ marginTop: 12 }}>{data.runs.slice(0, 6).map((r: any, i: number) => <div key={i}><span>{r.timestamp} · {r.trigger}</span><strong>{r.shipped} shipped{r.failed ? ` · ${r.failed} failed` : ""}</strong></div>)}</div> : null}
  </section>;
}

function JanUploaderView({ refreshOrders }: { refreshOrders: () => void }) {
  return <>
    <SectionHeader eyebrow="AI employee · courier autopilot" title="Jan Uploader AI" copy="Ships clean orders to Bigate J&amp;T every other day at 7am, flags duplicates and abandoned orders, and logs every run." />
    <JanUploaderCard refreshOrders={refreshOrders} />
  </>;
}

function GuideStep({ n, title, children }: { n?: number | string; title: string; children?: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid rgba(128,128,128,0.3)", background: "rgba(128,128,128,0.06)", borderRadius: 10, padding: "10px 12px" }}>
    {n !== undefined ? <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 11, background: "rgba(128,128,128,0.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</span> : null}
    <div><strong style={{ display: "block", fontSize: 14 }}>{title}</strong>{children ? <span style={{ fontSize: 13, opacity: 0.85 }}>{children}</span> : null}</div>
  </div>;
}
function GuideArrow() { return <div style={{ textAlign: "center", opacity: 0.45, fontSize: 16, margin: "3px 0" }}>↓</div>; }
function GuideBranch({ items }: { items: { label: string; desc: string }[] }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
    {items.map((it, i) => <div key={i} style={{ border: "1px dashed rgba(128,128,128,0.45)", borderRadius: 8, padding: "8px 10px" }}><strong style={{ display: "block", fontSize: 13 }}>{it.label}</strong><span style={{ fontSize: 12, opacity: 0.8 }}>{it.desc}</span></div>)}
  </div>;
}
function GuideCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="vxs-card" style={{ marginTop: 16 }}>
    <div className="vxs-card-head"><div><p>{eyebrow}</p><h3>{title}</h3></div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
  </section>;
}

function SystemGuideView() {
  return <>
    <SectionHeader eyebrow="Operating manual" title="How the System Works" copy="A plain-language map of the Vision X Saha AI system: the two AI employees, how Mel handles every customer text, how orders ship, and how marketing grows lifetime value." />

    <section className="vxs-card">
      <div className="vxs-card-head"><div><p>The big picture</p><h3>Two AI employees, one growth loop</h3></div><Badge tone="good">Always on</Badge></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div className="vxs-demo-note"><strong>Mel - SMS sales &amp; support AI</strong><span>Talks to customers over SMS. Takes reorders, upsells, cross-sells the booster, answers planting and trust questions, handles complaints, runs referrals.</span></div>
        <div className="vxs-demo-note"><strong>Jan - courier upload AI</strong><span>Ships clean orders to Bigate J&amp;T on autopilot, screens out abandoned, duplicate, and incomplete orders, logs every run.</span></div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.85, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Acquire</span><span>→</span>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Lifecycle nurture</span><span>→</span>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Reorder (frequency)</span><span>→</span>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Booster (higher value)</span><span>→</span>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Referral (new customers)</span><span>→</span>
        <span style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "4px 8px" }}>Measure (LTV tab)</span>
      </div>
    </section>

    <GuideCard eyebrow="Mel SMS AI" title="How an incoming customer text is handled">
      <GuideStep n={1} title="Customer texts the Vision X Saha number">Every reply lands on our connected SIM (SIM4) and hits Mel's webhook.</GuideStep>
      <GuideArrow />
      <GuideStep n={2} title="Is this number in our system?">Mel checks Pancake POS and the marketing list.</GuideStep>
      <GuideArrow />
      <GuideBranch items={[{ label: "Not ours", desc: "Wrong number, spam, other business. Logged only. Mel does NOT reply." }, { label: "Our customer / contact", desc: "An existing POS customer or someone we messaged. Continue." }]} />
      <GuideArrow />
      <GuideStep n={3} title="Fast auto-replies first">YES/NO confirm or cancel an order, abandoned-cart YES applies the discount, status and price questions get an instant answer.</GuideStep>
      <GuideArrow />
      <GuideStep n={4} title="Everything else goes to Mel AI">Mel reads the message and replies in Taglish: reorders, upsell/downsell, booster cross-sell, planting advice, trust and refund worries, complaints, new leads, referrals.</GuideStep>
      <GuideArrow />
      <GuideBranch items={[{ label: "Places order", desc: "Lakatan, optional booster, discounts/credits applied." }, { label: "Adds to open order", desc: "Routed to Ken on Telegram (human adds it)." }, { label: "Bulk order", desc: "30+ units handed to the bulk team." }, { label: "Delivery timing", desc: "Bridges the customer with their rider." }]} />
    </GuideCard>

    <GuideCard eyebrow="Mel SMS AI" title="How Mel places an order">
      <GuideStep n={1} title="Confirm the bundle and the complete address">Needs house/street, barangay, city, and province. Mel asks for any missing part.</GuideStep>
      <GuideArrow />
      <GuideStep n={2} title="Customer replies YES">Mel never creates an order without a clear confirmation.</GuideStep>
      <GuideArrow />
      <GuideStep n={3} title="Mel creates the COD order in Pancake">Lakatan bulbs, plus a Grow Na Na booster if they accepted the cross-sell, with any discount or referral credit applied.</GuideStep>
      <GuideArrow />
      <GuideStep n={4} title="Order enters fulfillment">Jan picks it up on the next run and ships it to Bigate J&amp;T.</GuideStep>
    </GuideCard>

    <section className="vxs-card" style={{ marginTop: 16 }}>
      <div className="vxs-card-head"><div><p>Mel SMS AI</p><h3>Mel's golden rules</h3></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <div className="vxs-demo-note"><strong>We sell the bulb</strong><span>Lakatan Saha is the live planting bulb (size of a fist), not a tall seedling or whole stem. It grows and multiplies once planted.</span></div>
        <div className="vxs-demo-note"><strong>Trust before price</strong><span>On worries, reassure first: it is COD, pay only on arrival, zero risk. Damaged 20% off, dead or rotten 30% off or replacement.</span></div>
        <div className="vxs-demo-note"><strong>Handle dissatisfaction</strong><span>Make the customer feel important, then insist these are live plants that multiply. Fix any real shortage or damage.</span></div>
        <div className="vxs-demo-note"><strong>Cross-sell once</strong><span>Offer the Grow Na Na booster to happy growers, once, never pushy.</span></div>
        <div className="vxs-demo-note"><strong>Never message strangers</strong><span>Mel only replies to people in our system. No cold or wrong numbers.</span></div>
        <div className="vxs-demo-note"><strong>No links, short Taglish</strong><span>Under 300 characters, no URLs, no company signature.</span></div>
      </div>
    </section>

    <GuideCard eyebrow="SMS Marketing" title="Daily batches and the plant lifecycle">
      <GuideStep n={1} title="Two batches a day">Morning around 8am and evening around 6pm, up to ~100 each, 200/day total.</GuideStep>
      <GuideArrow />
      <GuideStep n={2} title="Pull the customer list and segment everyone">Each customer is sorted by their history.</GuideStep>
      <GuideArrow />
      <GuideBranch items={[{ label: "VIP / Repeat", desc: "Reorder offer with 10% off." }, { label: "New grower", desc: "Enters the plant lifecycle (below)." }, { label: "Dormant", desc: "Win-back offer." }, { label: "Failed / Inquiry", desc: "Restart the conversation." }]} />
      <GuideArrow />
      <GuideStep title="New grower plant lifecycle (6 timed touches)">Built around the plant's real calendar, each touch helps and sells:</GuideStep>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, margin: "4px 0" }}>
        <div className="vxs-demo-note"><strong>Day 0</strong><span>Planting care tip (trust)</span></div>
        <div className="vxs-demo-note"><strong>Day 12</strong><span>Small is normal, it multiplies</span></div>
        <div className="vxs-demo-note"><strong>Day 25</strong><span>Scale offer, 10% off</span></div>
        <div className="vxs-demo-note"><strong>Day 55</strong><span>Progress + reorder</span></div>
        <div className="vxs-demo-note"><strong>Day 110</strong><span>Mid-growth reorder</span></div>
        <div className="vxs-demo-note"><strong>Day 210</strong><span>Pre-harvest + referral</span></div>
      </div>
      <GuideArrow />
      <GuideStep title="A reply stops the sequence">If they reply, Mel takes over live. If they order, the sequence ends. When a sequence finishes, the customer rests (cooldown) then becomes eligible again later.</GuideStep>
    </GuideCard>

    <GuideCard eyebrow="Jan Uploader AI" title="Courier upload autopilot">
      <GuideStep n={1} title="Runs every other day at 7am (or the manual button)">No one has to push orders by hand.</GuideStep>
      <GuideArrow />
      <GuideStep n={2} title="Scan the POS for shippable orders not yet booked">New, confirmed, or packing orders without courier tracking.</GuideStep>
      <GuideArrow />
      <GuideBranch items={[{ label: "Clean", desc: "Complete and valid. Ship it." }, { label: "Abandoned", desc: "Left untouched for Mel's recovery." }, { label: "Duplicate", desc: "Same IP or phone. Held for review." }, { label: "Incomplete address", desc: "Missing barangay/city/province. Held." }]} />
      <GuideArrow />
      <GuideStep n={3} title="Push clean orders to Bigate J&amp;T">Each gets a J&amp;T tracking number.</GuideStep>
      <GuideArrow />
      <GuideStep n={4} title="Log the run and send a Telegram report">Every run is recorded in the Jan Uploader tab.</GuideStep>
    </GuideCard>

    <GuideCard eyebrow="Recovery" title="Returned and failed deliveries">
      <GuideStep n={1} title="Order is rejected or returning to sender (RTS)">The buyer refused it or it bounced back. That parcel can no longer be re-delivered.</GuideStep>
      <GuideArrow />
      <GuideStep n={2} title="Mel re-engages the customer">"Nabalik po ang order nyo kasi hindi natanggap. Gusto nyo pa po ba itong maipadala ulit?"</GuideStep>
      <GuideArrow />
      <GuideBranch items={[{ label: "Still wants it", desc: "Mel takes a brand-new order, plain COD." }, { label: "Not anymore", desc: "Polite close, no pressure." }]} />
      <GuideArrow />
      <GuideStep n={3} title="Soft shipping ask via GCash">Alongside the new order, Mel sincerely asks them to cover the P80 shipping lost on the return via GCash (09561603751), with an honest personal angle. If they resist, Mel softens to any amount. This NEVER blocks the new order.</GuideStep>
      <GuideArrow />
      <GuideStep n={4} title="The ask is the point">Mel makes the shipping request once. Whether they send or not, the new order always proceeds and ships like any other. No chasing, no proof required.</GuideStep>
    </GuideCard>

    <section className="vxs-card" style={{ marginTop: 16 }}>
      <div className="vxs-card-head"><div><p>Growth levers</p><h3>Cross-sell and referral</h3></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <div className="vxs-demo-note"><strong>Grow Na Na booster (cross-sell)</strong><span>Organic fertilizer/booster. 1pc P199, 2pcs P349, 3pcs P499. Mel offers it to happy growers and adds it to the same COD order, lifting order value.</span></div>
        <div className="vxs-demo-note"><strong>Referral program</strong><span>Whoever refers a new customer gets P100 off their next order. The new customer gets 10% off their first. Mel asks a new buyer who referred them and applies both automatically.</span></div>
      </div>
    </section>

    <section className="vxs-card" style={{ marginTop: 16 }}>
      <div className="vxs-card-head"><div><p>Reference</p><h3>Glossary</h3></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div className="vxs-demo-note"><strong>COD</strong><span>Cash on delivery. Customer pays only when the order arrives.</span></div>
        <div className="vxs-demo-note"><strong>Saha / bulb</strong><span>The live Lakatan banana planting bulb we sell.</span></div>
        <div className="vxs-demo-note"><strong>Bundle</strong><span>A fixed-price pack, like 10 pcs Lakatan for P1699.</span></div>
        <div className="vxs-demo-note"><strong>Segment</strong><span>A customer group (VIP, repeat, new grower, dormant) used to pick the right message.</span></div>
        <div className="vxs-demo-note"><strong>Sequence</strong><span>A series of timed SMS messages for a segment.</span></div>
        <div className="vxs-demo-note"><strong>Cooldown</strong><span>A rest period after a sequence finishes, so no one is over-messaged.</span></div>
        <div className="vxs-demo-note"><strong>Abandoned</strong><span>A started-but-unconfirmed order. Mel recovers it with a discount; Jan never ships it.</span></div>
        <div className="vxs-demo-note"><strong>LTV</strong><span>Lifetime value, the total a customer is worth over time.</span></div>
      </div>
    </section>
  </>;
}

function LtvView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vision-x-saha/ltv", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to load LTV data.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load LTV data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const sms = data?.sms;
  const cust = data?.customers;
  const ref = data?.referral;

  return <>
    <SectionHeader eyebrow="Lifetime value" title="LTV & Growth" copy="What the customer list is worth, how hard the SMS engine is working, and referral traction." action={<button className="vxs-primary" onClick={load} disabled={loading}>{loading ? "Loading" : "Refresh"}</button>} />
    {error ? <div className="vxs-live-note"><Badge tone="bad">Error</Badge><span>{error}</span></div> : null}
    {!data && loading ? <LoadingState loading={true} refresh={load} /> : null}
    {cust ? <section className="vxs-card"><div className="vxs-card-head"><div><p>Customer base</p><h3>Lifetime value</h3></div><Badge tone="good">{number(cust.total)} contacts</Badge></div>
      <Metrics rows={[["Avg LTV / buyer", php(cust.avgLtv)], ["Avg order value", php(cust.aov)], ["Orders / buyer", String(cust.ordersPerBuyer)], ["Repeat rate", `${cust.repeatRate}%`], ["Buyers", number(cust.buyers)], ["Repeat buyers", number(cust.repeatBuyers)], ["Total lifetime value", php(cust.totalLtv)]]} />
    </section> : null}
    {sms ? <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>SMS engine</p><h3>Marketing performance</h3></div><Badge tone={sms.roas >= 3 ? "good" : sms.roas >= 1 ? "warn" : "muted"}>{sms.roas}x ROAS</Badge></div>
      <Metrics rows={[["Revenue from SMS", php(sms.revenue)], ["SMS cost", php(sms.cost)], ["Revenue / SMS", php(sms.revenuePerSms)], ["ROAS", `${sms.roas}x`], ["SMS sent", number(sms.sent)], ["Orders from SMS", number(sms.orders)], ["Order rate", `${sms.orderConvRate}%`], ["Reply rate", `${sms.replyRate}%`]]} />
      <div className="vxs-demo-note wide" style={{ marginTop: 12 }}><strong>Revenue per SMS P{sms.revenuePerSms}</strong><span>Each marketing SMS costs about P{sms.cost && sms.sent ? (sms.cost / sms.sent).toFixed(2) : "0.50"}. Keep revenue per SMS well above that.</span></div>
    </section> : null}
    {ref ? <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Referral program</p><h3>Word of mouth</h3></div><Badge tone={ref.referred ? "good" : "muted"}>{number(ref.referred)} referrals</Badge></div>
      <Metrics rows={[["Referrals made", number(ref.referred)], ["Credits redeemed", number(ref.redeemed)], ["Credit value redeemed", php(ref.creditRedeemedPhp)]]} />
    </section> : null}
  </>;
}

function CommandCenter({ live, liveOrders, loading, refresh, open, period, onPeriodChange }: { live: LiveData | null; liveOrders: any; loading: boolean; refresh: () => void; open: (view: View) => void; period: ReportingPeriod; onPeriodChange: (period: ReportingPeriod) => void }) {
  const overviewPos = live?.pancake.connected ? live.pancake.data : null;
  const pos = liveOrders ? {
    ...overviewPos,
    ...liveOrders,
    open: Number(liveOrders.pending || 0) + Number(liveOrders.inTransit || 0),
    returned: liveOrders.returns,
    statuses: liveOrders.stages
  } : overviewPos;
  const ads = live?.meta.connected ? live.meta.data : null;
  const traffic = live?.traffic.connected ? live.traffic.data : null;
  const sheet = live?.sheet.connected ? live.sheet.data : null;
  const performance = overviewPos?.performance;
  const periodLabel = performance?.label || ads?.period?.label || "Selected period";
  const alerts: Array<{ title: string; detail: string; tone: Tone; view: View }> = [];
  if (pos?.needsAction) alerts.push({ title: `${pos.needsAction} orders are at least 20 hours old`, detail: "Review these open orders before the 24-hour mark.", tone: "bad", view: "orders" });
  if (pos?.returned) alerts.push({ title: `${pos.returned} returned or returning orders`, detail: "Review disposition and customer follow-up in Pancake.", tone: "warn", view: "orders" });
  if (sheet?.totals?.smsFailed) alerts.push({ title: `${sheet.totals.smsFailed} confirmation SMS failures`, detail: "Check phone validity or INFOTXT delivery logs.", tone: "bad", view: "integrations" });
  if (sheet?.capital?.missingProof) alerts.push({ title: `${sheet.capital.missingProof} capital records need proof`, detail: "Add the pending receipts or purchase references to the Capital tab.", tone: "warn", view: "capital" });
  if (live?.capi.connected && live.capi.data?.fullyVerified === false) alerts.push({ title: "Meta CAPI requires event verification", detail: live.capi.data.note || "Confirm accepted Purchase events in Meta Events Manager.", tone: "warn", view: "integrations" });
  (["meta", "pancake", "landing", "traffic", "sheet", "capi"] as const).forEach(key => {
    if (live && !live[key].connected) alerts.push({ title: `${key.toUpperCase()} connection issue`, detail: live[key].error || "Connection needs attention.", tone: "bad", view: "integrations" });
  });

  return <>
    <SectionHeader eyebrow="Live operating overview" title="VISION X SAHA Command Center" copy="Performance uses one Philippine-time window. The order pipeline remains a live operational view." action={<button className="vxs-primary" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh live data"}</button>} />
    {!live ? <LoadingState loading={loading} refresh={refresh} /> : <div className="vxs-live-note"><Badge tone="good">Live sources</Badge><span>Last synced {dateTime(live.generatedAt)}. Performance: {performance?.start || ads?.period?.start} to {performance?.end || ads?.period?.end}, Philippine time.</span><div className="vxs-period-tabs">{(["today", "7d", "mtd", "billing"] as ReportingPeriod[]).map(key => <button key={key} className={period === key ? "active" : ""} onClick={() => onPeriodChange(key)}>{key === "today" ? "Today" : key === "7d" ? "7 days" : key === "billing" ? "Billing cycle" : "MTD"}</button>)}</div></div>}
    <section className="vxs-metrics">
      {[
        [`COD dispatched ${periodLabel}`, php(performance?.courierPushedCodValue), `${number(performance?.courierPushedOrders)} orders pushed to courier`, "info"],
        [`Delivered value ${periodLabel}`, php(performance?.deliveredValue), `${number(performance?.delivered)} delivered`, "good"],
        ["Open orders", number(pos?.open), pos?.needsAction ? `${pos.needsAction} need action` : "No SLA alerts", pos?.needsAction ? "bad" : "good"],
        [`Meta spend ${periodLabel}`, phpPrecise(ads?.totals?.spend), `${number(ads?.totals?.purchases)} purchases`, "info"],
        [`Meta ROAS ${periodLabel}`, `${Number(ads?.totals?.roas || 0).toFixed(2)}x`, `${phpPrecise(ads?.totals?.purchaseValue)} value`, Number(ads?.totals?.roas || 0) >= 2 ? "good" : "warn"],
        ["Live PH visitors", number(traffic?.liveVisitors), `${number(traffic?.totalVisits)} qualified recorded visits`, "info"],
        ["Project capital", php(sheet?.capital?.total), `Kevin ${php(sheet?.capital?.byContributor?.Kevin?.total)} · Rustan ${php(sheet?.capital?.byContributor?.Rustan?.total)}`, sheet?.capital?.missingProof ? "warn" : "good"]
      ].map(([label, value, note, tone]) => <button key={String(label)} className="vxs-metric" onClick={() => open(String(label).startsWith("Meta") ? "advertising" : label === "Live PH visitors" ? "traffic" : label === "Project capital" ? "capital" : "orders")}><span>{label}</span><strong>{value}</strong><Badge tone={tone as Tone}>{note}</Badge></button>)}
    </section>
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Operational alerts</p><h3>Needs attention</h3></div><Badge tone={alerts.length ? "bad" : "good"}>{alerts.length ? `${alerts.length} open` : "Clear"}</Badge></div>
        <div className="vxs-attention-list">{alerts.length ? alerts.map(item => <button key={item.title} onClick={() => open(item.view)}><i className={item.tone} /><div><strong>{item.title}</strong><span>{item.detail}</span></div><Badge tone={item.tone}>Review</Badge></button>) : <p className="vxs-empty">No current connection, SMS, return, or SLA alerts.</p>}</div>
      </section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Order pipeline</p><h3>All current POS orders</h3></div><Badge tone="good">Live</Badge></div>
        <div className="vxs-status-grid">{Object.entries(pos?.statuses || {}).sort((a: any, b: any) => b[1] - a[1]).map(([status, count]) => <div key={status}><span>{status.replaceAll("_", " ")}</span><strong>{String(count)}</strong></div>)}</div>
      </section>
    </div>
    <section className="vxs-card vxs-table-card"><div className="vxs-card-head"><div><p>Newest activity</p><h3>Recent Pancake orders</h3></div><button className="vxs-text-button" onClick={() => open("orders")}>Open all recent orders</button></div><RecentOrders orders={pos?.recentOrders || []} limit={8} /></section>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Checkout and messaging</p><h3>Google Sheet operational log</h3></div><Badge tone={live?.sheet.connected ? "good" : "bad"}>{live?.sheet.connected ? "Connected" : "Unavailable"}</Badge></div>
      <Metrics rows={[["Logged orders", number(sheet?.totals?.loggedOrders)], ["Logged value", php(sheet?.totals?.loggedOrderValue)], ["SMS sent", number(sheet?.totals?.smsSent)], ["Checkout events", number(sheet?.totals?.checkoutEvents)]]} />
      <div className="vxs-simple-list">{(sheet?.recentActivity || []).slice(0, 6).map((item: any, index: number) => <div className="vxs-live-row" key={`${item.timestamp}-${index}`}><div><strong>{String(item.event || "activity").replaceAll("_", " ")}</strong><span>{item.bundle || "No bundle"} · {dateTime(item.timestamp)}</span></div></div>)}</div>
    </section>
  </>;
}

function LegacyOrdersView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const provider = live?.pancake;
  if (!provider?.connected) return <><SectionHeader eyebrow="Live Pancake POS" title="Orders" copy="Order processing and fulfillment status." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const data = provider.data;
  return <>
    <SectionHeader eyebrow="Live Pancake POS" title="Orders" copy={`${data.shop.name}. ${data.sample}.`} action={<a className="vxs-secondary" href={LANDING_PAGE_URL} target="_blank" rel="noreferrer">Open storefront</a>} />
    <Metrics rows={[["Orders", number(data.totalOrders)], ["Open", number(data.open)], ["Needs action", number(data.needsAction)], ["Delivered", number(data.delivered)], ["Returns", number(data.returned)], ["COD value", php(data.codValue)]]} />
    <section className="vxs-card vxs-table-card"><div className="vxs-card-head"><div><p>Fulfillment queue</p><h3>Recent orders and SLA age</h3></div><Badge tone="info">Read-only</Badge></div><RecentOrders orders={data.recentOrders || []} limit={30} /></section>
  </>;
}

function LegacyInventoryView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const provider = live?.pancake;
  if (!provider?.connected) return <><SectionHeader eyebrow="Pancake catalog" title="Inventory" copy="Products and stock availability from the connected POS." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const products = provider.data.products || [];
  const knownStock = products.filter((product: any) => product.stock !== null);
  return <>
    <SectionHeader eyebrow="Live Pancake catalog" title="Inventory" copy="Product availability from the VISION X SAHA shop." action={<button className="vxs-primary" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</button>} />
    <Metrics rows={[["Products", number(products.length)], ["Active products", number(products.filter((product: any) => product.active).length)], ["Known stock", knownStock.length ? number(knownStock.reduce((sum: number, product: any) => sum + Number(product.stock || 0), 0)) : "Not exposed"], ["Open-order demand", number(provider.data.open)]]} />
    <section className="vxs-card"><div className="vxs-card-head"><div><p>POS catalog</p><h3>Sellable products</h3></div><Badge tone="good">Live</Badge></div><div className="vxs-simple-list">{products.length ? products.map((product: any) => <div className="vxs-live-row" key={product.id}><div><strong>{product.name}</strong><span>{product.variants} variant(s) · {product.active ? "Active" : "Inactive"}</span></div><strong>{product.stock === null ? "Stock unavailable" : `${number(product.stock)} units`}</strong></div>) : <p className="vxs-empty">The POS catalog returned no products.</p>}</div></section>
  </>;
}

function CourierUpload({ refreshOrders }: { refreshOrders: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [shipped, setShipped] = useState<any>(null);
  const [error, setError] = useState("");
  const [testId, setTestId] = useState("");

  async function run(dryRun: boolean, orderIds?: string[]) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vision-x-saha/courier-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderIds ? { dryRun, orderIds } : { dryRun })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Upload failed.");
      setResult(body);
      if (!dryRun) { setShipped(body); refreshOrders(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setOpen(true);
    setResult(null);
    setShipped(null);
    setError("");
    run(true);
  }

  const totals = result?.totals;
  return <>
    <button type="button" className="vxs-secondary" onClick={start}>Upload to courier</button>
    {open ? <div className="vxs-modal-backdrop" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
      <form className="vxs-modal" onMouseDown={event => event.stopPropagation()} onSubmit={event => event.preventDefault()}>
        <header><div><p>Bigate J&amp;T upload</p><h2>Courier upload</h2></div><button type="button" aria-label="Close" onClick={() => !loading && setOpen(false)}>×</button></header>
        <div className="vxs-modal-grid">
          {error ? <div className="vxs-demo-note wide"><strong>Error</strong><span>{error}</span></div> : null}
          {loading && !totals ? <div className="vxs-demo-note wide"><strong>Checking orders…</strong><span>Reading the POS and sorting orders.</span></div> : null}
          {totals ? <>
            <div className="vxs-demo-note"><strong>{totals.clean} clean</strong><span>Ready to ship to J&amp;T</span></div>
            <div className="vxs-demo-note"><strong>{totals.flaggedDuplicate} flagged</strong><span>Duplicate IP or phone — held</span></div>
            <div className="vxs-demo-note"><strong>{totals.abandoned} abandoned</strong><span>Not shipped (delete comes later)</span></div>
            <div className="vxs-demo-note"><strong>{totals.incompleteAddress} incomplete</strong><span>Missing province/city/barangay — held</span></div>
          </> : null}
          {totals && !shipped ? <div className="vxs-demo-note wide"><strong>Will ship to J&amp;T</strong><span>{(result.clean || []).map((o: any) => `#${o.id} ${o.customer}`).join(" · ") || "Nothing clean to ship right now."}</span></div> : null}
          {totals && totals.clean && !shipped ? <label className="wide">Test one order first (optional) — type one order ID from the clean list above<input value={testId} onChange={event => setTestId(event.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 248" inputMode="numeric" /></label> : null}
          {shipped?.totals ? <div className="vxs-demo-note wide"><strong>Shipped {shipped.totals.pushed} · failed {shipped.totals.failed}</strong><span>{(shipped.pushed || []).map((o: any) => `#${o.id} ${o.tracking || "tracking pending"}`).join(" · ") || "No orders shipped."}</span></div> : null}
        </div>
        <footer>
          <button type="button" className="vxs-secondary" onClick={() => !loading && setOpen(false)} disabled={loading}>Close</button>
          <button type="button" className="vxs-primary" onClick={() => run(false, testId.trim() ? [testId.trim()] : undefined)} disabled={loading || !totals || !totals.clean || Boolean(shipped)}>{loading && totals ? "Shipping…" : shipped ? "Done" : testId.trim() ? `Ship #${testId.trim()} only` : `Ship ${totals?.clean || 0} clean to J&T`}</button>
        </footer>
      </form>
    </div> : null}
  </>;
}

function OrderConversationModal({ order, onClose }: { order: any; onClose: () => void }) {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConversation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/vision-x-saha/order-activity?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The InfoTXT conversation could not be loaded.");
      setActivity(body);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The InfoTXT conversation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    setActivity(null);
    setError("");
    void loadConversation();
  }, [loadConversation]);

  const messages = Array.isArray(activity?.messages) ? activity.messages : [];
  const messageTone = (status: string): Tone => ["dispatched", "sent"].includes(status) ? "good"
    : ["failed", "not_recorded"].includes(status) ? "bad"
      : ["accepted", "queued"].includes(status) ? "info" : "muted";
  const messageStatus = (status: string) => status === "dispatched" || status === "sent" ? "Sent"
    : status === "accepted" || status === "queued" ? "Queued"
      : status === "failed" ? "Failed" : label(status || "recorded");

  return <div className="vxs-drawer-backdrop vxs-chat-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <aside className="vxs-chat-modal" role="dialog" aria-modal="true" aria-label={`InfoTXT conversation for order ${order.id}`} onMouseDown={event => event.stopPropagation()}>
      <header><div><p>InfoTXT conversation</p><h2>{order.customer || "Customer"}</h2><span>Order #{order.id}{order.tracking ? ` | ${order.tracking}` : ""}</span></div><div className="vxs-chat-modal-actions"><button type="button" className="vxs-text-button" onClick={() => void loadConversation()} disabled={loading}>{loading ? "Loading" : "Refresh"}</button><button type="button" aria-label="Close SMS chat" onClick={onClose}>×</button></div></header>
      <div className="vxs-chat-modal-summary"><span>{order.phone || "No customer number"}</span><span>{number(messages.length)} message{messages.length === 1 ? "" : "s"} linked to this order</span></div>
      <section className="vxs-chat-modal-thread">
        {loading && !activity ? <div className="vxs-sms-proof-loading"><strong>Loading full conversation</strong><span>Reading private InfoTXT records for this Pancake order.</span></div> : null}
        {error ? <div className="vxs-sms-proof-error"><strong>Conversation unavailable</strong><span>{error}</span></div> : null}
        {!loading && !error && !messages.length ? <div className="vxs-sms-proof-loading"><strong>No linked InfoTXT messages yet</strong><span>New automated messages and customer replies will appear here once InfoTXT records them for this order.</span></div> : null}
        {messages.length ? <div className="vxs-order-conversation vxs-order-conversation-full" aria-label="Full InfoTXT conversation">{messages.map((message: any) => <article className={message.direction === "inbound" ? "inbound" : "outbound"} key={message.id}><div className="vxs-chat-message-head"><strong>{message.direction === "inbound" ? "Customer" : `Sent to ${message.recipient === "rider" ? "rider" : "customer"}`}</strong><Badge tone={message.direction === "inbound" ? "good" : messageTone(message.status)}>{message.direction === "inbound" ? "Received" : messageStatus(message.status)}</Badge></div><p>{message.text || "Message text was not retained in this older audit record."}</p><small>{message.eventLabel || "InfoTXT activity"} | {message.destinationMasked || "Number protected"} | {dateTime(message.time)}{message.providerSmsId ? ` | InfoTXT ${message.providerSmsId}` : ""}</small></article>)}</div> : null}
        <small className="vxs-order-activity-note">This shows every InfoTXT message currently linked to this Pancake order. Older outbound audit records can retain delivery status without their message body.</small>
      </section>
    </aside>
  </div>;
}

function OrdersView({ live, liveOrders, loading, refresh, refreshOrders }: { live: LiveData | null; liveOrders: any; loading: boolean; refresh: () => void; refreshOrders: () => void }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [conversationOrderId, setConversationOrderId] = useState("");
  const fallback = live?.pancake.connected ? live.pancake.data : null;
  const data = liveOrders || fallback;
  if (!data) return <><SectionHeader eyebrow="Live Pancake POS" title="Orders" copy="Order processing and fulfillment status." /><LoadingState loading={loading} error={live?.pancake.error} refresh={refresh} /></>;
  const orders = data.recentOrders || [];
  const selectedOrder = selectedOrderId ? orders.find((order: any) => String(order.id) === selectedOrderId) : null;
  const conversationOrder = conversationOrderId ? orders.find((order: any) => String(order.id) === conversationOrderId) : null;
  const filtered = orders.filter((order: any) => {
    const matchesStage = filter === "all" || order.stage === filter || (filter === "pending" && ["pending", "confirmed", "packing"].includes(order.stage)) || (filter === "courier" && ["pushed_to_courier", "in_transit", "out_for_delivery"].includes(order.stage)) || (filter === "returns" && ["failed_delivery", "returning", "returned"].includes(order.stage));
    const haystack = `${order.id} ${order.customer} ${order.phone} ${order.tracking} ${order.courier} ${order.bundle}`.toLowerCase();
    return matchesStage && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  });
  return <>
    <SectionHeader eyebrow="Pancake POS + courier" title="Orders" copy={`${data.sample || "Live POS orders"}. Auto-refreshes every 20 seconds.`} action={<div className="vxs-header-actions"><a className="vxs-secondary" href={LANDING_PAGE_URL} target="_blank" rel="noreferrer">Open storefront</a><CourierUpload refreshOrders={refreshOrders} /><button className="vxs-primary" onClick={refreshOrders}>Refresh orders</button></div>} />
    <Metrics rows={[["Real orders", number(data.totalOrders)], ["Pending POS", number(data.pending)], ["Pushed to courier", number(data.pushed)], ["Courier movements", number(data.courierMovements)], ["In delivery flow", number(data.inTransit)], ["Delivered", number(data.delivered)], ["Needs action", number(data.needsAction)], ["Returns", number(data.returns)], ["Proof images", number(data.proofImages)], ["COD value", php(data.codValue)]]} />
    <section className="vxs-card vxs-pipeline-card"><div className="vxs-card-head"><div><p>Live fulfillment pipeline</p><h3>POS and courier stages</h3></div><Badge tone="good">Near real-time</Badge></div><div className="vxs-status-grid">{Object.entries(data.stages || data.statuses || {}).map(([stage, count]) => <button key={stage} onClick={() => setFilter(stage)}><span>{stageLabel(stage)}</span><strong>{String(count)}</strong></button>)}</div></section>
    <section className="vxs-card vxs-table-card vxs-orders-card"><div className="vxs-card-head vxs-orders-toolbar"><div><p>Fulfillment queue</p><h3>{number(filtered.length)} visible orders</h3><span>Click an order to inspect courier movement, or SMS chat to open its InfoTXT conversation.</span></div><div className="vxs-order-controls"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order, customer, tracking" aria-label="Search orders" /><div className="vxs-filters">{[["all", "All"], ["pending", "Pending"], ["courier", "Courier"], ["out_for_delivery", "Delivering"], ["delivered", "Delivered"], ["returns", "Returns"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div></div><DetailedOrders orders={filtered} onSelect={order => setSelectedOrderId(String(order.id))} onConversation={order => setConversationOrderId(String(order.id))} /></section>
    {selectedOrder ? <CourierTimelineDrawer order={selectedOrder} onClose={() => setSelectedOrderId("")} onOpenConversation={() => setConversationOrderId(String(selectedOrder.id))} /> : null}
    {conversationOrder ? <OrderConversationModal order={conversationOrder} onClose={() => setConversationOrderId("")} /> : null}
  </>;
}

function CourierComplaintsView() {
  const [cases, setCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/vision-x-saha/courier-complaints", { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Complaint cases could not be loaded.");
      setCases(body.cases || []);
      if (selected) setSelected((body.cases || []).find((row: any) => row.id === selected.id) || null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Complaint cases could not be loaded."); }
    finally { setLoading(false); }
  }, [selected]);
  useEffect(() => { void load(); }, []);
  const visible = cases.filter(row => filter === "all" || row.status === filter);
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch { setError("Copy was blocked by the browser. Please select the text manually."); } };
  const download = (row: any) => { const blob = new Blob([`${row.complaintText}\n\nCase: ${row.id}\nTracking: ${row.tracking}\nCustomer: ${row.customer}\n\nCourier movements:\n${(row.evidence?.courierUpdates || []).map((event: any) => `${event.at || "Time unavailable"} | ${event.title}${event.note ? `: ${event.note}` : ""}`).join("\n")}\n\nCustomer conversation:\n${(row.evidence?.messages || []).map((message: any) => `${message.time || "Time unavailable"} | ${message.direction === "inbound" ? "Customer" : "Sent"}: ${message.text}`).join("\n")}`], { type: "text/plain" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${row.id}-${row.tracking}-courier-complaint.txt`; link.click(); URL.revokeObjectURL(link.href); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget); try { const response = await fetch("/api/vision-x-saha/courier-complaints", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update", id: selected.id, status: form.get("status"), reference: form.get("reference"), internalNote: form.get("internalNote") }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Complaint case could not be saved."); setSelected(body.case); await load(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Complaint case could not be saved."); } };
  return <>
    <SectionHeader eyebrow="Manual courier escalation" title="Courier Complaints" copy="Private complaint drafts prepared from the order, courier movement, and InfoTXT conversation. Submit them manually in the courier system." action={<button className="vxs-primary" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing" : "Refresh cases"}</button>} />
    <section className="vxs-card vxs-table-card"><div className="vxs-card-head"><div><p>Complaint register</p><h3>{number(visible.length)} visible case(s)</h3><span>Drafts are not sent automatically.</span></div><div className="vxs-filters">{["all", "draft", "ready", "submitted", "courier_replied", "resolved", "rejected"].map(status => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{label(status)}</button>)}</div></div>
      {error ? <div className="vxs-demo-note"><strong>Complaint register error</strong><span>{error}</span></div> : null}
      <div className="vxs-table"><div className="vxs-tr vxs-th vxs-complaint-row"><span>Case</span><span>Tracking</span><span>Customer</span><span>Issue</span><span>Evidence</span><span>Status</span><span>Updated</span></div>{visible.map(row => <button className="vxs-tr vxs-complaint-row" key={row.id} onClick={() => setSelected(row)}><span><strong>{row.id}</strong><small>Order #{row.orderId}</small></span><span><strong>{row.tracking}</strong><small>{row.courier}</small></span><span><strong>{row.customer}</strong><small>{php(row.value)}</small></span><span><strong>{row.issue}</strong><small>{label(row.stage)}</small></span><span><strong>{number(row.evidence?.messages?.length)} SMS</strong><small>{number(row.evidence?.courierUpdates?.length)} movement(s)</small></span><span><Badge tone={row.status === "resolved" ? "good" : row.status === "rejected" ? "bad" : row.status === "submitted" ? "info" : "warn"}>{label(row.status)}</Badge></span><span><strong>{dateTime(row.updatedAt)}</strong><small>Open case</small></span></button>)}</div>{!loading && !visible.length ? <p className="vxs-empty">No complaint cases match this status. Create one from an eligible order.</p> : null}
    </section>
    {selected ? <div className="vxs-drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="vxs-drawer vxs-complaint-drawer" role="dialog" aria-modal="true" aria-label={`Courier complaint ${selected.id}`} onMouseDown={event => event.stopPropagation()}><header><div><p>Private courier complaint</p><h2>{selected.id}</h2></div><button onClick={() => setSelected(null)}>×</button></header><section><Badge tone={selected.status === "resolved" ? "good" : selected.status === "submitted" ? "info" : "warn"}>{label(selected.status)}</Badge><dl><div><dt>Tracking</dt><dd>{selected.tracking}</dd></div><div><dt>Courier</dt><dd>{selected.courier}</dd></div><div><dt>Customer</dt><dd>{selected.customer}</dd></div><div><dt>Issue</dt><dd>{selected.issue}</dd></div></dl></section><section><div className="vxs-courier-section-head"><div><p>Ready to submit</p><h3>Complaint message</h3></div><button className="vxs-text-button" onClick={() => void copy(selected.complaintText)}>Copy complaint</button></div><pre className="vxs-complaint-copy">{selected.complaintText}</pre><button className="vxs-secondary" onClick={() => download(selected)}>Download evidence text</button></section><section><h3>Evidence included</h3><div className="vxs-complaint-evidence"><div><strong>{number(selected.evidence?.messages?.length)} InfoTXT message(s)</strong><span>{number(selected.evidence?.customerReplyCount)} customer reply or replies</span></div><div><strong>{number(selected.evidence?.courierUpdates?.length)} courier movement(s)</strong><span>{number(selected.evidence?.deliveryEvents?.length)} delivery-attempt log(s)</span></div></div></section><form onSubmit={save}><section><h3>Submission tracking</h3><label>Status<select name="status" defaultValue={selected.status}>{["draft", "ready", "submitted", "courier_replied", "resolved", "rejected"].map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label><label>Courier ticket or reference<input name="reference" defaultValue={selected.reference || ""} placeholder="Enter after you submit to courier" /></label><label>Internal note<textarea name="internalNote" defaultValue={selected.internalNote || ""} placeholder="Courier response, next action, or final result" /></label></section><footer><button type="button" className="vxs-secondary" onClick={() => setSelected(null)}>Close</button><button className="vxs-primary" type="submit">Save case</button></footer></form></aside></div> : null}
  </>;
}

function InventoryView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const provider = live?.sheet;
  const inventory = provider?.connected ? provider.data.inventory : null;
  const submitAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: fields.get("mode"), quantity: fields.get("quantity"), note: fields.get("note") }) });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Inventory adjustment could not be saved.");
      form.reset();
      setShowForm(false);
      setNotice({ tone: "good", text: "Inventory adjustment recorded in the movement ledger." });
      await refresh();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Inventory adjustment could not be saved." });
    } finally { setSaving(false); }
  };
  if (!provider?.connected || !inventory) return <><SectionHeader eyebrow="Inventory ledger" title="Inventory" copy="Opening stock, courier deductions, and manual adjustments." /><LoadingState loading={loading} error={provider?.error || "Inventory ledger is being initialized."} refresh={refresh} /></>;
  const summary = inventory.summary || {};
  const item = inventory.item || {};
  const movements = inventory.recentMovements || [];
  const remainingPct = Number(summary.openingStock) > 0 ? Math.max(0, Math.min(100, Number(summary.currentStock) / Number(summary.openingStock) * 100)) : 0;
  return <>
    <SectionHeader eyebrow="Automatic goods ledger" title="Inventory" copy="Stock is deducted once when an order receives courier tracking. Returns require inspection before restocking." action={<div className="vxs-header-actions"><button className="vxs-secondary" onClick={refresh} disabled={loading}>{loading ? "Syncing" : "Sync courier orders"}</button><button className="vxs-primary" onClick={() => { setNotice(null); setShowForm(true); }}>Adjust stock</button></div>} />
    {notice ? <div className="vxs-live-note"><Badge tone={notice.tone}>{notice.tone === "good" ? "Saved" : "Error"}</Badge><span>{notice.text}</span></div> : null}
    <Metrics rows={[["Opening stock", `${number(summary.openingStock)} pcs`], ["Dispatched", `${number(summary.dispatchedPieces)} pcs`], ["Available", `${number(summary.currentStock)} pcs`], ["Pending demand", `${number(summary.pendingDemand)} pcs`], ["Courier orders", number(summary.processedOrders)], ["Returns to inspect", number(summary.returnInspection)]]} />
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Current position</p><h3>{item.name}</h3></div><Badge tone={summary.lowStock ? "bad" : "good"}>{summary.lowStock ? "Low stock" : "Healthy"}</Badge></div><div className="vxs-inventory-balance"><strong>{number(summary.currentStock)} <small>pcs available</small></strong><span>{remainingPct.toFixed(1)}% of opening stock remains</span><div className="vxs-progress"><span style={{ width: `${remainingPct}%` }} /></div></div><div className="vxs-partner-grid"><div><span>Low-stock threshold</span><strong>{number(item.lowStock)} pcs</strong></div><div><span>Pending POS orders</span><strong>{number(summary.pendingOrders)}</strong></div><div><span>Last ledger update</span><strong>{dateTime(item.updatedAt)}</strong></div></div></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Deduction rule</p><h3>When stock changes</h3></div><Badge tone="info">Protected</Badge></div><div className="vxs-rule-list"><p><b>Pending order</b><span>Shown as demand; stock is not deducted.</span></p><p><b>Tracking assigned</b><span>Exact Lakatan piece quantity is deducted once.</span></p><p><b>Returned parcel</b><span>Stock stays deducted until manually inspected and restored.</span></p></div></section>
    </div>
    <section className="vxs-card"><div className="vxs-card-head"><div><p>Audit trail</p><h3>Latest inventory movements</h3></div><Badge tone="good">Google Sheet ledger</Badge></div><div className="vxs-simple-list">{movements.length ? movements.map((movement: any) => <div className="vxs-live-row" key={movement.movementId}><div><strong>{movement.quantityChange > 0 ? "+" : ""}{number(movement.quantityChange)} pcs · {String(movement.type).replaceAll("_", " ")}</strong><span>{movement.orderId ? `Order #${movement.orderId} · ${movement.tracking || "no tracking"}` : movement.note}</span><span>{dateTime(movement.date)} · Balance after: {number(movement.balanceAfter)} pcs</span></div><Badge tone={movement.quantityChange < 0 ? "warn" : "good"}>{movement.courier || "Manual"}</Badge></div>) : <p className="vxs-empty">No stock movements have been recorded.</p>}</div></section>
    {showForm ? <div className="vxs-modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowForm(false)}><form className="vxs-modal" onSubmit={submitAdjustment} onMouseDown={event => event.stopPropagation()}><header><div><p>Inventory control</p><h2>Record stock adjustment</h2></div><button type="button" aria-label="Close" onClick={() => setShowForm(false)} disabled={saving}>×</button></header><div className="vxs-modal-grid"><label>Adjustment<select name="mode" defaultValue="add" required><option value="add">Add recovered or new stock</option><option value="remove">Remove damaged or used stock</option><option value="set">Set verified physical count</option></select></label><label>Quantity (pcs)<input name="quantity" type="number" min="0" step="1" required /></label><label className="wide">Reason<input name="note" maxLength={250} placeholder="Inspection, damage, restock, or physical count reason" required /></label><div className="vxs-demo-note wide"><strong>Audit rule</strong><span>Every adjustment is written to InventoryMovements with its resulting balance.</span></div></div><footer><button type="button" className="vxs-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="vxs-primary" disabled={saving}>{saving ? "Saving..." : "Record adjustment"}</button></footer></form></div> : null}
  </>;
}

function AdvertisingView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [renameMessage, setRenameMessage] = useState("");
  const provider = live?.meta;
  if (!provider?.connected) return <><SectionHeader eyebrow="Meta Ads" title="Advertising" copy="Campaign performance and spend." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const data = provider.data;
  const totals = data.totals;
  const activeAds = data.activeAds || [];
  const postMap = new Map<string, any>();
  activeAds.forEach((ad: any) => {
    const key = ad.postLink || `ad:${ad.id}`;
    const current = postMap.get(key) || {
      key,
      postLink: ad.postLink,
      postId: ad.postId,
      name: ad.name,
      thumbnailUrl: ad.creative?.thumbnailUrl,
      adIds: [],
      adCount: 0,
      spend: 0,
      purchaseValue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      engagements: 0
    };
    const performance = ad.performance || {};
    current.adIds.push(ad.id);
    current.adCount += 1;
    current.spend += Number(performance.spend || 0);
    current.purchaseValue += Number(performance.purchaseValue || 0);
    current.purchases += Number(performance.purchases || 0);
    current.impressions += Number(performance.impressions || 0);
    current.clicks += Number(performance.clicks || 0);
    current.linkClicks += Number(performance.linkClicks || 0);
    current.engagements += Number(performance.engagements || 0);
    postMap.set(key, current);
  });
  const postCandidates = [...postMap.values()].map(post => ({
    ...post,
    cpc: post.linkClicks ? post.spend / post.linkClicks : post.clicks ? post.spend / post.clicks : 0,
    ctr: post.impressions ? post.clicks / post.impressions * 100 : 0,
    engagementRate: post.impressions ? post.engagements / post.impressions * 100 : 0,
    costPerEngagement: post.engagements ? post.spend / post.engagements : 0
  }));
  const maximum = (field: string) => Math.max(0, ...postCandidates.map(post => Number(post[field] || 0)));
  const minimumPositive = (field: string) => Math.min(...postCandidates.map(post => Number(post[field] || 0)).filter(value => value > 0), Number.POSITIVE_INFINITY);
  const maxCtr = maximum("ctr");
  const maxEngagementRate = maximum("engagementRate");
  const maxLinkClicks = maximum("linkClicks");
  const minCpc = minimumPositive("cpc");
  const minEngagementCost = minimumPositive("costPerEngagement");
  const rankedPosts = postCandidates.map(post => {
    const ctrScore = maxCtr ? post.ctr / maxCtr : 0;
    const cpcScore = post.cpc && Number.isFinite(minCpc) ? minCpc / post.cpc : 0;
    const engagementRateScore = maxEngagementRate ? post.engagementRate / maxEngagementRate : 0;
    const engagementCostScore = post.costPerEngagement && Number.isFinite(minEngagementCost) ? minEngagementCost / post.costPerEngagement : 0;
    const clickVolumeScore = maxLinkClicks ? Math.log1p(post.linkClicks) / Math.log1p(maxLinkClicks) : 0;
    return { ...post, candidateScore: 100 * (ctrScore * .25 + cpcScore * .25 + engagementRateScore * .20 + engagementCostScore * .15 + clickVolumeScore * .15) };
  }).sort((a, b) => b.candidateScore - a.candidateScore || a.cpc - b.cpc || b.ctr - a.ctr);
  const applyRankLabels = async () => {
    setRenaming(true);
    setRenameMessage("");
    try {
      const response = await fetch("/api/vision-x-saha/rename-ranked-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankings: rankedPosts.map((post, index) => ({ rank: index + 1, adIds: post.adIds })) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Rank labels could not be applied.");
      setRenameMessage(`${result.renamed} ad names updated${result.failed ? `. ${result.failed} failed.` : "."}`);
      refresh();
    } catch (error) {
      setRenameMessage(error instanceof Error ? error.message : "Rank labels could not be applied.");
    } finally {
      setRenaming(false);
    }
  };
  return <>
    <SectionHeader eyebrow="Live Meta Ads" title="Advertising" copy={`${data.account.name}. ${data.period.start} to ${data.period.end}.`} action={<button className="vxs-primary" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh"}</button>} />
    <div className="vxs-live-note"><Badge tone="good">Account-level totals</Badge><span>{data.attribution?.source || "Meta Ads insights"}. Active ads refresh with this view. Page publishing permissions are monitored in Post Library.</span></div>
    <Metrics rows={[["Spend", phpPrecise(totals.spend)], ["Purchase value", phpPrecise(totals.purchaseValue)], ["Purchases", number(totals.purchases)], ["CPA", phpPrecise(totals.cpa)], ["ROAS", `${Number(totals.roas || 0).toFixed(2)}x`], ["Clicks", number(totals.clicks)]]} />
    <section className="vxs-card"><div className="vxs-card-head"><div><p>Campaign performance</p><h3>Month-to-date campaigns</h3></div><Badge tone={data.account.status === 1 ? "good" : "warn"}>{data.account.status === 1 ? "Account active" : `Account status ${data.account.status}`}</Badge></div>
      <div className="vxs-simple-list">{data.campaigns.length ? data.campaigns.map((campaign: any) => <div className="vxs-live-row" key={campaign.id}><div><strong>{campaign.name}</strong><span>{number(campaign.impressions)} impressions. {number(campaign.clicks)} clicks. {number(campaign.purchases)} purchases</span></div><div style={{ textAlign: "right" }}><strong>{php(campaign.spend)}</strong><span>{Number(campaign.roas || 0).toFixed(2)}x ROAS. {php(campaign.cpa)} CPA</span></div></div>) : <p className="vxs-empty">No campaign spend was reported for this period.</p>}</div>
    </section>
    <section className="vxs-card vxs-post-ranking"><div className="vxs-card-head"><div><p>Attention and website traffic</p><h3>Top post candidates</h3></div><div className="vxs-ranking-actions"><Badge tone="info">Month to date</Badge><button className="vxs-primary" onClick={applyRankLabels} disabled={renaming || !rankedPosts.length}>{renaming ? "Applying labels" : "Rename ads by rank"}</button></div></div>
      <p className="vxs-running-copy">Candidate score: 25% CTR, 25% CPC, 20% engagement rate, 15% cost per engagement, and 15% link click volume. The top three are the strongest candidates for the next sales test.</p>
      {renameMessage ? <p className="vxs-rename-message">{renameMessage}</p> : null}
      <div className="vxs-ranking-table"><div className="vxs-ranking-row vxs-ranking-head"><span>Rank</span><span>Post</span><span>Score</span><span>Link clicks</span><span>CPC</span><span>CTR</span><span>Eng. rate</span><span>Cost / eng.</span><span>Assessment</span></div>
        {rankedPosts.length ? rankedPosts.map((post, index) => {
          const assessment = index < 3 ? "Top 3 candidate" : post.candidateScore >= 60 ? "Strong signal" : post.candidateScore >= 40 ? "Secondary test" : "Lower priority";
          const tone: Tone = index < 3 ? "good" : post.candidateScore >= 60 ? "info" : post.candidateScore >= 40 ? "warn" : "muted";
          return <div className={`vxs-ranking-row${index < 3 ? " top-candidate" : ""}`} key={post.key}><span><strong>#{index + 1}</strong></span><span className="vxs-ranking-post">{post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" loading="lazy" /> : null}<span><strong>{post.name}</strong><small>{post.postId || "No public post ID"}{post.adCount > 1 ? ` · ${post.adCount} active ads combined` : ""}</small>{post.postLink ? <a href={post.postLink} target="_blank" rel="noreferrer">Open post</a> : null}</span></span><span><strong>{post.candidateScore.toFixed(1)}</strong></span><span>{number(post.linkClicks)}</span><span>{post.cpc ? php(post.cpc) : "No clicks"}</span><span>{percent(post.ctr)}</span><span>{percent(post.engagementRate)}</span><span>{post.costPerEngagement ? php(post.costPerEngagement) : "No engagement"}</span><span><Badge tone={tone}>{assessment}</Badge></span></div>;
        }) : <p className="vxs-empty">No active posts are available to rank.</p>}
      </div>
    </section>
    <section className="vxs-running-ads">
      <div className="vxs-card-head"><div><p>Live delivery</p><h3>Running ads and published posts</h3></div><Badge tone={activeAds.length ? "good" : "warn"}>{activeAds.length ? `${activeAds.length} active` : "No active ads"}</Badge></div>
      <p className="vxs-running-copy">Every active ad in this account, including its preview, Facebook post, setup, and month-to-date results.</p>
      <div className="vxs-ad-grid">{activeAds.length ? activeAds.map((ad: any) => {
        const result = ad.performance || {};
        const targeting = ad.adset?.targeting || {};
        const locations = [...(targeting.geo_locations?.countries || []), ...(targeting.geo_locations?.regions || []).map((region: any) => region.name || region.key), ...(targeting.geo_locations?.cities || []).map((city: any) => city.name || city.key)].filter(Boolean);
        return <article className="vxs-ad-card" key={ad.id}>
          <div className="vxs-ad-preview">
            {ad.creative?.thumbnailUrl ? <img src={ad.creative.thumbnailUrl} alt={`Preview of ${ad.name}`} loading="lazy" /> : <div><strong>No preview returned</strong><span>Open the post or Ads Manager to view the creative.</span></div>}
            <Badge tone="good">Running</Badge><span className="vxs-ad-format">{label(ad.creative?.format)}</span>
          </div>
          <div className="vxs-ad-body">
            <div className="vxs-ad-title"><div><p>{ad.campaign?.name}</p><h4>{ad.name}</h4><span>{ad.adset?.name}</span></div><div className="vxs-ad-links">{ad.postLink ? <a href={ad.postLink} target="_blank" rel="noreferrer">Open post</a> : <span>Post link unavailable</span>}<a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=1438592618166795&selected_ad_ids=${ad.id}`} target="_blank" rel="noreferrer">Open ad</a></div></div>
            <div className="vxs-ad-copy"><strong>{ad.creative?.headline || "No headline"}</strong><p>{ad.creative?.primaryText || "No primary text returned by Meta."}</p>{ad.creative?.description ? <span>{ad.creative.description}</span> : null}</div>
            <div className="vxs-ad-kpis"><div><span>Spend</span><strong>{php(result.spend)}</strong></div><div><span>Purchases</span><strong>{number(result.purchases)}</strong></div><div><span>ROAS</span><strong>{Number(result.roas || 0).toFixed(2)}x</strong></div><div><span>CPA</span><strong>{php(result.cpa)}</strong></div><div><span>CTR</span><strong>{percent(result.ctr)}</strong></div><div><span>CPM</span><strong>{php(result.cpm)}</strong></div></div>
            <div className="vxs-ad-engagement"><span>{number(result.reactions)} reactions</span><span>{number(result.comments)} comments</span><span>{number(result.shares)} shares</span><span>{number(result.saves)} saves</span><span>{number(result.engagements)} engagements</span></div>
            <details className="vxs-ad-details"><summary>View full ad details</summary><dl>
              <div><dt>Post ID</dt><dd>{ad.postId || "Unavailable"}</dd></div><div><dt>Page ID</dt><dd>{ad.pageId || "Unavailable"}</dd></div><div><dt>Creative ID</dt><dd>{ad.creative?.id || "Unavailable"}</dd></div><div><dt>CTA</dt><dd>{label(ad.creative?.callToAction)}</dd></div>
              <div><dt>Objective</dt><dd>{label(ad.campaign?.objective)}</dd></div><div><dt>Optimization</dt><dd>{label(ad.adset?.optimizationGoal)}</dd></div><div><dt>Billing</dt><dd>{label(ad.adset?.billingEvent)}</dd></div><div><dt>Bid strategy</dt><dd>{label(ad.adset?.bidStrategy)}</dd></div>
              <div><dt>Budget</dt><dd>{ad.adset?.budget ? `${php(ad.adset.budget)}. ${ad.adset.budgetType}` : ad.campaign?.budget ? `${php(ad.campaign.budget)}. ${ad.campaign.budgetType}` : "Budget not returned"}</dd></div><div><dt>Schedule</dt><dd>{dateTime(ad.adset?.startTime)}{ad.adset?.endTime ? ` to ${dateTime(ad.adset.endTime)}` : ""}</dd></div>
              <div><dt>Audience age</dt><dd>{targeting.age_min || targeting.age_max ? `${targeting.age_min || "Any"} to ${targeting.age_max || "Any"}` : "Not reported"}</dd></div><div><dt>Locations</dt><dd>{locations.length ? locations.join(", ") : "Not reported"}</dd></div>
              <div><dt>Reach / impressions</dt><dd>{number(result.reach)} / {number(result.impressions)}</dd></div><div><dt>Frequency</dt><dd>{Number(result.frequency || 0).toFixed(2)}x</dd></div><div><dt>Clicks / link clicks</dt><dd>{number(result.clicks)} / {number(result.linkClicks)}</dd></div><div><dt>CPC</dt><dd>{php(result.cpc)}</dd></div>
              <div><dt>Video starts</dt><dd>{number(result.videoStarts)}</dd></div><div><dt>ThruPlays</dt><dd>{number(result.thruPlays)}</dd></div><div><dt>Video completions</dt><dd>{number(result.videoCompletions)}</dd></div><div><dt>Purchase value</dt><dd>{php(result.purchaseValue)}</dd></div>
            </dl>{ad.creative?.destinationUrl ? <a className="vxs-ad-destination" href={ad.creative.destinationUrl} target="_blank" rel="noreferrer">Open destination page</a> : null}</details>
          </div>
        </article>;
      }) : <div className="vxs-card"><p className="vxs-empty">Meta returned no ads whose configured and effective statuses are both active.</p></div>}</div>
    </section>
  </>;
}

function LegacyTrafficView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const provider = live?.traffic;
  if (!provider?.connected) return <><SectionHeader eyebrow="SecureCOD analytics" title="Landing Traffic" copy="Visitor activity across both landing pages." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const data = provider.data;
  const paths = data.visitsByPath || [];
  const regions = data.visitsByRegion || [];
  const funnel = live?.sheet.connected ? live.sheet.data?.funnel?.byEvent || {} : {};
  const funnelPages = live?.sheet.connected ? live.sheet.data?.funnel?.byPage || {} : {};
  return <>
    <SectionHeader eyebrow="SecureCOD analytics" title="Landing Traffic" copy={`Qualified Philippine buyer traffic. Live window: ${data.windowMinutes} minutes.`} action={<div className="vxs-header-actions"><a className="vxs-secondary" href={LIVE_SAHA_URL} target="_blank" rel="noreferrer">Open /livesaha</a><button className="vxs-primary" onClick={refresh}>Refresh</button></div>} />
    <Metrics rows={[["Live PH visitors", number(data.liveVisitors)], ["Qualified visits", number(data.totalVisits)], ["Unique PH visitors", number(data.uniqueVisitors)], ["Excluded non-PH traffic", number(data.excludedVisits)], ["/visionsaha unique", number(paths.find((item: any) => item.path === "/visionsaha")?.uniqueVisitors)], ["/livesaha unique", number(paths.find((item: any) => item.path === "/livesaha")?.uniqueVisitors)], ["/region7lakatan unique", number(paths.find((item: any) => item.path === "/region7lakatan")?.uniqueVisitors)]]} />
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Checkout funnel</p><h3>Where buyers stop</h3></div><Badge tone="info">Privacy-safe events</Badge></div><Metrics rows={[["CTA clicks", number(funnel.cta_clicked)], ["Checkout opened", number(funnel.checkout_opened)], ["Form started", number(funnel.form_started)], ["Submit attempts", number(funnel.submit_started)], ["Orders created", number(funnel.order_created)], ["Validation errors", number(funnel.validation_failed)], ["Duplicate blocks", number(funnel.duplicate_blocked)], ["Order failures", number(funnel.order_failed)]]} /></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Page comparison</p><h3>Funnel events by landing page</h3></div></div><div className="vxs-simple-list">{["/visionsaha", "/livesaha", "/region7lakatan"].map(path => { const page = funnelPages[path] || {}; return <div className="vxs-live-row" key={path}><div><strong>{path}</strong><span>{number(page.cta_clicked)} CTA clicks · {number(page.form_started)} form starts · {number(page.submit_started)} submits</span></div><strong>{number(page.order_created)} orders</strong></div>; })}</div></section>
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Recent visitors</p><h3>Last 30 minutes</h3></div><Badge tone="good">Live</Badge></div><div className="vxs-live-feed">{(data.recentVisits || []).length ? data.recentVisits.map((visit: any, index: number) => <div key={`${visit.city}-${visit.minutesAgo}-${index}`}><i /><span><b>{visit.city || "Unknown"}</b><small>{visit.path} · {visit.source || "Direct"} · {visit.minutesAgo} min ago</small></span></div>) : <p>No geolocated visits in the live window.</p>}</div></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Demand geography</p><h3>Visits by region</h3></div></div><div className="vxs-simple-list">{regions.length ? regions.map((item: any) => <div className="vxs-live-row" key={item.region}><div><strong>{item.region}</strong></div><strong>{number(item.count)}</strong></div>) : <p className="vxs-empty">No region data yet.</p>}</div></section>
    </div>
  </>;
}

function TrafficGlobe({ visits }: { visits: any[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !hostRef.current || globeRef.current || !(window as any).Globe) return;
    const host = hostRef.current;
    const globe = (window as any).Globe()(host)
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .backgroundColor("rgba(0,0,0,0)")
      .atmosphereColor("#52b788")
      .atmosphereAltitude(0.2)
      .pointOfView({ lat: 12.8797, lng: 121.774, altitude: 1.8 }, 0);
    globe.controls().autoRotate = false;
    globe.controls().enableZoom = true;
    globe.controls().minDistance = 180;
    globe.controls().maxDistance = 500;
    const resize = () => { if (host.clientWidth && host.clientHeight) globe.width(host.clientWidth).height(host.clientHeight); };
    globeRef.current = globe;
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (typeof globe._destructor === "function") globe._destructor();
      host.replaceChildren();
      globeRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const points = visits.filter(visit => Number.isFinite(Number(visit.latitude)) && Number.isFinite(Number(visit.longitude)));
    globe
      .ringsData(points.map(visit => ({ lat: Number(visit.latitude), lng: Number(visit.longitude), maxR: 4, propagationSpeed: 2, repeatPeriod: 1400, color: () => "rgba(82,183,136,.85)" })))
      .ringMaxRadius("maxR").ringPropagationSpeed("propagationSpeed").ringRepeatPeriod("repeatPeriod").ringColor("color")
      .pointsData(points.map(visit => ({ lat: Number(visit.latitude), lng: Number(visit.longitude), size: .25, color: "#52b788", label: `${visit.city || "Unknown"} · ${visit.path || "Landing page"} · ${visit.source || "Direct"} · ${visit.minutesAgo || 0} min ago` })))
      .pointColor("color").pointRadius("size").pointAltitude(.01).pointLabel("label");
  }, [visits, ready]);

  return <><Script src="https://unpkg.com/globe.gl@2.45.0/dist/globe.gl.min.js" strategy="afterInteractive" onLoad={() => setReady(true)} onReady={() => setReady(true)} /><div className="vxs-globe-host" ref={hostRef}>{!ready ? <span>Loading live visitor globe…</span> : null}</div></>;
}

function TrafficView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const provider = live?.traffic;
  if (!provider?.connected) return <><SectionHeader eyebrow="SecureCOD analytics" title="Landing Traffic" copy="Visitor activity across all Vision x Saha landing pages." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const data = provider.data;
  const paths = data.visitsByPath || [];
  const regions = data.visitsByRegion || [];
  const sources = data.visitsBySource || [];
  const visits = data.recentVisits || [];
  const funnel = live?.sheet.connected ? live.sheet.data?.funnel?.byEvent || {} : {};
  const funnelPages = live?.sheet.connected ? live.sheet.data?.funnel?.byPage || {} : {};
  const activity = live?.sheet.connected ? live.sheet.data?.recentActivity || [] : [];
  const pagePaths = ["/visionsaha", "/livesaha", "/region7lakatan"];
  return <>
    <SectionHeader eyebrow="SecureCOD analytics" title="Landing Traffic" copy={`Qualified Philippine buyer traffic with a ${data.windowMinutes}-minute live map.`} action={<div className="vxs-header-actions"><a className="vxs-secondary" href={LIVE_SAHA_URL} target="_blank" rel="noreferrer">Open /livesaha</a><button className="vxs-primary" onClick={refresh}>Refresh</button></div>} />
    <Metrics rows={[["Live PH visitors", number(data.liveVisitors)], ["Qualified visits", number(data.totalVisits)], ["Unique PH visitors", number(data.uniqueVisitors)], ["Excluded non-PH", number(data.excludedVisits)], ["CTA clicks", number(funnel.cta_clicked)], ["Orders created", number(funnel.order_created)]]} />
    <section className="vxs-card vxs-traffic-card"><div className="vxs-card-head"><div><p>Live buyer geography</p><h3>Visitor globe</h3></div><Badge tone="good">Live · Philippines</Badge></div><div className="vxs-traffic-layout"><TrafficGlobe visits={visits} /><div className="vxs-live-feed"><strong>Live visitor feed</strong>{visits.length ? visits.map((visit: any, index: number) => <div key={`${visit.city}-${visit.minutesAgo}-${index}`}><i /><span><b>{visit.city || "Unknown"}</b><small>{visit.path} · {visit.source || "Direct"} · {visit.minutesAgo} min ago</small></span></div>) : <p>No geolocated visits in the last {data.windowMinutes} minutes.</p>}</div></div></section>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Landing-page comparison</p><h3>Traffic and checkout conversion</h3></div><Badge tone="info">Privacy-safe</Badge></div><div className="vxs-landing-grid">{pagePaths.map(path => { const page = funnelPages[path] || {}; const pathData = paths.find((item: any) => item.path === path) || {}; const unique = Number(pathData.uniqueVisitors || 0); const orders = Number(page.order_created || 0); const conversion = unique ? orders / unique * 100 : 0; return <article key={path}><div><strong>{path}</strong><Badge tone={orders ? "good" : "muted"}>{conversion.toFixed(2)}% conversion</Badge></div><dl><div><dt>Unique visitors</dt><dd>{number(unique)}</dd></div><div><dt>CTA clicks</dt><dd>{number(page.cta_clicked)}</dd></div><div><dt>Form starts</dt><dd>{number(page.form_started)}</dd></div><div><dt>Orders</dt><dd>{number(orders)}</dd></div></dl></article>; })}</div></section>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Checkout funnel</p><h3>Where buyers stop</h3></div></div><div className="vxs-funnel-steps">{[["CTA clicks", funnel.cta_clicked], ["Checkout opened", funnel.checkout_opened], ["Form started", funnel.form_started], ["Submit attempts", funnel.submit_started], ["Orders created", funnel.order_created]].map(([label, value], index) => <div key={String(label)}><span>{index + 1}</span><strong>{number(value)}</strong><small>{label}</small></div>)}</div></section>
    <div className="vxs-two-col" style={{ marginTop: 16 }}><section className="vxs-card"><div className="vxs-card-head"><div><p>Demand geography</p><h3>Visits by region</h3></div></div><div className="vxs-simple-list">{regions.length ? regions.map((item: any) => <div className="vxs-live-row" key={item.region}><div><strong>{item.region}</strong></div><strong>{number(item.count)}</strong></div>) : <p className="vxs-empty">No region data yet.</p>}</div></section><section className="vxs-card"><div className="vxs-card-head"><div><p>Acquisition</p><h3>Traffic sources</h3></div></div><div className="vxs-simple-list">{sources.length ? sources.map((item: any) => <div className="vxs-live-row" key={item.source}><div><strong>{item.source || "Direct"}</strong></div><strong>{number(item.count)}</strong></div>) : <p className="vxs-empty">Traffic-source totals will populate after the analytics update.</p>}</div></section></div>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Visitor journey</p><h3>Recent landing-page actions</h3></div><Badge tone="info">No personal data</Badge></div><div className="vxs-simple-list">{activity.length ? activity.map((item: any, index: number) => <div className="vxs-live-row" key={`${item.timestamp}-${index}`}><div><strong>{String(item.event || "activity").replaceAll("_", " ")}</strong><span>{item.page || "Landing page"}{item.detail ? ` · ${item.detail}` : ""} · {dateTime(item.timestamp)}</span></div><strong>{item.device || ""}{item.seconds ? ` · ${item.seconds}s` : ""}</strong></div>) : <p className="vxs-empty">New visitor actions will appear here after deployment.</p>}</div></section>
  </>;
}

function BillingView({ live, loading, refresh, period, onPeriodChange }: { live: LiveData | null; loading: boolean; refresh: () => void; period: ReportingPeriod; onPeriodChange: (period: ReportingPeriod) => void }) {
  const [targetPieces, setTargetPieces] = useState("2000");
  const [successRateInput, setSuccessRateInput] = useState<string | null>(null);
  const [revenuePerPieceInput, setRevenuePerPieceInput] = useState<string | null>(null);
  const [adPerPieceInput, setAdPerPieceInput] = useState<string | null>(null);
  const [courierPerOrderInput, setCourierPerOrderInput] = useState("0");
  const pancake = live?.pancake;
  const sheet = live?.sheet;
  if (!pancake?.connected || !sheet?.connected) return <><SectionHeader eyebrow="Partnership finance" title="Billing Report" copy="Reconciles the agreement, live orders, stock costs, and advertising spend." /><LoadingState loading={loading} error={pancake?.error || sheet?.error} refresh={refresh} /></>;

  const performance = pancake.data.performance || {};
  const capital = sheet.data.capital || {};
  const inventory = sheet.data.inventory || {};
  const summary = inventory.summary || {};
  const agreedCapital = 100000;
  const agreedContribution = 50000;
  const openingStock = Number(summary.openingStock || inventory.item?.openingStock || 0);
  const inventoryCapital = Number(capital.byContributor?.Kevin?.categories?.Inventory || 0);
  const unitCost = openingStock > 0 ? inventoryCapital / openingStock : 0;
  const deliveredPieces = Number(performance.deliveredPieces || 0);
  const returnedPieces = Number(performance.returnPieces || 0);
  const courierPushedPieces = Number(performance.courierPushedPieces || 0);
  const deliveredValue = Number(performance.deliveredValue || 0);
  const recognizedCogs = deliveredPieces * unitCost;
  const grossMargin = deliveredValue - recognizedCogs;
  const adSpend = live?.meta.connected ? Number(live.meta.data?.totals?.spend || 0) : null;
  const preliminaryAfterAds = adSpend === null ? null : grossMargin - adSpend;
  const currentStockValue = Number(summary.currentStock || 0) * unitCost;
  const dispatchedStockValue = Number(summary.dispatchedPieces || 0) * unitCost;
  const returnStockValue = returnedPieces * unitCost;
  const finalSettlementReady = adSpend !== null;
  const contributor = capital.byContributor || {};
  const cutoffDate = performance.cutoffDate || performance.end || "Not calculated";
  const nextBillingDate = performance.nextBillingDate || "Not calculated";
  const completedOrders = Number(performance.delivered || 0) + Number(performance.returned || 0);
  const baselineSuccessRate = completedOrders ? Number(performance.delivered || 0) / completedOrders * 100 : 0;
  const baselineRevenuePerPiece = deliveredPieces ? deliveredValue / deliveredPieces : 0;
  const baselineAdPerPiece = deliveredPieces && adSpend !== null ? adSpend / deliveredPieces : 0;
  const baselinePiecesPerOrder = Number(performance.delivered || 0) ? deliveredPieces / Number(performance.delivered || 0) : 0;
  const projectionPieces = Math.max(0, Number(targetPieces) || 0);
  const projectionSuccessRate = Math.max(0, Math.min(100, Number(successRateInput ?? baselineSuccessRate) || 0));
  const projectionRevenuePerPiece = Math.max(0, Number(revenuePerPieceInput ?? baselineRevenuePerPiece) || 0);
  const projectionAdPerPiece = Math.max(0, Number(adPerPieceInput ?? baselineAdPerPiece) || 0);
  const projectionCourierPerOrder = Math.max(0, Number(courierPerOrderInput) || 0);
  const projectedDeliveredPieces = projectionPieces * projectionSuccessRate / 100;
  const projectedDeliveredOrders = baselinePiecesPerOrder ? projectedDeliveredPieces / baselinePiecesPerOrder : 0;
  const projectedRevenue = projectedDeliveredPieces * projectionRevenuePerPiece;
  const projectedCogs = projectionPieces * unitCost;
  const projectedAdSpend = projectedDeliveredPieces * projectionAdPerPiece;
  const projectedCourier = projectedDeliveredOrders * projectionCourierPerOrder;
  const projectedNet = projectedRevenue - projectedCogs - projectedAdSpend - projectedCourier;

  return <>
    <SectionHeader eyebrow="Agreement-based finance" title="Billing Report" copy={`${performance.label || "Selected period"}: ${performance.start || ""} to today. Only delivered Lakatan orders count as sales and COGS.`} action={<div className="vxs-header-actions"><button className="vxs-secondary" onClick={() => onPeriodChange("mtd")} disabled={period === "mtd" || loading}>Use MTD projection baseline</button><button className="vxs-secondary" onClick={() => onPeriodChange("billing")} disabled={period === "billing" || loading}>{period === "billing" ? "15-day cycle selected" : "Use 15-day billing cycle"}</button><button className="vxs-primary" onClick={refresh} disabled={loading}>{loading ? "Refreshing" : "Refresh figures"}</button></div>} />
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Next settlement</p><h3>Profit-sharing schedule</h3></div><Badge tone="info">Agreement cycle #{number(performance.cycleNumber || 0)}</Badge></div><div className="vxs-mini-metrics"><div><span>Current cycle closes</span><strong>{cutoffDate}</strong></div><div><span>Next billing & profit-sharing review</span><strong>{nextBillingDate}</strong></div><div><span>Then verify</span><strong>Delivered sales − COGS − ads − courier/other costs</strong></div></div><p className="vxs-card-foot">On {nextBillingDate}, prepare the statement, reconcile actual courier remittance and approved expenses, then both partners review the final profit before the 60% Kevin / 40% Vision split.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Whole-business projection</p><h3>Expected result for the Lakatan stock run</h3></div><Badge tone="info">Editable assumptions</Badge></div><p className="vxs-card-foot">This works like the Jhoanne–Kevin projection: change an assumption and the expected business result and partner shares update instantly. The defaults come from the currently selected live period.</p><div className="vxs-two-col"><div className="vxs-simple-list"><label>Stock planned to ship (pcs)<input value={targetPieces} type="number" min="0" onChange={event => setTargetPieces(event.target.value)} /></label><label>Expected delivery success (%)<input value={successRateInput ?? baselineSuccessRate.toFixed(1)} type="number" min="0" max="100" step="0.1" onChange={event => setSuccessRateInput(event.target.value)} /></label><label>Revenue per delivered piece (PHP)<input value={revenuePerPieceInput ?? baselineRevenuePerPiece.toFixed(2)} type="number" min="0" step="0.01" onChange={event => setRevenuePerPieceInput(event.target.value)} /></label><label>Ad cost per delivered piece (PHP)<input value={adPerPieceInput ?? baselineAdPerPiece.toFixed(2)} type="number" min="0" step="0.01" onChange={event => setAdPerPieceInput(event.target.value)} /></label><label>Courier cost per delivered order (PHP)<input value={courierPerOrderInput} type="number" min="0" step="0.01" onChange={event => setCourierPerOrderInput(event.target.value)} /><small>Enter this once the courier cost is known; it is zero in the projection until then.</small></label></div><div><Metrics rows={[["Projected delivered pieces", `${number(projectedDeliveredPieces)} pcs`], ["Projected collected sales", php(projectedRevenue)], ["Projected stock cost at risk", php(projectedCogs)], ["Projected ad spend", php(projectedAdSpend)], ["Projected courier cost", php(projectedCourier)], ["Projected net profit", php(projectedNet)], ["Kevin projected 60%", php(projectedNet * .6)], ["Vision projected 40%", php(projectedNet * .4)]]} /></div></div></section>
    <div className="vxs-demo-note"><strong>{finalSettlementReady ? "Preliminary statement" : "Settlement blocked"}</strong><span>{finalSettlementReady ? "Advertising spend is live. Courier remittances, courier fees, refunds, and other operating expenses still require their own recorded proof before this becomes a final profit distribution." : "Meta Ads is temporarily unavailable, so ad spend is intentionally not estimated. Refresh after Meta reconnects before using this report for billing."}</span></div>
    <Metrics rows={[["Delivered sales", php(deliveredValue)], ["Delivered goods / COGS", `${number(deliveredPieces)} pcs · ${php(recognizedCogs)}`], ["Gross margin before ads", php(grossMargin)], ["Meta spend", adSpend === null ? "Awaiting live Meta data" : phpPrecise(adSpend)], ["Preliminary after ads", preliminaryAfterAds === null ? "Not calculated" : php(preliminaryAfterAds)], ["Return stock to inspect", `${number(returnedPieces)} pcs · ${php(returnStockValue)}`]]} />
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Cost of goods</p><h3>Stock use and sale recognition</h3></div><Badge tone="info">₱{unitCost.toFixed(2)} / pc</Badge></div><div className="vxs-simple-list">
        <div className="vxs-live-row"><div><strong>Initial Lakatan cost basis</strong><span>{php(inventoryCapital)} initial inventory contribution ÷ {number(openingStock)} opening pieces</span></div><strong>{phpPrecise(unitCost)} / pc</strong></div>
        <div className="vxs-live-row"><div><strong>Courier-dispatched stock</strong><span>{number(courierPushedPieces)} pcs in this billing period. This is operational stock usage, not automatically sales.</span></div><strong>{php(courierPushedPieces * unitCost)}</strong></div>
        <div className="vxs-live-row"><div><strong>Successfully sold</strong><span>{number(deliveredPieces)} delivered pieces. These alone become COGS and delivered revenue.</span></div><strong>{php(recognizedCogs)}</strong></div>
        <div className="vxs-live-row"><div><strong>Returned / returning</strong><span>{number(returnedPieces)} pieces are held outside COGS until physically inspected and either restocked or written off.</span></div><strong>{php(returnStockValue)}</strong></div>
      </div></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Stock position</p><h3>Capital still represented by goods</h3></div><Badge tone={summary.lowStock ? "bad" : "good"}>{summary.lowStock ? "Low stock" : "Healthy"}</Badge></div><div className="vxs-simple-list">
        <div className="vxs-live-row"><div><strong>Available physical stock</strong><span>{number(summary.currentStock)} pcs available from the inventory ledger</span></div><strong>{php(currentStockValue)}</strong></div>
        <div className="vxs-live-row"><div><strong>All courier-dispatched stock</strong><span>{number(summary.dispatchedPieces)} pcs deducted after tracking assignment</span></div><strong>{php(dispatchedStockValue)}</strong></div>
        <div className="vxs-live-row"><div><strong>Pending demand</strong><span>{number(summary.pendingDemand)} pcs across {number(summary.pendingOrders)} unpushed orders; it has not been deducted.</span></div><strong>Not COGS</strong></div>
        <div className="vxs-live-row"><div><strong>Return inspection queue</strong><span>{number(summary.returnInspection)} parcels need a physical count before stock is restored.</span></div><strong>Review</strong></div>
      </div></section>
    </div>
    <div className="vxs-two-col" style={{ marginTop: 16 }}>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Capital reconciliation</p><h3>Agreed vs recorded capital</h3></div><Badge tone="info">Agreement</Badge></div><div className="vxs-simple-list">
        <div className="vxs-live-row"><div><strong>Agreed pool</strong><span>₱50,000 Kevin + ₱50,000 Rustan</span></div><strong>{php(agreedCapital)}</strong></div>
        <div className="vxs-live-row"><div><strong>Kevin recorded</strong><span>{php(Number(contributor.Kevin?.total || 0) - agreedContribution)} above the original agreed contribution; retain proof for each entry.</span></div><strong>{php(contributor.Kevin?.total)}</strong></div>
        <div className="vxs-live-row"><div><strong>Rustan recorded</strong><span>{php(Number(contributor.Rustan?.total || 0) - agreedContribution)} versus the agreed advertising contribution.</span></div><strong>{php(contributor.Rustan?.total)}</strong></div>
        <div className="vxs-live-row"><div><strong>Recorded capital total</strong><span>Capital is funding, not a period expense. It is not deducted again as COGS.</span></div><strong>{php(capital.total)}</strong></div>
      </div></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Agreement settlement</p><h3>What can be billed now</h3></div><Badge tone={finalSettlementReady ? "warn" : "bad"}>{finalSettlementReady ? "Incomplete" : "Meta pending"}</Badge></div><div className="vxs-simple-list">
        <div className="vxs-live-row"><div><strong>Profit-sharing rule</strong><span>Final monthly net profit: 60% Kevin / 40% Vision, after all agreed deductions.</span></div><strong>60 / 40</strong></div>
        <div className="vxs-live-row"><div><strong>Billing cycle</strong><span>The agreement calls for a statement every 15 calendar days. This view follows the current 1–15 or 16–month-end cycle.</span></div><strong>15 days</strong></div>
        <div className="vxs-live-row"><div><strong>Still required for final distribution</strong><span>Courier COD remittance, courier fees, refunds, and any operating expense proof must be entered before a final profit amount is approved.</span></div><strong>Pending</strong></div>
        <div className="vxs-live-row"><div><strong>Distributable profit</strong><span>Never release based on capital or dispatched goods alone.</span></div><strong>{finalSettlementReady ? "Awaiting reconciliation" : "Blocked"}</strong></div>
      </div></section>
    </div>
  </>;
}

function BillingReportIndex({ live, loading, onOpen, onRefresh }: { live: LiveData | null; loading: boolean; onOpen: (period: ReportingPeriod) => void; onRefresh: () => void }) {
  const reports: Array<{ period: ReportingPeriod; label: string; range: string; detail: string; state: string; tone: Tone }> = [
    { period: "initial_settlement", label: "Initial Remittance", range: "September 26 - October 15, 2026", detail: "First settlement through the agreed cut-off. Only courier-pushed parcels are included.", state: "Ready for reconciliation", tone: "warn" },
    { period: "current_settlement", label: "Remittance Cycle 2", range: "October 16 - October 31, 2026", detail: "Current live cycle. Courier and ad figures continue to update until cut-off.", state: "Live / in progress", tone: "good" }
  ];
  return <div className="vxs-report9"><SectionHeader eyebrow="Partnership finance" title="Remittance Reports" copy="Each card is one settlement period. Open a period to review its operational performance, actual courier cash, evidence, and profit-sharing calculation." action={<button className="vxs-secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing" : "Refresh data"}</button>} />
    <section className="vxs-report-insight"><h3>How billing works</h3><p>One report equals one agreed remittance range. The report begins with a POS projection, then becomes official only after courier remittance and expense evidence are recorded for that exact range.</p></section>
    <section className="vxs-billing-report-list">{reports.map(report => <article key={report.period} className="vxs-card"><div className="vxs-card-head"><div><p>15-day remittance report</p><h3>{report.label}</h3></div><Badge tone={report.tone}>{report.state}</Badge></div><strong className="vxs-billing-range">{report.range}</strong><p>{report.detail}</p><div className="vxs-form-actions"><button className="vxs-primary" onClick={() => onOpen(report.period)}>Open report</button></div></article>)}</section>
    <p className="vxs-card-foot">Generated from the Vision X Saha Command Center. {live?.generatedAt ? `Last source sync: ${dateTime(live.generatedAt)}.` : "Loading the latest connected-source status."}</p>
  </div>;
}

export function InitialSettlementStatic({ onBack }: { onBack?: () => void }) {
  // FINAL, LOCKED figures for the Sep 26 - Oct 15, 2026 initial cut-off.
  // Frozen 2026-10-21 to match the remittance SOA workbook exactly. Do not fetch or compute from live data.
  const f = {
    pushed: 167, pushedCod: 204513, delivered: 123, failed: 41, inTransit: 3,
    deliveredCod: 133157, deliveredPieces: 740,
    courierFee: 17044.96, packaging: 2696, printer: 2500, cogs: 29600, adsFull: 57991.19, ads: 28995.60,
    pool: 52320.45, kevin: 31392.27, vision: 20928.18,
    expectedWithdrawal: 116112.04,
    collected: 104141.51, distributableNow: 40349.92, kevinNow: 24209.95, visionNow: 16139.97,
    outstanding: 11970.53, kevinLater: 7182.32, visionLater: 4788.21
  };
  const successRate = f.delivered / f.pushed * 100;
  const failureRate = f.failed / f.pushed * 100;
  const transitRate = f.inTransit / f.pushed * 100;
  // Oct 1-15 performance, frozen from POS. [province, pushed, delivered, failed, deliveredCOD]
  const prov: Array<[string, number, number, number, number]> = [
    ["Metro Manila",12,12,0,10788],["Batangas",9,6,3,7594],["Pangasinan",9,6,3,4794],
    ["Cavite",8,7,1,12493],["Laguna",7,6,1,5694],["Negros Occidental",5,5,0,3995],
    ["Bulacan",5,4,1,5396],["Zambales",4,3,1,6497],["Iloilo",4,1,3,1699],
    ["Cebu",4,4,0,2296],["Western Samar",4,4,0,2596],["Camarines Sur",4,2,2,1298],
    ["Nueva Ecija",4,4,0,3496],["Palawan",4,1,1,499],["Masbate",4,3,1,2997],
    ["Zamboanga del Sur",3,2,1,1598],["Davao del Sur",3,2,1,3498],["South Cotabato",3,2,1,2198],
    ["Cagayan",3,3,0,1797],["Isabela",3,2,1,3378],["Rizal",3,3,0,2997],
    ["Tarlac",3,2,1,2198],["Bataan",3,3,0,3897],["Ilocos Sur",3,2,1,1298],
    ["Abra",3,2,1,4698],["Others (39 provinces)",51,32,17,33468]
  ];
  // 4 landing-page offers (+1 outlier). [label, orders, delivered, failed, price, deliveredRevenue]
  const offers: Array<[string, number, number, number, number, number]> = [
    ["2 pcs · ₱499",62,51,10,499,25449],["4 pcs · ₱799",44,36,8,799,28764],
    ["10 pcs · ₱1,699",33,22,10,1699,37378],["20 pcs · ₱2,999",28,13,13,2999,38987],
    ["Other (14 pcs)",1,1,0,2579,2579]
  ];
  const cpaOrder = 345.19, cpaDelivered = 471.47, roas = 2.30;
  const fc = { marginPc: 77.72, pcsSuccess: 61.5, projDelivered: 1229, profit: 90346, kevin: 54208, vision: 36139 };
  const rtone = (r: number) => r > 33 ? "#b42318" : r > 20 ? "#b26a00" : "#2d6a4f";
  const amount = (label: string, value: string, strong?: boolean) => <tr><td style={{ fontWeight: strong ? 700 : 400 }}>{label}</td><td style={{ textAlign: "right", fontWeight: strong ? 700 : 400 }}>{value}</td></tr>;
  return <div className="vxs-report9">
    <SectionHeader eyebrow="Remittance statement of account — FINAL" title="Courier Remittance SOA — Initial Settlement" copy="Sep 26 to Oct 15, 2026. Figures are locked for this closed cut-off and match the remittance sheet exactly." action={<div className="vxs-header-actions">{onBack ? <button className="vxs-secondary" onClick={onBack}>All report periods</button> : null}<Badge tone="good">Final / Locked</Badge></div>} />
    <section className="vxs-report-summary"><article className="cash"><span>Delivered COD</span><strong>{php(f.deliveredCod)}</strong><small>{number(f.delivered)} delivered / {percent(successRate)} success</small></article><article className="cost"><span>Courier fee (reconciled)</span><strong>{php(f.courierFee)}</strong><small>Forward + return shipping</small></article><article className="profit"><span>Profit pool</span><strong>{php(f.pool)}</strong><small>Kevin {php(f.kevin)} / Vision {php(f.vision)}</small></article></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Waterfall 1 — Expected (full delivered COD)</p><h3>Expected deduction waterfall</h3></div><Badge tone="info">Projected pool</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Line</th><th style={{ textAlign: "right" }}>Amount (PHP)</th></tr></thead><tbody>
      {amount("Delivered COD (full)", php(f.deliveredCod))}
      {amount("Less: courier fee (reconciled)", "- " + php(f.courierFee))}
      {amount("Less: Meta ads — 50% of " + php(f.adsFull) + " (3 accounts)", "- " + php(f.ads))}
      {amount("Less: COGS reserve (740 pcs × ₱40)", "- " + php(f.cogs))}
      {amount("Less: packaging (whole value)", "- " + php(f.packaging))}
      {amount("Less: waybill printer", "- " + php(f.printer))}
      {amount("= Profit pool (expected)", php(f.pool), true)}
      {amount("Kevin — 60%", php(f.kevin))}
      {amount("Vision — 40%", php(f.vision))}
    </tbody></table></div><p className="vxs-card-foot">Expected pool once the courier releases the full delivered COD. Ads: project pays 50% of the ₱57,991.19 verified spend. COGS reserved to rebuy the 740 delivered pieces before any split.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Waterfall 2 — Actual (money on hand)</p><h3>Actual deduction waterfall</h3></div><Badge tone="warn">Cash released so far</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Line</th><th style={{ textAlign: "right" }}>Amount (PHP)</th></tr></thead><tbody>
      {amount("Actual cash on hand (courier released)", php(f.collected))}
      {amount("Less: Meta ads — 50%", "- " + php(f.ads))}
      {amount("Less: COGS reserve (740 pcs × ₱40)", "- " + php(f.cogs))}
      {amount("Less: packaging (whole value)", "- " + php(f.packaging))}
      {amount("Less: waybill printer", "- " + php(f.printer))}
      {amount("= Distributable now", php(f.distributableNow), true)}
      {amount("Kevin — 60%", php(f.kevinNow))}
      {amount("Vision — 40%", php(f.visionNow))}
    </tbody></table></div><p className="vxs-card-foot">Starts from the cash the courier has actually released ({php(f.collected)}). That amount is already net of courier shipping, so the courier fee is NOT subtracted again here. This is what is safe to split right now.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Gap between the two</p><h3>Still to collect — carryover to Cycle 2</h3></div><Badge tone="info">Not yet released</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Line</th><th style={{ textAlign: "right" }}>Amount (PHP)</th></tr></thead><tbody>
      {amount("Expected net courier withdrawal (full)", php(f.expectedWithdrawal))}
      {amount("Collected so far", php(f.collected))}
      {amount("Still to collect → rolls to Cycle 2", php(f.outstanding), true)}
      {amount("Later — Kevin 60%", php(f.kevinLater))}
      {amount("Later — Vision 40%", php(f.visionLater))}
    </tbody></table></div><p className="vxs-card-foot">The gap between the expected pool and what is distributable now equals this outstanding courier cash. It is 100% distributable when it lands (all costs already covered) and is carried into the Cycle 2 settlement.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Order performance</p><h3>Courier outcome mix</h3></div><Badge tone="warn">{percent(failureRate)} failed</Badge></div><div className="vxs-outcome-layout"><div className="vxs-outcome-donut" style={{ background: `conic-gradient(#2d6a4f 0 ${successRate}%, #b42318 ${successRate}% ${successRate + failureRate}%, #d4a017 ${successRate + failureRate}% 100%)` }}><div><strong>{number(f.pushed)}</strong><span>Pushed</span></div></div><div className="vxs-outcome-legend"><p><i className="delivered" /><span>Delivered</span><strong>{number(f.delivered)} · {percent(successRate)}</strong></p><p><i className="failed" /><span>Returning / returned</span><strong>{number(f.failed)} · {percent(failureRate)}</strong></p><p><i className="progress" /><span>In transit</span><strong>{number(f.inTransit)} · {percent(transitRate)}</strong></p></div></div><p className="vxs-card-foot">{number(f.pushed)} parcels pushed · {php(f.pushedCod)} courier-pushed COD (tracking value, not cash received).</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Performance · Oct 1-15</p><h3>Delivery by province</h3></div><Badge tone="info">Green good · red high return</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Province</th><th style={{ textAlign: "right" }}>Pushed</th><th style={{ textAlign: "right" }}>Delivered</th><th style={{ textAlign: "right" }}>Delivered %</th><th style={{ textAlign: "right" }}>Return %</th><th style={{ textAlign: "right" }}>Delivered COD</th></tr></thead><tbody>{prov.map(([name, p, d, fa, c]) => { const dr = p ? d / p * 100 : 0; const rr = p ? fa / p * 100 : 0; return <tr key={name}><td>{name}</td><td style={{ textAlign: "right" }}>{number(p)}</td><td style={{ textAlign: "right" }}>{number(d)}</td><td style={{ textAlign: "right", color: rtone(100 - dr) }}>{dr.toFixed(0)}%</td><td style={{ textAlign: "right", color: rtone(rr) }}>{rr.toFixed(0)}%</td><td style={{ textAlign: "right" }}>{php(c)}</td></tr>; })}</tbody></table></div><p className="vxs-card-foot">Best: Metro Manila, Cebu, Negros Occidental, Nueva Ecija at 100% delivered. Worst: Iloilo and Palawan at 25%. Provinces with under 3 parcels grouped as Others.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Performance · Oct 1-15</p><h3>By offer (landing page)</h3></div><Badge tone="warn">Bigger offers fail more</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Offer</th><th style={{ textAlign: "right" }}>Orders</th><th style={{ textAlign: "right" }}>Delivered %</th><th style={{ textAlign: "right" }}>Return %</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Revenue</th></tr></thead><tbody>{offers.map(([name, o, d, fa, price, rev]) => { const dr = o ? d / o * 100 : 0; const rr = o ? fa / o * 100 : 0; return <tr key={name}><td>{name}</td><td style={{ textAlign: "right" }}>{number(o)}</td><td style={{ textAlign: "right", color: rtone(100 - dr) }}>{dr.toFixed(0)}%</td><td style={{ textAlign: "right", color: rtone(rr) }}>{rr.toFixed(0)}%</td><td style={{ textAlign: "right" }}>{php(price)}</td><td style={{ textAlign: "right" }}>{php(rev)}</td></tr>; })}</tbody></table></div><p className="vxs-card-foot">The two small offers (2 & 4 pcs) deliver reliably at 82%. The 20-pc offer fails 46% — nearly half do not deliver — even though each delivered one is worth ₱2,999. The 10 & 20-pc offers are where returns pile up; tighten COD confirmation on those.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Performance · Oct 1-15</p><h3>Ad efficiency (CPA & ROAS)</h3></div><Badge tone={roas >= 2 ? "good" : "warn"}>{roas.toFixed(2)}x ROAS</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Metric</th><th style={{ textAlign: "right" }}>Value</th></tr></thead><tbody>
      {amount("Total ad spend (3 accounts)", php(f.adsFull))}
      {amount("CPA per order (168 orders)", php(cpaOrder))}
      {amount("CPA per delivered sale (123)", php(cpaDelivered))}
      {amount("ROAS (delivered COD ÷ ad spend)", roas.toFixed(2) + "x")}
    </tbody></table></div><p className="vxs-card-foot">CPA uses full ad spend (not the 50% share), since that is what was actually spent to acquire. ROAS compares delivered COD to total ad spend.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Forecast</p><h3>Full 2,000-pc stock run (rough)</h3></div><Badge tone="info">Planning only</Badge></div><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Assumption / result</th><th style={{ textAlign: "right" }}>Value</th></tr></thead><tbody>
      {amount("Margin per delivered piece", php(fc.marginPc))}
      {amount("Delivery success (by pieces)", fc.pcsSuccess.toFixed(0) + "%")}
      {amount("Projected delivered pcs (of 2,000)", number(fc.projDelivered))}
      {amount("Projected profit (full run)", php(fc.profit), true)}
      {amount("   Kevin 60%", php(fc.kevin))}
      {amount("   Vision 40%", php(fc.vision))}
    </tbody></table></div><p className="vxs-card-foot">Rough projection only: assumes the full 2,000-pc stock sells at the current ₱{fc.marginPc.toFixed(2)} margin per delivered piece and {fc.pcsSuccess.toFixed(0)}% piece-level delivery, less fixed packaging and printer. Not a commitment.</p></section>
    <section className="vxs-report-insight"><h3>Why these numbers are frozen</h3><p>This cut-off is closed. Settlement figures match the remittance sheet and performance is frozen from the POS, so nothing drifts with live ad or courier data. Cycle 2 (Oct 16 to Oct 31) stays live until it closes.</p></section>
  </div>;
}

function SettlementSOAView({ live, loading, refresh, onBack }: { live: LiveData | null; loading: boolean; refresh: () => void; onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]); const [statement, setStatement] = useState<any>({ status: "draft" }); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const pancake = live?.pancake; const performance = pancake?.data?.performance || {}; const cycleKey = String(performance.start || "");
  const reload = useCallback(async () => { if (!cycleKey) return; const response = await fetch(`/api/vision-x-saha/settlements?cycle=${encodeURIComponent(cycleKey)}`, { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Statement evidence could not be loaded."); setRecords(Array.isArray(body.records) ? body.records : []); setStatement(body.status || { status: "draft" }); }, [cycleKey]);
  useEffect(() => { void reload().catch(error => setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Statement evidence could not be loaded." })); }, [reload]);
  if (!pancake?.connected) return <><SectionHeader eyebrow="Remittance" title="Statement of Account" copy="Loading the courier-pushed settlement base." /><LoadingState loading={loading} error={pancake?.error} refresh={refresh} /></>;
  const pushed = Number(performance.courierPushedOrders || 0); const delivered = Number(performance.delivered || 0); const failed = Number(performance.failedOrders ?? performance.returned ?? 0); const returning = Number(performance.returningOrders || 0); const returned = Number(performance.returnedOrders || 0); const moving = Number(performance.inTransitOrders ?? Math.max(0, pushed - delivered - failed)); const pushedCod = Number(performance.courierPushedCodValue || 0); const deliveredCod = Number(performance.deliveredValue || 0); const successRate = pushed ? delivered / pushed * 100 : 0; const failureRate = pushed ? failed / pushed * 100 : 0;
  const capitalEntries = Array.isArray(live?.sheet?.data?.capital?.recentEntries) ? live.sheet.data.capital.recentEntries : []; const declaredStock = capitalEntries.find((entry: any) => /(lakatan|inventory|stock)/i.test([entry?.description, entry?.quantity, entry?.notes].filter(Boolean).join(" "))) || {}; const declaredStockText = [declaredStock?.description, declaredStock?.quantity, declaredStock?.notes].filter(Boolean).join(" "); const declaredPieces = Number((declaredStockText.match(/([\d,]+)\s*pcs/i)?.[1] || "").replaceAll(",", "")); const declaredUnitCost = Number((declaredStockText.match(/@\s*(?:PHP|₱)?\s*([\d,.]+)/i)?.[1] || "").replaceAll(",", "")); const openingStock = Number(live?.sheet?.data?.inventory?.summary?.openingStock || live?.sheet?.data?.inventory?.item?.openingStock || declaredPieces || 2000); const inventoryCapital = Number(live?.sheet?.data?.capital?.byContributor?.Kevin?.categories?.Inventory || declaredCapitalAmount(declaredStock) || 0); const cogsPerPiece = openingStock && inventoryCapital ? inventoryCapital / openingStock : declaredUnitCost || 40; const deliveredPieces = Number(performance.deliveredPieces || 0); const cogsRestockReserve = deliveredPieces * cogsPerPiece;
  const remittance = records.filter(row => row.kind === "remittance").reduce((sum, row) => sum + Number(row.amount || 0), 0); const manualCourierFees = records.filter(row => row.kind === "expense" && /(courier|shipping|j&t|jnt|spx)/i.test(String(row.category || ""))).reduce((sum, row) => sum + Number(row.amount || 0), 0); const posCourierFee = Number(performance.courierPushedFee || 0); const isInitialCutoff = cycleKey === "2026-09-26"; const sumCapitalCategory = (cat: string) => Object.values(live?.sheet?.data?.capital?.byContributor || {}).reduce((sum: number, c: any) => sum + Number(c?.categories?.[cat] || 0), 0); const reconciledCourierFee = isInitialCutoff ? 17044.96 : null; const courierFees = (reconciledCourierFee ?? posCourierFee) + manualCourierFees; const otherExpenses = records.filter(row => row.kind === "expense" && !/(courier|shipping|j&t|jnt|spx)/i.test(String(row.category || ""))).reduce((sum, row) => sum + Number(row.amount || 0), 0); const additionalAdSpend = records.filter(row => row.kind === "ad_spend").reduce((sum, row) => sum + Number(row.amount || 0), 0); const capitalRecovery = records.filter(row => row.kind === "capital_repayment").reduce((sum, row) => sum + Number(row.amount || 0), 0); const adjustments = records.filter(row => row.kind === "adjustment").reduce((sum, row) => sum + Number(row.amount || 0), 0); const packagingWholeValue = sumCapitalCategory("Packaging"); const equipmentCost = sumCapitalCategory("Equipment"); const packaging = isInitialCutoff ? packagingWholeValue : pushed * 15; const equipment = isInitialCutoff ? equipmentCost : 0; const connectedMetaSpend = live?.meta.connected ? Number(live.meta.data?.totals?.spend || 0) : null; const totalVerifiedAdSpend = connectedMetaSpend === null ? additionalAdSpend : connectedMetaSpend + additionalAdSpend; const hasAdBasis = connectedMetaSpend !== null || additionalAdSpend > 0; const adShareRate = cycleKey === "2026-09-26" ? 1 : .5; const projectAdShare = hasAdBasis ? totalVerifiedAdSpend * adShareRate : null; const metaSpend = totalVerifiedAdSpend; const adShareLabel = adShareRate === 1 ? "100% of verified spend for this cut-off" : "50% of verified spend"; const netBeforeCapital = remittance - courierFees - packaging - equipment - cogsRestockReserve - (projectAdShare || 0) - otherExpenses + adjustments; const finalRemaining = netBeforeCapital - capitalRecovery; const projectedBeforeCapital = projectAdShare === null ? null : deliveredCod - courierFees - packaging - equipment - cogsRestockReserve - projectAdShare - otherExpenses + adjustments; const projectedRemaining = projectedBeforeCapital === null ? null : projectedBeforeCapital - capitalRecovery; const settlementReady = remittance > 0 && projectAdShare !== null; const status = String(statement.status || "draft"); const courierOrders = Array.isArray(performance.courierOrderRecords) ? performance.courierOrderRecords : []; const inTransit = Math.max(0, moving); const otherActive = Math.max(0, pushed - delivered - failed - inTransit); const transitRate = pushed ? inTransit / pushed * 100 : 0; const otherActiveRate = pushed ? otherActive / pushed * 100 : 0; const expectedNetWithdrawal = Math.max(0, deliveredCod - courierFees); const outstandingReceivable = remittance > 0 ? Math.max(0, expectedNetWithdrawal - remittance) : 0; const projected = (value: React.ReactNode) => <span className="vxs-projection-value">{value}<small>Projected baseline</small></span>;
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const fields = new FormData(event.currentTarget); setSaving(true); setNotice(null); try { const response = await fetch("/api/vision-x-saha/settlements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cycleKey, kind: fields.get("kind"), date: fields.get("date"), category: fields.get("category"), amount: fields.get("amount"), paidBy: fields.get("paidBy"), reference: fields.get("reference"), evidenceUrl: fields.get("evidenceUrl"), note: fields.get("note") }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "The SOA entry could not be saved."); event.currentTarget.reset(); await reload(); setNotice({ tone: "good", text: "SOA entry saved." }); } catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The SOA entry could not be saved." }); } finally { setSaving(false); } }
  return <div className="vxs-report9"><SectionHeader eyebrow="Remittance statement of account" title="Courier Remittance SOA" copy={`${performance.start || "Not calculated"} to ${performance.cutoffDate || performance.end || "Not calculated"}. Unpushed and cancelled orders are excluded.`} action={<div className="vxs-header-actions"><button className="vxs-secondary" onClick={onBack}>All report periods</button><button className="vxs-secondary" onClick={() => { refresh(); void reload(); }} disabled={loading || saving}>Refresh</button></div>} />
    {notice ? <div className="vxs-demo-note"><strong>{notice.tone === "good" ? "Saved" : "Attention"}</strong><span>{notice.text}</span></div> : null}
    {!additionalAdSpend ? <form className="vxs-ad-spend-preset" onSubmit={save}><div><p>Additional ad account evidence</p><strong>₱9,237.98 from Ad Manager</strong><span>Screenshot supplied for Oct 1–15, 2026. This is retained as a partial-period verified spend until its official export is attached.</span></div><input type="hidden" name="kind" value="ad_spend" /><input type="hidden" name="date" value="2026-10-15" /><input type="hidden" name="category" value="Additional Meta Ads - Oct 1 to Oct 15" /><input type="hidden" name="amount" value="9237.98" /><input type="hidden" name="paidBy" value="Additional ad account" /><input type="hidden" name="reference" value="Ad Manager screenshot" /><input type="hidden" name="evidenceUrl" value="" /><input type="hidden" name="note" value="User-provided Ad Manager screenshot. Selected date range: Oct 1 to Oct 15, 2026. Confirm against official export before final settlement." /><button className="vxs-secondary" disabled={saving}>{saving ? "Recording" : "Record verified ad spend"}</button></form> : null}
    {!settlementReady ? <section className="vxs-projection-panel"><div><p>Planning view only</p><h3>Projected cash baseline</h3><span>Delivered COD less courier fees, restock COGS, packaging, verified ads, approved expenses, and any separately approved capital reimbursement.</span></div><div className="vxs-projection-panel-values"><strong>{projectedRemaining === null ? "Awaiting ad basis" : php(projectedRemaining)}</strong><small>Estimated balance for the 60 / 40 split</small><div><span>Kevin 60%: {projectedRemaining === null ? "-" : php(Math.max(0, projectedRemaining) * .6)}</span><span>Vision 40%: {projectedRemaining === null ? "-" : php(Math.max(0, projectedRemaining) * .4)}</span></div></div></section> : null}
    <section className="vxs-report-insight"><h3>Executive summary</h3><p>{settlementReady ? `Actual courier remittance of ${php(remittance)} is recorded for this cut-off. After courier fees, ${php(cogsRestockReserve)} reserved to replenish ${number(deliveredPieces)} delivered pieces, packaging, verified ads, approved expenses, and any capital reimbursement, the remaining amount for the agreed 60 / 40 allocation is ${php(finalRemaining)}.` : `${number(pushed)} parcels were pushed to the courier in this cut-off. The live POS shows ${number(delivered)} delivered (${percent(successRate)}) and ${php(deliveredCod)} in delivered COD. ${php(cogsRestockReserve)} is reserved first to replenish the ${number(deliveredPieces)} delivered pieces. The gray figures below are a planning baseline only; they become official only when the courier remittance is recorded.`}</p></section>
    <section className="vxs-report-summary"><article className="cod"><span>Courier-pushed COD</span><strong>{php(pushedCod)}</strong><small>{number(pushed)} parcels in this settlement cohort</small></article><article className="cash"><span>Delivered COD projection</span><strong>{php(deliveredCod)}</strong><small>{number(delivered)} delivered / {percent(successRate)} delivery success</small></article><article className="cost"><span>Actual courier remittance</span><strong>{remittance ? php(remittance) : "Not recorded"}</strong><small>{remittance ? "Evidence has been logged below" : "Awaiting official courier / bank payout"}</small></article><article className={settlementReady && finalRemaining >= 0 ? "profit" : "projection"}><span>{settlementReady ? "Final profit pool" : "Projected profit pool"}</span><strong className={settlementReady ? undefined : "vxs-projected-amount"}>{settlementReady ? php(finalRemaining) : projectedRemaining === null ? "Awaiting ad basis" : php(projectedRemaining)}</strong><small>{settlementReady ? "Released only from actual collected cash" : "Indicative only — not payable until remittance"}</small></article></section>
    <section className="vxs-report-charts"><article className="vxs-card"><div className="vxs-card-head"><div><p>Order performance</p><h3>Courier outcome mix</h3></div><Badge tone={failureRate > 20 ? "bad" : failureRate > 10 ? "warn" : "good"}>{percent(failureRate)} failed</Badge></div><div className="vxs-outcome-layout"><div className="vxs-outcome-donut" style={{ background: `conic-gradient(#2d6a4f 0 ${successRate}%, #b42318 ${successRate}% ${successRate + failureRate}%, #d4a017 ${successRate + failureRate}% ${successRate + failureRate + transitRate}%, #8c9a93 ${successRate + failureRate + transitRate}% 100%)` }}><div><strong>{number(pushed)}</strong><span>Pushed</span></div></div><div className="vxs-outcome-legend"><p><i className="delivered" /><span>Delivered</span><strong>{number(delivered)} · {percent(successRate)}</strong></p><p><i className="failed" /><span>Returning or returned</span><strong>{number(failed)} · {percent(failureRate)}</strong></p><p><i className="progress" /><span>In transit</span><strong>{number(inTransit)} · {percent(transitRate)}</strong></p>{otherActive ? <p><i style={{ background: "#8c9a93" }} /><span>Other active courier stage</span><strong>{number(otherActive)} · {percent(otherActiveRate)}</strong></p> : null}</div></div><p className="vxs-card-foot">Outcome is based on the latest courier status for every parcel pushed during this cut-off. Returning and returned are combined as failed for the success-rate calculation.</p></article><article className="vxs-card"><div className="vxs-card-head"><div><p>Projection versus settlement</p><h3>Financial summary</h3></div><Badge tone={settlementReady ? "good" : "warn"}>{settlementReady ? "Actual cash basis" : "Projected baseline"}</Badge></div><Metrics rows={[["Delivered COD projection", projected(php(deliveredCod))], ["Courier fee (reconciled)", reconciledCourierFee !== null ? projected(php(courierFees)) : posCourierFee ? projected(php(posCourierFee)) : "Blank - enter manually"], ["Packaging (whole value)", projected(php(packaging))], ["Waybill printer", equipment ? projected(php(equipment)) : "None this cut-off"], ["Verified ad spend", hasAdBasis ? projected(`${php(totalVerifiedAdSpend)} total / ${php(additionalAdSpend)} additional`) : "Awaiting ad basis"], ["Project Meta ad deduction", projectAdShare === null ? "Awaiting valid period data" : projected(`${php(projectAdShare)} (${adShareLabel})`)], ["Projected remainder", projectedRemaining === null ? "Awaiting ad basis" : projected(php(projectedRemaining))], ["Official final remainder", settlementReady ? php(finalRemaining) : "Awaiting actual remittance"]]} /><p className="vxs-card-foot">Gray figures are an estimate from delivered COD and verified costs. The official statement uses actual courier remittance only; it never treats projected COD as cash received.</p></article></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Section A</p><h3>Courier delivery statement</h3></div><Badge tone="info">Pushed parcels only</Badge></div><Metrics rows={[["Total pushed to courier", `${number(pushed)} parcels / ${php(pushedCod)} COD`], ["Delivered", `${number(delivered)} parcels / ${php(deliveredCod)} / ${percent(successRate)} success`], ["Returning", `${number(returning)} parcels / ${php(performance.returningValue || 0)}`], ["Returned", `${number(returned)} parcels / ${php(performance.returnedValue || 0)}`], ["Total failed", `${number(failed)} parcels / ${percent(failureRate)} failure`], ["Still with courier", `${number(moving)} parcels / ${php(performance.inTransitValue || 0)}`]]} /><p className="vxs-card-foot">This statement excludes orders that were not pushed to a courier and all cancelled orders. Courier-pushed COD is a tracking value; it is not yet collected cash.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Section B</p><h3>Cash collection and deductions</h3></div><Badge tone={settlementReady ? "good" : "warn"}>{settlementReady ? "Reconciliable" : "Evidence pending"}</Badge></div><Metrics rows={[["Actual courier remittance received", remittance ? php(remittance) : "Not recorded"], ["Less: courier shipping fee", reconciledCourierFee !== null ? `${php(courierFees)} reconciled (courier dashboard; forward + return shipping)` : posCourierFee ? `${php(posCourierFee)} POS partner fee${manualCourierFees ? ` + ${php(manualCourierFees)} manual` : ""}` : "Blank - enter manually"], ["Less: COGS restock reserve", `${number(deliveredPieces)} delivered pcs x ${php(cogsPerPiece)} = ${php(cogsRestockReserve)}`], ["Less: packaging (whole value)", isInitialCutoff ? php(packaging) : `${number(pushed)} pushed parcels x PHP 15 = ${php(packaging)}`], ["Less: waybill printer", equipment ? php(equipment) : "None this cut-off"], ["Less: Meta ads", projectAdShare === null ? "Awaiting valid Meta period data" : `${php(projectAdShare)} (${adShareLabel} of ${php(metaSpend)})`], ["Less: approved operating expenses", otherExpenses ? php(otherExpenses) : "No additional expenses recorded"], ["Plus / minus approved adjustments", php(adjustments)], ["Remaining before capital reimbursement", settlementReady ? php(netBeforeCapital) : "Locked until remittance and ad data exist"], ["Less: approved capital reimbursement", capitalRecovery ? php(capitalRecovery) : "None recorded"], ["Final remaining for profit sharing", settlementReady ? php(finalRemaining) : "Locked"]]} /><p className="vxs-card-foot">COGS is reserved first for stock replenishment. Equipment, opening capital, and unapproved costs are not silently deducted from the profit pool.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Section C</p><h3>Partner allocation</h3></div><Badge tone={settlementReady && finalRemaining >= 0 ? "good" : "muted"}>{settlementReady ? "For approval" : "Awaiting settlement"}</Badge></div><Metrics rows={[["Final remaining balance", settlementReady ? php(finalRemaining) : "Locked"], ["Kevin share - 60%", settlementReady ? php(Math.max(0, finalRemaining) * .6) : "Locked"], ["Vision share - 40%", settlementReady ? php(Math.max(0, finalRemaining) * .4) : "Locked"], ["Statement status", label(status)]]} /><p className="vxs-card-foot">The 60 / 40 split is shown only after the actual courier remittance and the period advertising amount are documented.</p></section>
    {outstandingReceivable > 0 ? <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Pay-now and carryover</p><h3>Collected now vs still to collect</h3></div><Badge tone="warn">Partial settlement</Badge></div><Metrics rows={[["Expected net courier withdrawal", php(expectedNetWithdrawal)], ["Collected and paid now", php(remittance)], ["Paid now — Kevin 60%", php(Math.max(0, finalRemaining) * .6)], ["Paid now — Vision 40%", php(Math.max(0, finalRemaining) * .4)], ["Still to collect — rolls to next cut-off", php(outstandingReceivable)], ["Later — Kevin 60%", php(outstandingReceivable * .6)], ["Later — Vision 40%", php(outstandingReceivable * .4)]]} /><p className="vxs-card-foot">The courier has not released the full amount yet. The collected portion is split now; the outstanding balance is 100% distributable when it lands (costs already covered) and is carried into the next cut-off so it is not missed.</p></section> : null}
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Order performance</p><h3>Courier-pushed order register</h3></div><Badge tone="info">{number(courierOrders.length)} tracked orders</Badge></div><p className="vxs-card-foot">Every row below is included in the courier-push base. The courier fee is from Pancake partner fee; blank means Pancake did not provide a fee for that tracking number.</p><div className="vxs-soa-table-wrap"><table className="vxs-soa-table"><thead><tr><th>Order</th><th>Tracking</th><th>Pushed</th><th>Customer</th><th>COD</th><th>Courier fee</th><th>Latest result</th></tr></thead><tbody>{courierOrders.map((order: any) => <tr key={order.id}><td>#{order.id}</td><td>{order.tracking || "-"}</td><td>{dateTime(order.pushedAt)}</td><td>{order.customer}</td><td>{php(order.value)}</td><td>{order.courierFee ? php(order.courierFee) : ""}</td><td><Badge tone={order.stage === "delivered" ? "good" : ["returned", "returning", "failed_delivery"].includes(order.stage) ? "bad" : "warn"}>{label(order.stage)}</Badge></td></tr>)}</tbody></table></div></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Methodology and source notes</p><h3>How this remittance report is calculated</h3></div><Badge tone="info">Transparent basis</Badge></div><div className="vxs-reconciliation-list"><div><strong>Settlement population</strong><span>Only tracked orders whose Pancake courier-push date falls within this report range. Unpushed and cancelled orders are excluded.</span></div><div><strong>Delivery performance</strong><span>Latest Pancake courier status is used. Returning plus returned is treated as failed; parcels still moving remain operationally open.</span></div><div><strong>COGS restock reserve</strong><span>Delivered Lakatan pieces × verified opening-stock unit cost. This money is reserved to purchase replacement stock before profit is split.</span></div><div><strong>Operating expenses</strong><span>The courier charge is the reconciled courier-dashboard fee for this cut-off (forward shipping on all pushed parcels plus return shipping on failed orders). Packaging is billed at whole value from the Capital tab, not per parcel, and the waybill printer is expensed in the period it is paid.</span></div><div><strong>Cash and partner split</strong><span>Delivered COD is a forecast. The 60 / 40 sharing calculation unlocks only after actual courier remittance and documented period ad spend are present.</span></div></div><p className="vxs-card-foot">Any capital reimbursement remains a separately recorded, evidence-backed line. It does not replace the automatic COGS reserve for restocking sold inventory.</p></section>
    <div className="vxs-two-col"><section className="vxs-card"><div className="vxs-card-head"><div><p>Add evidence</p><h3>Record an SOA line item</h3></div></div><form className="vxs-form-grid" onSubmit={save}><label>Entry type<select name="kind" defaultValue="remittance"><option value="remittance">Courier remittance received</option><option value="expense">Courier fee or operating expense</option><option value="capital_repayment">Approved capital reimbursement</option><option value="adjustment">Approved adjustment</option></select></label><label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Category<input name="category" required maxLength={80} placeholder="J&T fee, waybill, packaging, supplies" /></label><label>Amount (PHP)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Received / paid by<input name="paidBy" maxLength={80} placeholder="Courier, Kevin, Rustan" /></label><label>Reference<input name="reference" maxLength={120} placeholder="Payout or bank reference" /></label><label className="vxs-wide">Evidence link<input name="evidenceUrl" type="url" maxLength={500} placeholder="Receipt or payout screenshot link" /></label><label className="vxs-wide">Note<textarea name="note" maxLength={1000} placeholder="What this amount covers. COGS restock is automatic and does not need a manual line." /></label><div className="vxs-form-actions"><button className="vxs-primary" disabled={saving}>{saving ? "Saving" : "Add SOA entry"}</button></div></form></section><section className="vxs-card"><div className="vxs-card-head"><div><p>Supporting evidence</p><h3>SOA line-item register</h3></div><Badge tone="info">{number(records.length)} entries</Badge></div><div className="vxs-simple-list">{records.length ? records.map(row => <div className="vxs-live-row" key={row.id}><div><strong>{row.kind === "remittance" ? "Courier remittance" : row.kind === "capital_repayment" ? "Approved capital reimbursement" : row.kind === "adjustment" ? "Adjustment" : row.category}</strong><span>{row.date} / {row.paidBy || "Not specified"}{row.reference ? ` / ${row.reference}` : ""}{row.evidenceUrl ? " / evidence linked" : " / evidence pending"}</span>{row.note ? <small>{row.note}</small> : null}</div><strong>{php(row.amount)}</strong></div>) : <p className="vxs-empty">No actual money or expense evidence has been recorded for this cut-off.</p>}</div></section></div>
  </div>;
}

function SettlementBillingView({ live, loading, refresh, period, onPeriodChange, onBack }: { live: LiveData | null; loading: boolean; refresh: () => void; period: ReportingPeriod; onPeriodChange: (period: ReportingPeriod) => void; onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]); const [statement, setStatement] = useState<any>({ status: "draft" }); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const pancake = live?.pancake; const sheet = live?.sheet; const performance = pancake?.data?.performance || {}; const cycleKey = String(performance.start || "");
  const reloadStatement = useCallback(async () => { if (!cycleKey) return; const response = await fetch(`/api/vision-x-saha/settlements?cycle=${encodeURIComponent(cycleKey)}`, { cache: "no-store" }); if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; } const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "The statement records could not be loaded."); setRecords(Array.isArray(body.records) ? body.records : []); setStatement(body.status || { status: "draft" }); }, [cycleKey]);
  useEffect(() => { reloadStatement().catch(error => setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The statement records could not be loaded." })); }, [reloadStatement]);
  if (!pancake?.connected || !sheet?.connected) return <><SectionHeader eyebrow="Partnership finance" title="15-Day Remittance Statement" copy="Reconciles courier money, operating costs, and the final profit share." /><LoadingState loading={loading} error={pancake?.error || sheet?.error} refresh={refresh} /></>;
  const capital = sheet.data.capital || {}; const inventory = sheet.data.inventory || {}; const inventorySummary = inventory.summary || {}; const openingStock = Number(inventorySummary.openingStock || inventory.item?.openingStock || 0); const inventoryCapital = Number(capital.byContributor?.Kevin?.categories?.Inventory || 0); const unitCost = openingStock ? inventoryCapital / openingStock : 0;
  const projectedDeliveredCOD = Number(performance.deliveredValue || 0); const courierPipelineCOD = Number(performance.courierPushedCodValue || 0); const deliveredPieces = Number(performance.deliveredPieces || 0); const capitalRecovery = deliveredPieces * unitCost; const packingCost = Number(performance.courierPushedOrders || 0) * 15; const metaSpend = live?.meta.connected ? Number(live.meta.data?.totals?.spend || 0) : null; const supplierAdReimbursement = metaSpend === null ? null : metaSpend * .5;
  const remittance = records.filter(row => row.kind === "remittance").reduce((sum, row) => sum + Number(row.amount || 0), 0); const manualExpenses = records.filter(row => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount || 0), 0); const adjustments = records.filter(row => row.kind === "adjustment").reduce((sum, row) => sum + Number(row.amount || 0), 0); const operationsDue = packingCost + manualExpenses; const projectedNet = projectedDeliveredCOD - capitalRecovery - (supplierAdReimbursement ?? 0) - operationsDue + adjustments; const actualNet = remittance - capitalRecovery - (supplierAdReimbursement ?? 0) - operationsDue + adjustments; const difference = projectedDeliveredCOD - remittance; const status = String(statement.status || "draft"); const cutoffDate = performance.cutoffDate || "Not calculated"; const nextBillingDate = performance.nextBillingDate || "Not calculated"; const projectedProfitPool = Math.max(0, projectedNet); const actualProfitPool = Math.max(0, actualNet); const readyForSplit = metaSpend !== null && remittance > 0;
  // Compatibility values used by the older detail card below. The visible summary
  // above separates the projection from collected cash and is the settlement source.
  const expectedRemittance = projectedDeliveredCOD; const distributable = actualNet; const profitPool = actualProfitPool;
  const pushedOrders = Number(performance.courierPushedOrders || 0); const deliveredOrders = Number(performance.delivered || 0); const failedOrders = Number(performance.failedOrders ?? performance.returned ?? 0); const inProgressOrders = Math.max(0, pushedOrders - deliveredOrders - failedOrders); const deliveryRate = pushedOrders ? deliveredOrders / pushedOrders * 100 : 0; const failureRate = pushedOrders ? failedOrders / pushedOrders * 100 : 0; const inProgressRate = Math.max(0, 100 - deliveryRate - failureRate); const dailyTrend = Array.isArray(performance.dailyTrend) ? performance.dailyTrend : []; const maxDailyOrders = Math.max(1, ...dailyTrend.map((row: any) => Number(row.orders || 0)));
  async function submitRecord(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); setSaving(true); setNotice(null); try { const response = await fetch("/api/vision-x-saha/settlements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cycleKey, kind: fields.get("kind"), date: fields.get("date"), category: fields.get("category"), amount: fields.get("amount"), paidBy: fields.get("paidBy"), reference: fields.get("reference"), evidenceUrl: fields.get("evidenceUrl"), note: fields.get("note") }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "The settlement entry could not be saved."); form.reset(); await reloadStatement(); setNotice({ tone: "good", text: "Recorded in this 15-day statement." }); } catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The settlement entry could not be saved." }); } finally { setSaving(false); } }
  async function changeStatus(next: string) { setSaving(true); setNotice(null); try { const response = await fetch("/api/vision-x-saha/settlements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status", cycleKey, status: next }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "The statement status could not be updated."); setStatement(body.status); setNotice({ tone: "good", text: next === "closed" ? "Statement closed and locked." : "Statement status updated." }); } catch (error) { setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The statement status could not be updated." }); } finally { setSaving(false); } }
  return <div className="vxs-report9"><SectionHeader eyebrow="Agreement-based settlement" title="15-Day Remittance & Performance Report" copy={`${performance.label || "Remittance report"}: ${cycleKey || "Not calculated"} to ${cutoffDate}. Projected operational results and actual cash reconciliation are kept separate.`} action={<div className="vxs-header-actions"><button className="vxs-secondary" onClick={onBack}>All report periods</button><button className="vxs-secondary" onClick={() => { refresh(); reloadStatement().catch(() => undefined); }} disabled={loading || saving}>Refresh live figures</button><button className="vxs-primary" onClick={() => changeStatus("ready_for_approval")} disabled={saving || status === "closed"}>Ready for approval</button></div>} />
    {notice ? <div className="vxs-demo-note"><strong>{notice.tone === "good" ? "Saved" : "Attention"}</strong><span>{notice.text}</span></div> : null}
    <section className="vxs-report-insight"><h3>Cycle sanity check</h3><p>{readyForSplit ? `Actual courier cash of ${php(remittance)} is logged. After capital recovery, the agreed 50% supplier ad reimbursement, packaging, and approved costs, the final pool is ${php(actualProfitPool)}: Kevin ${php(actualProfitPool * .6)} and Vision ${php(actualProfitPool * .4)}.` : `The POS currently shows ${php(projectedDeliveredCOD)} from delivered orders and ${php(courierPipelineCOD)} across all courier-pushed orders. These are operational projections, not cash received. Add the courier remittance and keep Meta spend connected before releasing any profit share.`}</p></section>
    <section className="vxs-report-summary"><article className="cod"><span>Courier pipeline COD</span><strong>{php(courierPipelineCOD)}</strong><small>{number(performance.courierPushedOrders || 0)} orders already pushed to courier</small></article><article className="cash"><span>Projected delivered COD</span><strong>{php(projectedDeliveredCOD)}</strong><small>Latest POS outcome; not yet a remittance</small></article><article className="cost"><span>Actual courier cash logged</span><strong>{remittance ? php(remittance) : "Not recorded"}</strong><small>{remittance ? "Evidence recorded below" : "Awaiting courier / bank payout evidence"}</small></article><article className={readyForSplit && actualProfitPool > 0 ? "profit" : "loss"}><span>Official profit pool</span><strong>{readyForSplit ? php(actualProfitPool) : "Locked"}</strong><small>Unlocked only after cash and ad cost are verified</small></article></section>
    <div className="vxs-two-col" style={{ marginBottom: 16 }}>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Projected - Pancake records</p><h3>Pre-remittance performance</h3></div><Badge tone="info">Operational view</Badge></div><Metrics rows={[["All courier-pushed COD", php(courierPipelineCOD)], ["Delivered order COD", php(projectedDeliveredCOD)], ["Kevin capital recovery", `${number(deliveredPieces)} pcs / ${php(capitalRecovery)}`], ["Supplier ad reimbursement - 50%", supplierAdReimbursement === null ? "Meta unavailable" : phpPrecise(supplierAdReimbursement)], ["Packaging", `${number(performance.courierPushedOrders || 0)} parcels / ${php(packingCost)}`], ["Projected net after known costs", metaSpend === null ? "Awaiting Meta" : php(projectedNet)], ["Kevin preview - 60%", metaSpend === null ? "Awaiting Meta" : php(projectedProfitPool * .6)], ["Vision preview - 40%", metaSpend === null ? "Awaiting Meta" : php(projectedProfitPool * .4)]]} /><p className="vxs-card-foot">This is a performance projection only. POS delivery status supports planning; it is not treated as collected cash.</p></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Actual - remittance reconciliation</p><h3>Official cash and profit share</h3></div><Badge tone={readyForSplit ? "good" : "warn"}>{readyForSplit ? "Ready to approve" : "Evidence pending"}</Badge></div><Metrics rows={[["Courier cash received", remittance ? php(remittance) : "Not recorded"], ["Variance vs delivered POS", remittance ? php(difference) : "Awaiting remittance"], ["Kevin capital recovery", `${number(deliveredPieces)} pcs / ${php(capitalRecovery)}`], ["Supplier ad reimbursement - 50%", supplierAdReimbursement === null ? "Meta unavailable" : phpPrecise(supplierAdReimbursement)], ["Packaging + approved operations", php(operationsDue)], ["Final distributable profit", readyForSplit ? php(actualNet) : "Locked"], ["Kevin payout - 60%", readyForSplit ? php(actualProfitPool * .6) : "Locked"], ["Vision payout - 40%", readyForSplit ? php(actualProfitPool * .4) : "Locked"]]} /><p className="vxs-card-foot">Only this panel becomes the partner settlement. It unlocks after courier payout evidence and period ad spend are present.</p></section>
    </div>
    <section className="vxs-report-charts"><article className="vxs-card"><div className="vxs-card-head"><div><p>Delivery performance</p><h3>Courier outcome mix</h3></div><Badge tone={failureRate > 20 ? "bad" : failureRate > 10 ? "warn" : "good"}>{percent(failureRate)} failed</Badge></div><div className="vxs-outcome-layout"><div className="vxs-outcome-donut" style={{ background: `conic-gradient(#2d6a4f 0 ${deliveryRate}%, #b42318 ${deliveryRate}% ${deliveryRate + failureRate}%, #d4a017 ${deliveryRate + failureRate}% 100%)` }}><div><strong>{number(pushedOrders)}</strong><span>Pushed</span></div></div><div className="vxs-outcome-legend"><p><i className="delivered" /><span>Delivered</span><strong>{number(deliveredOrders)} · {percent(deliveryRate)}</strong></p><p><i className="failed" /><span>Failed / returning / returned</span><strong>{number(failedOrders)} · {percent(failureRate)}</strong></p><p><i className="progress" /><span>Still in courier movement</span><strong>{number(inProgressOrders)} · {percent(inProgressRate)}</strong></p></div></div><p className="vxs-card-foot">Failure rate uses all orders pushed to courier in this report period. Orders are grouped by their order date; courier outcomes reflect the latest POS courier status.</p></article><article className="vxs-card"><div className="vxs-card-head"><div><p>Daily order trend</p><h3>Orders created per day</h3></div><Badge tone="info">{number(performance.totalOrders || 0)} orders</Badge></div><div className="vxs-order-bars">{dailyTrend.length ? dailyTrend.map((row: any) => <div key={row.date} title={`${row.date}: ${row.orders} orders · ${php(row.cod)} COD`}><span style={{ height: `${Math.max(5, Number(row.orders || 0) / maxDailyOrders * 100)}%` }} /><small>{String(row.date).slice(5)}</small></div>) : <p className="vxs-empty">No period trend is available yet.</p>}</div><div className="vxs-trend-foot"><span>Each bar is an order cohort created on that date.</span><strong>{php(Number(performance.codValue || 0))} total COD ordered</strong></div></article></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Official settlement cycle</p><h3>Courier collection → operating costs → profit share</h3></div><Badge tone={status === "closed" ? "good" : status === "ready_for_approval" ? "warn" : "info"}>{label(status)}</Badge></div><div className="vxs-mini-metrics"><div><span>Cycle closing date</span><strong>{cutoffDate}</strong></div><div><span>Next billing review</span><strong>{nextBillingDate}</strong></div><div><span>Statement records</span><strong>{number(records.length)}</strong></div><div><span>Close-out rule</span><strong>Both partners verify first</strong></div></div><p className="vxs-card-foot">Only actual courier remittances logged below become cash available for settlement. Expected COD is a reconciliation target, never received money.</p></section>
    <section className="vxs-card" style={{ marginBottom: 16 }}><div className="vxs-card-head"><div><p>Agreement settlement waterfall</p><h3>Capital recovery, costs, then profit share</h3></div><Badge tone={remittance ? "good" : "warn"}>{remittance ? "Payout logged" : "Expected remittance"}</Badge></div><Metrics rows={[["Expected courier COD", php(expectedRemittance)], ["Actual remittance received", remittance ? php(remittance) : "Not recorded — using POS estimate"], ["Kevin inventory capital recovery", `${number(deliveredPieces)} pcs · ${php(capitalRecovery)}`], ["Supplier ad reimbursement · 50%", supplierAdReimbursement === null ? "Meta unavailable" : phpPrecise(supplierAdReimbursement)], ["Packaging", `${number(performance.courierPushedOrders || 0)} parcels · ${php(packingCost)}`], ["Other approved costs", php(manualExpenses)], ["Net distributable profit", readyForSplit ? php(distributable) : "Awaiting Meta"], ["Kevin profit share · 60%", readyForSplit ? php(profitPool * .6) : "Awaiting Meta"], ["Vision profit share · 40%", readyForSplit ? php(profitPool * .4) : "Awaiting Meta"]]} /><p className="vxs-card-foot">Agreement method: POS remittance − Kevin inventory-capital recovery − 50% supplier ad reimbursement − packaging and approved operating costs = profit pool. The pool is then split 60% Kevin / 40% Vision. Remaining capital is not automatically recovered without joint approval.</p></section>
    <div className="vxs-two-col"><section className="vxs-card"><div className="vxs-card-head"><div><p>Add actual evidence</p><h3>Record a remittance or operating cost</h3></div></div>{status === "closed" ? <p className="vxs-empty">This statement is locked. Put corrections in the following cycle as an adjustment.</p> : <form className="vxs-form-grid" onSubmit={submitRecord}><label>Entry type<select name="kind" defaultValue="remittance"><option value="remittance">Courier remittance received</option><option value="expense">Operating expense paid</option><option value="adjustment">Approved adjustment (+)</option></select></label><label>Date received / paid<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Category<input name="category" required maxLength={80} placeholder="J&T remittance / courier fee / packaging" /></label><label>Amount (PHP)<input name="amount" required type="number" min="0.01" step="0.01" /></label><label>Received by / paid by<input name="paidBy" maxLength={80} placeholder="Kevin, Rustan, J&T" /></label><label>Reference / payout ID<input name="reference" maxLength={120} placeholder="Bank ref, J&T payout reference" /></label><label className="vxs-wide">Evidence link (optional)<input name="evidenceUrl" type="url" maxLength={500} placeholder="Google Drive receipt or screenshot link" /></label><label className="vxs-wide">Notes<textarea name="note" maxLength={1000} placeholder="What this payment covers and any variance." /></label><div className="vxs-form-actions"><button className="vxs-primary" disabled={saving}>{saving ? "Saving" : "Add to statement"}</button></div></form>}</section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Statement register</p><h3>Evidence logged for this cycle</h3></div><Badge tone="info">{number(records.length)} entries</Badge></div><div className="vxs-simple-list">{records.length ? records.map(row => <div className="vxs-live-row" key={row.id}><div><strong>{row.kind === "remittance" ? "Courier remittance" : row.kind === "expense" ? row.category : "Adjustment"}</strong><span>{row.date} · {row.paidBy || "No payee recorded"}{row.reference ? ` · ${row.reference}` : ""}{row.evidenceUrl ? " · Evidence attached" : " · Evidence pending"}</span>{row.note ? <small>{row.note}</small> : null}</div><strong>{php(row.amount)}</strong></div>) : <p className="vxs-empty">No money logged. Add the actual courier payout once received; do not use expected COD as cash.</p>}</div>{status !== "closed" ? <div className="vxs-form-actions"><button className="vxs-secondary" onClick={() => changeStatus("awaiting_remittance")} disabled={saving}>Await remittance</button><button className="vxs-secondary" onClick={() => changeStatus("reconciling")} disabled={saving}>Reconcile costs</button><button className="vxs-primary" onClick={() => changeStatus("closed")} disabled={saving || !remittance || metaSpend === null}>Close & lock statement</button></div> : <p className="vxs-card-foot">Closed {dateTime(statement.closedAt)}. This settlement is locked as the official partner record.</p>}</section></div></div>;
}

function CapitalView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [contributorFilter, setContributorFilter] = useState("All");
  const submitCapital = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/capital", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contributor: fields.get("contributor"),
          category: fields.get("category"),
          description: fields.get("description"),
          quantity: fields.get("quantity"),
          amount: fields.get("amount"),
          proofLink: fields.get("proofLink"),
          notes: fields.get("notes")
        })
      });
      if (response.status === 401) {
        window.location.href = "/vision-x-saha/login";
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Capital entry could not be saved.");
      form.reset();
      setShowForm(false);
      setNotice({ tone: "good", text: `${body.entry?.reference || "Capital entry"} was recorded successfully.` });
      await refresh();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Capital entry could not be saved." });
    } finally {
      setSaving(false);
    }
  };
  const provider = live?.sheet;
  if (!provider?.connected) return <><SectionHeader eyebrow="Project finance" title="Partner Capital" copy="Kevin and Rustan contributions with supporting proof." /><LoadingState loading={loading} error={provider?.error} refresh={refresh} /></>;
  const data = provider.data.capital || {};
  const entries = (data.recentEntries || []).map((entry: any) => ({ ...entry, declaredAmount: declaredCapitalAmount(entry), inferredAmount: !Number(entry.amount || 0) && declaredCapitalAmount(entry) > 0 }));
  const filteredEntries = contributorFilter === "All" ? entries : entries.filter((entry: any) => entry.contributor === contributorFilter);
  const kevin = data.byContributor?.Kevin || {};
  const rustan = data.byContributor?.Rustan || {};
  const declaredCapitalTotal = Math.max(Number(data.total || 0), entries.reduce((sum: number, entry: any) => sum + Number(entry.declaredAmount || 0), 0));
  const declaredKevin = Math.max(Number(kevin.total || 0), entries.filter((entry: any) => entry.contributor === "Kevin").reduce((sum: number, entry: any) => sum + Number(entry.declaredAmount || 0), 0));
  const declaredRustan = Math.max(Number(rustan.total || 0), entries.filter((entry: any) => entry.contributor === "Rustan").reduce((sum: number, entry: any) => sum + Number(entry.declaredAmount || 0), 0));
  return <>
    <SectionHeader eyebrow="Project finance" title="Kevin & Rustan Capital" copy="Combined project funding with separate contributor balances, categories, and proof status." action={<div className="vxs-header-actions vxs-capital-actions"><a className="vxs-secondary" href={provider.data.spreadsheetUrl} target="_blank" rel="noreferrer">Open Capital sheet</a><button className="vxs-primary" onClick={() => { setNotice(null); setShowForm(true); }}>Add capital</button></div>} />
    {notice ? <div className="vxs-live-note"><Badge tone={notice.tone}>{notice.tone === "good" ? "Saved" : "Error"}</Badge><span>{notice.text}</span></div> : null}
    {showForm ? <div className="vxs-modal-backdrop" role="presentation" onMouseDown={() => !saving && setShowForm(false)}><form className="vxs-modal" onSubmit={submitCapital} onMouseDown={event => event.stopPropagation()}><header><div><p>Project finance</p><h2>Add capital contribution</h2></div><button type="button" aria-label="Close" onClick={() => setShowForm(false)} disabled={saving}>×</button></header><div className="vxs-modal-grid">
      <label>Contributor<select name="contributor" defaultValue="Kevin" required><option>Kevin</option><option>Rustan</option></select></label>
      <label>Category<select name="category" defaultValue="Inventory" required><option>Packaging</option><option>Inventory</option><option>Equipment</option><option>Advertising</option><option>Courier</option><option>Other</option></select></label>
      <label>Amount (PHP)<input name="amount" type="number" min="0.01" max="100000000" step="0.01" placeholder="e.g. 2500" required /></label>
      <label className="wide">Description<input name="description" maxLength={160} placeholder="What did you fund?" required /></label>
      <label className="wide">Quantity<input name="quantity" maxLength={80} placeholder="e.g. 1 unit, 500 pcs, or 1 lot" required /></label>
      <label className="wide">Proof link (optional)<input name="proofLink" type="url" maxLength={500} placeholder="Google Drive or Google Docs link" /><span>Leave blank if proof is not yet available.</span></label>
      <label className="wide">Notes (optional)<textarea name="notes" maxLength={500} placeholder="Purchase details or explanation" /></label>
      {notice?.tone === "bad" ? <div className="vxs-demo-note wide"><strong>Could not save</strong><span>{notice.text}</span></div> : null}
    </div><footer><button type="button" className="vxs-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="vxs-primary" disabled={saving}>{saving ? "Saving..." : "Record capital"}</button></footer></form></div> : null}
    <Metrics rows={[["Declared capital", php(declaredCapitalTotal)], ["Kevin", php(declaredKevin)], ["Rustan", php(declaredRustan)], ["With proof", php(data.documented)], ["Verified", php(data.verified)], ["Proof pending", number(data.missingProof)]]} />
    <section className="vxs-partner-capital"><article className="vxs-card"><div className="vxs-card-head"><div><p>Contributor</p><h3>Kevin</h3></div><strong>{php(declaredKevin)}</strong></div><div className="vxs-partner-grid"><div><span>Share of declared capital</span><strong>{declaredCapitalTotal ? `${(declaredKevin / declaredCapitalTotal * 100).toFixed(1)}%` : "0%"}</strong></div><div><span>Entries</span><strong>{number(kevin.entryCount)}</strong></div><div><span>Verified</span><strong>{php(kevin.verified)}</strong></div></div></article><article className="vxs-card"><div className="vxs-card-head"><div><p>Contributor</p><h3>Rustan</h3></div><strong>{php(declaredRustan)}</strong></div><div className="vxs-partner-grid"><div><span>Share of declared capital</span><strong>{declaredCapitalTotal ? `${(declaredRustan / declaredCapitalTotal * 100).toFixed(1)}%` : "0%"}</strong></div><div><span>Entries</span><strong>{number(rustan.entryCount)}</strong></div><div><span>Verified</span><strong>{php(rustan.verified)}</strong></div></div></article></section>
    <section className="vxs-card"><div className="vxs-card-head"><div><p>Capital register</p><h3>Recorded contributions</h3></div><div className="vxs-filters">{["All", "Kevin", "Rustan"].map(name => <button key={name} className={contributorFilter === name ? "active" : ""} onClick={() => setContributorFilter(name)}>{name}</button>)}</div></div>
      <div className="vxs-simple-list">{filteredEntries.length ? filteredEntries.map((entry: any) => <div className="vxs-live-row" key={entry.reference}><div><strong>{entry.description}</strong><span>{entry.contributor || "Unassigned"} · {entry.category} · {entry.quantity} · {entry.reference}</span><span>{entry.notes || "No notes"}</span>{entry.inferredAmount ? <small>Declared amount calculated from the listed stock or advertising contribution; add proof to verify it.</small> : null}</div><div style={{ textAlign: "right" }}><strong>{php(entry.declaredAmount)}</strong><Badge tone={String(entry.proofStatus).toLowerCase() === "not provided" ? "warn" : "good"}>{entry.proofStatus || "Proof unknown"}</Badge></div></div>) : <p className="vxs-empty">No capital entries match this contributor.</p>}</div>
    </section>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Accounting policy</p><h3>Capital is not ownership</h3></div><Badge tone="info">Separated</Badge></div><p className="vxs-empty">The percentages above describe recorded contributions only. They do not change profit sharing or ownership rules.</p></section>
  </>;
}

type SmsAutomationRule = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  customer: boolean;
  rider: boolean;
  delayMinutes: number;
  cooldownMinutes: number;
  customerTemplate: string;
  riderTemplate: string;
};

type SmsAutomationData = {
  config: {
    mode: "paused" | "dry_run" | "live";
    intensity: "standard" | "kulit" | "maximum";
    customerDailyLimit: number;
    riderDailyLimit: number;
    quietStart: string;
    quietEnd: string;
    senderIdentity: string;
    rules: SmsAutomationRule[];
    updatedAt?: string;
    updatedBy?: string;
  };
  logs: Array<{
    id: string;
    createdAt: string;
    orderId: string;
    tracking: string;
    eventLabel: string;
    recipient: "customer" | "rider";
    destinationMasked: string;
    status: string;
    reason: string;
    source?: string;
    providerSmsId?: string;
    providerStatus?: string;
    updatedAt?: string;
    lastCheckedAt?: string;
    segments?: number;
  }>;
  stats: { activeRules: number; customerRules: number; riderRules: number; dryRuns: number; skipped: number; totalAttempts: number; accepted: number; dispatched: number; failed: number; scheduled: number };
  analytics: any;
  provider: { name: string; configured: boolean; source: string; simSlot: string; expiresAt?: string | null };
  webhook: { configured: boolean; endpoint: string; setupUrl?: string };
  outboundReady: boolean;
  liveReady: boolean;
  liveBlocker: string;
};

type SmsDeliveryData = {
  checkedAt: string;
  outbound: Array<{
    providerSmsId: string;
    orderId: string;
    eventLabel: string;
    recipient: "customer" | "rider";
    destinationMasked: string;
    submittedAt: string;
    lastCheckedAt: string;
    providerStatus: "queued" | "sent" | "failed" | "unknown";
    gatewayAttention: boolean;
    queuedMinutes: number;
    meaning: string;
    lastError: string;
    history?: Array<{ at: string; providerCode: string; status: string; error: string }>;
  }>;
  inbound: Array<{
    id: string;
    providerMessageId: string;
    mobileMasked: string;
    sms: string;
    receivedAt: string;
    isCustomer: boolean;
    orderId: string;
    customerName: string;
    storedAt: string;
  }>;
  stats: { total: number; queued: number; sent: number; failed: number; attention: number; replies: number };
  inboundWebhook: { configured: boolean; setupUrl: string; method: string; contentType: string };
  note: string;
};

const smsVariables = ["customer", "order_id", "tracking", "cod", "quantity", "address", "landmark", "rider", "movement_no", "courier_status", "failure_reason"];
const riderUnavailableBeforeDelivery = new Set(["tracking_created", "pickup", "arrival", "departure", "movement"]);

function smsSegments(message: string) {
  return Math.max(1, Math.ceil(message.length / 160));
}

function SmsAutomationView({ liveOrders }: { liveOrders: any }) {
  const [data, setData] = useState<SmsAutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("out_for_delivery");
  const [preview, setPreview] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [delivery, setDelivery] = useState<SmsDeliveryData | null>(null);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [inboundCustomersOnly, setInboundCustomersOnly] = useState(true);
  const [smsTab, setSmsTab] = useState<"overview" | "monitor" | "conversations" | "templates" | "audit" | "settings">("overview");

  const loadAutomation = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/vision-x-saha/sms-automation", { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "SMS automation settings could not be loaded.");
      setData(body);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "SMS automation settings could not be loaded." });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDelivery = async (refreshProvider = false) => {
    setCheckingDelivery(true);
    try {
      const response = await fetch(`/api/vision-x-saha/sms-status?refresh=${refreshProvider ? "1" : "0"}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "InfoTXT status could not be loaded.");
      setDelivery(body);
      if (refreshProvider) setNotice({ tone: body.stats?.attention ? "warn" : "good", text: body.stats?.attention ? `${body.stats.attention} SMS message(s) still need gateway attention.` : "InfoTXT statuses refreshed." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "InfoTXT status could not be loaded." });
    } finally {
      setCheckingDelivery(false);
    }
  };

  useEffect(() => {
    void loadAutomation();
    void loadDelivery(false);
  }, []);
  useEffect(() => {
    if (!selectedOrderId && liveOrders?.recentOrders?.[0]?.id) setSelectedOrderId(String(liveOrders.recentOrders[0].id));
  }, [liveOrders, selectedOrderId]);

  const updateConfig = (key: string, value: unknown) => setData(current => current ? { ...current, config: { ...current.config, [key]: value } } : current);
  const updateRule = (id: string, key: keyof SmsAutomationRule, value: unknown) => setData(current => current ? {
    ...current,
    config: { ...current.config, rules: current.config.rules.map(rule => rule.id === id ? { ...rule, [key]: value } : rule) }
  } : current);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/sms-automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: data.config })
      });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The settings could not be saved.");
      setData(current => current ? { ...current, config: body.config } : current);
      setNotice({ tone: "good", text: body.message || "Dry-run settings saved." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The settings could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!selectedOrderId || !selectedEvent) return;
    setSimulating(true);
    setPreview(null);
    setNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/sms-automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "simulate", orderId: selectedOrderId, event: selectedEvent })
      });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The preview could not be generated.");
      setPreview(body);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "The preview could not be generated." });
    } finally {
      setSimulating(false);
    }
  };

  if (loading && !data) return <><SectionHeader eyebrow="Delivery success system" title="Mel SMS AI" copy="Customer and rider reminders tied to courier movements." /><LoadingState loading={true} refresh={loadAutomation} /></>;
  if (!data) return <><SectionHeader eyebrow="Delivery success system" title="Mel SMS AI" copy="Customer and rider reminders tied to courier movements." /><LoadingState loading={false} error={notice?.text} refresh={() => void loadAutomation(false)} /></>;
  const orders = liveOrders?.recentOrders || [];
  const analytics = data.analytics || {};
  const overview = analytics.overview || {};
  const funnelMax = Math.max(1, ...(analytics.funnel || []).map((row: any) => Number(row.value || 0)));
  const trendMax = Math.max(1, ...(analytics.trend || []).flatMap((row: any) => [Number(row.submitted || 0), Number(row.dispatched || 0), Number(row.replies || 0)]));

  return <>
    <SectionHeader eyebrow="AI employee · delivery + sales" title="Mel SMS AI" copy="Courier reminders, order confirmations, two-way customer replies, reorders, and rider coordination over SMS." action={<button className="vxs-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save sequence"}</button>} />
    <nav className="vxs-sms-tabs" aria-label="Mel SMS AI sections">{([
      ["overview", "Overview"], ["monitor", "Live monitor"], ["conversations", "Conversations"], ["templates", "Templates"], ["audit", "Private audit"], ["settings", "Settings"]
    ] as const).map(([id, text]) => <button key={id} className={smsTab === id ? "active" : ""} onClick={() => setSmsTab(id)}>{text}</button>)}</nav>
    {notice ? <div className="vxs-live-note"><Badge tone={notice.tone}>{notice.tone === "good" ? "Saved" : "Attention"}</Badge><span>{notice.text}</span></div> : null}
    {smsTab === "overview" ? <>
      <div className="vxs-sms-safety"><div><Badge tone={data.config.mode === "live" ? "good" : "muted"}>{data.config.mode === "live" ? "Live" : "Paused"}</Badge><strong>{data.config.mode === "live" ? "Live: real SMS sends automatically." : "Paused: no SMS is sent."}</strong></div><span>{data.config.mode === "live" ? "Guards active: delay, cooldown, quiet hours, daily caps, and go-live cutoff." : "Switch to Live in Settings and save to start sending."}</span></div>
      <p style={{ margin: "4px 2px 8px", fontSize: 13, opacity: 0.7 }}>What Mel is doing for the business</p>
      <Metrics rows={[["SMS sent", number(overview.dispatched)], ["Customer replies", number(overview.customerReplies)], ["Reply rate", `${number(overview.replyRate)}%`], ["Orders from SMS", number(analytics.business?.orders || 0)], ["Revenue from SMS", php(analytics.business?.revenue || 0)], ["Delivery rate with SMS", `${number(analytics.outcomes?.withSms?.deliveryRate)}%`]]} />
      <div className="vxs-sms-periods"><div><span>SMS sent, last 24h</span><strong>{number(analytics.periods?.today)}</strong></div><div><span>Last 7 days</span><strong>{number(analytics.periods?.sevenDays)}</strong></div><div><span>Last 30 days</span><strong>{number(analytics.periods?.thirtyDays)}</strong></div><div><span>Estimated cost</span><strong>{overview.estimatedCost == null ? "Set rate in server" : php(overview.estimatedCost)}</strong></div></div>
      <section className="vxs-card" style={{ marginTop: 12 }}>
        <div className="vxs-card-head"><div><p>Gateway health (diagnostics)</p><h3>Did the texts leave the gateway?</h3></div><Badge tone={overview.failed ? "warn" : "good"}>{overview.failed ? `${number(overview.failed)} send failures` : "Healthy"}</Badge></div>
        <Metrics rows={[["Sent OK", number(overview.dispatched)], ["Send failures", number(overview.failed)], ["Gateway success rate", `${number(overview.dispatchRate)}%`]]} />
        <p className="vxs-card-foot"><strong>Send failures</strong> = SMS the gateway could not push out (invalid number, no load, or SIM issue). These are NOT failed deliveries or failed orders. A spike here means check InfoTXT credits or the SIM.</p>
      </section>
      <section className="vxs-sms-analytics-grid">
        <article className="vxs-card"><div className="vxs-card-head"><div><p>Current health</p><h3>Alerts and action items</h3></div><Badge tone={(analytics.alerts || []).some((item: any) => item.tone === "bad") ? "bad" : (analytics.alerts || []).some((item: any) => item.tone === "warn") ? "warn" : "good"}>{(analytics.alerts || []).length} checks</Badge></div><div className="vxs-sms-alert-list">{(analytics.alerts || []).map((item: any, index: number) => <div className={item.tone} key={`${item.title}-${index}`}><Badge tone={item.tone}>{item.tone === "good" ? "Healthy" : "Action"}</Badge><span><strong>{item.title}</strong><small>{item.copy}</small></span></div>)}</div></article>
        <article className="vxs-card"><div className="vxs-card-head"><div><p>Sending funnel</p><h3>From rule to delivery</h3></div><small>{number(overview.dispatchRate)}% dispatch rate</small></div><div className="vxs-sms-funnel">{(analytics.funnel || []).map((row: any) => <div key={row.label}><span>{row.label}</span><i><b style={{ width: `${Math.max(3, Number(row.value || 0) / funnelMax * 100)}%` }} /></i><strong>{number(row.value)}</strong></div>)}</div></article>
      </section>
      <section className="vxs-sms-analytics-grid">
        <article className="vxs-card"><div className="vxs-card-head"><div><p>Last seven days</p><h3>SMS activity</h3></div><small>Submitted, dispatched, replies</small></div><div className="vxs-sms-trend">{(analytics.trend || []).map((row: any) => <div key={row.day}><div><i style={{ height: `${Math.max(4, Number(row.submitted || 0) / trendMax * 100)}%` }} /><i className="sent" style={{ height: `${Math.max(4, Number(row.dispatched || 0) / trendMax * 100)}%` }} /><i className="reply" style={{ height: `${Math.max(4, Number(row.replies || 0) / trendMax * 100)}%` }} /></div><span>{String(row.day || "").slice(5)}</span></div>)}</div><div className="vxs-sms-legend"><span><i />Submitted</span><span><i className="sent" />Dispatched</span><span><i className="reply" />Replies</span></div></article>
        <article className="vxs-card"><div className="vxs-card-head"><div><p>Courier outcome</p><h3>Orders with and without SMS</h3></div><Badge tone="info">Observational</Badge></div><div className="vxs-sms-outcome-grid"><div><span>With SMS</span><strong>{number(analytics.outcomes?.withSms?.deliveryRate)}%</strong><small>{number(analytics.outcomes?.withSms?.delivered)} delivered of {number(analytics.outcomes?.withSms?.orders)}</small><small>{number(analytics.outcomes?.withSms?.risk)} failed or return-risk</small></div><div><span>Without SMS</span><strong>{number(analytics.outcomes?.withoutSms?.deliveryRate)}%</strong><small>{number(analytics.outcomes?.withoutSms?.delivered)} delivered of {number(analytics.outcomes?.withoutSms?.orders)}</small><small>{number(analytics.outcomes?.withoutSms?.risk)} failed or return-risk</small></div></div><p className="vxs-card-foot">{analytics.outcomes?.note}</p></article>
      </section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Recipient performance</p><h3>Customer and rider SMS</h3></div><small>Updated {dateTime(analytics.generatedAt)}</small></div><div className="vxs-sms-recipient-grid">{(analytics.byRecipient || []).map((row: any) => <div key={row.recipient}><span>{label(row.recipient)}</span><strong>{number(row.dispatched)} dispatched</strong><small>{number(row.attempts)} attempts, {number(row.failed)} failed, {number(row.dispatchRate)}% dispatch rate</small></div>)}</div></section>
    </> : null}

    {smsTab === "monitor" ? <section className="vxs-card vxs-sms-delivery"><div className="vxs-card-head"><div><p>Official InfoTXT status</p><h3>Outbound gateway monitor</h3></div><button className="vxs-secondary" onClick={() => void loadDelivery(true)} disabled={checkingDelivery}>{checkingDelivery ? "Checking..." : "Refresh provider"}</button></div>
      {delivery ? <><div className="vxs-sms-status-metrics"><div><span>Tracked</span><strong>{number(delivery.stats.total)}</strong></div><div><span>Queued</span><strong>{number(delivery.stats.queued)}</strong></div><div><span>Dispatched by InfoTXT</span><strong>{number(delivery.stats.sent)}</strong></div><div><span>Failed</span><strong>{number(delivery.stats.failed)}</strong></div><div className={delivery.stats.attention ? "attention" : ""}><span>Gateway attention</span><strong>{number(delivery.stats.attention)}</strong></div></div>
        <p className="vxs-card-foot">{delivery.note}</p>
        {delivery.outbound.length ? <div className="vxs-sms-status-list">{delivery.outbound.slice(0, 50).map(row => <article key={row.providerSmsId} className={row.gatewayAttention ? "attention" : ""}><div><strong>InfoTXT #{row.providerSmsId}</strong><small>{row.eventLabel} · {row.destinationMasked} · {dateTime(row.submittedAt)}</small>{row.history?.length ? <details className="vxs-sms-status-history"><summary>Status history</summary>{row.history.map((item, index) => <small key={`${item.at}-${index}`}>{dateTime(item.at)} · {item.status === "sent" ? "Dispatched" : label(item.status)} · code {item.providerCode}{item.error ? ` · ${item.error}` : ""}</small>)}</details> : null}</div><div><Badge tone={row.providerStatus === "sent" ? "good" : row.providerStatus === "failed" ? "bad" : row.gatewayAttention ? "bad" : "warn"}>{row.providerStatus === "sent" ? "Dispatched" : row.providerStatus === "failed" ? "Failed" : row.providerStatus === "queued" ? "Queued" : "Unknown"}</Badge><small>{row.gatewayAttention ? `Queued ${row.queuedMinutes} minutes · check gateway/SIM` : row.meaning}</small>{row.lastCheckedAt ? <small>Checked {dateTime(row.lastCheckedAt)}</small> : null}{row.lastError ? <small>{row.lastError}</small> : null}</div></article>)}</div> : <p className="vxs-empty">No tracked outbound InfoTXT messages yet.</p>}
      </> : <p className="vxs-empty">Loading InfoTXT status records...</p>}
    </section> : null}

    {smsTab === "conversations" ? <><Metrics rows={[["Customer replies", number(analytics.conversations?.customerReplies)], ["Confirmations", number(analytics.conversations?.confirmations)], ["Cancellations", number(analytics.conversations?.cancellations)], ["Delivery requests", number(analytics.conversations?.deliveryRequests)], ["Mel AI replies", number(analytics.conversations?.aiReplies)], ["Reply rate", `${number(overview.replyRate)}%`]]} /><section className="vxs-sms-settings-grid">
      <article className="vxs-card"><div className="vxs-card-head"><div><p>Incoming SMS</p><h3>Customer replies</h3></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="vxs-text-button" onClick={() => setInboundCustomersOnly(value => !value)}>{inboundCustomersOnly ? "Show all" : "Customers only"}</button><Badge tone={delivery?.inboundWebhook.configured ? "good" : "warn"}>{delivery?.inboundWebhook.configured ? "Receiver secured" : "Secret pending"}</Badge></div></div>
        {(() => { const rows = (delivery?.inbound || []).filter(reply => inboundCustomersOnly ? reply.isCustomer : true); return rows.length ? <div className="vxs-simple-list">{rows.slice(0, 12).map(reply => <div className="vxs-sms-reply" key={reply.id}><div><strong>{reply.isCustomer && reply.customerName ? reply.customerName : reply.mobileMasked}{reply.isCustomer && reply.orderId ? ` · #${reply.orderId}` : ""}</strong><span>{reply.sms}</span><small>{dateTime(reply.receivedAt || reply.storedAt)}</small></div><Badge tone={reply.isCustomer ? "good" : "muted"}>{reply.isCustomer ? "Customer" : "Other"}</Badge></div>)}</div> : <p className="vxs-empty">{inboundCustomersOnly ? "No customer replies yet. Tap “Show all” to see every incoming SMS." : "No incoming InfoTXT messages yet."}</p>; })()}
      </article>
      <article className="vxs-card"><div className="vxs-card-head"><div><p>Conversation health</p><h3>Reply processing</h3></div><Badge tone={delivery?.inboundWebhook.configured ? "good" : "warn"}>{delivery?.inboundWebhook.configured ? "Receiver secured" : "Secret pending"}</Badge></div>
        <div className="vxs-sms-readiness"><div><span>Incoming records analyzed</span><strong>{number(analytics.recordsAnalyzed?.inbound)}</strong></div><div><span>Last incoming SMS</span><strong>{analytics.freshness?.lastInboundAt ? dateTime(analytics.freshness.lastInboundAt) : "No replies yet"}</strong></div><div><span>AI replies accepted</span><strong>{number(analytics.conversations?.aiReplies)}</strong></div></div>
        <p className="vxs-card-foot">Customer numbers stay masked in the command center. Full numbers remain server-side for matching and replies.</p>
      </article>
    </section></> : null}

    {smsTab === "settings" ? <><section className="vxs-card vxs-sms-settings-card"><div className="vxs-card-head"><div><p>InfoTXT dashboard setup</p><h3>Connect the reply webhook</h3></div><Badge tone={delivery?.inboundWebhook.configured ? "good" : "warn"}>{delivery?.inboundWebhook.configured ? "Ready to paste" : "Not configured"}</Badge></div>
      {delivery?.inboundWebhook.setupUrl ? <><label className="vxs-sms-secret-url">Protected webhook URL<input type="password" readOnly value={delivery.inboundWebhook.setupUrl} /></label><button className="vxs-secondary" onClick={() => { void navigator.clipboard.writeText(delivery.inboundWebhook.setupUrl); setNotice({ tone: "good", text: "Protected InfoTXT webhook URL copied." }); }}>Copy protected URL</button><ol className="vxs-sms-webhook-steps"><li>In InfoTXT, open More, then Keywords.</li><li>Create or edit <strong>DEFAULT_KEYWORD</strong>.</li><li>Select <strong>HTTP Call</strong> and the assigned SIM.</li><li>Paste the protected URL, add one space, then: <code>ID=#ID#&amp;Mobile=#MOBILE#&amp;SMS=#SMS#&amp;Sent=#SENT#&amp;Received=#RECEIVED#&amp;SIM=#SIM#</code></li></ol></> : <p className="vxs-empty">A server-side webhook secret must be added before InfoTXT can be connected.</p>}
    </section><section className="vxs-sms-settings-grid">
      <article className="vxs-card"><div className="vxs-card-head"><div><p>How automation flows</p><h3>Master controls</h3></div><Badge tone={data.config.mode === "live" ? "good" : "muted"}>{data.config.mode === "live" ? "Live" : "Paused"}</Badge></div>
        <div className="vxs-filters" style={{ marginBottom: 4 }}>
          <button className={data.config.mode === "live" ? "active" : ""} onClick={() => updateConfig("mode", "live")}>Live</button>
          <button className={data.config.mode !== "live" ? "active" : ""} onClick={() => updateConfig("mode", "paused")}>Pause</button>
        </div>
        <p className="vxs-card-foot" style={{ marginTop: 0 }}>{data.config.mode === "live" ? "Live. Sending real SMS automatically." : "Paused. No SMS is sent. Switch to Live and Save to start."}</p>
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <div className="vxs-demo-note"><strong>1 · Courier movement</strong><span>Pancake posts each scan (shipped, out for delivery, delivered…) to the webhook.</span></div>
          <div style={{ textAlign: "center", opacity: 0.4, lineHeight: 1 }}>↓</div>
          <div className="vxs-demo-note"><strong>2 · Rule match</strong><span>{number(data.stats.activeRules)} active triggers. Disabled rules are skipped.</span></div>
          <div style={{ textAlign: "center", opacity: 0.4, lineHeight: 1 }}>↓</div>
          <div className="vxs-demo-note"><strong>3 · Safety guards</strong><span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>Max <input type="number" min="1" max="20" value={data.config.customerDailyLimit} onChange={event => updateConfig("customerDailyLimit", Number(event.target.value))} style={{ width: 54 }} /> customer / <input type="number" min="1" max="20" value={data.config.riderDailyLimit} onChange={event => updateConfig("riderDailyLimit", Number(event.target.value))} style={{ width: 54 }} /> rider per order each day · Quiet <input type="time" value={data.config.quietStart} onChange={event => updateConfig("quietStart", event.target.value)} />–<input type="time" value={data.config.quietEnd} onChange={event => updateConfig("quietEnd", event.target.value)} /> · Only events after go-live.</span></div>
          <div style={{ textAlign: "center", opacity: 0.4, lineHeight: 1 }}>↓</div>
          <div className="vxs-demo-note"><strong>4 · Send</strong><span>{data.config.mode === "live" ? `InfoTXT sends to customer and rider via SIM slot ${data.provider.simSlot || "4"}.` : "Paused — nothing is sent."}</span></div>
          <div style={{ textAlign: "center", opacity: 0.4, lineHeight: 1 }}>↓</div>
          <div className="vxs-demo-note"><strong>5 · Audit log</strong><span>Every attempt is recorded in the gateway monitor above.</span></div>
        </div>
      </article>
      <article className="vxs-card"><div className="vxs-card-head"><div><p>Readiness</p><h3>Secure connections</h3></div><Badge tone={data.provider.configured ? "good" : "warn"}>{data.provider.configured ? "Credentials saved" : "Needs setup"}</Badge></div>
        <div className="vxs-sms-readiness"><div><span>SMS provider</span><strong>{data.provider.name}{data.provider.simSlot ? ` · Account SIM slot ${data.provider.simSlot}` : ""}</strong><Badge tone={data.provider.configured ? "good" : "warn"}>{data.provider.configured ? "Private server credentials" : "Not configured"}</Badge></div><div><span>Pancake webhook</span><strong>Orders event receiver</strong><Badge tone={data.webhook.configured ? "good" : "warn"}>{data.webhook.configured ? "Secret configured" : "Secret pending"}</Badge></div><div><span>Outbound sender</span><strong>Protected one-recipient test</strong><Badge tone={data.outboundReady ? "good" : "warn"}>{data.outboundReady ? "Available" : "Needs credentials"}</Badge></div></div>
        <p className="vxs-card-foot">Webhook endpoint: <code>{data.webhook.endpoint}</code>. Rider numbers remain server-side and audit logs store only masked destinations.</p>
        {data.webhook.setupUrl ? <button className="vxs-secondary" onClick={() => { void navigator.clipboard.writeText(data.webhook.setupUrl || ""); setNotice({ tone: "good", text: "Protected Pancake webhook URL copied." }); }}>Copy Pancake webhook URL</button> : null}
      </article>
    </section></> : null}

    {smsTab === "templates" ? <><section className="vxs-card vxs-sms-template-performance"><div className="vxs-card-head"><div><p>Template analytics</p><h3>Performance by trigger and recipient</h3></div><Badge tone="info">Live audit data</Badge></div>
      {(analytics.templates || []).length ? <div className="vxs-table"><div className="vxs-tr vxs-th vxs-sms-template-row"><span>Trigger</span><span>Recipient</span><span>Attempts</span><span>Dispatched</span><span>Rate</span><span>Segments</span></div>{analytics.templates.slice(0, 30).map((row: any) => <div className="vxs-tr vxs-sms-template-row" key={`${row.event}-${row.recipient}`}><span><strong>{row.event}</strong></span><span>{label(row.recipient)}</span><span>{number(row.attempts)}</span><span>{number(row.dispatched)}</span><span>{number(row.dispatchRate)}%</span><span>{number(row.segments)}</span></div>)}</div> : <p className="vxs-empty">Template performance appears after Mel records real or test attempts.</p>}
    </section><section className="vxs-card vxs-sms-simulator"><div className="vxs-card-head"><div><p>Safe simulator</p><h3>Preview using a real Pancake order</h3></div><Badge tone="info">Sends nothing</Badge></div>
      <div className="vxs-sms-sim-controls"><label>Order<select value={selectedOrderId} onChange={event => setSelectedOrderId(event.target.value)}><option value="">Select an order</option>{orders.map((order: any) => <option key={order.id} value={order.id}>#{order.id} · {order.customer} · {order.tracking || "No tracking"}</option>)}</select></label><label>Courier event<select value={selectedEvent} onChange={event => setSelectedEvent(event.target.value)}>{data.config.rules.map(rule => <option key={rule.id} value={rule.id}>{rule.label}</option>)}</select></label><button className="vxs-primary" onClick={simulate} disabled={simulating || !selectedOrderId}>{simulating ? "Generating..." : "Generate preview"}</button></div>
      {preview ? <div className="vxs-sms-previews">{preview.previews.map((item: any) => <article key={item.recipient}><div><strong>{label(item.recipient)} SMS</strong><Badge tone={!item.enabled ? "muted" : item.available ? "good" : "bad"}>{!item.enabled ? "Disabled" : item.available ? item.destinationMasked : "Number unavailable"}</Badge></div><p>{item.message}</p><small>{item.message.length} characters · {smsSegments(item.message)} SMS segment(s)</small></article>)}</div> : <p className="vxs-empty">Choose an order and event to verify the exact customer and rider wording before activation.</p>}
    </section>

    <section className="vxs-card vxs-sms-rules"><div className="vxs-card-head"><div><p>Editable sequence</p><h3>Courier movement rules</h3></div><Badge tone="info">{data.config.rules.length} triggers</Badge></div>
      <div className="vxs-sms-variable-chips"><span>Available variables</span>{smsVariables.map(variable => <code key={variable}>{`{${variable}}`}</code>)}</div>
      {data.config.rules.map((rule, index) => <details key={rule.id} open={index < 2}><summary><div><strong>{rule.label}</strong><span>{rule.description}</span></div><div><Badge tone={rule.enabled ? "good" : "muted"}>{rule.enabled ? "Enabled" : "Off"}</Badge><small>{rule.customer ? "Customer" : ""}{rule.customer && rule.rider ? " + " : ""}{rule.rider ? "Rider" : ""}</small></div></summary><div className="vxs-sms-rule-body">
        <div className="vxs-sms-rule-options"><label><input type="checkbox" checked={rule.enabled} onChange={event => updateRule(rule.id, "enabled", event.target.checked)} /> Enable trigger</label><label><input type="checkbox" checked={rule.customer} onChange={event => updateRule(rule.id, "customer", event.target.checked)} /> Customer SMS</label><label title={riderUnavailableBeforeDelivery.has(rule.id) ? "The courier assigns a rider and exposes the mobile number only at Out for Delivery." : "Send to the assigned rider when a number is available."}><input type="checkbox" checked={rule.rider} disabled={riderUnavailableBeforeDelivery.has(rule.id)} onChange={event => updateRule(rule.id, "rider", event.target.checked)} /> {riderUnavailableBeforeDelivery.has(rule.id) ? "Rider unavailable before OFD" : "Rider SMS"}</label><label>Delay (minutes)<input type="number" min="0" max="1440" value={rule.delayMinutes} onChange={event => updateRule(rule.id, "delayMinutes", Number(event.target.value))} /></label><label>Cooldown (minutes)<input type="number" min="0" max="1440" value={rule.cooldownMinutes} onChange={event => updateRule(rule.id, "cooldownMinutes", Number(event.target.value))} /></label></div>
        <div className="vxs-sms-template-grid"><label>Customer message<textarea maxLength={640} value={rule.customerTemplate} onChange={event => updateRule(rule.id, "customerTemplate", event.target.value)} /><span>{rule.customerTemplate.length} characters · {smsSegments(rule.customerTemplate)} segment(s)</span></label>{riderUnavailableBeforeDelivery.has(rule.id) ? <div className="vxs-demo-note"><strong>No rider message at this stage</strong><span>The courier only assigns a rider at Out for Delivery, so rider SMS stays off here.</span></div> : <label>Rider message<textarea maxLength={640} value={rule.riderTemplate} onChange={event => updateRule(rule.id, "riderTemplate", event.target.value)} /><span>{rule.riderTemplate.length} characters · {smsSegments(rule.riderTemplate)} segment(s)</span></label>}</div>
      </div></details>)}
    </section></> : null}

    {smsTab === "audit" ? <><Metrics rows={[["Total attempts", number(data.stats.totalAttempts)], ["Accepted", number(data.stats.accepted)], ["Dispatched", number(data.stats.dispatched)], ["Scheduled", number(data.stats.scheduled)], ["Skipped", number(data.stats.skipped)], ["Failed", number(data.stats.failed)]]} /><section className="vxs-card vxs-sms-logs"><div className="vxs-card-head"><div><p>Private audit</p><h3>Latest automation records</h3></div><button className="vxs-secondary" onClick={() => void loadAutomation(false)}>Refresh logs</button></div>
      {data.logs.length ? <div className="vxs-table"><div className="vxs-tr vxs-th vxs-sms-log-row"><span>Time</span><span>Order</span><span>Trigger</span><span>Recipient</span><span>Result</span></div>{data.logs.slice(0, 100).map(row => <div className="vxs-tr vxs-sms-log-row" key={row.id}><span><strong>{dateTime(row.updatedAt || row.createdAt)}</strong><small>{row.lastCheckedAt ? `Provider checked ${dateTime(row.lastCheckedAt)}` : "Audit record"}</small></span><span><strong>#{row.orderId}</strong><small>{row.tracking || "No tracking"}</small></span><span><strong>{row.eventLabel}</strong><small>{row.providerSmsId ? `InfoTXT #${row.providerSmsId}` : label(row.source || "automation")}</small></span><span><strong>{label(row.recipient)}</strong><small>{row.destinationMasked}</small></span><span><Badge tone={["dispatched", "sent"].includes(row.status) ? "good" : row.status === "failed" ? "bad" : row.status === "dry_run" ? "info" : ["skipped", "scheduled"].includes(row.status) ? "warn" : "muted"}>{row.status === "sent" ? "Dispatched" : label(row.status)}</Badge><small>{row.reason}</small></span></div>)}</div> : <p className="vxs-empty">No automation attempts have been recorded yet. The simulator does not create audit records.</p>}
    </section></> : null}
  </>;
}

type SmsConnectionStatus = {
  configured: boolean;
  trackingEnabled: boolean;
  maskedUserId?: string;
  maskedKey?: string;
  simSlot?: string;
  maskedSimMobile?: string;
  expiresAt?: string | null;
  source?: "saved" | "env" | "none";
  updatedAt?: string | null;
  updatedBy?: string | null;
};

function parseSmsInfo(text: string) {
  const values: Record<string, string> = {};
  const addValue = (key: string, value: unknown) => {
    if (typeof value !== "string" && typeof value !== "number") return;
    values[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = String(value).trim().replace(/^['"]|['"]$/g, "");
  };
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    Object.entries(parsed).forEach(([key, value]) => addValue(key, value));
  } catch {
    text.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*(?:export\s+)?["']?([^"'=:#]+?)["']?\s*[:=]\s*(.+?)\s*$/i);
      if (match) addValue(match[1], match[2]);
    });
  }
  const compact = text.trim().replace(/^['"]|['"]$/g, "");
  const userId = values.infotxtuserid || values.userid || values.useridnumber || "";
  const apiKey = values.infotxtapikey || values.infotxtsecretkey || values.apikeysecretkey || values.secretkey || values.infotxttoken || values.smsapikey || values.apikey || values.smstoken || (/^\S{20,256}$/.test(compact) ? compact : "");
  const simSlot = values.infotxtsimslot || values.simslotno || values.simslot || values.sim || "";
  const simMobile = values.infotxtsimmobile || values.simmobile || values.simmobilenumber || "";
  const expiresAt = values.infotxtexpiry || values.expiry || values.expiresat || values.expirationdate || "";
  return { userId, apiKey, simSlot, simMobile, expiresAt };
}

function IntegrationsView({ live, loading, refresh }: { live: LiveData | null; loading: boolean; refresh: () => void }) {
  const [smsStatus, setSmsStatus] = useState<SmsConnectionStatus | null>(null);
  const [showSmsSetup, setShowSmsSetup] = useState(false);
  const [showSmsTest, setShowSmsTest] = useState(false);
  const [smsUserId, setSmsUserId] = useState("");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSimSlot, setSmsSimSlot] = useState("");
  const [smsSimMobile, setSmsSimMobile] = useState("");
  const [smsExpiresAt, setSmsExpiresAt] = useState("");
  const [smsFileName, setSmsFileName] = useState("");
  const [smsChecking, setSmsChecking] = useState(false);
  const [smsNotice, setSmsNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [smsTestPhone, setSmsTestPhone] = useState("");
  const [smsTestMessage, setSmsTestMessage] = useState("The outbound SMS connection is working. No action is required.");
  const [smsTestConfirmed, setSmsTestConfirmed] = useState(false);
  const [smsTestSending, setSmsTestSending] = useState(false);
  const [smsTestNotice, setSmsTestNotice] = useState<{ tone: Tone; text: string } | null>(null);

  const loadSmsStatus = async () => {
    try {
      const response = await fetch("/api/vision-x-saha/sms-connection", { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      if (response.ok) setSmsStatus(await response.json());
    } catch {
      setSmsStatus(null);
    }
  };

  useEffect(() => { void loadSmsStatus(); }, []);

  const closeSmsSetup = () => {
    if (smsChecking) return;
    setShowSmsSetup(false);
    setSmsUserId("");
    setSmsApiKey("");
    setSmsSimSlot("");
    setSmsSimMobile("");
    setSmsExpiresAt("");
    setSmsFileName("");
    setSmsNotice(null);
  };

  const readSmsFile = async (file?: File) => {
    setSmsNotice(null);
    if (!file) return;
    if (file.size > 64 * 1024) {
      setSmsNotice({ tone: "bad", text: "The text file must be smaller than 64 KB." });
      return;
    }
    const parsed = parseSmsInfo(await file.text());
    if (!parsed.apiKey) {
      setSmsNotice({ tone: "bad", text: "No INFOTXT API key was found. You can paste it in the field below." });
      return;
    }
    setSmsUserId(parsed.userId);
    setSmsApiKey(parsed.apiKey);
    setSmsSimSlot(parsed.simSlot);
    setSmsSimMobile(parsed.simMobile);
    setSmsExpiresAt(parsed.expiresAt);
    setSmsFileName(file.name);
    setSmsNotice({ tone: "info", text: "Credentials loaded locally. The API key is hidden and has not been stored." });
  };

  const testSmsConnection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSmsChecking(true);
    setSmsNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/sms-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: smsUserId, apiKey: smsApiKey, simSlot: smsSimSlot, simMobile: smsSimMobile, expiresAt: smsExpiresAt })
      });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The SMS connection could not be verified.");
      setSmsNotice({ tone: "good", text: body.message || "INFOTXT credentials saved. No test SMS was sent." });
      setSmsUserId("");
      setSmsApiKey("");
      setSmsSimSlot("");
      setSmsSimMobile("");
      setSmsExpiresAt("");
      setSmsFileName("");
      await loadSmsStatus();
    } catch (error) {
      setSmsNotice({ tone: "bad", text: error instanceof Error ? error.message : "The credentials could not be saved." });
    } finally {
      setSmsChecking(false);
    }
  };

  const closeSmsTest = () => {
    if (smsTestSending) return;
    setShowSmsTest(false);
    setSmsTestPhone("");
    setSmsTestConfirmed(false);
    setSmsTestNotice(null);
  };

  const sendSmsTest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSmsTestSending(true);
    setSmsTestNotice(null);
    try {
      const response = await fetch("/api/vision-x-saha/sms-send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          recipient: smsTestPhone,
          message: smsTestMessage,
          confirmed: smsTestConfirmed
        })
      });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.accepted) throw new Error(body.error || "InfoTXT did not accept the test SMS.");
      setSmsTestNotice({ tone: "good", text: `${body.message}${body.destinationMasked ? ` Recipient: ${body.destinationMasked}.` : ""}${body.smsId ? ` Provider ID: ${body.smsId}.` : ""}` });
      setSmsTestPhone("");
      setSmsTestConfirmed(false);
    } catch (error) {
      setSmsTestNotice({ tone: "bad", text: error instanceof Error ? error.message : "The test SMS could not be sent." });
    } finally {
      setSmsTestSending(false);
    }
  };
  const rows: Array<{ key: "meta" | "capi" | "pancake" | "landing" | "traffic" | "sheet"; name: string; purpose: string; detail?: string; url?: string }> = [
    { key: "meta", name: "Meta Ads", purpose: "Campaign spend, purchases, CPA, and ROAS", detail: live?.meta.connected ? `${live.meta.data.account.name} · ${live.meta.data.account.currency}` : live?.meta.error, url: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1438592618166795" },
    { key: "capi", name: "Meta CAPI", purpose: "Server-side Purchase events with browser deduplication", detail: live?.capi.connected ? `${(live.capi.data.profiles || [{ datasetId: live.capi.data.datasetId }]).map((profile: any) => profile.datasetId).join(" · ")}. ${live.capi.data.note || "Configured"}` : live?.capi.error },
    { key: "pancake", name: "Pancake POS", purpose: "Orders, statuses, fulfillment, and product catalog", detail: live?.pancake.connected ? `${live.pancake.data.shop.name} · ${live.pancake.data.totalOrders} recent orders` : live?.pancake.error },
    { key: "landing", name: "SecureCOD pages", purpose: "COD checkout and upsell storefronts", detail: live?.landing.connected ? "All three public pages are monitored" : live?.landing.error, url: REGION7_VISION_URL },
    { key: "traffic", name: "Visitor analytics", purpose: "Sessions, paths, sources, and geography", detail: live?.traffic.connected ? `${live.traffic.data.totalVisits} recorded visits` : live?.traffic.error },
    { key: "sheet", name: "Google Sheet", purpose: "Order, SMS, checkout, visit, and capital audit logs", detail: live?.sheet.connected ? `${live.sheet.data.totals.loggedOrders} logged orders · ${php(live.sheet.data.capital?.total)} capital` : live?.sheet.error, url: live?.sheet.data?.spreadsheetUrl },
  ];
  const smsExpiresSoon = Boolean(smsStatus?.expiresAt && Date.parse(`${smsStatus.expiresAt}T00:00:00+08:00`) <= Date.now() + 14 * 24 * 60 * 60 * 1000);
  return <>
    <SectionHeader eyebrow="Connection register" title="Integrations" copy="Live health for every system currently driving VISION X SAHA." action={<button className="vxs-primary" onClick={refresh} disabled={loading}>{loading ? "Checking" : "Check all"}</button>} />
    <div className="vxs-integration-grid">{rows.map(item => {
      const provider = live?.[item.key];
      const verificationNeeded = item.key === "capi" && provider?.connected && provider.data?.fullyVerified === false;
      return <article className="vxs-card" key={item.key}><div className="vxs-integration-top"><span className="vxs-integration-icon">{item.name.slice(0, 2).toUpperCase()}</span><Badge tone={verificationNeeded ? "warn" : provider?.connected ? "good" : "bad"}>{verificationNeeded ? "Configured" : provider?.connected ? "Connected" : loading ? "Checking" : "Issue"}</Badge></div><h3>{item.name}</h3><p>{item.purpose}</p><div className="vxs-need"><span>{verificationNeeded ? "Verification needed" : provider?.connected ? "Live source" : "Attention needed"}</span><strong>{item.detail || "Checking connection..."}</strong></div>{item.url ? <a className="vxs-secondary" href={item.url} target="_blank" rel="noreferrer">Open source</a> : null}</article>;
    })}</div>
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Optional audit control</p><h3>Landing-order reconciliation</h3></div><Badge tone={live?.reconciliation?.sheetRowsComplete ? live.reconciliation.orderLogsMatch ? "good" : "warn" : "muted"}>{live?.reconciliation?.sheetRowsComplete ? live.reconciliation.orderLogsMatch ? "Matched" : "Review" : "Waiting for complete rows"}</Badge></div>
      <p className="vxs-reconciliation-note">{live?.reconciliation?.note || "This audit stays inactive until the Google Sheet feed returns a complete, date-aligned order-ID list."}</p>
      {live?.reconciliation?.sheetRowsComplete ? <><Metrics rows={[["POS landing orders", number(live.reconciliation.posLandingOrders)], ["Matched Sheet logs", number(live.reconciliation.matchedOrders)], ["Missing in Sheet", number(live.reconciliation.posOnly?.length)], ["Missing in POS", number(live.reconciliation.sheetOnly?.length)]]} />
        {(live.reconciliation.posOnly?.length || 0) + (live.reconciliation.sheetOnly?.length || 0) > 0 ? <div className="vxs-reconciliation-list">{(live.reconciliation.posOnly || []).map(order => <div key={`pos-${order.id}`}><strong>POS #{order.id}</strong><span>Not logged in Sheet · {dateTime(order.createdAt)} · {php(order.value)}</span></div>)}{(live.reconciliation.sheetOnly || []).map(order => <div key={`sheet-${order.id}`}><strong>Sheet #{order.id}</strong><span>Not found in POS landing orders · {order.createdAt || "No date"} · {php(order.value)}</span></div>)}</div> : null}
      </> : null}
    </section>
    <section className="vxs-card vxs-sms-setup-card"><div className="vxs-card-head"><div><p>Manual API setup</p><h3>SMS connection (INFOTXT)</h3></div><Badge tone={smsStatus?.configured ? "good" : smsStatus ? "warn" : "muted"}>{smsStatus?.configured ? "Configured" : smsStatus ? "Not configured" : "Checking"}</Badge></div>
      <div className="vxs-sms-overview"><div><span>Provider</span><strong>INFOTXT Cloud API v2</strong></div><div><span>User ID</span><strong>{smsStatus?.maskedUserId || "Not set"}</strong></div><div><span>API key</span><strong>{smsStatus?.maskedKey || "Not set"}</strong></div><div><span>Assigned SIM</span><strong>{smsStatus?.simSlot ? `Account slot ${smsStatus.simSlot}` : "Not set"}{smsStatus?.maskedSimMobile ? ` · ${smsStatus.maskedSimMobile}` : ""}</strong></div><div><span>Credential expiry</span><strong>{smsStatus?.expiresAt || "Not set"}</strong></div><div><span>Tracking</span><strong>{smsStatus?.trackingEnabled === false ? "Disabled" : "Enabled"}</strong></div></div>
      {smsExpiresSoon ? <div className="vxs-sms-notice warn"><Badge tone="warn">Renew soon</Badge><span>The current INFOTXT credential expires within 14 days. Renew it before live launch to avoid an SMS outage.</span></div> : null}
      <p className="vxs-card-foot">Upload <strong>sms info.txt</strong> or enter the INFOTXT account details manually. Secrets are stored privately server-side and never returned to the browser. Saving does not send a test SMS or enable live automation.{smsStatus?.updatedAt ? ` Last updated ${new Date(smsStatus.updatedAt).toLocaleString("en-PH")}${smsStatus.updatedBy ? ` by ${smsStatus.updatedBy}` : ""}.` : ""}</p>
      <div className="vxs-sms-card-actions"><button className="vxs-primary" onClick={() => { setSmsSimSlot(smsStatus?.simSlot || ""); setSmsExpiresAt(smsStatus?.expiresAt || ""); setSmsNotice(null); setShowSmsSetup(true); }}>Set up or update SMS API</button><button className="vxs-secondary" disabled={!smsStatus?.configured} onClick={() => { setSmsTestNotice(null); setShowSmsTest(true); }}>Send controlled test</button></div>
    </section>
    {showSmsSetup ? <div className="vxs-modal-backdrop" role="presentation" onMouseDown={closeSmsSetup}><form className="vxs-modal" onSubmit={testSmsConnection} onMouseDown={event => event.stopPropagation()}><header><div><p>Secure manual connection</p><h2>Connect INFOTXT SMS</h2></div><button type="button" aria-label="Close" onClick={closeSmsSetup} disabled={smsChecking}>×</button></header><div className="vxs-modal-grid">
      <label className="wide vxs-upload">Upload sms info.txt<input type="file" accept=".txt,text/plain,application/json" onChange={event => void readSmsFile(event.currentTarget.files?.[0])} disabled={smsChecking} /><span>{smsFileName ? `${smsFileName} loaded` : "Accepted formats: KEY=VALUE, label: value, JSON, or a file containing only the API key."}</span></label>
      <label>INFOTXT User ID<input inputMode="numeric" autoComplete="off" value={smsUserId} onChange={event => setSmsUserId(event.target.value.replace(/\D/g, ""))} placeholder="Numeric User ID" minLength={1} maxLength={20} required /><span>Shown in the INFOTXT account profile.</span></label>
      <label className="wide">INFOTXT API key<input type="password" autoComplete="off" spellCheck={false} value={smsApiKey} onChange={event => setSmsApiKey(event.target.value.trim())} placeholder="Paste the API key" minLength={8} maxLength={128} required /><span>Hidden while you type. On save it is stored in private server-side storage and used for sending.</span></label>
      <label>Account SIM slot<input inputMode="numeric" value={smsSimSlot} onChange={event => setSmsSimSlot(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 4" minLength={1} maxLength={3} required /><span>From your INFOTXT profile. This slot is now sent as the API SIM ID on every outbound SMS, so messages dispatch through this SIM.</span></label>
      <label>SIM mobile<input inputMode="tel" autoComplete="off" value={smsSimMobile} onChange={event => setSmsSimMobile(event.target.value)} placeholder="09XXXXXXXXX" minLength={11} maxLength={13} required /><span>The mobile number of the sending SIM.</span></label>
      <label>Credential expiry<input type="date" value={smsExpiresAt} onChange={event => setSmsExpiresAt(event.target.value)} required /><span>The renewal warning starts 14 days before this date.</span></label>
      <div className="vxs-sms-variable-list"><span>Optional environment fallback</span><code>INFOTXT_USER_ID</code><code>INFOTXT_API_KEY</code><code>INFOTXT_SIM_SLOT</code><code>INFOTXT_SIM_MOBILE</code><code>INFOTXT_EXPIRES_AT</code></div>
      {smsNotice ? <div className={`vxs-sms-notice wide ${smsNotice.tone}`}><Badge tone={smsNotice.tone}>{smsNotice.tone === "good" ? "Saved" : smsNotice.tone === "bad" ? "Error" : "Private"}</Badge><span>{smsNotice.text}</span></div> : null}
      <div className="vxs-sms-manual-steps wide"><strong>How this is stored</strong><span>On save, the User ID, API key, sending SIM, slot, and expiry are written to private server-side storage. The API key is never returned by the API. Live sending remains locked until the official send and webhook guides are verified.</span></div>
    </div><footer><button type="button" className="vxs-secondary" onClick={closeSmsSetup} disabled={smsChecking}>Cancel</button><button type="submit" className="vxs-primary" disabled={smsChecking || !smsUserId || !smsApiKey || !smsSimSlot || !smsSimMobile || !smsExpiresAt}>{smsChecking ? "Saving..." : "Save credentials"}</button></footer></form></div> : null}
    {showSmsTest ? <div className="vxs-modal-backdrop" role="presentation" onMouseDown={closeSmsTest}><form className="vxs-modal" onSubmit={sendSmsTest} onMouseDown={event => event.stopPropagation()}><header><div><p>Protected outbound test</p><h2>Send one InfoTXT SMS</h2></div><button type="button" aria-label="Close" onClick={closeSmsTest} disabled={smsTestSending}>×</button></header><div className="vxs-modal-grid">
      <div className="vxs-sms-manual-steps wide"><strong>Manual test only</strong><span>This sends exactly one SMS to the number below. It does not enable automatic customer or rider messages. InfoTXT acceptance confirms submission, while handset delivery requires the provider webhook.</span></div>
      <label className="wide">Authorized test mobile<input inputMode="tel" autoComplete="off" value={smsTestPhone} onChange={event => setSmsTestPhone(event.target.value)} placeholder="09XXXXXXXXX" minLength={11} maxLength={13} required /><span>Use a number you control or have permission to message.</span></label>
      <label className="wide">Test message<textarea value={smsTestMessage} onChange={event => setSmsTestMessage(event.target.value)} minLength={1} maxLength={420} required /><span>The system automatically adds “VISION X SAHA TEST:” so the message cannot be mistaken for a live courier notification.</span></label>
      <label className="wide vxs-sms-test-confirm"><input type="checkbox" checked={smsTestConfirmed} onChange={event => setSmsTestConfirmed(event.target.checked)} required /><span>I confirm that I control this number or have permission to send it a test SMS.</span></label>
      {smsTestNotice ? <div className={`vxs-sms-notice wide ${smsTestNotice.tone}`}><Badge tone={smsTestNotice.tone}>{smsTestNotice.tone === "good" ? "Accepted" : "Failed"}</Badge><span>{smsTestNotice.text}</span></div> : null}
    </div><footer><button type="button" className="vxs-secondary" onClick={closeSmsTest} disabled={smsTestSending}>Cancel</button><button type="submit" className="vxs-primary" disabled={smsTestSending || !smsTestPhone || !smsTestMessage || !smsTestConfirmed}>{smsTestSending ? "Sending..." : "Send one test SMS"}</button></footer></form></div> : null}
    <section className="vxs-card" style={{ marginTop: 16 }}><div className="vxs-card-head"><div><p>Next finance connections</p><h3>Still needed for full cash reconciliation</h3></div><Badge tone="warn">Finance gap</Badge></div><div className="vxs-simple-list"><div className="vxs-live-row"><div><strong>Courier COD remittances</strong><span>Courier tracking is live. Payout files are still needed to reconcile collections, fees, and deposits.</span></div></div><div className="vxs-live-row"><div><strong>Expense and receipt ledger</strong><span>Needed for net profit, partner billing, and reimbursement proof.</span></div></div><div className="vxs-live-row"><div><strong>Bank or payout statements</strong><span>Needed to match actual deposits against courier remittances.</span></div></div></div></section>
  </>;
}

function ContractView() {
  const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, display: "grid", gap: 7, fontSize: 11, lineHeight: 1.5, color: "var(--vxs-ink)" };
  const subCard: React.CSSProperties = { background: "#f6f8f7", border: "1px solid var(--vxs-line)", borderRadius: 12, padding: 14, display: "grid", gap: 10 };
  const snapshot: Array<[string, string]> = [
    ["Marketing Partner", "Vision E-Commerce"],
    ["Supplier", "Kevin R. Allego"],
    ["Profit split", "60% Kevin / 40% Vision"],
    ["Ad reimbursement", "50% by Supplier"],
    ["Billing cycle", "Every 15 days"],
    ["Order SLA", "24 hours"],
    ["Capital pool", "PHP 100,000"],
    ["Effective", "Sep 14, 2026"]
  ];
  const marketingScope = [
    "Serve as the exclusive marketing arm of the SAHA brand.",
    "Manage all Meta Ads and other digital advertising campaigns.",
    "Handle advertising strategy, creatives, copywriting, and optimization.",
    "Use its own credit card for advertising payments.",
    "Manage customer order processing and coordinate fulfillment with the Supplier.",
    "Monitor campaign performance and prepare weekly sales and advertising reports.",
    "Compute monthly profit-sharing.",
    "Issue billing statements every 15 calendar days."
  ];
  const supplierScope = [
    "Maintain a separate bank/payment account used only for this business.",
    "Give Rustan viewing and monitoring access to the account dashboard.",
    "Supply all SAHA products and keep sufficient inventory at all times.",
    "Pack and fulfill all customer orders, shipping directly from the warehouse.",
    "Meet agreed quality standards; replace defective or incorrectly shipped goods at own expense.",
    "Provide inventory updates whenever requested.",
    "Process confirmed orders within the agreed 24-hour turnaround."
  ];
  const kevinAreas = ["Product sourcing", "Supplier coordination", "Fulfillment setup and testing", "Day-to-day operations", "Inventory management", "Labor management (hiring, staffing, KPI, termination)", "Remittances from couriers"];
  const rustanAreas = ["Scaling of the business", "Advertising budget", "Ads management", "Sales and customer handling", "Advertising budget control"];
  const sharedAreas = ["Capital release", "Financial reconciliation", "Major expenses", "Profit calculation", "Advertising creatives and setup"];
  const controlMatrix: Array<[string, string]> = [
    ["Capital Release", "Kevin / Rustan"],
    ["Financial Reconciliation", "Kevin / Rustan"],
    ["Budget Ceilings", "Rustan"],
    ["Major Expenses", "Kevin / Rustan"],
    ["Profit Calculation", "Kevin / Rustan"],
    ["Courier Remittances", "Kevin"],
    ["Records and Contracts", "Vision"],
    ["Ads Budget Control", "Rustan"],
    ["Ads Creatives / Setup", "Rustan / Kevin"],
    ["Supplier Coordination", "Kevin"],
    ["Labor (Hiring, Fulfillment, KPI, Termination)", "Kevin"],
    ["Sales / Customer Handling", "Rustan"],
    ["Day-to-Day Operations", "Kevin"],
    ["Inventory", "Kevin"]
  ];
  const jointMatters = [
    "Incurring or obtaining new debt or financial obligations.",
    "Major supplier commitments.",
    "Large or substantially unbudgeted purchases or expenses.",
    "Admission of new investors.",
    "Withdrawal or distribution of profits.",
    "Appointment or admission of new partners.",
    "Changes in ownership or ownership structure.",
    "Major or substantial scaling of advertising expenditure.",
    "Any other material decision affecting finances, ownership, obligations, or direction."
  ];
  const keyTerms: Array<[string, string]> = [
    ["Exclusive partnership", "Vision is the exclusive digital marketing and e-commerce partner. The Supplier will not engage another agency for the same products on the same platforms without written consent."],
    ["Payment for goods", "Paid per confirmed order at a mutually agreed wholesale price. Price changes require written approval from both parties."],
    ["Inventory", "All inventory stays the sole property of the Supplier until sold. Vision is not liable for losses from insufficient inventory."],
    ["Returns and QA", "The Supplier replaces incorrectly shipped, damaged, spoiled, or off-spec goods. No liability for natural deterioration after courier acceptance unless due to Supplier negligence."],
    ["Termination", "Either party may terminate on 30 days written notice for breach, fraud, failure to perform, or mutual agreement. Outstanding obligations are settled first."],
    ["Governing law", "Laws of the Philippines. Disputes go to amicable settlement first, then the proper courts."],
    ["Confidentiality", "Both parties keep all business information, customer data, pricing, and reports confidential."]
  ];
  const toneForWho = (who: string): Tone => who.includes("/") ? "info" : who === "Vision" ? "muted" : who === "Rustan" ? "warn" : "good";

  return <>
    <SectionHeader eyebrow="Partnership documentation" title="Vision x KRA Agreement" copy="Signed Memorandum of Agreement and the agreed operational scopes for the SAHA brand." action={<a className="vxs-secondary" href="/vision-x-saha/moa.pdf" target="_blank" rel="noreferrer">Download signed MOA</a>} />
    <div className="vxs-demo-note"><strong>Reference only</strong><span>Executed Sep 14, 2026 and notarized Sep 22, 2026 in the City of Manila. This in-app summary documents the agreed scopes. The signed PDF is the controlling document.</span></div>
    <section className="vxs-card" style={{ marginBottom: 16 }}>
      <div className="vxs-card-head"><div><p>Agreement snapshot</p><h3>Parties and headline terms</h3></div><Badge tone="good">Active</Badge></div>
      <div className="vxs-mini-metrics">{snapshot.map(([k, v]) => <div key={k}><span>{k}</span><strong style={{ fontSize: 13 }}>{v}</strong></div>)}</div>
    </section>
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Section VII</p><h3>Profit sharing</h3></div><Badge tone="info">Monthly</Badge></div>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--vxs-muted)", lineHeight: 1.6 }}>Net Profit is computed and distributed monthly, then reviewed and approved by both parties before release.</p>
        <div className="vxs-need"><span>Net profit formula</span><strong>Gross Sales - COGS - Advertising - Platform Fees - Payment Gateway - Courier - Refunds and Returns - Other agreed operational expenses</strong></div>
        <div className="vxs-money-flow" style={{ paddingBottom: 0 }}><div><span>Supplier (Kevin)</span><strong>60%</strong></div><b>/</b><div style={{ textAlign: "right" }}><span>Marketing Partner (Vision)</span><strong>40%</strong></div></div>
      </section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Annex A / Section 1</p><h3>Capital contribution</h3></div><Badge tone="info">PHP 100,000</Badge></div>
        <div className="vxs-simple-list"><div className="vxs-live-row"><div><strong>Kevin</strong><span>Supplier contribution</span></div><strong>PHP 50,000</strong></div><div className="vxs-live-row"><div><strong>Rustan</strong><span>Marketing Partner contribution</span></div><strong>PHP 50,000</strong></div></div>
        <p className="vxs-card-foot">Effective Sep 14, 2026. Both parties keep documentation of their contributions.</p>
      </section>
    </div>
    <div className="vxs-two-col" style={{ marginTop: 16 }}>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Section II-A</p><h3>Marketing Partner scope</h3></div><Badge tone="muted">Vision</Badge></div><ul style={listStyle}>{marketingScope.map(item => <li key={item}>{item}</li>)}</ul></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Section II-B</p><h3>Supplier scope</h3></div><Badge tone="muted">Kevin</Badge></div><ul style={listStyle}>{supplierScope.map(item => <li key={item}>{item}</li>)}</ul></section>
    </div>
    <section className="vxs-card" style={{ marginTop: 16, marginBottom: 16 }}>
      <div className="vxs-card-head"><div><p>Annex A / Section 2</p><h3>Primary areas of responsibility</h3></div></div>
      <div className="vxs-integration-grid">
        <article style={subCard}><div className="vxs-integration-top"><strong>Kevin</strong><Badge tone="good">Supplier</Badge></div><ul style={listStyle}>{kevinAreas.map(item => <li key={item}>{item}</li>)}</ul></article>
        <article style={subCard}><div className="vxs-integration-top"><strong>Rustan</strong><Badge tone="warn">Marketing</Badge></div><ul style={listStyle}>{rustanAreas.map(item => <li key={item}>{item}</li>)}</ul></article>
        <article style={subCard}><div className="vxs-integration-top"><strong>Shared</strong><Badge tone="info">Both</Badge></div><ul style={listStyle}>{sharedAreas.map(item => <li key={item}>{item}</li>)}</ul></article>
      </div>
    </section>
    <section className="vxs-card" style={{ marginBottom: 16 }}>
      <div className="vxs-card-head"><div><p>Annex A / Section 3</p><h3>Financial and operational control</h3></div><Badge tone="info">Accountability</Badge></div>
      <div className="vxs-simple-list">{controlMatrix.map(([area, who]) => <div className="vxs-live-row" key={area}><div><strong>{area}</strong></div><Badge tone={toneForWho(who)}>{who}</Badge></div>)}</div>
    </section>
    <div className="vxs-two-col">
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Annex A / Section 4</p><h3>Matters requiring joint decision</h3></div><Badge tone="bad">Both parties</Badge></div><ul style={listStyle}>{jointMatters.map(item => <li key={item}>{item}</li>)}</ul></section>
      <section className="vxs-card"><div className="vxs-card-head"><div><p>Sections III to XVIII</p><h3>Key terms</h3></div></div><div className="vxs-simple-list">{keyTerms.map(([term, detail]) => <div className="vxs-live-row" key={term}><div><strong>{term}</strong><span>{detail}</span></div></div>)}</div></section>
    </div>
  </>;
}

export default function VisionSahaClient() {
  const [view, setView] = useState<View>("command");
  const [mobileMore, setMobileMore] = useState(false);
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [liveOrders, setLiveOrders] = useState<any>(null);
  const [orderLoadError, setOrderLoadError] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>("mtd");
  const [openBillingPeriod, setOpenBillingPeriod] = useState<ReportingPeriod | null>(null);

  const fetchWithRetry = async (path: string, attempts = 2) => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(path, { cache: "no-store" });
        if (response.ok || response.status === 401) return response;
        lastError = new Error(`Request returned ${response.status}.`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Connection failed.");
      }
      if (attempt < attempts - 1) await new Promise(resolve => window.setTimeout(resolve, 700));
    }
    throw lastError || new Error("Connection failed.");
  };

  const loadLive = async (period = reportingPeriod) => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetchWithRetry(`/api/vision-x-saha/live?period=${period}`);
      if (response.status === 401) {
        window.location.href = "/vision-x-saha/login";
        return;
      }
      if (!response.ok) throw new Error("Live data request failed.");
      setLive(await response.json());
    } catch (error) {
      setLoadError(error instanceof Error ? `Live data is temporarily unavailable. ${error.message}` : "Live data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrderLoadError("");
    try {
      const response = await fetchWithRetry("/api/vision-x-saha/orders");
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      if (!response.ok) throw new Error("Order feed request failed.");
      setLiveOrders(await response.json());
    } catch (error) {
      setOrderLoadError(error instanceof Error ? `Order feed is temporarily unavailable. ${error.message}` : "Order feed is temporarily unavailable.");
    }
  };

  useEffect(() => {
    void loadLive(reportingPeriod);
    const timer = window.setInterval(() => void loadLive(reportingPeriod), 60000);
    return () => window.clearInterval(timer);
  }, [reportingPeriod]);

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 20000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshAll = () => {
    void loadLive(reportingPeriod);
    void loadOrders();
  };
  const title = useMemo(() => navigation.find(item => item.id === view)?.label || "Command Center", [view]);
  const coreConnected = Boolean(live?.meta.connected && live?.pancake.connected && live?.landing.connected && live?.traffic.connected && live?.sheet.connected && live?.capi.connected && !loadError && !orderLoadError);
  const select = (id: View) => { if (id === "billing") setOpenBillingPeriod(null); setView(id); setMobileMore(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openBillingReport = (period: ReportingPeriod) => { setReportingPeriod(period); setOpenBillingPeriod(period); window.scrollTo({ top: 0, behavior: "smooth" }); };
  let group = "";

  return <div className="vxs-app">
    <aside className="vxs-sidebar"><div className="vxs-brand"><span>VX</span><div><strong>VISION X SAHA</strong><small>Live Business Command Center</small></div></div><nav>{navigation.map(item => { const showGroup = item.group !== group; group = item.group; return <div key={item.id}>{showGroup ? <p>{item.group}</p> : null}<button className={view === item.id ? "active" : ""} onClick={() => select(item.id)}><i>{item.label.slice(0, 1)}</i>{item.label}</button></div>; })}</nav><div className="vxs-user"><span>KR</span><div><strong>Kevin Allego</strong><small><a href="/vision-x-saha/logout" style={{ color: "inherit" }}>Log out</a></small></div></div></aside>
    <main className="vxs-main"><header className="vxs-topbar"><div><button className="vxs-mobile-logo" onClick={() => setMobileMore(true)}>VX</button><div><strong>{title}</strong><span>{loadError || orderLoadError ? `${loadError || orderLoadError} Showing the last successful snapshot.` : live ? `Synced ${new Date(live.generatedAt).toLocaleTimeString("en-PH")}` : "Connecting live sources"}</span></div></div><div><Badge tone={coreConnected ? "good" : "warn"}>{coreConnected ? "Core data sources connected" : "Connection attention"}</Badge><button className="vxs-icon-button" aria-label="Refresh data" onClick={refreshAll}>↻</button><span className="vxs-avatar">KR</span></div></header>
      <div className="vxs-content">
        {view === "command" ? <CommandCenter live={live} liveOrders={liveOrders} loading={loading} refresh={refreshAll} open={select} period={reportingPeriod} onPeriodChange={setReportingPeriod} /> : null}
        {view === "guide" ? <SystemGuideView /> : null}
        {view === "januploader" ? <JanUploaderView refreshOrders={loadOrders} /> : null}
        {view === "orders" ? <OrdersView live={live} liveOrders={liveOrders} loading={loading} refresh={loadLive} refreshOrders={loadOrders} /> : null}
        {view === "print" ? <WaybillPrintCenter orders={liveOrders?.recentOrders || []} /> : null}
        {view === "complaints" ? <CourierComplaintsView /> : null}
        {view === "customers" ? <CustomersView /> : null}
        {view === "sms" ? <SmsAutomationView liveOrders={liveOrders} /> : null}
        {view === "marketing" ? <MarketingAutomationView /> : null}
        {view === "ltv" ? <LtvView /> : null}
        {view === "inventory" ? <InventoryView live={live} loading={loading} refresh={loadLive} /> : null}
        {view === "capital" ? <CapitalView live={live} loading={loading} refresh={loadLive} /> : null}
        {view === "billing" ? (openBillingPeriod ? (openBillingPeriod === "initial_settlement" ? <InitialSettlementStatic onBack={() => setOpenBillingPeriod(null)} /> : <SettlementSOAView live={live} loading={loading} refresh={loadLive} onBack={() => setOpenBillingPeriod(null)} />) : <BillingReportIndex live={live} loading={loading} onOpen={openBillingReport} onRefresh={() => void loadLive(reportingPeriod)} />) : null}
        {view === "advertising" ? <AdvertisingView live={live} loading={loading} refresh={loadLive} /> : null}
        {view === "posts" ? <PostLibraryView /> : null}
        {view === "traffic" ? <TrafficView live={live} loading={loading} refresh={loadLive} /> : null}
        {view === "integrations" ? <IntegrationsView live={live} loading={loading} refresh={loadLive} /> : null}
        {view === "contract" ? <ContractView /> : null}
      </div>
    </main>
    <nav className="vxs-mobile-nav"><button className={view === "command" ? "active" : ""} onClick={() => select("command")}><i>H</i>Home</button><button className={view === "orders" ? "active" : ""} onClick={() => select("orders")}><i>O</i>Orders</button><button className={view === "advertising" ? "active" : ""} onClick={() => select("advertising")}><i>A</i>Ads</button><button className={view === "capital" ? "active" : ""} onClick={() => select("capital")}><i>C</i>Capital</button><button onClick={() => setMobileMore(true)}><i>M</i>More</button></nav>
    {mobileMore ? <div className="vxs-mobile-menu"><header><strong>All sections</strong><button onClick={() => setMobileMore(false)}>×</button></header>{navigation.map(item => <button key={item.id} onClick={() => select(item.id)}>{item.label}</button>)}</div> : null}
  </div>;
}


