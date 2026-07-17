-- Align atomic command persistence with the canonical public server instance ID.

ALTER TABLE empire_command_results
  DROP CONSTRAINT empire_command_results_server_instance_id_fkey,
  ADD CONSTRAINT empire_command_results_server_instance_id_fkey
    FOREIGN KEY (server_instance_id)
    REFERENCES empire_server_instances (server_instance_id)
    ON DELETE CASCADE;

ALTER TABLE empire_runtime_outbox
  DROP CONSTRAINT empire_runtime_outbox_server_instance_id_fkey,
  ADD CONSTRAINT empire_runtime_outbox_server_instance_id_fkey
    FOREIGN KEY (server_instance_id)
    REFERENCES empire_server_instances (server_instance_id)
    ON DELETE CASCADE;
