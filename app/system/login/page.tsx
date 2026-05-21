import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OS Portal Login",
  description: "Secure login for private KRA Digital OS Portal routes.",
  alternates: {
    canonical: "/system/login"
  }
};

function LoginForm({ next, hasError }: { next: string; hasError: boolean }) {
  return (
    <section className="section audit-wrap">
      <div className="audit-shell">
        <p className="eyebrow">KRA Digital OS Portal</p>
        <h1>OS Portal</h1>
        <p className="lead">
          Enter your owner credentials to access the private OS Portal.
        </p>

        <form method="post" action="/system/login/submit" className="audit-form">
          <input type="hidden" name="next" value={next} />
          <label>
            Username
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              placeholder="Enter OS username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Enter OS access password"
            />
          </label>

          {hasError ? (
            <p className="audit-error" role="alert">
              Incorrect username or password. Please try again.
            </p>
          ) : null}

          <button type="submit" className="btn primary audit-submit">
            Unlock OS Portal
          </button>
        </form>

        <div className="cta-row">
          <Link href="/" className="btn secondary">Back to Portfolio</Link>
        </div>
      </div>
    </section>
  );
}

type SearchParams = {
  next?: string;
  error?: string;
};

function LoginPageInner({ searchParams }: { searchParams: SearchParams }) {
  const nextPath = searchParams.next && searchParams.next.startsWith("/system")
    ? searchParams.next
    : "/system/dashboard";
  const hasError = searchParams.error === "1";

  return <LoginForm next={nextPath} hasError={hasError} />;
}

export default async function SystemLoginPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <main>
      <LoginPageInner searchParams={resolvedSearchParams} />
    </main>
  );
}
