"use client";

import { useState, useEffect } from "react";

type Props = {
  onBook: () => void;
};

export default function WorkshopStickyBar({ onBook }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`ws-sticky-bar${show ? " ws-sticky-bar-show" : ""}`}>
      <div className="ws-sticky-inner">
        <div className="ws-sticky-copy">
          <span className="ws-sticky-slots">Only 3 slots left per city</span>
          <span className="ws-sticky-price">₱1,999 · Full-Day Access</span>
        </div>
        <button className="btn primary ws-sticky-btn" onClick={onBook}>
          Reserve Now
        </button>
      </div>
    </div>
  );
}
