import type { FixedBuildingBalanceConfig, LobbyClubBalanceConfig, VipLoungeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicRollPct, isRecord } from "../utils";
import { applyResolvedRumorEventsToState, createPassiveBuildingRumorInput, type ResolveRumorEventInput } from "../rules/events/rumorPipeline";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";
import type { VipLoungeMetadata, VipLoungeRumor } from "./vipLoungeTypes";

export type { VipLoungeRumor } from "./vipLoungeTypes";

export const getOwnedVipLoungeCount = (
  state: CoreGameState,
  playerId: string,
  config: VipLoungeBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveVipLoungeNetworkTier = (
  count: number,
  config: VipLoungeBalanceConfig
): VipLoungeBalanceConfig["network"]["tiers"][number] => {
  const safeCount = Math.max(0, Math.floor(Number(count || 0)));
  return config.network.tiers.find((tier) =>
    safeCount >= tier.minOwned && (tier.maxOwned === null || safeCount <= tier.maxOwned)
  ) ?? config.network.tiers[0];
};

export const resolveVipLoungeRumorStats = (input: {
  state: CoreGameState;
  playerId: string;
  config: VipLoungeBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
}) => {
  const ownedCount = getOwnedVipLoungeCount(input.state, input.playerId, input.config);
  const tier = resolveVipLoungeNetworkTier(ownedCount, input.config);
  const lobbyTruthBonusPct = input.lobbyClubConfig && getOwnedLobbyClubCount(input.state, input.playerId, input.lobbyClubConfig) > 0
    ? input.lobbyClubConfig.civilNetworkSupport.vipLoungeTruthChancePct + input.lobbyClubConfig.synergies.vipLoungeTruthChancePct
    : 0;
  return {
    ownedCount,
    tier,
    passiveRumorChancePct: input.config.passiveRumor.baseChancePct,
    rumorIntervalMinutes: tier.rumorIntervalMinutes,
    truthChancePct: Math.min(100, tier.truthChancePct + lobbyTruthBonusPct),
    districtHintChancePct: tier.districtHintChancePct,
    buildingHintChancePct: tier.buildingHintChancePct,
    reliabilityLabelChancePct: tier.reliabilityLabelChancePct
  };
};

export const applyVipLoungeIncomeModifiers = (input: {
  config: VipLoungeBalanceConfig;
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
  const tier = resolveVipLoungeNetworkTier(getOwnedVipLoungeCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * tier.incomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * tier.incomeMultiplier,
    heatPerDay: input.heatPerDay * tier.heatMultiplier,
    influencePerDay: input.influencePerDay * tier.influenceMultiplier,
    maxLevel: 1
  };
};

export const applyVipLoungePassiveRumors = (
  state: CoreGameState,
  config: VipLoungeBalanceConfig,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  const feedInputs: ResolveRumorEventInput[] = [];

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) continue;
    const stats = resolveVipLoungeRumorStats({ state, playerId: building.ownerPlayerId, config, lobbyClubConfig });
    const intervalTicks = minutesToTicks(stats.rumorIntervalMinutes, tickRateMs);
    const metadata = cleanupVipLoungeMetadata(getVipLoungeMetadata(building));
    if (metadata.lastPassiveRumorCheckTick === undefined) {
      metadata.lastPassiveRumorCheckTick = state.root.tick;
      buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
      changed = true;
      continue;
    }
    if ((metadata.lastPassiveRumorCheckTick ?? -Infinity) + intervalTicks > state.root.tick) continue;
    metadata.lastPassiveRumorCheckTick = state.root.tick;
    if (deterministicRollPct(`${building.id}:vip-lounge-passive-rumor:${state.root.tick}`) < stats.passiveRumorChancePct) {
      const rumor = generateVipLoungeRumor({
        state,
        playerId: building.ownerPlayerId,
        config,
        lobbyClubConfig,
        seed: `${building.id}:vip-lounge-rumor-event:${state.root.tick}`
      });
      metadata.rumorEvents.push(rumor);
      feedInputs.push(createPassiveBuildingRumorInput({
        state,
        building,
        source: "vip_lounge",
        rumor,
        severity: rumor.type === "trap_suspicion" ? "low" : "medium",
        negative: ["political_pressure", "police_warning", "planned_attack", "revenge_plan", "trap_suspicion"].includes(rumor.type)
      }));
    }
    buildingsById = updateBuildingMetadata(buildingsById, building, metadata);
    changed = true;
  }

  const metadataState = changed ? { ...state, buildingsById } : state;
  return feedInputs.length > 0
    ? applyResolvedRumorEventsToState(metadataState, feedInputs, { lobbyClubConfig })
    : metadataState;
};

export const getVipLoungeMetadata = (building: CoreGameState["buildingsById"][string]): VipLoungeMetadata => {
  const raw = isRecord(building.metadata?.vipLounge) ? building.metadata.vipLounge : {};
  return {
    lastPassiveRumorCheckTick: asOptionalTick(raw.lastPassiveRumorCheckTick),
    rumorEvents: Array.isArray(raw.rumorEvents) ? raw.rumorEvents.filter(isRecord).map(normalizeRumor).slice(-12) : []
  };
};

const generateVipLoungeRumor = (input: {
  state: CoreGameState;
  playerId: string;
  config: VipLoungeBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
  seed: string;
}): VipLoungeRumor => {
  const stats = resolveVipLoungeRumorStats({ state: input.state, playerId: input.playerId, config: input.config, lobbyClubConfig: input.lobbyClubConfig });
  const rawType = input.config.passiveRumor.rumorTypes[Math.floor(deterministicRollPct(`${input.seed}:type`) / 100 * input.config.passiveRumor.rumorTypes.length)] ?? "fake";
  const type = rawType === "trap_suspicion" && deterministicRollPct(`${input.seed}:trap-ultra-rare`) >= 2 ? "fake" : rawType;
  const truthChancePct = type === "trap_suspicion" ? Math.min(25, stats.truthChancePct) : stats.truthChancePct;
  const isTrue = deterministicRollPct(`${input.seed}:truth`) < truthChancePct;
  const districtHint = deterministicRollPct(`${input.seed}:district`) < stats.districtHintChancePct ? pickDistrictHint(input.state, input.seed) : null;
  const buildingHint = deterministicRollPct(`${input.seed}:building`) < stats.buildingHintChancePct ? pickBuildingHint(input.state, input.seed) : null;
  const rivalHint = pickRivalPlayerHint(input.state, input.playerId, input.seed);
  const reliabilityVisible = deterministicRollPct(`${input.seed}:reliability`) < stats.reliabilityLabelChancePct;
  const reliabilityLabel = reliabilityVisible ? resolveReliabilityLabel(stats.truthChancePct, input.config, input.seed) : null;
  const subject = isTrue ? type : "fake";
  return {
    type,
    truthChancePct,
    isTrue,
    districtHint,
    buildingHint,
    reliabilityVisible,
    reliabilityLabel,
    text: formatRumorText(subject, districtHint, buildingHint, rivalHint, reliabilityLabel, input.seed)
  };
};

const formatRumorText = (
  type: string,
  districtHint: string | null,
  buildingHint: string | null,
  rivalHint: string | null,
  reliabilityLabel: string | null,
  seed: string
): string => {
  const place = districtHint
    ? ` poblíž ${districtHint}`
    : " někde za matným sklem města";
  const building = buildingHint ? `, stopa vede k podniku typu ${buildingHint}` : "";
  const rival = rivalHint ? ` Zdroj opatrně spojil stopu se jménem ${rivalHint}; opatrně, protože žaloby jsou drahé.` : "";
  const reliability = reliabilityLabel ? ` Zdroj si věří: ${reliabilityLabel}. V tomhle městě je to skoro diagnóza.` : "";
  return `${formatRumorSubject(type, seed)}${place}${building}.${rival}${reliability}`;
};

const VIP_RUMOR_SUBJECTS: Record<string, string[]> = {
  political_pressure: [
    "VIP zdroj šeptá, že se chystá tichý politický tlak; nejhorší druh ticha, nosí kravatu",
    "U sametového stolu prý někdo kupuje měkkou moc na příští tah",
    "Zákulisí údajně tlačí na úřední dveře bez otisků",
    "Někdo s vlivem možná připravuje rozhodnutí dřív, než se objeví na papíře",
    "Politická linka prý zadrnčela ve jménu jednoho hráče"
  ],
  financial_deal: [
    "U zadního stolu prý proběhla dohoda s příliš hladkým cashflow. Když peníze kloužou, někdo maže",
    "Drahý oblek naznačil obchod, který se nedá najít v účetnictví, což účetnictví bere jako osobní urážku",
    "Někdo možná přesouvá clean cash tak čistě, až to působí špinavě",
    "VIP stůl slyšel sumu, která by vysvětlila náhlý růst jednoho hráče",
    "Finanční stopa prý vede přes ruce, které se nikdy nefotí"
  ],
  police_warning: [
    "Zákulisní zdroj tvrdí, že policie si připravuje měkký stisk. Měkký jen podle policejního slovníku",
    "Někdo z vyššího patra prý viděl policejní seznam dřív než ulice",
    "Zdroj říká, že jeden hráč má heat vyšší, než si připouští",
    "Policie údajně čeká na špatný pohyb, ne na povolení",
    "Modrá linka prý sleduje cashflow a trpělivě počítá chyby. Policie miluje matematiku, když bolí někoho jiného"
  ],
  planned_attack: [
    "Host v drahém obleku naznačil útok, ale neřekl jméno. Drahé obleky milují dramaturgii",
    "Na stole ležela mapa a sklenka se nepohnula, dokud nepadl plán",
    "Někdo prý shání sílu na rychlý úder proti měkkému cíli",
    "VIP zdroj zachytil přípravu akce, která má vypadat jako nehoda",
    "Útok se možná nekreslí na zdi, ale v soukromém kalendáři už svítí"
  ],
  revenge_plan: [
    "Za závěsem údajně padla řeč o odvetě",
    "Někdo si prý neodpustil starý dluh a teď hledá správnou noc",
    "VIP stůl slyšel jméno vyslovené jako slib, ne jako vzpomínku",
    "Odveta možná zraje pomalu, ale zdroj tvrdí, že nezmizela",
    "Někdo údajně přepočítává křivdy na munici"
  ],
  casino_money: [
    "VIP stůl prý cítil casino cash, co prošel špatným filtrem",
    "Žetony údajně kryly pohyb peněz, který nesedí ke hře",
    "Někdo možná používá hazard jako výtah pro špinavé zisky",
    "Zdroj mluví o cashflow, které voní po baru a účetní panice",
    "Casino peníze prý mění majitele rychleji než karta na stole"
  ],
  smuggling_route: [
    "Zákulisní šeptanda ukazuje na trasu, kterou mapa radši nezná",
    "Někdo údajně našel koridor, kde se zboží ptá méně než lidé",
    "VIP zdroj mluví o cestě, která obchází světla i manifesty",
    "Pašerácká linka možná vede kolem districtu, který se tváří klidně",
    "Zboží prý teče městem stranou od hlavních kamer"
  ],
  drug_distribution: [
    "Někdo z VIP části pustil stopu o distribuci neonového zboží",
    "Zdroj naznačil síť, kde se malé dávky mění ve velký problém",
    "Někdo možná tlačí zboží do ulic rychleji, než stíhá chladnout asfalt",
    "VIP stůl zachytil jméno napojené na noční distribuci",
    "Neonový produkt prý mění trasy podle toho, kdo zrovna hlídá roh"
  ],
  hidden_weakness: [
    "Elitní host naznačil slabinu, za kterou by se platilo krví. Nebo influence, podle kurzu",
    "Zdroj tvrdí, že jeden hráč má měkké místo za drahou fasádou. Fasáda prý fakt maká přesčas",
    "Někde prý chybí obrana přesně tam, kde reputace křičí nejhlasitěji",
    "VIP linka ukazuje na slabinu, kterou zatím kryje jen sebevědomí",
    "Někdo možná nechal odkrytý bok a doufá, že se nikdo nedívá"
  ],
  weak_defense: [
    "Zdroj tvrdí, že jeden district vypadá tvrdší, než ve skutečnosti je",
    "Obrana prý stojí víc na pověsti než na skutečné výbavě",
    "Někdo šetřil na hlídačích a koupil si místo toho klidný výraz",
    "VIP zdroj mluví o okně, které se zavírá pomaleji než ostatní",
    "District možná drží fasádu, ale zadní strana prý dýchá moc lehce"
  ],
  storage_hint: [
    "Zdroj mluvil o skladu, kolem kterého se v noci hýbou cizí ruce",
    "Někdo prý stahuje zásoby do místa, které zatím nevypadá důležitě",
    "VIP stopa ukazuje na bedny, které mění adresu před větší akcí",
    "Sklad údajně nabírá váhu. To bývá před bouří nebo před loupeží",
    "Zboží se možná přesouvá podle plánu, který hráči ještě nevidí"
  ],
  trap_suspicion: [
    "VIP zdroj říká, že v jednom bloku něco nesedí. Nikdo nepotvrdil proč, ani kdo tam dělal interiér",
    "Někdo varoval před příliš tichou trasou, ale důkaz nikdo nepoložil na stůl",
    "Zdroj mluví o místě, kde se lidé vrací bledší, pokud se vrátí vůbec",
    "V jednom směru města prý mizí zvuk kroků. Může to být jen paranoia",
    "VIP šeptanda naznačuje nepříjemné uvítání, ale neříká kde ani jaké. Velmi drahý způsob, jak říct možná"
  ],
  fake: [
    "VIP část pustila historku, která může být jen drahá kouřová clona",
    "Zdroj možná prodává elegantní lež s drahým razítkem",
    "Stopa vypadá kvalitně, ale někdo ji mohl naleštit pro cizí oči",
    "Někdo možná přes VIP síť jen rozhazuje cizí jméno jako návnadu",
    "Drahý drb nemusí být pravda. Jen mívá lepší parfém"
  ]
};

const formatRumorSubject = (type: string, seed: string): string =>
  pickVariant(VIP_RUMOR_SUBJECTS[type] ?? VIP_RUMOR_SUBJECTS.fake, `${seed}:subject`);

const resolveReliabilityLabel = (truthChancePct: number, config: VipLoungeBalanceConfig, seed: string): string => {
  const labels = config.passiveRumor.reliabilityLabels;
  if (truthChancePct >= 82) return labels[2] ?? "vysoká spolehlivost";
  if (truthChancePct >= 74) return deterministicRollPct(`${seed}:reliability-noise`) < 18 ? labels[0] ?? "nízká spolehlivost" : labels[1] ?? "střední spolehlivost";
  return deterministicRollPct(`${seed}:reliability-noise`) < 20 ? labels[1] ?? "střední spolehlivost" : labels[0] ?? "nízká spolehlivost";
};

const updateBuildingMetadata = (
  buildingsById: CoreGameState["buildingsById"],
  building: CoreGameState["buildingsById"][string],
  metadata: VipLoungeMetadata
): CoreGameState["buildingsById"] => ({
  ...buildingsById,
  [building.id]: {
    ...building,
    metadata: withVipLoungeMetadata(building, cleanupVipLoungeMetadata(metadata)),
    version: building.version + 1
  }
});

const cleanupVipLoungeMetadata = (metadata: VipLoungeMetadata): VipLoungeMetadata => ({
  ...metadata,
  rumorEvents: metadata.rumorEvents.slice(-12)
});

const withVipLoungeMetadata = (
  building: CoreGameState["buildingsById"][string],
  vipLounge: VipLoungeMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  vipLounge
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

const normalizeRumor = (value: Record<string, unknown>): VipLoungeRumor => ({
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

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};
