const globalScope = typeof window !== "undefined" ? window : globalThis;

export const getEmpireDataNamespace = () => {
  const existingNamespace = globalScope.EmpireData && typeof globalScope.EmpireData === "object"
    ? globalScope.EmpireData
    : {};

  globalScope.EmpireData = existingNamespace;
  return existingNamespace;
};

export const registerEmpireData = (key, value) => {
  const namespace = getEmpireDataNamespace();
  namespace[key] = value;
  return value;
};
