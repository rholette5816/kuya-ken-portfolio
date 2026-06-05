import type { Metadata } from "next";
import WorkshopsClient from "./WorkshopsClient";

export const metadata: Metadata = {
  title: "Meta & AI Intensive Workshop — Cebu, Iloilo, Bacolod",
  description:
    "A full-day hands-on workshop for business owners. Learn Meta Ads and AI Creatives in one day. Cebu June 13, Iloilo June 19, Bacolod June 21. Only ₱1,999.",
};

export default function WorkshopsPage() {
  return <WorkshopsClient />;
}
