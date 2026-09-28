import { NextResponse } from "next/server";
import { COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD.trim()) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
