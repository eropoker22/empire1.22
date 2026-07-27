export const SERVER_DEFEAT_NOTICE_KINDS = Object.freeze({
  purge: "purge",
  territory: "territory"
});

const NOTICE_COPY = Object.freeze({
  [SERVER_DEFEAT_NOTICE_KINDS.purge]: Object.freeze({
    status: "OČISTA // ELIMINACE",
    title: "OČISTA TĚ VYŘADILA",
    lead: "Server uzavřel tvoji válku o město.",
    reasonLabel: "DŮVOD VYŘAZENÍ",
    reasonText: "Při pravidelném vyhodnocení Očisty byl tvůj gang nejslabší aktivní silou na serveru.",
    code: "PURGE_ELIMINATION"
  }),
  [SERVER_DEFEAT_NOTICE_KINDS.territory]: Object.freeze({
    status: "ÚZEMÍ // ZTRACENO",
    title: "TVÉ IMPÉRIUM PADLO",
    lead: "Poslední opěrný bod tvého gangu přestal existovat.",
    reasonLabel: "DŮVOD VYŘAZENÍ",
    reasonText: "Přišel jsi o poslední aktivní district. Soupeř ho převzal nebo byl district zničen.",
    code: "LAST_DISTRICT_LOST"
  })
});

export function createServerDefeatNoticeViewModel(gameplaySlice = {}) {
  const elimination = gameplaySlice?.elimination || gameplaySlice?.player?.elimination || null;
  const defeat = elimination?.currentPlayerDefeat || null;
  const defeated = elimination?.playerStatus === "defeated"
    || elimination?.currentPlayerStatus === "defeated";
  if (!defeated || !defeat?.reason) return null;
  const kind = defeat.reason === "scheduled_weakest_player"
    ? SERVER_DEFEAT_NOTICE_KINDS.purge
    : SERVER_DEFEAT_NOTICE_KINDS.territory;
  const serverInstanceId = String(gameplaySlice?.server?.serverInstanceId || "unknown-server");
  const playerId = String(gameplaySlice?.player?.playerId || "unknown-player");
  const eliminatedAtTick = Math.max(0, Number(defeat.eliminatedAtTick || 0));
  const finalPlacement = Number(defeat.finalPlacement);
  return Object.freeze({
    ...NOTICE_COPY[kind],
    kind,
    serverInstanceId,
    playerId,
    eliminatedAtTick,
    finalPlacement: Number.isFinite(finalPlacement) && finalPlacement > 0 ? finalPlacement : null,
    announcementId: `${serverInstanceId}:${playerId}:${eliminatedAtTick}:${defeat.reason}`,
    lockTitle: "NOVÁ REGISTRACE JE UZAMČENÁ",
    lockText: "Do nového serveru se budeš moct registrovat až po skončení tohoto právě probíhajícího serveru.",
    actionLabel: "ROZUMÍM // ZAVŘÍT"
  });
}
