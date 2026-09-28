import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const EDITABLE = ["decision", "invite_subject", "invite_body", "rejection_subject", "rejection_body", "email", "full_name", "applied_role"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.includes(k)));
  const { data, error } = await db().from("candidates").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await db().from("candidates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
