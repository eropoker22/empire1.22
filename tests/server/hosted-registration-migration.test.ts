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
});
