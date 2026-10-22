"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  province?: string | null;
  countryCode?: string | null;
  shops: string[];
  tags: string[];
  assignedTo?: string | null;
  orderCount: number;
  deliveredCount: number;
  failedCount: number;
  returnedCount: number;
  cancelledCount: number;
  lifetimeValue: number;
  lastStatus: string;
  lastOrderAt?: string | null;
  lastInteractionAt?: string | null;
  nextFollowupAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  riskLevel: string;
  preferredChannel?: string | null;
  smsMarketingConsent: boolean;
  callMarketingConsent: boolean;
  doNotContact: boolean;
  internalNote?: string | null;
  doNotContactReason?: string | null;
  sourceFirstSeen?: string | null;
  marketingSegment: string;
  marketingEligible: boolean;
  marketingPriority: number;
  marketingReason: string;
  marketingNextEligibleAt?: string | null;
  marketingSequence?: string | null;
};

type ListResponse = {
  source: string;
  syncedAt: string;
  data: Customer[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  shops: string[];
  summary: { customers: number; delivered: number; active: number; deliveryIssues: number; lifetimeValue: number };
};

type ProfileResponse = {
  customer: Customer;
  addresses: any[];
  orders: any[];
  events: any[];
  interactions: any[];
  followups: any[];
};

function money(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function count(value: unknown) {
  return Number(value || 0).toLocaleString("en-PH");
}

function display(value: unknown) {
  return String(value || "Not recorded").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
}

function when(value: unknown, includeTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-PH", includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(value: unknown) {
  const status = String(value || "").toLowerCase();
  if (/fail|return|reject|cancel/.test(status)) return "bad";
  if (/delivered/.test(status)) return "good";
  if (/new|confirm|pack/.test(status)) return "warn";
  return "info";
}

function Status({ value }: { value: unknown }) {
  return <span className={`vxs-badge ${statusTone(value)}`}>{display(value)}</span>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="vxs-customer-profile-section"><h3>{title}</h3>{children}</section>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="vxs-customer-detail"><span>{label}</span><strong>{value || "Not recorded"}</strong></div>;
}

function CustomerProfile({ profile, close }: { profile: ProfileResponse; close: () => void }) {
  const customer = profile.customer;
  const issues = customer.failedCount + customer.returnedCount;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("vxs-customer-drawer-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("vxs-customer-drawer-open");
    };
  }, [close]);

  return <div className="vxs-customer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside className="vxs-customer-drawer" role="dialog" aria-modal="true" aria-label={`${customer.fullName} customer profile`}>
      <header className="vxs-customer-profile-head"><div><p>Secure COD Express CRM</p><h2>{customer.fullName}</h2><span>{[customer.phone, customer.city, customer.province].filter(Boolean).join(" | ") || "Complete customer history"}</span></div><button onClick={close}>Close</button></header>
      <div className="vxs-customer-profile-body">
        <section className="vxs-customer-profile-metrics">
          <div><span>Orders</span><strong>{count(customer.orderCount)}</strong></div>
          <div><span>Delivered</span><strong>{count(customer.deliveredCount)}</strong></div>
          <div><span>Issues</span><strong>{count(issues)}</strong></div>
          <div><span>Customer value</span><strong>{money(customer.lifetimeValue)}</strong></div>
          <div><span>Latest status</span><Status value={customer.lastStatus} /></div>
          <div><span>Assigned to</span><strong>{customer.assignedTo || "Unassigned"}</strong></div>
        </section>
        <ProfileSection title="SMS marketing evaluation"><div className="vxs-customer-details">
          <Detail label="Lifecycle segment" value={display(customer.marketingSegment)} /><Detail label="Eligible when activated" value={customer.marketingEligible ? "Yes" : "No"} />
          <Detail label="Priority score" value={customer.marketingPriority} /><Detail label="Recommended sequence" value={display(customer.marketingSequence)} />
          <Detail label="Decision" value={customer.marketingReason} /><Detail label="Next eligible date" value={when(customer.marketingNextEligibleAt, true)} />
        </div></ProfileSection>
        <ProfileSection title="Customer information"><div className="vxs-customer-details">
          <Detail label="Full name" value={customer.fullName} /><Detail label="Phone" value={customer.phone} /><Detail label="Email" value={customer.email} />
          <Detail label="Location" value={[customer.city, customer.province, customer.countryCode].filter(Boolean).join(", ")} /><Detail label="Shops" value={customer.shops.join(", ")} />
          <Detail label="Risk level" value={display(customer.riskLevel)} /><Detail label="Preferred channel" value={display(customer.preferredChannel)} /><Detail label="SMS marketing" value={customer.smsMarketingConsent ? "Recorded" : "Not recorded"} />
          <Detail label="Call marketing" value={customer.callMarketingConsent ? "Recorded" : "Not recorded"} /><Detail label="Do not contact" value={customer.doNotContact ? `Yes${customer.doNotContactReason ? `: ${customer.doNotContactReason}` : ""}` : "No"} />
          <Detail label="Tags" value={customer.tags.join(", ")} /><Detail label="First source" value={customer.sourceFirstSeen} /><Detail label="First seen" value={when(customer.firstSeenAt, true)} />
          <Detail label="Last seen" value={when(customer.lastSeenAt, true)} /><Detail label="Next follow-up" value={when(customer.nextFollowupAt, true)} /><Detail label="Internal note" value={customer.internalNote} />
        </div></ProfileSection>
        <ProfileSection title="Saved addresses">{profile.addresses.length ? <div className="vxs-customer-history">{profile.addresses.map(address => <article key={address.id}><div><strong>{[address.address_line, address.barangay, address.city, address.province, address.postal_code].filter(Boolean).join(", ")}</strong>{address.is_primary ? <span className="vxs-badge good">Primary</span> : null}</div><small>{address.landmark || address.source || "CRM address"}</small></article>)}</div> : <p className="vxs-empty">No saved addresses.</p>}</ProfileSection>
        <ProfileSection title="Purchase and delivery history">{profile.orders.length ? <div className="vxs-customer-history">{profile.orders.map(order => <article key={order.id}><div><strong>{order.product_summary || `Order ${order.external_order_id || ""}`}</strong><Status value={order.normalized_status} /></div><small>{order.shop_label || order.source_system || "CRM"} | {money(order.amount)} | {count(order.quantity)} pcs | {when(order.ordered_at || order.created_at, true)}</small><small>Order: {order.external_order_id || "Not recorded"} | Tracking: {order.tracking_number || "Not recorded"}{order.failure_reason ? ` | Issue: ${order.failure_reason}` : ""}</small></article>)}</div> : <p className="vxs-empty">No purchase history.</p>}</ProfileSection>
        <ProfileSection title="Follow-ups">{profile.followups.length ? <div className="vxs-customer-history">{profile.followups.map(item => <article key={item.id}><div><strong>{item.title || "Follow-up"}</strong><Status value={item.status} /></div><small>Due {when(item.due_at, true)} | {display(item.priority)} priority | {item.assignedTo || "Unassigned"}</small>{item.notes ? <small>{item.notes}</small> : null}</article>)}</div> : <p className="vxs-empty">No follow-ups saved.</p>}</ProfileSection>
        <ProfileSection title="Calls, SMS, and notes">{profile.interactions.length ? <div className="vxs-customer-history">{profile.interactions.map(item => <article key={item.id}><div><strong>{display(item.channel || item.purpose)}</strong><span>{when(item.occurred_at || item.created_at, true)}</span></div><small>{[item.direction, item.outcome, item.userName].filter(Boolean).join(" | ") || "CRM interaction"}</small>{item.content ? <small>{item.content}</small> : null}</article>)}</div> : <p className="vxs-empty">No interactions recorded.</p>}</ProfileSection>
        <ProfileSection title="Status timeline">{profile.events.length ? <div className="vxs-customer-history">{profile.events.map(item => <article key={item.id}><div><Status value={item.normalized_status} /><span>{when(item.occurred_at, true)}</span></div><small>{[item.source, item.raw_status, item.note].filter(Boolean).join(" | ") || "Order status update"}</small></article>)}</div> : <p className="vxs-empty">No status events recorded.</p>}</ProfileSection>
      </div>
    </aside>
  </div>;
}

export default function CustomersView() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [marketing, setMarketing] = useState("all");
  const [shop, setShop] = useState("all");
  const [perPage, setPerPage] = useState(200);
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const load = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: query.trim(), status, marketing, shop, page: String(nextPage), perPage: String(perPage) });
      const response = await fetch(`/api/vision-x-saha/customers?${params}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The CRM customer list could not be loaded.");
      setData(body);
      setPage(body.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The CRM customer list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [marketing, page, perPage, query, shop, status]);

  useEffect(() => { void load(1); }, []);

  const openProfile = async (id: string) => {
    setProfileLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/vision-x-saha/customers?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The customer profile could not be loaded.");
      setProfile(body);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "The customer profile could not be loaded.");
    } finally {
      setProfileLoading(false);
    }
  };

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    void load(1);
  };

  const summary = data?.summary;
  return <>
    <header className="vxs-section-header"><div><p>Live customer intelligence</p><h2>Secure COD Express Customers</h2><span>Customer profiles, purchase history, delivery results, calls, SMS, notes, and follow-ups read from the CRM.</span></div><button className="vxs-primary" onClick={() => void load(page)} disabled={loading}>{loading ? "Syncing" : "Refresh CRM"}</button></header>
    <div className="vxs-demo-note"><strong>One source of truth</strong><span>No customer records are copied into a second database. This page reads the latest Secure COD Express CRM data whenever it loads or refreshes.</span></div>
    <section className="vxs-customer-summary">
      <div><span>All customers</span><strong>{count(summary?.customers)}</strong></div><div><span>Delivered customers</span><strong>{count(summary?.delivered)}</strong></div><div><span>Active deliveries</span><strong>{count(summary?.active)}</strong></div><div><span>Delivery issues</span><strong>{count(summary?.deliveryIssues)}</strong></div><div><span>Delivered value</span><strong>{money(summary?.lifetimeValue)}</strong></div>
    </section>
    <form className="vxs-customer-controls" onSubmit={apply}>
      <label className="wide"><span>Search</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, phone, location, order or tag" /></label>
      <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active delivery</option><option value="delivered">Has delivered order</option><option value="failed_delivery">Failed delivery</option><option value="returned">Returned order</option><option value="cancelled">Cancelled order</option><option value="no_orders">No orders</option></select></label>
      <label><span>Marketing segment</span><select value={marketing} onChange={event => setMarketing(event.target.value)}><option value="all">All segments</option><option value="vip">VIP</option><option value="repeat">Repeat</option><option value="recent_delivered">Recently delivered</option><option value="dormant">Dormant</option><option value="failed_winback">Failed win-back</option><option value="inquiry">Inquiry</option><option value="active_order">Active order</option><option value="excluded">Excluded</option><option value="waiting">Waiting</option></select></label>
      <label><span>Shop</span><select value={shop} onChange={event => setShop(event.target.value)}><option value="all">All shops</option>{(data?.shops || []).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Rows</span><select value={perPage} onChange={event => setPerPage(Number(event.target.value))}><option value={200}>200</option><option value={500}>500</option><option value={1000}>1,000</option></select></label>
      <button className="vxs-primary" type="submit">Apply</button>
    </form>
    {error ? <div className="vxs-demo-note"><strong>CRM connection error</strong><span>{error}</span></div> : null}
    <section className="vxs-card vxs-customer-table-card">
      <div className="vxs-card-head"><div><p>Customer directory</p><h3>{loading ? "Loading profiles" : `${count(data?.total)} customers`}</h3><span>{data ? `Synced ${when(data.syncedAt, true)}` : "Connecting to Secure COD Express CRM"}</span></div>{profileLoading ? <span>Loading profile...</span> : null}</div>
      <div className="vxs-customer-table-wrap"><div className="vxs-table vxs-customer-table"><div className="vxs-tr vxs-th"><span>Customer</span><span>Location</span><span>Shop</span><span>Status</span><span>Marketing</span><span>Orders</span><span>Delivered</span><span>Issues</span><span>Value</span><span>Last order</span><span>Risk</span></div>
        {(data?.data || []).map(customer => <button className="vxs-tr" key={customer.id} onClick={() => void openProfile(customer.id)}><span><strong>{customer.fullName}</strong><small>{customer.phone || "No phone"}{customer.doNotContact ? " | Do not contact" : ""}</small></span><span>{[customer.city, customer.province].filter(Boolean).join(", ") || "Not recorded"}</span><span>{customer.shops.join(", ") || "Not recorded"}</span><span><Status value={customer.lastStatus} /></span><span><span className={`vxs-badge ${customer.marketingEligible ? "good" : "muted"}`}>{display(customer.marketingSegment)}</span><small>{customer.marketingEligible ? `Priority ${customer.marketingPriority}` : "Waiting"}</small></span><span>{count(customer.orderCount)}</span><span>{count(customer.deliveredCount)}</span><span>{count(customer.failedCount + customer.returnedCount)}</span><span>{money(customer.lifetimeValue)}</span><span>{when(customer.lastOrderAt)}</span><span><b className={`vxs-customer-risk ${customer.riskLevel}`}>{display(customer.riskLevel)}</b></span></button>)}
      </div></div>
      {!loading && !data?.data.length ? <p className="vxs-empty">No customers match these filters.</p> : null}
      <footer className="vxs-customer-pagination"><span>Page {count(data?.page || 1)} of {count(data?.totalPages || 1)}</span><div><button disabled={loading || page <= 1} onClick={() => { const next = page - 1; setPage(next); void load(next); }}>Previous</button><button disabled={loading || page >= (data?.totalPages || 1)} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Next</button></div></footer>
    </section>
    {profile ? <CustomerProfile profile={profile} close={() => setProfile(null)} /> : null}
  </>;
}
