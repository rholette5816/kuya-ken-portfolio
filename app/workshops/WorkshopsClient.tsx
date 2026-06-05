"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import WorkshopBookingModal from "../components/WorkshopBookingModal";
import WorkshopNotifications from "../components/WorkshopNotifications";
import WorkshopCountdown from "../components/WorkshopCountdown";
import WorkshopStickyBar from "../components/WorkshopStickyBar";

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
    image: "/assets/speaker-kevin.jpg",
    proof: "Managed $4M+ in ad spend across 429+ campaigns",
  },
  {
    name: "Joven Sepe",
    title: "Digital Marketing Strategist",
    accent: "amber",
    image: "/assets/speaker-joven.png",
    proof: "Trusted by business owners & marketers nationwide",
  },
];

const dates = [
  { city: "Cebu", date: "June 13", accent: "blue", target: "2026-06-13", slots: 3 },
  { city: "Iloilo", date: "June 19", accent: "mint", target: "2026-06-19", slots: 3 },
  { city: "Bacolod", date: "June 21", accent: "amber", target: "2026-06-21", slots: 3 },
];

const painPoints = [
  "Spending on ads but not seeing real results",
  "Creatives that look generic and don't stop the scroll",
  "No clear system for targeting the right buyers",
];

const faqs = [
  { q: "Is this for beginners?", a: "Yes. Whether you have zero experience or have been running ads for a while, the workshop is structured so you walk out with a working system — not just theory." },
  { q: "Do I need to bring a laptop?", a: "Yes. This is a hands-on workshop. Bring your laptop so you can apply what you learn in real time." },
  { q: "What if I can't attend the full day?", a: "We recommend attending the full day. Both sessions build on each other — Meta Ads in the morning, AI Creatives in the afternoon. Missing one weakens the other." },
  { q: "Will there be recordings?", a: "No recordings will be released. The live workshop format is intentional — you get direct access to the speakers and real-time Q&A." },
  { q: "Is the ₱999 downpayment refundable?", a: "Slots are transferable but non-refundable. If you can't make it, you can transfer your slot to someone else." },
  { q: "What's included in the ₱1,999?", a: "Full-day access, AM snacks, and lunch. Everything you need for the day is covered." },
];

export default function WorkshopsClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultCity, setDefaultCity] = useState("");
  const scrollTriggered = useRef(false);

  function openModal(city = "") {
    setDefaultCity(city);
    setModalOpen(true);
  }

  useEffect(() => {
    const onScroll = () => {
      if (scrollTriggered.current) return;
      const scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrolled > 0.65) {
        scrollTriggered.current = true;
        setModalOpen(true);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="ws-page">
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
              Stop Guessing.<br />Start Scaling.
            </h1>
            <p className="ws-hero-sub">
              A full-day hands-on workshop for business owners who want to run ads that convert, creatives that stop the scroll, and a system built to scale.
            </p>
            <div className="ws-date-pills">
              {dates.map((d) => (
                <span key={d.city} className={`ws-date-pill accent-${d.accent}`}>
                  {d.city} — {d.date}
                </span>
              ))}
            </div>

            {/* Poster image */}
            <div className="ws-poster">
              <Image
                src="/assets/workshop-poster.jpg"
                alt="Meta & AI Intensive Workshop"
                width={480}
                height={600}
                className="ws-poster-img"
                priority
              />
            </div>

            <div className="ws-hero-cta">
              <button className="btn primary" onClick={() => openModal()}>
                Reserve Your Seat
              </button>
              <div className="ws-price-hint">
                <span className="ws-price-was">₱3,500</span>
                <span className="ws-price-now">₱1,999</span>
                <span className="ws-price-tag">Early Bird</span>
              </div>
            </div>
            <p className="ws-slots-hero">17 out of 20 slots filled across all cities — 3 left per city</p>
            <p className="ws-trusted">Trusted by Business Owners & Marketers Nationwide</p>
          </section>

          {/* Countdown per city */}
          <section className="ws-section ws-countdown-section">
            <p className="eyebrow">Time is Running Out</p>
            <h2 className="ws-h2">Events are filling up fast. Pick your city.</h2>
            <div className="ws-countdown-grid">
              {dates.map((d) => (
                <div key={d.city} className={`ws-countdown-card accent-${d.accent}`}>
                  <div className="ws-countdown-card-head">
                    <p className="ws-countdown-city">{d.city}</p>
                    <p className="ws-countdown-date">{d.date}</p>
                    <p className="ws-countdown-slots">{d.slots} slots left</p>
                  </div>
                  <WorkshopCountdown targetDate={d.target} />
                  <button className="btn primary ws-date-btn" onClick={() => openModal(d.city)}>
                    Reserve Slot
                  </button>
                </div>
              ))}
            </div>
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
                <div key={s.name} className={`ws-speaker-card accent-${s.accent}`}>
                  <div className="ws-speaker-photo-wrap">
                    <Image
                      src={s.image}
                      alt={s.name}
                      width={120}
                      height={120}
                      className="ws-speaker-photo"
                    />
                  </div>
                  <strong className="ws-speaker-name">{s.name}</strong>
                  <span className="ws-speaker-title">{s.title}</span>
                  <p className="ws-speaker-proof">{s.proof}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Price */}
          <section className="ws-section ws-price-section">
            <div className="ws-price-box">
              <p className="eyebrow">Investment</p>
              <div className="ws-price-row">
                <span className="ws-price-crossed">₱3,500</span>
                <span className="ws-price-amount">₱1,999</span>
              </div>
              <p className="ws-price-label">Full-Day Access · Early Bird Price</p>
              <ul className="ws-price-includes">
                <li>AM Snacks included</li>
                <li>Lunch included</li>
                <li>Full-day hands-on training</li>
                <li>Meta Ads + AI Creatives both sessions</li>
                <li>Direct Q&A with both speakers</li>
              </ul>
              <p className="ws-price-urgency">Only 3 slots left per city. Price goes up when seats run out.</p>
              <button className="btn primary ws-price-cta" onClick={() => openModal()}>
                Reserve Your Seat Now
              </button>
              <p className="ws-price-sub">₱999 downpayment via GCash. Balance on event day.</p>
            </div>
          </section>

          {/* FAQ */}
          <section className="ws-section ws-faq-section">
            <p className="eyebrow">FAQ</p>
            <h2 className="ws-h2">Questions we get asked before every event.</h2>
            <div className="ws-faq-grid">
              {faqs.map((faq) => (
                <div key={faq.q} className="ws-faq-item">
                  <h3 className="ws-faq-q">{faq.q}</h3>
                  <p className="ws-faq-a">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="ws-section ws-final-section">
            <p className="eyebrow">Last Call</p>
            <h2 className="ws-h2">3 slots left. Don&apos;t let someone else take yours.</h2>
            <p className="ws-final-sub">This is the only workshop in Visayas teaching Meta Ads and AI Creatives together in one day.</p>
            <button className="btn primary ws-final-btn" onClick={() => openModal()}>
              Reserve My Seat Now
            </button>
            <p className="ws-final-note">₱999 downpayment secures your slot. Balance of ₱1,000 on event day.</p>
          </section>
        </main>

        <footer className="ws-footer">
          <p>Meta & AI Intensive Workshop · The Digital Starting Point × JBI Community</p>
          <p>Questions? Message us on <a href="https://www.facebook.com/bstamagadshilas" target="_blank" rel="noopener noreferrer">Messenger</a>.</p>
        </footer>
      </div>

      <WorkshopStickyBar onBook={() => openModal()} />
      <WorkshopNotifications />
      <WorkshopBookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCity={defaultCity}
      />
    </>
  );
}
