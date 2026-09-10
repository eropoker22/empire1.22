export const LOGIN_INFO_CONTENT = Object.freeze({
  news: null,
  help: Object.freeze({
    eyebrow: "PRVNÍ KROKY V ULICÍCH",
    intro: "Založ gang, zajisti mu zázemí a rozšiřuj své území. Tady najdeš to nejdůležitější pro začátek.",
    sections: Object.freeze([
      Object.freeze({
        title: "01 / Vstup do města",
        items: Object.freeze([
          "Vytvoř si účet a gang. V lobby vyber server s otevřenou registrací.",
          "Vyber a potvrď volný startovní district — základnu svého impéria.",
          "Zajisti lidi, příjem a místo ve skladu. Pak rozjeď výrobu a expanzi."
        ])
      }),
      Object.freeze({
        title: "02 / Poznej své okolí",
        items: Object.freeze([
          "Neutrální sousední district můžeš prozkoumat, vykrást a po úspěšném průzkumu obsadit.",
          "Proti sousednímu gangu můžeš vyslat špiony, podniknout loupež nebo zaútočit. Dostupnost ukazují tlačítka akcí.",
          "Časovače a ochrany běží dál i po zavření stránky. Plánuj dopředu."
        ])
      }),
      Object.freeze({
        title: "03 / Udrž gang v chodu",
        items: Object.freeze([
          "Budovy přinášejí příjem, výrobu a speciální akce. Hotové výrobky vyzvedni.",
          "Hlídej Warehouse. Do plné skupiny zásob se další kořist ani výroba nevejde.",
          "Zločin zvyšuje Heat. Vyšší tlak přitahuje policii a razie."
        ])
      }),
      Object.freeze({
        title: "Něco se zaseklo?",
        items: Object.freeze([
          "Obnov stránku a ověř, že jsi přihlášený ke správnému serveru.",
          "U neaktivní akce zkontroluj důvod: čas do další akce, zdrojový district, lidi nebo kapacitu skladu.",
          "K hlášení chyby přidej čas, server, district a text chyby. Heslo ani přihlašovací údaje neposílej."
        ])
      })
    ]),
    note: "Chceš znát konkrétní mechaniku? Najdeš ji v O hře. Pravidla pre-alpha se průběžně vyvíjejí."
  }),
  terms: Object.freeze({
    eyebrow: "PRAVIDLA SPOLEČNÉ HRY",
    intro: "Empire Streets je v pre-alpha. Hraním přijímáš testovací povahu hry a následující pravidla.",
    sections: Object.freeze([
      Object.freeze({
        title: "01 / Tvůj účet",
        paragraphs: Object.freeze([
          "Hrát můžeš od 16 let. Odpovídáš za správné registrační údaje, bezpečí hesla a aktivitu na svém účtu.",
          "Účet nesdílej a nepoužívej ho k obcházení limitů, trestů, ochran ani pravidel serveru."
        ])
      }),
      Object.freeze({
        title: "02 / Hra ve vývoji",
        paragraphs: Object.freeze([
          "Funkce, pravidla, ekonomika, obsah i dostupnost serverů se mohou měnit bez upozornění. Kvůli bezpečnosti a vývoji může dojít k opravě, vrácení nebo smazání postupu.",
          "Nepřetržitý provoz ani zachování serverů, výsledků, žebříčků či předmětů nejsou zaručené. Herní měny a předměty nemají skutečnou peněžní hodnotu."
        ])
      }),
      Object.freeze({
        title: "03 / Hraj fér",
        items: Object.freeze([
          "Nezneužívej chyby, neautomatizuj hraní bez povolení, neútoč na infrastrukturu a neobcházej omezení serveru.",
          "Nesdílej nezákonný, výhrůžný či nenávistný obsah ani cizí osobní údaje. Nevydávej se za někoho jiného.",
          "Nalezenou chybu bezpečně nahlas. Nešiř návody, které mohou poškodit účty, data nebo test."
        ])
      }),
      Object.freeze({
        title: "04 / Moderace a odchod",
        paragraphs: Object.freeze([
          "Při porušení pravidel nebo ohrožení hry či hráčů může provozovatel skrýt obsah, omezit funkce, pozastavit účet nebo ukončit účast. O ukončení svého testovacího účtu můžeš požádat kdykoli.",
          "Podmínky se mohou během vývoje měnit. Podstatnou změnu budeš při dalším vstupu znovu přijímat."
        ])
      })
    ]),
    note: "Tyto podmínky platí pro testovací pre-alpha. Nejde o nabídku placené služby ani finální obchodní podmínky."
  }),
  privacy: Object.freeze({
    eyebrow: "TVOJE SOUKROMÍ V ULICÍCH",
    intro: "Údaje potřebujeme pro tvůj účet, uložení hry a bezpečný provoz. Neprodáváme je ani je nepoužíváme k cílené reklamě.",
    sections: Object.freeze([
      Object.freeze({
        title: "Co ukládáme",
        items: Object.freeze([
          "Účet: přezdívku, jméno gangu, datum narození pro ověření 16+ a bezpečný otisk hesla. Samotné heslo neukládáme v čitelné podobě.",
          "Provoz: přihlášení, účtové a herní relace, členství na serveru, bezpečnostní a chybové záznamy i omezené síťové identifikátory proti zneužití.",
          "Hru: postup, districty, ekonomiku, akce, zprávy, market, bounty, aliance, žebříček a výsledky."
        ])
      }),
      Object.freeze({
        title: "Proč a kdo je vidí",
        paragraphs: Object.freeze([
          "Díky údajům můžeme vést a chránit tvůj účet, ověřit věk, provozovat multiplayer, ukládat postup, opravovat chyby a řešit podvody či útoky.",
          "Ostatní hráči mohou vidět jméno gangu, tvé districty, aliance a výsledky. Datum narození, heslo a údaje o přihlašovací relaci veřejné nejsou."
        ])
      }),
      Object.freeze({
        title: "Kde a jak dlouho",
        paragraphs: Object.freeze([
          "Data zpracovávají hostované služby pro web, běh hry a databázi. Přístup mají zabezpečené administrátorské role podle provozní potřeby.",
          "Testovací data uchováváme po dobu pre-alpha a nezbytnou dobu pro bezpečnost, obnovu a řešení incidentů. Při resetu můžeme odstranit nepotřebné účty a záznamy."
        ])
      }),
      Object.freeze({
        title: "Co máš pod kontrolou",
        items: Object.freeze([
          "Můžeš požádat o přístup k údajům, jejich opravu nebo odstranění účtu a osobních údajů, pokud uchování nevyžaduje bezpečnostní či právní důvod.",
          "Napiš provozovateli na kontakt z pozvánky nebo oficiálního oznámení testu.",
          "Používej unikátní heslo. Hesla, cookies, přihlašovací tokeny ani jiné přístupové údaje nikomu neposílej."
        ])
      })
    ]),
    note: "Před veřejným spuštěním doplníme úplnou identifikaci správce, kontakt a přesné lhůty uchování dat."
  })
});
