import {
  DEFAULT_DRUG_INVENTORY,
  DEFAULT_MATERIAL_INVENTORY,
  DEFAULT_WEAPON_INVENTORY
} from "../../packages/game-config/src/legacy-page/economy-config.js";
import {
  FACTION_CATALOG,
  FACTION_WEAPON_PRESETS
} from "../../packages/game-config/src/legacy-page/faction-config.js";
import {
  createDefaultPreviewSession,
  updateStoredPreviewSession
} from "./app/model/authority-state.js";
import {
  ensureIdentity,
  ensureLobbySelection,
  getRegistrationDraft,
  saveLobbyStep
} from "./app/auth-flow.js";

const GAME_ENTRY_HREF = "./game.html";
const LOGIN_ENTRY_HREF = "./login.html";
const DEFAULT_FACTION_SERVER_ID = "war-eu-01";
const DEFAULT_FACTION_DISTRICT_ID = 27;
const AVATAR_MARQUEE_COPY_COUNT = 6;
const COLOR_OPTIONS = [
  { name: "Červená", value: "#ef4444" }, { name: "Modrá", value: "#3b82f6" }, { name: "Zelená", value: "#22c55e" },
  { name: "Žlutá", value: "#eab308" }, { name: "Oranžová", value: "#f97316" }, { name: "Fialová", value: "#8b5cf6" },
  { name: "Růžová", value: "#ec4899" }, { name: "Tyrkysová", value: "#14b8a6" }, { name: "Azurová", value: "#06b6d4" },
  { name: "Purpurová", value: "#a21caf" }, { name: "Vínová", value: "#7f1d1d" }, { name: "Olivová", value: "#6b8e23" },
  { name: "Limetková", value: "#84cc16" }, { name: "Mentolová", value: "#a7f3d0" }, { name: "Lososová", value: "#fa8072" },
  { name: "Korálová", value: "#ff7f50" }, { name: "Zlatá", value: "#ffd700" }, { name: "Stříbrná", value: "#c0c0c0" },
  { name: "Béžová", value: "#f5f5dc" }, { name: "Hnědá", value: "#8b4513" }, { name: "Černá", value: "#111111" },
  { name: "Bílá", value: "#ffffff" }, { name: "Šedá", value: "#9ca3af" }, { name: "Indigo", value: "#4f46e5" },
  { name: "Safírová", value: "#0f52ba" }, { name: "Smaragdová", value: "#50c878" }, { name: "Karmínová", value: "#dc143c" },
  { name: "Levandulová", value: "#e6e6fa" }, { name: "Broskvová", value: "#ffdab9" }, { name: "Antracitová", value: "#36454f" }
];

const FACTION_META = {
  mafian: {
    structure: "mafián",
    desc: "Staré rodiny už dávno nevládnou jen násilím. Drží bary, kluby, účetní stopy i lidi, co rozhodují za zataženými závěsy.",
    bonus: "Protection Network",
    bonusCopy: "Podniky v jejich sektorech generují o 25 % více peněz.",
    prefix: "Don Umbra",
    bios: [
      "Tichý vyjednavač, který kupuje loajalitu dřív, než padne první výstřel.",
      "Pouliční účetní rodiny, co mění dluhy ve zbraň proti rivalům.",
      "Pravá ruka dona, specialista na vydírání klubů a barů.",
      "Nenápadný stratég, co řídí výpalné síť po celé čtvrti."
    ],
    motives: [
      "Chce sjednotit podsvětí pod jednu rodinu a vybírat desátek z každé ulice.",
      "Touží ovládnout radnici přes dluhy a udělat z města soukromý trezor rodiny.",
      "Věří, že jen pevná ruka mafie udrží v chaosu pořádek a zisk."
    ],
    avatars: [
      "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
      "../img/avatars/Mafia/8d2dcbe6-00d3-4b6f-98a0-53dc914346c5.jpg",
      "../img/avatars/Mafia/c06f4c9b-2f01-43bc-a085-cd614f5435a9.jpg",
      "../img/avatars/Mafia/cc2273ef-9175-4422-80ae-3c790f05e233.jpg",
      "../img/avatars/Mafia/grok_image_1773619750005.jpg",
      "../img/avatars/Mafia/grok_image_1773619862866.jpg",
      "../img/avatars/Mafia/grok_image_1773620311309.jpg",
      "../img/avatars/Mafia/grok_image_1773620518258.jpg",
      "../img/avatars/Mafia/u6568429269_ultra_realistic_photo_of_a_middle-aged_mafia_boss_6ea45063-7161-4bc9-a6fc-d6272093bdfd_2.png",
      "../img/avatars/Mafia/u6568429269_ultra_realistic_photo_of_a_middle-aged_mafia_boss_75858821-6f00-4d5d-b505-f4c4718f6793_3.png"
    ]
  },
  kartel: {
    structure: "kartel",
    desc: "Kartel netlačí moc na odiv. Protéká městem tunelem, přístavem a nočním transportem, dokud se černý trh nezačne točit jen podle jeho pravidel.",
    bonus: "Smuggling Routes",
    bonusCopy: "Každou herní hodinu získávají pasivní příjem z černého trhu.",
    prefix: "El Circuito",
    bios: [
      "Logistický mozek pašerácké trasy mezi přístavem a nočními sklady.",
      "Chemik kartelu, který hlídá kvalitu i strach na ulici.",
      "Polní velitel konvojů, co nikdy nenechá zásilku bez krytí."
    ],
    motives: [
      "Chce ovládnout přístav a letiště, aby každý tok zboží vedl přes kartel.",
      "Touží proměnit město v hlavní uzel černého trhu celého regionu."
    ],
    avatars: [
      "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
      "../img/avatars/Kartel/37b9a32a-4710-4060-a1a9-5cf2e2c924c7.jpg",
      "../img/avatars/Kartel/4106b8e4-5832-4e06-80bc-41a8c7f338ba.jpg",
      "../img/avatars/Kartel/43141dc5-2250-4074-8579-a112abd5e038.jpg",
      "../img/avatars/Kartel/493a9297-ee18-49ca-a81e-aeca0a214a2b.jpg",
      "../img/avatars/Kartel/5c31615c-6e38-408c-8d88-b8aea5af6a26.jpg",
      "../img/avatars/Kartel/6a744996-f511-461a-9921-3cb3df3ad166.jpg",
      "../img/avatars/Kartel/a02833cd-b493-41aa-b784-b28ae35124b3.jpg",
      "../img/avatars/Kartel/f1a482b8-44c2-41f1-9e3c-1d4c4cff5d7d.jpg",
      "../img/avatars/Kartel/f7281b4a-f79f-4d76-b975-5153d414208f.jpg"
    ]
  },
  kult: {
    structure: "kult",
    desc: "Kult nestaví svou moc na velikosti, ale na poslušnosti, nátlaku a vlivu. Funguje tiše, disciplinovaně a dlouhodobě.",
    bonus: "Devotion Network",
    bonusCopy: "Získává vyšší vliv a stabilnější udržení districtů.",
    prefix: "High Oracle",
    bios: [
      "Fanatický hlasatel, který mění strach v poslušnost.",
      "Koordinátor buněk, jenž drží disciplínu i ve zhroucených sektorech.",
      "Tichý náborář, který verbuje ztracené lidi do oddané sítě."
    ],
    motives: [
      "Chce proměnit město v uzavřenou síť poslušnosti a tichého nátlaku.",
      "Věří, že kontrola mysli je silnější než kontrola peněz."
    ],
    avatars: [
      "../img/avatars/kult/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
      "../img/avatars/kult/f9b2211e-30fb-46ab-aa4c-16913d8a92c6.jpg",
      "../img/avatars/kult/grok_image_1773620275790.jpg",
      "../img/avatars/kult/grok_image_1773620321599.jpg",
      "../img/avatars/kult/u6568429269_ultra_realistic_photo_of_a_female_underground_dea_52cbb8d9-f907-4f76-95c5-608796e1408f_2.png",
      "../img/avatars/kult/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__0febf5a6-2d94-462e-8273-7f75ebc9702f_2.png",
      "../img/avatars/kult/u6568429269_ultra_realistic_photo_of_a_man_standing_in_a_dark_414698ba-5d74-445c-aff4-08db501c9559_1.png",
      "../img/avatars/kult/u6568429269_ultra_realistic_photo_of_a_young_street_gangster__b24ce8ec-0dd1-4655-9a10-903bd799329b_0.png",
      "../img/avatars/kult/u6568429269_underground_drug_dealer_shady_look_neon_pills_glo_eb67ef23-8107-4e80-a2b4-5e761a9707a9_0.png",
      "../img/avatars/kult/u6568429269_underground_drug_dealer_shady_look_neon_pills_glo_eb67ef23-8107-4e80-a2b4-5e761a9707a9_3.png"
    ]
  },
  "tajna-organizace": {
    structure: "tajná organizace",
    desc: "Nikdo je nevidí přicházet. Jen po nich zůstávají ztracené záznamy, přepsaná moc a sektory, které náhle přestanou poslouchat původní majitele.",
    bonus: "Shadow Control",
    bonusCopy: "Dokážou převzít oslabený sektor bez přímého útoku.",
    prefix: "Shade Proxy",
    bios: ["Operativní stín, který sbírá kompromitující data.", "Mistr infiltrace, co mění cizí pevnosti ve vlastní spící buňky."],
    motives: ["Chce ovládnout město ze stínu a rozhodovat o válkách bez otevřeného boje."],
    avatars: [
      "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
      "../img/avatars/Tajnaorganizace/0870f362-b2ce-4607-ad3f-a96b59afcc8d.jpg",
      "../img/avatars/Tajnaorganizace/0bd44b08-ad68-4404-9530-0522aae3ec60.jpg",
      "../img/avatars/Tajnaorganizace/66c17176-42d3-4647-8c06-fc6e91f3957f.jpg",
      "../img/avatars/Tajnaorganizace/90387802-ab09-43dd-b1be-e513584fc020.jpg",
      "../img/avatars/Tajnaorganizace/9201ecf3-9210-4769-b500-37186590748a.jpg",
      "../img/avatars/Tajnaorganizace/9d63f447-a2aa-484c-9f5c-6c81f7e164c0.jpg",
      "../img/avatars/Tajnaorganizace/c145e5c4-81e4-4681-a316-1a4976cf3549.jpg",
      "../img/avatars/Tajnaorganizace/da2df45b-cb96-4d83-b18c-2c91946bc817.jpg",
      "../img/avatars/Tajnaorganizace/u6568429269_ultra_realistic_photo_of_an_elegant_man_outside_a_188a7cff-400b-454a-850d-5b64750e328f_0.png"
    ]
  },
  hackeri: {
    structure: "hackeři",
    desc: "Nevstupují dveřmi. Vypínají zabezpečení, přesměrovávají finance a nechávají protivníka stát v mrtvé zóně bez dat a bez reakce.",
    bonus: "System Breach",
    bonusCopy: "Mohou krást peníze nebo dočasně vypnout celý sektor.",
    prefix: "Null Ghost",
    bios: ["Síťový predátor, co láme zabezpečení městské infrastruktury.", "Architekt malwaru, co vypíná kamery přesně před útokem."],
    motives: ["Chce přepsat digitální pravidla města a přesměrovat jeho finance pod vlastní kontrolu."],
    avatars: [
      "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
      "../img/avatars/Hacker/53867e7d-cc7e-4f92-b391-88f44bf7e349.jpg",
      "../img/avatars/Hacker/b2ca251d-ddc6-43ac-9001-d9b9d2f28203.jpg",
      "../img/avatars/Hacker/d50c31d1-c395-4f21-8dae-9088c65926cb.jpg",
      "../img/avatars/Hacker/grok_image_1773620608055.jpg",
      "../img/avatars/Hacker/grok_image_1773621424855.jpg",
      "../img/avatars/Hacker/grok_image_1773621797044.jpg",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__7dc8e46f-f8fc-4957-8366-b556a1cf2dc4_1.png",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_hacker_real_human_eye__f876b11b-aba1-4c29-944c-02fa3f726770_2.png",
      "../img/avatars/Hacker/u6568429269_ultra_realistic_photo_of_a_young_hacker_real_huma_f3554d32-77a2-4073-affb-616f3353f331_1.png"
    ]
  },
  "motorkarsky-gang": {
    structure: "motorkářský gang",
    desc: "Silnice jsou jejich krevní oběh a hluk motorů jejich varování. Přijedou rychle, udeří tvrdě a zmizí dřív, než se město stihne srovnat.",
    bonus: "Road Dominance",
    bonusCopy: "Jednotky se pohybují po mapě o 35 % rychleji.",
    prefix: "Road Viper",
    bios: ["Velitel kolon, který proměňuje dálnice v nepřátelské území.", "Mechanik-válečník, co staví rychlé stroje i mobilní obranné pasti."],
    motives: ["Chce držet všechny dopravní tepny města a rozhodovat, kdo projede a kdo zmizí."],
    avatars: [
      "../img/avatars/Motogang/grok_image_1773621173474.jpg",
      "../img/avatars/Motogang/grok_image_1773621230721.jpg",
      "../img/avatars/Motogang/grok_image_1773621252715.jpg",
      "../img/avatars/Motogang/u6568429269_cyberpunk_biker_leather_jacket_glowing_bike_behin_1da05b1a-019b-4a6a-97d7-8485dff3dc93_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_imper_5d544f44-0abd-471c-982e-7131336ebe6f_1.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_imper_5d544f44-0abd-471c-982e-7131336ebe6f_2.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_biker_real_human_skin__fa51ff6a-3bb8-4ca1-a43e-9d60d8bc2824_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_female_biker_real_huma_2b692954-b73f-49e4-91d8-dddc78867254_0.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_photo_of_a_female_biker_real_huma_2b692954-b73f-49e4-91d8-dddc78867254_3.png",
      "../img/avatars/Motogang/u6568429269_ultra_realistic_portrait_of_a_cyberpunk_biker_sym_22eb676a-3364-4a3b-a9f6-48cdad9c87c5_2.png"
    ]
  },
  "soukroma-armada": {
    structure: "soukromá armáda",
    desc: "Tohle nejsou gangsteři. Tohle jsou kontraktoři války. Každý vstup, každý tah a každá obrana má řád.",
    bonus: "Elite Training",
    bonusCopy: "Jejich jednotky mají nejvyšší obrannou efektivitu ve hře.",
    prefix: "Iron Unit",
    bios: ["Bývalý instruktor elit, co vede městské operace s vojenskou přesností.", "Specialista na obranné linie, který mění sektor v pevnost."],
    motives: ["Chce proměnit město v pevnost řízenou disciplínou a vojenským řádem."],
    avatars: [
      "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
      "../img/avatars/SoukromaArmada/bbe6342a-cf92-4459-af42-dbb7beba19f6.jpg",
      "../img/avatars/SoukromaArmada/c4f384d2-9cd2-4f78-9145-a8e98dbc02dc.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620629687.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620667715.jpg",
      "../img/avatars/SoukromaArmada/grok_image_1773620914229.jpg",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_26d14473-69e5-46d8-baf2-e237305257ba_0.png",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_26d14473-69e5-46d8-baf2-e237305257ba_1.png",
      "../img/avatars/SoukromaArmada/u6568429269_private_military_soldier_futuristic_armor_scars_h_945f0251-cd43-4191-a97a-4997c480ef9e_1.png",
      "../img/avatars/SoukromaArmada/u6568429269_ultra_realistic_photo_of_a_mercenary_real_human_s_07ad1129-e85f-48b2-b807-b68d3fe0b68d_3.png"
    ]
  },
  korporace: {
    structure: "korporace",
    desc: "Nevyhrávají ulici hlukem, ale tlakem kapitálu. Kupují vliv, přetáčejí politiku a z oslabených čtvrtí dělají aktiva.",
    bonus: "Corporate Buyout",
    bonusCopy: "Oslabený sektor mohou převzít nákupem místo útoku.",
    prefix: "Executive Prime",
    bios: ["Firemní vyjednavač, který kupuje radnice i policejní ticho.", "Investiční predátor, co převádí krizové zóny do portfolia korporace."],
    motives: ["Chce převzít město ekonomicky a změnit gangy v dodavatele korporátní moci."],
    avatars: [
      "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg",
      "../img/avatars/Korporat/2ef61d31-c01c-44a3-bca5-6171166352b0.jpg",
      "../img/avatars/Korporat/350d79e5-06fb-45d4-a5c4-82e0a4c21e51.jpg",
      "../img/avatars/Korporat/42f30467-a673-4be8-9720-e221144c6286.jpg",
      "../img/avatars/Korporat/a621b41e-363c-47a5-bbbf-421418d19db1.jpg",
      "../img/avatars/Korporat/b4f8031a-aa5e-4944-9e35-fc6b666e5f2b.jpg",
      "../img/avatars/Korporat/daf4be3b-ed24-48ac-baa7-862a08d33a6e.jpg",
      "../img/avatars/Korporat/e4286e80-0587-4e0e-afe4-70c348ee59dd.jpg",
      "../img/avatars/Korporat/u6568429269_ultra_realistic_photo_of_a_corporate_businesswoma_346a0601-d784-4262-b627-06f3cd778022_0.png",
      "../img/avatars/Korporat/u6568429269_ultra_realistic_photo_of_an_elegant_man_outside_a_4264b4bb-afb0-4c14-ab21-81929710b8d4_2.png"
    ]
  }
};

const factionOrder = ["mafian", "kartel", "kult", "tajna-organizace", "hackeri", "motorkarsky-gang", "soukroma-armada", "korporace"];

const qs = (selector) => document.querySelector(selector);

function normalizeHexColor(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function createWeaponInventoryFromFaction(factionId) {
  return { ...DEFAULT_WEAPON_INVENTORY, ...(FACTION_WEAPON_PRESETS[factionId] || {}) };
}

document.addEventListener("DOMContentLoaded", () => {
  if (!ensureIdentity()) {
    window.location.href = LOGIN_ENTRY_HREF;
    return;
  }

  if (!ensureLobbySelection()) {
    const registration = getRegistrationDraft();
    saveLobbyStep({
      serverId: String(registration?.serverId || DEFAULT_FACTION_SERVER_ID).trim() || DEFAULT_FACTION_SERVER_ID,
      districtId: Number.parseInt(String(registration?.startDistrictId || DEFAULT_FACTION_DISTRICT_ID), 10) || DEFAULT_FACTION_DISTRICT_ID
    });
  }

  const matrixCanvas = qs("#matrix-canvas");
  const authForm = qs("#auth-form");
  const factionShell = qs(".auth-card--faction");
  const factionInput = qs("#auth-faction");
  const structureGrid = qs("#structure-grid");
  const detail = qs("#faction-detail");
  const title = qs("#faction-title");
  const tagline = qs("#faction-tagline");
  const desc = qs("#faction-desc");
  const bonus = qs("#faction-bonus");
  const note = qs("#structure-note");
  const statusMount = qs("#auth-status-mount");
  const inlineStatus = qs("#faction-inline-status");
  const goGame = qs("#go-game");
  const avatarGrid = qs("#avatar-grid");
  const avatarLeft = qs("#avatar-left");
  const avatarRight = qs("#avatar-right");
  const gangColorGrid = qs("#gang-color-grid");
  const gangColorValue = qs("#gang-color-value");
  const lightbox = qs("#avatar-lightbox");
  const lightboxImg = qs("#avatar-lightbox-img");
  const lightboxCaption = qs("#avatar-lightbox-caption");
  const lightboxPrev = qs("#avatar-lightbox-prev");
  const lightboxNext = qs("#avatar-lightbox-next");
  const lightboxConfirm = qs("#avatar-lightbox-confirm");
  const lightboxClose = qs("#avatar-lightbox-close");
  const lightboxBackdrop = qs("#avatar-lightbox .avatar-lightbox__backdrop");
  const selectedAvatarBackground = qs("#faction-selected-avatar-bg");
  const nameEl = qs("[data-faction-name]");
  const cleanMoneyEl = qs("[data-faction-clean-money]");
  const dirtyMoneyEl = qs("[data-faction-dirty-money]");
  const influenceEl = qs("[data-faction-influence]");
  const heatEl = qs("[data-faction-heat]");
  const advantagesEl = qs("[data-faction-advantages]");
  const disadvantagesEl = qs("[data-faction-disadvantages]");
  const authFlowTitle = qs("[data-auth-flow-title]");
  const authIdentity = qs("[data-auth-identity]");
  const authKind = qs("[data-auth-kind]");
  const authServer = qs("[data-auth-server]");
  const authDistrict = qs("[data-auth-district]");
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const marquee = avatarGrid?.closest(".avatar-marquee") || null;
  const existingRegistration = getRegistrationDraft();

  let selectedFactionId = factionOrder.includes(existingRegistration?.factionId)
    ? existingRegistration.factionId
    : null;
  let selectedAvatar = localStorage.getItem("empire_avatar") || existingRegistration?.avatar || null;
  let selectedGangColor = normalizeHexColor(localStorage.getItem("empire_gang_color") || existingRegistration?.gangColor || "");
  let marqueeLoopWidth = 0;
  let hoverPause = false;
  let holdDirection = 0;
  let marqueeTouchState = {
    active: false,
    moved: false,
    startX: 0
  };
  let mobileStructureTapState = {
    factionId: null,
    at: 0
  };
  const MOBILE_STRUCTURE_DOUBLE_TAP_MS = 360;
  const selectionConfirmed = {
    structure: Boolean(selectedFactionId),
    avatar: Boolean(selectedAvatar),
    gangColor: Boolean(selectedGangColor)
  };

  function setStatus(titleText, bodyText) {
    if (inlineStatus) {
      const message = [titleText, bodyText].filter(Boolean).join(" • ");
      inlineStatus.textContent = message;
      inlineStatus.classList.toggle("hidden", !message);
    }
    if (!statusMount) return;
    const titleNode = statusMount.querySelector(".placeholder-title");
    const bodyNode = statusMount.querySelector(".panel-note") || document.createElement("p");
    if (!bodyNode.parentElement) {
      bodyNode.className = "panel-note";
      statusMount.appendChild(bodyNode);
    }
    if (titleNode) titleNode.textContent = titleText;
    bodyNode.textContent = bodyText;
  }

  function getFactionMeta(factionId) {
    return FACTION_META[factionId] || FACTION_META.mafian;
  }

  function getAvailableAvatars() {
    if (!selectedFactionId) return [];
    return getFactionMeta(selectedFactionId).avatars || [];
  }

  function updateContinueState() {
    if (!goGame) return;
    const isReady = Boolean(
      selectedFactionId &&
      selectedAvatar &&
      selectedGangColor &&
      selectionConfirmed.structure &&
      selectionConfirmed.avatar &&
      selectionConfirmed.gangColor
    );
    goGame.classList.toggle("faction-link--disabled", !isReady);
    goGame.setAttribute("aria-disabled", String(!isReady));
    goGame.tabIndex = isReady ? 0 : -1;
  }

  function syncSelectedAvatarBackground(src = selectedAvatar) {
    if (!selectedAvatarBackground) return;
    const resolvedSrc = typeof src === "string" ? src.trim() : "";
    if (!resolvedSrc) {
      selectedAvatarBackground.style.removeProperty("--selected-avatar-image");
      selectedAvatarBackground.classList.add("hidden");
      return;
    }
    selectedAvatarBackground.style.setProperty("--selected-avatar-image", `url("${resolvedSrc.replace(/"/g, '\\"')}")`);
    selectedAvatarBackground.classList.remove("hidden");
  }

  function updateNote() {
    if (!note) return;
    const missing = [];
    if (!selectionConfirmed.structure) missing.push("frakci");
    if (!selectionConfirmed.gangColor) missing.push("barvu gangu");
    if (!selectionConfirmed.avatar) missing.push("avatara");
    note.textContent = missing.length === 0
      ? `Vybráno: ${FACTION_CATALOG[selectedFactionId]?.name || "Frakce"} • ${selectedGangColor} • avatar.`
      : `Chybí vybrat: ${missing.join(", ")}.`;
  }

  function renderAuthContext() {
    const registration = getRegistrationDraft();
    if (authFlowTitle) {
      authFlowTitle.textContent = registration?.serverLabel
        ? `Vstup přes ${registration.serverLabel}`
        : "Připraveno pro vstup do hry";
    }
    if (authIdentity) {
      authIdentity.textContent = registration?.identity || "Host";
    }
    if (authKind) {
      authKind.textContent = registration?.isGuest ? "Host účet" : "Standardní účet";
    }
    if (authServer) {
      authServer.textContent = registration?.serverLabel || "Nezvolen";
    }
    if (authDistrict) {
      authDistrict.textContent = registration?.startDistrictId ? `District ${registration.startDistrictId}` : "Nezvolen";
    }
  }

  function replaceList(element, items) {
    if (!element) return;
    element.innerHTML = (items || []).map((item) => `<li>${item}</li>`).join("");
  }

  function renderFactionPreview(factionId) {
    const faction = FACTION_CATALOG[factionId] || FACTION_CATALOG.mafian;
    const meta = getFactionMeta(factionId);
    if (factionInput) factionInput.value = factionId;
    if (title) title.textContent = faction.name;
    if (nameEl) nameEl.textContent = faction.name;
    if (tagline) tagline.textContent = faction.tagline;
    if (desc) desc.textContent = meta.desc || faction.description;
    if (bonus) {
      bonus.innerHTML = `<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>${meta.bonus}</strong> ${meta.bonusCopy}</span>`;
    }
    if (cleanMoneyEl) cleanMoneyEl.textContent = formatCurrency(faction.startingPackage.cleanMoney);
    if (dirtyMoneyEl) dirtyMoneyEl.textContent = formatCurrency(faction.startingPackage.dirtyMoney);
    if (influenceEl) influenceEl.textContent = String(faction.startingPackage.influence);
    if (heatEl) heatEl.textContent = String(faction.startingPackage.heat);
    replaceList(advantagesEl, faction.advantages);
    replaceList(disadvantagesEl, faction.disadvantages);
  }

  function renderEmptyFactionPreview() {
    if (factionInput) factionInput.value = "";
    if (title) title.textContent = "Vyber frakci";
    if (nameEl) nameEl.textContent = "Nevybráno";
    if (tagline) tagline.textContent = "";
    if (desc) desc.textContent = "Klikni na frakci, zobrazí se popis a výhoda.";
    if (bonus) {
      bonus.innerHTML = '<span class="faction-bonus__icon" aria-hidden="true">✦</span><span class="faction-bonus__copy"><strong>Profil frakce</strong> Výhody a nevýhody určují tvůj styl expanze a tlak ve městě.</span>';
    }
    if (cleanMoneyEl) cleanMoneyEl.textContent = "-";
    if (dirtyMoneyEl) dirtyMoneyEl.textContent = "-";
    if (influenceEl) influenceEl.textContent = "-";
    if (heatEl) heatEl.textContent = "-";
    replaceList(advantagesEl, []);
    replaceList(disadvantagesEl, []);
    detail?.classList.remove("is-active");
    structureGrid?.querySelectorAll(".structure-card").forEach((button) => {
      button.classList.remove("is-active", "structure-card--active");
    });
  }

  function applyStructureSelection(factionId, confirm = true) {
    if (!factionOrder.includes(factionId)) return;
    selectedFactionId = factionId;
    localStorage.setItem("empire_structure_id", factionId);
    localStorage.setItem("empire_structure", getFactionMeta(factionId).structure);
    if (confirm) selectionConfirmed.structure = true;
    structureGrid?.querySelectorAll(".structure-card").forEach((button) => {
      const isActive = button.dataset.factionId === factionId;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("structure-card--active", isActive);
    });
    const activeButton = structureGrid?.querySelector(`.structure-card[data-faction-id="${factionId}"]`);
    if (activeButton) {
      const activeStyles = window.getComputedStyle(activeButton);
      const accent = activeStyles.getPropertyValue("--structure-accent").trim();
      const accentSoft = activeStyles.getPropertyValue("--structure-accent-soft").trim();
      const accentAlt = activeStyles.getPropertyValue("--structure-accent-alt").trim();
      if (accent) {
        detail?.style.setProperty("--faction-accent", accent);
        factionShell?.style.setProperty("--faction-accent", accent);
      }
      if (accentSoft) {
        detail?.style.setProperty("--faction-accent-soft", accentSoft);
        factionShell?.style.setProperty("--faction-accent-soft", accentSoft);
      }
      if (accentAlt) {
        detail?.style.setProperty("--faction-accent-alt", accentAlt);
        factionShell?.style.setProperty("--faction-accent-alt", accentAlt);
      }
    }
    detail?.classList.add("is-active");
    renderFactionPreview(factionId);
    if (!getAvailableAvatars().includes(selectedAvatar)) {
      selectedAvatar = null;
      selectionConfirmed.avatar = false;
      localStorage.removeItem("empire_avatar");
    }
    syncSelectedAvatarBackground();
    renderAvatars();
    if (isLightboxOpen()) {
      if (selectedAvatar && getAvailableAvatars().includes(selectedAvatar)) {
        openLightbox(selectedAvatar);
      } else {
        closeLightbox();
      }
    }
    setStatus("", "");
    updateContinueState();
    updateNote();
  }

  function renderGangColorOptions() {
    if (!gangColorGrid) return;
    gangColorGrid.innerHTML = COLOR_OPTIONS.map(({ name, value }) => `
      <button class="gang-color-swatch" type="button" data-gang-color="${value}" style="--swatch:${value}" aria-label="${name}" title="${name}"></button>
    `).join("");
    gangColorGrid.querySelectorAll("[data-gang-color]").forEach((button) => {
      const selectColor = () => applyGangColorSelection(button.dataset.gangColor);
      button.addEventListener("click", selectColor);
      if (isCoarsePointer) {
        button.addEventListener("touchend", (event) => {
          event.preventDefault();
          selectColor();
        }, { passive: false });
      }
    });
  }

  function renderGangColorSelectionState(color) {
    gangColorGrid?.querySelectorAll("[data-gang-color]").forEach((button) => {
      button.classList.toggle("is-selected", normalizeHexColor(button.dataset.gangColor) === color);
    });
    if (gangColorValue) {
      const option = COLOR_OPTIONS.find((entry) => entry.value === color);
      gangColorValue.textContent = option?.name || "Nevybráno";
      gangColorValue.style.color = color || "";
    }
  }

  function applyGangColorSelection(color, confirm = true) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    selectedGangColor = normalized;
    localStorage.setItem("empire_gang_color", normalized);
    if (confirm) selectionConfirmed.gangColor = true;
    renderGangColorSelectionState(normalized);
    setStatus("", "");
    updateContinueState();
    updateNote();
  }

  function resolveAvatarLegend(src) {
    const meta = getFactionMeta(selectedFactionId);
    const avatars = getAvailableAvatars();
    const index = Math.max(0, avatars.indexOf(src));
    return {
      name: `${meta.prefix} ${index + 1}`,
      bio: meta.bios[index % meta.bios.length],
      motivation: meta.motives[index % meta.motives.length]
    };
  }

  function openLightbox(src) {
    if (!lightbox || !lightboxImg || !src) return;
    const legend = resolveAvatarLegend(src);
    lightboxImg.src = src;
    lightboxImg.dataset.avatar = src;
    if (lightboxCaption) {
      lightboxCaption.innerHTML = `
        <div class="avatar-lightbox__legend-name">${legend.name}</div>
        <div class="avatar-lightbox__legend-bio">${legend.bio}</div>
        <div class="avatar-lightbox__legend-motive"><strong>Motivace:</strong> ${legend.motivation}</div>
      `;
    }
    lightbox.classList.remove("hidden");
    updateLightboxNavigation();
  }

  function isLightboxOpen() {
    return Boolean(lightbox && !lightbox.classList.contains("hidden"));
  }

  function closeLightbox() {
    lightbox?.classList.add("hidden");
  }

  function updateLightboxNavigation() {
    const avatars = getAvailableAvatars();
    const disabled = avatars.length <= 1;
    if (lightboxPrev) lightboxPrev.disabled = disabled;
    if (lightboxNext) lightboxNext.disabled = disabled;
  }

  function shiftLightboxAvatar(direction) {
    const avatars = getAvailableAvatars();
    if (!avatars.length) return;
    const current = lightboxImg?.dataset.avatar || selectedAvatar || avatars[0];
    let index = avatars.indexOf(current);
    if (index < 0) index = 0;
    const next = avatars[(index + direction + avatars.length) % avatars.length];
    applyAvatarSelection(next, false);
    openLightbox(next);
  }

  function applyAvatarSelection(src, openPreview = true) {
    if (!src || !getAvailableAvatars().includes(src)) return;
    selectedAvatar = src;
    localStorage.setItem("empire_avatar", src);
    selectionConfirmed.avatar = true;
    avatarGrid?.querySelectorAll(".avatar-item").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.avatar === src);
    });
    syncSelectedAvatarBackground(src);
    setStatus("", "");
    updateContinueState();
    updateNote();
    if (openPreview) openLightbox(src);
  }

  function normalizeMarqueeLoop() {
    if (!marquee || marqueeLoopWidth <= 0) return;
    const minLoopPosition = marqueeLoopWidth;
    const maxLoopPosition = marqueeLoopWidth * 3;
    while (marquee.scrollLeft >= maxLoopPosition) {
      marquee.scrollLeft -= marqueeLoopWidth;
    }
    while (marquee.scrollLeft < minLoopPosition) {
      marquee.scrollLeft += marqueeLoopWidth;
    }
  }

  function updateMarqueeLoopWidth(resetPosition = false) {
    if (!marquee) return;
    marqueeLoopWidth = marquee.scrollWidth / AVATAR_MARQUEE_COPY_COUNT;
    if (resetPosition && marqueeLoopWidth > 0) {
      marquee.scrollLeft = marqueeLoopWidth * 2;
      return;
    }
    normalizeMarqueeLoop();
  }

  function recenterMarqueeWindow() {
    if (!marquee || marqueeLoopWidth <= 0) return;
    if (marquee.scrollLeft < marqueeLoopWidth * 1.3) {
      marquee.scrollLeft += marqueeLoopWidth;
      return;
    }
    if (marquee.scrollLeft > marqueeLoopWidth * 2.7) {
      marquee.scrollLeft -= marqueeLoopWidth;
    }
  }

  function renderAvatars() {
    if (!avatarGrid) return;
    const avatars = getAvailableAvatars();
    if (!avatars.length) {
      avatarGrid.innerHTML = '<div class="avatar-track__hint">Nejdřív vyber frakci. Pak se zobrazí její avatary.</div>';
      marqueeLoopWidth = 0;
      if (isLightboxOpen()) closeLightbox();
      updateLightboxNavigation();
      return;
    }
    const looped = Array.from({ length: AVATAR_MARQUEE_COPY_COUNT }, () => avatars).flat();
    avatarGrid.innerHTML = looped.map((src, index) => `
      <button class="avatar-item" data-avatar="${src}" data-loop-index="${index}" type="button" aria-label="Vybrat avatara">
        <img src="${src}" alt="Avatar" loading="${isCoarsePointer ? "eager" : "lazy"}">
      </button>
    `).join("");
    avatarGrid.querySelectorAll(".avatar-item").forEach((item) => {
      const src = item.dataset.avatar;
      if (src === selectedAvatar) item.classList.add("is-selected");
      item.addEventListener("click", (event) => {
        if (isCoarsePointer && marqueeTouchState.moved) {
          event.preventDefault();
          return;
        }
        applyAvatarSelection(src, true);
      });
      if (!isCoarsePointer) {
        item.addEventListener("mouseenter", () => {
          hoverPause = true;
          const preview = document.createElement("div");
          preview.id = "avatar-hover-preview";
          preview.className = "avatar-hover-preview";
          preview.innerHTML = `<img src="${src}" alt="Avatar preview">`;
          document.getElementById("avatar-hover-preview")?.remove();
          document.body.appendChild(preview);
        });
        item.addEventListener("mouseleave", () => {
          hoverPause = false;
          document.getElementById("avatar-hover-preview")?.remove();
        });
      }
    });
    updateMarqueeLoopWidth(true);
    updateLightboxNavigation();
  }

  function commitRegistration() {
    const currentRegistration = getRegistrationDraft();
    const factionId = selectedFactionId;
    if (!currentRegistration?.identity || !currentRegistration?.serverId || !currentRegistration?.startDistrictId) {
      setStatus("Lobby není hotové", "Nejdřív dokonči přihlášení, výběr serveru a districtu.");
      return false;
    }
    if (!selectedAvatar || !selectedGangColor || !selectionConfirmed.structure || !selectionConfirmed.avatar || !selectionConfirmed.gangColor) {
      updateNote();
      setStatus("Registrace nekompletní", "Doplň frakci, barvu gangu a avatara.");
      return false;
    }
    const baseSession = createDefaultPreviewSession(factionId);
    updateStoredPreviewSession(() => ({
      ...baseSession,
      registration: {
        ...currentRegistration,
        factionId,
        factionLabel: FACTION_CATALOG[factionId].name,
        avatar: selectedAvatar,
        gangColor: selectedGangColor,
        lockedAt: new Date().toISOString()
      },
      inventory: {
        ...baseSession.inventory,
        weapons: createWeaponInventoryFromFaction(factionId),
        materials: { ...DEFAULT_MATERIAL_INVENTORY },
        drugs: { ...DEFAULT_DRUG_INVENTORY }
      },
      economy: {
        cleanMoney: FACTION_CATALOG[factionId].startingPackage.cleanMoney,
        dirtyMoney: FACTION_CATALOG[factionId].startingPackage.dirtyMoney
      },
      world: {
        ...baseSession.world,
        ownedDistrictIds: [Number(currentRegistration.startDistrictId)]
      }
    }));
    setStatus(
      "Registrace dokončena",
      `${currentRegistration.identity} vstoupil na ${currentRegistration.serverLabel || "server"} jako ${FACTION_CATALOG[factionId].name} ze startu District ${currentRegistration.startDistrictId}.`
    );
    return true;
  }

  if (matrixCanvas) {
    const ctx = matrixCanvas.getContext("2d");
    const letters = "アカサタナハマヤラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let width = 0;
    let height = 0;
    let columns = 0;
    let drops = [];
    let animationId = null;
    let lastTime = 0;
    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      matrixCanvas.width = Math.floor(width * window.devicePixelRatio);
      matrixCanvas.height = Math.floor(height * window.devicePixelRatio);
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      columns = Math.floor(width / 14);
      drops = Array.from({ length: columns }, () => Math.random() * height);
    };
    const draw = (time) => {
      if (time - lastTime < 50) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;
      ctx.fillStyle = "rgba(7, 8, 15, 0.15)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
      ctx.font = "14px 'IBM Plex Mono', monospace";
      for (let index = 0; index < drops.length; index += 1) {
        ctx.fillText(letters[Math.floor(Math.random() * letters.length)], index * 14, drops[index]);
        drops[index] += 16;
        if (drops[index] > height + Math.random() * 200) {
          drops[index] = -Math.random() * 200;
        }
      }
      animationId = requestAnimationFrame(draw);
    };
    setSize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener("resize", setSize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
        return;
      }
      if (!document.hidden && !animationId) {
        lastTime = 0;
        animationId = requestAnimationFrame(draw);
      }
    });
  }

  renderGangColorOptions();
  renderGangColorSelectionState(selectedGangColor);
  if (selectedFactionId) {
    applyStructureSelection(selectedFactionId, false);
  } else {
    selectedAvatar = null;
    selectionConfirmed.avatar = false;
    localStorage.removeItem("empire_avatar");
    renderEmptyFactionPreview();
    renderAvatars();
  }
  if (selectedAvatar) applyAvatarSelection(selectedAvatar, false);
  else syncSelectedAvatarBackground();

  structureGrid?.querySelectorAll(".structure-card").forEach((button) => {
    const selectCard = () => applyStructureSelection(button.dataset.factionId);
    if (isCoarsePointer) {
      button.addEventListener("touchend", (event) => {
        event.preventDefault();
        const factionId = button.dataset.factionId;
        const now = Date.now();
        const isDoubleTap = mobileStructureTapState.factionId === factionId
          && (now - mobileStructureTapState.at) <= MOBILE_STRUCTURE_DOUBLE_TAP_MS;
        if (isDoubleTap) {
          mobileStructureTapState = { factionId: null, at: 0 };
          selectCard();
          return;
        }
        mobileStructureTapState = { factionId, at: now };
      }, { passive: false });
      return;
    }
    button.addEventListener("click", selectCard);
  });

  if (avatarLeft && avatarRight && avatarGrid && marquee) {
    const scrollByAmount = () => marquee.clientWidth * 0.6;
    const autoSpeedPxPerMs = isCoarsePointer ? 0.022 : 0.052;
    const ARROW_HOLD_START_MS = 170;
    let lastTime = 0;
    let suppressArrowClickUntil = 0;
    let arrowPressState = {
      direction: 0,
      pointerId: null,
      pressedAt: 0
    };
    marquee.style.scrollBehavior = "auto";

    const getArrowDriveDirection = (now) => {
      if (arrowPressState.direction === 0) return 0;
      return now - arrowPressState.pressedAt >= ARROW_HOLD_START_MS
        ? arrowPressState.direction
        : 0;
    };

    const step = (time) => {
      if (!lastTime) lastTime = time;
      const delta = Math.min(34, Math.max(0, time - lastTime));
      lastTime = time;
      if (!hoverPause && marqueeLoopWidth > 0) {
        const arrowDriveDirection = getArrowDriveDirection(time);
        const appliedDirection = holdDirection !== 0 ? holdDirection : arrowDriveDirection;
        const speed = appliedDirection !== 0 ? appliedDirection * autoSpeedPxPerMs * 5.2 : autoSpeedPxPerMs;
        marquee.scrollLeft += speed * delta;
        normalizeMarqueeLoop();
      }
      requestAnimationFrame(step);
    };

    const jumpBy = (delta) => {
      marquee.scrollLeft += delta;
      normalizeMarqueeLoop();
    };

    const clearArrowPressState = () => {
      arrowPressState = {
        direction: 0,
        pointerId: null,
        pressedAt: 0
      };
    };

    const bindArrowControls = (button, direction) => {
      const quickJump = () => jumpBy(scrollByAmount() * direction);

      button.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        arrowPressState = {
          direction,
          pointerId: event.pointerId ?? null,
          pressedAt: performance.now()
        };
        suppressArrowClickUntil = performance.now() + 420;
        if (typeof button.setPointerCapture === "function" && event.pointerId !== undefined) {
          try {
            button.setPointerCapture(event.pointerId);
          } catch {}
        }
      });

      const finishPress = (event, cancelled = false) => {
        if (arrowPressState.direction !== direction) return;
        if (arrowPressState.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== arrowPressState.pointerId) return;
        const heldLongEnough = performance.now() - arrowPressState.pressedAt >= ARROW_HOLD_START_MS;
        clearArrowPressState();
        suppressArrowClickUntil = performance.now() + 420;
        if (!cancelled && !heldLongEnough) {
          quickJump();
        }
      };

      button.addEventListener("pointerup", (event) => finishPress(event, false));
      button.addEventListener("pointercancel", (event) => finishPress(event, true));
      button.addEventListener("lostpointercapture", (event) => finishPress(event, true));
      button.addEventListener("click", (event) => {
        if (performance.now() < suppressArrowClickUntil) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        quickJump();
      });
    };

    requestAnimationFrame(step);
    bindArrowControls(avatarLeft, -1);
    bindArrowControls(avatarRight, 1);

    window.addEventListener("resize", updateMarqueeLoopWidth);

    if (!isCoarsePointer) {
      marquee.addEventListener("mouseleave", () => {
        hoverPause = false;
        document.getElementById("avatar-hover-preview")?.remove();
      });
      avatarLeft.addEventListener("mousedown", () => { holdDirection = -1; });
      avatarRight.addEventListener("mousedown", () => { holdDirection = 1; });
      document.addEventListener("mouseup", () => { holdDirection = 0; });
      avatarLeft.addEventListener("mouseleave", () => { holdDirection = 0; });
      avatarRight.addEventListener("mouseleave", () => { holdDirection = 0; });
    }

    if (isCoarsePointer) {
      marquee.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        marqueeTouchState.active = true;
        marqueeTouchState.moved = false;
        marqueeTouchState.startX = touch.clientX;
        hoverPause = true;
      }, { passive: true });

      marquee.addEventListener("touchmove", (event) => {
        if (!marqueeTouchState.active) return;
        const touch = event.touches[0];
        if (!touch) return;
        if (Math.abs(touch.clientX - marqueeTouchState.startX) > 8) {
          marqueeTouchState.moved = true;
        }
      }, { passive: true });

      const endDrag = () => {
        marqueeTouchState.active = false;
        hoverPause = false;
        recenterMarqueeWindow();
        window.setTimeout(() => {
          marqueeTouchState.moved = false;
        }, 80);
      };

      marquee.addEventListener("touchend", endDrag);
      marquee.addEventListener("touchcancel", endDrag);
    }
  }

  lightboxBackdrop?.addEventListener("click", closeLightbox);
  lightboxClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  });
  lightboxClose?.addEventListener("touchend", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  }, { passive: false });
  lightboxPrev?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shiftLightboxAvatar(-1);
  });
  lightboxPrev?.addEventListener("touchend", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shiftLightboxAvatar(-1);
  }, { passive: false });
  lightboxNext?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shiftLightboxAvatar(1);
  });
  lightboxNext?.addEventListener("touchend", (event) => {
    event.preventDefault();
    event.stopPropagation();
    shiftLightboxAvatar(1);
  }, { passive: false });
  lightboxConfirm?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  });
  lightboxConfirm?.addEventListener("touchend", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  }, { passive: false });
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
    if (lightbox && !lightbox.classList.contains("hidden")) {
      if (event.key === "ArrowLeft") shiftLightboxAvatar(-1);
      if (event.key === "ArrowRight") shiftLightboxAvatar(1);
    }
  });

  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (commitRegistration()) {
      window.location.href = GAME_ENTRY_HREF;
    }
  });
  goGame?.addEventListener("click", (event) => {
    event.preventDefault();
    if (commitRegistration()) {
      window.location.href = GAME_ENTRY_HREF;
    }
  });

  renderAuthContext();
  setStatus("", "");
  updateContinueState();
  updateNote();
});
