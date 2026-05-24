import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPost, getAllPosts } from "@/lib/blog";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date
    }
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="blog-post-page">
      <article className="blog-post">
        <header className="blog-post-header">
          <Link href="/blog" className="blog-back">← All posts</Link>
          {post.image && (
            <div className="blog-post-hero">
              <Image
                src={post.image}
                alt={post.title}
                width={1200}
                height={900}
                className="blog-post-hero-img"
                priority
              />
            </div>
          )}
          <div className="blog-post-meta">
            <span className="blog-card-date">
              {new Date(post.date).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </span>
            {post.tags.map((tag) => (
              <span key={tag} className="blog-card-tag">{tag}</span>
            ))}
          </div>
          <h1 className="blog-post-title">{post.title}</h1>
          <p className="blog-post-desc">{post.description}</p>
        </header>

        <div
          className="blog-post-body"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <footer className="blog-post-footer">
          <div className="blog-cta-box">
            <p className="blog-cta-headline">Want this built for your business?</p>
            <p className="blog-cta-sub">Book a free funnel audit. No pitch, just clarity on where your biggest leak is.</p>
            <a href="/#audit" className="btn-primary">Book Free Funnel Audit</a>
          </div>
        </footer>
      </article>
    </main>
  );
}
