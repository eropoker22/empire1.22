import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("hosted registration migration", () => {
  it("persists the immutable one-hour lifecycle policy and action payload", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/012_hosted_server_registration_lifecycle.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("minimum_ready_players_to_start >= 2");
    expect(sql).toContain("registration_window_minutes = 60");
    expect(sql).toContain("registration_closes_at = registration_opens_at + interval '60 minutes'");
    expect(sql).toContain("canonical_final_lockdown_trigger");
    expect(sql).toContain("canonical_first_elimination_tick");
    expect(sql).toContain("canonical_tick_rate_ms");
    expect(sql).toContain("effective_final_lockdown_trigger");
    expect(sql).toContain("effective_first_elimination_tick");
    expect(sql).toContain("action_payload jsonb NOT NULL");
    expect(sql).toContain("'schedule-registration'");
    expect(sql).toContain("'close-registration-now'");
  });

  it("migrates only not-yet-running Free hosted instances to the ten-second tick", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/016_free_mode_ten_second_tick.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("canonical_first_elimination_tick = 2880");
    expect(sql).toContain("canonical_tick_rate_ms = 10000");
    expect(sql).toContain("status IN ('requested', 'provisioning', 'lobby')");
    expect(sql).not.toContain("'running'");
    expect(sql).not.toContain("'paused'");
  });

  it("moves existing hosted instances to the single-player start policy", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/022_single_player_hosted_start.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("SET minimum_ready_players_to_start = 1");
    expect(sql).toContain("minimum_ready_players_to_start >= 1");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS empire_hosted_registration_minimum_players_check");
  });
});
