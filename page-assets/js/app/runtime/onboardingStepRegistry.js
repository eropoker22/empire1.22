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
    body: "Město svítí, ale nikomu neodpouští. Tohle demo tě provede prvním loopem.",
    task: "Začni průchod.",
    taskLabel: "Start",
    cta: "Začít"
  }),
  Object.freeze({
    id: "your-district",
    title: "Otevři svůj district",
    phase: "Mapa",
    badge: "MAP",
    kind: "map",
    subtitle: "",
    body: "District je tvoje základna. Otevři vlastní území a sleduj, co držíš.",
    targetSelector: "[data-mount-role=\"map\"], [data-district-canvas], [data-map-canvas], canvas",
    completionCondition: "district:own-opened",
    fallbackTitle: "Mapa zatím není připravená.",
    fallbackBody: "Jakmile se mapa načte, otevři vlastní district.",
    highlightType: "map",
    task: "Otevři vlastní district.",
    taskLabel: "Mapa",
    targetLabel: "Tvoje území",
    cta: "Ukázat district"
  }),
  Object.freeze({
    id: "building-action",
    title: "Spusť první akci",
    phase: "Akce",
    badge: "BUILD",
    kind: "resource",
    subtitle: "",
    body: "Tvoje území vydělává přes budovy. Spusť první akci a potvrď ji, pokud se město zeptá.",
    targetSelector: "[data-building-action-building-id][data-building-action-id], [data-building-action-state], [data-building-action-feed], [data-district-popup-buildings], [data-building-card]",
    completionCondition: "building-action:feedback",
    fallbackTitle: "Akce budovy zatím není vidět.",
    fallbackBody: "Otevři svůj district, vyber budovu a spusť akci s viditelným statusem.",
    highlightType: "resource",
    task: "Spusť a potvrď akci budovy.",
    taskLabel: "Akce",
    targetLabel: "Akce budovy",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "heat-police",
    title: "Zkontroluj heat a policii",
    phase: "Riziko",
    badge: "HEAT",
    kind: "danger",
    subtitle: "",
    body: "Policie sleduje horká místa. Čím víc riskuješ, tím víc roste heat.",
    targetSelector: "[data-gang-heat], [data-police-feed], [data-wanted-panel], .profile-heat-panel",
    completionCondition: "heat-police:checked",
    fallbackTitle: "Heat panel zatím není otevřený.",
    fallbackBody: "Po riskantní akci zkontroluj heat nebo police feed.",
    highlightType: "danger",
    task: "Zkontroluj heat nebo police feed.",
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
    body: "Špehování není okamžité. Pošli lidi do ulic a sleduj návrat nebo cooldown.",
    targetSelector: "[data-district-action-id=\"spy\"], [data-spy-confirm], [data-spy-confirm-popup], [data-building-action-state], [data-building-action-summary]",
    completionCondition: "spy:started",
    fallbackTitle: "Špeh teď není dostupný.",
    fallbackBody: "Otevři vhodný cizí district a použij dostupnou špionáž.",
    highlightType: "intel",
    task: "Pošli špeha na cíl.",
    taskLabel: "Špeh",
    targetLabel: "Špeh",
    cta: "Rozumím"
  }),
  Object.freeze({
    id: "attack-order",
    title: "Zadej útok nebo rozkaz",
    phase: "Rozkaz",
    badge: "ORDER",
    kind: "danger",
    subtitle: "",
    body: "Rozkaz je venku až po potvrzení. Po startu sleduj čas návratu a reakci města.",
    targetSelector: "[data-district-action-id=\"attack\"], [data-district-action-id=\"occupy\"], [data-attack-confirm], [data-attack-confirm-popup], [data-building-action-state], [data-building-action-summary]",
    completionCondition: "attack-order:started",
    fallbackTitle: "Bojový rozkaz teď není dostupný.",
    fallbackBody: "Otevři cíl, který dovolí útok nebo jiný bojový rozkaz.",
    highlightType: "danger",
    task: "Zadej útok nebo rozkaz.",
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
    body: "Základní demo loop znáš.",
    summaryItems: Object.freeze([
      "District vydělává",
      "Heat přitahuje policii",
      "Rozkazy běží v čase"
    ]),
    targetSelector: "[data-mount-role=\"map\"], [data-map-canvas], #game-root",
    completionCondition: "manual",
    fallbackTitle: "Pokračuj z mapy.",
    fallbackBody: "Vrať se na mapu a opakuj demo loop podle situace.",
    highlightType: "objective",
    task: "Pokračuj ve hře.",
    taskLabel: "Shrnutí",
    cta: "Pokračovat ve hře"
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
