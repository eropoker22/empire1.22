const selectionsByMount = new WeakMap();

const getSelections = (mount) => {
  if (!mount || (typeof mount !== "object" && typeof mount !== "function")) return null;
  let selections = selectionsByMount.get(mount);
  if (!selections) {
    selections = new Map();
    selectionsByMount.set(mount, selections);
  }
  return selections;
};

export const readProductionQuantitySelection = (mount, key) => Math.max(
  1,
  Math.floor(Number(getSelections(mount)?.get(String(key || "production")) || 1))
);

export const writeProductionQuantitySelection = (mount, key, quantity) => {
  const selections = getSelections(mount);
  if (!selections) return 1;
  const normalized = Math.max(1, Math.floor(Number(quantity || 1)));
  selections.set(String(key || "production"), normalized);
  return normalized;
};

export const clearProductionQuantitySelection = (mount, key) => (
  getSelections(mount)?.delete(String(key || "production")) || false
);
