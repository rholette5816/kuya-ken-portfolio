"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  brandTitle?: string;
  brandSubtitle: string;
  navLabel: string;
  links: NavItem[];
  cta?: React.ReactNode;
  className?: string;
};

function normalizePath(href: string): string {
  if (href.startsWith("#")) return "__hash__";
  const [path] = href.split("#");
  return path || "/";
}

export default function SiteHeader({
  brandTitle = "Kuya Ken",
  brandSubtitle,
  navLabel,
  links,
  cta,
  className
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const headerClass = useMemo(() => {
    if (!className) return "site-header";
    return `site-header ${className}`;
  }, [className]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={headerClass}>
      <Link href="/" className="brand">
        <span>{brandTitle}</span>
        <small>{brandSubtitle}</small>
      </Link>

      <nav aria-label={navLabel}>
        {links.map((link) => {
          const active = normalizePath(link.href) === pathname;
          return (
            <Link key={link.href} href={link.href} className={active ? "is-active" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="mobile-menu-trigger"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav-panel"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {cta}

      {menuOpen ? (
        <>
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="mobile-nav-panel" id="mobile-nav-panel" role="dialog" aria-modal="true">
            <p className="mobile-nav-label">{navLabel}</p>
            <div className="mobile-nav-links">
              {links.map((link) => {
                const active = normalizePath(link.href) === pathname;
                return (
                  <Link
                    key={`mobile-${link.href}`}
                    href={link.href}
                    className={active ? "is-active" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
