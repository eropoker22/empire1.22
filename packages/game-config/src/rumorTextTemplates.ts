export const RUMOR_DISTRICT_FALLBACK = "jedné z horkých čtvrtí";

export const RUMOR_TEXT_TEMPLATES = Object.freeze({
  attack_success: Object.freeze([
    "Ve čtvrti {district} se změnila rovnováha sil. Někdo tam šel tvrdě po kontrole.",
    "Z {district} přišly zprávy o přestřelce. Majitelé se tam možná měnili."
  ]),
  attack_fail: Object.freeze([
    "U {district} někdo narazil. Ulice si pamatují neúspěšné útoky.",
    "Gang se pokusil prorazit do {district}, ale vrátil se s prázdnou."
  ]),
  district_capture: Object.freeze([
    "{district} má nového pána. Město to ucítilo okamžitě.",
    "Kontrola nad {district} se přelila do jiných rukou."
  ]),
  police_warning: Object.freeze([
    "Hlídky v okolí {district} houstnou. Někdo dělá příliš mnoho hluku.",
    "Policie začíná sledovat horké body města."
  ]),
  police_raid: Object.freeze([
    "Razie zasáhla {district}. Špinavé peníze tam nezůstaly dlouho schované.",
    "Sirény přehlušily neon. Policie si vybrala svůj cíl."
  ]),
  black_market: Object.freeze([
    "Na černém trhu se otočil větší balík. Nikdo neříká jména nahlas.",
    "Někdo nakoupil zboží, které se v oficiálních skladech nevede."
  ]),
  trap: Object.freeze([
    "V {district} někdo vstoupil do špatných dveří. Past sklapla.",
    "Ulice v {district} byly připravené. Útočníci ne."
  ]),
  robbery: Object.freeze([
    "Z {district} zmizelo zboží. Nikdo nic neviděl.",
    "Někdo v {district} přišel o zásoby. Město se směje potichu."
  ])
});

export type RumorTextTemplateKey = keyof typeof RUMOR_TEXT_TEMPLATES;

export const renderRumorTemplate = (
  template: string,
  values: Record<string, string | number | null | undefined> = {}
): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_token, key) => {
    const value = values[key];
    return String(value ?? (key === "district" ? RUMOR_DISTRICT_FALLBACK : ""));
  });

export const resolveRumorTemplate = (
  key: RumorTextTemplateKey,
  selector = 0,
  values: Record<string, string | number | null | undefined> = {}
): string => {
  const templates = RUMOR_TEXT_TEMPLATES[key] ?? RUMOR_TEXT_TEMPLATES.police_warning;
  const index = Math.abs(Math.floor(Number(selector) || 0)) % templates.length;
  return renderRumorTemplate(templates[index], values);
};
