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

export function resolveDistrictActions(context) {
  const {
    districtId,
    isOwnedByCurrentPlayer,
    hasAdjacentOwnedDistrict,
    isUnoccupied,
    canOccupyAfterSpy,
    availableSpies,
    isOccupying,
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
      visible: action.id === "attack" || action.id === "occupy" || action.id === "spy" || action.id === "rob" || action.id === "defense" || action.id === "trap",
      enabled: false,
      label: action.defaultLabel,
      reason: `District ${districtId} se právě obsazuje.`
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
      const visible = !isOwnedByCurrentPlayer && !isUnoccupied && hasAdjacentOwnedDistrict && !canOccupyAfterSpy;

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
      const visible = !isOwnedByCurrentPlayer && canOccupyAfterSpy && hasAdjacentOwnedDistrict;

      return {
        id: action.id,
        visible,
        enabled: visible,
        label: action.defaultLabel,
        reason: visible ? null : `Obsazení je dostupné jen po spy úspěchu na district ${districtId}.`
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

      return {
        id: action.id,
        visible,
        enabled,
        label: action.defaultLabel,
        reason: enabled
          ? null
          : !visible
            ? "Špehování vyžaduje sousední vlastněný district."
            : "Nemáš dostupného špeha."
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
