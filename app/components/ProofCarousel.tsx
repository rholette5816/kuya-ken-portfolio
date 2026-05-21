"use client";

import { useEffect, useRef, useState } from "react";
import type { ProofCard } from "../data";
import ScreenshotLightbox from "./ScreenshotLightbox";

export default function ProofCarousel({ items }: { items: ProofCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const cardWidth = track.firstElementChild?.clientWidth ?? 0;
      const index = Math.round(track.scrollLeft / (cardWidth + 16));
      setActive(Math.min(index, items.length - 1));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const scroll = (dir: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.firstElementChild?.clientWidth ?? 0;
    track.scrollBy({ left: dir === "right" ? cardWidth + 16 : -(cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="proof-carousel-wrap">
      <div className="proof-carousel-track" ref={trackRef}>
        {items.map((card) => (
          <div key={card.headline + card.tag} className="proof-stat-card">
            {card.image && (
              <button
                type="button"
                className="proof-thumb-btn"
                onClick={() => {
                  setLightboxSrc(card.image!);
                  setLightboxAlt(`${card.tag} ads manager result`);
                }}
                aria-label={`View ${card.tag} screenshot`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={`${card.tag} ads manager result`}
                  className="proof-thumb"
                  loading="lazy"
                />
                <span className="proof-thumb-overlay">View Screenshot</span>
              </button>
            )}
            <p className="proof-card-tag">{card.tag}</p>
            <div className="proof-card-hero">
              <span className="proof-card-headline">{card.headline}</span>
              <span className="proof-card-subline">{card.subline}</span>
            </div>
            <div className="proof-card-stats">
              {card.stats.map(([value, label]) => (
                <article key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </article>
              ))}
            </div>
            <p className="proof-card-context">{card.context}</p>
          </div>
        ))}
      </div>
      {lightboxSrc && (
        <ScreenshotLightbox
          src={lightboxSrc}
          alt={lightboxAlt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
      <div className="proof-arrows">
        <button
          className={`proof-arrow proof-arrow-left${active === 0 ? " hidden" : ""}`}
          onClick={() => scroll("left")}
          aria-label="Previous"
        >
          &#8592;
        </button>
        <div className="proof-dots">
          {items.map((_, i) => (
            <span key={i} className={`proof-dot${active === i ? " active" : ""}`} />
          ))}
        </div>
        <button
          className={`proof-arrow proof-arrow-right${active === items.length - 1 ? " hidden" : ""}`}
          onClick={() => scroll("right")}
          aria-label="Next"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
