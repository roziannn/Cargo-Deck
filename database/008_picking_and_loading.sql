-- Picking & packing and loading stages between BOOKED and DISPATCHED. Safe to re-run.
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.

-- Actual quantities, next to the planned qty: what was picked, then what was really loaded on the truck.
ALTER TABLE shipping_plan_item ADD COLUMN IF NOT EXISTS picked_qty integer;
ALTER TABLE shipping_plan_item ADD COLUMN IF NOT EXISTS loaded_qty integer;
ALTER TABLE shipping_plan_item DROP CONSTRAINT IF EXISTS ck_shipping_plan_item_picked;
ALTER TABLE shipping_plan_item ADD CONSTRAINT ck_shipping_plan_item_picked CHECK (picked_qty IS NULL OR (picked_qty >= 0 AND picked_qty <= qty));
ALTER TABLE shipping_plan_item DROP CONSTRAINT IF EXISTS ck_shipping_plan_item_loaded;
ALTER TABLE shipping_plan_item ADD CONSTRAINT ck_shipping_plan_item_loaded CHECK (loaded_qty IS NULL OR (loaded_qty >= 0 AND loaded_qty <= COALESCE(picked_qty, qty)));

-- Picking & packing
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS picking_notes text;

-- Loading checklist, seal and weighbridge (timbang)
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS chk_vehicle_papers boolean NOT NULL DEFAULT false;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS chk_vehicle_clean boolean NOT NULL DEFAULT false;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS chk_vehicle_condition boolean NOT NULL DEFAULT false;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS chk_driver_ready boolean NOT NULL DEFAULT false;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS chk_cargo_secured boolean NOT NULL DEFAULT false;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS loading_temp_c numeric(4,1);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS seal_no varchar(50);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS gross_weight_kg numeric(14,2);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS tare_weight_kg numeric(14,2);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS loading_notes text;

-- status: ... BOOKED -> PICKING (picking & packing) -> LOADING (checklist, seal, weighing) -> DISPATCHED
ALTER TABLE shipping_plan DROP CONSTRAINT IF EXISTS ck_shipping_plan_status;
ALTER TABLE shipping_plan ADD CONSTRAINT ck_shipping_plan_status CHECK (status IN ('DRAFT', 'PLANNED', 'APPROVED', 'BOOKED', 'PICKING', 'LOADING', 'DISPATCHED', 'CANCELLED'));
