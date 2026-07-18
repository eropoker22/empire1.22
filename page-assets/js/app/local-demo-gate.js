const isLoopbackLocation = (locationRef) => {
  const host = String(locationRef?.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
};

const LOCAL_DEMO_SESSION_KEY = "empire:local-demo-session:v1";

export const isLocalDemoAccessAvailable = (locationRef = globalThis.location) => isLoopbackLocation(locationRef);

export const isExplicitLocalDemoEnabled = (options = {}) => {
  const locationRef = options.locationRef || globalThis.location;
  const configOverrides = options.configOverrides || globalThis.EmpireConfigOverrides;
  const sessionStorageRef = options.sessionStorageRef || globalThis.sessionStorage;
  const requestedMode = new URLSearchParams(String(locationRef?.search || "")).get("runtimeMode");
  if (requestedMode === "server-authoritative") {
    sessionStorageRef?.removeItem?.(LOCAL_DEMO_SESSION_KEY);
    return false;
  }
  if (requestedMode === "local-demo") {
    sessionStorageRef?.setItem?.(LOCAL_DEMO_SESSION_KEY, "1");
    return true;
  }

  if (!isLocalDemoAccessAvailable(locationRef)) {
    return sessionStorageRef?.getItem?.(LOCAL_DEMO_SESSION_KEY) === "1";
  }

  return configOverrides?.localDemoEnabled === true
    || sessionStorageRef?.getItem?.(LOCAL_DEMO_SESSION_KEY) === "1";
};

export const isExplicitGamePreviewEnabled = (locationRef = globalThis.location) => {
  if (!isLoopbackLocation(locationRef)) return false;
  try {
    return new URLSearchParams(String(locationRef?.search || "")).get("devPreview") === "1";
  } catch (_error) {
    return false;
  }
};
