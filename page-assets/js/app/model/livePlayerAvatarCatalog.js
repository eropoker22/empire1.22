const LIVE_PLAYER_AVATARS = Object.freeze({
  mafian: ["../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg"],
  kartel: ["../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg"],
  kult: ["../img/avatars/kult/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg"],
  "tajna-organizace": ["../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg"],
  hackeri: ["../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg"],
  "motorkarsky-gang": ["../img/avatars/Motogang/grok_image_1773621173474.jpg"],
  "soukroma-armada": ["../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg"],
  korporace: ["../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg"]
});

export const getLivePlayerAvatarPreviews = (factionId) => (
  LIVE_PLAYER_AVATARS[String(factionId || "")] || []
);

export const resolveLivePlayerAvatarSrc = (avatarId, factionId = "") => {
  const normalizedAvatarId = String(avatarId || "").trim();
  const [avatarFactionId, rawIndex] = normalizedAvatarId.split(":");
  const resolvedFactionId = avatarFactionId || String(factionId || "");
  const avatarIndex = Math.max(0, Number.parseInt(rawIndex || "1", 10) - 1);
  return getLivePlayerAvatarPreviews(resolvedFactionId)[avatarIndex] || "";
};
