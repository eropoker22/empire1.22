# Netlify closed-alpha cost estimate

## Decision date and boundary

Estimate date: 2026-08-05.

This document estimates Netlify usage for the first Empire Streets closed alpha. It does not purchase a plan, change
billing, or include Neon PostgreSQL, Fly.io worker, domain registration, tax, or external observability costs.
Recheck the live Netlify pricing page immediately before opening testers because prices and credit weights can
change.

## Current credit assumptions

The current public Netlify credit model used for this estimate is:

| Meter | Assumed credit rate |
| --- | ---: |
| Production deploy | 15 credits each |
| Function compute | 10 credits per GB-hour |
| Bandwidth | 20 credits per GB |
| Web requests | 2 credits per 10,000 requests |

Current plan allowances used here:

| Plan | Public monthly price | Included credits | Relevant operational limit |
| --- | ---: | ---: | --- |
| Free | USD 0 | 300 | A credit exhaustion can pause projects; Function logs retained about 24 hours |
| Personal | USD 9 | 1,000 | Paid credit capacity and about 7 days of Function logs |
| Pro | USD 20 base | 3,000 starting credits | More team/analytics capacity; Function logs about 7 days |

Netlify's current pricing page and billing documentation remain authoritative:

- [Netlify pricing](https://www.netlify.com/pricing/)
- [How Netlify credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [April 2026 pricing update](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/)

## Usage model

The base scenario assumes:

- roughly 20 invited testers;
- several short gameplay sessions per tester each week;
- browser polling plus state-changing requests through Netlify Functions;
- isolated staging and production sites;
- guarded staging acceptance deployments, registration open/close deployments, and a small number of production
  releases;
- one external persistent worker, so continuous ticks do not consume Function compute;
- no public anonymous launch or paid traffic campaign.

Actual Function GB-hours depend on configured memory, cold starts, database latency, and request duration. The first
remote staging load/soak report must replace the assumed compute value before production registration opens.

## Monthly scenarios

| Scenario | Prod-context deploys | Bandwidth | Web requests | Function compute | Estimated credits |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low/manual alpha | 4 = 60 | 5 GB = 100 | 200k = 40 | 5 GB-h = 50 | **250** |
| Expected closed alpha | 10 = 150 | 8 GB = 160 | 600k = 120 | 25 GB-h = 250 | **680** |
| Heavy test/release month | 16 = 240 | 20 GB = 400 | 1.5m = 300 | 70 GB-h = 700 | **1,640** |

Formula:

```text
credits = deploys * 15
        + bandwidth_GB * 20
        + web_requests / 10,000 * 2
        + function_compute_GB_hours * 10
```

These are planning estimates, not an invoice. They intentionally exclude free allowances or promotional credits
that may not be durable.

## Recommendation

**Use Personal for the first controlled closed alpha, subject to live staging measurements.**

Reasons:

- Free's 300-credit hard limit is below the expected 680-credit month and only barely covers the low scenario.
- Exhaustion on Free can pause the site and potentially other projects on the same account, which is an avoidable
  release risk.
- Personal's 1,000 credits provide about 320 credits of base-scenario headroom and longer Function-log retention.
- The worker is external, so the architecture avoids paying Function credits for continuous ticks.

Choose Pro before opening testers if any of these is true:

- measured rolling forecast exceeds 750 credits before the month is 75% complete;
- expected monthly use exceeds 1,000 credits;
- the heavy scenario becomes normal rather than exceptional;
- multiple release operators require Pro team features;
- 30-day analytics/metrics or a larger safety margin is an explicit operational requirement.

Do not enable automatic paid overage without owner approval. If the account uses auto-recharge, configure a hard
budget and billing alerts first.

## Credit controls

Before inviting testers:

1. Enable Netlify credit notifications at 50%, 75%, 90%, and 100% where the plan supports them.
2. Record the initial credit balance and all sites sharing the account.
3. Limit staging release churn; registration open/close is a deployment and consumes credits.
4. Keep immutable assets cacheable and HTML/unversioned assets revalidated.
5. Track daily requests, bandwidth, Function invocations, average duration, memory, and cold-start failures.
6. Reforecast weekly and after every soak test.
7. Close registration before capacity or credit exhaustion can interrupt active sessions.

## Go/no-go use

- Free with an expected forecast above 250 credits and no emergency buffer: `NO-GO` for external testers.
- Personal with measured forecast below 750 credits, billing alerts, and no unexplained compute spike: acceptable for
  closed alpha.
- Pro: recommended when projected use no longer fits Personal with at least 25% headroom.

Plan suitability is only one release gate. A paid plan does not replace remote acceptance, database capacity,
worker health, privacy verification, backups, or rollback evidence.
