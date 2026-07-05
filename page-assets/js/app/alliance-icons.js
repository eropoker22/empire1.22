export const ALLIANCE_ICON_OPTIONS = Object.freeze([
  { id: "reaper", tag: "REAPER", label: "Smrtka", asset: "/alliance-icons/alliance-reaper.svg", symbol: "RP" },
  { id: "snake", tag: "SNAKE", label: "Had", asset: "/alliance-icons/alliance-snake.svg", symbol: "SN" },
  { id: "wolf", tag: "WOLF", label: "Vlk", asset: "/alliance-icons/alliance-wolf.svg", symbol: "WF" },
  { id: "raven", tag: "RAVEN", label: "Havran", asset: "/alliance-icons/alliance-raven.svg", symbol: "RV" },
  { id: "skull", tag: "SKULL", label: "Lebka", asset: "/alliance-icons/alliance-skull.svg", symbol: "SK" },
  { id: "cobra", tag: "COBRA", label: "Kobra", asset: "/alliance-icons/alliance-cobra.svg", symbol: "CB" },
  { id: "spider", tag: "SPIDER", label: "Pavouk", asset: "/alliance-icons/alliance-spider.svg", symbol: "SP" },
  { id: "scorpion", tag: "SCORPION", label: "Škorpion", asset: "/alliance-icons/alliance-scorpion.svg", symbol: "SC" },
  { id: "vulture", tag: "VULTURE", label: "Sup", asset: "/alliance-icons/alliance-vulture.svg", symbol: "VT" },
  { id: "dagger", tag: "DAGGER", label: "Dýka", asset: "/alliance-icons/alliance-dagger.svg", symbol: "DG" },
  { id: "fist", tag: "FIST", label: "Pěst", asset: "/alliance-icons/alliance-fist.svg", symbol: "FS" },
  { id: "crown", tag: "CROWN", label: "Koruna", asset: "/alliance-icons/alliance-crown.svg", symbol: "CR" },
  { id: "mask", tag: "MASK", label: "Maska", asset: "/alliance-icons/alliance-mask.svg", symbol: "MK" },
  { id: "claw", tag: "CLAW", label: "Dráp", asset: "/alliance-icons/alliance-claw.svg", symbol: "CL" },
  { id: "fangs", tag: "FANGS", label: "Tesáky", asset: "/alliance-icons/alliance-fangs.svg", symbol: "FG" },
  { id: "eye", tag: "EYE", label: "Oko", asset: "/alliance-icons/alliance-eye.svg", symbol: "EY" },
  { id: "jackal", tag: "JACKAL", label: "Šakal", asset: "/alliance-icons/alliance-jackal.svg", symbol: "JK" },
  { id: "hydra", tag: "HYDRA", label: "Hydra", asset: "/alliance-icons/alliance-hydra.svg", symbol: "HY" },
  { id: "ghost", tag: "GHOST", label: "Duch", asset: "/alliance-icons/alliance-ghost.svg", symbol: "GH" },
  { id: "bull", tag: "BULL", label: "Býk", asset: "/alliance-icons/alliance-bull.svg", symbol: "BL" }
]);

const LEGACY_TAG_TO_ICON_ID = Object.freeze({
  CRWN: "crown",
  BLAD: "dagger",
  STAR: "eye",
  PACK: "wolf",
  REAP: "reaper",
  SNKE: "snake",
  RAVN: "raven",
  SKUL: "skull",
  COBR: "cobra",
  SPDR: "spider",
  SCOR: "scorpion",
  VULT: "vulture",
  DAGR: "dagger",
  FANG: "fangs",
  JCKL: "jackal",
  HYDR: "hydra",
  GHST: "ghost"
});

const ICON_BY_ID = new Map(ALLIANCE_ICON_OPTIONS.map((icon) => [icon.id, icon]));
const ICON_BY_TAG = new Map(ALLIANCE_ICON_OPTIONS.map((icon) => [icon.tag, icon]));

export const getAllianceIconById = (id) =>
  ICON_BY_ID.get(String(id || "").trim().toLowerCase()) || ALLIANCE_ICON_OPTIONS[0];

export const getAllianceIconByTag = (tag) => {
  const normalizedTag = String(tag || "").trim().toUpperCase();
  const legacyIconId = LEGACY_TAG_TO_ICON_ID[normalizedTag];
  return (legacyIconId ? ICON_BY_ID.get(legacyIconId) : ICON_BY_TAG.get(normalizedTag)) || ALLIANCE_ICON_OPTIONS[0];
};
