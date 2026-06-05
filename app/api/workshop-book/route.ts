import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { name, email, phone, city } = await req.json();

  if (!name || !email || !phone || !city) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cityDates: Record<string, string> = {
    Cebu: "June 13",
    Iloilo: "June 19",
    Bacolod: "June 21",
  };

  try {
    await resend.emails.send({
      from: "Workshop Booking <ken@kradigital.site>",
      to: "kevinrholette@gmail.com",
      subject: `New Workshop Booking — ${city} (${cityDates[city] ?? city})`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <h2 style="margin-bottom:0.5rem;">New Workshop Booking</h2>
          <p style="color:#555;">Someone just reserved a seat for the Meta & AI Intensive Workshop.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:1rem;">
            <tr><td style="padding:0.6rem;border:1px solid #eee;font-weight:700;">Name</td><td style="padding:0.6rem;border:1px solid #eee;">${name}</td></tr>
            <tr><td style="padding:0.6rem;border:1px solid #eee;font-weight:700;">Email</td><td style="padding:0.6rem;border:1px solid #eee;">${email}</td></tr>
            <tr><td style="padding:0.6rem;border:1px solid #eee;font-weight:700;">Phone</td><td style="padding:0.6rem;border:1px solid #eee;">${phone}</td></tr>
            <tr><td style="padding:0.6rem;border:1px solid #eee;font-weight:700;">City</td><td style="padding:0.6rem;border:1px solid #eee;">${city} — ${cityDates[city] ?? city}</td></tr>
          </table>
          <p style="margin-top:1.5rem;color:#555;font-size:0.9rem;">
            Awaiting GCash downpayment screenshot from this registrant.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:2rem 0;"/>
          <p style="font-size:0.85rem;color:#888;">Meta & AI Intensive Workshop — kradigital.site/workshops</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
