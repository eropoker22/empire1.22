export const SERVER_PRODUCTION_POPUP_COMMAND_OWNER = "server-gameplay-production-controller";

const ownersByPopup = new WeakMap();

export function registerServerProductionPopupOwner(popup, owner) {
  if (!popup || typeof owner?.open !== "function" || ownersByPopup.has(popup)) {
    return false;
  }
  ownersByPopup.set(popup, owner);
  popup.dataset.productionCommandOwner = SERVER_PRODUCTION_POPUP_COMMAND_OWNER;
  return true;
}

export function unregisterServerProductionPopupOwner(popup, owner) {
  if (!popup || ownersByPopup.get(popup) !== owner) {
    return false;
  }
  ownersByPopup.delete(popup);
  if (popup.dataset.productionCommandOwner === SERVER_PRODUCTION_POPUP_COMMAND_OWNER) {
    delete popup.dataset.productionCommandOwner;
  }
  return true;
}

export function hasServerProductionPopupOwner(popup) {
  return Boolean(popup && ownersByPopup.has(popup));
}

export function openServerProductionPopup(popup, buildingId) {
  const owner = popup ? ownersByPopup.get(popup) : null;
  if (!owner || !String(buildingId || "").trim()) {
    return false;
  }
  return owner.open(String(buildingId));
}

export function syncServerProductionPopupIdentity(popup, building, readModel) {
  if (!popup) return;
  popup.dataset.uiOwner = "legacy-shared";
  popup.dataset.executionMode = "server-authoritative";
  popup.dataset.serverInstanceId = String(
    readModel?.server?.serverInstanceId
    || readModel?.player?.instanceId
    || ""
  );
  popup.dataset.serverDistrictId = String(readModel?.district?.districtId || "");
  popup.dataset.serverBuildingId = String(building?.buildingId || "");
  popup.dataset.serverBuildingTypeId = String(building?.buildingTypeId || "");
}
