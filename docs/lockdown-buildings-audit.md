# Lockdown Buildings Audit

Datum: 2026-06-29

Scope: rozdil mezi poctem budov v tlacitku/modalu **Budovy**, mapou po eliminaci/lockdownu a stavem napojeni building cards na runtime/server.

## Shrnuti

Hlavni pricina rozdilneho poctu neni jeden zdroj dat:

- Mapa pouziva aktualni `interactionState`, `ownedDistrictIds`, `destroyedDistrictIds` a v launch fazi jeste `START_PHASE_OWNER_BY_DISTRICT_ID`.
- Modal **Budovy** v `page-assets/js/app/runtime/buildingsPopupRuntime.js` ma v live fazi zamerne debug/alpha chovani: bere vsechny distrikty dane zony z geometrie a oznaci budovy jako dostupne, i kdyz district neni realne vlastneny hracem.
- Lockdown/eliminace v `page-assets/js/app/runtime.js` pres `neutralizeLaunchOwnerDistricts` odstrani eliminovaneho hrace ze `START_PHASE_OWNER_BY_DISTRICT_ID` a odebere jeho distrikty z `ownedDistrictIds`.
- Cast helperu pro building multipliery a `Pocet` v kartach cetla `worldState.phase`, ale skutecny zdroj je `worldState.phaseState.gamePhase`. To mohlo rozhazovat pocty proti mape hlavne v prechodu launch/live a pri neutralizaci districtu.

Opraveno:

- `page-assets/js/app/runtime/buildingNetworkRuntime.js` normalizuje fazi z `phaseState.gamePhase`, ignoruje znicene distrikty a pocita `Obchodni centrum` pro market ze stejneho ownership zdroje jako ostatni building networky.
- `page-assets/js/app/runtime.js` helper `getOwnedDistrictBuildingCountByBaseName` pouziva `phaseState.gamePhase`, startovni owner mapu a ignoruje znicene distrikty.

Nezmeneno:

- Live modal **Budovy** stale ukazuje vsechny budovy jako dostupne. Je to predchozi zadani pro alpha/debug live fazi. Pokud ma byt pocet v modal buttonu stejny jako mapa, je potreba zmenit product pravidlo: live modal ma pocitat jen skutecne vlastnene/ne-lockdown distrikty.

## Kde se pocet bere

| Oblast | Soubor | Zdroj | Poznamka |
|---|---|---|---|
| Mapa | `page-assets/js/app/runtime.js`, `districtCanvasRenderer.js` | `getEffectiveOwnedDistrictIds`, `getCurrentPlayerOwnedDistrictIds`, `destroyedDistrictIds` | V launch fazi vidi startovni vlastniky, v live jen aktualni ownership. |
| District popup | `page-assets/js/app/runtime/buildingsPopupRuntime.js` | vybrany district + `resolveDistrictBuildingProfile` | U zniceneho districtu ukaze prazdny/spaleny stav. |
| Modal Budovy | `page-assets/js/app/runtime/buildingsPopupRuntime.js` | `getSourceDistrictsForBuildingType` | V live fazi bere vsechny distrikty typu, ne jen vlastnene. |
| Pocet v kartach | `page-assets/js/app/runtime.js` | `getOwnedDistrictBuildingCountByBaseName` | Opraveno na `phaseState.gamePhase` a filtr znicenych districtu. |
| Multipliery | `page-assets/js/app/runtime/buildingNetworkRuntime.js` | `countOwnedBuildingByBaseName` | Opraveno na jednotny ownership zdroj. |
| Lockdown/eliminace | `page-assets/js/app/runtime.js` | `neutralizeLaunchOwnerDistricts` | Odebira eliminovane district vlastniky z launch mapy a aktualniho world state. |

## Proc se muze lisit Budovy vs mapa

Aktualne jsou validni dva rozdilne rezimy:

1. **Mapa**: ukazuje realny ownership/neutralizaci.
2. **Budovy modal v live fazi**: ukazuje vsechny building karty pro upravy/testovani, jako by je hrac vlastnil.

Proto je rozdil ocekavany, pokud je zapnuta live faze a soucasne se divas na mapu po eliminaci/lockdownu. Mapa respektuje neutralizaci, modal je alpha/debug katalog.

## Stav zon pro dalsi upravy karet

| Zona | Budovy | Stav karet | Server/action stav |
|---|---|---|---|
| Commercial | Restaurace, Kasino, Autosalon, Obchodni centrum, Smenarna, Fitness Club | Pripravene/uzamcene pro aktualni vizualni styl | Kasino, Smenarna a Restaurace maji server actions. Ostatni jsou hlavne pasivni/support. |
| Residential | Bytovy blok, Herna, Rekrutacni centrum, Garage, Skola, Klinika | Pripravene/uzamcene | Bytovy blok, Herna, Skola, Klinika maji server actions. Garage/Rekrutacni centrum jsou pasivni/support. |
| Park | Poulicni dealeri, Strip club, Vecerka, Pasovaci tunel | Pripravene/uzamcene | Pasovaci tunel, Poulicni dealeri a Strip club server-backed. Vecerka pasivni/rumor. |
| Industrial | Sklad, Energeticka stanice, Recyklacni centrum | Pripravene/uzamcene | Recyklacni centrum a Energeticka stanice server-backed. Sklad pasivni kapacita. |
| Industrial special | Tovarna, Zbrojovka | Vizualne mimo soucasny standard district-card sprintu | Production/craft legacy flow, potrebuje samostatny server-authoritative audit pred alpha. |
| Park special | Drug lab/Lab | Vizualne mimo soucasny standard district-card sprintu | Production/drug flow legacy, potrebuje samostatny server-authoritative audit. |
| Commercial special | Lekarna | Zamerne zatim neresena | Production/craft legacy flow, potrebuje samostatny server-authoritative audit. |
| Downtown | Burza, Centralni banka, Magistrat, Lobby klub, Letiste, Pristav, Parlament, Soud, VIP salonek | Pripravene pro dalsi vizualni pass | Burza, Banka, Magistrat, Lobby, Letiste, Pristav a Parlament jsou napojene pres server actions. Soud/VIP jsou pasivni/special intel. |

## Special actions podle registry

| Skupina | Stav |
|---|---|
| Server-ready a pouzivane | Bytovy blok, Herna, Kasino, Smenarna, Klinika, Skola, Restaurace, Recyklacni centrum, Pasovaci tunel, Energeticka stanice, Poulicni dealeri, Strip club, Burza, Centralni banka, Magistrat, Lobby klub, Letiste, Pristav, Parlament |
| Mix server + legacy | Zadna viditelna special action v kartach nesmi zustat v tomto stavu. |
| Legacy/local | Lekarna, Drug lab/Lab, Tovarna, Zbrojovka pouzivaji oddeleny production/craft flow a nemaji detail-card special action rows. |
| Missing handler rows | Skryte z detail karet, dokud nebudou server-backed. |
| Potrebuje overeni server end-to-end | Jen nove budouci akce pred vystavenim v karte. |
| Pasivni/no action | Sklad, Garage, Rekrutacni centrum, Fitness Club, Autosalon, Obchodni centrum, Vecerka, Soud, VIP salonek |

## Doporučení

1. Rozhodnout product pravidlo pro live fazi:
   - debug katalog: modal **Budovy** dal ukazuje vsechny budovy,
   - nebo alpha-realita: modal pocita jen realne vlastnene a ne-neutralizovane distrikty.
2. Pred dalsim Downtown vizualnim sprintem kontrolovat jen copy a inputy proti server action configu; registry uz je server-backed.
3. Special production budovy (`Lekarna`, `Drug lab`, `Tovarna`, `Zbrojovka`) drzet v oddelenem production/craft flow bez detail-card special rows.
4. Pro Park/Industrial uz pokracovat v UI upravach jen proti server-backed akcim a testum registry.
