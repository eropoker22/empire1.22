# game.html — audit zbytečné práce klienta

Datum: 11. 9. 2026. Větev: `fix/closed-test-release`.

Výchozí verze: `62915c4be5983c14c20096faf6633b4927cd20bb`.
Opravný commit: `f1283b3f3513406ffc50292d27509fd1a31e859b`.

**Výsledek:** opravená prokazatelně zbytečná práce při vykreslování mapy a opakovaných aktualizacích textů. Změny jsou lokální, otestované a commitnuté. Nejsou pushnuté, sloučené ani nasazené. Tento audit neuděluje nové potvrzení provozní připravenosti celého vydání.

## Rozsah a závěr

Požadavek byl snížit zatížení klienta a zahřívání telefonu bez snížení kvality grafiky. Kontrola sledovala `pages/game.html`, jeho skutečný mapový runtime, plánování canvasu, značky operací a opakované zápisy do DOM.

Používaná cesta mapy je `bindDistrictCanvas` v `page-assets/js/app/runtime.js`. Samostatný `serverMapPresentationController` není do tohoto spuštění stránky zapojen; pouze jeho optimalizace by aktuální hře nepomohla. Oprava je proto přímo v používaném runtime.

Nejvýznamnější doložené plýtvání: mapa pokračovala v práci i po odscrollování mimo obrazovku. Při aktivní operaci běžela také její animační smyčka. Stránka přitom zůstává viditelná, takže samotná kontrola `document.hidden` tento stav nezachytí.

To je konkrétní příležitost k úspoře při čtení spodních částí hry. Bez měření na zařízení však nelze tvrdit, že jde o jedinou nebo hlavní příčinu nahlášené teploty, ani uvést procento úspory celého procesoru.

## Opravené nálezy

| Nález | Původní chování | Oprava a zachované chování |
| --- | --- | --- |
| Mapa mimo obrazovku | Odscrollování nezastavilo canvas ani smyčku aktivních misí. | `IntersectionObserver` sleduje skutečný viewport mapy. Neviditelná mapa přestane kreslit; po návratu obnoví aktuální stav. Serverová data a čas operací pokračují. |
| Již naplánované překreslení | Snímek naplánovaný před odscrollováním mohl stále kreslit. | Plánovač kontroluje viditelnost i při provedení snímku. Uchová seznam změněných vrstev pro návrat. |
| Časově skončená operace ve staré projekci | Animační smyčka rozhodovala podle přítomnosti značky. Při opožděné aktualizaci mohla běžet dál, i když její termín již uplynul. | Po posledním snímku se smyčka zastaví, pokud nezbývá žádný živý efekt. Značka a autoritativní data se nemažou a klient nerozhoduje o výsledku mise. Efekty bez koncového času, například pasti, si zachovávají animaci. |
| Nadbytečná příprava celé mapy | Synchronizace značek při animaci přibližně jednou za sekundu sestavovala celý prezentační model včetně údajů districtů a jejich JSON otisků; použila jen jeho efekty. | Nový `createServerMapEffectsModel` připraví přímo efekty stejným původním výpočtem. Tato cesta už nečte seznam districtů. Plná projekce zůstává dostupná tam, kde je potřeba. |
| Nezměněné odpočty | Každá aktualizace znovu nahrazovala textový uzel a zapisovala atribut stavu, i když zobrazená hodnota zůstala stejná. | DOM se mění jen při změně textu nebo stavu. Sekundové odpočty i přechod na „Připraveno“ se nadále aktualizují. |
| Nezměněné frakční bonusy | Opakované stejné projekce znovu zapisovaly text, viditelnost a tooltip. | Zápisy probíhají pouze při změně hodnot. Nové prvky a změna bonusu se vykreslí normálně. |

Dotčené implementace:

- `page-assets/js/app/runtime.js`
- `page-assets/js/app/map/mapViewportVisibility.js`
- `page-assets/js/app/map/mapRenderScheduler.js`
- `page-assets/js/app/map/serverMapPresentationModel.js`
- `apps/client/src/shared-ui/live-cooldown.ts`
- `page-assets/js/app/faction-passive-ui.js`

## Důkaz změny chování

Pro porovnání byly čtyři dotčené implementace — runtime, plánovač, odpočty a frakční UI — dočasně nahrazeny jejich verzemi z výchozího commitu. Po diagnostice byly připravené opravy obnoveny. Pět kontrol správného chování na původních implementacích selhalo, šest ostatních prošlo. Nejde o pět nových herních chyb; několik kontrol ověřuje různé části stejného problému.

| Kontrolovaný případ | Původní implementace | Opravená implementace |
| --- | --- | --- |
| Odscrollovaná mapa s aktivní misí, jedna kontrolovaná aktualizace | 235 volání zachycených metod canvasu | 0 |
| Odscrollovaná mapa bez mise, stejná kontrola | 1 volání zachycené metody canvasu | 0 |
| Snímek plánovače zařazený před odscrollováním | Renderer byl zavolán | Renderer nebyl zavolán, změněné vrstvy zůstaly uložené |
| 60 stejných vykreslení jednoho frakčního bonusu | 120 DOM mutací | 0 |
| Aktualizace dlouhého odpočtu během stejné zobrazené minuty | Textový uzel byl opakovaně nahrazen | Původní uzel zachován, 0 DOM mutací |

Jde o deterministické testy v jsdom s náhradou Canvas API, RAF a oznámení viditelnosti. **235 volání neznamená 235 snímků ani naměřenou hodnotu FPS.** Výsledky dokazují odstranění konkrétních operací, nikoli procentuální pokles spotřeby zařízení.

Test skutečného `bindDistrictCanvas` načítá HTML hry a autoritativní testovací projekci. Ověřuje mapu s misí i bez ní, odscrollování, aktualizaci mimo obrazovku, návrat ze skryté záložky při stále odscrollované mapě, návrat k mapě, opakované oznámení stejné viditelnosti a odpojení observeru při opuštění stránky. U mise navíc posune čas za její konec a ověří ukončenou RAF smyčku při zachovaném serverovém záznamu.

Regrese přípravy efektů úmyslně zakáže čtení `slice.districts`; lehčí cesta přesto vrací stejné efekty včetně soukromí špionáže a aktualizovaného odpočtu.

## Závěrečné ověření

Node: `v24.19.0`. Celkem **70 úspěšných testů ve 12 souborech**, bez selhání a bez přeskočení: hlavní cílený běh 66 testů v 11 souborech a samostatný běh čtyř testů značek misí. Jde o nepřekrývající se soubory. Starší testy předchozích oprav se k tomuto počtu nepřičítají.

| Testovací soubor v `tests/unit/` | Počet |
| --- | ---: |
| `game-map-viewport-runtime.test.js` | 2 |
| `game-dom-idle-work.test.js` | 3 |
| `map-render-scheduler.test.js` | 6 |
| `server-map-presentation-model.test.js` | 6 |
| `faction-passive-ui.test.js` | 4 |
| `client/live-cooldown.test.ts` | 3 |
| `runtime-map-rendering.test.js` | 13 |
| `mobile-performance-mode.test.js` | 4 |
| `standalone-gameplay-runtime-lifecycle.test.js` | 2 |
| `runtime-main-flow-smoke.test.js` | 13 |
| `runtime-refactor-guard.test.js` | 10 |
| `runtime-map-mission-markers-view-model.test.js` | 4 |

Dále prošly:

- `npm run typecheck`
- `npm run build:client:page`
- `node scripts/build-netlify-client.mjs` — pouze místní příprava klientského výstupu
- `node scripts/check-architecture.mjs`
- `node scripts/check-file-sizes.mjs`
- `git diff --check`

V generovaném klientském výstupu je přítomen import nového observeru i přímé vytváření efektů v používaném runtime.

## Vzhled, limity a vydání

Nebyly změněny CSS, obrázky, rozlišení canvasu, DPR, barevnost, efekty ani dosavadní limity snímků. Na obrazovce zůstává plná kvalita. Není změněn tick serveru ani interval síťového načítání. Nejsou změněna herní pravidla, databáze, snapshoty nebo vyplácení výsledků.

Observer zjišťuje průnik mapy s viewportem, nikoli překrytí jiným prvkem. Mapa za průhledným dialogem tak může nadále animovat. Viditelná grafika stále spotřebovává výkon; tento audit neslibuje odstranění veškerého zahřívání při zachování všech efektů.

Prohlížečové měření lokální stránky zablokovala bezpečnostní politika přístupu cloudového prohlížeče. Omezení nebylo obcházeno. Nové browserové E2E, GPU profil, měření teploty ani test na fyzickém telefonu neproběhly. Testy jsdom nejsou Chrome, WebKit ani skutečný iPhone.

Při pozdějším společném vydání je vhodné porovnat stejnou herní situaci na stejném telefonu: viditelnou mapu s misí, odscrollování ke zprávám a návrat. Ověřit i změnu výšky lišt prohlížeče. Procento celkové úspory nebo pokles teploty lze uvést až z takového měření.

**Stav vydání:** lokální oprava a ověření dokončeny; push, aktualizace PR, sloučení a nasazení této opravy neprovedeny podle pokynu počkat na společné vydání.
