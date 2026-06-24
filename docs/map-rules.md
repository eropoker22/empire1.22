# Empire Streets Map Rules

## Aktivni runtime

Aktivni serverova cesta pro mapove akce je:

1. klient posle gameplay command,
2. serverova transport vrstva validuje payload,
3. instance manager provede command reservation,
4. `packages/game-core/src/engine/applyCommand.ts`,
5. command handler,
6. serverovy read-model/projection pro klienta.

Legacy browser runtime v `page-assets/js/app/*` stale existuje jako UI/runtime vrstva, ale nesmi byt zdrojem pravdy pro vlastnictvi, sousedstvi, spy, attack, occupy ani trap stav.

## Adjacency

Autoritativni sousedstvi je serverovy `District.adjacentDistrictIds` graph. Validace nepouziva pixelovou vzdalenost ani vizualni blizkost.

`packages/game-core/src/rules/map/mapActionValidator.ts` poskytuje:

- `areDistrictsAdjacent`,
- `validateMapAction`,
- vztah districtu `self | ally | enemy | empty | blocked`,
- stabilni reason codes.

`packages/game-core/src/rules/map/mapGraphValidator.ts` kontroluje:

- self-neighbor,
- duplicitni neighbor ID,
- chybejici neighbor,
- asymetricke sousedstvi.

## Matice akci

Vlastni district:

- lze spravovat,
- lze vlozit past,
- lze pouzit jako origin pro attack/occupy/rob/spy/heist,
- nelze utocit, spy ani rob proti nemu.

Spojenecky district:

- neni expanzni ani utocna hranice hrace,
- nelze pres nej attack/occupy/rob/heist/spy,
- muze byt pouzit pro budouci ally defense support pravidla.

Nepratelsky district:

- spy: povoleno, pokud sousedi s vlastnim origin districtem,
- attack/heist: povoleno, pokud sousedi s vlastnim origin districtem a splni dalsi pravidla,
- occupy/rob: zakazano.

Prazdny district:

- spy: povoleno ze sousedniho vlastniho districtu,
- rob: povoleno ze sousedniho vlastniho districtu bez spy,
- occupy: povoleno pouze ze sousedniho vlastniho districtu a po platnem success spy authorization,
- attack/heist: zakazano.

Locked/destroyed district:

- blokovany pro bezne akce.

## Reason Codes

Validator pouziva stabilni reason codes, napriklad:

- `TARGET_NOT_FOUND`
- `TARGET_NOT_EMPTY`
- `TARGET_IS_SELF`
- `TARGET_IS_ALLY`
- `TARGET_NOT_ENEMY`
- `TARGET_NOT_ADJACENT`
- `NO_VALID_ORIGIN`
- `SPY_REQUIRED`
- `DISTRICT_LOCKED`
- `VERSION_CONFLICT`

Tyto kody se maji mapovat na ceske UI hlasky v klientskem reason-code mapperu.

## Spy A Attack Authorization

Success spy vytvari serverovou authorization podle stavu targetu.

Pro nepratelsky vlastneny district:

- `targetDistrictId`,
- `targetOwnerPlayerId`,
- `targetVersionAtSpy`,
- `purpose: "attack_owned_district"`,
- `attackAuthorizationExpiresAtTick`.

Partial, failed ani critical spy attack neodemknou. Pokud district zmeni vlastnika, stara authorization neplati.

Pro prazdny district:

- `targetDistrictId`,
- `targetStateAtSpy: "empty"`,
- `targetVersionAtSpy`,
- `purpose: "occupy_empty_district"`,
- `attackAuthorizationExpiresAtTick`.

Partial, failed ani critical spy obsazeni neodemknou. Pokud se target stane vlastnenym nebo se zmeni jeho verze, authorization neplati.

## Rob A Heist

V centralnim validatoru existuji vetve:

- `rob`: prazdny neutralni sousedni district, bez spy authorization,
- `heist`: sousedni nepratelsky vlastneny district.

V aktivnim `GameCommand` unionu zatim nejsou samostatne `rob` ani moderni `heist` commandy. Existujici heist system je legacy/AnyRecord pravidlova vrstva, proto neni v tomto baliku napojen jako autoritativni command handler.

## Trap Bezpecnost

Past lze validovat pouze pro vlastni district. Past neni verejny mapovy stav a nesmi se objevit v rumor payloadu ani v beznem lobby/game read-modelu pro cizi hrace.

## Frontier

`calculatePlayerFrontier` pocita hranici z vlastnich districtu hrace:

- `open`: existuje prazdny soused,
- `allied_encircled`: hranici tvori jen spojenci,
- `hostile_encircled`: hranici tvori jen nepratele,
- `mixed_encircled`: spojenci i nepratele bez prazdneho souseda,
- `no_frontier`: bez dostupne hranice.

Obkliceni samo o sobe nema ekonomicky debuff.
