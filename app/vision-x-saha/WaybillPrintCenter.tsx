"use client";

import { useEffect, useMemo, useState } from "react";

type PaperFormat = "four-by-six" | "thermal-80";

type TemplateSettings = {
  format: PaperFormat;
  title: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  footer: string;
  showItems: boolean;
  showPrintNote: boolean;
};

type Waybill = {
  orderId: string;
  systemId: string;
  createdAt: string;
  status: string;
  recipient: { name: string; phone: string; address: string };
  sender: { name: string; phone: string; address: string };
  items: Array<{ name: string; sku: string; quantity: number; note: string }>;
  totalQuantity: number;
  cod: number;
  printNote: string;
  courier: string;
  tracking: string;
  sortCode: string;
  service: string;
  sentToCourierAt: string;
};

const STORAGE_KEY = "vision-x-saha-waybill-template-v1";
const DEFAULT_SETTINGS: TemplateSettings = {
  format: "four-by-six",
  title: "VISION X SAHA",
  senderName: "",
  senderPhone: "",
  senderAddress: "",
  footer: "Handle with care. Thank you for your order.",
  showItems: true,
  showPrintNote: true
};

const SAMPLE_WAYBILL: Waybill = {
  orderId: "PREVIEW",
  systemId: "SAMPLE",
  createdAt: "2026-10-22T10:30:00+08:00",
  status: "pending",
  recipient: {
    name: "Juan Dela Cruz",
    phone: "0917 000 0000",
    address: "123 Sample Street, Barangay Demo, Cebu City, Cebu 6000"
  },
  sender: {
    name: "VISION X SAHA",
    phone: "0917 111 1111",
    address: "Sample Warehouse, Cebu, Philippines"
  },
  items: [
    { name: "Lakatan Saha Bundle", sku: "LS-4PC", quantity: 4, note: "Planting bundle" },
    { name: "Grow Na Na", sku: "GNN-01", quantity: 1, note: "Bonus fertilizer" }
  ],
  totalQuantity: 5,
  cod: 880,
  printNote: "Please call the customer before delivery.",
  courier: "Bigate J&T Philippines",
  tracking: "SAMPLE123456789",
  sortCode: "CEB-01",
  service: "Standard delivery",
  sentToCourierAt: ""
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value || 0);
}

function date(value: string) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function safeSettings(value: unknown): TemplateSettings {
  const row = value && typeof value === "object" ? value as Partial<TemplateSettings> : {};
  return {
    format: row.format === "thermal-80" ? "thermal-80" : "four-by-six",
    title: String(row.title || DEFAULT_SETTINGS.title).slice(0, 80),
    senderName: String(row.senderName || "").slice(0, 120),
    senderPhone: String(row.senderPhone || "").slice(0, 40),
    senderAddress: String(row.senderAddress || "").slice(0, 300),
    footer: String(row.footer || DEFAULT_SETTINGS.footer).slice(0, 220),
    showItems: row.showItems !== false,
    showPrintNote: row.showPrintNote !== false
  };
}

export default function WaybillPrintCenter({ orders = [] }: { orders?: any[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [officialUrls, setOfficialUrls] = useState<string[]>([]);
  const [courierFilter, setCourierFilter] = useState<"all" | "jnt" | "spx">("all");
  const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkUrls, setBulkUrls] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings(safeSettings(JSON.parse(saved)));
    } catch {
      // Use the safe defaults if local template preferences are unreadable.
    }
    setSettingsReady(true);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, settingsReady]);

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => {
    const aTime = Date.parse(String(a?.createdAt || ""));
    const bTime = Date.parse(String(b?.createdAt || ""));
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  }), [orders]);

  const allReadyOrders = useMemo(() => sortedOrders.filter(order => order?.readyToPrint && Number(order?.posStatusCode) === 9), [sortedOrders]);

  const filteredReadyOrders = useMemo(() => allReadyOrders.filter(order => {
    const courier = String(order?.courier || "").toLowerCase();
    if (courierFilter === "jnt") return /j\s*&\s*t|jnt/.test(courier);
    if (courierFilter === "spx") return /spx|shopee/.test(courier);
    return true;
  }), [allReadyOrders, courierFilter]);

  const readyOrders = filteredReadyOrders.slice(0, 50);
  const totalReady = allReadyOrders.length;

  useEffect(() => {
    const eligible = new Set(allReadyOrders.map(order => String(order.id)));
    setSelectedPrintIds(current => current.filter(orderId => eligible.has(orderId)).slice(0, 50));
  }, [allReadyOrders]);

  const updateSetting = <K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }));
  };

  const loadWaybill = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    setOfficialUrls([]);
    try {
      const response = await fetch(`/api/vision-x-saha/waybill?orderId=${encodeURIComponent(selectedId)}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return; }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Waybill data could not be loaded.");
      setWaybill(body.waybill);
      setIsSample(false);
    } catch (loadError) {
      setWaybill(null);
      setError(loadError instanceof Error ? loadError.message : "Waybill data could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const requestOfficialLabels = async (orderIds: string[]) => {
    const response = await fetch("/api/vision-x-saha/waybill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderIds })
    });
    if (response.status === 401) { window.location.href = "/vision-x-saha/login"; return []; }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The official label could not be prepared.");
    return Array.isArray(body.urls) ? body.urls as string[] : [];
  };

  const openOfficialLabel = async () => {
    if (!waybill || isSample) return;
    setOfficialLoading(true);
    setError("");
    try {
      const urls = await requestOfficialLabels([waybill.orderId]);
      setOfficialUrls(urls);
      if (urls[0]) window.open(urls[0], "_blank", "noopener,noreferrer");
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : "The official label could not be prepared.");
    } finally {
      setOfficialLoading(false);
    }
  };

  const printSelectedLabels = async () => {
    if (!selectedPrintIds.length) return;
    setBulkLoading(true);
    setBulkUrls([]);
    setError("");
    try {
      const urls = await requestOfficialLabels(selectedPrintIds);
      setBulkUrls(urls);
      if (urls[0]) window.open(urls[0], "_blank", "noopener,noreferrer");
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : "The bulk labels could not be prepared.");
    } finally {
      setBulkLoading(false);
    }
  };

  const togglePrintOrder = (orderId: string) => {
    setSelectedPrintIds(current => current.includes(orderId)
      ? current.filter(value => value !== orderId)
      : [...current, orderId].slice(0, 50));
  };

  const previewSample = () => {
    setSelectedId("");
    setWaybill(SAMPLE_WAYBILL);
    setIsSample(true);
    setOfficialUrls([]);
    setError("");
  };

  const printCustomWaybill = () => {
    if (!waybill) return;
    const cleanup = () => document.body.classList.remove("vxs-waybill-print-mode");
    document.body.classList.add("vxs-waybill-print-mode");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  };

  const sender = {
    name: settings.senderName || waybill?.sender.name || "VISION X SAHA",
    phone: settings.senderPhone || waybill?.sender.phone || "",
    address: settings.senderAddress || waybill?.sender.address || ""
  };
  const allVisibleSelected = readyOrders.length > 0 && readyOrders.every(order => selectedPrintIds.includes(String(order.id)));

  return <>
    <header className="vxs-section-header">
      <div><p>Pancake POS print workspace</p><h2>Print Center</h2><span>Load one live order, preview your template, then print a custom waybill or open the official carrier label.</span></div>
      <div className="vxs-header-actions"><button className="vxs-secondary" onClick={previewSample}>Preview sample</button><button className="vxs-secondary" onClick={printCustomWaybill} disabled={!waybill}>Print custom waybill</button><button className="vxs-primary" onClick={openOfficialLabel} disabled={!waybill || isSample || officialLoading}>{officialLoading ? "Preparing label" : "Open official label"}</button></div>
    </header>

    <section className="vxs-card vxs-waybill-bulk">
      <div className="vxs-card-head"><div><p>Pending shipment</p><h3>{filteredReadyOrders.length} order{filteredReadyOrders.length === 1 ? "" : "s"} in this filter</h3><span>{totalReady} total ready. Only Pancake status ID 9 with a courier tracking number and zero recorded prints appears here.</span></div><span className="vxs-badge good">J&amp;T + SPX</span></div>
      <div className="vxs-waybill-bulk-toolbar"><div className="vxs-filters">{[["all", "All couriers"], ["jnt", "J&T"], ["spx", "SPX"]].map(([value, text]) => <button key={value} className={courierFilter === value ? "active" : ""} onClick={() => setCourierFilter(value as "all" | "jnt" | "spx")}>{text}</button>)}</div><div className="vxs-waybill-bulk-actions"><button className="vxs-secondary" onClick={() => setSelectedPrintIds(allVisibleSelected ? [] : readyOrders.map(order => String(order.id)).slice(0, 50))} disabled={!readyOrders.length}>{allVisibleSelected ? "Clear selection" : "Select visible"}</button><button className="vxs-primary" onClick={printSelectedLabels} disabled={!selectedPrintIds.length || bulkLoading}>{bulkLoading ? "Preparing labels" : `Print ${selectedPrintIds.length} selected`}</button></div></div>
      {readyOrders.length ? <div className="vxs-waybill-queue">{readyOrders.map(order => { const orderId = String(order.id); return <label key={orderId} className={selectedPrintIds.includes(orderId) ? "selected" : ""}><input type="checkbox" checked={selectedPrintIds.includes(orderId)} onChange={() => togglePrintOrder(orderId)} /><span><strong>#{orderId} | {order.customer || "Customer"}</strong><small>{order.courier} | {order.tracking}</small></span><b>{money(Number(order.value || 0))}</b></label>; })}</div> : <div className="vxs-waybill-queue-empty"><strong>No pending shipment orders for this courier.</strong><span>Orders appear after Pancake assigns status ID 9 and a tracking number.</span></div>}
      {filteredReadyOrders.length > 50 ? <p className="vxs-waybill-help">Showing the newest 50 orders for this filter. Print this batch, refresh, then continue with the next batch.</p> : null}
      {bulkUrls.length ? <div className="vxs-waybill-links"><strong>Bulk label file{bulkUrls.length === 1 ? "" : "s"}</strong>{bulkUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Open bulk label {index + 1}</a>)}</div> : null}
    </section>

    <div className="vxs-waybill-workspace">
      <section className="vxs-card vxs-waybill-controls">
        <div className="vxs-card-head"><div><p>Order source</p><h3>Select a Pancake order</h3></div><span className="vxs-badge good">On demand</span></div>
        <label><span>Live order</span><select value={selectedId} onChange={event => { setSelectedId(event.target.value); setWaybill(null); setIsSample(false); setOfficialUrls([]); }}><option value="">Choose an order</option>{sortedOrders.map(order => <option value={String(order.id)} key={String(order.id)}>#{order.id} | {order.customer || "Customer"} | {order.tracking || "No tracking"}</option>)}</select></label>
        <div className="vxs-waybill-source-actions"><button className="vxs-secondary" onClick={previewSample}>Preview sample layout</button><button className="vxs-primary" onClick={loadWaybill} disabled={!selectedId || loading}>{loading ? "Loading from POS" : "Load waybill data"}</button></div>
        <p className="vxs-waybill-help">This fetches one exact order from Pancake. It does not start another polling feed.</p>

        <div className="vxs-waybill-divider" />
        <div className="vxs-card-head"><div><p>Saved in this browser</p><h3>Template settings</h3></div></div>
        <label><span>Paper preset</span><select value={settings.format} onChange={event => updateSetting("format", event.target.value as PaperFormat)}><option value="four-by-six">Waybill 4 x 6 inch</option><option value="thermal-80">Thermal 80 mm</option></select></label>
        <label><span>Header</span><input value={settings.title} maxLength={80} onChange={event => updateSetting("title", event.target.value)} /></label>
        <label><span>Sender name</span><input value={settings.senderName} maxLength={120} placeholder={waybill?.sender.name || "Use POS warehouse name"} onChange={event => updateSetting("senderName", event.target.value)} /></label>
        <label><span>Sender phone</span><input value={settings.senderPhone} maxLength={40} placeholder={waybill?.sender.phone || "Use POS warehouse phone"} onChange={event => updateSetting("senderPhone", event.target.value)} /></label>
        <label><span>Sender address</span><textarea value={settings.senderAddress} maxLength={300} placeholder={waybill?.sender.address || "Use POS warehouse address"} onChange={event => updateSetting("senderAddress", event.target.value)} /></label>
        <label><span>Footer</span><textarea value={settings.footer} maxLength={220} onChange={event => updateSetting("footer", event.target.value)} /></label>
        <div className="vxs-waybill-options"><label><input type="checkbox" checked={settings.showItems} onChange={event => updateSetting("showItems", event.target.checked)} /> Show item list</label><label><input type="checkbox" checked={settings.showPrintNote} onChange={event => updateSetting("showPrintNote", event.target.checked)} /> Show print note</label></div>
        {error ? <div className="vxs-waybill-error"><strong>Print Center error</strong><span>{error}</span></div> : null}
        {officialUrls.length ? <div className="vxs-waybill-links"><strong>Official Pancake label</strong>{officialUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Open label {index + 1}</a>)}</div> : null}
      </section>

      <section className="vxs-waybill-preview-shell">
        <div className="vxs-waybill-preview-head"><div><p>Print preview</p><h3>{settings.format === "four-by-six" ? "4 x 6 inch waybill" : "80 mm thermal waybill"}</h3></div><span>{isSample ? "Fictional sample data" : waybill ? `Order #${waybill.orderId}` : "No order loaded"}</span></div>
        {waybill ? <article className={`vxs-waybill-print ${settings.format}`}>
          <header className="vxs-waybill-brand"><div><strong>{settings.title || "VISION X SAHA"}</strong><span>CUSTOM WAYBILL</span></div><div><b>{waybill.courier}</b><small>{waybill.service || "Delivery service"}</small></div></header>
          <section className="vxs-waybill-routing"><div><span>TRACKING NUMBER</span><strong>{waybill.tracking || "PENDING"}</strong></div>{waybill.sortCode ? <b>{waybill.sortCode}</b> : null}</section>
          <section className="vxs-waybill-party"><span>SHIP TO</span><strong>{waybill.recipient.name}</strong><b>{waybill.recipient.phone || "No phone recorded"}</b><p>{waybill.recipient.address || "No shipping address recorded"}</p></section>
          <section className="vxs-waybill-party compact"><span>FROM</span><strong>{sender.name}</strong>{sender.phone ? <b>{sender.phone}</b> : null}{sender.address ? <p>{sender.address}</p> : null}</section>
          {settings.showItems ? <section className="vxs-waybill-items"><div className="vxs-waybill-row head"><span>ITEM</span><span>QTY</span></div>{waybill.items.map((item, index) => <div className="vxs-waybill-row" key={`${item.sku}-${index}`}><span><strong>{item.name}</strong>{item.sku ? <small>{item.sku}</small> : null}{item.note ? <small>{item.note}</small> : null}</span><b>{item.quantity}</b></div>)}</section> : null}
          <section className="vxs-waybill-cod"><div><span>COLLECT ON DELIVERY</span><strong>{money(waybill.cod)}</strong></div><div><span>TOTAL PIECES</span><strong>{waybill.totalQuantity}</strong></div></section>
          {settings.showPrintNote && waybill.printNote ? <section className="vxs-waybill-note"><span>DELIVERY NOTE</span><strong>{waybill.printNote}</strong></section> : null}
          <footer><div><span>Order #{waybill.orderId}</span><span>{date(waybill.createdAt)}</span></div><strong>{settings.footer}</strong></footer>
        </article> : <div className="vxs-waybill-empty"><strong>Select and load an order</strong><span>The preview will use current customer, shipping, item, COD, and courier data from Pancake POS.</span></div>}
      </section>
    </div>
  </>;
}
