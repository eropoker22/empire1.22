import {
  publicServerInstanceIdMigrationMap as runtimePublicServerInstanceIdMigrationMap,
  publicServerRegistry as runtimePublicServerRegistry,
  resolvePublicServerInstanceId as runtimeResolvePublicServerInstanceId
} from "./public-server-registry.js";

export type PublicServerMode = "free" | "war";
export type PublicServerJoinPolicy = "open" | "closed";

export interface PublicServerMapComposition {
  readonly downtown: 8;
  readonly commercial: number;
  readonly industrial: number;
  readonly residential: number;
  readonly park: number;
}

export interface PublicServerRegistryEntry {
  readonly serverInstanceId: string;
  readonly mode: PublicServerMode;
  readonly region: string;
  readonly displayName: string;
  readonly capacity: number;
  readonly mapComposition: PublicServerMapComposition;
  readonly joinPolicy: PublicServerJoinPolicy;
  readonly isPublic: boolean;
  readonly legacyAliases: readonly string[];
}

export const publicServerRegistry =
  runtimePublicServerRegistry as readonly PublicServerRegistryEntry[];

export const publicServerInstanceIdMigrationMap =
  runtimePublicServerInstanceIdMigrationMap as Readonly<Record<string, string>>;

export const resolvePublicServerInstanceId =
  runtimeResolvePublicServerInstanceId as (serverInstanceId: string) => string;
