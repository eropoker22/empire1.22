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
      .map((action) => ({
        id: action.id,
        visible: true,
        enabled: true,
        label: action.defaultLabel,
        reason: null
      }));
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

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible
          ? null
          : isDowntownOccupationLocked
            ? "Downtown districty lze obsazovat až ve final lockdown fázi."
            : `Obsazení je dostupné jen po spy úspěchu na district ${districtId}.`
      };
    }

    if (action.id === "rob") {
      const visible = !isOwnedByCurrentPlayer && isUnoccupied && hasAdjacentOwnedDistrict;

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible ? null : "Vykrást district lze jen na prázdný sousední district."
      };
    }

    if (action.id === "spy") {
      const visible = !isOwnedByCurrentPlayer && hasAdjacentOwnedDistrict && !canOccupyAfterSpy;
      const enabled = visible && availableSpies > 0;
      const noSpiesAvailable = visible && !enabled;

      return {
        id: action.id,
        visible,
        enabled,
        label: action.defaultLabel,
        stacked: noSpiesAvailable,
        subtitle: noSpiesAvailable ? "Žádní špehové" : "",
        disabledTone: noSpiesAvailable ? "no-spies" : "",
        title: noSpiesAvailable ? "Žádní špehové nejsou dostupní." : "",
        reason: enabled
          ? null
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
