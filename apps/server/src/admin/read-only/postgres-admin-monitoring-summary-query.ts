export const adminMonitoringInstanceSummaryQuery = (where: string): string => `
  SELECT si.server_instance_id, si.mode, si.status,
    NULL::jsonb AS payload,
    NULL::jsonb AS snapshot_payload,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(si.payload,'displayName') END AS instance_display_name,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(si.payload,'region') END AS instance_region,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(si.payload,'capacity') END AS instance_capacity,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(si.payload,'joinPolicy') END AS instance_join_policy,
    sl.tick AS snapshot_tick,
    sl.root_version AS snapshot_state_version,
    CASE
      WHEN hsi.server_instance_id IS NOT NULL
      THEN COALESCE(membership_players.player_count,0)
      WHEN jsonb_typeof(jsonb_extract_path(sl.payload,'state','root','playerIds'))='array'
      THEN jsonb_array_length(jsonb_extract_path(sl.payload,'state','root','playerIds'))
      ELSE 0
    END AS snapshot_player_count,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(sl.payload,'metadata','lastCrashAt') END AS snapshot_last_crash_at,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(sl.payload,'lobby','displayName') END AS snapshot_lobby_display_name,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(sl.payload,'lobby','region') END AS snapshot_lobby_region,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(sl.payload,'lobby','capacity') END AS snapshot_lobby_capacity,
    CASE WHEN hsi.server_instance_id IS NULL
      THEN jsonb_extract_path_text(sl.payload,'lobby','joinPolicy') END AS snapshot_lobby_join_policy,
    sl.created_at AS snapshot_created_at,
    COALESCE(ih.last_heartbeat_at, hsi.last_worker_heartbeat_at) AS heartbeat_at,
    hsi.runtime_lease_owner_id AS lock_owner,
    hsi.runtime_lease_incarnation_id AS lease_incarnation_id,
    hsi.runtime_lease_expires_at AS locked_until,
    ih.worker_id AS heartbeat_worker_id,
    worker.worker_incarnation_id AS heartbeat_worker_incarnation_id,
    hsi.display_name AS hosted_display_name, hsi.region AS hosted_region,
    hsi.capacity AS hosted_capacity, hsi.join_policy AS hosted_join_policy,
    hsi.status AS hosted_status, hsi.canonical_tick_rate_ms,
    hsi.starting_player_state AS hosted_starting_player_state,
    (SELECT max(dl.created_at) FROM empire_diagnostic_log dl
      WHERE dl.server_instance_id = si.server_instance_id AND dl.level = 'error') AS last_error_at
  FROM empire_server_instances si
  LEFT JOIN empire_snapshot_latest sl ON sl.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_server_instances hsi ON hsi.server_instance_id = si.server_instance_id
  LEFT JOIN (
    SELECT server_instance_id, count(*)::int AS player_count
    FROM empire_server_memberships
    WHERE starter_package_applied_at IS NOT NULL
    GROUP BY server_instance_id
  ) membership_players ON membership_players.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_instance_heartbeats ih ON ih.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_worker_heartbeats worker ON worker.worker_id = ih.worker_id
  ${where}
  ORDER BY si.created_at ASC, si.server_instance_id ASC`;
