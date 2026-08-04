"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import daily from "@/src/data/daily.json";
import alertsRaw from "@/src/data/alerts.json";
import briefings from "@/src/data/briefings.json";

type Day = (typeof daily)[number];
type Briefing = (typeof briefings)[number];

const VERTICAL_TR: Record<string, string> = {
  flight: "Uçak", hotel: "Otel", bus: "Otobüs", car: "Araç", transfer: "Transfer",
};
const CHANNEL_TR: Record<string, string> = {
  mobile_app: "Mobil Uygulama", mobile_web: "Mobil Web", web: "Web",
};

const fmtM = (n: number) => (n / 1_000_000).toFixed(1).replace(".", ",") + "M ₺";
const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "K" : String(n);
const fmtPct = (n: number, d = 1) => (n * 100).toFixed(d).replace(".", ",") + "%";
const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });

function dayTotals(d: Day) {
  const vs = Object.values(d.verticals);
  const gmv = vs.reduce((a, v) => a + v.gmv, 0);
  const revenue = vs.reduce((a, v) => a + v.revenue, 0);
  const bookings = vs.reduce((a, v) => a + v.bookings, 0);
  const cancels = vs.reduce((a, v) => a + v.cancellations, 0);
  const visits = Object.values(d.channels).reduce((a, c) => a + c.visits, 0);
  const chBookings = Object.values(d.channels).reduce((a, c) => a + c.bookings, 0);
  return { gmv, revenue, bookings, cancels, cancelRate: cancels / bookings, conv: chBookings / visits };
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  const color = Math.abs(value) < 0.005 ? "var(--ink-soft)" : good ? "var(--accent-dark)" : "var(--critical)";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "—";
  return (
    <span className="num" style={{ color, fontSize: 12, fontWeight: 600 }}>
      {arrow} {fmtPct(Math.abs(value))} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>7g ort.</span>
    </span>
  );
}

export default function Dashboard() {
  const briefingDates = briefings.map((b) => b.date).sort();
  const [selected, setSelected] = useState(briefingDates[briefingDates.length - 1]);

  const idx = daily.findIndex((d) => d.date === selected);
  const day = daily[idx];
  const briefing = briefings.find((b) => b.date === selected) as Briefing;
  const t = dayTotals(day);

  const week = daily.slice(Math.max(0, idx - 7), idx).map(dayTotals);
  const avg = (f: (x: ReturnType<typeof dayTotals>) => number) =>
    week.reduce((a, x) => a + f(x), 0) / week.length;

  const trend = useMemo(
    () =>
      daily.slice(Math.max(0, idx - 29), idx + 1).map((d) => {
        const x = dayTotals(d);
        return {
          date: d.date.slice(5),
          GMV: Math.round(x.gmv / 1e6 * 10) / 10,
          "İptal %": Math.round(x.cancelRate * 1000) / 10,
        };
      }),
    [idx]
  );

  const verticalData = Object.entries(day.verticals).map(([k, v]) => ({
    name: VERTICAL_TR[k], GMV: Math.round(v.gmv / 1e6 * 10) / 10,
    Gelir: Math.round(v.revenue / 1e6 * 10) / 10,
  }));

  const channelData = Object.entries(day.channels).map(([k, c]) => ({
    name: CHANNEL_TR[k],
    "Dönüşüm %": Math.round((c.bookings / c.visits) * 1000) / 10,
    pay: c.bookings,
  }));
  const chTotal = channelData.reduce((a, c) => a + c.pay, 0);

  const dayAlerts = (alertsRaw as any[]).filter((a) => a.date === selected);

  const kpis = [
    { label: "GMV", value: fmtM(t.gmv), delta: t.gmv / avg((x) => x.gmv) - 1, invert: false },
    { label: "Net Gelir", value: fmtM(t.revenue), delta: t.revenue / avg((x) => x.revenue) - 1, invert: false },
    { label: "Rezervasyon", value: fmtK(t.bookings), delta: t.bookings / avg((x) => x.bookings) - 1, invert: false },
    { label: "İptal Oranı", value: fmtPct(t.cancelRate), delta: t.cancelRate / avg((x) => x.cancelRate) - 1, invert: true },
    { label: "Dönüşüm", value: fmtPct(t.conv), delta: t.conv / avg((x) => x.conv) - 1, invert: true ? false : false },
  ];

  const critical = dayAlerts.some((a) => a.severity === "critical");

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px 60px" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 0", borderBottom: "1px solid var(--line)", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--accent)" }}>Pulse</span> OTA
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Yönetici Karar Paneli · POC
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {briefingDates.map((d) => (
            <button key={d} onClick={() => setSelected(d)}
              style={{
                border: "1px solid " + (d === selected ? "var(--accent)" : "var(--line)"),
                background: d === selected ? "var(--accent)" : "var(--card)",
                color: d === selected ? "#fff" : "var(--ink-soft)",
                borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600,
                cursor: "pointer",
              }}>
              {d.slice(8)}.{d.slice(5, 7)}
            </button>
          ))}
        </div>
      </header>

      <p style={{ margin: "14px 0 12px", fontSize: 13.5, color: "var(--ink-soft)" }}>
        {fmtDate(selected)} · Veri: sentetik, seed(42) · Brifing: LLM tarafından üretildi (n8n + Claude)
      </p>

      {/* Sentetik veri uyarı bandı */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--warn-tint)", border: "1px solid var(--warn-line)",
        borderRadius: 10, padding: "10px 14px", marginBottom: 18,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", whiteSpace: "nowrap",
          color: "#fff", background: "var(--warn)", borderRadius: 999, padding: "3px 9px",
        }}>
          SENTETİK VERİ
        </span>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          Bu panelde görünen tüm veriler sentetiktir (seed=42). Gerçek bir şirkete ait değildir.
        </span>
      </div>

      {/* KPI row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 12, marginBottom: 18,
      }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {k.label}
            </div>
            <div className="num" style={{ fontSize: 26, fontWeight: 800, margin: "4px 0 2px" }}>{k.value}</div>
            <Delta value={k.delta} invert={k.invert} />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", gap: 18, alignItems: "start" }}
        className="main-grid">
        {/* Sabah Brifingi — imza panel */}
        <section style={{
          background: critical ? "var(--critical-tint)" : "var(--accent-tint)",
          border: `1px solid ${critical ? "var(--critical)" : "var(--accent)"}`,
          borderRadius: 14, padding: "20px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
              color: critical ? "var(--critical)" : "var(--accent-dark)",
            }}>
              ☀ Sabah Brifingi
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>07:00'de otomatik üretildi</span>
          </div>
          <h1 style={{ fontSize: 19, lineHeight: 1.35, fontWeight: 800, marginBottom: 14 }}>
            {briefing.headline}
          </h1>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 10 }}>
              <strong style={{ color: "var(--ink-soft)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ne oldu · </strong>
              {briefing.what}
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong style={{ color: "var(--ink-soft)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Neden · </strong>
              {briefing.why}
            </p>
            <div>
              <strong style={{ color: "var(--ink-soft)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ne yapmalı</strong>
              <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: "none" }}>
                {briefing.actions.map((a, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: critical ? "var(--critical)" : "var(--accent-dark)", fontWeight: 800 }}>→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Sağ kolon: grafikler + alertler */}
        <div style={{ display: "grid", gap: 18 }}>
          <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>GMV ve İptal Oranı — son 30 gün</h2>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10.5 }} interval={4} />
                <YAxis yAxisId="l" tick={{ fontSize: 10.5 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10.5 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="l" type="monotone" dataKey="GMV" stroke="#4338ca" fill="url(#g)" strokeWidth={2} name="GMV (M₺)" />
                <Area yAxisId="r" type="monotone" dataKey="İptal %" stroke="#d5382e" fill="none" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="two-col">
            <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Dikey kırılımı (GMV / Gelir, M₺)</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={verticalData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10.5 }} />
                  <YAxis tick={{ fontSize: 10.5 }} />
                  <Tooltip />
                  <Bar dataKey="GMV" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gelir" fill="#1e293b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Kanal dönüşümü</h2>
              {channelData.map((c) => (
                <div key={c.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{c.name} <span style={{ color: "var(--ink-soft)" }}>· pay {fmtPct(c.pay / chTotal, 0)}</span></span>
                    <span className="num" style={{ fontWeight: 700 }}>{String(c["Dönüşüm %"]).replace(".", ",")}%</span>
                  </div>
                  <div style={{ height: 8, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${(c["Dönüşüm %"] / 4) * 100}%`, height: "100%",
                      background: "var(--accent)", borderRadius: 4,
                    }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>
                Ziyaret → rezervasyon dönüşümü, kanal bazında
              </p>
            </section>
          </div>

          <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              Anomali Merkezi <span style={{ color: "var(--ink-soft)", fontWeight: 400, fontSize: 12 }}>· kural tabanlı tespit</span>
            </h2>
            {dayAlerts.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                ✓ Bu gün için anomali tespit edilmedi. Tüm metrikler 7 günlük bantta.
              </p>
            ) : (
              dayAlerts.map((a, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 8,
                  background: a.severity === "critical" ? "var(--critical-tint)" : "var(--info-tint)",
                  border: `1px solid ${a.severity === "critical" ? "var(--critical)" : "var(--info)"}22`,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, alignSelf: "flex-start", padding: "3px 8px",
                    borderRadius: 999, color: "#fff", whiteSpace: "nowrap",
                    background: a.severity === "critical" ? "var(--critical)" : "var(--info)",
                  }}>
                    {a.severity === "critical" ? "KRİTİK" : "BİLGİ"}
                  </span>
                  <div style={{ fontSize: 13 }}>
                    <strong>{VERTICAL_TR[a.vertical] ?? "Genel"} · {a.type}</strong>
                    <div style={{ color: "var(--ink-soft)", marginTop: 2 }}>{a.detail}</div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <footer style={{ marginTop: 28, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
        <strong>Mimari:</strong> tespit deterministik (kural motoru), yorum ve öneri LLM (Claude via n8n).
        Sentetik veri, Türkiye OTA pazarının kamuya açık gelir mekaniklerine göre kurgulandı: dikey bazlı komisyon, iptal ekonomisi, kanal hunisi.
        Kerem Ayan · POC
      </footer>

      <style jsx>{`
        @media (max-width: 900px) {
          .main-grid { grid-template-columns: 1fr !important; }
          .two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
