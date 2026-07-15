import { ATTACK_WEAPON_IDS, type AttackWeaponId, type DomainError } from "@empire/shared-types";

export const validateAttackWeaponsPayload = (
  errors: DomainError[],
  payload: Record<string, unknown>
): void => {
  if (payload.weapons === undefined) {
    errors.push(createInvalidFieldError("command.payload.weapons", "Výzbroj je pro útok povinná."));
    return;
  }
  if (!isRecord(payload.weapons)) {
    errors.push(createInvalidFieldError("command.payload.weapons", "Výzbroj musí být JSON objekt."));
    return;
  }
  for (const [weaponId, quantity] of Object.entries(payload.weapons)) {
    if (!ATTACK_WEAPON_IDS.includes(weaponId as AttackWeaponId)) {
      errors.push(createInvalidFieldError(`command.payload.weapons.${weaponId}`, "Tato útočná zbraň není dostupná."));
      continue;
    }
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      errors.push(createInvalidFieldError(`command.payload.weapons.${weaponId}`, "Množství zbraně musí být nezáporné celé číslo."));
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const createInvalidFieldError = (fieldPath: string, message: string): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: {
    field: fieldPath
  }
});
