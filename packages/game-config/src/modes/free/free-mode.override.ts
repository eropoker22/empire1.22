import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeApartmentBlockConfig } from "../../public/free-mode-apartment-block-config";
import { freeModeAirportConfig } from "../../public/free-mode-airport-config";
import { freeModeArcadeConfig } from "../../public/free-mode-arcade-config";
import { freeModeCasinoConfig } from "../../public/free-mode-casino-config";
import { freeModeCarDealerConfig } from "../../public/free-mode-car-dealer-config";
import { freeModeCentralBankConfig } from "../../public/free-mode-central-bank-config";
import { freeModeCityHallConfig } from "../../public/free-mode-city-hall-config";
import { freeModeClinicConfig } from "../../public/free-mode-clinic-config";
import { freeModeConvenienceStoreConfig } from "../../public/free-mode-convenience-store-config";
import { freeModeExchangeOfficeConfig } from "../../public/free-mode-exchange-office-config";
import { freeModeFitnessClubConfig } from "../../public/free-mode-fitness-club-config";
import { freeModeGarageConfig } from "../../public/free-mode-garage-config";
import { freeModePowerStationConfig } from "../../public/free-mode-power-station-config";
import { freeModeRecyclingCenterConfig } from "../../public/free-mode-recycling-center-config";
import { freeModeSchoolConfig } from "../../public/free-mode-school-config";
import { freeModeSmugglingTunnelConfig } from "../../public/free-mode-smuggling-tunnel-config";
import { freeModeStreetDealersConfig } from "../../public/free-mode-street-dealers-config";
import { freeModeRecruitmentCenterConfig } from "../../public/free-mode-recruitment-center-config";
import { freeModeRestaurantConfig } from "../../public/free-mode-restaurant-config";
import { freeModeShoppingMallConfig } from "../../public/free-mode-shopping-mall-config";
import { freeModeStockExchangeConfig } from "../../public/free-mode-stock-exchange-config";
import { freeModeStripClubConfig } from "../../public/free-mode-strip-club-config";
import { freeModeVipLoungeConfig } from "../../public/free-mode-vip-lounge-config";
import { freeModeWarehouseConfig } from "../../public/free-mode-warehouse-config";
import { freeModePoliceConfig } from "./free-police-config";

export const freeModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "free",
  tickRateMs: 5000,
  balance: {
    incomeMultiplier: 1.2,
    productionMultiplier: 1.2,
    cooldownMultiplier: 0.8,
    maxPlayersPerServer: 20,
    maxAllianceSize: 4,
    buildSlotLimit: 8,
    eventFrequencyMultiplier: 1.2,
    policePressureMultiplier: 0.9,
    raidIntensityMultiplier: 0.9,
    expansionSpeedMultiplier: 1.3,
    dayLengthTicks: 8,
    nightLengthTicks: 8,
    victoryConditionKey: "fast-control",
    districtControlVictoryThreshold: 0.85,
    police: freeModePoliceConfig,
    conflict: {
      spyCooldownTicks: 1,
      attackCooldownTicks: 36,
      minAttackDurationTicks: 36,
      attackHeatGain: 8,
      spyBaseSuccessChance: 0.76,
      spyTrapRevealChance: 0.2,
      trapAttackLosses: 2,
      reportsLimit: 6,
      catastropheChance: 0.06
    },
    startingResources: {
      cash: 1500,
      "dirty-cash": 300,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    },
    fixedBuildings: {
      casino: {
        cleanPerHour: freeModeCasinoConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeCasinoConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeCasinoConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeCasinoConfig.influencePerMinute * 60 * 24,
        maxLevel: 4
      },
      exchange: {
        cleanPerHour: freeModeExchangeOfficeConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeExchangeOfficeConfig.dirtyCashPerMinute * 60,
        heatPerDay: 230.4,
        influencePerDay: 403.2,
        maxLevel: 1
      },
      arcade: {
        cleanPerHour: freeModeArcadeConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeArcadeConfig.dirtyCashPerMinute * 60,
        heatPerDay: 172.8,
        influencePerDay: 259.2,
        maxLevel: 1
      },
      apartment_block: {
        cleanPerHour: 0,
        dirtyPerHour: 0,
        heatPerDay: 0,
        influencePerDay: 0,
        maxLevel: 1
      },
      school: {
        cleanPerHour: freeModeSchoolConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: 0,
        influencePerDay: freeModeSchoolConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      warehouse: {
        cleanPerHour: freeModeWarehouseConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: 86.4,
        influencePerDay: 0,
        maxLevel: 4
      },
      clinic: {
        cleanPerHour: freeModeClinicConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: 43.2,
        influencePerDay: 0,
        maxLevel: 1
      },
      strip_club: {
        cleanPerHour: freeModeStripClubConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeStripClubConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeStripClubConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeStripClubConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      power_station: {
        cleanPerHour: freeModePowerStationConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: 115.2,
        influencePerDay: 0,
        maxLevel: 1
      },
      restaurant: {
        cleanPerHour: freeModeRestaurantConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: 57.6,
        influencePerDay: 172.8,
        maxLevel: 1
      },
      convenience_store: {
        cleanPerHour: freeModeConvenienceStoreConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeConvenienceStoreConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeConvenienceStoreConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeConvenienceStoreConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      shopping_mall: {
        cleanPerHour: freeModeShoppingMallConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeShoppingMallConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeShoppingMallConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeShoppingMallConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      central_bank: {
        cleanPerHour: freeModeCentralBankConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeCentralBankConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeCentralBankConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      stock_exchange: {
        cleanPerHour: freeModeStockExchangeConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeStockExchangeConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeStockExchangeConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      airport: {
        cleanPerHour: freeModeAirportConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeAirportConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeAirportConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeAirportConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      city_hall: {
        cleanPerHour: freeModeCityHallConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeCityHallConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeCityHallConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      vip_lounge: {
        cleanPerHour: freeModeVipLoungeConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeVipLoungeConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeVipLoungeConfig.heatPerMinute * 60 * 24,
        influencePerDay: freeModeVipLoungeConfig.influencePerMinute * 60 * 24,
        maxLevel: 1
      },
      fitness_club: {
        cleanPerHour: freeModeFitnessClubConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeFitnessClubConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      recruitment_center: {
        cleanPerHour: freeModeRecruitmentCenterConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeRecruitmentCenterConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      garage: {
        cleanPerHour: freeModeGarageConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeGarageConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      car_dealer: {
        cleanPerHour: freeModeCarDealerConfig.cleanCashPerMinute * 60,
        dirtyPerHour: freeModeCarDealerConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeCarDealerConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      recycling_center: {
        cleanPerHour: freeModeRecyclingCenterConfig.cleanCashPerMinute * 60,
        dirtyPerHour: 0,
        heatPerDay: freeModeRecyclingCenterConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      smuggling_tunnel: {
        cleanPerHour: 0,
        dirtyPerHour: freeModeSmugglingTunnelConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeSmugglingTunnelConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      },
      street_dealers: {
        cleanPerHour: 0,
        dirtyPerHour: freeModeStreetDealersConfig.dirtyCashPerMinute * 60,
        heatPerDay: freeModeStreetDealersConfig.heatPerMinute * 60 * 24,
        influencePerDay: 0,
        maxLevel: 1
      }
    },
    buildingActions: {
      official_cover: {
        actionId: "official_cover",
        buildingType: "city_hall",
        label: "Úřední krytí",
        description: "Na 8 minut sníží heat gain, police control chance a rumor chance ve zvoleném vlastněném districtu.",
        durationMs: freeModeCityHallConfig.officialCover.durationMinutes * 60 * 1000,
        cooldownMs: freeModeCityHallConfig.officialCover.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeCityHallConfig.officialCover.costCleanCash },
        outputGain: {},
        heatGain: freeModeCityHallConfig.officialCover.heatGain,
        influenceChange: -freeModeCityHallConfig.officialCover.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Úřední krytí je aktivní. Cílový district má dočasně slabší heat a policejní tlak."
      },
      city_contract: {
        actionId: "city_contract",
        buildingType: "city_hall",
        label: "Městská zakázka",
        description: "Převede politický vliv na clean cash podle počtu legálních budov hráče.",
        durationMs: 0,
        cooldownMs: freeModeCityHallConfig.cityContract.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeCityHallConfig.cityContract.heatGain,
        influenceChange: -freeModeCityHallConfig.cityContract.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Městská zakázka připsala clean cash podle legální infrastruktury."
      },
      emergency_decree: {
        actionId: "emergency_decree",
        buildingType: "city_hall",
        label: "Nouzová vyhláška",
        description: "Na 6 minut spustí městský režim: Noční hlídky, Zastavené kontroly nebo Stavební uzávěru.",
        durationMs: freeModeCityHallConfig.emergencyDecree.durationMinutes * 60 * 1000,
        cooldownMs: freeModeCityHallConfig.emergencyDecree.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeCityHallConfig.emergencyDecree.costCleanCash },
        outputGain: {},
        heatGain: freeModeCityHallConfig.emergencyDecree.heatGain,
        influenceChange: -freeModeCityHallConfig.emergencyDecree.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Magistrát vydal nouzovou vyhlášku. Město se na chvíli mění."
      },
      express_import: {
        actionId: "express_import",
        buildingType: "airport",
        label: "Expresní dovoz",
        description: "Po 90 sekundách doručí importní zásilku vybrané kategorie do skladu hráče. Přesah přes storage kapacitu propadne.",
        durationMs: freeModeAirportConfig.expressImport.durationSeconds * 1000,
        cooldownMs: freeModeAirportConfig.expressImport.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeAirportConfig.expressImport.costCleanCash },
        outputGain: {},
        heatGain: freeModeAirportConfig.expressImport.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Expresní dovoz byl objednán. Zásilka dorazí po krátkém runway okně."
      },
      black_charter: {
        actionId: "black_charter",
        buildingType: "airport",
        label: "Černý charter",
        description: "Na 8 minut otevře speciální Black Market nabídku se slevou a celním rizikem při nákupu.",
        durationMs: 0,
        cooldownMs: freeModeAirportConfig.blackCharter.cooldownMinutes * 60 * 1000,
        inputCost: { "dirty-cash": freeModeAirportConfig.blackCharter.costDirtyCash },
        outputGain: {},
        heatGain: freeModeAirportConfig.blackCharter.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Černý charter otevřel dočasnou Black Market nabídku."
      },
      evacuation_corridor: {
        actionId: "evacuation_corridor",
        buildingType: "airport",
        label: "Evakuační koridor",
        description: "Na 7 minut zlepší únik, sníží ztráty při neúspěchu a zrychlí návratové logistické časy.",
        durationMs: freeModeAirportConfig.evacuationCorridor.durationMinutes * 60 * 1000,
        cooldownMs: freeModeAirportConfig.evacuationCorridor.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeAirportConfig.evacuationCorridor.costCleanCash },
        outputGain: {},
        heatGain: freeModeAirportConfig.evacuationCorridor.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Evakuační koridor je aktivní. Únik a logistika mají dočasný boost."
      },
      speculative_buy: {
        actionId: "speculative_buy",
        buildingType: "stock_exchange",
        label: "Spekulativní nákup",
        description: "Investuje clean cash do vybrané market kategorie. Výsledek může být zisk, neutrální pohyb nebo ztráta.",
        durationMs: 0,
        cooldownMs: freeModeStockExchangeConfig.speculativeBuy.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeStockExchangeConfig.speculativeBuy.costCleanCash },
        outputGain: {},
        heatGain: freeModeStockExchangeConfig.speculativeBuy.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Burza provedla spekulativní nákup a zvýšila financial inspection risk."
      },
      market_pressure: {
        actionId: "market_pressure",
        buildingType: "stock_exchange",
        label: "Tržní tlak",
        description: "Na 10 minut server-wide pumpne nebo dumpne ceny vybrané market kategorie.",
        durationMs: freeModeStockExchangeConfig.marketPressure.durationMinutes * 60 * 1000,
        cooldownMs: freeModeStockExchangeConfig.marketPressure.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeStockExchangeConfig.marketPressure.costCleanCash },
        outputGain: {},
        heatGain: freeModeStockExchangeConfig.marketPressure.heatGain,
        influenceChange: -freeModeStockExchangeConfig.marketPressure.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Downtown burza rozkolísala ceny ve vybrané kategorii."
      },
      insider_window: {
        actionId: "insider_window",
        buildingType: "stock_exchange",
        label: "Insider Window",
        description: "Na 6 minut zlepší trend hints, fee reduction a šanci Spekulativního nákupu.",
        durationMs: freeModeStockExchangeConfig.insiderWindow.durationMinutes * 60 * 1000,
        cooldownMs: freeModeStockExchangeConfig.insiderWindow.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeStockExchangeConfig.insiderWindow.costCleanCash },
        outputGain: {},
        heatGain: freeModeStockExchangeConfig.insiderWindow.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Insider Window aktivní. Burza ukazuje hlubší trend hints, ale zvedá financial inspection risk."
      },
      liquidity_injection: {
        actionId: "liquidity_injection",
        buildingType: "central_bank",
        label: "Likviditní injekce",
        description: "Okamžitě přidá clean cash podle velikosti čisté ekonomiky hráče a zvýší Financial Oversight risk.",
        durationMs: 0,
        cooldownMs: freeModeCentralBankConfig.liquidityInjection.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeCentralBankConfig.liquidityInjection.heatGain,
        influenceChange: -freeModeCentralBankConfig.liquidityInjection.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Centrální banka provedla likviditní injekci podle čisté ekonomiky hráče."
      },
      frozen_accounts: {
        actionId: "frozen_accounts",
        buildingType: "central_bank",
        label: "Zmrazené účty",
        description: "Na 8 minut zvýší ochranu clean cash, sníží pokuty a finanční ztráty, ale zhorší market fee.",
        durationMs: freeModeCentralBankConfig.frozenAccounts.durationMinutes * 60 * 1000,
        cooldownMs: freeModeCentralBankConfig.frozenAccounts.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeCentralBankConfig.frozenAccounts.costCleanCash },
        outputGain: {},
        heatGain: freeModeCentralBankConfig.frozenAccounts.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Zmrazené účty chrání rezervy, ale zhoršují poplatkovou stopu na marketu."
      },
      currency_intervention: {
        actionId: "currency_intervention",
        buildingType: "central_bank",
        label: "Kurzovní intervence",
        description: "Na 8 minut stabilizuje vybranou market kategorii a tlumí účinek Tržního tlaku z Burzy.",
        durationMs: freeModeCentralBankConfig.currencyIntervention.durationMinutes * 60 * 1000,
        cooldownMs: freeModeCentralBankConfig.currencyIntervention.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeCentralBankConfig.currencyIntervention.costCleanCash },
        outputGain: {},
        heatGain: freeModeCentralBankConfig.currencyIntervention.heatGain,
        influenceChange: -freeModeCentralBankConfig.currencyIntervention.costInfluence,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Centrální banka spustila kurzovní intervenci ve vybrané kategorii."
      },
      open_channel: {
        actionId: "open_channel",
        buildingType: "smuggling_tunnel",
        label: "Otevřít kanál",
        description: "Na 7 minut globálně posílí dirty cash produkci Pašovacích tunelů a prodej Pouličních dealerů. Nestackuje se.",
        durationMs: freeModeSmugglingTunnelConfig.openChannel.durationMinutes * 60 * 1000,
        cooldownMs: freeModeSmugglingTunnelConfig.openChannel.cooldownMinutes * 60 * 1000,
        inputCost: { "dirty-cash": freeModeSmugglingTunnelConfig.openChannel.costDirtyCash },
        outputGain: {},
        heatGain: freeModeSmugglingTunnelConfig.openChannel.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Otevřený kanál krátkodobě zvedne tok špinavých peněz, dealer rewardy a street risk."
      },
      extract_losses: {
        actionId: "extract_losses",
        buildingType: "recycling_center",
        label: "Vytěžit ztráty",
        description: "Vrátí část neexpirovaných itemových ztrát ze salvage poolu. Nevrací populaci ani členy gangu.",
        durationMs: 0,
        cooldownMs: freeModeRecyclingCenterConfig.extractLosses.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeRecyclingCenterConfig.extractLosses.cleanCashCost },
        outputGain: {},
        heatGain: freeModeRecyclingCenterConfig.extractLosses.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Recyklační centrum vytěžilo část ztracených itemů ze šrotu."
      },
      stabilization_protocol: {
        actionId: "stabilization_protocol",
        buildingType: "clinic",
        label: "Stabilizační protokol",
        description: "Za clean cash vrátí část neexpirovaných ztrát z recovery poolu do gangu a skladu.",
        durationMs: 0,
        cooldownMs: freeModeClinicConfig.stabilizationProtocol.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeClinicConfig.stabilizationProtocol.cleanCashCost },
        outputGain: {},
        heatGain: freeModeClinicConfig.stabilizationProtocol.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Stabilizační protokol obnoví část nedávných ztrát. Recovery neprobíhá automaticky."
      },
      collect_population: {
        actionId: "collect_population",
        buildingType: "apartment_block",
        label: "Vybrat obyvatele",
        description: "Přesune lokálně uložené obyvatele z bytového bloku do globální populace hráče.",
        durationMs: 0,
        cooldownMs: 0,
        inputCost: {},
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Vybere obyvatele z lokálního zásobníku bytového bloku."
      },
      collect_students: {
        actionId: "collect_students",
        buildingType: "school",
        label: "Vybrat studenty",
        description: "Přesune lokálně uložené studenty ze Školy do globální populace a spustí Talent Pool roll.",
        durationMs: 0,
        cooldownMs: 0,
        inputCost: {},
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Vybere studenty ze Školy a zkusí najít talent."
      },
      evening_course: {
        actionId: "evening_course",
        buildingType: "school",
        label: "Večerní kurz",
        description: "Na 8 minut zvýší produkci studentů, šanci na talent a čistý příjem konkrétní Školy.",
        durationMs: freeModeSchoolConfig.eveningCourse.durationMinutes * 60 * 1000,
        cooldownMs: freeModeSchoolConfig.eveningCourse.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeSchoolConfig.eveningCourse.costCleanCash },
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Večerní kurz dočasně zvedne studenty, talent roll a clean income Školy."
      },
      night_machines: {
        actionId: "night_machines",
        buildingType: "arcade",
        label: "Noční automaty",
        description: "Na 7 minut zvýší produkci Herny, vliv, heat a audit risk.",
        durationMs: freeModeArcadeConfig.nightMachines.durationMinutes * 60 * 1000,
        cooldownMs: freeModeArcadeConfig.nightMachines.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        effectModifiers: {
          cleanIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.cleanIncomeBonusPct / 100,
          dirtyIncomeMultiplier: 1 + freeModeArcadeConfig.nightMachines.dirtyIncomeBonusPct / 100,
          influenceMultiplier: 1 + freeModeArcadeConfig.nightMachines.influenceBonusPct / 100,
          heatMultiplier: 1 + freeModeArcadeConfig.nightMachines.heatBonusPct / 100
        },
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Aktivuje Noční automaty. Boost se sám se sebou nestackuje."
      },
      back_cashdesk: {
        actionId: "back_cashdesk",
        buildingType: "arcade",
        label: "Zadní pokladna",
        description: "Instantně vypere část aktuálního dirty cash přes zadní pokladnu Herny.",
        durationMs: 0,
        cooldownMs: freeModeArcadeConfig.backCashdesk.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeArcadeConfig.backCashdesk.heatGain,
        influenceChange: freeModeArcadeConfig.backCashdesk.influenceGain,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
      },
      good_rate: {
        actionId: "good_rate",
        buildingType: "exchange",
        label: "Výhodný kurz",
        description: "Instantně vypere menší část aktuálního dirty cash přes síť směnáren.",
        durationMs: 0,
        cooldownMs: freeModeExchangeOfficeConfig.goodRate.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeExchangeOfficeConfig.goodRate.heatGain,
        influenceChange: freeModeExchangeOfficeConfig.goodRate.influenceGain,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
      },
      quiet_backroom: {
        actionId: "quiet_backroom",
        buildingType: "casino",
        label: "Tichá herna",
        description: "Instantně vypere část aktuálního dirty cash přes tiché zázemí kasina.",
        durationMs: 0,
        cooldownMs: freeModeCasinoConfig.quietBackroom.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeCasinoConfig.quietBackroom.heatGain,
        influenceChange: freeModeCasinoConfig.quietBackroom.influenceGain,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
      },
      vip_night: {
        actionId: "vip_night",
        buildingType: "casino",
        label: "VIP noc",
        description: "Na 10 minut výrazně zvýší casino income, vliv, heat a audit risk.",
        durationMs: freeModeCasinoConfig.vipNight.durationMinutes * 60 * 1000,
        cooldownMs: freeModeCasinoConfig.vipNight.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        effectModifiers: {
          cleanIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.cleanIncomeBonusPct / 100,
          dirtyIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.dirtyIncomeBonusPct / 100,
          influenceMultiplier: 1 + freeModeCasinoConfig.vipNight.influenceBonusPct / 100,
          heatMultiplier: 1 + freeModeCasinoConfig.vipNight.heatBonusPct / 100
        },
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Aktivuje VIP noc. Boost se sám se sebou nestackuje."
      },
      bribed_inspector: {
        actionId: "bribed_inspector",
        buildingType: "casino",
        label: "Podplacený inspektor",
        description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší policejní tlak.",
        durationMs: freeModeCasinoConfig.bribedInspector.protectionMinutes * 60 * 1000,
        cooldownMs: freeModeCasinoConfig.bribedInspector.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeCasinoConfig.bribedInspector.cleanCashCost },
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Heat control akce s rizikem selhání."
      },
      vip_lounge: {
        actionId: "vip_lounge",
        buildingType: "strip_club",
        label: "VIP salonek",
        description: "Na 8 minut zvýší produkci Strip Clubu, vliv, heat a šanci na drb.",
        durationMs: freeModeStripClubConfig.vipLounge.durationMinutes * 60 * 1000,
        cooldownMs: freeModeStripClubConfig.vipLounge.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeStripClubConfig.vipLounge.cleanCashCost },
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        effectModifiers: {
          cleanIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.cleanIncomeBonusPct / 100,
          dirtyIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.dirtyIncomeBonusPct / 100,
          influenceMultiplier: 1 + freeModeStripClubConfig.vipLounge.influenceBonusPct / 100,
          heatMultiplier: 1 + freeModeStripClubConfig.vipLounge.heatBonusPct / 100
        },
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "VIP salonek aktivní. Boost se sám se sebou nestackuje."
      },
      bar_whispers: {
        actionId: "bar_whispers",
        buildingType: "strip_club",
        label: "Šeptanda u baru",
        description: "Okamžitě vygeneruje pravděpodobnostní drb.",
        durationMs: 0,
        cooldownMs: freeModeStripClubConfig.barWhispers.cooldownMinutes * 60 * 1000,
        inputCost: {},
        outputGain: {},
        heatGain: freeModeStripClubConfig.barWhispers.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Šeptanda u baru vygenerovala drb. Pravdivost není jistá."
      },
      private_party: {
        actionId: "private_party",
        buildingType: "strip_club",
        label: "Soukromá party",
        description: "Přidá vliv, dočasný influence boost a může přinést kontakt, extra drb nebo skandál.",
        durationMs: freeModeStripClubConfig.privateParty.durationMinutes * 60 * 1000,
        cooldownMs: freeModeStripClubConfig.privateParty.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModeStripClubConfig.privateParty.cleanCashCost },
        outputGain: {},
        heatGain: freeModeStripClubConfig.privateParty.heatGain,
        influenceChange: freeModeStripClubConfig.privateParty.instantInfluenceGain,
        effectModifiers: {
          influenceMultiplier: 1 + freeModeStripClubConfig.privateParty.influenceProductionBonusPct / 100
        },
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Soukromá party proběhla. Výsledek může obsahovat kontakt, extra drb nebo skandál."
      },
      backup_grid_switch: {
        actionId: "backup_grid_switch",
        buildingType: "power_station",
        label: "Přepnutí na záložní síť",
        description: "Dočasně zvýší infrastructure bonus a posílí kamery, alarm, Továrny a Zbrojovky.",
        durationMs: freeModePowerStationConfig.backupGridSwitch.durationMinutes * 60 * 1000,
        cooldownMs: freeModePowerStationConfig.backupGridSwitch.cooldownMinutes * 60 * 1000,
        inputCost: { cash: freeModePowerStationConfig.backupGridSwitch.cleanCashCost },
        outputGain: {},
        heatGain: freeModePowerStationConfig.backupGridSwitch.heatGain,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Záložní síť aktivní. Infrastructure a defense systémy jsou dočasně posílené."
      },
      start_drug_sale: {
        actionId: "start_drug_sale",
        buildingType: "street_dealers",
        label: "Spustit prodej",
        description: "Použije globální dealer slot k prodeji látky vyrobené v Drug Labu za dirty cash.",
        durationMs: 0,
        cooldownMs: 0,
        inputCost: {},
        outputGain: {},
        heatGain: 0,
        influenceChange: 0,
        requiredOwner: true,
        allowedIfContested: false,
        reportText: "Pouliční dealeři spustili prodej přes vybraný slot."
      }
    },
    casino: freeModeCasinoConfig,
    exchangeOffice: freeModeExchangeOfficeConfig,
    arcade: freeModeArcadeConfig,
    apartmentBlock: freeModeApartmentBlockConfig,
    school: freeModeSchoolConfig,
    warehouse: freeModeWarehouseConfig,
    clinic: freeModeClinicConfig,
    stripClub: freeModeStripClubConfig,
    restaurant: freeModeRestaurantConfig,
    convenienceStore: freeModeConvenienceStoreConfig,
    shoppingMall: freeModeShoppingMallConfig,
    stockExchange: freeModeStockExchangeConfig,
    centralBank: freeModeCentralBankConfig,
    airport: freeModeAirportConfig,
    cityHall: freeModeCityHallConfig,
    vipLounge: freeModeVipLoungeConfig,
    fitnessClub: freeModeFitnessClubConfig,
    recruitmentCenter: freeModeRecruitmentCenterConfig,
    garage: freeModeGarageConfig,
    carDealer: freeModeCarDealerConfig,
    smugglingTunnel: freeModeSmugglingTunnelConfig,
    streetDealers: freeModeStreetDealersConfig,
    recyclingCenter: freeModeRecyclingCenterConfig,
    powerStation: freeModePowerStationConfig
  },
  technical: {
    sessionTtlMs: 1000 * 60 * 60 * 2,
    gameDurationMs: 1000 * 60 * 60 * 2,
    storageKeyPrefix: "empire:free",
    snapshotIntervalTicks: 8,
    notificationBatchWindowMs: 200,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  },
  publicMeta: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "short",
    tickRateMs: 5000,
    sessionKeyPrefix: "empire:free"
  }
};
