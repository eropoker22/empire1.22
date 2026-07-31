import type { CoreGameState } from "../entities";

export const resolveAllianceChatVisibility = (
  message: NonNullable<CoreGameState["allianceChatMessagesById"]>[string]
): "members" | "public" => message.visibility === "public"
  || message.id.startsWith("alliance-public-chat:") ? "public" : "members";
