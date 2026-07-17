export const isExplicitLocalDemoEnabled = () => {
  const host = String(globalThis.location?.hostname || "").toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  return loopback && globalThis.EmpireConfigOverrides?.localDemoEnabled === true;
};
