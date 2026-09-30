"use client";
import { useState } from "react";

export default function Login() {
  const [busy, setBusy] = useState(false);
  async function enter() {
    setBusy(true);
    const r = await fetch("/api/login", { method: "POST" });
    if (r.ok) window.location.href = "/";
    else setBusy(false);
  }
  return (
    <main className="login">
      <div className="card login-card">
        <div className="brand"><span className="logo">K</span> Kargo Hiring</div>
        <p className="muted small">Founder&apos;s dashboard for the PM and SPM shortlist.</p>
        <button className="btn primary" onClick={enter} disabled={busy} autoFocus>
          {busy ? "Opening…" : "Enter dashboard"}
        </button>
      </div>
    </main>
  );
}
