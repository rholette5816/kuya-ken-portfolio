"use client";

import { useEffect, useMemo, useState } from "react";

type PostLibraryData = {
  generatedAt: string;
  range: { start: string; end: string };
  pages: Array<{ id: string; name: string; picture: string; connected: boolean }>;
  summary: { posts: number; organicPosts: number; advertisedPosts: number; activeAds: number; spend: number; rankedSpend: number; purchases: number; purchaseValue: number };
  warnings: string[];
  posts: any[];
};

function isoDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 86400000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isoMonthStart() {
  const today = isoDaysAgo(0);
  return `${today.slice(0, 7)}-01`;
}

function number(value: unknown) {
  return Number(value || 0).toLocaleString("en-PH");
}

function php(value: unknown) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function percent(value: unknown) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function dateLabel(value: unknown) {
  if (!value) return "Date unavailable";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusLabel(post: any) {
  if (post.ads?.some((ad: any) => ad.status === "ACTIVE")) return "Active ads";
  if (post.source?.ads) return "Advertised";
  return "Organic";
}

export default function PostLibraryView() {
  const [start, setStart] = useState(isoMonthStart());
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [data, setData] = useState<PostLibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("overall");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start, end });
      const response = await fetch(`/api/vision-x-saha/post-library?${params}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/vision-x-saha/login";
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The Post Library could not be loaded.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Post Library could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...(data?.posts || [])].filter(post => {
      if (page && post.pageId !== page) return false;
      if (status === "organic" && post.source?.ads) return false;
      if (status === "advertised" && !post.source?.ads) return false;
      if (status === "active" && !post.ads?.some((ad: any) => ad.status === "ACTIVE")) return false;
      const haystack = `${post.pageName} ${post.postId} ${post.message} ${(post.ads || []).map((ad: any) => ad.name).join(" ")}`.toLowerCase();
      return !needle || haystack.includes(needle);
    }).sort((left, right) => {
      if (sort === "newest") return String(right.createdTime).localeCompare(String(left.createdTime));
      if (sort === "spend") return Number(right.paid?.spend || 0) - Number(left.paid?.spend || 0);
      return Number(right.scores?.[sort] || 0) - Number(left.scores?.[sort] || 0);
    });
  }, [data, page, status, sort, search]);

  const copyLink = async (post: any) => {
    try {
      await navigator.clipboard.writeText(post.postUrl);
      setCopied(post.key);
      window.setTimeout(() => setCopied(current => current === post.key ? "" : current), 1800);
    } catch {
      window.open(post.postUrl, "_blank", "noopener,noreferrer");
    }
  };

  return <>
    <header className="vxs-section-header">
      <div><p>META PAGE INTELLIGENCE</p><h2>Post Library</h2><span>Page posts with rankings and account totals from BM extra #3 - saha only.</span></div>
      <div className="vxs-post-date-controls">
        <label>From<input type="date" value={start} max={end} onChange={event => setStart(event.target.value)} /></label>
        <label>To<input type="date" value={end} min={start} max={isoDaysAgo(0)} onChange={event => setEnd(event.target.value)} /></label>
        <button className="vxs-primary" onClick={() => void load()} disabled={loading}>{loading ? "Syncing" : "Sync from Meta"}</button>
      </div>
    </header>

    {error ? <div className="vxs-demo-note"><strong>Post Library unavailable</strong><span>{error}</span><button className="vxs-refresh" onClick={() => void load()}>Retry</button></div> : null}
    {loading && !data ? <div className="vxs-demo-note"><strong>Scanning Meta</strong><span>Loading Page posts and matching ads from BM extra #3 - saha only.</span></div> : null}

    {data ? <>
      <section className="vxs-metrics">
        {[
          ["Posts", number(data.summary.posts)],
          ["Organic", number(data.summary.organicPosts)],
          ["Advertised", number(data.summary.advertisedPosts)],
          ["Active ads", number(data.summary.activeAds)],
          ["Spend", php(data.summary.spend)],
          ["Purchases", number(data.summary.purchases)],
          ["Purchase value", php(data.summary.purchaseValue)]
        ].map(([label, value]) => <article className="vxs-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>

      <section className="vxs-card vxs-post-page-strip">
        <button className={!page ? "active" : ""} onClick={() => setPage("")}><span className="vxs-page-avatar">ALL</span><span><strong>All Pages</strong><small>{data.pages.length} connected targets</small></span></button>
        {data.pages.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
          {item.picture ? <img src={item.picture} alt="" /> : <span className="vxs-page-avatar">{item.name.slice(0, 2).toUpperCase()}</span>}
          <span><strong>{item.name}</strong><small>{item.connected ? "Page posts connected" : "Ads-only fallback"}</small></span>
          <span className={item.connected ? "vxs-page-dot connected" : "vxs-page-dot"} />
        </button>)}
      </section>

      {data.warnings.length ? <details className="vxs-card vxs-post-warnings"><summary>{data.warnings.length} Meta connection warning{data.warnings.length === 1 ? "" : "s"}</summary><ul>{data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details> : null}

      <section className="vxs-card vxs-post-toolbar">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search caption, post ID, or ad name" aria-label="Search posts" />
        <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter post status"><option value="all">All post types</option><option value="organic">Organic only</option><option value="advertised">Advertised</option><option value="active">Active ads</option></select>
        <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort posts"><option value="overall">Overall rank</option><option value="engagement">Engagement rank</option><option value="behavior">Website behavior</option><option value="profitability">Profitability</option><option value="spend">Highest spend</option><option value="newest">Newest post</option></select>
        <span><strong>{visible.length}</strong> visible posts</span>
      </section>

      <div className="vxs-post-library-grid">
        {visible.map(post => {
          const organic = post.organic || {};
          const paid = post.paid || {};
          const metrics = post.metrics || {};
          const isActive = post.ads?.some((ad: any) => ad.status === "ACTIVE");
          return <article className="vxs-post-library-card" key={post.key}>
            <a className="vxs-post-library-preview" href={post.postUrl} target="_blank" rel="noreferrer">
              {post.preview?.url ? <img src={post.preview.url} alt={post.message ? post.message.slice(0, 80) : `${post.pageName} post`} loading="lazy" /> : <div><strong>Preview unavailable</strong><span>Open the Facebook post to view the media.</span></div>}
              <span className="vxs-post-rank">#{post.ranks?.overall || "-"}</span>
              <span className={isActive ? "vxs-post-state active" : "vxs-post-state"}>{statusLabel(post)}</span>
            </a>
            <div className="vxs-post-library-body">
              <div className="vxs-post-library-title"><div><p>{post.pageName}</p><h3>{post.message || "Post without caption"}</h3><span>{dateLabel(post.createdTime)} · ID {post.postId}</span></div><strong>{Number(post.scores?.overall || 0).toFixed(1)}</strong></div>
              <div className="vxs-post-stage-grid">
                <section><header><span>Engagement</span><b>#{post.ranks?.engagement || "-"}</b></header><div><span>Eng. rate<strong>{percent(metrics.engagementRate)}</strong></span><span>Reach<strong>{number(organic.reach || paid.reach)}</strong></span><span>Video views<strong>{number(organic.videoViews || paid.videoViews)}</strong></span></div></section>
                <section><header><span>Behavior</span><b>#{post.ranks?.behavior || "-"}</b></header><div><span>Unique CTR<strong>{percent(metrics.uniqueCtr)}</strong></span><span>Link clicks<strong>{number(paid.linkClicks)}</strong></span><span>LP views<strong>{number(paid.landingPageViews)}</strong></span></div></section>
                <section><header><span>Profit</span><b>#{post.ranks?.profitability || "-"}</b></header><div><span>Spend<strong>{php(paid.spend)}</strong></span><span>Purchases<strong>{number(paid.purchases)}</strong></span><span>ROAS<strong>{Number(metrics.roas || 0).toFixed(2)}x</strong></span></div></section>
              </div>
              <div className="vxs-post-interactions"><span>{number(organic.reactions || paid.reactions)} reactions</span><span>{number(organic.comments || paid.comments)} comments</span><span>{number(organic.shares || paid.shares)} shares</span><span>{post.ads?.length || 0} ads</span></div>
              <div className="vxs-post-library-actions"><a href={post.postUrl} target="_blank" rel="noreferrer">Open Facebook post</a><button onClick={() => void copyLink(post)}>{copied === post.key ? "Copied" : "Copy post link"}</button></div>
              {post.ads?.length ? <details className="vxs-post-ad-details"><summary>Ads using this post</summary><ul>{post.ads.map((ad: any) => <li key={ad.id}><span><strong>{ad.name}</strong><small>{ad.accountName}</small></span><b>{ad.status}</b></li>)}</ul></details> : null}
            </div>
          </article>;
        })}
      </div>
      {!visible.length ? <section className="vxs-card"><p className="vxs-empty">No posts match the selected filters and date range.</p></section> : null}
      <p className="vxs-post-library-foot">Last synced {dateLabel(data.generatedAt)}. Headline spend is the Meta account total; card spend is ad-level allocation and may update moments later. Overall ranking uses 50% engagement, 35% website behavior, and 15% profitability.</p>
    </> : null}
  </>;
}

