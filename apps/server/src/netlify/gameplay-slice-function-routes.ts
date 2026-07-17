export type GameplaySliceFunctionRoute = "load" | "submit" | "command-result" | "join" | "logout" | "servers" | "matchmaking-reserve";

export const resolveGameplaySliceFunctionRoute = (
  path: string
): GameplaySliceFunctionRoute | null => {
  const segments = String(path || "").split("/").filter(Boolean);
  if (segments.at(-2) === "matchmaking" && segments.at(-1) === "reserve") {
    return "matchmaking-reserve";
  }

  const lastSegment = segments.at(-1);
  return lastSegment === "load" ||
    lastSegment === "submit" ||
    lastSegment === "command-result" ||
    lastSegment === "join" ||
    lastSegment === "logout" ||
    lastSegment === "servers"
    ? lastSegment
    : null;
};
