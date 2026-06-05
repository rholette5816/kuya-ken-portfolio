import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from: "Kuya Ken <ken@kradigital.site>",
      to: email,
      subject: "Here's your Negosyo Starter Guide",
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <h2 style="margin-bottom:0.5rem;">Your free guide is ready.</h2>
          <p style="color:#555;margin-top:0.25rem;">Thanks for downloading. Click the button below to get your copy.</p>
          <a href="https://www.kradigital.site/downloads/negosyo-starter-guide.pdf"
             style="display:inline-block;margin:1.5rem 0;padding:0.75rem 1.5rem;background:#4f8cff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
            Download Negosyo Starter Guide
          </a>
          <p style="color:#555;font-size:0.9rem;">
            If the button doesn't work, copy this link:<br/>
            <a href="https://www.kradigital.site/downloads/negosyo-starter-guide.pdf" style="color:#4f8cff;">
              https://www.kradigital.site/downloads/negosyo-starter-guide.pdf
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:2rem 0;"/>
          <p style="font-size:0.85rem;color:#888;">
            — Kuya Ken | <a href="https://www.kradigital.site" style="color:#4f8cff;">kradigital.site</a>
          </p>
        </div>
      `
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
