## Co zpusobovalo skakani

- Popupy pouzivaly vice ruznych scroll-lock strategii: nektere jen prepinanou tridu `game-modal-scroll-locked`, nektere vlastni `body.style.overflow`, jine zadny lock.
- Puvodni legacy overlay coordinator ukladal jen `scrollY` a po zavreni scroll obnovoval dodatecne, ale nezafixoval `body` na puvodni vizualni pozici.
- Mobilni watcher v `mobile-layout-runtime.js` mel vlastni obnovu scrollu a mohl se potkat s jinym modal stackem.
- Leaderboard, settings/profile/storage, Bounty, City events, boost/faction/info a nektere building popupy oteviraly UI primo pres `hidden`/`hidden` class bez centralniho stacku.
- District popup navic pouzival obecny helper v poradi `hidden=false` a az potom scroll lock. Na mobilu se tak stranka stihla prepocitat jeste pred zamcenim.
- District close sel obecnou cestou `unlock` pred `hidden=true`, takze se scroll obnovoval, zatimco popup mohl byt stale v renderu.
- Dalsi skok district popupu delal CSS lock: `--mobile-topbar-offset` se pri otevrenem modalu nuloval, takze mobilni layout posunul mapu nahoru o vysku topbaru.
- `body.game-modal-scroll-locked` v jedne mobilni vrstve dostaval `height: 100%`, coz u uz fixovaneho game body zmensilo layoutovou vysku a prepoctilo pozadi.

## Pridana oprava

- Pridana centralni utilita `page-assets/js/app/ui/modalScrollLock.js`.
- Pri prvnim locku uklada `scrollX`, `scrollY` a menene inline styly `html/body`.
- `body` se zamkne pres `position: fixed`, `top: -scrollY`, `left: -scrollX`, `width: 100%`.
- Scrollbar shift se kompenzuje pres `padding-right` podle aktualni sirky scrollbar.
- Unlock obnovi puvodni inline styly a vrati presny `scrollX/scrollY`.
- `legacyOverlayCoordinator` zustal hlavnim API pro popupy a pouziva novou utilitu pro cely overlay stack.
- Opakovane otevreni stejneho modalu a opakovane zavreni jsou idempotentni.
- District popup ted zamyka scroll pred odhalenim popupu a pri zavreni nejdriv popup schova, az potom odemyka body.
- District popup preskakuje automaticky focus pri otevreni, aby mobilni browser neposunul viewport na close tlacitko.
- Mobilni CSS hard guard zahrnuje i `.district-popup-shell`, aby district detail pouzival stejny fixed fullscreen overlay rezim jako velke popupy typu Market/Buildings.
- Modal lock uz nenuluje `--mobile-topbar-offset`, takze hlavni mobilni layout zustava na stejne vizualni pozici.
- `body.game-body.game-modal-scroll-locked` drzi `height: auto`, aby se pri otevreni modalu nezmensila vyska pozadi na viewport.

## Napojene popupy

- Market/Bazar, Buildings, Storage, Settings, Profile, Wanted.
- Bounty hlavni modal i potvrzovaci modal.
- Alliance modaly a runtime alliance popup.
- City events hlavni modal i detail eventu.
- Faction actions, Boost, Battle royale info, Leaderboard.
- Production building popupy, Factory, building detail popup, building upgrade confirmation a building special action confirmation.
- District/action confirmation stack zustal pres `modalHelpers`/`legacyOverlayCoordinator`.
- District detail, atmosphere window a district action modaly maji samostatne poradi lock/show a hide/unlock v `districtPopupModalHelpers`.
- Gameplay slice overlay fallback v `page-assets/js/client-assets/gameplay-slice-client.js` a `apps/client/src/modals/overlay-state.ts` byl srovnan na fixed-body lock.

## Rucne overeno

- Prosel jsem open/close handlery pro Market/Bazar, Bounty, Alliance, Faction actions, Buildings, district detail, Storage, Settings/Profile, City events a onboarding scroll helper.
- Po dodatecne kontrole district popupu jsem overil, ze jeho helper uz neodhaluje popup pred scroll lockem a neodemyka body pred skrytim popupu.
- Playwright debug overil, ze `district-canvas` zustava po otevreni district popupu na stejne vizualni pozici: top se zmenil jen zhruba o 1 px misto puvodnich cca 78 px.
- Overil jsem, ze close pres ESC/backdrop/tlacitko vola stejnou close cestu pro napojene modaly.
- Overil jsem, ze nested popupy drzi stack a unlock probiha az po zavreni posledni vrstvy.
- Targeted unit test `npm exec vitest -- run tests/unit/mobile-action-modals-css.test.js` prosel: 11/11.
- Primy Playwright audit na mobilnim viewportu overil district popup, opakovane otevreni/zavreni, scroll uvnitr district karty, nested attack popup a finalni zavreni bez vizualniho skoku mapy.
- Plny Playwright test runner pro `tests/e2e/mobile-overlay-ux.spec.js` jsem zkousel, ale po otevreni district popupu visel na Playwright locator/page-context cekani; stejny flow mimo runner pres primy Playwright script prosel.

## Znama mobilni rizika

- iOS/Android viewport pri zmene adresni listy muze porad menit `visualViewport`, ale body lock uz nedrzi scroll pres `overflow` ani neztraci puvodni `scrollY`.
- Modal obsah musi zustat scrollovatelny uvnitr vlastnich modal body/card elementu; tato zmena nemenila layout ani vysky jednotlivych modal contentu.
- Onboarding stale umi scrollovat na target, ale neudela to, pokud je aktivni modal scroll lock.

## Zamerne nemeneno

- Gameplay pravidla, ekonomika, market ceny, bounty/alliance/faction pravidla.
- Storage keys a server commandy.
- Vzhled modal layoutu mimo bily text odmitacich/ghost tlacitek.
- Velky runtime rewrite nebo novy gameplay system.
