export const ALLIANCE_DEMO_DATA = Object.freeze({
  members: Object.freeze([
    Object.freeze({ key: "current", name: "Ty", role: "member", status: "active", presence: "online",
      activeDistrictCount: 3, avatarFactionId: "mafian" }),
    Object.freeze({ key: "leader", playerId: "dev-demo-zabijaci-leader", name: "NeonRaven", role: "leader",
      status: "active", presence: "offline", activeDistrictCount: 5, avatarFactionId: "kartel" }),
    Object.freeze({ key: "shadow", playerId: "dev-demo-zabijaci-shadow", name: "GhostByte", role: "member",
      status: "active", presence: "offline", activeDistrictCount: 2, avatarFactionId: "hackeri" })
  ]),
  inviteTargetNames: Object.freeze(["ViperHex", "BlazeZero", "KnoxFlux", "JaxCircuit", "ShadowGrid", "MaddoxChrome"]),
  pendingInvites: Object.freeze([
    Object.freeze({ inviteId: "dev-demo-sent-invite-razor", targetPlayerId: "dev-demo-invite-razor",
      targetName: "Razor", ageMs: 12 * 60 * 1000 }),
    Object.freeze({ inviteId: "dev-demo-sent-invite-nyx", targetPlayerId: "dev-demo-invite-nyx",
      targetName: "Nyx", ageMs: 48 * 60 * 1000 })
  ]),
  incomingInvites: Object.freeze([
    Object.freeze({ inviteId: "dev-demo-incoming-iron-crown", allianceId: "dev-demo-alliance-iron-crown",
      allianceName: "Iron Crown", allianceTag: "CROWN", invitedByPlayerId: "dev-demo-leader-viktor",
      invitedByName: "Viktor", ageMs: 18 * 60 * 1000 }),
    Object.freeze({ inviteId: "dev-demo-incoming-ghost-market", allianceId: "dev-demo-alliance-ghost-market",
      allianceName: "Ghost Market", allianceTag: "GHOST", invitedByPlayerId: "dev-demo-leader-mira",
      invitedByName: "Mira", ageMs: 2 * 60 * 60 * 1000 })
  ]),
  publicAlliances: Object.freeze([
    Object.freeze({ allianceId: "dev-demo-public-night-vipers", name: "Night Vipers", tag: "SNAKE",
      emblemColor: "#34d399", ownerPlayerId: "dev-demo-owner-karlos", ownerName: "Karlos", memberCount: 2 }),
    Object.freeze({ allianceId: "dev-demo-public-raven-syndicate", name: "Raven Syndicate", tag: "RAVEN",
      emblemColor: "#ff3f8f", ownerPlayerId: "dev-demo-owner-sable", ownerName: "Sable", memberCount: 3 }),
    Object.freeze({ allianceId: "dev-demo-public-skull-yard", name: "Skull Yard", tag: "SKULL",
      emblemColor: "#ff2f5f", ownerPlayerId: "dev-demo-owner-drake", ownerName: "Drake", full: true })
  ]),
  activeAlliance: Object.freeze({
    allianceId: "dev-demo-alliance-zabijaci",
    name: "Zabijáci",
    tag: "REAPER",
    emblemColor: "#ff2f5f",
    ownerPlayerId: "dev-demo-zabijaci-leader",
    chatMessageId: "dev-demo-alliance-chat-1",
    chatBody: "Zabijáci jsou připraveni."
  })
});
