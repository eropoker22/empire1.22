export function presentServerBuildingActionResponse({
  response,
  action,
  actionProfile,
  definition,
  context,
  root,
  shell
} = {}, deps = {}) {
  if (!response?.accepted) {
    const message = response?.errors
      ?.map((error) => error?.message || error?.code)
      .filter(Boolean)
      .join(" · ")
      || "Server akci odmítl.";
    deps.setFeedback?.(root, "warning", action, message, context?.buildingName);
    return false;
  }

  const reportSummary = response?.readModel?.reports?.[0]?.summary
    || response?.readModel?.reports?.[0]?.description
    || response?.readModel?.reports?.[0]?.title
    || actionProfile?.summary
    || definition?.rewardSummary
    || "Server akci přijal.";
  deps.setFeedback?.(
    root,
    "success",
    action,
    reportSummary,
    context?.district?.id
      ? `${context.buildingName} · District ${context.district.id}`
      : context?.buildingName
  );
  if (shell) {
    deps.refreshBuildingDetail?.(root, shell);
  }
  return true;
}
