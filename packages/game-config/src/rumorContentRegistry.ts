import type { RumorAudience, RumorCategory, RumorConfidence, RumorIntensityBand } from "@empire/shared-types";
import rawRumorTemplates from "../content/rumor-templates.json";

export interface RumorTemplate {
  id: string;
  category: RumorCategory;
  confidence: RumorConfidence;
  allowedAudiences: RumorAudience[];
  allowedSourceBuildings: string[];
  minIntensity?: RumorIntensityBand;
  maxIntensity?: RumorIntensityBand;
  text: string;
  expiresAfterSeconds: number;
  revealsPlayerName: boolean;
  revealsAllianceName: boolean;
  revealsDistrictName: boolean;
  weight?: number;
  priority?: number;
}

export const ALLOWED_RUMOR_PLACEHOLDERS = Object.freeze([
  "districtName",
  "zoneName",
  "playerName",
  "allianceName",
  "marketCategory"
] as const);

export const RUMOR_CONTENT_SOURCE = "docs/content/empire-streets-rumor-library.md";

export const RUMOR_TEMPLATES: readonly RumorTemplate[] = Object.freeze(rawRumorTemplates as readonly RumorTemplate[]);

export const RUMOR_TEMPLATES_BY_ID: Readonly<Record<string, RumorTemplate>> = Object.freeze(
  Object.fromEntries(RUMOR_TEMPLATES.map((template) => [template.id, template])) as Record<string, RumorTemplate>
);

export const getRumorTemplates = (input: {
  category: RumorCategory;
  confidence: RumorConfidence;
  audience?: RumorAudience;
  sourceBuildingType?: string;
  intensityBand?: RumorIntensityBand;
}): RumorTemplate[] => RUMOR_TEMPLATES.filter((template) => {
  if (template.category !== input.category || template.confidence !== input.confidence) return false;
  if (input.audience && !template.allowedAudiences.includes(input.audience)) return false;
  if (input.sourceBuildingType && template.allowedSourceBuildings.length > 0 && !template.allowedSourceBuildings.includes(input.sourceBuildingType)) return false;
  if (input.intensityBand && !isIntensityAllowed(template, input.intensityBand)) return false;
  return true;
});

export const validateRumorTemplates = (templates: readonly RumorTemplate[] = RUMOR_TEMPLATES): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const template of templates) {
    if (!template.id || ids.has(template.id)) errors.push(`duplicate_or_empty_id:${template.id}`);
    ids.add(template.id);
    if (!template.text.trim()) errors.push(`empty_text:${template.id}`);
    if (!template.allowedAudiences.length) errors.push(`empty_audience:${template.id}`);
    if (!Number.isFinite(template.expiresAfterSeconds) || template.expiresAfterSeconds < 60 || template.expiresAfterSeconds > 86400) {
      errors.push(`invalid_expiration:${template.id}`);
    }
    for (const placeholder of extractPlaceholders(template.text)) {
      if (!(ALLOWED_RUMOR_PLACEHOLDERS as readonly string[]).includes(placeholder)) {
        errors.push(`unknown_placeholder:${template.id}:${placeholder}`);
      }
    }
    for (const forbidden of ["trap", "past", "pasti", "trapState", "attackPower", "defensePower", "weaponInventory", "dirtyCash", "cleanCash"]) {
      if (template.text.toLowerCase().includes(forbidden.toLowerCase())) {
        errors.push(`forbidden_token:${template.id}:${forbidden}`);
      }
    }
  }
  return errors;
};

export const renderRumorContentTemplate = (
  template: RumorTemplate,
  values: Record<string, string | number | null | undefined> = {}
): string => template.text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_token, key: string) => String(values[key] ?? ""));

const extractPlaceholders = (text: string): string[] => Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((match) => match[1] ?? "");

const intensityOrder: Record<RumorIntensityBand, number> = { low: 1, medium: 2, high: 3 };

const isIntensityAllowed = (template: RumorTemplate, band: RumorIntensityBand): boolean => {
  const value = intensityOrder[band];
  if (template.minIntensity && value < intensityOrder[template.minIntensity]) return false;
  if (template.maxIntensity && value > intensityOrder[template.maxIntensity]) return false;
  return true;
};
