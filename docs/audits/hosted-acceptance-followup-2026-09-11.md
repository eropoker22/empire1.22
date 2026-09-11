# Navazující opravy Hosted Acceptance — 11. 9. 2026

Tento záznam doplňuje původní [release report](closed-test-release-2026-09-11.md). Vlastník následně výslovně povolil sloučení PR #4 do main a vydání pouze na staging přes existující režim `owner-current-main`, s vědomím neúspěšné úplné Hosted Acceptance. Definice CI bran, limity frakcí a kapacity ani produkční release postup se nemění.

Diagnostický běh [34562927567](https://github.com/eropoker22/empire1.22/actions/runs/34562927567) používá SHA `01c32d3653cae7745870aed47e7701760da51867`. Na GitHub runneru běží skutečný PostgreSQL 16, API, worker a Chromium. Výsledky tohoto staršího SHA nejsou výsledky opraveného následníka.

| Nález | Vypořádání |
|---|---|
| Manuální vytvoření serveru skončí na `TEST_CLOCK_INSTANCE_BINDING_REQUIRED` | Test sváže povolené řízené hodiny s ID právě vytvořeného a ověřeného izolovaného serveru. Po testu původní vazbu obnoví. Ochrany hodin se zachovávají. Součást předchozího následného commitu `09ed8b5`. |
| Market nelze v testu zavřít přes oznámení první očisty | Pomocník potvrzuje viditelná serverová oznámení běžným tlačítkem před otevřením/zavřením sociální karty. Žádné vynucené kliknutí nebo skrytí překážky. Součást `09ed8b5`. |
| Přihlášení dalších hráčů čeká na zakázaného Mafiána | Sdílená příprava vybírá skutečně dostupnou frakci. Platí i pro bootstrap 20 hráčů a sociálních suites. Srovnávané demo dostává stejnou frakci v počáteční session i vykreslení. Limit čtyř zůstává. |
| Náhled ceny speciální akce ztrácí data po předání rendereru | `buildingPresentationContract` kopíruje serverový pevný a variabilní ceník a cenu vlivu. Regrese mění investici z 1 000 na 2 750 při poplatku 2 500 a ověřuje celky 3 500/5 250 plus 3 vlivu i nezávislost kopií. Serverové účtování se nemění. |
| Výrobní mobile test hlásí pouze `true/false` bez místa selhání | Diagnostika obsahuje rozměry tlačítka a skutečný překrývající element. Reporter zachovává zásobník volání se stejnou redakcí citlivých údajů. Kritéria úspěchu zůstávají stejná. Přesná příčina těchto dvou starých selhání zatím není prokázaná. |

Ve starém běhu prošly suites income, building-actions-day/night, production-armory/pharmacy, city-events a lifecycle-stop. Neúspěšné zůstaly mimo jiné parity textů/rozměrů demo versus server a pixelové porovnání potvrzení útoku. Část cen závisí na aktuálním hráčově zůstatku; rozdíl není bez shodných vstupů důkaz chybného účtování. Celé texty ani numerické odměny proto nejsou odstraněny z porovnání jen kvůli zelenému výsledku.

Lokální navazující ověření: Node 24.19.0, 76 testů ve čtyřech souborech (contract 7, adapters 55, reporter 7, social modal contract 7), bez skipů a konečných selhání. Syntaxe dotčeného JavaScriptu a rozpočty souborů prošly. Testy přípravy samy o sobě nenahrazují opakovaný hosted běh. Předchozí Quality [34563724366](https://github.com/eropoker22/empire1.22/actions/runs/34563724366) má všech osm jobs úspěšných na `09ed8b5`, nezahrnuje tento následný patch.

Žádná SQL migrace, reset serveru nebo změna uložených her není součástí tohoto následného patche. V době jeho přípravy zůstává nasazený staging na `ca7f6069bbe3cecfc3e3418b5e9428928de7ed39`. Úspěšné nasazení musí doložit samostatný staging workflow a shodné SHA frontend/API/workeru. Tento dokument není potvrzení úplné akceptace ani výkonového testu 20 současných sessions.
