# Spawn Selection

## Stav pred zmenou

Server pri joinu automaticky prideloval prvni volny spawn district ze `sharedCitySpawnDistrictIds`. Lobby preference z klienta nebyla autoritativni vyber startu.

## Aktualni serverove pravidlo

Explicitni spawn pool vychazi z canonical map manifestu:

`packages/game-config/src/maps/empire-streets-city-map.json`

Serverovy adapter je v:

`apps/server/src/bootstrap/gameplay-slice-spawn-pool.ts`

Pool bere jen manifest districts s:

```ts
isSpawnCandidate: true
spawnZones: ["west" | "east" | "south"]
```

Spawn kandidati jsou vsechny non-Downtown distrikty v bocnich spawn pasmech:

- prvnich 5 sloupcu z leve strany mapy jako `west`,
- poslednich 5 sloupcu z prave strany mapy jako `east`,
- cela uplne spodni rada jako `south`.

Na aktualni mape to dava 83 spawn kandidatu napric hornimi, bocnimi i spodnimi districtami.

Pri joinu server:

1. vytvori shared city mapu,
2. vytvori hrace ve stavu `awaiting_spawn_selection`,
3. nenastavi `homeDistrictId`,
4. neprovede zadny fallback na prvni volny spawn,
5. vrati lobby spawn read-model.

Spawn se potvrzuje vyhradne commandem `select-spawn-district`:

```ts
{
  districtId: string
}
```

Command uspesne projde pouze kdyz district:

- existuje,
- je enabled spawn candidate ve west/east/south spawn poolu,
- neni Downtown,
- je neutralni,
- neni obsazeny,
- neni locked,
- hrac jeste nema startovni district.

Chyby vraci stabilni reason codes:

- `SPAWN_NOT_ALLOWED`
- `SPAWN_ALREADY_OCCUPIED`
- `SPAWN_LOCKED`
- `SPAWN_NOT_NEUTRAL`
- `PLAYER_ALREADY_HAS_SPAWN`

Obsazeny spawn se pri refresh/reconnect neuvolnuje automaticky.

## Co lobby smi zobrazit

Lobby muze zobrazit:

- obsazeny spawn,
- verejne jmeno vlastnika,
- typ districtu,
- budovu,
- sousedy,
- spawn zonu.

Lobby nesmi zobrazit:

- obranu,
- past,
- zdroje,
- soukrome statistiky.

## Navazujici prace

Aktualni zmena sjednocuje aktivni serverovy bootstrap, manifest spawn pool, lobby read-model a atomicky `select-spawn-district` command. Kratka modal rezervace s `reservedByPlayerId` a expiraci jeste neni implementovana.
