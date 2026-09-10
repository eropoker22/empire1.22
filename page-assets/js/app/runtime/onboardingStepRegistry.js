export const ONBOARDING_VERSION = "demo-v1-clean";

export const ONBOARDING_REQUIRED_STEP_IDS = Object.freeze([
  "welcome",
  "your-district",
  "building-action",
  "heat-police",
  "production-choice",
  "alliance-guide",
  "bounty-boost-guide",
  "spy",
  "attack-order",
  "done"
]);

const STEP_DEFAULTS = Object.freeze({
  placement: "bottom-right",
  completionCondition: "manual",
  canSkip: true,
  highlightType: "none",
  lockBackgroundScroll: false,
  targetSelector: null
});

const ONBOARDING_STEPS_DATA = Object.freeze([
  Object.freeze({
    id: "welcome",
    title: "Vítej v Empire streets",
    phase: "Start",
    badge: "DEMO",
    kind: "system",
    subtitle: "",
    body: "Tento krátký návod ti ukáže první kroky a základní mechaniky hry a vysvětlí o co ve hře jde. Pokud jsi ve hře nový nebo si chceš zopakovat základy tak klikni prosím na Začít.",
    bodyParagraphs: Object.freeze([
      "Tento krátký návod ti ukáže první kroky a základní mechaniky hry.",
      "Pokud jsi ve hře nový nebo si chceš zopakovat základy tak klikni prosím na Začít."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "první kroky", tone: "gold" }),
      Object.freeze({ text: "Začít", tone: "green" })
    ]),
    task: "Začni.",
    taskLabel: "Start",
    cta: "Začít"
  }),
  Object.freeze({
    id: "your-district",
    title: "Horní lišta",
    phase: "Mapa",
    badge: "MAP",
    kind: "system",
    placement: "center",
    subtitle: "",
    body: "Nahoře můžeš najít svůj profil kde uvidíš vše důležité, taky čisté peníze, špinavé peníze, svůj Vliv a při kliknutí na něj kolik máš dostupných špehů a taky SKLAD kde najdeš přehled o surovinách a zbraních které máš k dispozici.",
    bodyParagraphs: Object.freeze([
      "Nahoře najdeš svůj profil a vše důležité pro rychlé rozhodování.",
      "Uvidíš čisté peníze, špinavé peníze, Vliv, dostupné špehy a taky SKLAD se surovinami a zbraněmi."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "Vliv", tone: "gold" }),
      Object.freeze({ text: "SKLAD", tone: "gold" })
    ]),
    targetSelector: "#game-header, .game-topbar, .game-resource-strip, #game-gang-panel-mount, [data-mount-role=\"gang-panel\"], #profile-gang-card",
    focusSelectors: Object.freeze([
      "#game-header, .game-topbar, .game-resource-strip",
      "#game-gang-panel-mount, [data-mount-role=\"gang-panel\"], #profile-gang-card"
    ]),
    focusBackdrop: true,
    raiseFocusTargets: true,
    showTargetRing: false,
    scrollPageTopOnEnter: true,
    completionCondition: "manual",
    fallbackTitle: "District není vidět.",
    fallbackBody: "Zkus otevřít svoje území z mapy.",
    highlightType: "ui",
    task: "Otevři district.",
    taskLabel: "Mapa",
    targetLabel: "Tvoje území",
    cta: "Další"
  }),
  Object.freeze({
    id: "building-action",
    title: "Panel tvého gangu",
    phase: "Akce",
    badge: "BUILD",
    kind: "resource",
    placement: "center",
    subtitle: "",
    body: "Populaci potřebuješ pro obsazování, útok i obranu; Heat ovlivňuje policejní kontroly, jejichž termíny určuje server. Kliknutím na Heat otevřeš skutečné možnosti snížení, jejich cenu a čekání.",
    bodyParagraphs: Object.freeze([
      "Tady vidíš tvoji populaci, která je palivem pro obsazování districtů, útok i obranu.",
      "Heat ovlivňuje policejní kontroly. Kliknutím zjistíš cenu a dostupnost snížení; policejní termíny určuje server."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "populaci", tone: "green" }),
      Object.freeze({ text: "Heat", tone: "red" })
    ]),
    targetSelector: "#profile-gang-card [data-gang-stars], #profile-gang-card .gang-profile-row",
    focusSelectors: Object.freeze([
      "#game-gang-panel-mount, [data-mount-role=\"gang-panel\"]",
      "#profile-gang-card",
      "#profile-gang-card [data-gang-stars], #profile-gang-card .gang-profile-stars",
      "#profile-gang-card .gang-profile-row"
    ]),
    focusBackdrop: true,
    focusBackdropHoleSelector: "#profile-gang-card",
    focusBackdropPadding: 8,
    scrollFocusIntoView: true,
    scrollFocusSelector: "#profile-gang-card",
    scrollFocusBlock: "start",
    scrollFocusMaxWidth: 720,
    raiseFocusTargets: true,
    showTargetRing: false,
    completionCondition: "manual",
    fallbackTitle: "Akce není vidět.",
    fallbackBody: "Otevři district a vyber budovu.",
    highlightType: "resource",
    task: "Spusť akci budovy.",
    taskLabel: "Akce",
    targetLabel: "Akce budovy",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "heat-police",
    title: "Zdroje",
    phase: "Zdroje",
    badge: "ZDROJE",
    kind: "resource",
    subtitle: "",
    body: "Eventy, budovy, bazar a speciální budovy drží tvůj gang při životě. Hra má přes 30 typů budov a 5 různých typů districtů. V každém districtu je okolo 2-3 budov. Produkuj biznis, recykluj, vydělávej, vyráběj, prodávej a plň různé úkoly! Ale pozor nic není zadarmo. Budovy lze upgradovat, třeba je vybírat a některé mají taky speciální akce. Každá akce má reakci.",
    bodyParagraphs: Object.freeze([
      "Eventy, budovy, bazar a speciální budovy drží tvůj gang při životě. Hra má přes 30 typů budov a 5 typů districtů.",
      "Produkuj biznis, recykluj, vydělávej, vyráběj, prodávej a plň úkoly. Budovy lze upgradovat a některé mají speciální akce."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "budovy", tone: "gold" }),
      Object.freeze({ text: "bazar", tone: "gold" }),
      Object.freeze({ text: "speciální akce", tone: "green" })
    ]),
    targetSelector: "#city-events-card, #buildings-card, #market-card, #building-shortcut-grid",
    focusSelectors: Object.freeze([
      "#game-rail-left",
      "#game-left-nav",
      "#city-events-card",
      "#buildings-card",
      "#market-card",
      "#building-shortcut-grid"
    ]),
    focusBackdrop: true,
    focusBackdropHoleSelector: "#game-left-nav",
    focusBackdropPadding: 8,
    scrollFocusIntoView: true,
    scrollFocusSelector: "#building-shortcut-grid",
    scrollFocusBlock: "end",
    scrollFocusInline: "nearest",
    scrollFocusMaxWidth: 900,
    raiseFocusTargets: true,
    showTargetRing: false,
    completionCondition: "manual",
    fallbackTitle: "Zdroje nejsou vidět.",
    fallbackBody: "Zkontroluj levý panel města.",
    highlightType: "resource",
    task: "Prohlédni zdroje.",
    taskLabel: "Zdroje",
    targetLabel: "Zdroje",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "production-choice",
    title: "Vyber výrobu",
    phase: "Výroba",
    badge: "CRAFT",
    kind: "resource",
    placement: "center",
    subtitle: "",
    body: "Výroba neběží sama. Otevři Lékárnu, Lab, Továrnu nebo Zbrojovku a vždy vyber konkrétní recept, který chceš spustit. Každý výrobek potřebuje správné vstupy, čas a volný výrobní slot. Po dokončení musíš hotový výstup převzít do SKLADU.",
    bodyParagraphs: Object.freeze([
      "Výroba neběží sama. Otevři Lékárnu, Lab, Továrnu nebo Zbrojovku a vždy vyber konkrétní recept, který chceš spustit.",
      "Fronta obsahuje zaplacené kusy, které se teprve vyrábějí. Hotové kusy čekají v místním zásobníku budovy. Tlačítkem Převzít je přesuneš do SKLADU; teprve tam je použije další recept. Při plném skladu zbytek zůstane v budově."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "neběží sama", tone: "red" }),
      Object.freeze({ text: "vyber konkrétní recept", tone: "gold" }),
      Object.freeze({ text: "SKLADU", tone: "gold" })
    ]),
    targetSelector: "#building-shortcut-grid",
    focusSelectors: Object.freeze([
      "#game-rail-left",
      "#game-left-nav",
      "#building-shortcut-grid",
      "#building-shortcut-grid [data-pharmacy-popup-open]",
      "#building-shortcut-grid [data-druglab-popup-open]",
      "#building-shortcut-grid [data-factory-popup-open]",
      "#building-shortcut-grid [data-armory-popup-open]"
    ]),
    focusBackdrop: true,
    focusBackdropHoleSelector: "#building-shortcut-grid",
    focusBackdropPadding: 8,
    scrollFocusIntoView: true,
    scrollFocusSelector: "#building-shortcut-grid",
    scrollFocusBlock: "center",
    scrollFocusInline: "nearest",
    scrollFocusMaxWidth: 900,
    raiseFocusTargets: true,
    showTargetRing: false,
    completionCondition: "manual",
    canSkip: true,
    fallbackTitle: "Výrobní budovy nejsou vidět.",
    fallbackBody: "Najdeš je v levém panelu pod hlavními městskými funkcemi.",
    highlightType: "resource",
    task: "Vyber výrobní budovu.",
    taskLabel: "Výroba",
    targetLabel: "Výrobní budovy",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "alliance-guide",
    title: "Aliance",
    phase: "Diplomacie",
    badge: "ALLY",
    kind: "system",
    placement: "center",
    subtitle: "",
    body: "Aliance není jen znak vedle jména. Přes tlačítko Aliance můžeš založit vlastní skupinu, přijímat pozvánky, domlouvat se v chatu a koordinovat obranu i společný postup. Pomoc spojenci spotřebuje skutečné zásoby. Systém ti dá nástroje ke spolupráci — ne důvod někomu věřit.",
    bodyParagraphs: Object.freeze([
      "Aliance není jen znak vedle jména. Přes tlačítko Aliance můžeš založit vlastní skupinu, přijímat pozvánky, domlouvat se v chatu a koordinovat obranu i společný postup.",
      "Ke vstupu potřebuješ platnou pozvánku vůdce. Pomoc spojenci spotřebuje skutečné zásoby. Pořadí a vítězství jsou individuální; aliance nezaručuje společnou výhru."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "Aliance", tone: "gold" }),
      Object.freeze({ text: "skutečné zásoby", tone: "red" }),
      Object.freeze({ text: "spolupráci", tone: "cyan" }),
      Object.freeze({ text: "věřit", tone: "red" })
    ]),
    targetSelector: "#alliance-btn, [data-alliance-popup-open]",
    focusSelectors: Object.freeze([
      "#game-rail-right",
      "#alliance-chat-card",
      "#alliance-btn",
      "[data-alliance-popup-open]"
    ]),
    focusBackdrop: true,
    focusBackdropHoleSelector: "#alliance-chat-card",
    focusBackdropPadding: 8,
    scrollFocusIntoView: true,
    scrollFocusSelector: "#alliance-btn",
    scrollFocusBlock: "center",
    scrollFocusInline: "nearest",
    raiseFocusTargets: true,
    showTargetRing: false,
    completionCondition: "manual",
    canSkip: true,
    fallbackTitle: "Aliance není vidět.",
    fallbackBody: "Tlačítko najdeš v pravém panelu pod profilem svého gangu.",
    highlightType: "system",
    task: "Otevři Alianci, až budeš hledat spojence.",
    taskLabel: "Diplomacie",
    targetLabel: "Aliance",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "bounty-boost-guide",
    title: "Bounty a boosty",
    phase: "Výhoda",
    badge: "POWER",
    kind: "danger",
    placement: "center",
    subtitle: "",
    body: "Bounty promění Clean Cash v cenu na konkrétního hráče, district nebo úkol. Odměna se při vypsání zamkne a získá ji ten, kdo skutečně splní podmínku. Boosty spotřebují skutečné komponenty. Ghost Network posiluje intel, Industrial Overdrive výrobu a Tactical Grid čeká na další platný PvP boj. Obě funkce otevřeš tlačítky nad mapou. Používej je ve správný okamžik — ne ve chvíli, kdy už je pozdě.",
    bodyParagraphs: Object.freeze([
      "Bounty promění Clean Cash v cenu na konkrétního hráče, district nebo úkol. Odměna se při vypsání zamkne a získá ji ten, kdo skutečně splní podmínku.",
      "Boosty spotřebují skutečné komponenty. Ghost Network posiluje intel, Industrial Overdrive výrobu a Tactical Grid čeká na další platný PvP boj.",
      "Obě funkce otevřeš tlačítky nad mapou. Používej je ve správný okamžik — ne ve chvíli, kdy už je pozdě."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "Bounty", tone: "red" }),
      Object.freeze({ text: "Clean Cash", tone: "gold" }),
      Object.freeze({ text: "Boosty", tone: "cyan" }),
      Object.freeze({ text: "Ghost Network", tone: "cyan" }),
      Object.freeze({ text: "Industrial Overdrive", tone: "gold" }),
      Object.freeze({ text: "Tactical Grid", tone: "red" })
    ]),
    targetSelector: "[data-bounty-open-trigger], [data-boost-open-trigger]",
    focusSelectors: Object.freeze([
      ".map-phase-toolbar",
      ".map-stage-actions--desktop",
      ".map-stage-actions--mobile",
      "[data-bounty-open-trigger]",
      "[data-boost-open-trigger]"
    ]),
    focusBackdrop: true,
    scrollFocusIntoView: true,
    scrollFocusSelector: "#game-map-stage",
    scrollFocusBlock: "start",
    scrollFocusInline: "nearest",
    raiseFocusTargets: true,
    showTargetRing: false,
    completionCondition: "manual",
    canSkip: true,
    fallbackTitle: "Bounty nebo Boost nejsou vidět.",
    fallbackBody: "Jejich tlačítka najdeš v ovládání nad mapou.",
    highlightType: "danger",
    task: "Najdi Bounty a Boost nad mapou.",
    taskLabel: "Výhoda",
    targetLabel: "Bounty a Boost",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "spy",
    title: "Pošli špehy",
    phase: "Intel",
    badge: "SPY",
    kind: "intel",
    placement: "center",
    subtitle: "",
    body: "Špionáž získává informace; plný průzkum může otevřít další akce, částečný nemusí stačit. Loupež bere neutrální kořist, heist je samostatná operace, útok míří proti vlastníkovi území. Vyber dostupného souseda a vyšli špeha; oprávnění a náklady potvrzuje server.",
    bodyParagraphs: Object.freeze([
      "Sousední území můžeš špehovat. Plný průzkum může otevřít další akce; částečný či neúspěšný výsledek nemusí stačit. Platí dostupnost na serveru.",
      "Neutrální loupež bere kořist, heist je samostatná operace a útok míří proti vlastníkovi území. Vyber dostupné sousední území a vyšli špeha."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "špehovat", tone: "cyan" }),
      Object.freeze({ text: "sousední území", tone: "gold" })
    ]),
    targetSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas]",
    mapViewMode: "zoom-out",
    mapDistrictHighlights: Object.freeze([]),
    scrollFocusIntoView: true,
    scrollFocusSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas]",
    scrollFocusBlock: "center",
    scrollFocusInline: "nearest",
    focusBackdrop: true,
    focusBackdropHoleSelector: "[data-map-viewport]",
    focusBackdropPadding: 6,
    lockBackgroundScroll: true,
    completionCondition: "spy:started",
    fallbackTitle: "Špeh teď není dostupný.",
    fallbackBody: "Mapa teď není dostupná.",
    highlightType: "intel",
    showTargetRing: false,
    task: "Pošli špehy.",
    taskLabel: "Špeh",
    targetLabel: "Mapa",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "attack-order",
    title: "Vlož past",
    phase: "Rozkaz",
    badge: "ORDER",
    kind: "danger",
    placement: "center",
    subtitle: "",
    body: "Vlastní území můžeš posílit lidmi, výzbrojí a pastí. Obrana váže skutečné zásoby. Vyber svoje území a prohlédni dostupnou obranu; přesný účinek pasti a výsledek útoku určuje server.",
    bodyParagraphs: Object.freeze([
      "Vlastní území můžeš posílit lidmi, výzbrojí a pastí. Obrana váže skutečné zásoby.",
      "Vyber svoje území a dostupnou past. Její účinek i výsledek případného útoku potvrdí server."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "past", tone: "green" }),
      Object.freeze({ text: "svoje území", tone: "gold" })
    ]),
    targetSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas]",
    mapViewMode: "zoom-out",
    mapDistrictHighlights: Object.freeze([]),
    scrollFocusIntoView: true,
    scrollFocusSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas]",
    scrollFocusBlock: "center",
    scrollFocusInline: "nearest",
    focusBackdrop: true,
    focusBackdropHoleSelector: "[data-map-viewport]",
    focusBackdropPadding: 6,
    lockBackgroundScroll: true,
    completionCondition: "trap:moved",
    fallbackTitle: "Rozkaz teď není dostupný.",
    fallbackBody: "Otevři cíl, který dovolí útok.",
    highlightType: "danger",
    showTargetRing: false,
    task: "Zadej rozkaz.",
    taskLabel: "Rozkaz",
    targetLabel: "Mapa",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "done",
    title: "Eliminace",
    phase: "Závěr",
    badge: "LOOP",
    kind: "objective",
    subtitle: "",
    body: "Karta Očisty ukazuje skutečný termín dalšího vyřazení, noční klid a podmínky Final Lockdownu. Ohrožená skupina neznamená několik současných obětí. Pořadí se mění podle serverového skóre; ve finále se přidávají bonusy a postih za HEAT.",
    bodyParagraphs: Object.freeze([
      "Otevři kartu Očisty: ukazuje termíny, počet vyřazovaných a tvoje skutečné riziko. Zvýrazněná ohrožená skupina není počet současně vyřazených.",
      "Herní den a noc mění ekonomiku. Skutečný noční klid je jiné kalendářní okno: odkládá očistu a při zapnuté pauze zastaví aktivní čas finále. Výroba ani veškerý boj se tím automaticky nevypínají.",
      "Začátek a délku Final Lockdownu určuje nastavení serveru, uzavření registrace a přeživší. Během finále vidíš průběžné skóre s bonusy a HEAT postihem; vítěze potvrdí až konečný výsledek.",
      "Předčasný odchod ukončí pokus včetně vlastních nabídek, bounty a rozpracované výroby. Jejich vklady se nepřenášejí do nového startu. Návrat je možný jen při otevřené registraci."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "Očisty", tone: "red" }),
      Object.freeze({ text: "Final Lockdownu", tone: "gold" }),
      Object.freeze({ text: "Alianci", tone: "cyan" }),
      Object.freeze({ text: "bounty", tone: "red" })
    ]),
    targetSelector: null,
    placement: "center",
    focusBackdrop: true,
    showTargetRing: false,
    completionCondition: "manual",
    fallbackTitle: "Město čeká.",
    fallbackBody: "Vrať se na mapu.",
    highlightType: "objective",
    task: "Pokračuj.",
    taskLabel: "Shrnutí",
    cta: "Pokračovat"
  })
]);

export const ONBOARDING_STEPS = Object.freeze(ONBOARDING_STEPS_DATA.map((step) =>
  Object.freeze({
    ...STEP_DEFAULTS,
    ...step
  })
));

export function getOnboardingStep(stepId) {
  return ONBOARDING_STEPS.find((step) => step.id === stepId) || null;
}

export function getOnboardingStepIndex(stepId) {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}

export function getOnboardingTargetSelector(stepId) {
  return getOnboardingStep(stepId)?.targetSelector || null;
}
