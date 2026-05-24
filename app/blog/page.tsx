import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Meta Ads and Full Funnel Insights for Philippine Businesses",
  description:
    "Practical guides on Meta Ads, full funnel building, and AI business systems for entrepreneurs and SMEs in the Philippines.",
  alternates: { canonical: "/blog" }
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="blog-index">
      <section className="blog-hero">
        <div className="blog-hero-inner">
          <span className="pill">Insights</span>
          <h1>Meta Ads and Full Funnel Guides</h1>
          <p className="blog-hero-sub">
            Practical breakdowns for product and service businesses in the Philippines.
            No theory. Just what works.
          </p>
        </div>
      </section>

      <section className="blog-list-section">
        <div className="blog-list">
          {posts.length === 0 && (
            <p className="blog-empty">Posts coming soon.</p>
          )}
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
              <div className="blog-card-meta">
                <span className="blog-card-date">
                  {new Date(post.date).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })}
                </span>
                {post.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="blog-card-tag">{tag}</span>
                ))}
              </div>
              <h2 className="blog-card-title">{post.title}</h2>
              <p className="blog-card-desc">{post.description}</p>
              <span className="blog-card-cta">Read post →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
