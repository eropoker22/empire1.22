import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  createBuildingSpecialActionAuditRows,
  hasLegacyBuildingSpecialActionHandler,
  resolveBuildingSpecialActionDefinition
} from "../../page-assets/js/app/runtime/buildingSpecialActionRegistry.js";
import { DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES } from "../../page-assets/js/app/runtime/buildingDetailData.js";

describe("building special action registry", () => {
  const freeBuildingActions = resolveModeConfig("free").balance.buildingActions ?? {};

  it("assigns every audited card/profile action a stable action id", () => {
    const rows = createBuildingSpecialActionAuditRows();

    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((row) => typeof row.actionId === "string" && row.actionId.length > 0)).toBe(true);
  });

  it("marks stock exchange server-only actions as server-authoritative instead of coming soon", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Burza",
      actionLabel: "Spekulativní nákup",
      actionIndex: 0,
      actionProfile: { stockSpeculativeBuy: true, cleanCost: 2500, heat: 5 }
    });

    expect(definition.actionId).toBe("speculative_buy");
    expect(definition.status).toBe("implemented");
    expect(definition.disabledReason).toBe("");
    expect(definition.handlerId).toBe("server-run-building-action");
    expect(definition.hasServerConfig).toBe(true);
    expect(definition.inputSummary).toContain("Kategorie: materials");
    expect(definition.inputSummary).toContain("Investice: $1000 clean cash");
    expect(hasLegacyBuildingSpecialActionHandler({ stockSpeculativeBuy: true, heat: 5 })).toBe(false);
  });

  it("keeps Downtown server action rows executable when core has a handler", () => {
    const rows = createBuildingSpecialActionAuditRows();
    const downtownRows = rows.filter((row) => [
      "burza",
      "centralni banka",
      "magistrat",
      "lobby klub",
      "lobby club",
      "letiste"
    ].includes(row.buildingName));

    expect(downtownRows.length).toBeGreaterThan(10);
    expect(downtownRows.every((row) => row.hasServerConfig)).toBe(true);
    expect(downtownRows.every((row) => row.status === "implemented")).toBe(true);
    expect(downtownRows.every((row) => row.note === "Server-authoritative handler")).toBe(true);
  });

  it("does not expose missing-handler placeholder special action rows", () => {
    const rows = createBuildingSpecialActionAuditRows();

    expect(rows.every((row) => row.status === "implemented")).toBe(true);
    expect(rows.every((row) => row.hasRuntimeHandler)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("missing-handler");
  });

  it("keeps Restaurant detail card actions server-authoritative", () => {
    const restaurantRows = createBuildingSpecialActionAuditRows()
      .filter((row) => row.buildingName === "restaurace");

    expect(restaurantRows).toHaveLength(3);
    expect(restaurantRows.map((row) => row.actionId)).toEqual([
      "restaurant_collect_revenue",
      "restaurant_cover_meetings",
      "restaurant_local_network"
    ]);
    expect(restaurantRows.every((row) => row.hasServerConfig)).toBe(true);
    expect(restaurantRows.every((row) => row.note === "Server-authoritative handler")).toBe(true);
  });

  it("keeps server-backed action UI profiles aligned with authoritative action values", () => {
    const rows = createBuildingSpecialActionAuditRows()
      .filter((row) => row.hasServerConfig && freeBuildingActions[row.actionId]);

    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      const profile = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[row.buildingName]?.[row.actionIndex] || {};
      const action = freeBuildingActions[row.actionId];
      const label = `${row.buildingName} / ${row.label} / ${row.actionId}`;

      if (Object.prototype.hasOwnProperty.call(profile, "clean")) {
        expect(profile.clean, `${label} clean`).toBe(action.outputGain?.cash ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "dirty")) {
        expect(profile.dirty, `${label} dirty`).toBe(action.outputGain?.["dirty-cash"] ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "heat")) {
        expect(profile.heat, `${label} heat`).toBe(action.heatGain ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "influence")) {
        expect(profile.influence, `${label} influence`).toBe(action.influenceChange ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "cooldownMs")) {
        expect(profile.cooldownMs, `${label} cooldown`).toBe(action.cooldownMs ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "durationMs") && Number(action.durationMs ?? 0) > 0) {
        expect(profile.durationMs, `${label} duration`).toBe(action.durationMs ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "cleanCost")) {
        expect(profile.cleanCost, `${label} clean cost`).toBe(action.inputCost?.cash ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "dirtyCost")) {
        expect(profile.dirtyCost, `${label} dirty cost`).toBe(action.inputCost?.["dirty-cash"] ?? 0);
      }
      if (Object.prototype.hasOwnProperty.call(profile, "influenceCost")) {
        expect(profile.influenceCost, `${label} influence cost`).toBe(Math.abs(action.influenceChange ?? 0));
      }
    }
  });

  it("keeps generic output actions executable only through server config", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Přístav",
      actionLabel: "Container Cut",
      actionIndex: 0,
      actionProfile: { dirty: 160, materials: { "metal-parts": 3 }, influence: 1, heat: 6 }
    });

    expect(definition.actionId).toBe("port_container_cut");
    expect(definition.status).toBe("implemented");
    expect(definition.handlerId).toBe("server-run-building-action");
    expect(hasLegacyBuildingSpecialActionHandler({ dirty: 160, materials: { "metal-parts": 3 }, influence: 1, heat: 6 })).toBe(true);
  });

  it("adds concrete effect numbers to confirm summaries for boost actions", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Kasino",
      actionLabel: "VIP noc",
      actionIndex: 1,
      actionProfile: {
        casinoVipNight: true,
        durationMs: 10 * 60 * 1000,
        cooldownMs: 26 * 60 * 1000,
        cleanIncomeBoostPct: 70,
        dirtyIncomeBoostPct: 55,
        influenceBoostPct: 25,
        heatMultiplier: 1.6,
        auditRiskBoostPct: 8,
        summary: "VIP noc masivně zvedá income, vliv, heat a audit risk."
      }
    });

    expect(definition.rewardSummary).toContain("Clean income +70%");
    expect(definition.rewardSummary).toContain("Dirty income +55%");
    expect(definition.rewardSummary).toContain("Vliv +25%");
    expect(definition.rewardSummary).toContain("Efekt 10m 00s");
    expect(definition.riskSummary).toContain("Heat +60%");
    expect(definition.riskSummary).toContain("Audit +8%");
  });

  it("adds concrete risk numbers to confirm summaries for failure-based actions", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Kasino",
      actionLabel: "Podplacený inspektor",
      actionIndex: 2,
      actionProfile: {
        casinoBribedInspector: true,
        cleanCost: 15000,
        failureChancePct: 14,
        durationMs: 12 * 60 * 1000,
        cooldownMs: 105 * 60 * 1000,
        heatSuccess: -15,
        heatFailure: 12,
        influenceSuccess: 4,
        auditRiskReductionPct: 35,
        auditRiskFailurePct: 10,
        summary: "Podplacený inspektor je drahá ochrana s rizikem selhání."
      }
    });

    expect(definition.rewardSummary).toContain("Heat -15");
    expect(definition.rewardSummary).toContain("Vliv +4");
    expect(definition.rewardSummary).toContain("Audit -35%");
    expect(definition.rewardSummary).toContain("Efekt 12m 00s");
    expect(definition.riskSummary).toContain("Selhání 14%");
    expect(definition.riskSummary).toContain("Fail heat +12");
    expect(definition.riskSummary).toContain("Audit fail +10%");
  });

  it("keeps all street dealer card actions server-backed with concrete effects", () => {
    const streetDealerProfiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["poulicni dealeri"];
    const sale = resolveBuildingSpecialActionDefinition({
      buildingName: "Pouliční dealeři",
      actionLabel: "Spustit prodej",
      actionIndex: 0,
      actionProfile: streetDealerProfiles[0]
    });
    const collect = resolveBuildingSpecialActionDefinition({
      buildingName: "Pouliční dealeři",
      actionLabel: "Vybrat hot cash",
      actionIndex: 1,
      actionProfile: streetDealerProfiles[1]
    });
    const stash = resolveBuildingSpecialActionDefinition({
      buildingName: "Pouliční dealeři",
      actionLabel: "Přesunout stash",
      actionIndex: 2,
      actionProfile: streetDealerProfiles[2]
    });

    expect(streetDealerProfiles[0].dirty).toBeUndefined();
    expect([sale.status, collect.status, stash.status]).toEqual(["implemented", "implemented", "implemented"]);
    expect([sale.actionId, collect.actionId, stash.actionId]).toEqual([
      "start_drug_sale",
      "street_dealers_collect_hot_cash",
      "street_dealers_move_stash"
    ]);
    expect([sale.handlerId, collect.handlerId, stash.handlerId]).toEqual([
      "server-run-building-action",
      "server-run-building-action",
      "server-run-building-action"
    ]);
    expect(sale.rewardSummary).toContain("Slot Pouličních dealerů prodá vybranou látku");
    expect(sale.inputSummary).toContain("Slot: slot-1");
    expect(sale.inputSummary).toContain("Produkt: neon-dust");
    expect(sale.inputSummary).toContain("Množství: 1");
    expect(sale.riskSummary).toBe("Bez přímého heat rizika");
    expect(sale.cooldownMs).toBe(0);
    expect(collect.rewardSummary).toContain("Dirty");
    expect(collect.riskSummary).toBe("Heat +3");
    expect(collect.cooldownMs).toBe(10 * 60 * 1000);
    expect(stash.costSummary).toBe("biomass x3");
    expect(stash.rewardSummary).toContain("Dirty cash +$1000");
    expect(stash.riskSummary).toBe("Heat +1");
    expect(stash.cooldownMs).toBe(10 * 60 * 1000);
  });

  it("keeps smuggling tunnel open channel implemented with concrete cost, effect, heat, and cooldown", () => {
    const [openChannelProfile] = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["pasovaci tunel"];
    const openChannel = resolveBuildingSpecialActionDefinition({
      buildingName: "Pašovací tunel",
      actionLabel: "Otevřít kanál",
      actionIndex: 0,
      actionProfile: openChannelProfile
    });

    expect(openChannel.status).toBe("implemented");
    expect(openChannel.actionId).toBe("open_channel");
    expect(openChannel.costSummary).toBe("$1800 clean cash");
    expect(openChannel.rewardSummary).toContain("Dirty income +45%");
    expect(openChannel.rewardSummary).toContain("Pouliční dealeři cena +12%");
    expect(openChannel.rewardSummary).toContain("Pouliční dealeři rychlost +10%");
    expect(openChannel.rewardSummary).toContain("Pouliční dealeři reward +10%");
    expect(openChannel.rewardSummary).toContain("Efekt 15m 00s");
    expect(openChannel.riskSummary).toContain("Heat +5");
    expect(openChannel.riskSummary).toContain("Pouliční incident +5%");
    expect(openChannel.cooldownMs).toBe(30 * 60 * 1000);
  });

  it("keeps strip club card actions server-backed and aligned", () => {
    const stripProfiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["strip club"];
    const collect = resolveBuildingSpecialActionDefinition({
      buildingName: "Strip club",
      actionLabel: "Vybrat cash",
      actionIndex: 0,
      actionProfile: stripProfiles[0]
    });
    const vip = resolveBuildingSpecialActionDefinition({
      buildingName: "Strip club",
      actionLabel: "Hostit VIP klienty",
      actionIndex: 1,
      actionProfile: stripProfiles[1]
    });
    const kompro = resolveBuildingSpecialActionDefinition({
      buildingName: "Strip club",
      actionLabel: "Získat kompro",
      actionIndex: 2,
      actionProfile: stripProfiles[2]
    });

    expect([collect.status, vip.status, kompro.status]).toEqual(["implemented", "implemented", "implemented"]);
    expect([collect.actionId, vip.actionId, kompro.actionId]).toEqual([
      "strip_club_collect_cash",
      "vip_lounge",
      "private_party"
    ]);
    expect([collect.handlerId, vip.handlerId, kompro.handlerId]).toEqual([
      "server-run-building-action",
      "server-run-building-action",
      "server-run-building-action"
    ]);
    expect(collect.rewardSummary).toContain("Dirty cash +$360");
    expect(collect.riskSummary).toBe("Heat +3");
    expect(vip.costSummary).toBe("$800 clean cash");
    expect(vip.rewardSummary).toContain("Clean income +45%");
    expect(vip.rewardSummary).toContain("Dirty income +35%");
    expect(vip.rewardSummary).toContain("Vliv +55%");
    expect(collect.cooldownMs).toBe(10 * 60 * 1000);
    expect(vip.cooldownMs).toBe(60 * 60 * 1000);
    expect(vip.rewardSummary).toContain("Efekt 30m 00s");
    expect(kompro.costSummary).toBe("$1500 clean cash");
    expect(kompro.rewardSummary).toContain("Vliv +8");
    expect(kompro.rewardSummary).toContain("Vliv +70%");
    expect(kompro.riskSummary).toContain("Heat +6");
    expect(kompro.cooldownMs).toBe(30 * 60 * 1000);
  });

  it("uses future-tense confirmation copy instead of completed-action summaries", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Restaurace",
      actionLabel: "Vybrat tržby",
      actionIndex: 0,
      actionProfile: {
        clean: 180,
        dirty: 120,
        cooldownMs: 30 * 60 * 1000,
        summary: "Tržby byly vybrané."
      }
    });

    expect(definition.confirmBody).toContain("Po potvrzení se akce spustí");
    expect(definition.confirmBody).not.toContain("byly");
    expect(definition.shortDescription).toBe("Akce se spustí po potvrzení.");
    expect(definition.rewardSummary).toContain("Clean +$180");
  });

  it("keeps restaurant confirmation summaries aligned with button and server values", () => {
    const profiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.restaurace;
    const collect = resolveBuildingSpecialActionDefinition({
      buildingName: "Restaurace",
      actionLabel: "Vybrat tržby",
      actionIndex: 0,
      actionProfile: profiles[0]
    });
    const meetings = resolveBuildingSpecialActionDefinition({
      buildingName: "Restaurace",
      actionLabel: "Krýt schůzky",
      actionIndex: 1,
      actionProfile: profiles[1]
    });
    const network = resolveBuildingSpecialActionDefinition({
      buildingName: "Restaurace",
      actionLabel: "Posílit lokální síť",
      actionIndex: 2,
      actionProfile: profiles[2]
    });

    expect(collect.rewardSummary).toContain("Clean +$869");
    expect(collect.rewardSummary).toContain("Dirty cash +$550");
    expect(collect.riskSummary).toBe("Heat +5");
    expect(collect.cooldownMs).toBe(30 * 60 * 1000);

    expect(meetings.rewardSummary).toContain("Vliv +8");
    expect(meetings.riskSummary).toBe("Heat +4");
    expect(meetings.cooldownMs).toBe(45 * 60 * 1000);

    expect(network.rewardSummary).toContain("Vliv +4");
    expect(network.riskSummary).toBe("Heat +8");
    expect(network.cooldownMs).toBe(30 * 60 * 1000);
  });

  it("maps renamed power station heat action to a server handler", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Energetická stanice",
      actionLabel: "Snížit heat",
      actionIndex: 2,
      actionProfile: { cooldownMs: 60 * 60 * 1000, heat: -2, summary: "Heat byl snížený." }
    });

    expect(definition.actionId).toBe("power_station_reduce_heat");
    expect(definition.status).toBe("implemented");
    expect(definition.handlerId).toBe("server-run-building-action");
    expect(definition.disabledReason).toBe("");
    expect(definition.rewardSummary).toBe("Efekt podle akce");
    expect(definition.riskSummary).toBe("Heat -2");
    expect(definition.confirmTitle).toBe("Snížit heat");
  });

  it("keeps Park and Industrial design actions on server handlers", () => {
    const serverActions = [
      ["Pouliční dealeři", "Vybrat hot cash", 1],
      ["Pouliční dealeři", "Přesunout stash", 2],
      ["Strip club", "Vybrat cash", 0],
      ["Energetická stanice", "Napájet výrobu", 1],
      ["Energetická stanice", "Snížit heat", 2]
    ];

    for (const [buildingName, actionLabel, actionIndex] of serverActions) {
      const key = String(buildingName)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const actionProfile = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[key]?.[actionIndex] || {};
      const definition = resolveBuildingSpecialActionDefinition({
        buildingName,
        actionLabel,
        actionIndex,
        actionProfile
      });

      expect(definition.status, `${buildingName} / ${actionLabel}`).toBe("implemented");
      expect(definition.handlerId, `${buildingName} / ${actionLabel}`).toBe("server-run-building-action");
      expect(definition.disabledReason, `${buildingName} / ${actionLabel}`).toBe("");
    }
  });

  it("removes production and craft building special rows from detail cards", () => {
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.lekarna).toEqual([]);
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES["drug lab"]).toEqual([]);
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.lab).toEqual([]);
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.tovarna).toEqual([]);
    expect(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES.zbrojovka).toEqual([]);
  });
});
