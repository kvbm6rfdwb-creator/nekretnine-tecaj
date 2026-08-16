import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tečaj - Agent posredovanja u prometu nekretnina",
  description: "Interaktivni tečaj za pripremu stručnog ispita agenta nekretnina",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
