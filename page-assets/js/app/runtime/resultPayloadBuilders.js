export function formatCombatLootLabel(itemId) {
  const key = String(itemId || "").trim().toLowerCase();
  const labels = {
    chemicals: "Chemicals",
    biomass: "Biomass",
    "stim-pack": "Stim Pack",
    "metal-parts": "Metal Parts",
    "tech-core": "Tech Core"
  };

  return labels[key] || itemId;
}

export function pickRandomQuote(quotes = [], fallback = "", random = Math.random) {
  const safeQuotes = Array.isArray(quotes)
    ? quotes.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (safeQuotes.length <= 0) {
    return String(fallback || "").trim();
  }
  return safeQuotes[Math.floor(random() * safeQuotes.length)] || String(fallback || "").trim();
}

export function resolveAttackOutcomeMeta(outcomeKey) {
  const key = String(outcomeKey || "").trim().toLowerCase();
  switch (key) {
    case "total-success":
      return {
        key,
        title: "TOTÁLNÍ ÚSPĚCH",
        badge: "District je tvůj",
        summary: "Rozjebali jste je na kusy. District je tvůj. Kdo tam ještě dýchá, už maká pro tebe nebo chcípne do rána."
      };
    case "pyrrhic-victory":
      return {
        key,
        title: "PYRRHOVO VÍTĚZSTVÍ",
        badge: "Obrana zničená",
        summary: "Sejmul jsi jejich obranu, ale tvoji lidi šli do sraček s nima. Půlka chcípla, zbraně v hajzlu. District pořád stojí ale sotva."
      };
    case "catastrophe":
      return {
        key,
        title: "KATASTROFA",
        badge: "District shořel",
        summary: "Všechno shořelo do prdele. Baráky, lidi, zásoby. Jen popel a smrad. Tady už není co brát, jen prázdná díra."
      };
    case "trap-triggered":
      return {
        key,
        title: "TOXICKÁ PAST",
        badge: "Past sepnuta",
        summary: "Útok skončil v toxický pasti. Celá skupina šla do hajzlu dřív, než stačila cokoliv urvat."
      };
    case "failure":
    default:
      return {
        key: "failure",
        title: "NEÚSPĚCH",
        badge: "Útok odražen",
        summary: "Totální průser. Vběhli jste tam jak idioti a nechali tam krev i výbavu. Oni taky něco ztratili, ale ty jsi ten, co dostal přes držku."
      };
  }
}

export function createResultPayloadBuilders(deps = {}) {
  const now = typeof deps.now === "function" ? deps.now : Date.now;
  const random = typeof deps.random === "function" ? deps.random : Math.random;
  const formatDurationLabel = typeof deps.formatDurationLabel === "function" ? deps.formatDurationLabel : (value) => `${value}ms`;
  const resolveDistrictNumericId = typeof deps.resolveDistrictNumericId === "function" ? deps.resolveDistrictNumericId : (districtId) => Number(districtId) || 0;
  const formatDistrictReference = typeof deps.formatDistrictReference === "function" ? deps.formatDistrictReference : (districtId) => `District ${districtId}`;

  const getRuntimeDistrictById = (districtId) => {
    const normalizedDistrictId = resolveDistrictNumericId(districtId);
    if (!normalizedDistrictId) {
      return null;
    }
    return deps.getDistrictById?.(normalizedDistrictId) || null;
  };

  const isCurrentPlayerOwnedDistrict = (districtId) => {
    const normalizedDistrictId = resolveDistrictNumericId(districtId);
    if (!normalizedDistrictId) {
      return false;
    }
    const worldState = deps.getWorldState?.() || {};
    if (Array.isArray(worldState.ownedDistrictIds) && worldState.ownedDistrictIds.includes(normalizedDistrictId)) {
      return true;
    }
    return Number(deps.startPhaseOwnerByDistrictId?.get?.(normalizedDistrictId)) === Number(deps.currentPlayerId);
  };

  const getResultDistrictOwnerLabel = (districtId, fallbackOwnerLabel = "") => {
    const normalizedDistrictId = resolveDistrictNumericId(districtId);
    const fallback = String(fallbackOwnerLabel || "").trim();
    if (!normalizedDistrictId) {
      return fallback || "Neznámý";
    }
    const worldState = deps.getWorldState?.() || {};
    if (Array.isArray(worldState.destroyedDistrictIds) && worldState.destroyedDistrictIds.includes(normalizedDistrictId)) {
      return "Zničený";
    }
    if (Array.isArray(worldState.ownedDistrictIds) && worldState.ownedDistrictIds.includes(normalizedDistrictId)) {
      return "TY";
    }
    const launchOwnerId = Number(deps.startPhaseOwnerByDistrictId?.get?.(normalizedDistrictId) || 0);
    if (launchOwnerId > 0) {
      return launchOwnerId === Number(deps.currentPlayerId) ? "TY" : deps.getLaunchPlayerName?.(launchOwnerId);
    }
    return fallback || "Neobsazeno";
  };

  const isDistrictUnownedForSpyResult = (districtId, fallbackOwnerLabel = "") => (
    getResultDistrictOwnerLabel(districtId, fallbackOwnerLabel) === "Neobsazeno"
  );

  const getCurrentPlayerIdentityLabel = () => {
    const registration = deps.getStoredRegistration?.();
    return String(registration?.identity || "Host").trim() || "Host";
  };

  const getCurrentPlayerGangLabel = () => {
    const registration = deps.getStoredRegistration?.();
    return String(registration?.identity ? `${registration.identity} Crew` : "Guest Crew").trim() || "Guest Crew";
  };

  const getCurrentPlayerAllianceLabel = () => {
    const allianceName = deps.getAllianceLabel?.() || "";
    return String(allianceName || "").trim() || "Žádná";
  };

  const getDistrictDefenseIntelSummary = (districtId, fallbackDefensePower = 0) => {
    const normalizedDistrictId = resolveDistrictNumericId(districtId);
    const worldState = deps.getWorldState?.() || {};
    const loadout = worldState.districtDefenseLoadoutById?.[normalizedDistrictId] || {};
    const weaponCount = Object.values(loadout).reduce(
      (sum, amount) => sum + Math.max(0, Number.parseInt(String(amount || 0), 10) || 0),
      0
    );
    const defensePower = Math.max(
      0,
      Number.parseInt(String(worldState.districtDefenseById?.[normalizedDistrictId] ?? fallbackDefensePower ?? 0), 10) || 0
    );
    const lowerPower = Math.max(0, Math.floor(defensePower * 0.8));
    const upperPower = Math.max(lowerPower, Math.ceil(defensePower * 1.2));
    return {
      weaponsLabel: `${weaponCount > 0 ? weaponCount : Math.max(0, Math.round(defensePower / 36))} ks`,
      powerRangeLabel: `${lowerPower} až ${upperPower}`,
      defensePower
    };
  };

  const buildSpyResultRows = (districtId, mission = {}, options = {}) => {
    const district = getRuntimeDistrictById(districtId);
    const buildingProfile = district ? deps.resolveDistrictBuildingProfile?.(district) : null;
    const districtTypeMeta = deps.districtTypeMeta || {};
    const typeMeta = district
      ? (districtTypeMeta[district.districtType] || districtTypeMeta.resident)
      : (districtTypeMeta[String(mission?.districtType || "").trim().toLowerCase()] || districtTypeMeta.resident);
    const atmosphereMeta = district ? deps.getDistrictAtmosphereMeta?.(district) : deps.unknownAtmosphereMeta;
    const defenseIntel = getDistrictDefenseIntelSummary(districtId, options.defensePower ?? 0);
    const buildingLabel = buildingProfile?.buildings?.length
      ? buildingProfile.buildings.map((building) => building.displayName).join(", ")
      : "Bez významných budov";
    const rows = [];

    if (options.spyStatusLabel) {
      rows.push({ label: "Stav špeha", value: options.spyStatusLabel });
    }

    rows.push(
      { label: "Odhad zbraní v districtu", value: options.showWeapons === false ? "Nezjištěno" : defenseIntel.weaponsLabel },
      { label: "Odhad síly obrany", value: options.showPowerRange === false ? "Nezjištěno" : defenseIntel.powerRangeLabel },
      { label: "Typ distriktu", value: options.showType === false ? "Nezjištěno" : (typeMeta?.label || "Neznámý") },
      { label: "Atmosféra", value: options.showAtmosphere === false ? "Nezjištěno" : (atmosphereMeta?.label || "Neznámá") },
      { label: "Budovy", value: options.showBuildings === false ? "Nezjištěno" : buildingLabel }
    );

    return rows;
  };

  const resolvePoliceActionTierQuote = (tierId) => (
    pickRandomQuote(deps.policeActionTierQuotes?.[Math.max(1, Number.parseInt(String(tierId || 1), 10) || 1)] || [], "", random)
  );

  const createPoliceActionInfoRows = (districtId, policeAction, specialtyMeta) => {
    const startedAt = Number(policeAction?.startedAt || now());
    const expiresAt = Number(policeAction?.expiresAt || startedAt + deps.gangHeatPoliceDurationMs);
    return [
      { label: "District", value: formatDistrictReference(districtId) },
      { label: "Vlastník", value: getResultDistrictOwnerLabel(districtId) },
      { label: "Typ razie", value: `${specialtyMeta.icon} ${specialtyMeta.label}` },
      { label: "Doba razie", value: formatDurationLabel(Math.max(0, expiresAt - startedAt)), nowrap: true },
      { label: "Konec za", value: formatDurationLabel(Math.max(0, expiresAt - now())), nowrap: true },
      ...(Array.isArray(policeAction?.impact?.effectRows) ? policeAction.impact.effectRows : []),
      ...(Array.isArray(policeAction?.impact?.rows) ? policeAction.impact.rows : [])
    ];
  };

  const createDistrictPoliceRaidWarningPayload = (district, policeAction) => {
    const districtId = resolveDistrictNumericId(district || policeAction?.districtId);
    const specialtyMeta = deps.resolvePoliceSpecialty?.(
      policeAction?.raidSpecialtyKey || deps.resolvePoliceOperationType?.(policeAction?.operationType)?.specialtyKey
    );
    return {
      tone: `is-specialty-${specialtyMeta.key} is-district-raid-warning`,
      title: "Policejní razie v districtu",
      badge: specialtyMeta.label,
      summary: pickRandomQuote(deps.policeDistrictClickWarningQuotes, "Tady teď ne. Policie to tu právě rozjebává.", random),
      syncToBuildingAction: false,
      rows: [
        { label: "Hráč", value: getResultDistrictOwnerLabel(districtId) },
        { label: "Typ razie", value: specialtyMeta.label }
      ]
    };
  };

  const createOwnedDistrictPoliceRaidAlertPayload = (district, policeAction) => {
    const districtId = resolveDistrictNumericId(district || policeAction?.districtId);
    const tier = deps.policeActionTierMessages?.[policeAction?.impact?.tierId]
      ? { id: policeAction.impact.tierId }
      : deps.resolveGangHeatTier?.(deps.getGangState?.().heat);
    const tierEntry = deps.policeActionTierMessages?.[tier.id] || deps.policeActionTierMessages?.[1];
    const specialtyMeta = deps.resolvePoliceSpecialty?.(
      policeAction?.raidSpecialtyKey || deps.resolvePoliceOperationType?.(policeAction?.operationType)?.specialtyKey
    );
    const buildRows = () => createPoliceActionInfoRows(districtId, policeAction, specialtyMeta);
    return {
      tone: `${tierEntry.tone} is-specialty-${specialtyMeta.key} is-owned-district-raid-alert`,
      title: "Dopady razie",
      badge: `Razia aktivní • ${specialtyMeta.label} • Stupeň ${tier.id}/6`,
      summary: pickRandomQuote(
        [
          "Policie právě najela do tvého districtu. Všechno je pod tlakem a bere se, co jde.",
          "Razie běží přímo u tebe. Teď jde o škody a o to, co ještě zůstane stát.",
          "Tvůj district je právě pod policejním zásahem. Situace je horká a nestabilní."
        ],
        "Policie právě razí tvůj district.",
        random
      ),
      syncToBuildingAction: false,
      getRows: buildRows,
      refreshMs: 1000,
      autoCloseWhen: () => Math.max(0, Number(policeAction?.expiresAt || 0) - now()) <= 0
    };
  };

  const createDistrictAttackInProgressPayload = (district, attackMarker) => {
    const districtId = resolveDistrictNumericId(district || attackMarker?.districtId);
    const attackerDistrictId = resolveDistrictNumericId(attackMarker?.attackerDistrictId || attackMarker?.sourceDistrictId);
    const buildRows = () => {
      const remainingMs = Math.max(0, Number(attackMarker?.expiresAt || 0) - now());
      return [
        { label: "Útočník", value: getResultDistrictOwnerLabel(attackerDistrictId, "Neznámý gang") },
        { label: "Obránce", value: getResultDistrictOwnerLabel(districtId, "Neobsazeno") },
        { label: "Konec boje za", value: formatDurationLabel(remainingMs), nowrap: true }
      ];
    };

    return {
      tone: "is-district-attack-warning",
      title: "Útok probíhá",
      badge: "Boj o district",
      summary: "",
      syncToBuildingAction: false,
      rows: buildRows(),
      getRows: buildRows,
      refreshMs: 1000,
      autoCloseWhen: () => Math.max(0, Number(attackMarker?.expiresAt || 0) - now()) <= 0
    };
  };

  const createSpyDetectionAlertPayload = (districtId) => {
    const district = getRuntimeDistrictById(districtId);
    const allianceLabel = getCurrentPlayerAllianceLabel();
    const useAllianceAlert = allianceLabel && allianceLabel !== "Žádná";
    const attackerNick = getCurrentPlayerIdentityLabel();
    const attackerGang = getCurrentPlayerGangLabel();
    const attackerAlliance = allianceLabel;
    const summaryBase = useAllianceAlert
      ? pickRandomQuote(deps.spyAllianceDetectionWarningQuotes, "", random)
      : pickRandomQuote(deps.spyDetectionWarningQuotes, "", random);

    return {
      title: "Upozornění: Neúspěšné špehování",
      badge: useAllianceAlert ? `Aliance v ohrožení • ${allianceLabel}` : "Vlastní district pod tlakem",
      summary: summaryBase
        .replaceAll("[ALLY]", allianceLabel)
        .concat(` Špeha vyslal: ${attackerNick} • gang ${attackerGang} • aliance ${attackerAlliance}.`)
        .trim(),
      alertKind: useAllianceAlert ? "alliance" : "player",
      district,
      attackerNick,
      attackerGang,
      attackerAlliance,
      detectedAt: now()
    };
  };

  const createAttackResultPayload = ({
    order = {},
    targetDistrictId = 0,
    trapTriggered = false,
    outcome = {},
    deployedMembers = 0,
    memberLoss = 0,
    currentDefense = 0,
    nextDefense = 0
  } = {}) => {
    const attackOutcomeMeta = resolveAttackOutcomeMeta(trapTriggered ? "trap-triggered" : outcome.key);
    const attackerLossPct = deployedMembers > 0 ? Math.round((memberLoss / deployedMembers) * 100) : 0;
    const defenderLossValue = trapTriggered ? 0 : Math.max(0, Math.round(Number(currentDefense || 0) - nextDefense));
    const defenderLossPct = Number(currentDefense || 0) > 0
      ? Math.round((defenderLossValue / Number(currentDefense || 0)) * 100)
      : (outcome.destroysDistrict || outcome.capturesDistrict ? 100 : 0);
    const createdAtMs = new Date(order.createdAt).getTime();
    const resolveAtMs = new Date(order.resolveAt).getTime();
    const safeCreatedAtMs = Number.isFinite(createdAtMs) ? createdAtMs : now();
    const safeResolveAtMs = Number.isFinite(resolveAtMs) ? resolveAtMs : safeCreatedAtMs;
    const durationValue = formatDurationLabel(Math.max(0, safeResolveAtMs - safeCreatedAtMs));
    const heatGained = Math.max(0, Number(order.heatAdded ?? order.factoryBoost?.heatAdded ?? 0) || 0);
    const policeRiskPct = Math.max(0, Number(order.factoryBoost?.policeInterventionRiskPct || 0) || 0);
    const lootLabel = outcome.capturesDistrict
      ? "Kontrola districtu"
      : outcome.destroysDistrict
        ? "District zničen"
        : "Žádný";
    const policeWarningLabel = policeRiskPct > 0
      ? `Riziko zásahu ${policeRiskPct}%`
      : heatGained > 0
        ? "Heat zvýšen, sleduj police feed"
        : "Bez přímého police eventu";

    return {
      tone: `is-${attackOutcomeMeta.key}`,
      outcomeKey: attackOutcomeMeta.key,
      title: attackOutcomeMeta.title,
      badge: attackOutcomeMeta.badge,
      summary: attackOutcomeMeta.summary,
      districtName: `District ${targetDistrictId}`,
      attackPower: Math.max(0, Math.floor(Number(order.estimatedAttackPower ?? 0) || 0)),
      defensePower: Math.max(0, Math.floor(Number(currentDefense ?? 0) || 0)),
      attackerLossesLabel: `${attackerLossPct}%`,
      defenderLossesLabel: `${defenderLossPct}%`,
      lootLabel,
      heatGainedLabel: `+${heatGained}`,
      policeWarningLabel,
      districtStateValue: trapTriggered
        ? "Past aktivována"
        : outcome.destroysDistrict
          ? "Zničený"
          : outcome.capturesDistrict
            ? "Obsazený"
            : "Stojí",
      durationValue,
      cooldownLabel: durationValue,
      nextActionLabel: "Zpět na mapu / vyber další cíl",
      extraRows: [
        { label: "Loot", value: lootLabel },
        { label: "Heat gained", value: `+${heatGained}` },
        { label: "Police warning", value: policeWarningLabel },
        { label: "Cooldown", value: durationValue, nowrap: true },
        { label: "Další krok", value: "Zpět na mapu / vyber další cíl" }
      ],
      showDefensePower: String(outcome.key || "").trim().toLowerCase() === "total-success"
    };
  };

  const createRobberyResultPayload = ({
    order = {},
    deployedMembers = 0,
    memberLoss = 0,
    lootEntries = []
  } = {}) => {
    const safeLootEntries = Array.isArray(lootEntries) ? lootEntries : [];
    const lootLabel = safeLootEntries.length > 0
      ? safeLootEntries.map(([itemId, amount]) => `${formatCombatLootLabel(itemId)} x${amount}`).join(", ")
      : "Žádný";
    const raidTone = safeLootEntries.length > 0
      ? (memberLoss > 0 ? "is-dirty-fail" : "is-clean-success")
      : (memberLoss >= deployedMembers ? "is-disaster" : "is-alert");
    const durationLabel = formatDurationLabel(new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime());

    return {
      raidTone,
      raidResultPayload: {
        tone: raidTone,
        title: safeLootEntries.length > 0
          ? (memberLoss > 0 ? "ŠPINAVÁ KRÁDEŽ" : "ČISTÁ KRÁDEŽ")
          : "PRŮSER",
        summary: safeLootEntries.length > 0
          ? (memberLoss > 0
            ? "Vzali jste lup ale nebylo to čistý. Trochu krve, trochu bordelu. Něco jsi nechal na místě, ale pořád jsi v plusu."
            : "Vlezli jste tam, sebrali co šlo a zmizeli jak duchové. Ani kurva nevěděli, že tam někdo byl. Prachy jsou tvoje.")
          : "Posrali jste to. Chytili vás při činu, někdo to odnesl a zbytek zdrhal jak krysy. Nemáš nic, jen ostudu a ztráty.",
        rows: [
          ...(safeLootEntries.length > 0
            ? (memberLoss > 0
              ? [
                  { label: "Cíl", value: `District ${order.targetDistrictId}` },
                  { label: "Ztráta členů", value: `${memberLoss}` },
                  { label: "Cooldown", value: durationLabel, nowrap: true },
                  { label: "Zisk", value: lootLabel }
                ]
              : [
                  { label: "Cíl", value: `District ${order.targetDistrictId}` },
                  { label: "Získáno", value: lootLabel },
                  { label: "Trvání", value: durationLabel, nowrap: true },
                  { label: "Cooldown", value: durationLabel, nowrap: true }
                ])
            : [
                { label: "Cíl", value: `District ${order.targetDistrictId}` },
                { label: "Ztráta členů", value: `${memberLoss}` },
                { label: "Cooldown", value: durationLabel, nowrap: true },
                { label: "Upozornění cíle", value: raidTone === "is-alert" ? "Ano" : "Ne" }
              ])
        ]
      }
    };
  };

  const createSpyResultPayload = ({
    mission = {},
    scenarioLabel = "",
    knownDefensePower = 0,
    isUnownedDistrict = false
  } = {}) => ({
    tone: scenarioLabel === "Úspěch" ? "is-success" : scenarioLabel === "Částečný úspěch" ? "is-medium-fail" : "is-major-fail",
    title: scenarioLabel === "Úspěch" ? "Špehování: Úspěch" : scenarioLabel === "Částečný úspěch" ? "Špehování: Částečný neúspěch" : "Špehování: Velký neúspěch",
    summary: scenarioLabel === "Úspěch"
      ? pickRandomQuote(
          isUnownedDistrict ? deps.spySuccessEmptyDistrictQuotes : deps.spySuccessOccupiedDistrictQuotes,
          `Špehování distriktu District ${mission.targetDistrictId} dopadlo úspěšně.`,
          random
        )
      : scenarioLabel === "Částečný úspěch"
        ? pickRandomQuote(
            isUnownedDistrict ? deps.spyMediumFailEmptyDistrictQuotes : deps.spyMediumFailOccupiedDistrictQuotes,
            `Akce v District ${mission.targetDistrictId} nedopadla dobře, ale tvůj špeh se vrátil.`,
            random
          )
        : pickRandomQuote(
            isUnownedDistrict ? deps.spyMajorFailEmptyDistrictQuotes : deps.spyMajorFailOccupiedDistrictQuotes,
            `Špeh byl v districtu District ${mission.targetDistrictId} zajat.`,
            random
          ),
    rows: scenarioLabel === "Úspěch"
      ? buildSpyResultRows(mission.targetDistrictId, mission, {
          defensePower: knownDefensePower
        })
      : scenarioLabel === "Částečný úspěch"
        ? buildSpyResultRows(mission.targetDistrictId, mission, {
            defensePower: knownDefensePower,
            spyStatusLabel: "Vrátil se",
            showWeapons: false,
            showPowerRange: false,
            showAtmosphere: false,
            showBuildings: false
          })
        : [
            { label: "Stav špeha", value: "Zajat" },
            { label: "Cooldown", value: formatDurationLabel(deps.spyCaptureCooldownMs), nowrap: true }
          ]
  });

  return {
    createAttackResultPayload,
    buildSpyResultRows,
    createDistrictAttackInProgressPayload,
    createDistrictPoliceRaidWarningPayload,
    createOwnedDistrictPoliceRaidAlertPayload,
    createPoliceActionInfoRows,
    createRobberyResultPayload,
    createSpyDetectionAlertPayload,
    createSpyResultPayload,
    getCurrentPlayerAllianceLabel,
    getCurrentPlayerGangLabel,
    getCurrentPlayerIdentityLabel,
    getDistrictDefenseIntelSummary,
    getResultDistrictOwnerLabel,
    getRuntimeDistrictById,
    isCurrentPlayerOwnedDistrict,
    isDistrictUnownedForSpyResult,
    resolvePoliceActionTierQuote
  };
}

if (typeof window !== "undefined") {
  window.EmpireResultPayloadBuilders = {
    createResultPayloadBuilders,
    formatCombatLootLabel,
    pickRandomQuote,
    resolveAttackOutcomeMeta
  };
}
