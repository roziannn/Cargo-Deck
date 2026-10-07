-- Phase 1 of the shipping flow: locations, shipping plan (+ items, status history), vehicle payload, menus.
-- Safe to re-run.

ALTER TABLE mst_vehicle ADD COLUMN IF NOT EXISTS max_payload numeric(14,2);  -- kg

CREATE TABLE IF NOT EXISTS mst_location (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id        uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code          varchar(50)  NOT NULL UNIQUE,
    name          varchar(150) NOT NULL,
    type          varchar(20)  NOT NULL CHECK (type IN ('WAREHOUSE', 'CUSTOMER')),
    address       text,
    city          varchar(100),
    province      varchar(100),
    contact_name  varchar(100),
    contact_phone varchar(50),
    is_active     boolean      NOT NULL DEFAULT true,
    created_by    varchar(100),
    created_date  timestamptz  NOT NULL DEFAULT now(),
    updated_by    varchar(100),
    updated_date  timestamptz
);

CREATE SEQUENCE IF NOT EXISTS shipping_plan_no_seq;

-- status: DRAFT (header only) -> PLANNED (load simulation saved) -> APPROVED; CANCELLED from any of them.
CREATE TABLE IF NOT EXISTS shipping_plan (
    id                         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id                     uuid        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    plan_no                    varchar(30) NOT NULL UNIQUE,
    status                     varchar(20) NOT NULL DEFAULT 'DRAFT'
                               CHECK (status IN ('DRAFT', 'PLANNED', 'APPROVED', 'CANCELLED')),
    origin_location_new_id     uuid        NOT NULL REFERENCES mst_location (new_id),
    destination_location_new_id uuid       NOT NULL REFERENCES mst_location (new_id),
    requested_delivery_date    date        NOT NULL,
    planned_ship_date          date        NOT NULL,
    priority                   varchar(10) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    special_handling           varchar(20) CHECK (special_handling IN ('COLD_CHAIN', 'FRAGILE', 'HAZARDOUS')),
    notes                      text,
    vehicle_new_id             uuid        REFERENCES mst_vehicle (new_id),
    total_units                integer     NOT NULL DEFAULT 0,
    total_weight_kg            numeric(14,2) NOT NULL DEFAULT 0,
    utilization_pct            numeric(5,2),
    created_by                 varchar(100),
    created_date               timestamptz NOT NULL DEFAULT now(),
    updated_by                 varchar(100),
    updated_date               timestamptz,
    CONSTRAINT ck_shipping_plan_dates CHECK (requested_delivery_date >= planned_ship_date),
    CONSTRAINT ck_shipping_plan_route CHECK (origin_location_new_id <> destination_location_new_id)
);

CREATE TABLE IF NOT EXISTS shipping_plan_item (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_new_id     uuid         NOT NULL REFERENCES shipping_plan (new_id) ON DELETE CASCADE,
    cubstool_new_id uuid         NOT NULL REFERENCES mst_cubstool (new_id),
    item_code       varchar(100) NOT NULL,   -- snapshot at save time
    item_name       varchar(150) NOT NULL,   -- snapshot at save time
    unit_weight_kg  numeric(14,4),           -- snapshot at save time
    qty             integer      NOT NULL CHECK (qty > 0),
    UNIQUE (plan_new_id, cubstool_new_id)
);

CREATE TABLE IF NOT EXISTS shipping_plan_history (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_new_id  uuid        NOT NULL REFERENCES shipping_plan (new_id) ON DELETE CASCADE,
    from_status  varchar(20),
    to_status    varchar(20) NOT NULL,
    note         text,
    changed_by   varchar(100),
    changed_date timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_shipping_plan_history_plan ON shipping_plan_history (plan_new_id, changed_date);

-- Menus: "Container Load" becomes "Shipping Plan"; add Master > Location.
UPDATE core_menu SET name = 'Shipping Plan', path = '/shipping/plan', updated_date = now(), updated_by = 'seed'
WHERE path = '/shipping/container-load';

INSERT INTO core_menu (name, parent_id, seq, path, created_by)
SELECT 'Location', p.new_id, 3, '/master/location', 'seed'
FROM core_menu p
WHERE p.name = 'Master' AND p.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM core_menu WHERE path = '/master/location');

INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn, created_by)
SELECT r.new_id, m.new_id, NULL, true, false, 'seed'
FROM core_role r CROSS JOIN core_menu m
WHERE r.name = 'Administrator'
ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL DO NOTHING;
