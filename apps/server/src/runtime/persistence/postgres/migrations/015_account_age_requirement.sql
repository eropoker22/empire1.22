ALTER TABLE empire_accounts
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN empire_accounts.date_of_birth IS
  'Datum narození zadané při registraci; nová registrace je serverově povolena pouze hráčům ve věku alespoň 16 let.';
