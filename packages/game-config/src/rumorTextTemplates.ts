export const RUMOR_DISTRICT_FALLBACK = "jedné z horkých čtvrtí";

export const RUMOR_TEXT_TEMPLATES = Object.freeze({
  attack_success: Object.freeze([
    "Ve čtvrti {district} se změnila rovnováha sil. Město tomu říká akvizice, ulice tomu říká bordel.",
    "Z {district} přišly zprávy o přestřelce. Majitelé se tam možná měnili rychleji než hesla na Wi-Fi.",
    "Neon v {district} problikl a pak přišlo ticho. Někdo tam prý přepsal hranice bez právníka.",
    "Ulice v {district} dnes mluví tišeji. Když mluví nahlas, většinou pak musí vypovídat.",
    "{district} má čerstvé stopy na asfaltu. Oficiálně déšť, neoficiálně špatné rozhodnutí.",
    "Z {district} se nese tvrdý signál: někdo zatlačil a město si toho všimlo. Bohužel i uklízeči."
  ]),
  attack_fail: Object.freeze([
    "U {district} někdo narazil. Ulice si pamatují neúspěšné útoky a špatné výmluvy.",
    "Gang se pokusil prorazit do {district}, ale vrátil se s prázdnou. Aspoň ego mělo výlet.",
    "V {district} prý cvakly závory dřív, než útočníci našli správné dveře. Navigace selhala morálně.",
    "Někdo zkusil otevřít {district} silou. Město říká, že dveře vyhrály.",
    "U {district} zůstalo pár stop a špatná nálada. Průlom se nekonal, jen trapná pauza.",
    "Z {district} se vrátil jen šum a omlácené ego. Obrana tam možná není hezká, ale má smysl pro humor."
  ]),
  district_capture: Object.freeze([
    "{district} má nového pána. Město to ucítilo okamžitě, hlavně peněženky.",
    "Kontrola nad {district} se přelila do jiných rukou. Staré ruce prý ještě hledají kapsy.",
    "Cedule v {district} se ještě nehýbou, ale ulice už ví, komu se má uhýbat.",
    "V {district} prý přes noc změkly staré dohody. Nová ruka drží klíče a tváří se, že je našla.",
    "{district} přepnul barvu v tichosti. Kdo tam vybírá daň, už nebude stejný a nejspíš ani levnější.",
    "Mokré chodníky v {district} odráží nové jméno. Staré vazby se řežou rychle, účtenky pomaleji."
  ]),
  police_warning: Object.freeze([
    "Šeptá se, že hlídky kolem {district} zhoustly. Někdo tam dělá moc hluku na město, které miluje ticho.",
    "Zdroj říká, že policie si značkuje {district}. Nikdo zatím neví proč, což policii nikdy nevadilo.",
    "Prý se v {district} objevily nenápadné vozy bez loga. Nenápadné asi jako krev na bílém saku.",
    "Někdo tvrdí, že {district} už leží na policejní mapě červeně. Romantika pro lidi se zatykačem.",
    "Dispečer prý dvakrát vyslovil {district}. Potřetí už jen ztišil rádio a začal si psát poznámky.",
    "Kolem {district} se údajně točí hlídky bez světel. Buď prevence, nebo nejhorší taxík ve městě.",
    "Zdroj od baru tvrdí, že {district} má moc horký vzduch a málo únikových cest. Architekt by plakal.",
    "Šeptá se, že v {district} někdo přehnal cashflow. Policie prý cítí pach peněz i přes kafe z automatu."
  ]),
  police_raid: Object.freeze([
    "Razie zasáhla {district}. Špinavé peníze tam nezůstaly dlouho schované.",
    "Sirény přehlušily neon. Policie si vybrala svůj cíl.",
    "V {district} se rozsvítily modré stíny. Někdo tam už počítá ztráty.",
    "Policie udeřila v {district}. Dveře šly dolů dřív než alibi.",
    "Ulice v {district} ztichly, když dorazily dodávky. Kontrola byla tvrdá.",
    "V {district} se dnes nesmlouvalo. Razie brala, co našla."
  ]),
  black_market: Object.freeze([
    "Na černém trhu prý proletěl balík, co neměl existovat. Jména zůstala pod stolem, kde se jim daří.",
    "Někdo údajně bral zboží mimo katalog. Kamery zrovna osleply, chudinky jedny křehké.",
    "Šeptá se o nočním obchodu bez faktur a bez svědků. Účetní by omdlel, kdyby nebyl placený za opak.",
    "Zdroj říká, že v zadní síti se měnilo zboží za špinavý cash. Hygiena opět prohrála.",
    "Prý šly bedny z ruky do ruky rychleji než omluva. Nikdo nechtěl znát původ, jen slevu.",
    "Někdo tvrdí, že se prodával materiál, který neměl projít žádným skladem. Sklad to vzal osobně.",
    "Zadní kanál údajně vyplivl levné zboží a drahé problémy. Klasická městská sleva.",
    "Šeptá se o zásilce bez manifestu. Kdo ji vzal, ten možná chystá něco většího, nebo jen neumí nakupovat normálně.",
    "Zdroj říká, že někdo skupuje vybavení po tichu. Ne na parádu, spíš na noc, která nebude hezká."
  ]),
  police_pressure_medium: Object.freeze([
    "Šeptá se, že se poldové kolem {district} ptají moc slušně. To je vždycky špatné znamení.",
    "Někdo tvrdí, že {district} dnes voní po levném kafi z policejní stanice. Nikdo to nepotvrdil.",
    "Zdroj říká, že u {district} stojí auta bez značek. Buď tajní, nebo nejtrapnější carsharing ve městě.",
    "Prý se kolem {district} motají lidi, co se neusmívají ani na slevu. Ulice říká, že mají odznaky v kapse.",
    "V {district} se údajně ptali na jména, směny a zadní dveře. Normální anketa to asi nebyla."
  ]),
  police_pressure_high: Object.freeze([
    "Informátor tvrdí, že se na {district} chystá velký pohyb. Nikdo nechce říct kdy, což je přesně ta horší varianta.",
    "Šeptá se, že {district} visí na tabuli někde v modrém sklepě. Údajně vedle fotek lidí, co špatně spí.",
    "Zdroj říká, že poldové kolem {district} ztichli. Když ztichnou oni, většinou začnou křičet dveře.",
    "Někdo tvrdí, že u {district} mizí hlídky a objevují se dodávky. To není upgrade dopravy.",
    "Prý se blíží zátah, nebo někdo jen moc rád dramatizuje. {district} si pro jistotu zhasíná neon."
  ]),
  police_district_heat: Object.freeze([
    "V {district} se údajně ptají na účtenky, co nikdy neexistovaly. Ulice se tváří, že neumí číst.",
    "Šeptá se, že {district} je pro policii moc horký na obyčejnou obchůzku. Nikdo tomu neříká threshold, všichni tomu říkají průšvih.",
    "Zdroj tvrdí, že civilové v {district} viděli stejné auto třikrát. Řidič prý neuměl parkovat ani lhát.",
    "Někdo říká, že {district} přitahuje modré stíny. Město tomu říká zvýšený zájem, barmani tomu říkají mizerný večer.",
    "V {district} prý lidé najednou zapomínají jména. To se stává, když se kolem ptá moc kabátů."
  ]),
  police_false_lead: Object.freeze([
    "Někdo šíří, že zátah míří na {district}. Zní to hlasitě, smrdí to levně a nikdo za tím nestojí.",
    "Prý se má v {district} objevit zásahovka. Stejný zdroj včera tvrdil, že bankomat umí zpívat.",
    "Šeptá se o policejním poplachu kolem {district}, ale stopa je tenká jak účtenka po praní peněz.",
    "Zdroj říká, že {district} čeká problém. Zdroj taky dluží třem lidem a jedné kávovarové firmě.",
    "Někdo tvrdí, že poldové už jedou. Možná. Nebo jen někdo potřebuje, aby všichni koukali špatným směrem."
  ]),
  police_post_raid_scandal: Object.freeze([
    "Po razii v {district} se prý našly špinavé vazby, které nikdo nechce vidět na denním světle.",
    "Šeptá se, že {district} po zásahu páchne víc alibi než dezinfekcí. Reputace dostala facku a ještě poděkovala.",
    "Zdroj říká, že po modrých světlech zůstaly v {district} účty, fotky a pár jmen, která teď bolí.",
    "Někdo tvrdí, že razie v {district} odkryla víc než sklad. Ulice miluje drama, hlavně když patří někomu jinému.",
    "Po zásahu se kolem {district} údajně lepí otázky. Špinavé, hlučné a dražší než právník ve tři ráno."
  ]),
  trap: Object.freeze([
    "V {district} někdo vstoupil do špatných dveří. Past sklapla.",
    "Ulice v {district} byly připravené. Útočníci ne.",
    "V {district} čekalo něco víc než hlídač. Útočníci to zjistili pozdě.",
    "Některé dveře v {district} se otevírají jen jedním směrem. Dnes to bolelo.",
    "Z {district} přišel potvrzený tvrdý náraz. Příprava tam porazila sílu."
  ]),
  robbery: Object.freeze([
    "Z {district} prý zmizelo zboží dřív, než stihly naskočit kamery. Technika zase přišla pozdě.",
    "Někdo v {district} údajně přišel o zásoby. Ulice se smějou potichu, protože smích taky může být důkaz.",
    "Šeptá se, že v {district} šly rolety dolů a bedny ven. Krásná logistika, hnusná morálka.",
    "Zdroj říká, že v {district} někdo vybral sklad a nechal po sobě jen ticho. A asi špatně zametenou podlahu.",
    "V {district} prý někdo počítal zboží dvakrát. Podruhé už počítal hlavně ztráty.",
    "Někdo tvrdí, že v {district} zmizel náklad bez výstřelu. Civilizovaná loupež, město by zatleskalo.",
    "Šeptá se o rychlé ruce a špatně hlídaném skladu v {district}. Špatná kombinace, výborný příběh.",
    "Z {district} údajně odjelo auto těžší než přijelo. Nikdo nečetl značku, všichni četli situaci.",
    "Prý tam zůstaly otevřené dveře a prázdné regály. {district} to nese potichu a pasivně agresivně."
  ])
});

export type RumorTextTemplateKey = keyof typeof RUMOR_TEXT_TEMPLATES;

export const renderRumorTemplate = (
  template: string,
  values: Record<string, string | number | null | undefined> = {}
): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_token, key) => {
    const value = values[key];
    return String(value ?? (key === "district" ? RUMOR_DISTRICT_FALLBACK : ""));
  });

export const resolveRumorTemplate = (
  key: RumorTextTemplateKey,
  selector = 0,
  values: Record<string, string | number | null | undefined> = {}
): string => {
  const templates = RUMOR_TEXT_TEMPLATES[key] ?? RUMOR_TEXT_TEMPLATES.police_warning;
  const index = Math.abs(Math.floor(Number(selector) || 0)) % templates.length;
  return renderRumorTemplate(templates[index], values);
};
