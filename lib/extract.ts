// Context step: turn an uploaded CV into text, pull out PII, and produce the redacted text the AI sees.

export async function extractText(fileName: string, buf: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return clean(Array.isArray(text) ? text.join("\n") : text);
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return clean(value);
  }
  if (ext === "txt" || ext === "md") return clean(buf.toString("utf8"));
  throw new Error(`Unsupported file type: .${ext}. Upload PDF, DOCX or TXT.`);
}

function clean(s: string) {
  return s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,5}\)?[\s-]?){2,4}\d{3,5}/g;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|twitter\.com|x\.com)\/[^\s|·,]+/gi;

export type PII = { fullName: string; email: string | null; phone: string | null };

export function extractPII(text: string, fileName: string): PII {
  const email = (text.match(EMAIL_RE)?.[0] ?? null)?.replace(/\\_/g, "_") ?? null;
  const phoneMatch = text
    .match(PHONE_RE)
    ?.map((p) => p.trim())
    .find((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 13);
  return { fullName: guessName(text, fileName), email, phone: phoneMatch ?? null };
}

function nameFromFile(fileName: string): string | null {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^copy of\s+/i, "")
    .replace(/^(cv|pm|spm)?_?\d+_/i, "");
  const parts = base.split(/[_\-\s]+/).filter((p) => /^[a-z]+$/i.test(p));
  if (parts.length < 2 || parts.length > 4) return null;
  return parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

function guessName(text: string, fileName: string): string {
  const fromFile = nameFromFile(fileName);
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3);
  for (const line of firstLines) {
    // Line starts with 2-4 capitalised words and no digits/@ (e.g. "Priya Krishnan Product Manager +91...")
    const m = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
    if (!m) continue;
    const candidate = m[1].split(/\s+/);
    // If the filename gives a name and the first words agree, trust the filename version.
    if (fromFile && fromFile.split(" ")[0].toLowerCase() === candidate[0].toLowerCase()) return fromFile;
    if (!fromFile) return candidate.slice(0, 2).join(" ");
  }
  return fromFile ?? "Candidate";
}

// Personal details never reach the AI model.
export function redact(text: string, pii: PII): string {
  let out = text.replace(EMAIL_RE, "[EMAIL]").replace(URL_RE, "[PROFILE_URL]");
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 10 && digits <= 13 ? "[PHONE]" : m;
  });
  for (const part of pii.fullName.split(/\s+/).filter((p) => p.length > 2)) {
    out = out.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "gi"), "[CANDIDATE]");
  }
  out = out.replace(/(\[CANDIDATE\][\s]*){2,}/g, "[CANDIDATE] ");
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
