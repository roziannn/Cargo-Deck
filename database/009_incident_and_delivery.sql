-- After dispatch: estimated arrival (ETA) with a grace period, receiving, and Insiden & Klaim. Safe to re-run.
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.

-- ETA and grace days are set per plan when it is dispatched. Past ETA + grace with no open incident, the plan completes by itself.
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS eta_date date;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS grace_days smallint NOT NULL DEFAULT 1;
ALTER TABLE shipping_plan DROP CONSTRAINT IF EXISTS ck_shipping_plan_grace_days;
ALTER TABLE shipping_plan ADD CONSTRAINT ck_shipping_plan_grace_days CHECK (grace_days BETWEEN 0 AND 30);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS received_by varchar(100);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS receive_notes text;

-- status: ... DISPATCHED -> COMPLETED (received, or no incident until ETA + grace days)
ALTER TABLE shipping_plan DROP CONSTRAINT IF EXISTS ck_shipping_plan_status;
ALTER TABLE shipping_plan ADD CONSTRAINT ck_shipping_plan_status CHECK (status IN ('DRAFT', 'PLANNED', 'APPROVED', 'BOOKED', 'PICKING', 'LOADING', 'DISPATCHED', 'COMPLETED', 'CANCELLED'));

-- Insiden & Klaim
CREATE SEQUENCE IF NOT EXISTS incident_no_seq;

CREATE TABLE IF NOT EXISTS shipping_incident (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id         uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    incident_no    varchar(30)  NOT NULL UNIQUE,
    plan_new_id    uuid         NOT NULL REFERENCES shipping_plan (new_id),
    type           varchar(20)  NOT NULL,
    status         varchar(20)  NOT NULL DEFAULT 'OPEN',
    occurred_date  date         NOT NULL DEFAULT CURRENT_DATE,
    description    text         NOT NULL,
    target_date    date,
    solution       text,
    claim_amount   numeric(14,0),
    claim_party    varchar(100),
    resolved_at    timestamptz,
    created_by     varchar(100),
    created_date   timestamptz  NOT NULL DEFAULT now(),
    updated_by     varchar(100),
    updated_date   timestamptz,
    CONSTRAINT ck_shipping_incident_type CHECK (type IN ('DELAY', 'ACCIDENT', 'DAMAGED', 'SHORTAGE', 'TEMPERATURE', 'RETURN', 'OTHER')),
    CONSTRAINT ck_shipping_incident_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLAIM_FILED', 'RESOLVED', 'REJECTED')),
    CONSTRAINT ck_shipping_incident_claim CHECK (claim_amount IS NULL OR claim_amount >= 0)
);
CREATE INDEX IF NOT EXISTS ix_shipping_incident_plan ON shipping_incident (plan_new_id);
CREATE INDEX IF NOT EXISTS ix_shipping_incident_status ON shipping_incident (status);

-- Menu: Shipping > Insiden & Klaim
INSERT INTO core_menu (name, parent_id, seq, path, created_by) SELECT 'Insiden & Klaim', p.new_id, 3, '/shipping/incident', 'seed' FROM core_menu p WHERE p.name = 'Shipping' AND p.parent_id IS NULL AND NOT EXISTS (SELECT 1 FROM core_menu x WHERE x.path = '/shipping/incident');
INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn, created_by) SELECT r.new_id, m.new_id, NULL, true, false, 'seed' FROM core_role r CROSS JOIN core_menu m WHERE r.name = 'Administrator' ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL DO NOTHING;
-- plans dispatched before this migration get ETA = dispatch day + 1
UPDATE shipping_plan SET eta_date = (dispatched_at AT TIME ZONE 'UTC')::date + 1 WHERE status = 'DISPATCHED' AND eta_date IS NULL AND dispatched_at IS NOT NULL;
