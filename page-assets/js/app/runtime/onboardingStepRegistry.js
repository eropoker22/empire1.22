export const ONBOARDING_VERSION = "demo-v1-clean";

export const ONBOARDING_REQUIRED_STEP_IDS = Object.freeze([
  "welcome",
  "your-district",
  "building-action",
  "heat-police",
  "spy",
  "attack-order",
  "done"
]);

const STEP_DEFAULTS = Object.freeze({
  placement: "bottom-right",
  completionCondition: "manual",
  canSkip: true,
  highlightType: "none",
  targetSelector: null
});

const ONBOARDING_STEPS_DATA = Object.freeze([
  Object.freeze({
    id: "welcome",
    title: "Vítej v ulicích",
    phase: "Start",
    badge: "DEMO",
    kind: "system",
    subtitle: "",
    body: "Město svítí, ale nikomu neodpouští.",
    task: "Začni.",
    taskLabel: "Start",
    cta: "Začít"
  }),
  Object.freeze({
    id: "your-district",
    title: "Otevři district",
    phase: "Mapa",
    badge: "MAP",
    kind: "map",
    subtitle: "",
    body: "Tady začíná tvoje území.",
    targetSelector: "[data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas], canvas",
    completionCondition: "district:own-opened",
    fallbackTitle: "District není vidět.",
    fallbackBody: "Zkus otevřít svoje území z mapy.",
    highlightType: "map",
    task: "Otevři district.",
    taskLabel: "Mapa",
    targetLabel: "Tvoje území",
    cta: "Ukázat"
  }),
  Object.freeze({
    id: "building-action",
    title: "Spusť akci",
    phase: "Akce",
    badge: "BUILD",
    kind: "resource",
    subtitle: "",
    body: "Budovy vydělávají, když je rozhýbeš.",
    targetSelector: "[data-building-action-building-id][data-building-action-id], [data-building-action-state], [data-building-action-feed], [data-district-popup-buildings], [data-building-card]",
    completionCondition: "building-action:feedback",
    fallbackTitle: "Akce není vidět.",
    fallbackBody: "Otevři district a vyber budovu.",
    highlightType: "resource",
    task: "Spusť akci budovy.",
    taskLabel: "Akce",
    targetLabel: "Akce budovy",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "heat-police",
    title: "Sleduj heat",
    phase: "Riziko",
    badge: "HEAT",
    kind: "danger",
    subtitle: "",
    body: "Čím víc riskuješ, tím víc tě řeší policie.",
    targetSelector: "[data-gang-heat], [data-police-feed], [data-wanted-panel], .profile-heat-panel",
    completionCondition: "heat-police:checked",
    fallbackTitle: "Heat není vidět.",
    fallbackBody: "Zkontroluj heat nebo police feed.",
    highlightType: "danger",
    task: "Sleduj heat.",
    taskLabel: "Policie",
    targetLabel: "Heat",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "spy",
    title: "Pošli špehy",
    phase: "Intel",
    badge: "SPY",
    kind: "intel",
    subtitle: "",
    body: "Špehování běží v čase. Počkej na návrat.",
    targetSelector: "[data-district-action-id=\"spy\"], [data-spy-confirm], [data-spy-confirm-popup], [data-building-action-state], [data-building-action-summary]",
    completionCondition: "spy:started",
    fallbackTitle: "Špeh teď není dostupný.",
    fallbackBody: "Otevři cizí district a zkus špionáž.",
    highlightType: "intel",
    task: "Pošli špehy.",
    taskLabel: "Špeh",
    targetLabel: "Špeh",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "attack-order",
    title: "Zadej rozkaz",
    phase: "Rozkaz",
    badge: "ORDER",
    kind: "danger",
    subtitle: "",
    body: "Útok není kliknutí. Je to rozkaz do ulic.",
    targetSelector: "[data-district-action-id=\"attack\"], [data-district-action-id=\"occupy\"], [data-attack-confirm], [data-attack-confirm-popup], [data-building-action-state], [data-building-action-summary]",
    completionCondition: "attack-order:started",
    fallbackTitle: "Rozkaz teď není dostupný.",
    fallbackBody: "Otevři cíl, který dovolí útok.",
    highlightType: "danger",
    task: "Zadej rozkaz.",
    taskLabel: "Rozkaz",
    targetLabel: "Útok",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "done",
    title: "Hotovo",
    phase: "Závěr",
    badge: "LOOP",
    kind: "objective",
    subtitle: "",
    body: "Základ znáš. Teď rozšiř vliv.",
    targetSelector: "[data-mount-role=\"map\"], [data-map-canvas], #game-root",
    completionCondition: "manual",
    fallbackTitle: "Město čeká.",
    fallbackBody: "Vrať se na mapu.",
    highlightType: "objective",
    task: "Pokračuj.",
    taskLabel: "Shrnutí",
    cta: "Pokračovat"
  })
]);

export const ONBOARDING_STEPS = Object.freeze(ONBOARDING_STEPS_DATA.map((step) =>
  Object.freeze({
    ...STEP_DEFAULTS,
    ...step
  })
));

export function getOnboardingStep(stepId) {
  return ONBOARDING_STEPS.find((step) => step.id === stepId) || null;
}

export function getOnboardingStepIndex(stepId) {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}

export function getOnboardingTargetSelector(stepId) {
  return getOnboardingStep(stepId)?.targetSelector || null;
}
