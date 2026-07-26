import type { PostgresQueryable } from "./postgres-client";

export const PRODUCTION_MIGRATION_CONTRACT = [
  ["001_initial_runtime_persistence.sql", "dc69af8d1e768f043d2e798e2b91c25a063e96d6acd92d58a9670eff7ca01f39"],
  ["002_command_reservations.sql", "252a68b513b87de96d1ed2c7ecdc919f4cc04c7439c026f85884fc4cfac4bc3f"],
  ["003_gameplay_identity_sessions.sql", "dbaf35366990a167c4b13c0234cc5b6ec76bebb9effde1794e08426fb3febb08"],
  ["004_atomic_command_execution.sql", "bcf38e7b7aee9437134122b3ace58e4627131989c5450b6ff512c59da18a12f8"],
  ["005_gameplay_identity_session_invariants.sql", "114d0bc150640b6fbed017a233edea7d726daa70d412aa8c23e93ceef52006ba"],
  ["006_admin_read_only_control_plane.sql", "dd642a133102ab66928627e0b99530e8a455313a66b69fd2e0472858262db904"],
  ["007_hosted_server_control_plane.sql", "a473d59eb1cdef82ab15985242884ab339bdf74027fe87a1070ec987f4267959"],
  ["008_hosted_join_reservations.sql", "2ac161ceb55a280f3f7d2f9c99c693ad2947a63d4adddff86c17f1f9582eb4a9"],
  ["009_player_entry_control_plane.sql", "c44b20749e717848043c6c67c234fa40836ff50855153e83d2b4562a83109197"],
  ["010_runtime_instance_foreign_keys.sql", "e81c428ee7e2172f289d2aa72e42a9717d2f36374837eeecbc1e5550eb5a1c3a"],
  ["011_hosted_runtime_lease_incarnation.sql", "0dff42cf24f0cd496396be8ce6ba1805a53eb82009b18d4354e19a82a753ef39"],
  ["012_hosted_server_registration_lifecycle.sql", "d953586be246675f4308dbf6ab7c90034a33d35dd2ee61e1aa38bde655303085"],
  ["013_account_auth_throttle.sql", "abd403bc05b289de698cb185339f6dd37c06915f65924061dfbfc58f5812d2bf"],
  ["014_hosted_match_results.sql", "34eeced3fb1cc24c8b79f032eb7f89068dcfaf243346d701308eeb1fee8834e8"],
  ["015_account_age_requirement.sql", "c3cf5a53a903324aef99f6d9e78bcda3df383e0d5f1fa19f6c730c03222c04ee"],
  ["016_free_mode_ten_second_tick.sql", "441a6a9fcad15933b5d5f17902ce7478d9b680000cfe18a948efcaf6d0fa7ac2"],
  ["017_snapshot_recovery_heads_and_checkpoints.sql", "2d444076d8d4a9b48cf14fc7f25905e9efc3c9d42d63d958cfcbd076f803f78a"],
  ["018_drop_redundant_snapshot_head_tick_index.sql", "aba373b9727a39d592edc24270cc4a25fce35420a8f4fe9dbe2b71d7bb0e14df"],
  ["019_drop_redundant_snapshot_head_root_version_index.sql", "648eae11d66cd5719ea1d70c63bb3f78daaa462d16af17c747635a573d0a2775"],
  ["020_hosted_player_job_incarnation_fencing.sql", "4878adbe92dead29abb1aa3f360acd119ab53c6766174f7611ece1c7c37dde2b"]
] as const;

export const isProductionSchemaCurrent = async (
  database: PostgresQueryable
): Promise<boolean> => {
  try {
    const result = await database.query<{ filename: string; checksum: string }>(
      "SELECT filename, checksum FROM empire_schema_migrations ORDER BY filename"
    );
    if (result.rows.length !== PRODUCTION_MIGRATION_CONTRACT.length) return false;
    return PRODUCTION_MIGRATION_CONTRACT.every(([filename, checksum], index) => {
      const row = result.rows[index];
      return row?.filename === filename && row.checksum === checksum;
    });
  } catch (_error) {
    return false;
  }
};
