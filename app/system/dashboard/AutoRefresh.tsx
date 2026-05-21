"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 30000;

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  return <p className="crm-refresh-note">Auto-refresh: every 30 seconds</p>;
}
