import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FACTION_CATALOG, FACTION_WEAPON_PRESETS } from "../../packages/game-config/src/legacy-page/faction-config.js";
import {
  FACTION_DEFINITION_BY_ID,
  FACTION_DEFINITIONS,
  LEGACY_FACTION_ID_MAP
} from "../../packages/game-config/src/public/faction-definitions.ts";
import {
  getFactionActionForPlayer
} from "../../page-assets/js/app/faction-actions-runtime.js";

describe("legacy faction compatibility bridge", () => {
  it("does not expose legacy faction starting resources or weapon presets", () => {
    for (const faction of Object.values(FACTION_CATALOG)) {
      expect(faction.startingPackage).toBeUndefined();
    }
    expect(FACTION_WEAPON_PRESETS).toEqual({});
    expect(FACTION_CATALOG.mafian.specialAction).toMatchObject({
      name: "Tichá dohoda",
      status: "preview"
    });
    expect(FACTION_CATALOG["motorkarsky-gang"].startingPackage).toBeUndefined();
  });

  it("keeps faction page preview source free of starting package copy", () => {
    const pageSource = readFileSync("pages/faction.html", "utf8");
    const runtimeSource = readFileSync("page-assets/js/faction.js", "utf8");
    const actionSource = readFileSync("page-assets/js/app/faction-actions-runtime.js", "utf8");
    const previewSource = `${pageSource}\n${runtimeSource}\n${actionSource}`;

    expect(previewSource).not.toMatch(/startovn|starting package|start package|startingPackage|startovní cash/i);
    expect(previewSource).not.toContain("Spustit akci");
    expect(previewSource).not.toContain("není core-backed");
    expect(previewSource).toContain("Funguje teď");
    expect(previewSource).toContain("Připravuje se");
    expect(previewSource).toContain("Preview schopnosti");
  });

  it("keeps legacy preview catalog synchronized with authoritative public definitions", () => {
    expect(Object.keys(FACTION_CATALOG).sort()).toEqual(FACTION_DEFINITIONS.map((definition) => definition.id).sort());

    for (const definition of FACTION_DEFINITIONS) {
      const legacy = FACTION_CATALOG[definition.id];
      expect(legacy).toMatchObject({
        id: definition.id,
        name: definition.name,
        tagline: definition.tagline,
        description: definition.description,
        playstyleSummary: definition.playstyleSummary,
        coreBackedEffects: definition.passiveEffectSummary,
        plannedEffects: definition.plannedPassiveEffectSummary || []
      });
      expect(legacy.specialAction).toEqual(definition.specialAction || null);
      expect(legacy.startingPackage).toBeUndefined();
    }
  });

  it("keeps all faction aliases compatible", () => {
    expect(LEGACY_FACTION_ID_MAP.mafia).toBe("mafian");
    expect(LEGACY_FACTION_ID_MAP.cartel).toBe("kartel");
    expect(LEGACY_FACTION_ID_MAP.cult).toBe("kult");
    expect(LEGACY_FACTION_ID_MAP.secret).toBe("tajna-organizace");
    expect(LEGACY_FACTION_ID_MAP.hackers).toBe("hackeri");
    expect(LEGACY_FACTION_ID_MAP.bikers).toBe("motorkarsky-gang");
    expect(LEGACY_FACTION_ID_MAP.military).toBe("soukroma-armada");
    expect(LEGACY_FACTION_ID_MAP.corporation).toBe("korporace");
  });

  it("shows biker cooldown advantages, heat weakness and special action preview", () => {
    const biker = FACTION_CATALOG["motorkarsky-gang"];

    expect(biker.id).toBe("motorkarsky-gang");
    expect(biker.name).toBe("Motorkářský gang");
    expect(biker.tagline).toBe("Rychlost zabíjí.");
    expect(biker.advantages).toEqual(expect.arrayContaining([
      "-15 % cooldown na vykrádání",
      "-10 % cooldown na útoky",
      "-10 % cooldown na obsazování",
      "+10 % dirty cash z vykrádání"
    ]));
    expect(biker.disadvantages).toEqual(expect.arrayContaining([
      "-10 % obrana districtů",
      "+8 % heat z útoků, obsazování a vykrádání"
    ]));
    expect(biker.specialAction).toMatchObject({
      name: "Bleskový nájezd",
      status: "preview"
    });
  });

  it("shows Kartel dirty economy advantages, police pressure weaknesses and special action preview", () => {
    const cartel = FACTION_CATALOG.kartel;

    expect(cartel.id).toBe("kartel");
    expect(cartel.name).toBe("Kartel");
    expect(cartel.tagline).toBe("Prachy tečou rychle. Krev taky.");
    expect(cartel.advantages).toEqual(expect.arrayContaining([
      "+18 % dirty income",
      "+15 % produkce v podporovaných ilegálních budovách",
      "+10 % pašování"
    ]));
    expect(cartel.disadvantages).toEqual(expect.arrayContaining([
      "+15 % heat z ilegálních akcí",
      "-8 % clean income",
      "-5 % defense power"
    ]));
    expect(cartel.specialAction).toMatchObject({
      name: "Noční zásilka",
      status: "preview"
    });
  });

  it("keeps Kartel action preview-only and avoids starting resource copy", () => {
    const action = getFactionActionForPlayer({
      getItem: () => JSON.stringify({ registration: { factionId: "kartel" } })
    });

    expect(action).toMatchObject({
      factionId: "kartel",
      name: "Kartel",
      code: "Noční zásilka",
      canRun: false
    });
    expect(action.effect).toContain("zatím jen preview");
    expect(action.effect).toContain("alphě ještě neběží");
    expect(action.effect).not.toContain("startovní");
  });

  it("shows Tajna organizace spy, trap and secret action preview without starting resources", () => {
    const secret = FACTION_CATALOG["tajna-organizace"];

    expect(secret.id).toBe("tajna-organizace");
    expect(secret.name).toBe("Tajná organizace");
    expect(secret.tagline).toBe("Nevidíš nás. Jen následky.");
    expect(secret.advantages).toEqual(expect.arrayContaining([
      "+15 % šance na úspěšné špehování",
      "+15 % šance odhalit pasti",
      "+10 % kvalita intel/drbů"
    ]));
    expect(secret.plannedAdvantages).toEqual(expect.arrayContaining([
      "+15 % kvalita informací ze špehování",
      "-8 % heat z tajných akcí"
    ]));
    expect(secret.disadvantages).toEqual(expect.arrayContaining([
      "-10 % attack power",
      "-8 % clean income",
      "-8 % dirty income"
    ]));
    expect(secret.startingPackage).toBeUndefined();
    expect(secret.specialAction).toMatchObject({
      name: "Spící buňka",
      status: "preview"
    });
  });

  it("shows Hackeri tech intel advantages, combat weaknesses and special action preview", () => {
    const hackers = FACTION_CATALOG.hackeri;

    expect(hackers.id).toBe("hackeri");
    expect(hackers.name).toBe("Hackeři");
    expect(hackers.tagline).toBe("Kdo ovládá data, ovládá válku.");
    expect(hackers.advantages).toEqual(expect.arrayContaining([
      "+50 % pravdivost rumorů s truthChancePct",
      "+15 % účinnost kamer",
      "+15 % účinnost alarmů",
      "+10 % tech production",
      "+10 % šance na úspěšné špehování"
    ]));
    expect(hackers.disadvantages).toEqual(expect.arrayContaining([
      "-8 % attack power",
      "-8 % dirty income",
      "-5 % základní obrana bez kamer/alarmů"
    ]));
    expect(hackers.startingPackage).toBeUndefined();
    expect(hackers.specialAction).toMatchObject({
      name: "Výpadek systému",
      status: "preview"
    });
  });

  it("shows Kult control advantages, economy weaknesses and special action preview", () => {
    const cult = FACTION_CATALOG.kult;

    expect(cult.id).toBe("kult");
    expect(cult.name).toBe("Kult");
    expect(cult.tagline).toBe("Město se zlomí vírou.");
    expect(cult.advantages).toEqual(expect.arrayContaining([
      "+20 % influence gain",
      "+10 % population generation",
      "+10 % defense power"
    ]));
    expect(cult.plannedAdvantages).toEqual(expect.arrayContaining([
      "Silnější práce s drby / podezřením"
    ]));
    expect(cult.disadvantages).toEqual(expect.arrayContaining([
      "-10 % clean income",
      "-5 % attack power"
    ]));
    expect(cult.plannedDisadvantages).toEqual(expect.arrayContaining([
      "+10 % market fee"
    ]));
    expect(cult.specialAction).toMatchObject({
      name: "Masová posedlost",
      status: "preview"
    });
  });

  it("shows Korporat clean economy advantages, street weaknesses and special action preview", () => {
    const corporate = FACTION_CATALOG.korporace;

    expect(corporate.id).toBe("korporace");
    expect(corporate.name).toBe("Korporát");
    expect(corporate.tagline).toBe("Zločin je špinavý. Moc je legální.");
    expect(corporate.advantages).toEqual(expect.arrayContaining([
      "+15 % clean income",
      "-3 % heat z útoků, heistů, akcí budov a pasivního tlaku",
      "+10 % efekt obranných systémů"
    ]));
    expect(corporate.plannedAdvantages).toEqual(expect.arrayContaining([
      "-10 % market fee"
    ]));
    expect(corporate.disadvantages).toEqual(expect.arrayContaining([
      "-15 % dirty income",
      "-10 % loot z vykrádání",
      "+10 % délka útoků"
    ]));
    expect(corporate.specialAction).toMatchObject({
      name: "Právní štít",
      status: "preview"
    });
  });

  it("shows Soukroma armada combat advantages, expensive operation weaknesses and special action preview", () => {
    const army = FACTION_CATALOG["soukroma-armada"];

    expect(army.id).toBe("soukroma-armada");
    expect(army.name).toBe("Soukromá armáda");
    expect(army.tagline).toBe("Když diplomacie selže, přijde faktura.");
    expect(army.advantages).toEqual(expect.arrayContaining([
      "+12 % attack power",
      "+12 % defense power",
      "-10 % ztráty vybavení v boji"
    ]));
    expect(army.plannedAdvantages).toEqual(expect.arrayContaining([
      "+10 % síla při obsazování"
    ]));
    expect(army.disadvantages).toEqual(expect.arrayContaining([
      "+8 % heat z útoků a obsazování",
      "-8 % clean income"
    ]));
    expect(army.plannedDisadvantages).toEqual(expect.arrayContaining([
      "+12 % upkeep / combat cost"
    ]));
    expect(army.specialAction).toMatchObject({
      name: "Taktické nasazení",
      status: "preview"
    });
  });

  it("renders faction action launch button as preview-only", () => {
    const source = readFileSync("page-assets/js/app/faction-actions-runtime.js", "utf8");
    const action = getFactionActionForPlayer({
      getItem: () => JSON.stringify({ registration: { factionId: "kartel" } })
    });

    expect(action.effect).toContain("zatím jen preview");
    expect(action.canRun).toBe(false);
    expect(source).toContain("Preview schopnosti");
    expect(source).toContain("preview");
    expect(source).not.toContain("spuštěno");
    expect(source).not.toContain("25 % více");
  });

  it("labels known active and planned effects distinctly in legacy data", () => {
    expect(FACTION_CATALOG["tajna-organizace"].coreBackedEffects).toContain("+10 % kvalita intel/drbů");
    expect(FACTION_CATALOG["tajna-organizace"].plannedEffects).not.toContain("+10 % kvalita intel/drbů");
    expect(FACTION_CATALOG["tajna-organizace"].plannedEffects).toContain("+15 % kvalita informací ze špehování");
    expect(FACTION_CATALOG["soukroma-armada"].coreBackedEffects).not.toContain("+12 % upkeep / combat cost");
    expect(FACTION_CATALOG["soukroma-armada"].plannedEffects).toContain("+12 % upkeep / combat cost");
    expect(FACTION_DEFINITION_BY_ID.hackeri.specialAction.status).toBe("preview");
  });
});
