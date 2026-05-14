import type { ConvenienceStoreBalanceConfig, FixedBuildingBalanceConfig, LobbyClubBalanceConfig, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { applyResolvedRumorEventsToState, createPassiveBuildingRumorInput, type ResolveRumorEventInput } from "../rules/events/rumorPipeline";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";

export interface ConvenienceStoreNetworkMultipliers {
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  influenceMultiplier: number;
  rumorMultiplier: number;
  heatMultiplier: number;
}

export interface ConvenienceStoreRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  areaHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

interface ConvenienceStoreMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: ConvenienceStoreRumor[];
}

export const getOwnedConvenienceStoreCount = (
  state: CoreGameState,
  playerId: string,
  config: ConvenienceStoreBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveConvenienceStoreNetworkMultipliers = (
  count: number,
  config: ConvenienceStoreBalanceConfig
): ConvenienceStoreNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraStore / 100),
    dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraStore / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraStore / 100),
    rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraStore / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraStore / 100)
  };
};

export const resolveConvenienceStoreRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: ConvenienceStoreBalanceConfig;
  restaurantConfig?: { buildingTypeId: "restaurant" };
  lobbyClubConfig?: LobbyClubBalanceConfig;
}) => {
  const storeCount = getOwnedConvenienceStoreCount(input.state, input.playerId, input.config);
  const restaurantCount = input.restaurantConfig
    ? getOwnedActiveBuildingCount(input.state, input.playerId, input.restaurantConfig.buildingTypeId)
    : 0;
  const network = resolveConvenienceStoreNetworkMultipliers(storeCount, input.config);
  const civilRumorChanceBonusPct = resolveCivilRumorChanceBonusPct(storeCount, restaurantCount, input.config);
  const civilTruthBonusPct = storeCount >= input.config.restaurantSynergy.truthStoreThreshold
    && restaurantCount >= input.config.restaurantSynergy.truthRestaurantThreshold
    ? input.config.restaurantSynergy.civilRumorTruthBonusPct
    : 0;
  const lobbyDistrictHintBonusPct = input.lobbyClubConfig && getOwnedLobbyClubCount(input.state, input.playerId, input.lobbyClubConfig) > 0
    ? input.lobbyClubConfig.civilNetworkSupport.convenienceDistrictHintChancePct
    : 0;
  return {
    storeCount,
    restaurantCount,
    network,
    civilRumorChanceBonusPct,
    passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier + civilRumorChanceBonusPct),
    truthChancePct: Math.min(
      100,
      resolveTruthChancePct(storeCount, input.config)
        + civilTruthBonusPct
    ),
    districtHintChancePct: Math.min(100, input.config.districtHintChancePct + lobbyDistrictHintBonusPct),
    areaHintChancePct: input.config.areaHintChancePct,
    buildingHintChancePct: input.config.buildingHintChancePct,
    reliabilityVisible: false
  };
};

export const applyConvenienceStoreIncomeModifiers = (input: {
  config: ConvenienceStoreBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveConvenienceStoreNetworkMultipliers(getOwnedConvenienceStoreCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay * network.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyConvenienceStorePassiveRumors = (
  state: CoreGameState,
  config: ConvenienceStoreBalanceConfig,
  tickRateMs: number,
  restaurantConfig?: { buildingTypeId: "restaurant" },
  lobbyClubConfig?: LobbyClubBalanceConfig,
  dayNightConfig?: ResolvedGameModeConfig
): CoreGameState => {
  const intervalTicks = minutesToTicks(config.passiveRumorIntervalMinutes, tickRateMs);
  let buildingsById = state.buildingsById;
  let changed = false;
  const feedInputs: ResolveRumorEventInput[] = [];

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = cleanupMetadata(getConvenienceStoreMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
      continue;
    }
    const stats = resolveConvenienceStoreRumorStats({ state, playerId: building.ownerPlayerId, config, restaurantConfig, lobbyClubConfig });
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:convenience-store-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      const rumor = generateRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        restaurantConfig,
        lobbyClubConfig,
        seed: `${building.id}:convenience-store-rumor-event:${state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      feedInputs.push(createPassiveBuildingRumorInput({
        state,
        building,
        source: "convenience_store",
        rumor,
        severity: rumor.type === "possible_trap" ? "low" : "medium"
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  const metadataState = changed ? { ...state, buildingsById } : state;
  return feedInputs.length > 0
    ? applyResolvedRumorEventsToState(metadataState, feedInputs, { lobbyClubConfig, config: dayNightConfig })
    : metadataState;
};

export const getConvenienceStoreMetadata = (building: CoreGameState["buildingsById"][string]): ConvenienceStoreMetadata => {
  const raw = isRecord(building.metadata?.convenienceStore) ? building.metadata.convenienceStore : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const generateRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: ConvenienceStoreBalanceConfig;
  restaurantConfig?: { buildingTypeId: "restaurant" };
  lobbyClubConfig?: LobbyClubBalanceConfig;
  seed: string;
}): ConvenienceStoreRumor => {
  const stats = resolveConvenienceStoreRumorStats(input);
  const rawType = input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
  const type = rawType === "possible_trap" && deterministicRollPct(`${input.seed}:trap-ultra-rare`) >= 1.5 ? "fake" : rawType;
  const truthChancePct = type === "possible_trap" ? Math.min(20, stats.truthChancePct) : stats.truthChancePct;
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const areaHint = deterministicRollPct(`${input.seed}:area`) < stats.areaHintChancePct ? pickAreaHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const rivalHint = pickRivalPlayerHint(input.state, input.playerId, input.seed);
  const reliabilityLabel = stats.reliabilityVisible ? formatReliability(stats.truthChancePct) : null;
  return {
    type,
    truthChancePct,
    isTrue,
    districtHint,
    areaHint,
    buildingHint,
    reliabilityVisible: stats.reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(isTrue ? type : "fake", districtHint, areaHint, buildingHint, rivalHint, reliabilityLabel, input.seed)
  };
};

const formatRumorText = (
  type: string,
  districtHint: string | null,
  areaHint: string | null,
  buildingHint: string | null,
  rivalHint: string | null,
  reliabilityLabel: string | null,
  seed: string
): string => {
  const place = districtHint
    ? ` směrem k ${districtHint}`
    : areaHint
      ? ` někde v ${areaHint}`
      : buildingHint
        ? ` u podniku typu ${buildingHint}`
        : "";
  const rival = rivalHint ? ` Někdo u pultu přísahal, že se kolem toho mihlo jméno ${rivalHint}; pak si koupil žvýkačky a ztratil odvahu.` : "";
  const reliability = reliabilityLabel ? ` Prodavač tomu dává ${reliabilityLabel}.` : "";
  return `${formatRumorSubject(type, seed)}${place}.${rival}${reliability}`;
};

const CONVENIENCE_RUMOR_SUBJECTS: Record<string, string[]> = {
  night_movement: [
    "Prodavač prý zahlédl partu mizet po půlnoci. Tak rychle odchází jen vina a levné párky",
    "Kamera nad regálem údajně chytla tváře, co nekupovaly nic legálního ani chutného",
    "U dveří se prý střídali kurýři a nikdo z nich nešel pro cigarety, takže romantika to nebyla",
    "Někdo tvrdí, že stejná parta třikrát objela blok a pokaždé zpomalila",
    "Noční zákazníci údajně řešili trasu, ne nákup"
  ],
  suspicious_purchase: [
    "Někdo údajně bral baterky, rukavice a pásku. Na cenu se neptal, což je vždycky sociologický alarm",
    "U pokladny prý cinkly věci, které víc patří do akce než do domácnosti",
    "Zákazník si údajně vzal plachtu, masku a mlčení prodavače",
    "Někdo kupoval drobnosti, ze kterých se skládá špinavý plán",
    "Účtenka byla krátká, ale seznam důvodů k obavám dlouhý a hezky se leskl"
  ],
  courier_trace: [
    "Za obchodem prý stála dodávka bez značek",
    "Kurýr údajně nechal motor běžet a oči na zadním východu",
    "U rampy se mihla taška, která nezněla jako drobné",
    "Šeptá se o skútru, co vozí víc zpráv než jídla",
    "Někdo viděl balík bez adresy a ruce, co ho přebraly moc rychle"
  ],
  small_conflict: [
    "Před večerkou se šeptem řešil konflikt, po kterém zůstalo jen sklo",
    "Dva lidé se prý hádali o district, ale mluvili jako o dluhu",
    "U stojanu na kafe údajně padla výhrůžka, která nezní prázdně",
    "Někdo před obchodem ztratil nervy a možná i kus plánu",
    "Mokrý chodník prý slyšel jméno, které by mělo zůstat doma"
  ],
  police_patrol: [
    "Hlídka se prý vrací ke stejnému bloku moc pravidelně, jako špatný seriál s pouty",
    "Policie údajně parkuje bez sirén, ale s otevřenýma očima a velmi malým smyslem pro humor",
    "Někdo tvrdí, že modré auto měří čas mezi směnami",
    "Ve vysílačce prý padl heat, který někdo nedokázal schovat",
    "Hlídka podle prodavače čeká, až se někdo unaví a udělá chybu. Město tomu říká trpělivost, hráči timeout"
  ],
  robbery_preparation: [
    "Zákazník údajně mluvil o rychlé vykrádačce",
    "U mrazáku prý někdo počítal minuty k prázdnému skladu",
    "Dveře, kamera, hlídač. Někdo si to šeptem odškrtával jako nákup",
    "Šeptá se, že někdo hledá sklad, kde je zboží a málo očí",
    "Prodavač tvrdí, že slyšel plán na akci bez výstřelu a bez svědků"
  ],
  possible_trap: [
    "Někdo tvrdí, že v jednom bloku mizí lidi. Nikdo neví proč",
    "Šeptá se, že určitá trasa polyká zvuky až moc dobře. Možná akustika, možná špatný večer",
    "Zdroj říká, že tam něco nesedí. Past nikdo nepotvrdil",
    "Někdo prý varoval před moc tichou ulicí, ale možná jen prodává strach ve výhodném balení",
    "U pultu padlo, že některé dveře se nemají zkoušet potmě. Dveře se k tomu nevyjádřily"
  ],
  weak_defense: [
    "U regálu prý padla řeč o slabé obraně. Mezi chipsy, kde se rodí nejlepší strategie",
    "Někdo tvrdí, že jeden hráč šetří na hlídačích a tváří se tvrdě. Klasická rozpočtová tragédie",
    "Prodavač zaslechl, že zadní vchod hlídá víc pověst než výbava",
    "Šeptá se o districtu, kde kamera funguje líp jako dekorace. Aspoň má pěkný úhel",
    "Někdo údajně hledal levnou cestu kolem obrany"
  ],
  dirty_cash_movement: [
    "V zadní místnosti se údajně počítaly bankovky mimo kasu",
    "Špinavý cash prý projel přes drobné nákupy jako přes pračku",
    "Někdo si měnil malé bankovky za ticho a rychlý odchod",
    "U automatu údajně mizely obálky, co vážily víc než papír",
    "Zdroj tvrdí, že někdo přenáší cash po malých dávkách, aby nebyl cítit"
  ],
  fake: [
    "U pultu kolovala historka, co zní až moc pohodlně. Pravda tady obvykle kulhá",
    "Někdo prodával stopu levněji než kafe. To nikdy nevoní dobře, a místní kafe už vůbec ne",
    "Prý existuje svědek, ale svědek se mění pokaždé, když se zeptáš",
    "Šeptanda možná jen kryje úplně jiný pohyb",
    "Prodavač tomu říká drb, ulice tomu říká návnada"
  ]
};

const formatRumorSubject = (type: string, seed: string): string =>
  pickVariant(CONVENIENCE_RUMOR_SUBJECTS[type] ?? CONVENIENCE_RUMOR_SUBJECTS.fake, `${seed}:subject`);

const resolveCivilRumorChanceBonusPct = (
  storeCount: number,
  restaurantCount: number,
  config: ConvenienceStoreBalanceConfig
): number => {
  if (storeCount >= config.restaurantSynergy.secondStoreThreshold && restaurantCount >= config.restaurantSynergy.secondRestaurantThreshold) {
    return config.restaurantSynergy.secondCivilRumorChanceBonusPct;
  }
  if (storeCount >= config.restaurantSynergy.firstStoreThreshold && restaurantCount >= config.restaurantSynergy.firstRestaurantThreshold) {
    return config.restaurantSynergy.firstCivilRumorChanceBonusPct;
  }
  return 0;
};

const resolveTruthChancePct = (count: number, config: ConvenienceStoreBalanceConfig): number => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  const tier = config.truthChanceByOwnedCount.find((candidate) =>
    safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
  );
  return tier?.truthChancePct ?? 0;
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: ConvenienceStoreMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: {
      ...(building.metadata ?? {}),
      convenienceStore: cleanupMetadata(metadata)
    },
    version: building.version + 1
  }
});

const cleanupMetadata = (metadata: ConvenienceStoreMetadata): ConvenienceStoreMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
};

const pickAreaHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const district = districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:area-index`) / 100 * districts.length)] : null;
  return district?.zone ? `${district.zone} zóně` : null;
};

const pickBuildingHint = (state: CoreGameState, seed: string): string | null => {
  const buildings = Object.values(state.buildingsById).filter((building) => building.status === "active");
  return buildings.length > 0 ? buildings[Math.floor(deterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null : null;
};

const pickRivalPlayerHint = (state: CoreGameState, playerId: string, seed: string): string | null => {
  const players = Object.values(state.playersById).filter((player) => player.id !== playerId && player.status === "active");
  const player = players.length > 0 ? players[Math.floor(deterministicRollPct(`${seed}:rival-index`) / 100 * players.length)] : null;
  return player?.name?.trim() || player?.id || null;
};

const pickVariant = (variants: string[], seed: string): string =>
  variants[Math.floor(deterministicRollPct(`${seed}:variant`) / 100 * variants.length)] ?? variants[0] ?? "";

const formatReliability = (truthChancePct: number): string =>
  truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";

const normalizeRumor = (value: Record<string, unknown>): ConvenienceStoreRumor => ({
  type: String(value.type || "fake"),
  truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
  isTrue: Boolean(value.isTrue),
  districtHint: value.districtHint ? String(value.districtHint) : null,
  areaHint: value.areaHint ? String(value.areaHint) : null,
  buildingHint: value.buildingHint ? String(value.buildingHint) : null,
  reliabilityVisible: Boolean(value.reliabilityVisible),
  reliabilityLabel: value.reliabilityLabel ? String(value.reliabilityLabel) : null,
  text: String(value.text || "")
});

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));

const deterministicRollPct = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 100;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getOwnedActiveBuildingCount = (state: CoreGameState, playerId: string, buildingTypeId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;
