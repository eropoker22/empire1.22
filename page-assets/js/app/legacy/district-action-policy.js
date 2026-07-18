export const DISTRICT_ACTION_CATALOG = Object.freeze([
  Object.freeze({
    id: "defense",
    defaultLabel: "Obrana"
  }),
  Object.freeze({
    id: "trap",
    defaultLabel: "Past"
  }),
  Object.freeze({
    id: "attack",
    defaultLabel: "Zaútočit"
  }),
  Object.freeze({
    id: "heist",
    defaultLabel: "Vykrást hráče"
  }),
  Object.freeze({
    id: "occupy",
    defaultLabel: "Obsadit"
  }),
  Object.freeze({
    id: "rob",
    defaultLabel: "Vykrást district"
  }),
  Object.freeze({
    id: "spy",
    defaultLabel: "Špehovat"
  })
]);

// Preview-only legacy policy used by the static shell. Server-fed gameplay slice commands own final outcomes.
export function resolveDistrictActions(context) {
  const {
    districtId,
    isOwnedByCurrentPlayer,
    hasAdjacentOwnedDistrict,
    isUnoccupied,
    canOccupyAfterSpy,
    availableSpies,
    isOccupying,
    hasActiveOccupation,
    isSpying,
    isRobbing,
    isDowntownOccupationLocked,
    currentTrapDistrictId,
    trapMoveCooldownSeconds
  } = context;

  if (context.isDestroyed) {
    return DISTRICT_ACTION_CATALOG.map((action) => ({
      id: action.id,
      visible: false,
      enabled: false,
      label: action.defaultLabel,
      reason: `District ${districtId} je zničený.`
    }));
  }

  if (isOccupying) {
    return DISTRICT_ACTION_CATALOG.map((action) => ({
      id: action.id,
      visible: false,
      enabled: false,
      label: action.defaultLabel,
      reason: `District ${districtId} je obsazován.`
    }));
  }

  if (context.serverAuthoritative) {
    return DISTRICT_ACTION_CATALOG
      .filter((action) => action.id !== "defense")
      .map((action) => {
        const blockedByRobbery = action.id === "occupy" && isRobbing;
        const blockedByOccupation = action.id === "occupy" && hasActiveOccupation;
        const blocked = blockedByRobbery || blockedByOccupation;
        return {
          id: action.id,
          visible: true,
          enabled: !blocked,
          label: action.defaultLabel,
          stacked: blocked,
          subtitle: blockedByOccupation ? "Přijď později" : (blockedByRobbery ? "Teď ne" : ""),
          disabledTone: blockedByOccupation ? "occupation" : (blockedByRobbery ? "robbery" : ""),
          title: blockedByOccupation
            ? "Jedno obsazování už probíhá. Další můžeš spustit po jeho dokončení."
            : (blockedByRobbery ? `District ${districtId} právě vykrádáš. Obsazení lze spustit až po dokončení vykradení.` : ""),
          reason: blockedByOccupation
            ? "Jedno obsazování už probíhá. Další můžeš spustit po jeho dokončení."
            : (blockedByRobbery ? `District ${districtId} právě vykrádáš. Obsazení lze spustit až po dokončení vykradení.` : null)
        };
      });
  }

  return DISTRICT_ACTION_CATALOG.map((action) => {
    if (action.id === "defense") {
      const visible = isOwnedByCurrentPlayer;

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible ? null : `Obranu lze upravit jen na vlastním districtu ${districtId}.`
      };
    }

    if (action.id === "trap") {
      const visible = isOwnedByCurrentPlayer;
      const hasTrapElsewhere = Number(currentTrapDistrictId) > 0 && Number(currentTrapDistrictId) !== Number(districtId);
      const hasTrapHere = Number(currentTrapDistrictId) === Number(districtId);
      const isMoveOnCooldown = hasTrapElsewhere && Number(trapMoveCooldownSeconds) > 0;
      const label = hasTrapHere
        ? "Past aktivní"
        : hasTrapElsewhere
          ? isMoveOnCooldown
            ? `Přesunout past ${trapMoveCooldownSeconds}s`
            : "Přesunout past"
          : action.defaultLabel;
      const enabled = visible && !hasTrapHere && !isMoveOnCooldown;

      return {
        id: action.id,
        visible,
        enabled,
        label,
        reason: !visible
          ? `Past lze nastražit jen na vlastním districtu ${districtId}.`
          : hasTrapHere
            ? `Past už je aktivní v districtu ${districtId}.`
            : isMoveOnCooldown
              ? `Přesun pasti bude dostupný za ${trapMoveCooldownSeconds}s.`
              : null
      };
    }

    if (action.id === "attack") {
      const visible = !isOwnedByCurrentPlayer && !isUnoccupied && hasAdjacentOwnedDistrict;

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible
          ? null
          : isOwnedByCurrentPlayer
            ? `District ${districtId} už vlastní hráč.`
            : "Útok vyžaduje sousední vlastněný district."
      };
    }

    if (action.id === "heist") {
      const visible = !isOwnedByCurrentPlayer && !isUnoccupied && hasAdjacentOwnedDistrict;

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible
          ? null
          : isOwnedByCurrentPlayer
            ? `Vykrást hráče nejde spustit na vlastním districtu ${districtId}.`
            : isUnoccupied
              ? "Vykrást hráče cílí jen na district vlastněný jiným hráčem."
              : "Vykrást hráče vyžaduje sousední vlastněný district."
      };
    }

    if (action.id === "occupy") {
      const visible = !isDowntownOccupationLocked && !isOwnedByCurrentPlayer && isUnoccupied && canOccupyAfterSpy && hasAdjacentOwnedDistrict;
      const blockedByRobbery = visible && isRobbing;
      const blockedByOccupation = visible && hasActiveOccupation;
      const blocked = blockedByRobbery || blockedByOccupation;

      return {
        id: action.id,
        visible,
        enabled: visible && !blocked,
        label: action.defaultLabel,
        stacked: blocked,
        subtitle: blockedByOccupation ? "Přijď později" : (blockedByRobbery ? "Teď ne" : ""),
        disabledTone: blockedByOccupation ? "occupation" : (blockedByRobbery ? "robbery" : ""),
        title: blockedByOccupation
          ? "Jedno obsazování už probíhá. Další můžeš spustit po jeho dokončení."
          : (blockedByRobbery ? `District ${districtId} právě vykrádáš. Obsazení lze spustit až po dokončení vykradení.` : ""),
        reason: blockedByOccupation
          ? "Jedno obsazování už probíhá. Další můžeš spustit po jeho dokončení."
          : blockedByRobbery
          ? `District ${districtId} právě vykrádáš. Obsazení lze spustit až po dokončení vykradení.`
          : visible
          ? null
          : isDowntownOccupationLocked
            ? "Downtown districty lze obsazovat až ve final lockdown fázi."
            : `Obsazení je dostupné jen po spy úspěchu na district ${districtId}.`
      };
    }

    if (action.id === "rob") {
      const visible = !isOwnedByCurrentPlayer && isUnoccupied && hasAdjacentOwnedDistrict;
      const enabled = visible && !isSpying;

      return {
        id: action.id,
        visible,
        enabled,
        label: action.defaultLabel,
        reason: !visible
          ? "Vykrást district lze jen na prázdný sousední district."
          : isSpying
            ? `District ${districtId} právě špehuješ. Vykrást ho lze až po návratu špeha.`
            : null
      };
    }

    if (action.id === "spy") {
      const visible = !isOwnedByCurrentPlayer && hasAdjacentOwnedDistrict && !canOccupyAfterSpy;
      const enabled = visible && availableSpies > 0 && !isRobbing;
      const noSpiesAvailable = visible && availableSpies <= 0;
      const blockedByRobbery = visible && isRobbing;

      return {
        id: action.id,
        visible,
        enabled,
        label: action.defaultLabel,
        stacked: noSpiesAvailable || blockedByRobbery,
        subtitle: blockedByRobbery ? "Probíhá krádež" : (noSpiesAvailable ? "Žádní špehové" : ""),
        disabledTone: noSpiesAvailable || blockedByRobbery ? "no-spies" : "",
        title: blockedByRobbery
          ? `District ${districtId} právě vykrádáš. Špehování lze spustit až po dokončení vykradení.`
          : (noSpiesAvailable ? "Žádní špehové nejsou dostupní." : ""),
        reason: enabled
          ? null
          : blockedByRobbery
            ? `District ${districtId} právě vykrádáš. Špehování lze spustit až po dokončení vykradení.`
            : !visible
            ? "Špehování vyžaduje sousední vlastněný district."
            : null
      };
    }

    return {
      id: action.id,
      visible: false,
      enabled: false,
      label: action.defaultLabel,
      reason: "Unknown action."
    };
  });
}
