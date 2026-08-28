import type { Player, PlayerFactionId } from "@empire/shared-types";

export const DEV_BOUNTY_DEMO_TARGETS = [
  {
    playerId: "player:live-bounty-target",
    name: "LowKeyLad",
    color: "#ec4899",
    factionId: "kartel" as const
  },
  {
    playerId: "player:demo-bounty-neon-viktor",
    name: "NeonViktor",
    color: "#06b6d4",
    factionId: "mafian" as const
  },
  {
    playerId: "player:demo-bounty-sable-queen",
    name: "SableQueen",
    color: "#8b5cf6",
    factionId: "hackeri" as const
  }
] satisfies Array<{
  playerId: string;
  name: string;
  color: Player["color"];
  factionId: PlayerFactionId;
}>;
