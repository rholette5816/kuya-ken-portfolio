"use client";

import { useState, useEffect } from "react";

const notifications = [
  { name: "Juan R.", city: "Cebu", industry: "Retail Store Owner", time: "2 mins ago" },
  { name: "Maria S.", city: "Bacolod", industry: "Online Seller", time: "5 mins ago" },
  { name: "Carlo M.", city: "Iloilo", industry: "Food Business Owner", time: "8 mins ago" },
  { name: "Ana P.", city: "Cebu", industry: "Clothing Brand", time: "11 mins ago" },
  { name: "Rico T.", city: "Bacolod", industry: "Salon Owner", time: "3 mins ago" },
  { name: "Liza G.", city: "Iloilo", industry: "Freelancer", time: "14 mins ago" },
  { name: "Mark D.", city: "Cebu", industry: "Dropshipper", time: "6 mins ago" },
  { name: "Joy B.", city: "Bacolod", industry: "Skincare Brand", time: "9 mins ago" },
  { name: "Kevin L.", city: "Iloilo", industry: "Restaurant Owner", time: "1 min ago" },
  { name: "Sheila N.", city: "Cebu", industry: "Travel Agency", time: "17 mins ago" },
  { name: "Nico F.", city: "Bacolod", industry: "Construction Supplier", time: "4 mins ago" },
  { name: "Grace V.", city: "Iloilo", industry: "Virtual Assistant", time: "12 mins ago" },
];

export default function WorkshopNotifications() {
  const [current, setCurrent] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const show = () => {
      setIndex((i) => (i + 1) % notifications.length);
      setCurrent(index);
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    };

    const delay = Math.random() * 4000 + 6000;
    const timer = setTimeout(() => {
      show();
      const interval = setInterval(show, Math.random() * 20000 + 25000);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  const notif = notifications[current ?? 0];

  return (
    <div className={`ws-notif${visible ? " ws-notif-show" : ""}`} aria-live="polite">
      <div className="ws-notif-icon">🎉</div>
      <div className="ws-notif-body">
        <p className="ws-notif-name">{notif.name} · {notif.industry}</p>
        <p className="ws-notif-detail">Just reserved a slot in {notif.city}</p>
        <p className="ws-notif-time">{notif.time}</p>
      </div>
    </div>
  );
}
