import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VISION X SAHA Command Center Login",
  robots: { index: false, follow: false, noarchive: true }
};

export const dynamic = "force-dynamic";

export default async function VisionSahaLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <main className="vxs-login-page">
    <section className="vxs-login-shell">
      <div className="vxs-login-brand">
        <span>VX</span>
        <div><strong>VISION X SAHA</strong><small>Private Business Command Center</small></div>
      </div>
      <div className="vxs-login-copy">
        <p>PARTNER ACCESS</p>
        <h1>Operational control, separate from the KRA Portal.</h1>
        <span>Use the dedicated VISION X SAHA credentials to review live orders, advertising, traffic, inventory, SMS, and integrations.</span>
      </div>
      <form method="post" action="/vision-x-saha/login/submit" className="vxs-login-form">
        <label>Username<input name="username" type="text" autoComplete="username" maxLength={80} required autoFocus /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={200} required /></label>
        {error === "1" ? <p className="vxs-login-error" role="alert">Incorrect VISION X SAHA username or password.</p> : null}
        {error === "rate" ? <p className="vxs-login-error" role="alert">Too many attempts. Please wait 15 minutes and try again.</p> : null}
        <button type="submit">Open Command Center</button>
      </form>
      <p className="vxs-login-foot">This login is independent from the KRA OS Portal.</p>
    </section>
    <style>{`
      .vxs-login-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,#214f3f 0,#0d211a 38%,#07130f 100%);font-family:Arial,sans-serif;color:#14241e}
      .vxs-login-shell{width:min(920px,100%);display:grid;grid-template-columns:1.1fr .9fr;overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.42)}
      .vxs-login-brand{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid #e2eae6;background:#f8fbf9}
      .vxs-login-brand>span{width:43px;height:43px;display:grid;place-items:center;border-radius:12px;background:#177a58;color:#fff;font-weight:900}
      .vxs-login-brand div{display:grid;gap:3px}.vxs-login-brand strong{font-size:14px;letter-spacing:.7px}.vxs-login-brand small{font-size:11px;color:#687970}
      .vxs-login-copy{padding:56px 44px;background:#112b22;color:#fff}.vxs-login-copy p{margin:0 0 14px;color:#59d19f;font-size:11px;font-weight:900;letter-spacing:1.6px}
      .vxs-login-copy h1{margin:0;font-size:34px;line-height:1.1;letter-spacing:-1px}.vxs-login-copy span{display:block;margin-top:20px;color:#b8cbc3;font-size:14px;line-height:1.65}
      .vxs-login-form{padding:48px 40px;display:grid;align-content:center;gap:18px}.vxs-login-form label{display:grid;gap:8px;font-size:12px;font-weight:800;color:#31473f}
      .vxs-login-form input{width:100%;min-height:48px;border:1px solid #cad8d1;border-radius:10px;padding:11px 13px;background:#fff;color:#13231e;font:inherit;outline:none}.vxs-login-form input:focus{border-color:#258762;box-shadow:0 0 0 3px rgba(37,135,98,.13)}
      .vxs-login-form button{min-height:50px;border:0;border-radius:10px;background:#177a58;color:#fff;font:800 14px Arial;cursor:pointer;box-shadow:0 8px 22px rgba(23,122,88,.23)}.vxs-login-form button:hover{background:#126747}
      .vxs-login-error{margin:0;padding:11px 12px;border-radius:9px;background:#fde9e5;color:#9c3b2e;font-size:12px;line-height:1.4}
      .vxs-login-foot{grid-column:1/-1;margin:0;padding:13px 24px;border-top:1px solid #e2eae6;background:#f8fbf9;color:#718179;font-size:10px;text-align:center}
      @media(max-width:720px){.vxs-login-page{padding:14px}.vxs-login-shell{grid-template-columns:1fr}.vxs-login-copy{padding:32px 26px}.vxs-login-copy h1{font-size:27px}.vxs-login-form{padding:32px 26px}.vxs-login-brand{padding:16px 20px}}
    `}</style>
  </main>;
}

