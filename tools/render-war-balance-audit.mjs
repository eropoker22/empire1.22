import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const directory = "docs/audits";
const date = "2026-09-09";
const read = filename => JSON.parse(fs.readFileSync(filename, "utf8"));
const numbers = read(`${directory}/war-balance-after-${date}.json`);
const snapshot = read(`${directory}/war-balance-config-${date}.json`);
const n = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) : "—";
const cell = value => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (headers, rows) => [headers, headers.map(() => "---"), ...rows].map(row => `| ${row.map(cell).join(" | ")} |`).join("\n");
const bundle = entries => Object.entries(entries ?? {}).map(([key, value]) => `${n(value)} ${key}`).join(" + ") || "—";
const buildingNames = Object.fromEntries(snapshot.publicBuildingCatalog.map(entry => [entry.buildingTypeId, entry.label]));
const sections = [];
const add = (title, text, headers, rows) => sections.push(`**${title}**\n\n${text}\n\n${table(headers, rows)}`);

add("A. Všech 32 typů budov: základní příjmy a tlak",
  "Konfigurační základ před frakcí, zónou, dnem/nocí, upgradem a dočasnými akcemi. Nulový pasivní příjem neznamená zbytečnou budovu: může vyrábět materiál, populaci nebo poskytovat obranu. Příjmy jsou za hodinu, heat a vliv za den. Výsledné portfolio je v tabulce F.",
  ["Budova", "ID", "Clean/h", "Dirty/h", "Heat/den", "Vliv/den", "Max. level"],
  snapshot.publicBuildingCatalog.map(entry => {
    const stats = snapshot.config.balance.fixedBuildings[entry.buildingTypeId] ?? entry.stats;
    return [entry.label, entry.buildingTypeId, n(stats.cleanPerHour), n(stats.dirtyPerHour), n(stats.heatPerDay), n(stats.influencePerDay), n(stats.maxLevel)];
  }));

const actions = Object.values(snapshot.config.balance.buildingActions);
const actionDescriptions = new Map(snapshot.publicBuildingCatalog.flatMap(entry => [...entry.specialActions, ...entry.headerActions]).map(action => [action.actionId, action]));
const tick = snapshot.config.tickRateMs;
add("B. Všech 40 akcí budov: cena, délka, cooldown a statický dopad",
  "Cooldown je přepočtený základ FREE (×0,8 a zaokrouhlení na tick), před případnou další synergií. Délka označuje konfigurační dobu efektu; některé akce vyplatí okamžitě. Dynamické odměny, audit či náhodné výsledky se řídí specializovaným resolverem a slovním popisem, nikoli jen prázdným outputGain. Vliv se zapisuje samostatně, takže například prázdná peněžní cena nemusí znamenat akci zdarma.",
  ["Budova / akce", "Cena", "Efekt min", "Konfig. CD min", "FREE CD min", "Statická odměna", "Δ heat / vliv", "Další pravidlo"],
  actions.map(action => [
    `${buildingNames[action.buildingType] ?? action.buildingType}: ${action.label} (${action.actionId})`,
    bundle(action.inputCost), n(action.durationMs / 60_000), n((action.cooldownMs || action.durationMs || 0) / 60_000),
    n(Math.ceil(Math.ceil((action.cooldownMs || action.durationMs || 0) / tick) * 0.8) * tick / 60_000),
    bundle(action.outputGain), `${n(action.heatGain)} / ${n(action.influenceChange)}`,
    actionDescriptions.get(action.actionId)?.effectSummary ?? action.description
  ]));

add("C. Všech 21 výrobních receptů a plné pořizovací náklady",
  "Plná cena zahrnuje rekurzivně spotřebované suroviny za výrobní ceny, bez tržní marže a bez ceny čekání. Denní/noční časy jsou skutečným výpočtem pro měřené portfolio, nikoli univerzální čas pro každou frakci a akci. Naplnění předpokládá dostatek zaplacených vstupů a kontinuální běh bez ručního výběru.",
  ["Produkt", "Budova", "Plná cena", "Vstupy", "Výstup / fronta", "Den / noc s", "Naplnění L1 min", "Naplnění L14 min"],
  numbers.recipes.map(recipe => [recipe.id, buildingNames[recipe.type], n(recipe.cost), bundle(recipe.inputCosts),
    `${recipe.localCap} / ${recipe.queueCap}`, `${recipe.daySeconds} / ${recipe.nightSeconds}`, n(recipe.dayLocalFullMinutes), n(recipe.level14LocalFullMinutes)]));

add("D. Upgrade výrobních budov",
  "Cena je jednotlivý upgrade na uvedenou úroveň; součet zahrnuje i mezilehlé úrovně, které tabulka kvůli délce nezobrazuje. Rychlost je vlastní levelový násobitel, další efekty se skládají nad ním.",
  ["Budova", "Cílový level", "Násobitel rychlosti", "Cena kroku", "Součet od L1"],
  numbers.upgrades.flatMap(building => building.levels.map(level => [buildingNames[building.type], level.level, n(level.speed), n(level.cost), n(level.total)])));

add("E. Globální sklad",
  "Skupina určuje limit každého jednotlivého produktu, nikoli společnou zásobu všech položek ve skupině. Lokální výstup u výrobní budovy a zaplacená fronta jsou odlišné kontejnery. Řádky s nulou skladových budov ukazují základ bez budovy; level v nich nemá vliv.",
  ["Počet skladových budov", "Level", "Základní", "Taktické", "Strategické"],
  numbers.storageMatrix.map(entry => [entry.count, entry.level, ...["bulk", "tactical", "strategic"].map(id => entry.groups.find(group => group.id === id)?.capacity)]));

add("F. Ekonomická portfolia po započtení modifikátorů",
  "Reálné izolované výpočty pro konkrétní sady districtů bez lidského obchodování. Průměr je aritmetický průměr naměřené denní a noční sazby; není to celkový příjem pro libovolný kalendář a aktivitu. Heat zde vyjadřuje přírůstek districtového tlaku za hodinu, ne neomezený přímý přírůstek osobního HEAT.",
  ["Start / počet districtů", "District ID", "Clean/h průměr", "Dirty/h průměr", "District heat/h", "Vliv/h", "Populace/h a zásobník"],
  numbers.portfolios.map(entry => [`${entry.zone} / ${entry.size}`, entry.ids.join(", "), n(entry.average.clean), n(entry.average.dirty),
    n(entry.average.heat), n(entry.average.influence), entry.population.map(building => `${buildingNames[building.type]}: ${n(building.perHour)}/h, max ${building.capacity}`).join("; ")]));

add("G. Všech 41 způsobilých startů v měřeném osazení",
  "Tato tabulka zachovává rozdíly mapy. Povolený typ districtu ještě neznamená, že právě není obsazen, rezervován nebo vyloučen pravidly vzdálenosti. Pět parkových startů nemá pasivní clean příjem; to je otevřený problém férovosti a informovaného výběru, ne opravená vlastnost.",
  ["District", "Zóna", "Civilní budovy", "Clean/h průměr", "Dirty/h průměr", "Vliv/h", "Populace/h"],
  numbers.starts.map(entry => [entry.id, entry.zone, entry.buildings.filter(type => !["pharmacy", "drug_lab", "factory", "armory"].includes(type)).map(type => buildingNames[type]).join(", "),
    n(entry.average.clean), n(entry.average.dirty), n(entry.average.influence), n(entry.population.reduce((sum, building) => sum + building.perHour, 0))]));

add("H. Frakce: pasiva a stav zvláštních schopností",
  "Limit čtyř se týká každé frakce. Speciální frakční schopnosti označené preview jsou návrh v katalogu, nikoli funkční klikací schopnost. Tabulka nepřidává frakcím nové bonusy.",
  ["Frakce", "Pasiva", "Specializace", "Zvláštní schopnost / stav"],
  snapshot.factions.map(faction => [faction.name, faction.passiveEffectSummary.join("; "), faction.playstyleSummary,
    `${faction.specialAction.name}: ${faction.specialAction.status}`]));

add("I. Citlivost výroby na frekvenci kontroly",
  "Horní odhad kusů za hodinu při pravidelném kompletním výběru, L1. Nezahrnuje čas na dovoz vstupů, nedostatek peněz, policejní blokace ani přepínání receptů. Ukazuje zejména ztrátu kapacity při dlouhé nepřítomnosti.",
  ["Produkt", "Kontrola 15 min", "60 min", "120 min", "360 min", "480 min"],
  numbers.checkins.map(entry => [entry.id, ...[15, 60, 120, 360, 480].map(minutes => n(entry.level1.find(row => row.minutes === minutes)?.itemsPerHour))]));

add("J. Celý katalog 300 questů: finanční očekávání a riziko",
  "Matematický odhad z definic, nikoli 300 odehraných questů. Finanční EV počítá clean a výrobní hodnotu surovin; dirty cash má váhu 0,7. Vliv a informace nejsou převáděny na peníze. EV/h slouží k porovnání jedné akce, nikoli k tvrzení o nepřetržitém příjmu: nabídky, strategické limity, dostupnost a souběh jej omezují. Záporné EV u informačního questu samo nedokazuje chybu.",
  ["Quest", "Agent", "Obtížnost", "Min", "Úspěch %", "Hodnota odměny", "EV peněz", "EV/h", "EV vlivu", "EV heat"],
  numbers.quests.map(quest => [quest.id, quest.agent, quest.difficulty, n(quest.minutes), n(quest.successRate), n(quest.rewardValue),
    n(quest.expectedValue), n(quest.expectedValuePerHour), n(quest.expectedInfluence), n(quest.expectedHeat)]));

const tablesPath = `${directory}/war-balance-tables-${date}.md`;
fs.writeFileSync(tablesPath, `# Číselná příloha auditu Empire STREETS — ${date}\n\nZdroj: lokální snapshot a měření skutečných pravidel. Číst společně s [hlavním auditem](war-balance-${date}.md); příloha sama neposuzuje vyváženost celé hry.\n\n${sections.join("\n\n")}\n`);

const artifacts = [
  [".tmp/war-balance-match-1.json", `war-match-before-${date}.json`],
  [".tmp/war-balance-match-after.json", `war-match-after-${date}.json`],
  [".tmp/war-completed-regression-tests.json", `war-regression-tests-${date}.json`],
  [".tmp/war-extraction-regression-tests.json", `war-extraction-tests-${date}.json`],
  [".tmp/war-entry-postgres-tests.json", `war-postgres-tests-${date}.json`]
];
for (const [source, destination] of artifacts) if (fs.existsSync(source)) fs.copyFileSync(source, path.join(directory, destination));
const before = read(`${directory}/war-match-before-${date}.json`).report;
const after = read(`${directory}/war-match-after-${date}.json`).report;
const results = [
  table(["Měření", "Před tímto laděním", "Po úpravě délky, zásobníků, boostů a HEAT"], [
    ["Stejné seed / scénář", `${before.seed} / ${before.scenario}`, `${after.seed} / ${after.scenario}`],
    ["Délka zápasu", `${before.durationGameTimeMs / 3_600_000} h`, `${after.durationGameTimeMs / 3_600_000} h`],
    ["Přijaté / odeslané příkazy", `${before.commandsAccepted} / ${before.commandsAttempted}`, `${after.commandsAccepted} / ${after.commandsAttempted}`],
    ["Očekávaná / neočekávaná odmítnutí", "2 / 0", "2 / 0"],
    ["Zahájené útoky / špionáže", `${before.attacks} / ${before.spies}`, `${after.attacks} / ${after.spies}`],
    ["Kontroly invariantů / porušení", `${n(before.invariantChecks)} / ${before.invariantViolations.length}`, `${n(after.invariantChecks)} / ${after.invariantViolations.length}`],
    ["Přijaté placené snížení HEAT", before.actionCoverage["reduce-police-heat"]?.success ?? 0, after.actionCoverage["reduce-police-heat"].success],
    ["Vyzvednuté odměny městských událostí", before.cityEventRewardClaims, after.cityEventRewardClaims]
  ]),
  "Oba běhy začaly s 20 novými hráči, 6 000 clean, 3 000 dirty, 150 populace, 15 vlivu a povoleným startem v residential/park. Jde o čerstvé běhy stejného seedu, nikoli pokračování starého snapshotu. Mezi běhy se změnila i schopnost botů používat tlačítka HEAT. Nelze proto připsat každý rozdíl jednomu konkrétnímu buffu či nerfu.",
  "Nový běh prošel obnovou po restartu, idempotencí, souběhem nákupu, uložením finálního výsledku a blokací mutací/ticku po konci hry. Souhrnný příznak `passed` přesto zůstává false: nepokryté založení aliance je poctivě uvedeno jako `ACTION_NOT_SUCCESSFUL:create-alliance`. Příkazy pro úspěšné založení a stržení vlivu jsou ověřeny samostatnými testy, nikoli tímto botím zápasem.",
  "V novém běhu vzniklo 59 událostí policejního výjezdu; tento součet zahrnuje i rutinní kontroly a nesmí se vydávat za 59 konfiskací. Městské události běžely, ale boti nevyzvedli žádnou jejich odměnu. Vyhodnocení/claim je proto pokryto cílenými testy, nikoli úspěšným claimem v tomto dlouhém zápase.",
  "**78 hodin dokládá délku, ne intenzitu lidské války.** Dvacet dva zahájených útoků za celý botí zápas je omezený podklad pro tvrzení o nepřetržitě aktivní frontě. Ekonomický bot skončil čtvrtý a informační pátý; vítěz byl expander. Není prokázána rovná výhernost čistě výrobní, ekonomické a informační specializace. K tomu jsou nutné oddělené strategie, více seedů a lidské zápasy.",
  "Celé zápasy byly zkompilovány před poslední úpravou ceny kasinového inspektora, závislosti náhody na ID klientského příkazu, zobrazení bodových příspěvků a opravou sběru výsledků v simulátoru. Tyto pozdější změny mají samostatné regresní testy; dlouhý běh se nesmí prezentovat jako simulace přesně všech posledních souborů.",
  "Prohlížečové kontroly: **6 HEAT scénářů** v mobilním Chromiu a WebKitu, **6 viewport scénářů** v obou jádrech, **3 frakční/rejoin scénáře**, **2 hlášené UI/registrační scénáře** a **1 animace pasti** v Chromiu. Celkem **18 úspěšných scénářů**. HEAT a frakční testy používají kontrolované serverové odpovědi; viewport/UI lokální herní režim. Nejde o kompletní přihlášený produkční E2E ani fyzický telefon. Test popisků byl opraven, aby změřil geometrii ve stejném renderovacím kroku a nevzorkoval už přepsaný časovač.",
  "Raw podklady: [první zápas](war-match-before-2026-09-09.json), [nový zápas](war-match-after-2026-09-09.json), [číselné měření před](war-balance-before-2026-09-09.json), [po](war-balance-after-2026-09-09.json) a [aktuální konfigurace](war-balance-config-2026-09-09.json). Chybná starší pole úspěšnosti útoků/špionáže zůstala v raw souborech zachována pro dohledatelnost a nejsou použita v závěru."
];
const testFile = `${directory}/war-regression-tests-${date}.json`;
if (fs.existsSync(testFile)) {
  const tests = read(testFile);
  results.push(`Závěrečná související regresní sada: **${tests.numPassedTests}/${tests.numTotalTests} testů**, ${tests.numFailedTests} selhání, ${tests.numPendingTests} přeskočených. [Strojový výsledek](war-regression-tests-${date}.json).`);
}
const pg = read(`${directory}/war-postgres-tests-${date}.json`);
results.push(`Živý lokální PostgreSQL: **${pg.numPassedTests}/${pg.numTotalTests} testů**, ${pg.numFailedTests} selhání a ${pg.numPendingTests} přeskočených. Každý test měl izolované schéma, zahrnutou migraci 027 a žádný přístup k produkčním datům. [Výsledek](war-postgres-tests-${date}.json).`);
const extractionPath = `${directory}/war-extraction-tests-${date}.json`;
if (fs.existsSync(extractionPath)) {
  const extracted = read(extractionPath);
  results.push(`Po rozdělení pomocných funkcí kvůli limitům délky souborů bylo znovu ověřeno **${extracted.numPassedTests}/${extracted.numTotalTests} souvisejících testů** (${extracted.numFailedTests} selhání). Tato čísla jsou opakováním části předchozí sady, nesčítají se jako další odlišné testy. [Výsledek](war-extraction-tests-${date}.json).`);
}
results.push("Závěrečné statické kontroly prošly: TypeScript včetně testových zdrojů, shoda generované browser konfigurace, hranice architektury, limity délky souborů, bezpečné směrování příkazů a `git diff --check` s nastavením konců řádků tohoto repozitáře. Po posledním odstranění nadbytečného příznaku v plánování razie znovu prošlo i všech 41 policejních testů. Celá nesouvisející testovací sada repozitáře se znovu nespouštěla.");

const reportPath = `${directory}/war-balance-${date}.md`;
let report = fs.readFileSync(reportPath, "utf8");
const replaceBlock = (text, name, replacement) => {
  const marker = `<!-- ${name} -->`, end = `<!-- /${name} -->`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  const oldEnd = text.indexOf(end, start);
  return text.slice(0, start) + marker + "\n\n" + replacement + "\n\n" + end
    + text.slice(oldEnd < 0 ? start + marker.length : oldEnd + end.length);
};
report = replaceBlock(report, "AUDIT_RESULTS", results.join("\n\n"));
report = replaceBlock(report, "GENERATED_TABLES", `**19. Úplné číselné přílohy a reprodukce**\n\n[Číselná příloha](war-balance-tables-${date}.md) obsahuje 32 budov, 40 akcí, 21 receptů, upgrady, skupiny skladu, portfolia, všech 41 měřených startů, osm frakcí, intervaly výběru a všech 300 questů.\n\nMěření vytváří \`tools/war-balance-audit-${date}.ts\`; dlouhý zápas spouští \`tools/run-war-balance-match-${date}.ts\`. Tuto přílohu z uložených dat vytváří \`node tools/render-war-balance-audit.mjs\`. [Manifest podkladů a omezení](war-evidence-manifest-${date}.json) obsahuje SHA-256 souborů a kompilovaných simulačních programů. Nasazení na staging ani produkci není součástí tohoto auditu.`);
fs.writeFileSync(reportPath, report);

const sources = [...artifacts.map(([, name]) => path.join(directory, name)),
  ...["before", "after", "config"].map(name => `${directory}/war-balance-${name}-${date}.json`),
  ".tmp/war-balance-match.mjs", ".tmp/war-balance-match-after.mjs"];
const manifest = {
  auditDate: date, baseCommit: snapshot.baseCommit, modifiedWorkingTree: true, deploymentVerified: false,
  limitations: ["Before/after is same seed with changed bot HEAT support, not a one-factor experiment",
    "Full runs predate last casino, action randomness, score UI and simulator outcome fixes",
    "Old attack/spy success fields and gross-income names are not valid outcome/gross-income evidence",
    "No alliance setup or city reward claim coverage in full runs; separate tests cover these behaviors",
    "Mobile tests use browser emulation and controlled data, not a physical iPhone"],
  files: sources.filter(source => fs.existsSync(source)).map(source => ({ path: source.replaceAll("\\", "/"), bytes: fs.statSync(source).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex") }))
};
fs.writeFileSync(`${directory}/war-evidence-manifest-${date}.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Audit rendered: ${sections.length} tables, ${numbers.quests.length} quests; ${tablesPath}`);
