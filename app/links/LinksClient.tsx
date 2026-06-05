"use client";

import { useState } from "react";
import Link from "next/link";
import LeadMagnetModal from "@/app/components/LeadMagnetModal";
import type { PostMeta } from "@/lib/blog";

const links = [
  {
    label: "Portfolio — kradigital.site",
    href: "https://www.kradigital.site",
    icon: "🌐",
    external: false
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/bstamagadshilas",
    icon: "📘",
    external: true
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/kuyaken_ads/",
    icon: "📸",
    external: true
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@bastamagadshilas",
    icon: "🎵",
    external: true
  },
  {
    label: "Threads",
    href: "https://www.threads.com/@bastamagadshilas",
    icon: "🧵",
    external: true
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@bastamagadshilas",
    icon: "▶️",
    external: true
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/bstamagadshilas",
    icon: "✖️",
    external: true
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/bastamagadshilas/",
    icon: "💼",
    external: true
  }
];

export default function LinksClient({ posts }: { posts: PostMeta[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <main className="links-page">
        <div className="links-card">

          <div className="links-avatar-wrap">
            <div className="links-avatar-ring" />
            <video
              src="/assets/ken-portrait.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="links-avatar-video"
            />
          </div>

          <h1 className="links-name">Kuya Ken</h1>
          <p className="links-title">Full Funnel Builder — Meta Ads, AI Systems & Automation</p>
          <p className="links-location">📍 Cebu, Philippines</p>

          <p className="links-oneliner">
            I build the full funnel. The ads that bring traffic. The systems that close and retain.
          </p>

          <div className="links-list">
            {/* 1. PDF */}
            <button
              className="links-item links-item-pdf"
              onClick={() => setModalOpen(true)}
            >
              <span className="links-item-icon">📥</span>
              <span className="links-item-label">My Ads Hack from Idea to Profit — FREE PDF</span>
              <span className="links-item-arrow">→</span>
            </button>

            {/* 2. Hinilas Pro */}
            <a
              href="https://www.hinilas.pro/"
              target="_blank"
              rel="noopener noreferrer"
              className="links-item links-item-highlight"
            >
              <span className="links-item-icon">⚡</span>
              <span className="links-item-label">Hinilas Pro — My AI Meta Ads Assistant to Laser Focus Creatives & Targeting</span>
              <span className="links-item-arrow">→</span>
            </a>

            {/* 3. Ecom Partner */}
            <a
              href="https://www.kradigital.site/winningprod"
              className="links-item links-item-ecom"
            >
              <span className="links-item-icon">🤝</span>
              <span className="links-item-label">Be My Ecom Partner with this Product</span>
              <span className="links-item-arrow">→</span>
            </a>

            {/* 4. Socials */}
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : "_self"}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="links-item"
              >
                <span className="links-item-icon">{link.icon}</span>
                <span className="links-item-label">{link.label}</span>
                <span className="links-item-arrow">→</span>
              </a>
            ))}

            {/* 5. Audit — last */}
            <a
              href="https://www.kradigital.site/#audit"
              className="links-item links-item-audit"
            >
              <span className="links-item-icon">📋</span>
              <span className="links-item-label">Book a Free Funnel Audit</span>
              <span className="links-item-arrow">→</span>
            </a>
          </div>

          {posts.length > 0 && (
            <div className="links-blog-section">
              <p className="links-blog-heading">Latest from the Blog</p>
              <div className="links-blog-list">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="links-blog-item"
                  >
                    <span className="links-blog-title">{post.title}</span>
                    <span className="links-item-arrow">→</span>
                  </Link>
                ))}
                <Link href="/blog" className="links-blog-all">
                  View all posts →
                </Link>
              </div>
            </div>
          )}

          <p className="links-footer">© Kuya Ken · kradigital.site</p>
        </div>
      </main>

      <LeadMagnetModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
