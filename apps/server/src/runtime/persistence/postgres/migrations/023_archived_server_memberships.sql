ALTER TABLE empire_server_memberships
  DROP CONSTRAINT IF EXISTS empire_server_memberships_status_check;

ALTER TABLE empire_server_memberships
  ADD CONSTRAINT empire_server_memberships_status_check CHECK (status IN (
    'setup_required', 'finalizing_setup', 'active', 'leave_pending', 'left_early',
    'defeated', 'completed', 'server_removed'
  ));
