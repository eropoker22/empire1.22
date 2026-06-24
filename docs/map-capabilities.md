# Map Capabilities

Serverovy district panel obsahuje `capabilities`.

Capabilities se pocitaji ze stejneho `validateMapAction`, ktery pouzivaji command handlery. UI podle nich kresli tlacitka, ale server je porad jedina autorita.

Pole:

- `canManage`
- `canSpy`
- `canRob`
- `canHeist`
- `canAttack`
- `canOccupy`
- `canPlaceTrap`
- `canRelocateTrapHere`
- `reasons`

Priklady:

- vlastni district: `canManage`, pripadne `canPlaceTrap`,
- prazdny soused: `canSpy`, `canRob`, `canOccupy` az po success spy,
- nepratelsky soused: `canSpy`, `canHeist`, `canAttack` az po success spy,
- spojenec: zadna expanzni ani utocna capability.

Frontier read-model vraci:

- stav hranice,
- prazdne sousedy,
- spojenecke sousedy,
- nepratelske sousedy,
- locked sousedy,
- souhrnne booleany pro UI.

Frontier je informacni souhrn. Skutecne povoleni akce vzdy urcuje capability/validator pro konkretni target.
