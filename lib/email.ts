// Output step: send via Resend, only when the founder clicks Send.
export async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.RESEND_FROM?.trim() || "Kargo Hiring <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [process.env.EMAIL_OVERRIDE_TO?.trim() || to],
      reply_to: process.env.REPLY_TO?.trim() || undefined,
      subject,
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id: string };
}

export function fillName(text: string, fullName: string | null) {
  const first = (fullName || "there").split(" ")[0];
  return text.replace(/\{\{\s*first_name\s*\}\}/g, first);
}
