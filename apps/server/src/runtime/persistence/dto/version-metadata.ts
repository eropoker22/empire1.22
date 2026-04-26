/**
 * Responsibility: Version metadata for persistence DTOs and snapshot compatibility.
 * Belongs here: schema versions and compatibility markers for stored records.
 * Does not belong here: gameplay logic or runtime-only diagnostics.
 */
export interface VersionMetadata {
  schemaVersion: number;
  coreVersion: string;
  configVersion: string;
}

