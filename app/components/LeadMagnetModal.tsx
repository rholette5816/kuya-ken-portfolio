"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LeadMagnetModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEmail("");
        setStatus("idle");
      }, 300);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (res.ok) {
      setStatus("done");
      setTimeout(() => onClose(), 2500);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className={`lm-backdrop${open ? " lm-backdrop-open" : ""}`} onClick={onClose}>
      <div className={`lm-modal${open ? " lm-modal-open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="lm-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="lm-hero-image">
          <Image
            src="/assets/ads-hack-guide-cover.png"
            alt="My Ads Hack from Idea to Profit — Free PDF"
            width={380}
            height={220}
            className="lm-hero-img"
            priority
          />
        </div>
        <div className="lm-pdf-badge">FREE PDF</div>
        <h2 className="lm-title">My Ads Hack from Idea to Profit</h2>
        <p className="lm-sub">
          Free guide for Philippine business owners. Enter your email and get it instantly.
        </p>

        {status === "done" ? (
          <div className="lm-success">
            <span className="lm-success-icon">✓</span>
            <p>Check your email for the download link!</p>
          </div>
        ) : (
          <form className="lm-form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="lead-magnet-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "loading"}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary lm-submit-btn"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Sending..." : "Send Me the Guide"}
            </button>
            {status === "error" && (
              <p className="lead-magnet-error">Something went wrong. Try again.</p>
            )}
          </form>
        )}

        <p className="lm-note">No spam. Just the guide.</p>
      </div>
    </div>
  );
}
