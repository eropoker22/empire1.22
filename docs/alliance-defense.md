# Alliance Defense

## Aktualni hranice

Spojenecky district nerozsiruje utocnou ani expanzni hranici hrace. Centralni map validator proto neuzna spojenecky district jako validni origin pro:

- `attack`,
- `occupy`,
- `rob`,
- `heist`,
- `spy`.

## Obrana spojence

Map validator ma akce `place_defense` a `remove_defense` pripraveny tak, aby povolily vlastni nebo spojenecky district. Samotne command handlery pro vkladani/odebirani spojenecke obrany nejsou v aktualnim `GameCommand` unionu jeste aktivni.

Budouci implementace musi zachovat:

- obrana zustava majetkem prispevatele,
- hostitel ji nesmi prodat ani presunout k sobe,
- hostitel ji muze vratit puvodnimu vlastnikovi,
- pri rozpadu aliance se prezivsi obrana vraci vlastnikum,
- snapshot boje nesmi byt zmenen rozpadem aliance behem utoku.

## Limity

Doporucena centralni konfigurace:

- `maxItemsPerContributorPerDistrict`,
- `maxAlliedItemsPerDistrict`.

Limity se nesmi zapisovat jako magicka cisla do UI.
