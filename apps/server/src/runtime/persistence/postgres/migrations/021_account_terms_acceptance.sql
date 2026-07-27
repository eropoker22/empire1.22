CREATE TABLE IF NOT EXISTS empire_account_terms_acceptances (
  account_id text NOT NULL REFERENCES empire_accounts (account_id) ON DELETE CASCADE,
  terms_version text NOT NULL CHECK (
    char_length(terms_version) BETWEEN 1 AND 100
    AND terms_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]*$'
  ),
  accepted_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, terms_version)
);

COMMENT ON TABLE empire_account_terms_acceptances IS
  'Verze podmínek přijaté účtem; právní text zůstává mimo účet a ukládá se pouze verze a databázový čas akceptace.';
