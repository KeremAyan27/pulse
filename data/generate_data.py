"""
Pulse OTA - Sentetik veri üretimi
Şema: bookings (rezervasyon + komisyon + iptal ekonomisi)
Kaynak varsayımlar: Türkiye OTA pazarının kamuya açık gelir mekanikleri (komisyon oranları, dikey dağılımı)
seed(42) - tekrarlanabilir
"""
import json
import random
import math
from datetime import date, timedelta

random.seed(42)

# ---- Varsayımlar (Türkiye OTA pazar mekaniklerinden) ----
VERTICALS = {
    # (GMV payı, ort. sepet TL, komisyon oranı, taban iptal oranı)
    "flight":   (0.60, 4200, 0.035, 0.08),
    "hotel":    (0.20, 6800, 0.14,  0.12),
    "bus":      (0.10, 650,  0.08,  0.06),
    "car":      (0.06, 3900, 0.10,  0.07),
    "transfer": (0.04, 1100, 0.12,  0.05),
}
CHANNELS = [("mobile_app", 0.48), ("mobile_web", 0.17), ("web", 0.35)]
CANCEL_REASONS = [("user", 0.62), ("supplier", 0.23), ("payment_error", 0.15)]
ROUTES = ["IST-ESB", "IST-ADB", "IST-AYT", "SAW-ADA", "IST-AMS", "IST-LHR",
          "IST-DXB", "SAW-BER", "IST-CDG", "ADB-IST", "AYT-SAW", "IST-JED"]
DESTS = ["Antalya", "Bodrum", "İstanbul", "Kapadokya", "İzmir", "Trabzon",
         "Amsterdam", "Londra", "Dubai", "Berlin"]

START = date(2026, 4, 7)   # 90 gün
DAYS = 90
BASE_DAILY_BOOKINGS = 5200  # günlük taban rezervasyon (ölçek temsili)

# Planlı anomaliler (demo senaryoları)
ANOMALY_PAYMENT_SPIKE = date(2026, 6, 29)   # ödeme hatası -> iptal patlaması
ANOMALY_FARE_DROP = date(2026, 6, 18)       # IST-AMS fiyat anomalisi -> talep patlaması
CAMPAIGN_START, CAMPAIGN_END = date(2026, 6, 8), date(2026, 6, 14)  # yaz kampanyası

def pick(weighted):
    r, acc = random.random(), 0.0
    for k, w in weighted:
        acc += w
        if r <= acc:
            return k
    return weighted[-1][0]

def seasonality(d: date) -> float:
    doy = d.timetuple().tm_yday
    summer = 1.0 + 0.35 * math.sin((doy - 100) / 365 * 2 * math.pi)  # yaza doğru artış
    weekday = 1.12 if d.weekday() in (0, 6) else (0.9 if d.weekday() == 5 else 1.0)
    bayram = 1.45 if date(2026, 5, 26) <= d <= date(2026, 5, 30) else 1.0  # Kurban B.
    return summer * weekday * bayram

daily = []
for i in range(DAYS):
    d = START + timedelta(days=i)
    mult = seasonality(d)
    campaign = CAMPAIGN_START <= d <= CAMPAIGN_END
    if campaign:
        mult *= 1.22
    n = int(BASE_DAILY_BOOKINGS * mult * random.uniform(0.94, 1.06))

    day = {"date": d.isoformat(), "is_campaign": campaign,
           "verticals": {}, "channels": {c: {"visits": 0, "bookings": 0} for c, _ in CHANNELS},
           "cancel_reasons": {k: 0 for k, _ in CANCEL_REASONS}}

    for v, (share, basket, comm, cancel_base) in VERTICALS.items():
        vn = int(n * share * random.uniform(0.92, 1.08))
        if v == "flight" and d == ANOMALY_FARE_DROP:
            vn = int(vn * 1.38)  # fiyat anomalisi talebi patlatır
        avg = basket * mult * random.uniform(0.96, 1.04)
        if v == "flight" and d == ANOMALY_FARE_DROP:
            avg *= 0.81
        gmv = vn * avg

        cr = cancel_base * random.uniform(0.85, 1.15)
        if d == ANOMALY_PAYMENT_SPIKE:
            cr = cancel_base * (3.1 if v == "flight" else 2.2)
        cancels = int(vn * cr)

        intl = 0.18 if v == "flight" else (0.10 if v == "hotel" else 0.0)
        corp = 0.09 if v in ("flight", "hotel", "car") else 0.02

        day["verticals"][v] = {
            "bookings": vn,
            "gmv": round(gmv),
            "revenue": round(gmv * comm + (vn * 89 if v == "flight" else 0)),  # uçakta hizmet bedeli
            "cancellations": cancels,
            "cancel_rate": round(cancels / vn, 4),
            "intl_share": intl,
            "corporate_share": corp,
        }

    for _ in range(int(n)):
        ch = pick(CHANNELS)
        day["channels"][ch]["bookings"] += 1
    for ch, _w in CHANNELS:
        conv = random.uniform(0.028, 0.036)
        if d == ANOMALY_PAYMENT_SPIKE and ch == "mobile_app":
            conv *= 0.74  # ödeme hatası dönüşümü düşürür
        day["channels"][ch]["visits"] = int(day["channels"][ch]["bookings"] / conv)

    total_cancels = sum(x["cancellations"] for x in day["verticals"].values())
    reasons = dict(CANCEL_REASONS)
    if d == ANOMALY_PAYMENT_SPIKE:
        reasons = {"user": 0.30, "supplier": 0.12, "payment_error": 0.58}
    for _ in range(total_cancels):
        day["cancel_reasons"][pick(list(reasons.items()))] += 1

    daily.append(day)

# ---- Anomali motoru (kural tabanlı) ----
# Aynı yaklaşım Lupa'da da kullanıldı:
# github.com/KeremAyan27/lupa-dashboard
def detect_anomalies(days):
    alerts = []
    for i in range(7, len(days)):
        d = days[i]
        win = days[i-7:i]
        for v in VERTICALS:
            base_cr = sum(x["verticals"][v]["cancel_rate"] for x in win) / 7
            if d["verticals"][v]["cancel_rate"] > base_cr * 1.8:
                alerts.append({"date": d["date"], "type": "cancel_spike", "vertical": v,
                               "severity": "critical",
                               "detail": f"{v} iptal oranı 7 günlük ortalamanın {d['verticals'][v]['cancel_rate']/base_cr:.1f} katı",
                               "value": d["verticals"][v]["cancel_rate"], "baseline": round(base_cr, 4)})
            base_b = sum(x["verticals"][v]["bookings"] for x in win) / 7
            if d["verticals"][v]["bookings"] > base_b * 1.3 and not d["is_campaign"]:
                alerts.append({"date": d["date"], "type": "demand_spike", "vertical": v,
                               "severity": "info",
                               "detail": f"{v} rezervasyonları 7 günlük ortalamanın %{(d['verticals'][v]['bookings']/base_b-1)*100:.0f} üzerinde",
                               "value": d["verticals"][v]["bookings"], "baseline": int(base_b)})
        pe = d["cancel_reasons"]["payment_error"]
        tot = sum(d["cancel_reasons"].values()) or 1
        if pe / tot > 0.35:
            alerts.append({"date": d["date"], "type": "payment_errors", "vertical": "all",
                           "severity": "critical",
                           "detail": f"İptallerin %{pe/tot*100:.0f}'i ödeme hatası kaynaklı (normal ~%15)",
                           "value": round(pe / tot, 2), "baseline": 0.15})
    return alerts

alerts = detect_anomalies(daily)

with open("data/daily.json", "w", encoding="utf-8") as f:
    json.dump(daily, f, ensure_ascii=False)
with open("data/alerts.json", "w", encoding="utf-8") as f:
    json.dump(alerts, f, ensure_ascii=False, indent=1)

print(f"{len(daily)} gün, {len(alerts)} alert üretildi")
print("Kritik alertler:", [a["date"] + " " + a["type"] for a in alerts if a["severity"] == "critical"][:6])
