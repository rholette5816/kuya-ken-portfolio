import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "./data";
import Analytics from "./components/Analytics";
import AuditModalProvider from "./components/AuditModalProvider";

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: {
    default: site.title,
    template: "%s | Kuya Ken"
  },
  description: site.description,
  keywords: [
    "Kuya Ken",
    "Kevin Rholette Allego",
    "Kevin Rholette Tajale Allego",
    "full funnel builder Philippines",
    "Meta Ads specialist Philippines",
    "AI business systems builder Philippines",
    "POS system developer",
    "SaaS developer Philippines",
    "business automation developer",
    "Meta Ads strategist",
    "paid media Philippines",
    "ecommerce Meta Ads Philippines",
    "AI reports",
    "web app developer Philippines",
    "Hinilas Pro",
    "Saiko Ramen and Sushi",
    "KRA Digitals",
    "manual business automation"
  ],
  authors: [{ name: site.fullName }],
  creator: site.fullName,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: site.domain,
    siteName: site.name,
    title: "Kuya Ken - Kevin Rholette Allego | AI Business Systems Builder",
    description: site.description,
    images: [
      {
        url: `${site.socialImage}?v=20260428`,
        width: 1672,
        height: 941,
        alt: "Kuya Ken AI business systems banner for Kevin Rholette Allego"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Kuya Ken - Kevin Rholette Allego | AI Business Systems Builder",
    description: site.description,
    images: [`${site.socialImage}?v=20260428`]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large"
    }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f17"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${site.domain}/#business`,
    name: site.name,
    alternateName: [site.fullName, "Kevin Rholette Tajale Allego", "KRA Digitals"],
    url: site.domain,
    image: `${site.domain}${site.socialImage}?v=20260428`,
    description: site.description,
    sameAs: [
      "https://www.linkedin.com/in/kevinrholette",
      "https://www.facebook.com/kuyaken",
      "https://www.hinilas.pro"
    ],
    founder: {
      "@type": "Person",
      "@id": `${site.domain}/#kevin-rholette-allego`,
      name: site.fullName,
      alternateName: ["Kuya Ken", "Kevin Rholette Tajale Allego"],
      jobTitle: "Full Funnel Builder — Meta Ads and AI Business Systems",
      knowsAbout: [
        "Meta Ads",
        "Paid media strategy",
        "Full funnel marketing",
        "Manual business automation",
        "POS systems",
        "SaaS platform development",
        "Dashboard development",
        "AI business reports",
        "Restaurant systems",
        "Business operations platforms",
        "eCommerce Philippines"
      ],
      sameAs: [
        "https://www.linkedin.com/in/kevinrholette",
        "https://www.facebook.com/kuyaken"
      ]
    },
    areaServed: ["Philippines", "International"],
    serviceType: [
      "Meta Ads management",
      "Paid media strategy",
      "Full funnel building",
      "AI business systems",
      "POS system development",
      "SaaS platform development",
      "Web app development",
      "Business automation",
      "Dashboard development",
      "AI reporting"
    ]
  };

  return (
    <html lang="en">
      <body>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="ambient-grid" aria-hidden="true" />
        <AuditModalProvider>{children}</AuditModalProvider>
      </body>
    </html>
  );
}
