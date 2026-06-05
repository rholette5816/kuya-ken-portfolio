"use client";

import { useState, useEffect } from "react";

type Props = {
  targetDate: string; // "2026-06-13"
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calc(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function WorkshopCountdown({ targetDate }: Props) {
  const [time, setTime] = useState<TimeLeft>(calc(targetDate));

  useEffect(() => {
    const t = setInterval(() => setTime(calc(targetDate)), 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="ws-countdown">
      <p className="ws-countdown-label">Event starts in</p>
      <div className="ws-countdown-units">
        {[
          { val: time.days, unit: "Days" },
          { val: time.hours, unit: "Hours" },
          { val: time.minutes, unit: "Mins" },
          { val: time.seconds, unit: "Secs" },
        ].map(({ val, unit }) => (
          <div key={unit} className="ws-countdown-unit">
            <span className="ws-countdown-num">{pad(val)}</span>
            <span className="ws-countdown-unit-label">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
