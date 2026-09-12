import { readAuthoritativeSnapshotClock } from "../../../../packages/shared-types/src/views/authoritative-snapshot-clock.js";
import { formatEliminationRemainingMs } from "./authoritativeEliminationCountdown.js";

export function remainingUntilTick(slice, tick) {
  const clock = readAuthoritativeSnapshotClock(slice);
  const ticks = Number(tick) - Number(slice?.server?.currentTick || 0);
  return Number.isFinite(ticks) ? Math.max(0, ticks * Number(slice?.mode?.tickRateMs || 10000) - clock.elapsedMs) : 0;
}

export function readTickCountdown(slice, tick, format = formatEliminationRemainingMs) {
  const clock = readAuthoritativeSnapshotClock(slice);
  if (!["running", "paused", "ended"].includes(clock.state) || tick == null || !Number.isFinite(Number(tick))) {
    return { label: "Čeká na server", expired: false };
  }
  if (clock.state === "ended") return { label: "Server ukončen", expired: true };
  if (Number(slice.server.currentTick) >= Number(tick)) return { label: "Dokončeno", expired: true };
  const remaining = remainingUntilTick(slice, tick);
  return { label: clock.state === "paused" ? `Pozastaveno · ${format(remaining)}`
    : remaining > 0 ? format(remaining) : "Čeká na potvrzení serveru", expired: false };
}
