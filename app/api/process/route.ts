// Trigger -> Input -> Context -> Processing -> AI, for one CV per request (keeps each call under serverless time limits).
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { extractText, extractPII, redact } from "@/lib/extract";
import { scoreCV } from "@/lib/gemini";
import { weightedTotal, recommend, type Role } from "@/lib/rubric";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const role = form.get("role") as Role;
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (role !== "PM" && role !== "SPM") return NextResponse.json({ error: "Role must be PM or SPM" }, { status: 400 });

  let supabase;
  try { supabase = db(); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
  const { data: row, error: insErr } = await supabase
    .from("candidates")
    .insert({ file_name: file.name, applied_role: role, status: "processing" })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    const text = await extractText(file.name, Buffer.from(await file.arrayBuffer()));
    if (text.length < 200) throw new Error("Could not read enough text from this file (is it a scanned image?)");
    const pii = extractPII(text, file.name);
    const redacted = redact(text, pii);

    const ai = await scoreCV(redacted, role);
    const pmScore = weightedTotal("PM", ai.pm_scores);
    const spmScore = weightedTotal("SPM", ai.spm_scores);
    const applied = role === "PM" ? pmScore : spmScore;

    const update = {
      full_name: pii.fullName,
      email: pii.email,
      phone: pii.phone,
      redacted_text: redacted,
      status: "scored",
      error: null,
      pm_score: pmScore,
      spm_score: spmScore,
      pm_breakdown: ai.pm_scores,
      spm_breakdown: ai.spm_scores,
      years_pm_experience: ai.years_pm_experience,
      summary: ai.summary,
      best_fit_role: pmScore >= spmScore ? "PM" : "SPM",
      recommendation: recommend(applied),
      interview_brief: ai.interview_brief,
      invite_subject: ai.invite_email.subject,
      invite_body: ai.invite_email.body,
      rejection_subject: ai.rejection_email.subject,
      rejection_body: ai.rejection_email.body,
    };
    await supabase.from("candidates").update(update).eq("id", row.id);
    return NextResponse.json({ id: row.id, name: pii.fullName, score: applied });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("candidates").update({ status: "error", error: msg }).eq("id", row.id);
    return NextResponse.json({ id: row.id, error: msg }, { status: 500 });
  }
}
