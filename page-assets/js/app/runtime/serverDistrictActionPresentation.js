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
      return [{
        id: definition.id,
        enabled: district.trap.enabled === true,
        label: district.trap.activeTrap ? "Past aktivní" : definition.label,
        reason: String(district.trap.disabledReason || ""),
        visible: true
      }];
    }

    const target = findTarget(district, definition.collection, canonicalDistrictId);
    if (!target) return [];
    return [{
      id: definition.id,
      enabled: target.enabled === true,
      label: definition.label,
      reason: String(target.disabledReason || ""),
      visible: true
    }];
  });
}
