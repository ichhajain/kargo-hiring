"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RUBRICS, type Role, type CriterionScore } from "@/lib/rubric";

type Candidate = {
  id: string;
  created_at: string;
  file_name: string;
  applied_role: Role;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: "processing" | "scored" | "error";
  error: string | null;
  pm_score: number | null;
  spm_score: number | null;
  pm_breakdown: CriterionScore[] | null;
  spm_breakdown: CriterionScore[] | null;
  years_pm_experience: number | null;
  summary: string | null;
  best_fit_role: Role | null;
  recommendation: "interview" | "maybe" | "reject" | null;
  interview_brief: { why_ranked_here: string; strengths: string[]; concerns: string[]; probe_questions: string[] } | null;
  invite_subject: string | null;
  invite_body: string | null;
  rejection_subject: string | null;
  rejection_body: string | null;
  decision: "pending" | "invite" | "reject";
  email_status: "draft" | "sent" | "failed";
  email_sent_at: string | null;
  email_error: string | null;
  sent_email_type: "invite" | "rejection" | null;
};

type QueueItem = { name: string; state: "waiting" | "working" | "done" | "error"; msg?: string };

const roleName = (r: Role) => (r === "PM" ? "Product Manager" : "Senior Product Manager");
const scoreFor = (c: Candidate, r: Role) => (r === "PM" ? c.pm_score : c.spm_score) ?? 0;
const firstName = (c: Candidate) => (c.full_name || "there").split(" ")[0];
const fill = (t: string | null, c: Candidate) => (t || "").replace(/\{\{\s*first_name\s*\}\}/g, firstName(c));

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Role>("PM");
  const [filter, setFilter] = useState<"all" | "pending" | "invite" | "reject">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadRole, setUploadRole] = useState<Role | "AUTO">("PM");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/candidates", { cache: "no-store" });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (r.ok) { setCandidates(j); setLoadError(null); } else setLoadError(j.error || `HTTP ${r.status}`);
    } catch (e) {
      setLoadError(String(e));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  async function processFiles(files: File[]) {
    if (!files.length) return;
    const start = queue.length;
    setQueue((q) => [...q, ...files.map((f) => ({ name: f.name, state: "waiting" as const }))]);
    for (let i = 0; i < files.length; i++) {
      const idx = start + i;
      setQueue((q) => q.map((it, j) => (j === idx ? { ...it, state: "working" } : it)));
      const fd = new FormData();
      fd.append("file", files[i]);
      fd.append("role", uploadRole);
      try {
        const r = await fetch("/api/process", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        setQueue((q) => q.map((it, k) => (k === idx ? (r.ok ? { ...it, state: "done", msg: `${j.name} · ${j.score}` } : { ...it, state: "error", msg: j.error || `HTTP ${r.status}` }) : it)));
      } catch (e) {
        setQueue((q) => q.map((it, k) => (k === idx ? { ...it, state: "error", msg: String(e) } : it)));
      }
      load();
    }
  }

  const ranked = useMemo(() => {
    return candidates
      .filter((c) => c.applied_role === tab)
      .filter((c) => filter === "all" || c.decision === filter)
      .sort((a, b) => {
        if (a.status !== "scored" || b.status !== "scored") return a.status === "scored" ? -1 : 1;
        return scoreFor(b, tab) - scoreFor(a, tab);
      });
  }, [candidates, tab, filter]);

  const selected = candidates.find((c) => c.id === selectedId) || null;

  const stats = useMemo(() => {
    const scored = candidates.filter((c) => c.status === "scored");
    return {
      total: candidates.length,
      pm: candidates.filter((c) => c.applied_role === "PM").length,
      spm: candidates.filter((c) => c.applied_role === "SPM").length,
      suggested: scored.filter((c) => c.recommendation === "interview").length,
      undecided: scored.filter((c) => c.decision === "pending").length,
      readyToSend: scored.filter((c) => c.decision !== "pending" && c.email_status !== "sent").length,
      sent: candidates.filter((c) => c.email_status === "sent").length,
    };
  }, [candidates]);

  async function patch(id: string, body: Partial<Candidate>) {
    const r = await fetch(`/api/candidates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const updated = await r.json();
      setCandidates((cs) => cs.map((c) => (c.id === id ? updated : c)));
    } else flash((await r.json()).error || "Update failed");
  }

  async function send(id: string) {
    const r = await fetch(`/api/candidates/${id}/send`, { method: "POST" });
    const j = await r.json();
    if (r.ok) { setCandidates((cs) => cs.map((c) => (c.id === id ? j : c))); flash("Email sent"); }
    else { flash(j.error || "Send failed"); load(); }
  }

  async function sendAllDecided() {
    const ready = candidates.filter((c) => c.status === "scored" && c.decision !== "pending" && c.email_status !== "sent" && c.email);
    if (!ready.length) return flash("No decided candidates waiting for an email");
    const inv = ready.filter((c) => c.decision === "invite").length;
    if (!confirm(`Send ${ready.length} emails now? (${inv} invites, ${ready.length - inv} rejections)`)) return;
    for (const c of ready) await send(c.id);
  }

  async function remove(id: string) {
    if (!confirm("Remove this candidate and their data?")) return;
    await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    setSelectedId(null);
    load();
  }

  const other: Role = tab === "PM" ? "SPM" : "PM";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">K</span> Kargo Hiring <span className="muted">· Founder&apos;s dashboard</span></div>
        <div className="stats">
          <Stat n={stats.total} label="applicants" />
          <Stat n={stats.suggested} label="suggested to interview" />
          <Stat n={stats.undecided} label="awaiting your call" />
          <Stat n={stats.sent} label="emails sent" />
        </div>
      </header>

      <section className="card upload"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}>
        <div className="upload-row">
          <div>
            <h2>Add CVs</h2>
            <p className="muted small">Personal details (name, email, phone, profile links) are stripped before the AI sees the CV. Every CV is scored against both roles.</p>
          </div>
          <div className="upload-controls">
            <div className="seg" role="radiogroup" aria-label="Applied role">
              {(["PM", "SPM", "AUTO"] as const).map((r) => (
                <button key={r} role="radio" aria-checked={uploadRole === r} className={uploadRole === r ? "on" : ""} onClick={() => setUploadRole(r)}>{r === "AUTO" ? "Not sure" : roleName(r)}</button>
              ))}
            </div>
            <button className="btn primary" onClick={() => fileInput.current?.click()}>Upload CVs</button>
            <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.txt" hidden
              onChange={(e) => { processFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
          </div>
        </div>
        <div className={`dropzone ${dragging ? "over" : ""}`}>Drop PDF / DOCX files here, applied role: <b>{uploadRole === "AUTO" ? "not sure (filed under best-fit role)" : roleName(uploadRole)}</b></div>
        {queue.length > 0 && (
          <div className="queue">
            <div className="queue-head">
              <span>{queue.filter((q) => q.state === "done").length}/{queue.length} processed{queue.some((q) => q.state === "error") && ` · ${queue.filter((q) => q.state === "error").length} failed`}</span>
              {queue.every((q) => q.state === "done" || q.state === "error") && <button className="link" onClick={() => setQueue([])}>Clear</button>}
            </div>
            <ul>
              {queue.map((q, i) => (
                <li key={i} className={q.state}><span className="dot" />{q.name}<span className="muted"> {q.state === "working" ? "scoring…" : q.msg || ""}</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="list-head">
          <div className="tabs" role="tablist">
            {(["PM", "SPM"] as Role[]).map((r) => (
              <button key={r} role="tab" aria-selected={tab === r} className={tab === r ? "on" : ""} onClick={() => setTab(r)}>
                {roleName(r)} <span className="count">{r === "PM" ? stats.pm : stats.spm}</span>
              </button>
            ))}
          </div>
          <div className="list-actions">
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter by decision">
              <option value="all">All decisions</option>
              <option value="pending">Awaiting decision</option>
              <option value="invite">Invited</option>
              <option value="reject">Rejected</option>
            </select>
            <button className="btn" onClick={sendAllDecided} disabled={!stats.readyToSend}>Send {stats.readyToSend || ""} decided emails</button>
          </div>
        </div>

        {loading ? <p className="muted pad">Loading…</p> : loadError ? <p className="error pad">Couldn&apos;t load candidates: {loadError}</p> : ranked.length === 0 ? (
          <p className="muted pad">No {roleName(tab)} applicants yet. Upload CVs above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Candidate</th><th>{tab} fit</th><th className="hide-sm">{other} fit</th><th className="hide-sm">AI suggests</th><th>Your call</th><th>Email</th></tr>
              </thead>
              <tbody>
                {ranked.map((c, i) => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className={selectedId === c.id ? "sel" : ""}>
                    <td className="rank">{c.status === "scored" ? i + 1 : "–"}</td>
                    <td>
                      <div className="name">{c.full_name || c.file_name}</div>
                      <div className="muted small ellipsis">{c.status === "scored" ? c.summary : c.status === "error" ? <span className="error">{c.error}</span> : "Scoring…"}</div>
                    </td>
                    <td>{c.status === "scored" && <ScoreBar v={scoreFor(c, tab)} />}</td>
                    <td className="hide-sm">{c.status === "scored" && (
                      <span className={scoreFor(c, other) > scoreFor(c, tab) + 5 ? "alt strong" : "alt"}>{scoreFor(c, other)}{scoreFor(c, other) > scoreFor(c, tab) + 5 && " ↑"}</span>
                    )}</td>
                    <td className="hide-sm">{c.recommendation && <span className={`chip ${c.recommendation}`}>{c.recommendation}</span>}</td>
                    <td>{c.decision !== "pending" ? <span className={`chip ${c.decision}`}>{c.decision === "invite" ? "Invite" : "Reject"}</span> : <span className="muted small">–</span>}</td>
                    <td>{c.email_status === "sent" ? <span className="chip sent">Sent</span> : c.email_status === "failed" ? <span className="chip failed">Failed</span> : <span className="muted small">Draft</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <Detail c={selected} onClose={() => setSelectedId(null)} onPatch={(b) => patch(selected.id, b)} onSend={() => send(selected.id)} onRemove={() => remove(selected.id)} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="stat"><b>{n}</b><span>{label}</span></div>;
}

function ScoreBar({ v }: { v: number }) {
  const tone = v >= 65 ? "hi" : v >= 45 ? "mid" : "lo";
  return (
    <div className="scorebar" title={`${v} / 100`}>
      <div className="track"><div className={`fill ${tone}`} style={{ width: `${v}%` }} /></div>
      <span>{v}</span>
    </div>
  );
}

function Breakdown({ role, scores }: { role: Role; scores: CriterionScore[] | null }) {
  return (
    <div className="breakdown">
      {RUBRICS[role].map((cr) => {
        const s = scores?.find((x) => x.key === cr.key);
        return (
          <div key={cr.key} className="crit">
            <div className="crit-head">
              <span>{cr.label} <span className={`jd ${cr.inJD}`}>{cr.inJD === "no" ? "not in JD" : cr.inJD === "partial" ? "partly in JD" : "in JD"}</span></span>
              <span className="muted small">{s?.score ?? 0}/5 · {cr.weight}%</span>
            </div>
            <div className="pips">{[1, 2, 3, 4, 5].map((p) => <i key={p} className={p <= (s?.score ?? 0) ? "on" : ""} />)}</div>
            <p className="small evidence">{s?.evidence || "No evidence in CV."}</p>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ c, onClose, onPatch, onSend, onRemove }: { c: Candidate; onClose: () => void; onPatch: (b: Partial<Candidate>) => void; onSend: () => void; onRemove: () => void }) {
  const [view, setView] = useState<Role>(c.applied_role);
  const type = c.decision === "invite" ? "invite" : "rejection";
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(c.email || "");
  const [sending, setSending] = useState(false);

  useEffect(() => { setView(c.applied_role); setEmail(c.email || ""); }, [c.id, c.applied_role, c.email]);
  useEffect(() => {
    setSubject(fill(c[`${type}_subject`], c));
    setBody(fill(c[`${type}_body`], c));
  }, [c, type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sent = c.email_status === "sent";
  const dirty = subject !== fill(c[`${type}_subject`], c) || body !== fill(c[`${type}_body`], c);

  async function saveAndSend() {
    setSending(true);
    if (dirty) await onPatch({ [`${type}_subject`]: subject, [`${type}_body`]: body } as Partial<Candidate>);
    await onSend();
    setSending(false);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Candidate detail">
        <div className="drawer-head">
          <div>
            <h2>{c.full_name || c.file_name}</h2>
            <p className="muted small">Applied: {roleName(c.applied_role)} · {c.years_pm_experience ?? "?"} yrs PM · {c.file_name}</p>
            <p className="muted small">{c.email || "no email found"}{c.phone ? ` · ${c.phone}` : ""}</p>
          </div>
          <button className="icon" onClick={onClose} aria-label="Close">×</button>
        </div>

        {c.status === "error" ? <p className="error">{c.error}</p> : c.status !== "scored" ? <p className="muted">Scoring…</p> : (
          <>
            <div className="scores-row">
              {(["PM", "SPM"] as Role[]).map((r) => (
                <button key={r} className={`score-card ${view === r ? "on" : ""}`} onClick={() => setView(r)}>
                  <span className="muted small">{r} fit{r === c.applied_role ? " (applied)" : ""}</span>
                  <b>{scoreFor(c, r)}</b>
                </button>
              ))}
              <div className="score-card static">
                <span className="muted small">AI suggests</span>
                <span className={`chip ${c.recommendation}`}>{c.recommendation}</span>
              </div>
            </div>

            {c.interview_brief && (
              <section className="block">
                <h3>Why ranked here</h3>
                <p>{c.interview_brief.why_ranked_here}</p>
                <div className="two">
                  <div><h4>Strengths</h4><ul>{c.interview_brief.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div><h4>Concerns</h4><ul>{c.interview_brief.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                </div>
                <h4>What to probe in the interview</h4>
                <ol>{c.interview_brief.probe_questions.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </section>
            )}

            <section className="block">
              <h3>{view} rubric breakdown</h3>
              <Breakdown role={view} scores={view === "PM" ? c.pm_breakdown : c.spm_breakdown} />
            </section>

            <section className="block decide">
              <h3>Your call</h3>
              {sent ? (
                <p className="ok">{c.sent_email_type === "invite" ? "Invite" : "Rejection"} sent to {c.email} on {new Date(c.email_sent_at!).toLocaleString()}.</p>
              ) : (
                <>
                  <div className="decide-btns">
                    <button className={`btn ${c.decision === "invite" ? "primary" : ""}`} onClick={() => onPatch({ decision: "invite" })}>Invite to interview</button>
                    <button className={`btn ${c.decision === "reject" ? "danger" : ""}`} onClick={() => onPatch({ decision: "reject" })}>Reject</button>
                    {c.decision !== "pending" && <button className="link" onClick={() => onPatch({ decision: "pending" })}>Undo</button>}
                  </div>
                  {c.decision !== "pending" && (
                    <div className="composer">
                      <label>To<input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => email !== c.email && onPatch({ email })} /></label>
                      <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
                      <label>Message<textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></label>
                      {c.email_status === "failed" && <p className="error small">Last attempt failed: {c.email_error}</p>}
                      <button className="btn primary wide" disabled={sending || !email} onClick={saveAndSend}>
                        {sending ? "Sending…" : `Send ${c.decision === "invite" ? "invite" : "rejection"}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
        <button className="link danger-link" onClick={onRemove}>Remove candidate</button>
      </aside>
    </div>
  );
}
