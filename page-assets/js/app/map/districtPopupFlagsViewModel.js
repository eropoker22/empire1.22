export function buildDistrictPopupFlagsViewModel(input = {}) {
  if (input.isDestroyed) {
    return [
      { label: "Totální destrukce", tone: "danger" },
      { label: "Nikdo", tone: "muted" },
      { label: "Nepoužitelný", tone: "danger" }
    ];
  }

  const ownerLabel = input.ownerLabel || "Neobsazeno";
  const adjacentOwnedCount = Math.max(0, Number(input.adjacentOwnedCount || 0));
  const flags = [
    {
      label: input.isOwnedByCurrentPlayer ? "Tvůj" : ownerLabel === "Neobsazeno" ? "Volný" : "Cizí",
      tone: input.isOwnedByCurrentPlayer ? "good" : ownerLabel === "Neobsazeno" ? "neutral" : "warning"
    },
    {
      label: adjacentOwnedCount > 0 ? `Napojený: ${adjacentOwnedCount}` : "Bez napojení",
      tone: adjacentOwnedCount > 0 ? "good" : "muted"
    },
    {
      label: input.hasKnownDefense ? "Obrana známá" : "Obrana skrytá",
      tone: input.hasKnownDefense ? "neutral" : "muted"
    }
  ];

  if (input.activePoliceAction) {
    flags.push({
      label: "Policejní akce",
      tone: "danger"
    });
  }

  flags.push({
    label: input.isOccupying
      ? "Obsazování běží"
      : input.canOccupyAfterSpy
        ? "Připraveno k obsazení"
        : "Obsazení nepřipravené",
    tone: input.isOccupying ? "warning" : input.canOccupyAfterSpy ? "good" : "muted"
  });

  if (input.hasTrapHere) {
    flags.push({ label: "Toxická past", tone: "danger" });
  }

  return flags;
}
