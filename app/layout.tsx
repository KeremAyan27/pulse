import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse OTA — Yönetici Karar Paneli",
  description:
    "LLM destekli sabah brifingi ve kural tabanlı anomali tespiti ile yönetici karar destek sistemi (POC)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
