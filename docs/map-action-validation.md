# Map Action Validation

Autoritativni validace mapovych akci je v `packages/game-core/src/rules/map`.

`validateMapAction` vyhodnocuje:

- vztah targetu k hraci (`self`, `ally`, `enemy`, `empty`, `blocked`),
- obousmerne sousedstvi pres `adjacentDistrictIds`,
- vlastni origin district,
- zamcene a znicene distrikty,
- spy authorization pro attack,
- spy authorization pro occupy prazdneho districtu,
- consent hook pro allied encirclement.

Client muze zobrazovat preview, ale command handler vzdy validuje znovu na serveru.

Spojenec nikdy nerozsiruje hranici pro:

- spy,
- rob,
- occupy,
- heist,
- attack.

Vyjimka je pouze budoucí vkladani spojenecke obrany.

Aktivni commandy napojene na validator:

- `attack-district`,
- `occupy-district`,
- `spy-district`,
- `place-trap`,
- `select-spawn-district`.

Validator ma pripravene vetve pro `rob` a `heist`, ale tyto commandy zatim nejsou v aktivnim `GameCommand` unionu.
