export function buildDistrictPopupFlagsViewModel(input = {}) {
  if (input.isDestroyed) {
    return [
      { label: "Totální destrukce", tone: "danger" },
      { label: "Nikdo", tone: "muted" },
      { label: "Nepoužitelný", tone: "danger" }
    ];
  }

  const ownerLabel = input.ownerLabel || "Neobsazeno";
  const ownerFlag = input.isOccupying
    ? { label: "Obsazován", tone: "warning" }
    : {
        label: input.isOwnedByCurrentPlayer ? "Tvůj" : ownerLabel === "Neobsazeno" ? "Volný" : "Cizí",
        tone: input.isOwnedByCurrentPlayer ? "good" : ownerLabel === "Neobsazeno" ? "neutral" : "warning"
      };
  const defenseEstimate = Math.max(0, Math.round(Number(input.defenseEstimate || 0)));
  const hasDefenseEstimate = input.hasKnownDefense && defenseEstimate > 0;
  const flags = [
    ownerFlag,
    {
      label: hasDefenseEstimate ? `Obrana cca: ${defenseEstimate}` : "Obrana neznámá",
      tone: hasDefenseEstimate ? "neutral" : "muted"
    }
  ];

  if (input.activePoliceAction) {
    flags.push({
      label: "Policejní akce",
      tone: "danger"
    });
  }

  if (input.isOccupying) {
    flags.push({ label: "Obsazování běží", tone: "warning" });
  } else if (input.isDowntownOccupationLocked) {
    flags.push({ label: "Downtown uzavřený", tone: "warning" });
  }

  if (input.hasTrapHere) {
    flags.push({ label: "Toxická past", tone: "danger" });
  }

  return flags;
}
