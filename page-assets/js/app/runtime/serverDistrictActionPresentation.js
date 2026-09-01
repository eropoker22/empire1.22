const ACTION_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "defense", label: "Obrana" }),
  Object.freeze({ id: "trap", label: "Past" }),
  Object.freeze({ id: "attack", label: "Zaútočit", collection: "attackTargets" }),
  Object.freeze({ id: "heist", label: "Vykrást hráče", collection: "heistTargets" }),
  Object.freeze({ id: "occupy", label: "Obsadit", collection: "occupyTargets" }),
  Object.freeze({ id: "rob", label: "Vykrást district", collection: "robTargets" }),
  Object.freeze({ id: "spy", label: "Špehovat", collection: "spyTargets" })
]);

const findTarget = (district, collection, districtId) => (
  (
    Array.isArray(district?.targetActions?.[collection])
      ? district.targetActions[collection]
      : []
  )
    .find((target) => String(target?.districtId || "") === districtId) || null
);

const resolveTargetDisabledReason = (definition, target) => {
  if (definition.id === "spy" && target?.disabledCode === "SPY_SLOT_LIMIT_REACHED") {
    return "Žádní špehové";
  }
  return String(target?.disabledReason || "Akce teď není dostupná.");
};

const resolveHeistLaunchCopy = (target) => {
  const style = target?.styles?.find((entry) => entry.style === target?.recommendedStyle)
    || target?.styles?.find((entry) => entry.enabled !== false)
    || target?.styles?.[0]
    || null;
  const population = Math.max(0, Number(style?.defaultPopulationSent || style?.minMembers || 0));
  const styleLabel = String(style?.label || style?.style || "doporučený plán");
  return `${styleLabel} · ${population} lidí · verdikt po odpočtu`;
};

export function createServerDistrictActionPresentation(readModel, districtId) {
  const canonicalDistrictId = String(districtId || "");
  const district = readModel?.district || null;
  if (!canonicalDistrictId || String(district?.districtId || "") !== canonicalDistrictId) {
    return [];
  }

  return ACTION_DEFINITIONS.flatMap((definition) => {
    if (definition.id === "defense") {
      const views = [district.placeDefense, district.removeDefense].filter(Boolean);
      if (views.length === 0) return [];
      const enabledView = views.find((view) => view.enabled === true);
      const reason = enabledView ? "" : String(views[0]?.disabledReason || "");
      return [{
        id: definition.id,
        enabled: Boolean(enabledView),
        label: definition.label,
        reason,
        visible: true
      }];
    }
    if (definition.id === "trap") {
      if (!district.trap) return [];
      const activeTrap = district.trap.activeTrap || null;
      const relocationSource = district.trap.relocationSource || null;
      const relocationCooldownRemainingTicks = Math.max(
        0,
        Number(district.trap.relocationCooldownRemainingTicks || 0)
      );
      return [{
        id: definition.id,
        enabled: district.trap.enabled === true,
        label: activeTrap ? "Past aktivní" : definition.label,
        reason: String(district.trap.disabledReason || ""),
        stacked: true,
        subtitle: activeTrap?.label
          || (relocationSource ? "Past je aktivní v jiném vlastním districtu." : ""),
        trapState: activeTrap
          ? "active"
          : relocationCooldownRemainingTicks > 0
            ? "cooldown"
            : relocationSource
              ? "move"
              : "idle",
        title: activeTrap
          ? "V tomto districtu je nastražená tvoje past."
          : relocationSource?.canRelocate
            ? `Máš jen 1 past. Přesuneš ji z District ${relocationSource.districtId} do tohoto districtu.`
            : relocationSource
              ? String(district.trap.disabledReason || "")
              : "Nastraž 1 past do svého districtu.",
        visible: true
      }];
    }

    const target = findTarget(district, definition.collection, canonicalDistrictId);
    if (!target) return [];
    const enabled = target.enabled === true;
    const reason = enabled ? "" : resolveTargetDisabledReason(definition, target);
    const heistLaunchCopy = enabled && definition.id === "heist"
      ? resolveHeistLaunchCopy(target)
      : "";
    return [{
      id: definition.id,
      enabled,
      label: definition.label,
      reason: "",
      stacked: !enabled || Boolean(heistLaunchCopy),
      subtitle: reason || heistLaunchCopy,
      disabledTone: !enabled && definition.id === "spy" && target.disabledCode === "SPY_SLOT_LIMIT_REACHED"
        ? "no-spies"
        : !enabled ? "unavailable" : "",
      title: reason || (heistLaunchCopy ? `Kliknutí okamžitě vyšle ${heistLaunchCopy}.` : ""),
      visible: true
    }];
  });
}
