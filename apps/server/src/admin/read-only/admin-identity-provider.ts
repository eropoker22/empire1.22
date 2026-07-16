import type { AdminRole } from "@empire/shared-types";
import type { AdminBootstrapIdentity } from "./admin-repositories";

export interface AdminBootstrapConfiguration {
  secret: string;
  fingerprintSecret: string;
  identity: AdminBootstrapIdentity;
}

export interface AdminIdentityProvider {
  readonly kind: "closed-alpha-bootstrap" | "production-identity";
  getBootstrapConfiguration(): AdminBootstrapConfiguration | null;
}

export const createEnvironmentAdminIdentityProvider = (
  environment: Record<string, string | undefined>
): AdminIdentityProvider => ({
  kind: "closed-alpha-bootstrap",
  getBootstrapConfiguration: () => {
    const production = environment.NODE_ENV === "production";
    if (production && environment.EMPIRE_ADMIN_BOOTSTRAP_ENABLED !== "true") return null;
    const secret = String(environment.EMPIRE_ADMIN_BOOTSTRAP_SECRET ?? (production ? "" : "empire-admin-local")).trim();
    const fingerprintSecret = String(environment.EMPIRE_ADMIN_FINGERPRINT_SECRET ?? secret).trim();
    const actorId = String(environment.EMPIRE_ADMIN_ACTOR_ID ?? (production ? "" : "admin:local")).trim();
    const displayName = String(environment.EMPIRE_ADMIN_DISPLAY_NAME ?? (production ? "" : "Local Admin")).trim();
    if (!secret || !fingerprintSecret || !actorId || !displayName) return null;
    return { secret, fingerprintSecret, identity: { actorId, displayName, role: role(environment.EMPIRE_ADMIN_ROLE), authenticationMethod: "closed-alpha-bootstrap" } };
  }
});

const role = (value: string | undefined): AdminRole => value === "owner" || value === "operator" ? value : "viewer";
