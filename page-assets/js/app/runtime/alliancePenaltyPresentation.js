/** Render the authoritative per-effect deadlines, including overlapping penalties. */
export function createAlliancePenaltyNewsModels(alliance, now, formatRemaining) {
  const penalties = alliance?.exitPenalties ?? (alliance?.exitPenalty ? [alliance.exitPenalty] : []);
  return penalties.flatMap(penalty => {
    if (Date.parse(penalty.startedAt) > now) return [];
    const groups = [
      ["combat", "Bojová síla", penalty.statDebuffEndsAt, [["Útok", penalty.attackMultiplier], ["Obrana", penalty.defenseMultiplier]]],
      ["production", "Výroba a příjem", penalty.statDebuffEndsAt, [["Výroba", penalty.productionMultiplier], ["Příjem", penalty.incomeMultiplier]]],
      ["influence", "Přírůstek vlivu", penalty.influenceDebuffEndsAt, [["Vliv", penalty.influenceGenerationMultiplier]]],
      ["cooldown", "Čekání mezi akcemi", penalty.actionCooldownDebuffEndsAt, [["Cooldown", penalty.actionCooldownMultiplier]]]
    ];
    return groups.flatMap(([key, label, deadline, effects]) => {
      const expiresAt = Date.parse(deadline ?? penalty.penaltyEndsAt);
      const rows = effects.filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 1)
        .map(([name, value]) => ({ label: name, value: `${Number(value) > 1 ? "+" : "−"}${Math.round(Math.abs(Number(value) - 1) * 100)} %` }));
      if (!Number.isFinite(expiresAt) || expiresAt <= now || !rows.length) return [];
      const reason = penalty.reason === "inactive_kick" ? "Vyloučení z aliance" : "Odchod z aliance";
      const remaining = formatRemaining(expiresAt - now);
      return [{ id: `cooldown:alliance-penalty:${penalty.id}:${key}`, title: label,
        summary: `${reason} · ${rows.map(row => `${row.label} ${row.value}`).join(" · ")}`,
        meta: `Zbývá ${remaining}`, expiresAt, resultKind: "alliance-penalty",
        resultPayload: { openable: true, tone: "warning", title: label, badge: "Postih",
          summary: reason, rows: [...rows, { label: "Zbývá", value: remaining, nowrap: true, countdownUntil: expiresAt }] }
      }];
    });
  });
}
