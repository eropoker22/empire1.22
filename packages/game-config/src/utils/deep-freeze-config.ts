/**
 * Responsibility: Freezes resolved config objects to avoid accidental runtime mutation.
 * Belongs here: small config hardening utility used by the resolver.
 * Does not belong here: mode lookup logic or environment loading.
 */
export const deepFreezeConfig = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);

    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreezeConfig(child);
      }
    }
  }

  return value;
};

