# Pulse — Executive Decision Support (POC)

A single-screen morning brief for a multi-vertical online travel agency.
Rule-based anomaly detection at the core, an LLM on top for interpretation —
never the other way around.

Live demo: <https://pulse-chi-ashen.vercel.app>

Stack: Next.js 14 · TypeScript · Recharts · Python/pandas · n8n · Claude API · Vercel

> All figures shown are synthetic (`seed=42`). They do not belong to any real company.

## The problem

Management at a large travel marketplace already has access to daily
operational data. Turning that data into a decision still takes three manual
steps: *what happened* (pulling the report), *why* (analysis), *what to do*
(recommending an action). The loop takes hours.

For routine days that is merely wasteful. For a real incident — a spike in
cancellations traced to a payment provider, say — the delay converts directly
into lost revenue.

Pulse runs those three steps automatically at 07:00 every morning. The
intended user is internal: the executive team.

## How it works

```
data → daily aggregation (Python)
     → anomaly engine (rule-based, 7-day baseline)
     → Claude API (n8n, 07:00 cron)
     → morning brief → dashboard + email
```

**The core principle: detection is deterministic, interpretation is AI.**
Every number and every flag comes from the rule engine. The LLM only receives
what the rules produced and writes the explanation and the suggested actions.

That split is a precondition, not a preference. Management reporting has to
be reproducible — the same data must always produce the same flags — and it
has to be auditable, because "the model thought so" is not something an
executive can act on. The hard part was never noticing that GMV moved 21%; it
was writing the sentence explaining why, in a form someone reads in thirty
seconds.

## What the user sees

One screen. Five KPI cards along the top — GMV, net revenue, bookings,
cancellation rate, conversion — each against its 7-day average. The morning
brief on the left in a fixed three-part format: *what happened / why / what to
do*. On the right: 30-day trend, vertical breakdown, channel conversion, and
the anomaly center.

**Demo scenario.** A payment-provider-driven cancellation spike is embedded in
the data on 29 June. Select that date and the rule engine raises six critical
alerts; the brief opens with a `CRITICAL` header and proposes four actions —
a technical bridge with the provider, an alternative payment method, a
customer-service script, and segmentation of affected users. The next day's
brief reports the recovery and proposes a win-back campaign. The system tracks
the incident end to end.

## Data & reproducibility

No real company data was available, so the dataset is synthetic and
regenerable — 90 days, `seed(42)` — built from an explicit model of OTA
economics rather than random noise:

- **Vertical GMV mix:** flights ~60%, hotels ~20%, bus ~10%, car + transfer ~10%
- **Commission assumptions:** flights ~3.5% + service fee, hotels ~14%,
  bus ~8%, car ~10%, transfer ~12%
- **Cancellation economics:** reason breakdown (user / supplier / payment
  error), with per-vertical base rates
- **Channel funnel:** visit → booking conversion, mobile-weighted traffic (~65%)
- **Seasonality**, a holiday peak, a campaign period, and two planned anomaly
  scenarios

This schema is what makes it an OTA decision panel rather than a generic
e-commerce dashboard: bookings, commission, and cancellation economics are
modelled, not approximated.

```
python3 data/generate_data.py   # regenerate the dataset
```

## Success metrics

| Metric | Manual process | With the POC |
|---|---|---|
| Time to prepare the daily management report | ~45 min/day (analyst) | < 1 min, automatic (07:00) |
| Time to notice an anomaly | Hours — tied to the reporting cycle | Guaranteed by 07:00 next morning; extendable to instant alerts for criticals |
| Time for an executive to grasp the situation | Scanning multiple sources | One brief, ~90 seconds |

Additional metric: the adoption rate of actions proposed in the brief — it
measures whether the system is producing decisions, not just being read.

## Tools used

Claude (code generation and the briefing LLM) · Claude Code (development) ·
n8n (orchestration) · Python/pandas (data) · Next.js 14 + TypeScript +
Recharts (dashboard) · Vercel (deploy)

## Limitations & next steps

- The data is synthetic. A real integration would start with a data
  dictionary and agreed metric definitions.
- Anomaly thresholds are fixed (7-day average × coefficient). Production
  needs dynamic thresholds adjusted for seasonality.
- Briefs are daily. Instant Slack/SMS notification for critical alerts is the
  natural second phase.
- Per-vertical depth — route-level price anomalies, hotel inventory signals —
  is the third.

## Related

The foundation of this concept was built in my capstone project,
[lupa-dashboard](https://github.com/KeremAyan27/lupa-dashboard) — a
mobile-first executive decision panel on e-commerce data. Pulse redesigns the
system around travel-marketplace mechanics: the OTA data schema, commission
and cancellation economics, the channel funnel, and the LLM briefing layer are
specific to this work. Carrying a proven concept into a new domain on that
domain's own mechanics was a deliberate choice.

---

Kerem Ayan · POC
