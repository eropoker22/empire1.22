import { CITY_EVENT_CONFIG } from "../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";

const agentNames = Object.freeze({
  victor: "Victor Grave Kadeř",
  leon: "Leon Switch Varga",
  nyra: "Nyra Vale"
});

function createLegacyEventView(definition) {
  const agentId = String(definition?.agentId || "");
  return Object.freeze({
    id: String(definition?.id || ""),
    agentId,
    title: String(definition?.title || ""),
    giver: agentNames[agentId] || agentId,
    text: String(definition?.description || ""),
    description: String(definition?.description || ""),
    difficulty: String(definition?.difficulty || "medium"),
    successRate: Number(definition?.successRate || 0),
    durationMinutes: Number(definition?.durationMinutes || 0),
    reward: Object.freeze({ ...(definition?.reward || {}) }),
    risk: Object.freeze({ ...(definition?.risk || {}) })
  });
}

const definitions = Object.freeze(
  (Array.isArray(CITY_EVENT_CONFIG?.definitions) ? CITY_EVENT_CONFIG.definitions : [])
    .map(createLegacyEventView)
);

function byAgent(agentId) {
  return Object.freeze(definitions.filter((definition) => definition.agentId === agentId));
}

// Compatibility exports for the legacy page data registry. Balance lives only in CITY_EVENT_CONFIG.
export const victorGraveEvents = byAgent("victor");
export const leonSwitchVargaEvents = byAgent("leon");
export const nyraValeEvents = byAgent("nyra");
