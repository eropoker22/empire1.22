# Market Balance Notes

## Cenová filozofie

Market ceny jsou teď brané jako jednotkové alpha ceny, ne jako cena celé výrobní dávky.

- Oficiální trh má být bezpečný, stabilnější a dražší než dobrá vlastní výroba.
- Černý trh má být rychlá cesta k síle, ale s prémií za riziko, heat a vzácnost.
- Hráčský bazar zůstává local/session preview. Doporučené price rules jsou pouze dokumentace pro budoucí server.
- Buy multipliery, variance, stock chování, heat výpočty, item efekty a craft recepty se neměnily.
- Post-balance audit upravil pouze lokální `black-market.sellMultiplier`, aby local/session preview nefungovalo jako nekonečný dirty-cash fence.

## Oficiální trh

Oficiální trh drží základní materiály a produkční komponenty. Ceny jsou nastavené tak, aby:

- začátečník mohl doplnit malé množství zásob,
- vlastní výroba měla pořád ekonomický smysl,
- tech komponenty nebyly levný shortcut do mid/late-game,
- prodej zpět do trhu nevytvářel jednoduchý buy/sell exploit.

Aktuální local fallback používá `buyMultiplier: 1.12` a `sellMultiplier: 0.92`. Server market má vlastní base prices a autoritativní výpočet.

## Černý trh

Černý trh drží drogy, boosty a citlivou výzbroj. Ceny mají vyšší premium podle:

- PvP síly,
- výrobního řetězce,
- rarity,
- heat/risk profilu,
- late-game dopadu.

Aktuální local fallback používá `buyMultiplier: 1.32`, `sellMultiplier: 0.01` a vyšší variance. Nízký výkup je záměrná anti-arbitrage pojistka pro preview režim; server-authoritative black market výkup dnes stejně nepodporuje. Heat thresholdy a speciální black-market chování zůstaly beze změny.

## Hráčský bazar

Hráčský bazar nebyl přepsaný na produkční marketplace. Zůstává local/session preview se stejnými listingy, limity, TTL, clean/dirty měnou a dirty heat chováním.

Doporučení pro budoucí server-authoritative pricing:

- price floor pro běžné zboží: 75-85 % aktuální server reference,
- price ceiling pro běžné zboží: 180-220 % aktuální server reference,
- price ceiling pro vzácné kontrabandy: až 300 % podle heat/risk a scarcity,
- dirty listingy by měly mít vyšší fee nebo heat audit,
- seller payout, fees a listing expiry musí počítat server.

## Item tiery

| Tier | Položky | Logika |
| --- | --- | --- |
| T1 | Chemicals, Biomass | Early-game vstupy, nízké PvP riziko, vysoký obrat. |
| T2 | Metal Parts | Běžný combat/factory materiál, důležitý pro armory. |
| T3 | Stim Pack, Neon Dust, Pulse Shot, Velvet Smoke, Pistole | Mid-game látky, komponenty a entry zbraně. |
| T4 | Tech Core, Ghost Serum, SMG | Vzácnější výrobní komponenty a silnější PvP výzbroj. |
| T5 | Overdrive X, Bazuka | Late-game komponenta a těžká výzbroj s vysokou hodnotou. |

## Změněné ceny

Legacy/local fallback jednotkové ceny v `packages/game-config/src/legacy-page/economy-config.js`:

| Položka | Původně | Nově | Důvod |
| --- | ---: | ---: | --- |
| Chemicals | 360 | 19 | Původní hodnota odpovídala dávce, ne jednotce; nový price chrání early craft a market doplnění. |
| Biomass | 320 | 22 | Přiblížení jednotkové hodnotě, aby materiál nebyl nesmyslně drahý. |
| Stim Pack | 780 | 108 | Mid-tier komponenta má být dostupná, ale dražší než dobrá výroba. |
| Metal Parts | 540 | 52 | Materiál pro combat/factory nesmí blokovat early hru, ale má držet hodnotu. |
| Tech Core | 980 | 240 | Vzácný komponent zůstává drahý, ale ne mimo dosah alpha ekonomiky. |
| Neon Dust | 2600 | 220 | Black-market drug má být rychlý kontraband, ne nedosažitelný luxus. |
| Pulse Shot | 3050 | 340 | Cena reflektuje Stim Pack input a risk premium. |
| Velvet Smoke | 3800 | 410 | Mid-risk droga, důraz na černý trh, ne na extrémní price wall. |
| Ghost Serum | 5100 | 780 | Strategická komponenta spotřebovávaná protokoly Ghost Network a Tactical Grid. |
| Overdrive X | 7200 | 1250 | Strategická komponenta spotřebovávaná protokoly Industrial Overdrive a Tactical Grid. |
| Pistole | 2500 | 760 | Entry firearm nad craft cestou, ale ne absurdně drahý. |
| SMG | 5600 | 2200 | Silnější PvP zbraň s citelnou prémií. |
| Bazuka | 13200 | 6800 | T5 destruktivní item zůstává výrazně late-game. |

Server resource base prices v `packages/game-core/src/rules/market/market-config.ts`:

| Resource | Původní base | Nový base | Původní black markup | Nový black markup | Důvod |
| --- | ---: | ---: | ---: | ---: | --- |
| metalParts | 18 | 58 | 1.35 | 1.45 | Server cena sladěná s významem armory/factory materiálu. |
| techCore | 85 | 270 | 1.55 | 1.70 | Tech core je rare component pro mid/late-game. |
| chemicals | 28 | 22 | 1.45 | 1.55 | Chemicals zůstávají early vstup, ale black markup přidává risk premium. |
| biomass | 16 | 25 | 1.30 | 1.42 | Biomass dostává vyšší alpha hodnotu kvůli drug-chain poptávce. |

## Proč byly ceny změněné

Původní legacy market ceny míchaly jednotkové položky s cenami výrobních dávek. To dělalo běžný market příliš drahý pro základní materiály a černý trh příliš vzdálený pro alpha test.

Nová sada cen:

- odděluje early, mid a late-game položky,
- dává černému trhu jasný premium/risk pocit,
- drží Tech Core, SMG, Overdrive X a Bazuku jako vysokohodnotné položky,
- snižuje šanci, že hráč bude ignorovat výrobu kvůli extrémně levnému nákupu,
- zachovává buy-side ekonomiku a po auditu přidává nízký local black-market fence payout proti craft/sell exploitu.

## Rizika exploitu

- Je potřeba sledovat rozdíl mezi local fallback a server market cenami, hlavně u materiálů.
- Pokud hráči najdou craft loop, kde nákup vstupů a prodej výstupů generuje jistý zisk bez rizika, server price rules musí přidat floor/ceiling a fee.
- Černý trh může být moc silný, pokud dirty cash v alpha poteče rychleji než heat tlak.
- Hráčský bazar bez server autority nelze používat jako produkční ekonomiku.
- Airport shipment unit values zůstaly mimo tento sprint beze změny; před produkcí je potřeba zkontrolovat vztah k market cenám.

## Co sledovat v alpha testu

- Co hráči kupují nejčastěji.
- Co nikdo nekupuje.
- Jestli je černý trh příliš levný vzhledem k heat risku.
- Jestli je oficiální trh příliš silný proti vlastní výrobě.
- Jestli výroba dává ekonomický smysl pro pharmacy, lab, factory a armory.
- Jestli existuje nákup/prodej/craft cyklus s jistým ziskem.
- Jestli hráč chápe rozdíl mezi oficiálním trhem, černým trhem a hráčským bazarem.
- Jestli bazar preview působí jako budoucí zajímavá funkce, ne jako rozbitý backend.
- Jestli hráči omylem likvidují zboží na černém trhu.
- Jestli chápou, že black-market výkup je extrémně nevýhodný.
- Jestli se ptají, proč dostali za výkup tak málo.
- Jestli by nebylo lepší black-market sell v preview úplně zakázat.
- Jestli černý trh plní roli drahého rizikového nákupu, ne férového výkupu.

## Post-balance audit

Audit proběhl po cenovém sprintu pouze nad Market/Bazar ekonomikou. Nebyly měněné gameplay systémy, craft recepty, combat síla, storage keys, server commandy, taby ani item názvy.

Závěr:

- Oficiální trh je u základních materiálů dražší než legacy pharmacy batch výroba.
- Přímý buy/sell flip na oficiálním trhu je ztrátový.
- Server normal market má sell cenu pod nákupní cenou při současných discount limitech.
- Server black market je dražší než normal market díky `blackMarketMarkup`, rizikovému faktoru a dirty-cash payment multiplieru.
- Local/session black market měl příliš vysoký výkup pro craftované drogy a zbraně; to bylo opraveno config změnou.

## Zkontrolované riziko arbitrage

Zkontrolované scénáře:

- Nákup v official marketu a okamžitý prodej zpět: ztrátový.
- Nákup v black marketu a okamžitý prodej zpět: po opravě silně ztrátový v local fallbacku; server black sell nepodporuje.
- Nákup surovin, craft a prodej kontrabandu do local black marketu: před auditem rizikové, po opravě na základních cenách ztrátové.
- Dynamic variance scénář s levnými official vstupy a drahým black-market výkupem: po snížení local black sell multiplieru už není jednoduchý Neon Dust flip výhodný.
- Player bazaar preview demo listingy a následný prodej do black marketu: po opravě local black sell multiplieru ztrátové.
- Vlastní player bazaar listing/cancel flow: nevytváří cash, pouze vrací položku do skladu.

## Zkontrolované sell/buy ratio

Local fallback:

| Tab | Buy multiplier | Sell multiplier | Audit |
| --- | ---: | ---: | --- |
| Official market | 1.12 | 0.92 | Přímý flip je ztrátový, ale sell ratio je vyšší než dlouhodobý ideál. Sledovat v alpha testu. |
| Black market | 1.32 | 0.01 | Nízký fence payout chrání preview před craft/flip exploitem. Není to produkční marketplace logika. |
| Player bazaar | 1.00 | 1.00 | Jen local/session preview listing flow; prodej vyžaduje kupujícího/listing, není to NPC výkup. |

Server market:

- `sellResource` prodává jen do normal marketu.
- Server sell multiplier je dynamický přibližně `0.55-0.72` podle přeplněnosti stocku.
- Black market server větev podporuje nákup, ne výkup.
- Současné shopping mall discounty nevytváří přímý buy/sell profit.

## Zkontrolovaný Black Market markup

Server black market cena stojí nad normal market cenou přes:

- resource `blackMarketMarkup`,
- scarcity/risk faktor,
- dirty-cash payment multiplier `1.25`,
- případný war multiplier v režimu War.

Local black market má samostatný katalog drog a zbraní. Nákupní ceny zůstaly beze změny z cenového sprintu; výkupní multiplier byl snížen pouze kvůli anti-arbitrage.

## Zkontrolovaná metadata

Metadata pokrývají všechny položky v official marketu, black marketu i player bazaar katalogu:

- `tier`
- `rarity`
- `riskLevel`
- `supplyLevel`
- `demandLevel`
- `priceBand`
- `recommendedMinPrice`
- `recommendedMaxPrice`

Nebyly nalezené chybějící metadata pro aktuální market itemy. T5 je pouze na `Overdrive X` a `Bazuka`, běžné materiály jsou T1/T2, `Tech Core`, `Ghost Serum` a `SMG` jsou vyšší tier podle hodnoty a PvP/craft dopadu.

## Nalezené rizikové itemy

- `Neon Dust`: největší riziko craft/sell exploitu, protože free-mode craft umí vyrobit 2 kusy z 1 `Chemicals`.
- `Velvet Smoke`: druhé riziko kvůli vícekusovému výstupu.
- `Pistole`: riziko u local armory outputu, pokud by black-market výkup zůstal vysoký.
- `Bazuka`: ne kvůli levnosti, ale kvůli vysokému PvP dopadu; cena a T5 metadata dávají smysl.

## Opravené ceny

Přímé item ceny se v tomto post-balance auditu neměnily.

Opravená ekonomická hodnota:

- `packages/game-config/src/legacy-page/economy-config.js`
- `MARKET_TAB_CONFIG["black-market"].sellMultiplier`
- změna `1.08 -> 0.01`

Důvod: local/session black market preview nemá být produkční NPC výkup pro craftované drogy a zbraně. Server-authoritative black market výkup už dnes není dostupný, takže tato změna sjednocuje preview s bezpečnější ekonomikou bez změny server commandů.

## Black Market sell policy

Black Market buy a sell nejsou symetrické.

Buy:

- drahý,
- rychlý,
- rizikový,
- přístup k nelegálním a vzácným věcem.

Sell:

- extrémně nevýhodný,
- pouze nouzové zbavení horkého zboží,
- ne ekonomická strategie,
- v server-authoritative MVP dnes není dostupný.

## Proč je sellMultiplier extrémně nízký

`black-market.sellMultiplier` je v local/session fallbacku nastavený na `0.01`, protože černý trh jinak vytvářel craft/sell arbitrage pro vícekusové recepty a demo/player-bazaar preview položky.

Tato hodnota není pokus o férový výkup. Je to fence payout: kontakt se zbaví horkého zboží, ale hráč za rychlost a špinavý kanál zaplatí tvrdou ztrátou.

## Jak to chrání ekonomiku

- Zavře přímé craft -> black sell dirty-cash smyčky.
- Zabrání tomu, aby hráčský bazar preview šlo použít jako zdroj falešného profitu.
- Drží black market v roli nákupního/rizikového kanálu.
- Zachovává možnost nouzové likvidace zásob bez přidání nového gameplay pravidla.

## Jak to má působit hráčsky

UI musí hráči ukázat, že nejde o běžný prodej:

- price label používá `nouzový výkup`,
- řádek má badge `nouzový výkup`,
- sell tlačítko v local black marketu používá `Likvidovat`,
- tooltip říká, že kontakt bere zboží za směšnou cenu,
- feedback po akci říká, že podsvětí kupuje levně.

Hráč má chápat větu: podsvětí kupuje brutálně levně a prodává brutálně draze.

## Co sledovat v alpha testu pro Black Market sell

- Jestli hráči omylem klikají na `Likvidovat`.
- Jestli badge a price label stačí k pochopení ztráty.
- Jestli hráči reportují výkupní cenu jako bug.
- Jestli hráči používají black-market sell jako nouzovou likvidaci, nebo se mu vyhýbají.
- Jestli bude lepší pro alpha úplně disablednout black-market sell a nechat jen nákup.

## Doporučené budoucí serverové price rules

Budoucí server by měl počítat:

- `basePrice` podle item tieru,
- `riskPremium` podle heat/police tlaku,
- `scarcityFactor` podle stocku,
- `demandFactor` podle nákupů v časovém okně,
- `craftFloor` podle výrobních vstupů a času,
- `pvpPremium` podle attack/defense síly,
- `listingFloor` a `listingCeiling` pro hráčský bazar,
- fee pro dirty listingy a podezřelé rychlé flipování.

Server má být jediný zdroj pravdy pro výslednou cenu, stock, cash, inventory a listing ownership.

## Co zůstalo beze změny

- Item názvy.
- Item efekty.
- Combat síla.
- Craft recepty.
- Market taby.
- Storage keys.
- Server commandy.
- Local/session player bazaar preview chování.
- Black market heat thresholdy.
- Cooldowny.
- Produkční DB a persistence.
- War market a avatar shop nebyly přidány.
