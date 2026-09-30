import { NextResponse } from "next/server";
import { COOKIE, sessionToken } from "@/lib/auth";

// One-click entry: no password. The cookie only marks that the visitor came through the entry page.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
