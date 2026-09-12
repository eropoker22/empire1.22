# Audit hráčského UI, aliancí a City Events — 12. 9. 2026

Větev `fix/player-feedback-18`, doplnění PR #5. Žádné sloučení, nasazení, SQL migrace ani reset her.

## Potvrzené nálezy a změny

| Oblast | Nález | Oprava |
| --- | --- | --- |
| Bytový blok | Výsledek náboru obsahoval nadbytečný District. | Budova a Noví členové ve dvou sloupcích, v obou cestách výběru. Samostatný styl se při dalším výsledku odstraní. |
| Alianční chat | Delegovaný klik na `[data-alliance-tab]` zasahoval i obal modalu. Klik do vstupu ho znovu vytvořil. Totéž dělal každý serverový snapshot. | Přepínání pouze skutečnými tlačítky; při aktualizaci zachován vstup, kurzor, fokus a rozepsaná zpráva. |
| Alianční chat | Dokončení předchozího odeslání mazalo další rozepsanou zprávu. | Vymaže se pouze odeslaný text ve stejné hráčské relaci a alianci; změna identity nebo aliance oddělí koncepty. Enter během IME kompozice neposílá zprávu. |
| Server aliance | Historický záznam členství mohl povolit psaní, i když neodpovídal aktuální alianci či seznamu členů. | Stejná kontrola aktuálního členství jako u čtení: hráč, aliance, seznam členů, stav a identita členského záznamu. |
| Aktivita aliance | Text sliboval automatické vyloučení po neaktivitě. | Text odpovídá pravidlům: leader může zahájit hlasování. |
| HEAT | Platba se spouštěla jedním kliknutím; mobilní informace byly nepřehledné. | Modré průhledné potvrzení všech tří metod. Cena, skutečné snížení a případná pokuta/riziko ze serverové projekce; nová potvrzená nabídka je před odesláním znovu ověřena. Změněné podmínky vyžadují nové potvrzení. Nedostupná projekce nedovolí platbu. |
| Mobilní HEAT | Úroveň, ochrana a riziko zabíraly více řádků; ceny se tísnily vedle sebe. | Tři souhrnné údaje v jednom řádku; samostatný řádek pro každou metodu, cena/snížení nad rizikem a čekáním. |
| City Events | Čekající odměny se skryly za zavřeným či uzamčeným kontaktem. | Vyzvednutí viditelné hned při otevření i u zavřeného/uzamčeného kontaktu; důvod blokace a samostatné řádky odměn. |
| City Events | Po neúspěšném požadavku zůstávalo tlačítko Začít zamčené. | Obnovení dostupnosti po skončení požadavku; zachován zákaz souběžného odeslání. |
| City Events | Server podporoval vstupní cenu, ale projekce ji nezobrazovala a neověřovala dostupné prostředky. | Projekce ceny a dostupnosti, vysvětlení ceny v detailu. Současných 300 definic zůstává bez vstupního poplatku. |
| City Events | Délka v UI se mohla změnit podle novější definice; při dorovnání ticku zmizely výsledkové události. | Délka z přijatého snapshotu; výsledkové události se připojí k událostem příkazu. |
| City Events | Při chybějícím účtu zdrojů se dokončená odměna ztratila. | Peníze a předměty zůstanou čekat; vliv se připíše vlastnímu districtu, je-li dostupný. |
| Konfigurace | NaN/Infinity, prázdný rozvrh či záporná vstupní cena mohly projít validací. | Kontroly konečných hodnot, nezáporných částek a jedinečných neprázdných termínů obnovy. |
| Městský market | Příliš hranaté karty a málo odlišená tlačítka. | Tmavě modré karty, tyrkysový nákup, modrý prodej, kulatější rohy a viditelný fokus; ovládání alespoň 44 px. |
| Mobilní onboarding | Geometrie nereagovala na posun/změnu viewportu; opakované vykreslení znovu scrollovalo. | Přeměření zvýraznění při scrollu a resize včetně visualViewport; scroll k cíli pouze při vstupu do kroku. Kompaktní panel u spodní hrany, vlastní scroll a dostupná tlačítka. |

## Odměny a herní smysl

Prověřeno všech 300 definic (100 na kontakt), rozvrhy, limity vlivu, jeden souběžný běh, jeden pokus na nabídku, strategická nabídka, expirace, dokončení při rotaci a přesah skladové kapacity. Přijaté běhy zachovávají svůj snapshot i po změně katalogu.

Náročné zakázky měly často nižší ekonomickou návratnost než snadné: medián odhadované hodnoty za hodinu byl 1 320 oproti 3 969 u snadných. U 24 náročných zakázek Victora je doplněna peněžní složka, aby materiální/peněžní hodnota byla alespoň 3 500, stále pod existujícím limitem 4 000. Předměty, vliv, pravděpodobnosti, délky a rizika zůstávají zachovány. Náročná varianta tak lépe kompenzuje delší čekání a riziko; vzácné zakázky zůstávají omezeným zdrojem strategických předmětů.

| Obtížnost | Počet | Hodnota odměny po úpravě | Medián odhadu hodnoty/h |
| --- | ---: | ---: | ---: |
| Snadná | 66 | 0–1 200 | 3 969 |
| Střední | 203 | 400–2 200 | 2 896 |
| Náročná | 25 | 3 500–3 900 | 6 035 |
| Vzácná | 6 | 7 380–11 140 | 16 094 |

Metoda: cena náhrady z kanonických výrobních receptů × pravděpodobnost úspěchu, minus očekávaná ztráta dirty cash a případná vstupní cena, přepočteno na délku. Dirty a clean cash jsou pro tento orientační výpočet oceněny 1:1. Nejde o výnos z prodeje na marketu; vliv, HEAT, vzácnost a skladová kapacita nejsou převedeny na peníze. Nulová materiální hodnota snadné zakázky znamená odměnu pouze ve vlivu. Výpočet lze zopakovat přes `node node_modules/vite-node/vite-node.mjs tools/debug/src/city-event-audit/report.ts`.

## Ověření

- Lokálně 122/122 testů ve 13 cílených souborech: skutečné DOM události chatu, potvrzení všech metod HEAT, obnovení po chybě, dostupnost odměn, onboarding, validace katalogu, snapshoty zakázek a alianční pravidla.
- Serverový test používá tři skutečné herní relace přes reserve/join/load/submit. Ověřuje doručení soukromé zprávy členovi, soukromí vůči cizímu hráči, zákaz padělání playerId, idempotenci zprávy a odebrání přístupu po odchodu.
- Existující alianční regrese ověřují vytvoření, souhlas s pozvánkou, souběh posledního místa, max. čtyři členy, aktivitu/grace/hlasování, předání vedení, zrušení hlasování, rozpuštění, postihy a příměří.
- Typecheck, lint/architekturní kontroly a generování browser konfigurace prošly.
- Přidány Chromium scénáře pro HEAT, nábor a market (320×568, 393×852) a onboarding (320×568, 360×740, 393×852). Výsledek CI bude doplněn po běhu.
- Místní prohlížečový náhled blokuje přístup na localhost. Fyzický iPhone/WebKit a živý PostgreSQL nebyly v této dávce ověřeny.
