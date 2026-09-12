# Třetí kontrola hry — bazar a letištní zásilky

Navazuje na commit `b4292887e198777af03d38027d42fdd00910f0e1` ve větvi `fix/player-feedback-18`, PR #5. Tento průchod ověřuje zejména shodu kontroly s provedenou transakcí a zachování rozpracovaného nákladu přes opakovaná dokončení.

## Prokázané nálezy a opravy

| # | Nález | Výsledné chování |
| --- | --- | --- |
| 1 | Server přijímá neprázdné ID nabídky s okolními mezerami. Nákup mezery odstraňoval, ale kontrola kapacity hledala původní ID, takže šlo překročit kapacitu skladu. | Jedno normalizované ID pro vyhledání, kontrolu a provedení. Při nedostatku místa se nezmění nabídka, peníze ani inventář. |
| 2 | Stejný rozdíl v ID potlačil oznámení prodejci i po zaplacení nabídky. | Oznámení používá kanonické ID a odpovídá provedenému nákupu. Opakovaný nákup ani stažení nevrátí peníze či předměty podruhé. |
| 3 | Čtení letištních metadat zahazovalo zásilky po termínu před jejich dokončením. Náklad mohl zmizet při obnovení staršího snapshotu nebo aktivaci letiště po odstávce. | Zaplacený náklad zůstává ve frontě až do skutečného vypořádání; opožděná zásilka se doručí právě jednou. |
| 4 | Příznak dokončené celní kontroly se neobnovoval ze snapshotu. Při plném skladu se každý další pokus znovu řídil celním losem a mohl opakovaně zabavovat náklad a přidávat HEAT. | Výsledek celnice se zachová. Čekání na kapacitu nepřidává další zabavení, kontrolu ani HEAT. |
| 5 | Záznam doručení neuváděl zabavené předměty a při dalším pokusu zapomínal již doručené množství. | Zásilka nese průběžný souhrn původního, přijatého a zabaveného nákladu. Konečný přehled zahrnuje všechny části doručení; do skladu se vždy připíše pouze aktuálně dodaná část. |
| 6 | Při dokončení několika dovozů v jednom ticku poslední iterace přepsala dřívější celní události. | Historie se průběžně doplňuje; zachovává stávající limit posledních deseti událostí. |
| 7 | Jeden výsledek pravidelné inspekce oznamoval „Zadržený kontejner“, ale neměl žádný herní účinek. | Oznamuje „Kontrola bez nálezu“. Pravděpodobnosti a skutečné postihy zůstávají stejné. |

Nové expresní dovozy se již vyřizují okamžitě. Opravy fronty chrání rozpracované importy uložené ve starších stavech hry; nevracejí nové dovozy k časovanému čekání. Nový souhrn je volitelné pole metadat kompatibilní se staršími snapshoty. Údaje o dřívějších dodávkách či konfiskacích, které starý stav již zahodil, nelze zpětně dopočítat.

## Ověření

- **158/158 cílených testů v 11 souborech**: 155 testů marketu, letiště, akcí budov a projekcí; samostatně 3 testy serverové validace marketových příkazů.
- **11 nových regresních případů**: odmítnutí překročení kapacity se standardním i obaleným ID, oznámení a opakované transakce, opožděná zásilka, neaktivní letiště, uchovaný celní výsledek, úplné i částečné zaplnění skladu, kumulativní přehled, několik zásilek v jednom ticku a úplné zabavení jedné položky. Hlavní vady byly reprodukovány před opravou.
- Typecheck, lint, architektura, limity souborů a kontrola generované konfigurace prošly.
- Kompletní Quality CI je navázané na commit v PR. Aktuální odkaz a výsledek jsou v popisu PR. Existující E2E ověřují hlavní herní tok; pro samotné krajní případy skladu slouží výše uvedené serverové regrese.

Tento průchod neověřoval fyzický iPhone/Safari ani živý PostgreSQL. Neobsahuje SQL migraci, změnu živých hráčských dat, sloučení nebo nasazení. Přezdívka útočníka v districtu i HEAT špionáže účtovaný až při dokončení zůstávají zachovány.
