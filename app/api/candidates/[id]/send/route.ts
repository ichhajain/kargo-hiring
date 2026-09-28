// The only path that sends email: an explicit click by the founder after choosing Invite or Reject.
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { sendEmail, fillName } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = db();
  const { data: c, error } = await supabase.from("candidates").select("*").eq("id", id).single();
  if (error || !c) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (c.decision === "pending") return NextResponse.json({ error: "Choose Invite or Reject first" }, { status: 400 });
  if (c.email_status === "sent") return NextResponse.json({ error: "Email already sent" }, { status: 409 });
  if (!c.email) return NextResponse.json({ error: "No email address on this CV. Add one first." }, { status: 400 });

  const type = c.decision === "invite" ? "invite" : "rejection";
  const subject = fillName(c[`${type}_subject`] ?? "", c.full_name);
  const body = fillName(c[`${type}_body`] ?? "", c.full_name);
  try {
    await sendEmail(c.email, subject, body);
    const { data } = await supabase
      .from("candidates")
      .update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null, sent_email_type: type })
      .eq("id", id).select("*").single();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("candidates").update({ email_status: "failed", email_error: msg }).eq("id", id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
