// Simple password gate: Arjun is the only user. Cookie holds a hash of the password, not the password.
export const COOKIE = "kargo_session";

export async function sessionToken(): Promise<string> {
  const pw = process.env.APP_PASSWORD?.trim() || "";
  const data = new TextEncoder().encode(`kargo:${pw}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
