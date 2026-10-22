import type { Metadata } from "next";
import VisionSahaClient from "./VisionSahaClient";

export const metadata: Metadata = {
  title: "VISION X SAHA Business Command Center",
  robots: { index: false, follow: false, noarchive: true }
};

export default function VisionSahaPage() {
  return <VisionSahaClient />;
}
