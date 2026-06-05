"use client";

import { useState, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCity?: string;
};

type Step = "form" | "payment";

export default function WorkshopBookingModal({ open, onClose, defaultCity = "" }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("form");
        setName(""); setEmail(""); setPhone(""); setCity(defaultCity);
        setStatus("idle"); setErrorMsg("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, defaultCity]);

  useEffect(() => {
    setCity(defaultCity);
  }, [defaultCity]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const cityDates: Record<string, string> = {
    Cebu: "June 13",
    Iloilo: "June 19",
    Bacolod: "June 21",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !phone || !city) return;
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/workshop-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, city }),
    });

    if (res.ok) {
      setStep("payment");
      setStatus("idle");
    } else {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <div className={`wb-backdrop${open ? " wb-open" : ""}`} onClick={onClose}>
      <div className={`wb-modal${open ? " wb-modal-open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="audit-close" onClick={onClose} aria-label="Close">✕</button>

        {step === "form" ? (
          <>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Meta & AI Intensive Workshop</p>
            <h2 className="wb-modal-title">Reserve Your Seat</h2>
            <p className="wb-modal-sub">Fill in your details and we will send your slot confirmation.</p>

            <form className="wb-form" onSubmit={handleSubmit}>
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="Juan dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={status === "loading"}
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="juan@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "loading"}
                />
              </label>
              <label>
                Phone / Mobile
                <input
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={status === "loading"}
                />
              </label>
              <label>
                Which city?
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  disabled={status === "loading"}
                >
                  <option value="" disabled>Select a city</option>
                  <option value="Cebu">Cebu — June 13</option>
                  <option value="Iloilo">Iloilo — June 19</option>
                  <option value="Bacolod">Bacolod — June 21</option>
                </select>
              </label>

              {status === "error" && (
                <p className="audit-error">{errorMsg}</p>
              )}

              <button
                type="submit"
                className="btn primary wb-submit"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Reserving..." : "Reserve My Seat"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="wb-success-icon">✓</div>
            <h2 className="wb-modal-title">You&apos;re almost in!</h2>
            <p className="wb-modal-sub">
              Slot reserved for <strong style={{ color: "var(--soft)" }}>{city} — {cityDates[city]}</strong>.
              Secure it with a downpayment of:
            </p>

            <div className="wb-gcash-box">
              <p className="wb-gcash-amount">₱999</p>
              <p className="wb-gcash-label">Downpayment via GCash</p>
              <div className="wb-gcash-details">
                <span className="wb-gcash-number">GCash: <strong>09XX-XXX-XXXX</strong></span>
                <span className="wb-gcash-name">Account Name: <strong>Kevin R. Allego</strong></span>
              </div>
            </div>

            <p className="wb-payment-note">
              After paying, send your GCash screenshot to confirm your slot. Remaining balance of <strong style={{ color: "var(--soft)" }}>₱1,000</strong> is due on event day.
            </p>

            <a
              href="https://m.me/kuyaken"
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary wb-submit"
            >
              Send Screenshot via Messenger
            </a>

            <p className="wb-note">Full-day access includes AM snacks and lunch.</p>
          </>
        )}
      </div>
    </div>
  );
}
