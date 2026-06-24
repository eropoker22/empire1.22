export type GameplaySliceFunctionRoute = "load" | "submit" | "join" | "logout" | "servers" | "matchmaking-reserve" | "admin-monitoring";

export const resolveGameplaySliceFunctionRoute = (
  path: string
): GameplaySliceFunctionRoute | null => {
  const segments = String(path || "").split("/").filter(Boolean);
  if (segments.at(-2) === "admin" && segments.at(-1) === "monitoring") {
    return "admin-monitoring";
  }
  if (segments.at(-2) === "matchmaking" && segments.at(-1) === "reserve") {
    return "matchmaking-reserve";
  }

  const lastSegment = segments.at(-1);
  return lastSegment === "load" ||
    lastSegment === "submit" ||
    lastSegment === "join" ||
    lastSegment === "logout" ||
    lastSegment === "servers" ||
    lastSegment === "admin-monitoring"
    ? lastSegment
    : null;
};
