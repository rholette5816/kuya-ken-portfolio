export default function RalphClientAccessPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <AccessForm searchParams={searchParams} />;
}

async function AccessForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6f7", padding: 24 }}>
      <section style={{ width: "min(420px, 100%)", background: "white", border: "1px solid #dbe1e5", padding: 30 }}>
        <p style={{ margin: 0, color: "#68747f", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>Private client area</p>
        <h1 style={{ margin: "8px 0", fontSize: 26 }}>Ralph Cimeni dashboard</h1>
        <p style={{ margin: "0 0 22px", color: "#68747f", lineHeight: 1.55 }}>Enter the client access code to review the dashboard and execute the agreement.</p>
        <form action="/clients/ralph-cimeni/access/submit" method="post">
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 700 }}>
            Access code
            <input name="accessCode" type="password" autoComplete="current-password" required style={{ height: 44, border: "1px solid #b8c1c6", padding: "0 12px", fontSize: 16 }} />
          </label>
          {params.error ? <p style={{ color: "#a33d3d", fontSize: 12 }}>The access code is incorrect.</p> : null}
          <button type="submit" style={{ width: "100%", height: 44, marginTop: 18, border: 0, background: "#13795b", color: "white", fontWeight: 800, cursor: "pointer" }}>Continue</button>
        </form>
      </section>
    </main>
  );
}
