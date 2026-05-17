export interface ServerInstanceLobbyMetadata {
  displayName: string;
  region: string;
  maxPlayers: number;
  joinPolicy: "open" | "closed";
}
