export const requiresHostedRuntimeAuthority = (
  environment?: Record<string, string | undefined>
): boolean =>
  environment?.NODE_ENV === "production"
  || environment?.EMPIRE_HOSTED_RUNTIME_AUTHORITY_ENABLED === "true";
