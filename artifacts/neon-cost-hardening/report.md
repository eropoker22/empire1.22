# Neon Cost Hardening

## Root cause

The hosted worker loop ran every 5 seconds. For every running instance it loaded the full recovery
head in ensureRuntime and again for heartbeat. Every due 10-second tick loaded it once more, while
saveRecoveryHead downloaded the previous payload for compare-and-swap. That is 2160
full reads/hour for one continuously running server. The measured staging snapshot was
395,035 bytes.

Hosted gameplay load/submit also hydrated the recovery head before every request, even when a warm
runtime already matched the persisted root version.

## Measured baseline and after

| Metric | Before | After |
| --- | ---: | ---: |
| snapshot bytes | 395035 | 395035 |
| full reads / 100 ticks | 600 | 0 |
| full read bytes / 100 ticks | 237021000 | 0 |
| metadata reads / 100 ticks | 0 | 600 |
| 20-player unchanged full reads / min | 120 | 0 |
| 20-player unchanged estimated DB bytes / min | 47404200 | 19200 |

Full snapshot read reduction on the stable worker workload: 100%.
Estimated returned-byte reduction including metadata rows: 99.96%.

Full snapshot write cadence remains one authoritative recovery-head write per tick. This sprint does
not risk recovery correctness by changing checkpoint or write cadence.
