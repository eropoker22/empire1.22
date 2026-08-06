export const LOGIN_INFO_CONTENT = Object.freeze({
  news: null,
  help: Object.freeze({
    eyebrow: "PRŮVODCE MĚSTEM",
    intro: "Empire Streets je serverová strategická hra. Každá akce, od výroby po útok, se potvrzuje na serveru a výsledek se ukládá k tvému hráči.",
    sections: Object.freeze([
      Object.freeze({
        title: "Rychlý start",
        items: Object.freeze([
          "Přihlas se, vyber server s otevřenou registrací a založ gang.",
          "Zvol si volný startovní district. Ten se stane základnou tvého impéria.",
          "Nejdřív zajisti populaci, cash, výrobu a místo ve skladu. Potom rozšiřuj hranice."
        ])
      }),
      Object.freeze({
        title: "Akce na mapě",
        items: Object.freeze([
          "Prázdný sousední district můžeš špehovat, vykrást a po úspěšném průzkumu obsadit.",
          "Cizí sousední district můžeš špehovat, vykrást hráče nebo napadnout. Šedé tlačítko vždy ukazuje důvod blokace.",
          "Časovače, ochrany, dostupní členové a cooldowny jsou společné pro všechny hráče a pokračují i po zavření stránky."
        ])
      }),
      Object.freeze({
        title: "Ekonomika, sklad a Heat",
        items: Object.freeze([
          "Budovy vydělávají, vyrábějí materiály nebo otevírají speciální akce. Hotovou výrobu je potřeba vyzvednout.",
          "Warehouse určuje, kolik zásob přijmeš. Když je příslušná skupina plná, další loot nebo výroba se do ní nevejde.",
          "Kriminální akce zvyšují Heat. Vyšší tlak přitahuje policii, razie a dočasná omezení districtu."
        ])
      }),
      Object.freeze({
        title: "Když něco nefunguje",
        items: Object.freeze([
          "Obnov stránku a zkontroluj, zda jsi stále přihlášený ke správnému serveru.",
          "Přečti důvod pod neaktivním tlačítkem; často jde o cooldown, chybějící zdrojový district, populaci nebo plný sklad.",
          "Při hlášení chyby připoj čas, název serveru, district a přesný text chyby. Nikdy neposílej heslo ani session údaje."
        ])
      })
    ]),
    note: "Pre-alpha se průběžně mění. Rozhodující je vždy aktuální stav a výsledek potvrzený serverem."
  }),
  terms: Object.freeze({
    eyebrow: "PRE-ALPHA PODMÍNKY",
    intro: "Používáním Empire Streets potvrzuješ, že rozumíš testovacímu charakteru hry a souhlasíš s těmito pravidly pre-alpha provozu.",
    sections: Object.freeze([
      Object.freeze({
        title: "1. Účast a účet",
        paragraphs: Object.freeze([
          "Pre-alpha je určena hráčům od 16 let. Uživatel odpovídá za správnost registračních údajů, ochranu svého hesla a veškerou aktivitu provedenou přes svůj účet.",
          "Jeden účet nesmí být sdílen více osobami ani používán k obcházení limitů, trestů, ochranných mechanismů nebo pravidel serveru."
        ])
      }),
      Object.freeze({
        title: "2. Testovací provoz",
        paragraphs: Object.freeze([
          "Hra je ve vývoji. Funkce, pravidla, ekonomika, obsah i dostupnost serverů se mohou měnit bez předchozího upozornění. Herní postup může být opraven, vrácen nebo smazán, pokud je to nutné pro bezpečnost a vývoj testu.",
          "Pre-alpha neposkytuje záruku nepřetržité dostupnosti ani zachování konkrétního serveru, výsledku, žebříčku či virtuální položky. Virtuální měny a předměty nemají skutečnou peněžní hodnotu."
        ])
      }),
      Object.freeze({
        title: "3. Férová hra a obsah",
        items: Object.freeze([
          "Je zakázáno zneužívat chyby, automatizovat hraní bez povolení, útočit na infrastrukturu nebo obcházet serverová omezení.",
          "Nevkládej nezákonný, výhrůžný, nenávistný nebo cizí osobní obsah a nevydávej se za jinou osobu.",
          "Nalezenou chybu nahlas bezpečným způsobem. Nešíř postup, který může poškodit účty, data nebo průběh testu."
        ])
      }),
      Object.freeze({
        title: "4. Moderace a ukončení účasti",
        paragraphs: Object.freeze([
          "Provozovatel může skrýt obsah, omezit funkce, pozastavit účet nebo ukončit účast při porušení pravidel, ohrožení služby či ostatních hráčů. Hráč může kdykoli požádat o ukončení testovacího účtu.",
          "Tyto podmínky se mohou s vývojem pre-alpha změnit. U podstatné změny bude při dalším vstupu vyžadováno přijetí nové verze."
        ])
      })
    ]),
    note: "Toto jsou testovací podmínky pre-alpha, nikoli nabídka placené služby ani finální obchodní podmínky."
  }),
  privacy: Object.freeze({
    eyebrow: "SOUKROMÍ A DATA",
    intro: "Empire Streets používá jen údaje potřebné pro účet, bezpečný provoz a uložení multiplayerové hry. Data neprodáváme ani je nepoužíváme pro cílenou reklamu.",
    sections: Object.freeze([
      Object.freeze({
        title: "Jaké údaje zpracováváme",
        items: Object.freeze([
          "Účet: uživatelské jméno, jméno gangu, datum narození pro ověření hranice 16+ a bezpečně vytvořený otisk hesla; heslo se neukládá v čitelné podobě.",
          "Provozní data: přihlášení, účtové a herní relace, členství na serveru, bezpečnostní a chybové záznamy a omezené síťové identifikátory pro ochranu proti zneužití.",
          "Herní data: postup, districty, ekonomika, akce, zprávy, market, bounty, aliance, žebříček a výsledky serveru."
        ])
      }),
      Object.freeze({
        title: "Proč údaje potřebujeme",
        paragraphs: Object.freeze([
          "Údaje používáme k vytvoření a zabezpečení účtu, ověření věkové hranice, provozu multiplayeru, ukládání hry, řešení chyb a obraně proti podvodům či útokům.",
          "Běžná herní data, například jméno gangu, vlastnictví districtů, aliance a výsledky, mohou být viditelná ostatním hráčům. Datum narození, heslo a session údaje veřejné nejsou."
        ])
      }),
      Object.freeze({
        title: "Uložení a předávání",
        paragraphs: Object.freeze([
          "Data jsou zpracovávána v hostovaných službách potřebných pro web, aplikační worker a databázi. Přístup je omezen na provozní potřebu a zabezpečené administrátorské role.",
          "Testovací data uchováváme po dobu pre-alpha a nezbytnou dobu pro bezpečnost, obnovu a řešení incidentů. Nepotřebné účty a záznamy mohou být při resetu testu odstraněny."
        ])
      }),
      Object.freeze({
        title: "Tvoje práva a bezpečí",
        items: Object.freeze([
          "Můžeš požádat o přístup, opravu nebo odstranění testovacího účtu a souvisejících osobních údajů, pokud jejich další uchování nevyžaduje bezpečnostní či právní důvod.",
          "Použij kontakt provozovatele uvedený v pozvánce nebo oficiálním oznámení testu.",
          "Používej unikátní heslo a nikdy neposílej heslo, cookies, session tokeny ani přístupové údaje jiné osobě."
        ])
      })
    ]),
    note: "Pre-alpha informační text bude před veřejným produkčním spuštěním doplněn o úplnou identifikaci správce, kontakt a přesné retenční lhůty."
  })
});
