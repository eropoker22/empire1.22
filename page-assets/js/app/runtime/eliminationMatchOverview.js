import { resolveAuthoritativeMatchCountdowns, formatEliminationRemainingMs } from "./authoritativeEliminationCountdown.js";

const duration = (value) => formatEliminationRemainingMs(value);
const calendar = (value, zone) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  try { return new Intl.DateTimeFormat("cs-CZ", { timeZone: zone || "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
  catch { return ""; }
};

/** Presentation only: conditions, durations and calendar windows come from the server. */
export function createMatchOverviewViewModel(slice, base, nowMs) {
  if (!slice) return base;
  const elimination = slice.elimination || slice.player?.elimination || {};
  const final = slice.player?.finalLockdown || {};
  const clocks = resolveAuthoritativeMatchCountdowns(slice, nowMs);
  const rate = Number(slice.mode?.tickRateMs);
  const quiet = elimination.quietHoursWindow;
  const zone = quiet?.timeZone || elimination.quietHours?.timeZone;
  const sections = [];
  const vm = { ...base, scheduleSections: sections, phaseLabel: "Běžná hra", rules: [], personalStatus: "" };
  const deadlineCalendar = (tick) => tick != null && Number.isFinite(rate) && Number.isFinite(Date.parse(slice.server?.logicalTime || ""))
    ? calendar(new Date(Date.parse(slice.server.logicalTime) + (tick - slice.server.currentTick) * rate).toISOString(), zone) : "";
  const playerStatus = elimination.playerStatus;
  vm.personalStatus = !playerStatus ? "Osobní pořadí zatím není dostupné."
    : playerStatus === "defeated" ? "Byl jsi vyřazen. Sleduješ další průběh zápasu."
    : playerStatus && playerStatus !== "active" ? "Divácký stav — nejsi mezi aktivními hráči."
    : elimination.currentPlayerStatus === "critical" ? "Jsi poslední v průběžném pořadí. Při další očistě ti hrozí vyřazení."
    : elimination.currentPlayerStatus === "danger" ? "Jsi v ohrožené skupině. Rozhoduje pořadí v okamžiku očisty."
    : "Nyní nejsi poslední. Pořadí se může změnit až do očisty.";
  if (playerStatus !== "active") vm.actions = [];
  vm.countdownLabel = "Další očista za";
  vm.countdownValue = duration(clocks.elimination.remainingMs);
  vm.subtitle = elimination.deferredFromTick != null ? "Termín očisty byl odložen kvůli nočnímu klidu." : "Rozhodne serverové pořadí v okamžiku očisty.";
  if (clocks.elimination.remainingMs === 0) vm.subtitle = "Čekám na potvrzení očisty ze serveru.";
  vm.calendarLabel = clocks.clockState === "running" ? deadlineCalendar(elimination.nextEliminationTick) : "";

  if (quiet) sections.push({ key: "quiet", title: quiet.active ? "Noční klid · končí za" : "Noční klid začne za",
    value: duration(clocks.quietRemainingMs), detail: `${quiet.active ? "Končí" : "Okno"}: ${calendar(quiet.active ? quiet.endsAt : quiet.startsAt, zone)}${!quiet.active ? ` – ${calendar(quiet.endsAt, zone)}` : ""} · ${zone}`,
    note: quiet.active ? "Očista plánovaná do tohoto okna se odkládá. Ostatní akce mají svá vlastní pravidla." : "Skutečné kalendářní okno; herní den a noc jsou samostatný ekonomický cyklus." });
  else sections.push({ key: "quiet", title: "Noční klid", value: elimination.quietHours?.enabled ? "Čekám na data" : "Vypnutý", detail: "Platí nastavení tohoto serveru." });

  if (final.enabled && !final.active && !final.result) {
    const start = final.startConditions;
    const waiting = start?.waitingFor === "registration" ? "Čeká se na uzavření registrace."
      : start?.waitingFor === "survivors" ? `Čeká se na nejvýše ${start.effectiveSurvivorThreshold} přeživších; nyní ${start.activePlayers}.`
      : start?.waitingFor === "confirmation" ? "Podmínky jsou připravené; čeká se na potvrzení serveru." : "Čeká se na nejdřívější povolený start a počet přeživších.";
    sections.push({ key: "final-start", title: "Final Lockdown", value: clocks.earliestStartMs > 0 ? `Nejdříve za ${duration(clocks.earliestStartMs)}` : "Finále zatím nezačalo",
      detail: waiting, note: [start?.effectiveSurvivorThreshold != null ? `Hranice: ${start.effectiveSurvivorThreshold} hráčů.` : "Hranici určí server po uzavření registrace.",
        start?.registrationBaselinePlayers != null ? `Registrační základna: ${start.registrationBaselinePlayers}.` : "",
        clocks.latestStartMs != null ? `Nejpozdější start ${clocks.latestStartMs > 0 ? `za ${duration(clocks.latestStartMs)}` : "čeká na potvrzení"}; registrace musí být uzavřena.` : "",
        start?.singleSurvivorMayStartEarly ? "Jediný přeživší může začít dříve po uzavření registrace." : "",
        Number.isFinite(rate) ? `Délka: ${duration(final.activeDurationTicks * rate)} aktivního času.` : ""].filter(Boolean).join(" ") });
  } else if (!final.enabled) sections.push({ key: "final-start", title: "Final Lockdown", value: "Vypnutý", detail: "Tento server finále nepoužívá." });
  if (elimination.eliminationsStopped) { vm.countdownValue = "Zastavena"; vm.subtitle = "Běžná očista je podle pravidel tohoto serveru zastavena."; }
  if (!elimination.enabled) { vm.countdownValue = "Vypnuta"; vm.subtitle = "Tento server očistu nepoužívá."; }
  if (final.active) {
    if (playerStatus === "active") vm.personalStatus = final.currentPlayerRank ? `Průběžná pozice #${final.currentPlayerRank}. Rozhodne finální skóre při ukončení.` : "Čekám na průběžné pořadí.";
    vm.phaseLabel = final.pausedByQuietHours ? "Finále pozastaveno — noční klid" : "Final Lockdown";
    vm.countdownLabel = "Do konce Final Lockdownu";
    vm.countdownValue = duration(clocks.finalActiveMs);
    vm.subtitle = final.pausedByQuietHours ? "Zbývající aktivní čas stojí. Noční klid se do délky finále nepočítá." : "Zbývající aktivní čas · průběžné pořadí, o vítězi ještě není rozhodnuto.";
    if (clocks.finalActiveMs === 0) vm.subtitle = "Čekám na konečný výsledek ze serveru.";
    vm.calendarLabel = clocks.clockState === "running" && final.endsAtEstimatedTick != null ? `Odhad konce: ${deadlineCalendar(final.endsAtEstimatedTick)}` : "";
    if (final.pausedByQuietHours && sections[0]?.key === "quiet") {
      sections[0].title = "Pokračuje za";
      sections[0].note = clocks.quietRemainingMs === 0 ? "Čekám na potvrzení obnovení ze serveru." : "Po skončení klidu pokračuje uložený aktivní čas finále.";
    }
    sections.push({ key: "elimination", title: "Běžná očista", value: "Zastavena", detail: "V závěru rozhoduje individuální finální skóre." });
  }
  if (quiet?.active && !final.active) vm.phaseLabel = "Noční klid";
  if (clocks.clockState === "waiting_start") {
    vm.phaseLabel = "Registrace / čekání na start"; vm.countdownLabel = "Stav zápasu"; vm.countdownValue = "Čeká na start";
    vm.subtitle = elimination.firstEliminationDelayTicks != null ? `První očista ${duration(elimination.firstEliminationDelayTicks * rate)} po aktivaci startu.` : "Termín první očisty zatím není potvrzen.";
    vm.personalStatus = "Start a pravidla zápasu potvrzuje server.";
  }
  if (["paused", "stale", "loading"].includes(clocks.clockState)) {
    vm.phaseLabel = clocks.clockState === "paused" ? "Server pozastaven" : "Čekám na aktuální data";
    vm.countdownLabel = vm.phaseLabel; vm.countdownValue = clocks.clockState === "paused" && final.active ? duration(clocks.finalActiveMs) : "—";
    vm.subtitle = "Kalendářní termín bude upřesněn po obnovení serverového stavu. Toto není noční klid.";
    for (const section of sections) { section.value = "—"; section.detail = "Čas čeká na aktuální serverový stav."; }
  }
  if (final.result || clocks.clockState === "ended") {
    vm.phaseLabel = "Zápas ukončen"; vm.countdownLabel = "Konečný výsledek"; vm.countdownValue = final.result?.currentPlayerRank ? `#${final.result.currentPlayerRank}` : "Ukončeno";
    vm.subtitle = "Definitivní pořadí potvrzené serverem."; vm.calendarLabel = calendar(final.result?.endedAt, zone);
    vm.leaderboardTitle = "Konečné pořadí";
    vm.leaderboard = (final.result?.ranking || []).map((entry) => ({ ...entry, name: entry.playerName, districts: "", isCurrentPlayer: entry.playerId === slice.player?.playerId }));
    vm.scheduleSections = []; vm.actions = []; vm.personalStatus = final.result?.winnerPlayerId === slice.player?.playerId ? "Zvítězil jsi." : "Tvůj výsledek je uveden v konečném pořadí.";
  }
  vm.rules = [
    elimination.enabled ? `Při jedné očistě vypadne ${elimination.playersEliminatedPerRound ?? 1} nejslabší aktivní gang podle skóre a pravidel shody. Zvýrazněná ohrožená skupina není počet současně vyřazených. Další interval: ${duration(elimination.intervalTicks * rate)}.` : "Očista je v této konfiguraci vypnutá.",
    "Skóre očisty zahrnuje území, jejich vliv, aktivní budovy, ekonomickou hodnotu peněz a zásob, investice, lidi a aktivitu. Vlastní bodové příspěvky najdeš níže. Získání území může pomoci, nezaručuje přežití.",
    "Finální skóre přidává bonusy za Downtown a vzácné budovy a odečítá postih za HEAT. Vítězí jednotlivec podle konečného pořadí; aliance nezaručuje společné vítězství.",
    "Herní den a noc ovlivňují ekonomiku a dostupnost jednotlivých akcí. Skutečný noční klid odkládá očistu a při zapnuté pauze zastaví aktivní čas finále. Nevypíná automaticky výrobu ani veškerý boj. Platí dostupnost konkrétní akce na serveru."
  ];
  return vm;
}
