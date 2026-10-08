-- Audit trail: who did what and when, across every service. Safe to re-run.
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.
CREATE TABLE IF NOT EXISTS core_audit_trail (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_date timestamptz NOT NULL DEFAULT now(), username varchar(100), actor_name varchar(200), actor_role varchar(300), module varchar(60) NOT NULL, activity varchar(40) NOT NULL, entity_type varchar(60), entity_ref varchar(150), note text NOT NULL, changes jsonb);
CREATE INDEX IF NOT EXISTS ix_core_audit_trail_date ON core_audit_trail (created_date DESC);
CREATE INDEX IF NOT EXISTS ix_core_audit_trail_username ON core_audit_trail (lower(username));
CREATE INDEX IF NOT EXISTS ix_core_audit_trail_module ON core_audit_trail (module);
CREATE INDEX IF NOT EXISTS ix_core_audit_trail_activity ON core_audit_trail (activity);
