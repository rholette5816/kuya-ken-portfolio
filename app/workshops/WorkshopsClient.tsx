"use client";

import { useState } from "react";
import WorkshopBookingModal from "../components/WorkshopBookingModal";

const sessions = [
  {
    time: "8:00 AM — 12:00 NN",
    label: "Meta Ads Deep Dive",
    accent: "blue",
    items: ["Campaign Structure", "Targeting Strategy", "Scaling Techniques"],
  },
  {
    time: "1:00 PM — 5:00 PM",
    label: "AI Creatives Generation",
    accent: "amber",
    items: ["Scroll-Stopping Creatives", "AI Prompting System", "High-Converting Ad Designs"],
  },
];

const speakers = [
  {
    name: "Kevin Allego",
    title: "Funnel & Technical Strategist",
    accent: "blue",
  },
  {
    name: "Joven Sepe",
    title: "Digital Marketing Strategist",
    accent: "amber",
  },
];

const dates = [
  { city: "Cebu", date: "June 13", accent: "blue" },
  { city: "Iloilo", date: "June 19", accent: "mint" },
  { city: "Bacolod", date: "June 21", accent: "amber" },
];

const painPoints = [
  "Spending on ads but not seeing real results",
  "Creatives that look generic and don't stop the scroll",
  "No clear system for targeting the right buyers",
];

export default function WorkshopsClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultCity, setDefaultCity] = useState("");

  function openModal(city = "") {
    setDefaultCity(city);
    setModalOpen(true);
  }

  return (
    <>
      <div className="ws-page">
        {/* Minimal header */}
        <header className="ws-header">
          <div className="ws-header-inner">
            <div className="ws-org-strip">
              <span>The Digital Starting Point</span>
              <span className="ws-org-dot">×</span>
              <span>JBI Community</span>
            </div>
          </div>
        </header>

        <main className="ws-main">
          {/* Hero */}
          <section className="ws-hero">
            <p className="eyebrow">Meta & AI Intensive Workshop</p>
            <h1 className="ws-h1">
              Learn Meta Ads and AI Creatives<br className="ws-br" /> in One Day
            </h1>
            <p className="ws-hero-sub">
              A full-day hands-on workshop for business owners who want to run ads that convert, creatives that stop the scroll, and a system that scales.
            </p>
            <div className="ws-date-pills">
              {dates.map((d) => (
                <span key={d.city} className={`ws-date-pill accent-${d.accent}`}>
                  {d.city} — {d.date}
                </span>
              ))}
            </div>
            <div className="ws-hero-cta">
              <button className="btn primary" onClick={() => openModal()}>
                Reserve Your Seat
              </button>
              <span className="ws-price-inline">₱1,999 · Full-Day Access</span>
            </div>
            <p className="ws-trusted">Trusted by Business Owners & Marketers Nationwide</p>
          </section>

          {/* Who this is for */}
          <section className="ws-section">
            <p className="eyebrow">Who This Is For</p>
            <h2 className="ws-h2">Built for business owners who are ready to stop guessing.</h2>
            <div className="ws-pain-grid">
              {painPoints.map((point) => (
                <div key={point} className="ws-pain-card">
                  <span className="ws-pain-x">✕</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>
            <p className="ws-for-note">
              If any of these sound familiar, this workshop is your next move.
            </p>
          </section>

          {/* Sessions */}
          <section className="ws-section">
            <p className="eyebrow">What You Will Learn</p>
            <h2 className="ws-h2">Two sessions. Eight hours. One complete system.</h2>
            <div className="ws-sessions">
              {sessions.map((s) => (
                <div key={s.label} className={`ws-session accent-${s.accent}`}>
                  <p className="ws-session-time">{s.time}</p>
                  <h3 className="ws-session-title">{s.label}</h3>
                  <ul className="ws-session-list">
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Speakers */}
          <section className="ws-section">
            <p className="eyebrow">Your Speakers</p>
            <h2 className="ws-h2">Learn from people who run this every day.</h2>
            <div className="ws-speakers">
              {speakers.map((s) => (
                <div key={s.name} className={`ws-speaker accent-${s.accent}`}>
                  <div className="ws-speaker-avatar" aria-hidden="true">
                    {s.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <strong className="ws-speaker-name">{s.name}</strong>
                    <span className="ws-speaker-title">{s.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Dates & Booking */}
          <section className="ws-section ws-dates-section">
            <p className="eyebrow">3 Cities. Choose Your Date.</p>
            <h2 className="ws-h2">Pick the city nearest you and lock in your slot.</h2>
            <div className="ws-date-cards">
              {dates.map((d) => (
                <div key={d.city} className={`ws-date-card accent-${d.accent}`}>
                  <p className="ws-date-card-city">{d.city}</p>
                  <p className="ws-date-card-date">{d.date}</p>
                  <button
                    className="btn primary ws-date-btn"
                    onClick={() => openModal(d.city)}
                  >
                    Reserve Slot
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Price & Includes */}
          <section className="ws-section ws-price-section">
            <div className="ws-price-box">
              <p className="eyebrow">Investment</p>
              <p className="ws-price-amount">₱1,999</p>
              <p className="ws-price-label">Full-Day Access</p>
              <ul className="ws-price-includes">
                <li>AM Snacks included</li>
                <li>Lunch included</li>
                <li>Full-day hands-on training</li>
                <li>Meta Ads + AI Creatives both sessions</li>
              </ul>
              <p className="ws-price-urgency">Deadline Slots — Limited seats per city.</p>
              <button className="btn primary ws-price-cta" onClick={() => openModal()}>
                Reserve Your Seat Now
              </button>
            </div>
          </section>
        </main>

        <footer className="ws-footer">
          <p>Meta & AI Intensive Workshop · The Digital Starting Point × JBI Community</p>
          <p>Questions? Message us on <a href="https://m.me/kuyaken" target="_blank" rel="noopener noreferrer">Messenger</a>.</p>
        </footer>
      </div>

      <WorkshopBookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCity={defaultCity}
      />
    </>
  );
}
