export const createHeistTargetActionOptions = (target, key, createBaseOptions) => {
  const base = createBaseOptions(target, key);
  if (target.enabled !== true) return base;
  const style = target.styles?.find((entry) => entry.style === target.recommendedStyle)
    || target.styles?.find((entry) => entry.enabled !== false)
    || target.styles?.[0]
    || null;
  const population = Math.max(0, Number(style?.defaultPopulationSent || style?.minMembers || 0));
  const styleLabel = String(style?.label || style?.style || "doporučený plán");
  const launchCopy = `${styleLabel} · ${population} lidí · verdikt po odpočtu`;
  return { ...base, stacked: true, subtitle: launchCopy, title: `Kliknutí okamžitě vyšle ${launchCopy}.` };
};
