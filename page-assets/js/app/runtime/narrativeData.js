export const POLICE_RAID_SPECIALTIES = Object.freeze({
  financial: Object.freeze({ key: "financial", label: "Finanční zásah", icon: "💰" }),
  drug: Object.freeze({ key: "drug", label: "Drogová razie", icon: "🧪" }),
  weapons: Object.freeze({ key: "weapons", label: "Zbrojní zásah", icon: "🛡️" }),
  arrests: Object.freeze({ key: "arrests", label: "Zatýkací vlna", icon: "👥" }),
  total: Object.freeze({ key: "total", label: "Celková razie", icon: "⚠️" })
});
export const POLICE_SPECIALTY_RANDOM_WEIGHTS = Object.freeze([
  Object.freeze({ key: "total", weight: 55 }),
  Object.freeze({ key: "financial", weight: 11.25 }),
  Object.freeze({ key: "drug", weight: 11.25 }),
  Object.freeze({ key: "weapons", weight: 11.25 }),
  Object.freeze({ key: "arrests", weight: 11.25 })
]);
export const POLICE_OPERATION_TYPES = Object.freeze({
  warning_notice: Object.freeze({
    key: "warning_notice",
    label: "Lehká kontrola",
    minTier: 1,
    weight: 11,
    durationMs: 15 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `District ${districtName} je pod lehkým dohledem. Hlídky jen sondují provoz a pohyb lidí.`
  }),
  district_control: Object.freeze({
    key: "district_control",
    label: "Kontrola districtu",
    minTier: 2,
    weight: 9,
    durationMs: 18 * 60 * 1000,
    specialtyKey: "arrests",
    summary: (districtName) => `V districtu ${districtName} probíhá zvýšená policejní kontrola a sběr informací.`
  }),
  cash_seizure: Object.freeze({
    key: "cash_seizure",
    label: "Kontrola cashflow",
    minTier: 3,
    weight: 7,
    durationMs: 22 * 60 * 1000,
    specialtyKey: "financial",
    summary: (districtName) => `Finanční jednotka sleduje podezřelé toky peněz kolem districtu ${districtName}.`
  }),
  warehouse_raid: Object.freeze({
    key: "warehouse_raid",
    label: "Skladová razie",
    minTier: 4,
    weight: 6,
    durationMs: 30 * 60 * 1000,
    specialtyKey: "weapons",
    summary: (districtName) => `Policie prohledává sklady a logistické body v districtu ${districtName}.`
  }),
  district_lock: Object.freeze({
    key: "district_lock",
    label: "Uzávěra districtu",
    minTier: 5,
    weight: 7,
    durationMs: 40 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `District ${districtName} je dočasně pod policejní uzávěrou.`
  }),
  apartment_search: Object.freeze({
    key: "apartment_search",
    label: "Domovní prohlídky",
    minTier: 4,
    weight: 6,
    durationMs: 35 * 60 * 1000,
    specialtyKey: "arrests",
    summary: (districtName) => `V districtu ${districtName} běží domovní prohlídky a odvozy podezřelých.`
  }),
  drug_seizure: Object.freeze({
    key: "drug_seizure",
    label: "Drogová razie",
    minTier: 3,
    weight: 8,
    durationMs: 24 * 60 * 1000,
    specialtyKey: "drug",
    summary: (districtName) => `Narkotická jednotka míří na výrobu a distribuci v districtu ${districtName}.`
  }),
  dirty_cash_seizure: Object.freeze({
    key: "dirty_cash_seizure",
    label: "Zásah proti praní peněz",
    minTier: 3,
    weight: 8,
    durationMs: 26 * 60 * 1000,
    specialtyKey: "financial",
    summary: (districtName) => `Podezřelé praní peněz přitáhlo finanční zásah do districtu ${districtName}.`
  }),
  building_shutdown: Object.freeze({
    key: "building_shutdown",
    label: "Odstávka provozu",
    minTier: 4,
    weight: 7,
    durationMs: 35 * 60 * 1000,
    specialtyKey: "weapons",
    summary: (districtName) => `Jedna z budov v districtu ${districtName} je pod nucenou odstávkou.`
  }),
  coordinated_operation: Object.freeze({
    key: "coordinated_operation",
    label: "Koordinovaná operace",
    minTier: 6,
    weight: 10,
    durationMs: 55 * 60 * 1000,
    specialtyKey: "total",
    summary: (districtName) => `Na district ${districtName} běží koordinovaná razie více jednotek.`
  })
});
export const POLICE_ACTION_TIER_MESSAGES = Object.freeze({
  1: Object.freeze({
    title: "LEHKÁ KONTROLA",
    tone: "is-tier-1",
    text: "Policie se tu jen motá. Pár otázek, pár pohledů zatím nic, co by tě mělo rozhodit."
  }),
  2: Object.freeze({
    title: "🟡 PODEZŘENÍ",
    tone: "is-tier-2",
    text: "Začínají čmuchat víc, než je zdrávo. Někdo něco řekl a oni to berou vážně."
  }),
  3: Object.freeze({
    title: "🟠 TLAK NA DISTRICT",
    tone: "is-tier-3",
    text: "Už to není náhoda. Kontroly, výslechy, lidi mizí z ulic. Policie tlačí a začíná to smrdět průserem."
  }),
  4: Object.freeze({
    title: "🔴 AKTIVNÍ RAZIE",
    tone: "is-tier-4",
    text: "Vlítli tam bez varování. Dveře v hajzlu, lidi na zemi. Berou všechno, co najdou a neptají se."
  }),
  5: Object.freeze({
    title: "🔴 BRUTÁLNÍ ZÁTAH",
    tone: "is-tier-5",
    text: "Tohle už není razie, to je masakr. Mlátí, berou, ničí. Kdo se pohne blbě, skončí v pytli."
  }),
  6: Object.freeze({
    title: "TOTÁLNÍ ČISTKA",
    tone: "is-tier-6",
    text: "Vlítli tam naplno. Sebrali cash, lidi i výbavu. District je vyčištěnej do mrtva a nikdo už tam nic neuhájí."
  })
});
export const POLICE_ACTION_TIER_QUOTES = Object.freeze({
  1: Object.freeze([
    "Klídek, jen rutina ale ty mi tu nějak smrdíš.",
    "Dneska nic nehledám. Zatím. Ale pamatuju si ksichty.",
    "Hezký místo. Byla by škoda, kdybych se sem musel vrátit s partou.",
    "Ukaž, co tu schováváš nebo si to najdu sám příště.",
    "Neboj, dneska jen koukám. Zítra už možná beru.",
    "Máš štěstí, že mám dneska dobrou náladu.",
    "Zatím to nechám být ale něco mi říká, že se ještě uvidíme.",
    "Nedělej blbosti a možná tě nechám žít v klidu.",
    "Jen si tu dělám obrázek. A věř mi, že se rychle skládá.",
    "Dneska odcházím. Příště už nemusím."
  ]),
  2: Object.freeze([
    "Někdo začal mluvit a tvoje jméno padlo víc než jednou.",
    "Už to není jen rutina. Něco tu nesedí a ty víš co.",
    "Řekni mi to rovnou ušetříš si problémy. Možná.",
    "Začínáš mě fakt zajímat. A to nechceš.",
    "Vidím, jak se tu hýbou věci. A někdo za tím stojí.",
    "Ještě nejdu po tobě naplno ale blíž už být nemůžu.",
    "Stačí jedna chyba. A já tu nebudu sám.",
    "Máš kolem sebe dost bordelu. Dřív nebo později se v tom utopíš.",
    "Já už vím dost. Teď čekám, kolik toho najdu.",
    "Zatím tě jen sleduju ale věř mi, že to rychle skončí."
  ]),
  3: Object.freeze([
    "Už to tu máme pod kontrolou. Ty tu jen čekáš, až tě sundáme.",
    "Lidi mizí, obchody zavírají a ty jsi uprostřed toho bordelu.",
    "Každej kout tady znám. Nemáš se kam schovat.",
    "Tvoje malý impérium se začíná rozpadat. Slyšíš to praskání?",
    "Zatím jen tlačím. A ty už sotva dýcháš.",
    "Každej tvůj krok sledujem. Jedna chyba a končíš.",
    "Ulice už nejsou tvoje. Jen jsi poslední, kdo to ještě nepochopil.",
    "Tvoje lidi začínají mluvit. A věř mi, že rádi.",
    "Není to otázka jestli ale kdy tě rozkopeme na kusy.",
    "Tohle místo už patří nám. Ty jsi tu jen dočasnej problém."
  ]),
  4: Object.freeze([
    "Na zem! Teď hned, nebo tě tam dostanu já!",
    "Konec hry. Všechno jde ven lidi, prachy, zbraně.",
    "Dveře jsou v hajzlu a ty jdeš s nima.",
    "Ruce kde je vidím! Jedna blbost a končíš!",
    "Tohle jsme ti říkali. Teď už jen sklízíš, cos zasel.",
    "Bal to. Tady už nic nepatří tobě.",
    "Každej kout projdeme. Každou krysu vytáhnem.",
    "Už nejsi boss. Teď jsi jen další případ.",
    "Naložit všechno! Nic tu nezůstane!",
    "Měl jsi šanci to držet v klidu. Teď už je pozdě."
  ]),
  5: Object.freeze([
    "Na zem, kurva! Hned, nebo tě složím!",
    "Tohle už neřešíme v klidu. Tohle se řeší silou!",
    "Všechno bereme! Co se nevejde, rozbijem!",
    "Hýbneš se blbě a jdeš k zemi, jasný?!",
    "Tvoje hra skončila. Teď už jen počítáš ztráty!",
    "Nikdo neuteče! Zavřít to tady celý!",
    "Vytáhněte je ven! Každýho jednoho!",
    "Tady už se neptáme. Tady se bere!",
    "Podívej se kolem tohle je konec tvýho malýho království!",
    "Měl jsi odejít včas. Teď už tě jen roznesem na kusy!"
  ]),
  6: Object.freeze([
    "Hotovo. Tady už nic není.",
    "Vyčištěno do posledního šroubu. Můžeš začít znova jestli na to máš.",
    "Tohle místo skončilo. A ty s ním.",
    "Žádný lidi, žádný prachy, žádná moc. Jen prázdno.",
    "Tvoje impérium? Teď je to jen hromada sraček.",
    "Zbylo ti hovno. A to je ještě víc, než sis zasloužil.",
    "Ticho. Přesně takhle to tu má vypadat.",
    "Konec hry. Resetni se a zkus to znova líp.",
    "Tohle město si tě vyplivlo. A ani si toho nevšimlo.",
    "Zapomeň na to, co tu bylo. Už to neexistuje."
  ])
});
export const POLICE_ACTION_SPECIALTY_QUOTES = Object.freeze({
  financial: Object.freeze([
    "Kde máš prachy? Protože já je teď beru.",
    "Účty zamražený. Cash zabavenej. Gratuluju.",
    "Tvoje peníze právě změnily majitele.",
    "Hraješ si na krále? Bez peněz jsi jen další nula.",
    "Všechno spočítaný, všechno zabavený. Nic ti nezbyde.",
    "Každej špinavej cent jde pryč. Do posledního.",
    "Můžeš si to vydělat znova. My ti to zase vezmem.",
    "Vidím, že jsi vydělával dobře. Škoda, že to nebylo tvoje.",
    "Tvoje impérium stojí na prachách. A ty právě zmizely.",
    "Hotovost, účty, zásoby všechno jde s náma."
  ]),
  drug: Object.freeze([
    "Cítím to už od dveří. A teď to všechno mizí.",
    "Vařil jsi velký věci. Teď to skončilo.",
    "Všechno bereme. Co nevezmem, zničíme.",
    "Tvoje výroba? Už jen odpad.",
    "Každej gram jde pryč. Do posledního.",
    "Tenhle bordel tu končí. Hned.",
    "Dneska nic neprodáš. Nemáš co.",
    "Zkoušel jsi jet ve velkým. Teď jdeš dolů.",
    "Tvoje laby už nejedou. Už nikdy.",
    "Tohle město ti tenhle byznys nenechá."
  ]),
  weapons: Object.freeze([
    "Kolik toho tu máš? Nevadí, všechno jde pryč.",
    "Bez zbraní nejsi nic. A přesně tam tě vracíme.",
    "Všechno zabavit. Nechci tu vidět ani nábojnici.",
    "Tvoje armáda právě přišla o zuby.",
    "Konec hraní na vojáky. Tohle není tvoje válka.",
    "Tyhle hračky ti nepatří. Už vůbec ne.",
    "Seberte to. Každou zbraň, každej kus.",
    "Teď jsi neozbrojenej. A dost zranitelnej.",
    "Zbraně pryč. Teď jsi jen cíl.",
    "Zkus to teď bez nich. Hodně štěstí."
  ]),
  arrests: Object.freeze([
    "Berem všechny. Jednoho po druhým.",
    "Tvoje lidi? Už nejsou tvoji.",
    "Do aut s nima. Všichni.",
    "Kdo tu zůstane, ten má sakra štěstí.",
    "Rozpadne se ti to pod rukama. Sleduj.",
    "Bez lidí nejsi nic. A přesně to teď jsi.",
    "Každýho naložit. Nechci tu nikoho vidět.",
    "Tvůj gang se právě rozpadl.",
    "Konec party. Jedete s náma.",
    "Zbyde ti pár krys jestli vůbec."
  ]),
  total: Object.freeze([
    "Probíhá razie. Drž hlavu dole a počítej ztráty.",
    "Razie je v běhu. Teď už jen sleduješ, co všechno zmizí.",
    "Policie je uvnitř. Tohle nebude levný.",
    "Běží celková razie. Všechno je teď pod tlakem.",
    "Razie právě začala. Nic kolem tebe není v bezpečí."
  ])
});
export const POLICE_DISTRICT_CLICK_WARNING_QUOTES = Object.freeze([
  "Tady teď ne. Policie to tu právě rozjebává.",
  "Zapomeň na to. District je plnej policajtů."
]);
export const SPY_SUCCESS_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Špehování hotovo. Tvůj špeh je zpátky - prázdno jak v hrobě.",
  "Zpátky bez škrábnutí. Nikdo tam není, můžeš to sebrat.",
  "Špeh se vrátil. District úplně v píči prázdnej.",
  "Hotovo. Nula lidí, nula odporu. Free teritorium.",
  "Tvůj špeh žije a hlásí - nikdo to nedrží.",
  "Čistý průchod. District leží ladem, vezmi si ho.",
  "Špehování OK. Prázdno. Tohle je zadarmo, kurva.",
  "Zpátky v bezpečí. Nikdo tam není, jen čeká na tebe.",
  "Potvrzeno - prázdnej district. Stačí přijít a je tvůj.",
  "Špeh to projel a vrátil se. Nic tam není, žádný sračky."
]);
export const SPY_SUCCESS_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh zpátky. Máš je přečtený do poslední sračky.",
  "Hotovo. Všechno víš - lidi, zbraně, slabiny. Jsou odkrytí.",
  "Špeh se vrátil. Vidíš jim do všeho. Jsou v píči.",
  "Plný info. Každej kout, každej detail. Nemají šanci.",
  "Špehování čistý. Máš kompletní obraz - teď je roztrhej.",
  "Špeh zpátky. Obrana má díry jak kráva. Využij to.",
  "Všechno odkrytý. Víš přesně, kde je zlomit.",
  "Špeh donesl všechno. Jsou nahý jak svině.",
  "Hotovo. Máš jejich slabiny na talíři.",
  "Špeh žije a ví všechno. Teď jsi o krok před nima ve všem."
]);
export const SPY_MEDIUM_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Špeh zpátky. Vypadá to prázdně ale něco tam smrdí.",
  "Nula lidí, ale nebylo to čistý. Špeh se stáhnul včas.",
  "District prázdnej, ale špeh měl namále. Něco tam nesedí.",
  "Špeh to projel napůl. Prázdno ale divnej pocit z toho místa.",
  "Nikdo tam není, ale nebylo to safe. Špeh radši zdrhnul.",
  "Prázdnej district, ale něco se tam hnulo. Špeh se stáhnul.",
  "Vypadá to čistě, ale špeh si není jistej. Něco tam nesedí.",
  "Špeh zpátky. Prázdno ale až moc tichý na tohle město.",
  "Nikdo tam není, ale špeh skoro narazil. Bacha na to.",
  "District bez lidí, ale nebyl to clean run. Něco tam může být."
]);
export const SPY_MEDIUM_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh něco vytáhl, ale zdaleka ne všechno. Můžeš je sundat nebo to totálně posrat.",
  "Nejsou úplně odkrytý. Něco tušíš, ale zbytek je pořádná mlha.",
  "Špeh je zpátky. Máš půlku pravdy a ta druhá půlka ti může pěkně zlomit vaz.",
  "Máš jen částečný info. Stačí to na pořádný risk, ale na jistotu to rozhodně není.",
  "Vidíš jim do karet jen napůl. Ten zbytek tě může pěkně kousnout do zadku."
]);
export const SPY_MAJOR_FAIL_EMPTY_DISTRICT_QUOTES = Object.freeze([
  "Prázdno jak svině a stejně jsi o špeha přišel. To je solidní průser.",
  "Nikdo tam není, ale špeh je v prdeli. Něco tam nehraje.",
  "Free teritorium? Možná. Špeh už to neřekne.",
  "Špeh se nevrátil. Prázdno, ale kurevsky divný.",
  "District prázdnej a špeh v hajzlu. Gratuluju."
]);
export const SPY_MAJOR_FAIL_OCCUPIED_DISTRICT_QUOTES = Object.freeze([
  "Špeh v prdeli. Chytli ho. Teď už vědí i o tobě.",
  "Průser. Špeha mají. A už vědí, kdo jim leze po rajónu.",
  "Zatkli ho. Nemáš žádný info - a oni mají tebe.",
  "Špeh v hajzlu. Chytli ho a teď je máš na krku.",
  "Chytli ho při práci. Teď už jen čekej, až si dojdou pro tebe.",
  "Špeh padl. A tvoje jméno už mezi nima koluje.",
  "Zajali ho. Nejenže nic nevíš, oni teď vědí o tobě až moc.",
  "Totální průser. Špeha mají a celý district je ve střehu.",
  "Špeh to totálně posral a teď je v jejich rukách. Gratuluju, jsi na řadě ty.",
  "Nemáš info. Oni mají tvýho člověka. Docela blbá rovnice, co?"
]);
export const SPY_DETECTION_WARNING_QUOTES = Object.freeze([
  "Chytili jsme jim špeha. Teď víš, kdo se ti hrabe v rajónu.",
  "Někdo tě zkoušel projet - nevyšlo mu to. Máš ho.",
  "Špeh chycený. Teď je na tobě, co s ním uděláš.",
  "Zachytili jsme krysu. A ví, pro koho makala.",
  "Někdo si na tebe dovolil. Teď máš jeho člověka v rukách.",
  "Špeh je u tebe. Oni chtěli info - teď jsi ho dostal ty.",
  "Zkusili tě projet potichu. Teď držíš jejich špinavou práci.",
  "Chytil jsi ho při činu. Teď víš, kdo po tobě jde.",
  "Nepřítel udělal chybu. A ty ji právě držíš v rukách.",
  "Špeh odhalen a zajat. Teď máš výhodu ty."
]);
export const SPY_ALLIANCE_DETECTION_WARNING_QUOTES = Object.freeze([
  "[ALLY] chytil nepřátelskýho špeha. Někdo si na nás dovolil.",
  "U [ALLY] odhalen špeh. Aliance je ve střehu.",
  "Zachycena krysa u [ALLY]. Víme, kdo po nás jde.",
  "[ALLY] má jejich špeha. Někdo nás zkoušel projet potichu.",
  "Špeh odhalen u [ALLY]. Držte se, někdo nás sleduje.",
  "[ALLY] zachytil infiltrace. Máme stopu na nepřítele.",
  "Nepřítel udělal chybu u [ALLY]. Teď máme výhodu.",
  "U [ALLY] chycen špeh. Aliance má oči otevřený.",
  "[ALLY] drží jejich člověka. Někdo se hrabe v našem rajónu.",
  "Špeh skončil u [ALLY]. Teď víme, odkud fouká vítr."
]);

export const DISTRICT_GOSSIP_SEED_LIBRARY = Object.freeze({
  resident: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: Obytný sektor drží silná uliční síť a cizí pohyb se tu dlouho neschová.",
      "Potvrzený intel: V rezidenčním bloku funguje stabilní logistika lidí i peněz."
    ])
  }),
  industrial: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: Průmyslový sektor drží zásoby materiálu a rychlý přesun techniky.",
      "Potvrzený intel: V průmyslu bývá tvrdší obrana a lepší krytí pro těžkou výzbroj."
    ])
  }),
  economy: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: Ekonomický sektor je silný na cashflow, vliv a rychlé krytí transakcí.",
      "Potvrzený intel: V tomto sektoru se dobře schovávají výplaty i tiché nákupy."
    ])
  }),
  park: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: Parkový sektor dává dobré krytí pro přesuny a nenápadný dohled.",
      "Potvrzený intel: Přirozené stíny a členitost terénu tu nahrávají špehování i léčkám."
    ])
  }),
  downtown: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: Downtown je hlučný, drahý a plný očí, ale zároveň skrývá nejvíc příležitostí.",
      "Potvrzený intel: Centrum přitahuje obchod, vliv i nejrychlejší eskalaci konfliktu."
    ])
  }),
  unknown: Object.freeze({
    rumors: Object.freeze([]),
    verified: Object.freeze([
      "Potvrzený intel: District drží vlastní rytmus a reaguje rychle na cizí zásah."
    ])
  })
});
