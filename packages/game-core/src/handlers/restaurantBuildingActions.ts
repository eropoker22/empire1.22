import type { FixedBuildingBalanceConfig, LobbyClubBalanceConfig, ResolvedGameModeConfig, RestaurantBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { applyResolvedRumorEventsToState, createPassiveBuildingRumorInput, type ResolveRumorEventInput } from "../rules/events/rumorPipeline";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";

export interface RestaurantNetworkMultipliers {
  incomeMultiplier: number;
  influenceMultiplier: number;
  rumorMultiplier: number;
  heatMultiplier: number;
}

export interface RestaurantRumor {
  type: string;
  truthChancePct: number;
  isTrue: boolean;
  districtHint: string | null;
  buildingHint: string | null;
  reliabilityVisible: boolean;
  reliabilityLabel: string | null;
  text: string;
}

interface RestaurantMetadata {
  lastPassiveRumorCheckTick?: number;
  rumorEvents: RestaurantRumor[];
}

export const getOwnedRestaurantCount = (
  state: CoreGameState,
  playerId: string,
  config: RestaurantBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveRestaurantNetworkMultipliers = (
  count: number,
  config: RestaurantBalanceConfig
): RestaurantNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraRestaurant / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraRestaurant / 100),
    rumorMultiplier: Math.min(config.network.maxRumorMultiplier, 1 + extra * config.network.rumorChanceBonusPctPerExtraRestaurant / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraRestaurant / 100)
  };
};

export const resolveRestaurantRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: RestaurantBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
}) => {
  const restaurantCount = getOwnedRestaurantCount(input.state, input.playerId, input.config);
  const network = resolveRestaurantNetworkMultipliers(restaurantCount, input.config);
  const baseTruthChancePct = resolveTruthChancePct(restaurantCount, input.config);
  const lobbyTruthBonusPct = input.lobbyClubConfig && getOwnedLobbyClubCount(input.state, input.playerId, input.lobbyClubConfig) > 0
    ? input.lobbyClubConfig.civilNetworkSupport.restaurantCivilRumorTruthPct
    : 0;
  return {
    restaurantCount,
    network,
    passiveRumorChancePct: Math.min(100, input.config.baseRumorChancePct * network.rumorMultiplier),
    truthChancePct: Math.min(100, baseTruthChancePct + lobbyTruthBonusPct),
    districtHintChancePct: input.config.districtHintChancePct,
    buildingHintChancePct: input.config.buildingHintChancePct,
    reliabilityVisible: false
  };
};

export const applyRestaurantIncomeModifiers = (input: {
  config: RestaurantBalanceConfig;
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
  const network = resolveRestaurantNetworkMultipliers(getOwnedRestaurantCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay * network.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyRestaurantPassiveRumors = (
  state: CoreGameState,
  config: RestaurantBalanceConfig,
  tickRateMs: number,
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
    const metadata = cleanupRestaurantMetadata(getRestaurantMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) {
      continue;
    }
    const stats = resolveRestaurantRumorStats({ state, playerId: building.ownerPlayerId, config, lobbyClubConfig });
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:restaurant-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      const rumor = generateRestaurantRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        lobbyClubConfig,
        seed: `${building.id}:restaurant-rumor-event:${state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      feedInputs.push(createPassiveBuildingRumorInput({
        state,
        building,
        source: "restaurant",
        rumor,
        severity: "low"
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

export const getRestaurantMetadata = (building: CoreGameState["buildingsById"][string]): RestaurantMetadata => {
  const raw = isRecord(building.metadata?.restaurant) ? building.metadata.restaurant : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: RestaurantMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: withRestaurantMetadata(building, cleanupRestaurantMetadata(metadata)),
    version: building.version + 1
  }
});

const generateRestaurantRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: RestaurantBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
  seed: string;
}): RestaurantRumor => {
  const stats = resolveRestaurantRumorStats({ state: input.state, playerId: input.playerId, config: input.config, lobbyClubConfig: input.lobbyClubConfig });
  const type = input.config.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.rumorTypes.length)] ?? "fake";
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < stats.truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const rivalHint = pickRivalPlayerHint(input.state, input.playerId, input.seed);
  const reliabilityLabel = stats.reliabilityVisible ? formatReliability(stats.truthChancePct) : null;
  return {
    type,
    truthChancePct: stats.truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    reliabilityVisible: stats.reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(type, isTrue, districtHint, buildingHint, rivalHint, reliabilityLabel, input.seed)
  };
};

const formatRumorText = (
  type: string,
  isTrue: boolean,
  districtHint: string | null,
  buildingHint: string | null,
  rivalHint: string | null,
  reliabilityLabel: string | null,
  seed: string
): string => {
  const subject = isTrue ? type : "fake";
  const detail = districtHint
    ? buildingHint
      ? ` poblíž ${districtHint}; někdo šeptal i o podniku typu ${buildingHint}`
      : ` poblíž ${districtHint}`
    : buildingHint
      ? ` kolem podniku typu ${buildingHint}`
      : " někde pod neonem";
  const rival = rivalHint ? ` Jméno ${rivalHint} padlo jen šeptem, což je ve zdejší restauraci skoro křik.` : "";
  const reliability = reliabilityLabel ? ` Zdroj zní ${reliabilityLabel}.` : "";
  return `U zadního stolu prý padla řeč o ${formatRumorSubject(subject, seed)}${detail}.${rival}${reliability}`;
};

const RESTAURANT_RUMOR_SUBJECTS: Record<string, string[]> = {
  civilian_movement: [
    "lidech, kteří se po zavíračce ztratili v bočních ulicích; účet prý nezaplatili, což je ta menší záhada",
    "partě, co seděla u okna a počítala hlídky místo drinků",
    "kurýrech, kteří měnili trasu pokaždé, když zablikal semafor, jako by světla měla právní oddělení",
    "cizích tvářích, které chodí kolem stejného bloku až moc často na turisty a moc tiše na hlupáky",
    "nočních návštěvách, co vypadají jako scouting před větší akcí a objednávají si jen vodu, což je podezřelé samo o sobě"
  ],
  suspicious_delivery: [
    "dodávce bez značek a řidiči, co nechtěl účtenku, jen rychle zmizet z dějin",
    "taškách z kuchyňského vchodu, které byly moc těžké na jídlo a moc hranaté na zeleninu",
    "krabicích bez loga, co zmizely dřív než ranní zásobování",
    "nákladu, který prý nešel přes sklad, ale rovnou přes zadní dveře, protože přední dveře mají svědomí",
    "řidiči, co dvakrát objel blok a pak nechal motor běžet, jako by auto vědělo víc než on"
  ],
  police_interest: [
    "hlídkách, které si možná značkují jeden blok a tváří se u toho jako dekorace",
    "policejním autě bez majáků, co stálo moc dlouho na rohu",
    "jménech, která prý padla do policejní vysílačky; rádio se prý zatvářilo zklamaně",
    "bloku, kde se začaly ztrácet malé laskavosti a objevovat velké otázky",
    "něčím heatem, který už možná přitáhl špatný typ pozornosti, tedy ten s formulářem"
  ],
  economic_activity: [
    "cashflow, které nesedí ani kuchaři, a ten už viděl věci v mrazáku",
    "účtech, co voní čistěji, než by měly; čistota je tady vždy podezřelá",
    "hráči, který možná tlačí peníze přes příliš hladkou fasádu",
    "podniku, kde se počítá víc hotovosti než zákazníků, což uráží i jídelní lístek",
    "tichém nárůstu influence, který někdo maskuje jako běžný provoz; velmi roztomilé, velmi nepravděpodobné"
  ],
  storage_movement: [
    "bednách přesunutých dřív, než město rozsvítilo",
    "skladu, který prý v noci vydechl víc zboží, než ráno přiznal",
    "zásobách, co se hýbou jen tehdy, když kamery mrknou",
    "hráči, který možná stahuje materiál před větším tlakem",
    "servisní chodbě, kde bedny mizí bez razítek"
  ],
  attack_preparation: [
    "partě, která si prý kreslí trasu útoku",
    "jídle, co zůstalo nedotčené, zatímco se na ubrousek kreslil plán",
    "někom, kdo shání lidi a ptá se na slabé vchody",
    "hráči, který možná sbírá odvahu i munici na jeden rychlý tah",
    "mapě pod stolem, kde byly červeně zakroužkované únikové trasy"
  ],
  weak_defense: [
    "slabém místě, o kterém mluvil až moc opilý host, takže buď lže, nebo konečně říká pravdu",
    "obraně, která na papíře vypadá tvrději než na ulici; papír má ostatně nulový armor",
    "hlídačích, kteří prý střídají směny s očima napůl zavřenýma",
    "districtu, kde je víc reputace než skutečných zátarasů",
    "hráči, který možná nechal zadní stranu moc měkkou"
  ],
  fake: [
    "historce, která smrdí kouřovou clonou a levným pepřem",
    "jménu, které někdo možná nastrčil jen jako návnadu",
    "příběhu, co zní moc čistě na město po půlnoci; tady je čistý maximálně popelník po kontrole",
    "šeptandě, která může být jen cizí alibi v levném kabátě",
    "stopě, co se rozpadá hned, jak na ni dopadne neon"
  ]
};

const formatRumorSubject = (type: string, seed: string): string =>
  pickVariant(RESTAURANT_RUMOR_SUBJECTS[type] ?? RESTAURANT_RUMOR_SUBJECTS.fake, `${seed}:subject`);

const resolveTruthChancePct = (count: number, config: RestaurantBalanceConfig): number => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  const tier = config.truthChanceByOwnedCount.find((candidate) =>
    safeCount >= candidate.minOwned && (candidate.maxOwned === null || safeCount <= candidate.maxOwned)
  );
  return tier?.truthChancePct ?? 0;
};

const formatReliability = (truthChancePct: number): string =>
  truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";

const cleanupRestaurantMetadata = (metadata: RestaurantMetadata): RestaurantMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const withRestaurantMetadata = (
  building: CoreGameState["buildingsById"][string],
  restaurant: RestaurantMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  restaurant
});

const pickDistrictHint = (state: CoreGameState, seed: string): string | null => {
  const districts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  return districts.length > 0 ? districts[Math.floor(deterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null : null;
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

const normalizeRumor = (value: Record<string, unknown>): RestaurantRumor => ({
  type: String(value.type || "fake"),
  truthChancePct: Math.max(0, Number(value.truthChancePct || 0)),
  isTrue: Boolean(value.isTrue),
  districtHint: value.districtHint ? String(value.districtHint) : null,
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
