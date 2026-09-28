import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kargo Hiring",
  description: "Ranked shortlist, interview briefs and one-click candidate emails for Kargo's PM and SPM roles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
