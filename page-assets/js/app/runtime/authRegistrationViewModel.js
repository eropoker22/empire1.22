import { formatCurrency } from "./formatters.js";

function resolveFaction(factionCatalog = {}, factionId = "mafian") {
  return factionCatalog?.[factionId] || factionCatalog?.mafian || {};
}

export function createFactionPreviewViewModel(faction = {}) {
  const startingPackage = faction?.startingPackage || {};
  return {
    name: faction?.name || "",
    tagline: faction?.tagline || "",
    description: faction?.description || "",
    cleanMoneyLabel: formatCurrency(startingPackage.cleanMoney),
    dirtyMoneyLabel: formatCurrency(startingPackage.dirtyMoney),
    influenceLabel: String(startingPackage.influence ?? ""),
    heatLabel: String(startingPackage.heat ?? ""),
    advantages: Array.isArray(faction?.advantages) ? faction.advantages : [],
    disadvantages: Array.isArray(faction?.disadvantages) ? faction.disadvantages : []
  };
}

export function createExistingRegistrationViewModel(existingRegistration = null, factionCatalog = {}) {
  if (!existingRegistration?.factionId || !factionCatalog?.[existingRegistration.factionId]) {
    return {
      locked: false,
      activeFactionId: "mafian",
      identityValue: "",
      identityReadOnly: false,
      optionsDisabled: false,
      statusTitle: "Výběr frakce",
      statusNote: "Vyber frakci před registrací. Po vstupu na server se volba uzamkne a určí startovní zdroje, heat i profil výhod."
    };
  }

  const faction = resolveFaction(factionCatalog, existingRegistration.factionId);
  const identity = existingRegistration.identity || "Host";
  return {
    locked: true,
    activeFactionId: existingRegistration.factionId,
    identityValue: identity,
    identityReadOnly: true,
    optionsDisabled: true,
    statusTitle: "Frakce uzamčena",
    statusNote: `Účet ${identity} už vstoupil do serveru jako ${faction.name}. Frakci už nelze změnit.`
  };
}

export function createLockedRegistrationStatusViewModel(registration = null, factionCatalog = {}) {
  const faction = resolveFaction(factionCatalog, registration?.factionId);
  return {
    title: "Frakce uzamčena",
    note: `Účet ${registration?.identity || "Host"} už má pevně zvolenou frakci ${faction.name}.`
  };
}

export function createCompletedRegistrationStatusViewModel({
  identity = "Host",
  factionId = "mafian",
  lockedAt = "",
  factionCatalog = {}
} = {}) {
  const faction = resolveFaction(factionCatalog, factionId);
  return {
    title: "Registrace dokončena",
    note: `${identity || "Host"} vstoupil do serveru jako ${faction.name}. Frakce je od ${lockedAt} pevně uzamčená.`
  };
}
