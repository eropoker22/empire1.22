# Druhý hluboký audit hry — 12. 9. 2026

Navazuje na `9ff5e0304cef68883ee4bbb1b78b4c27a5ab6c93` ve větvi `fix/player-feedback-18`, PR #5. Audit se zaměřuje na zachování peněz a předmětů, identitu operací, ceny, finanční akce, časování a pravdivost serverových projekcí. Bez sloučení, nasazení, SQL migrace nebo resetu her.

## Prokázané nálezy a opravy

| # | Nález | Výsledné chování |
| --- | --- | --- |
| 1 | ID bazarové nabídky používalo délku seznamu. Po stažení a vystavení ve stejném okamžiku se mohlo zopakovat a následné stažení odstranit více nabídek. | Trvalý čítač, obnova ze starších ID; stažené ID se znovu nepoužije. |
| 2 | Limit historie 120 obchodů ořezával také aktivní nabídky obsahující uschované předměty. | Aktivní nabídky se nekrátí limitem historie. Test 130 nabídek ověřuje vrácení všech předmětů právě jednou. Limit pěti aktivních nabídek na hráče zůstává. |
| 3 | Po naplnění historie se opakovala ID transakcí a zastavil se čítač použitý při losování kontrol. | Samostatný trvalý čítač transakcí; ořez historie nezastaví identifikátory ani vstup losování. |
| 4 | Běžný příkaz a projekce marketu neměly aktuální konfiguraci budov a dne/noci. Bonusy letiště či charteru se v této cestě neuplatnily. | Nákup, prodej, projekce a tick používají stejnou konfiguraci. Do snapshotu se pomocná konfigurace neukládá. Ověřena skutečně zaplacená cena i celní HEAT. |
| 5 | Černý market násobil plný zásah burzy i jeho menší podíl pro černý trh. | Zásah se aplikuje jednou podle zvoleného trhu. |
| 6 | Cenový výpočet sčítal kanonický policejní HEAT a jeho starší kopie na hráči. | Jeden hráčský HEAT se počítá jednou; lokální HEAT districtů zůstává samostatný. |
| 7 | Staré události bez absolutního timestampu ovlivňovaly „nedávné násilí“ trvale; stejná událost mohla být započtena ze dvou úložišť. | Použije se serverový tick události, časové okno a deduplikace podle ID. Nové zrcadlené marketové události sdílejí ID. |
| 8 | Platný začátek času 0 se přepisoval aktuálním časem a oddaloval doplnění skladu i cenovou historii. | Nula je platný časový bod. |
| 9 | Pouhé vytvoření marketového read modelu měnilo autoritativní objekt hry. | Projekce pracuje s kopií; čtení nemění peníze, inventář ani marketový stav. |
| 10 | Úklid staré operace mazal také novější cooldown, districtový zámek či slot špiona a mohl zasáhnout nové členství hráče. | Uvolní se jen odpovídající termín rezervace a mise ve stejném členství. Pozdější rezervace zůstávají. HEAT špionáže je nadále až při dokončení. |
| 11 | Budovy slibovaly slevy či přirážky k obchodním provizím, které se vůbec neúčtují. Související postih mohl být bez účinku. | UI a marketová projekce uvádějí provizi 0 %. Skutečné cenové slevy centra a letiště zůstávají. Vyšetřování burzy dočasně blokuje její placené akce; omezení centrální banky blokuje likviditní injekci. Doba postihu zůstává podle existujícího serverového termínu. Zamítnutí nic neúčtuje a na hranici expirace se akce obnoví. |
| 12 | Banka uváděla maximální úrok za jeden serverový tick místo za úrokový interval. | Limit je označen skutečným intervalem, např. 10 minut. Výše a frekvence úroku se nemění. |
| 13 | Finanční karty převáděly zbývající čas výchozími 10 sekundami za tick i při jiné konfiguraci. | Doby charteru, omezení, intervencí a dalších efektů používají skutečné `tickRateMs`. Testy 1, 5 a 10 sekund za tick. |
| 14 | Kumulované riziko auditu kasina se mohlo zobrazit nad 100 %. | Pravděpodobnost je omezena na 0–100 %, stejně pro výpočet i zobrazení. |
| 15 | Market přidával kanonický HEAT bez přepočtu uložené úrovně hledanosti. | HEAT a wanted level se aktualizují společně. |

Starší konfigurační hodnoty a názvy polí pro provize zůstávají kvůli kompatibilitě snapshotů. Nevzniká nová obchodní daň ani sleva z celé ceny místo neexistující provize. Datum finančního omezení se využívá pro skutečný postih a UI ukazuje jeho zbývající čas.

## Ověření

- Závěrečný cílený běh: **215/215 testů v 18 souborech**. Zahrnuje 22 nových regresních případů, tržní ceny proti všem 21 výrobním receptům, nákupy/prodeje, akce budov, útoky, výrobu, City Events, dokončení operací a aliance. Dřívější průběžné počty se s tímto během překrývají.
- Nové případy prokázaly chyby před opravou; po opravě prošly. Serverový test se třemi relacemi ověřuje alianční chat, zákaz padělané identity, soukromí a odebrání přístupu po odchodu.
- Typecheck, lint, architektura, limity velikosti souborů a kontrola generované browser konfigurace prošly. Cenové testy nyní používají stejný kontext konfigurace jako skutečný příkaz a zobrazená nabídka.
- Průběžná simulace `mixed`: 3 seeds × 200 kroků × 20 hráčů; 2 123 odeslaných příkazů, 0 runtime chyb, 0 porušení invariantů, všechny tři běhy PASS.
- Průběžná simulace `conflict-fixture`: seed `audit-conflict-2026-09-12`, 100 kroků, 20 hráčů; 335 příkazů, 14 aliančních požadavků, 43 zvláštních akcí budov, 0 runtime chyb, 0 porušení invariantů, PASS.
- Tyto krátké simulace neprovedly útoky a část požadavků botů mířila na neaktuální marketové nabídky. Boj a časované operace proto ověřují samostatné integrační scénáře; simulace není dokladem vyváženosti celé dokončené partie. Odměny ani dostupnost marketu nebyly změněny kvůli neplatným požadavkům botů.
- Finální kompletní Quality CI, včetně existujících prohlížečových scénářů, je navázané na commit v PR. Aktuální stav a odkaz na běh jsou v popisu PR, aby dokumentace sama nespouštěla další kolo stejného CI.

Lokální prohlížečový náhled, fyzický iPhone/Safari a živý PostgreSQL nebyly v tomto průchodu ověřeny. Historické předměty ztracené před opravou nelze dopočítat z již odstraněných nabídek; audit žádné hráčské účty ani živá data neupravuje.
