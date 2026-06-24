# Encirclement Consent

## Frontier

Frontier se pocita z vlastnich districtu hrace a jejich sousedu. Spojenecky district se nepocita jako vlastni hranice.

Stavy:

- `open`
- `allied_encircled`
- `hostile_encircled`
- `mixed_encircled`
- `no_frontier`

Implementace vypoctu je v:

`packages/game-core/src/rules/map/frontier.ts`

## Dopad

Obkliceni nema automaticky:

- ekonomicky debuff,
- snizeni produkce,
- ztratu populace,
- zvyseni Heat,
- poskozeni budov,
- odebrani districtu.

Dopad je mapovy: hrac bez prazdne hranice nemuze expandovat do prazdnych districtu, ale muze spravovat vlastni district a bojovat proti sousednim nepratelum.

## Consent

Pokud obsazeni posledniho prazdneho vystupu uzavre spojence do `allied_encircled`, cilovy stav ma vyzadovat souhlas dotceneho spojence.

Model zadosti:

- requester,
- affected player,
- target district,
- expirace,
- status `pending | approved | declined | expired | cancelled`,
- hash puvodni command payload.

Aktualni kod obsahuje serverovy frontier vypocet a consent hook. Pri `occupy` se simuluje zmena vlastnictvi a pokud nektery spojenec prejde z `open` na `allied_encircled`, validator vrati:

- `reasonCode: "CONSENT_REQUIRED"`,
- `requiresConsent: true`,
- `affectedPlayerIds`.

Plny command model consent requestu, perzistence zadosti a modal approval flow jeste nejsou aktivni v command unionu.
