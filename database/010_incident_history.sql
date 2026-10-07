-- Timeline per incident: every status change, note and handling update. Safe to re-run.
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.
CREATE TABLE IF NOT EXISTS shipping_incident_history (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, incident_new_id uuid NOT NULL REFERENCES shipping_incident (new_id) ON DELETE CASCADE, from_status varchar(20), to_status varchar(20) NOT NULL, note text, changed_by varchar(100), changed_date timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_shipping_incident_history_incident ON shipping_incident_history (incident_new_id, changed_date);
-- incidents reported before this migration get a first entry
INSERT INTO shipping_incident_history (incident_new_id, from_status, to_status, note, changed_by, changed_date) SELECT i.new_id, NULL, 'OPEN', 'Insiden dilaporkan', i.created_by, i.created_date FROM shipping_incident i WHERE NOT EXISTS (SELECT 1 FROM shipping_incident_history h WHERE h.incident_new_id = i.new_id);
