"use client";

import { useState } from "react";
import LeadMagnetModal from "./LeadMagnetModal";

export default function LeadMagnetBox() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lead-magnet-box">
        <div className="lead-magnet-icon">📥</div>
        <p className="lead-magnet-headline">Get the Free Negosyo Starter Guide</p>
        <p className="lead-magnet-sub">
          A practical guide for Philippine business owners. Free download, no catch.
        </p>
        <button className="btn-primary lead-magnet-btn" onClick={() => setOpen(true)}>
          Download Free Guide
        </button>
      </div>
      <LeadMagnetModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
