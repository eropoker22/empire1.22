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
    body: "Tady vidíš tvoji populaci, ta je palivem pro obsazování districtů, pro útok, pro obranu. Hledanost neboli Heat, tento ukazatel ti dává informaci jak moc blízko jsi průseru, policie tady funguje jako predátor každou hodinu u někoho vyvolá razii, číslo je klikatelné a roste díky tvojemu špinavému biznisu a chování ve hře.",
    bodyParagraphs: Object.freeze([
      "Tady vidíš tvoji populaci, která je palivem pro obsazování districtů, útok i obranu.",
      "Hledanost neboli Heat ukazuje, jak blízko jsi průšvihu. Policie každou hodinu u někoho vyvolá razii."
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
      "Každý výrobek potřebuje správné vstupy, čas a volný výrobní slot. Po dokončení musíš hotový výstup převzít do SKLADU."
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
      "Pomoc spojenci spotřebuje skutečné zásoby. Systém ti dá nástroje ke spolupráci — ne důvod někomu věřit."
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
    body: "Sousední districty můžeš špehovat, vykrádat, po úspěšném špehování obsazovat a na nepřátelské districty můžeš útočit, případně je zcela zničit. Dávej pozor i tady policie není slepá! Klikni na District 2, vyšli špeha a potvrď misi.",
    bodyParagraphs: Object.freeze([
      "Sousední districty můžeš špehovat, vykrádat a po úspěšném špehování obsazovat.",
      "Na nepřátelské districty můžeš útočit, případně je zcela zničit. Klikni na District 2, vyšli špeha a potvrď misi."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "špehovat", tone: "cyan" }),
      Object.freeze({ text: "District 2", tone: "gold" })
    ]),
    targetSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas]",
    mapViewMode: "zoom-out",
    mapDistrictHighlights: Object.freeze([
      Object.freeze({ districtId: 2, tone: "pulse", label: "District 2" })
    ]),
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
    body: "V každém districtu máš různé typy budov, když jich máš víc tak se navzájem posilňují. Taky můžeš dát do svého districtu obranu ve formě svých lidí a obranných zbraní nebo past. Jednu tam vyzkoušej vložit, pokud zautočí hráč na district ve kterém máš past příjde o celý útok a možnost na nějakou dobu útočit!",
    bodyParagraphs: Object.freeze([
      "V každém districtu máš různé typy budov. Když jich máš víc, navzájem se posilňují.",
      "Do svého districtu můžeš vložit obranu nebo past. Jednu vyzkoušej vložit do District 1."
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "past", tone: "green" }),
      Object.freeze({ text: "District 1", tone: "gold" })
    ]),
    targetSelector: "[data-map-viewport], [data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas]",
    mapViewMode: "zoom-out",
    mapDistrictHighlights: Object.freeze([
      Object.freeze({ districtId: 1, tone: "pulse", label: "District 1" })
    ]),
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
    body: "Každé 4h reálného času (dva dny a dvě noci ve hře) probíhá eliminace tzv. Očista - Tvůj vliv, počet obyvatel, materiálů, districtů nebo například jak bohatý jsi počítá Empire score a nejslabší vypadává. Dokud hráčů není posledních 8 pak příjde final lockdown který trvá 12h a Empire score rozhodne o vítězi! Už je to na tobě jakou cestu zvolíš či sám nebo v Alianci, či čistě nebo cestou padoucha. Můžeš taky používat bounty nebo boosty které najdeš nad mapou. Základy znáš, hodně štěstí!",
    bodyParagraphs: Object.freeze([
      "Každé 4h reálného času probíhá eliminace tzv. Očista. Empire score počítá vliv, obyvatele, materiály, districty i bohatství.",
      "Nejslabší vypadává. Jakmile zůstane posledních 8 hráčů, přijde final lockdown na 12h a Empire score rozhodne o vítězi.",
      "Už je na tobě, jestli půjdeš sám, v Alianci, čistě nebo cestou padoucha. Můžeš používat bounty i boosty nad mapou. Základy znáš, hodně štěstí!"
    ]),
    bodyHighlights: Object.freeze([
      Object.freeze({ text: "Očista", tone: "red" }),
      Object.freeze({ text: "Empire score", tone: "gold" }),
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
