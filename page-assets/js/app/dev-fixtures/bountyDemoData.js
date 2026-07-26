const LOWKEYLAD_AVATAR_SRC = "../img/avatars/Mafia/grok_image_1773619750005.jpg";
const NEONVIKTOR_AVATAR_SRC = "../img/avatars/Hacker/grok_image_1773621424855.jpg";
const SABLEQUEEN_AVATAR_SRC = "../img/avatars/Kartel/f7281b4a-f79f-4d76-b975-5153d414208f.jpg";

export const BOUNTY_DEMO_TARGETS = Object.freeze([
  {
    playerId: "dev-bounty-lowkeylad",
    name: "LowKeyLad",
    avatarSrc: LOWKEYLAD_AVATAR_SRC,
    factionLabel: "Street Crew",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 3,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-7", name: "District 7", zone: "Residential", status: "active" },
      { districtId: "district-12", name: "District 12", zone: "Commercial", status: "active" },
      { districtId: "district-21", name: "District 21", zone: "Park", status: "active" }
    ]
  },
  {
    playerId: "dev-bounty-neonviktor",
    name: "NeonViktor",
    avatarSrc: NEONVIKTOR_AVATAR_SRC,
    factionLabel: "Chrome Syndicate",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 2,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-4", name: "District 4", zone: "Industrial", status: "active" },
      { districtId: "district-18", name: "District 18", zone: "Downtown", status: "active" }
    ]
  },
  {
    playerId: "dev-bounty-sablequeen",
    name: "SableQueen",
    avatarSrc: SABLEQUEEN_AVATAR_SRC,
    factionLabel: "Night Market",
    allianceId: null,
    isAlly: false,
    isSelf: false,
    activeDistrictCount: 4,
    canTarget: true,
    disabledReason: null,
    districts: [
      { districtId: "district-2", name: "District 2", zone: "Residential", status: "active" },
      { districtId: "district-9", name: "District 9", zone: "Commercial", status: "active" },
      { districtId: "district-16", name: "District 16", zone: "Industrial", status: "active" },
      { districtId: "district-24", name: "District 24", zone: "Park", status: "active" }
    ]
  }
]);
