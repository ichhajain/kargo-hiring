"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) window.location.href = "/";
    else setErr("Wrong password");
  }
  return (
    <main className="login">
      <form onSubmit={submit} className="card login-card">
        <div className="brand"><span className="logo">K</span> Kargo Hiring</div>
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="error">{err}</p>}
        <button className="btn primary" type="submit">Sign in</button>
      </form>
    </main>
  );
}
