-- Phase 2 of the shipping flow: booking (carrier, driver, plate), freight cost estimate and delivery note (surat jalan).
-- Domestic road transport only. Safe to re-run. Seed rows (carriers, drivers, rates, coordinates) are made-up development data.

-- Freight rates live on the vehicle: estimate = base_fee + rate_per_km x distance (rounded up to the next 1,000 IDR).
ALTER TABLE mst_vehicle ADD COLUMN IF NOT EXISTS base_fee numeric(14,0);
ALTER TABLE mst_vehicle ADD COLUMN IF NOT EXISTS rate_per_km numeric(14,0);

-- Coordinates give the road-distance estimate (straight line x 1.3). Optional: a manual distance can be entered at booking.
ALTER TABLE mst_location ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE mst_location ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

CREATE TABLE IF NOT EXISTS mst_carrier (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id        uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code          varchar(50)  NOT NULL UNIQUE,
    name          varchar(150) NOT NULL,
    type          varchar(10)  NOT NULL CHECK (type IN ('OWN', '3PL')),  -- own fleet or third-party logistics
    contact_name  varchar(100),
    contact_phone varchar(50),
    is_active     boolean      NOT NULL DEFAULT true,
    created_by    varchar(100),
    created_date  timestamptz  NOT NULL DEFAULT now(),
    updated_by    varchar(100),
    updated_date  timestamptz
);

CREATE TABLE IF NOT EXISTS mst_driver (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id          uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code            varchar(50)  NOT NULL UNIQUE,
    name            varchar(150) NOT NULL,
    phone           varchar(50),
    license_no      varchar(50),                       -- SIM
    license_expiry  date,
    carrier_new_id  uuid         REFERENCES mst_carrier (new_id),   -- NULL = can drive for any carrier
    is_active       boolean      NOT NULL DEFAULT true,
    created_by      varchar(100),
    created_date    timestamptz  NOT NULL DEFAULT now(),
    updated_by      varchar(100),
    updated_date    timestamptz
);

CREATE SEQUENCE IF NOT EXISTS delivery_note_no_seq;

-- status: ... APPROVED -> BOOKED (carrier, driver, plate and cost fixed) -> DISPATCHED (surat jalan issued, truck leaves).
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS carrier_new_id uuid REFERENCES mst_carrier (new_id);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS driver_new_id uuid REFERENCES mst_driver (new_id);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS plate_no varchar(20);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS distance_km numeric(9,1);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS base_fee numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS per_km_fee numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS freight_cost numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS loading_fee numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS other_fee numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS total_cost numeric(14,0);
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS booking_notes text;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS delivery_note_no varchar(30) UNIQUE;
ALTER TABLE shipping_plan ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

-- Widen the allowed statuses. The old check was created inline in 004, so it has the default name.
ALTER TABLE shipping_plan DROP CONSTRAINT IF EXISTS shipping_plan_status_check;
ALTER TABLE shipping_plan DROP CONSTRAINT IF EXISTS ck_shipping_plan_status;
ALTER TABLE shipping_plan ADD CONSTRAINT ck_shipping_plan_status CHECK (status IN ('DRAFT', 'PLANNED', 'APPROVED', 'BOOKED', 'DISPATCHED', 'CANCELLED'));

-- Menus: Master > Carrier, Master > Driver
INSERT INTO core_menu (name, parent_id, seq, path, created_by)
SELECT m.name, p.new_id, m.seq, m.path, 'seed'
FROM core_menu p
CROSS JOIN (VALUES ('Carrier', 4, '/master/carrier'), ('Driver', 5, '/master/driver')) AS m(name, seq, path)
WHERE p.name = 'Master' AND p.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM core_menu x WHERE x.path = m.path);

INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn, created_by)
SELECT r.new_id, m.new_id, NULL, true, false, 'seed'
FROM core_role r CROSS JOIN core_menu m
WHERE r.name = 'Administrator'
ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL DO NOTHING;

-- ---------------- development seed data ----------------
-- Rates per vehicle type (IDR). Cold-chain (AC) bodies cost 20% more, vehicles 10 m or longer 30% more.
UPDATE mst_vehicle v
SET base_fee    = round(f.base   * (CASE WHEN v.climate = 'AC' THEN 1.2 ELSE 1 END) * (CASE WHEN v.dimensions_l >= 10 THEN 1.3 ELSE 1 END), -3),
    rate_per_km = round(f.per_km * (CASE WHEN v.climate = 'AC' THEN 1.2 ELSE 1 END) * (CASE WHEN v.dimensions_l >= 10 THEN 1.3 ELSE 1 END), -2)
FROM (VALUES ('Pickup', 150000, 3500), ('Blind Van', 150000, 3500), ('CDE', 250000, 4500), ('CDD', 400000, 6000),
             ('Fuso', 700000, 9000), ('Tronton', 1200000, 13000), ('Trailer', 2200000, 19000)) AS f(type, base, per_km)
WHERE v.type = f.type AND v.base_fee IS NULL;

-- Location coordinates (approximate city centres)
UPDATE mst_location l SET latitude = c.lat, longitude = c.lng
FROM (VALUES
  ('WH-JKT', -6.225::numeric, 106.9004::numeric),
  ('WH-CKR', -6.2343::numeric, 106.9796::numeric),
  ('WH-BDG', -6.9095::numeric, 107.6191::numeric),
  ('WH-SMG', -6.9667::numeric, 110.4207::numeric),
  ('WH-SBY', -7.2535::numeric, 112.7521::numeric),
  ('WH-MDN', 3.6032::numeric, 98.6762::numeric),
  ('WH-MKS', -5.1477::numeric, 119.4327::numeric),
  ('WH-BPN', -1.2339::numeric, 116.8569::numeric),
  ('CU-001', -6.1743::numeric, 106.7529::numeric),
  ('CU-002', -6.2615::numeric, 106.8136::numeric),
  ('CU-003', -6.1802::numeric, 106.8311::numeric),
  ('CU-004', -6.228::numeric, 106.9064::numeric),
  ('CU-005', -6.1753::numeric, 106.6319::numeric),
  ('CU-006', -6.2946::numeric, 106.7119::numeric),
  ('CU-007', -6.2383::numeric, 106.9786::numeric),
  ('CU-008', -6.589::numeric, 106.8136::numeric),
  ('CU-009', -6.4055::numeric, 106.8002::numeric),
  ('CU-010', -6.9145::numeric, 107.6191::numeric),
  ('CU-011', -6.7123::numeric, 108.551::numeric),
  ('CU-012', -6.9667::numeric, 110.4197::numeric),
  ('CU-013', -7.5695::numeric, 110.8213::numeric),
  ('CU-014', -7.7986::numeric, 110.3755::numeric),
  ('CU-015', -7.2545::numeric, 112.7521::numeric),
  ('CU-016', -7.9726::numeric, 112.6266::numeric),
  ('CU-017', -7.4478::numeric, 112.7213::numeric),
  ('CU-018', -8.6645::numeric, 115.2096::numeric),
  ('CU-019', 3.5922::numeric, 98.6782::numeric),
  ('CU-020', 3.5982::numeric, 98.6722::numeric),
  ('CU-021', -0.9531::numeric, 100.4112::numeric),
  ('CU-022', 0.5071::numeric, 101.4508::numeric),
  ('CU-023', -2.9701::numeric, 104.7724::numeric),
  ('CU-024', -5.4001::numeric, 105.2728::numeric),
  ('CU-025', -1.2349::numeric, 116.8529::numeric),
  ('CU-026', -3.3246::numeric, 114.5884::numeric),
  ('CU-027', -0.0263::numeric, 109.3455::numeric),
  ('CU-028', -5.1417::numeric, 119.4297::numeric),
  ('CU-029', 1.4718::numeric, 124.8481::numeric),
  ('CU-030', -10.1742::numeric, 123.607::numeric),
  ('CU-031', -2.5397::numeric, 140.7121::numeric)
) AS c(code, lat, lng)
WHERE l.code = c.code AND l.latitude IS NULL;

-- Carriers (33)
INSERT INTO mst_carrier (code, name, type, contact_name, contact_phone, created_by)
SELECT c.code, c.name, c.type, c.contact_name, c.contact_phone, 'seed'
FROM (VALUES
  ('CR-001', 'Armada Sendiri Jakarta', 'OWN', 'Budi Santoso', '021-555-2000'),
  ('CR-002', 'Armada Sendiri Surabaya', 'OWN', 'Slamet Kusuma', '021-555-2053'),
  ('CR-003', 'Armada Sendiri Medan', 'OWN', 'Joko Pratama', '021-555-2106'),
  ('CR-004', 'PT Trans Nusantara Logistik', '3PL', 'Wahyu Susanto', '021-555-2159'),
  ('CR-005', 'PT Samudra Raya Ekspres', '3PL', 'Taufik Saputra', '021-555-2212'),
  ('CR-006', 'PT Cakra Antar Nusa', '3PL', 'Asep Hartono', '021-555-2265'),
  ('CR-007', 'PT Bintang Lintas Jawa', '3PL', 'Imam Setiawan', '021-555-2318'),
  ('CR-008', 'PT Mitra Kargo Sumatera', '3PL', 'Darmawan Wijaya', '021-555-2371'),
  ('CR-009', 'PT Duta Angkut Kalimantan', '3PL', 'Hasan Ramadhan', '021-555-2424'),
  ('CR-010', 'PT Pelita Cargo Indonesia', '3PL', 'Nanang Hidayat', '021-555-2477'),
  ('CR-011', 'PT Garuda Darat Logistik', '3PL', 'Reza Firmansyah', '021-555-2530'),
  ('CR-012', 'PT Sinar Laju Trans', '3PL', 'Agus Nugroho', '021-555-2583'),
  ('CR-013', 'PT Karya Mandiri Transport', '3PL', 'Hendra Santoso', '021-555-2636'),
  ('CR-014', 'PT Tiga Roda Prima', '3PL', 'Eko Kusuma', '021-555-2689'),
  ('CR-015', 'PT Jaya Antar Pulau', '3PL', 'Andri Pratama', '021-555-2742'),
  ('CR-016', 'PT Rajawali Trucking', '3PL', 'Bambang Susanto', '021-555-2795'),
  ('CR-017', 'PT Kencana Lintas Nusa', '3PL', 'Dwi Saputra', '021-555-2848'),
  ('CR-018', 'PT Adi Perkasa Logistik', '3PL', 'Sutrisno Hartono', '021-555-2901'),
  ('CR-019', 'PT Bumi Angkasa Cargo', '3PL', 'Fauzi Setiawan', '021-555-2954'),
  ('CR-020', 'PT Prima Armada Sejahtera', '3PL', 'Kurniawan Wijaya', '021-555-3007'),
  ('CR-021', 'PT Sentra Muat Indonesia', '3PL', 'Oki Ramadhan', '021-555-3060'),
  ('CR-022', 'PT Nusa Karya Ekspedisi', '3PL', 'Sugeng Hidayat', '021-555-3113'),
  ('CR-023', 'PT Lintas Timur Trans', '3PL', 'Dedi Firmansyah', '021-555-3166'),
  ('CR-024', 'PT Harapan Jaya Kargo', '3PL', 'Rudi Nugroho', '021-555-3219'),
  ('CR-025', 'PT Mega Roda Utama', '3PL', 'Yanto Santoso', '021-555-3272'),
  ('CR-026', 'PT Surya Angkut Perkasa', '3PL', 'Supriyadi Kusuma', '021-555-3325'),
  ('CR-027', 'PT Cipta Lintas Darat', '3PL', 'Ujang Pratama', '021-555-3378'),
  ('CR-028', 'PT Wahana Kirim Nusantara', '3PL', 'Heri Susanto', '021-555-3431'),
  ('CR-029', 'PT Bina Trans Mandiri', '3PL', 'Rahmat Saputra', '021-555-3484'),
  ('CR-030', 'PT Satria Cargo Line', '3PL', 'Gunawan Hartono', '021-555-3537'),
  ('CR-031', 'PT Tunas Muat Logistik', '3PL', 'Maman Setiawan', '021-555-3590'),
  ('CR-032', 'PT Optima Freight Darat', '3PL', 'Purwanto Wijaya', '021-555-3643'),
  ('CR-033', 'PT Handal Antar Barang', '3PL', 'Budi Ramadhan', '021-555-3696')
) AS c(code, name, type, contact_name, contact_phone)
ON CONFLICT (code) DO NOTHING;

-- Drivers (32). Half are tied to one carrier, the rest can drive for any carrier.
INSERT INTO mst_driver (code, name, phone, license_no, license_expiry, carrier_new_id, created_by)
SELECT d.code, d.name, d.phone, d.license_no, d.expiry::date, c.new_id, 'seed'
FROM (VALUES
  ('DRV-001', 'Budi Santoso', '08121000000', 'SIM B1 Umum 0001500000', '2027-01-01', 'CR-001'::varchar),
  ('DRV-002', 'Agus Nugroho', '08221007919', 'SIM B2 Umum 0001504421', '2028-06-08', NULL::varchar),
  ('DRV-003', 'Dedi Firmansyah', '08321015838', 'SIM B1 Umum 0001508842', '2029-11-15', 'CR-002'::varchar),
  ('DRV-004', 'Slamet Hidayat', '08421023757', 'SIM B2 Umum 0001513263', '2030-04-22', NULL::varchar),
  ('DRV-005', 'Hendra Ramadhan', '08521031676', 'SIM B1 Umum 0001517684', '2027-09-01', 'CR-003'::varchar),
  ('DRV-006', 'Rudi Wijaya', '08621039595', 'SIM B2 Umum 0001522105', '2028-02-08', NULL::varchar),
  ('DRV-007', 'Joko Setiawan', '08721047514', 'SIM B1 Umum 0001526526', '2029-07-15', 'CR-004'::varchar),
  ('DRV-008', 'Eko Hartono', '08821055433', 'SIM B2 Umum 0001530947', '2030-12-22', NULL::varchar),
  ('DRV-009', 'Yanto Saputra', '08921063352', 'SIM B1 Umum 0001535368', '2027-05-01', 'CR-005'::varchar),
  ('DRV-010', 'Wahyu Susanto', '08121071271', 'SIM B2 Umum 0001539789', '2028-10-08', NULL::varchar),
  ('DRV-011', 'Andri Pratama', '08221079190', 'SIM B1 Umum 0001544210', '2029-03-15', 'CR-006'::varchar),
  ('DRV-012', 'Supriyadi Kusuma', '08321087109', 'SIM B2 Umum 0001548631', '2030-08-22', NULL::varchar),
  ('DRV-013', 'Taufik Santoso', '08421095028', 'SIM B1 Umum 0001553052', '2027-01-01', 'CR-007'::varchar),
  ('DRV-014', 'Bambang Nugroho', '08521102947', 'SIM B2 Umum 0001557473', '2028-06-08', NULL::varchar),
  ('DRV-015', 'Ujang Firmansyah', '08621110866', 'SIM B1 Umum 0001561894', '2029-11-15', 'CR-008'::varchar),
  ('DRV-016', 'Asep Hidayat', '08721118785', 'SIM B2 Umum 0001566315', '2030-04-22', NULL::varchar),
  ('DRV-017', 'Dwi Ramadhan', '08821126704', 'SIM B1 Umum 0001570736', '2027-09-01', 'CR-009'::varchar),
  ('DRV-018', 'Heri Wijaya', '08921134623', 'SIM B2 Umum 0001575157', '2028-02-08', NULL::varchar),
  ('DRV-019', 'Imam Setiawan', '08121142542', 'SIM B1 Umum 0001579578', '2029-07-15', 'CR-010'::varchar),
  ('DRV-020', 'Sutrisno Hartono', '08221150461', 'SIM B2 Umum 0001583999', '2030-12-22', NULL::varchar),
  ('DRV-021', 'Rahmat Saputra', '08321158380', 'SIM B1 Umum 0001588420', '2027-05-01', 'CR-011'::varchar),
  ('DRV-022', 'Darmawan Susanto', '08421166299', 'SIM B2 Umum 0001592841', '2028-10-08', NULL::varchar),
  ('DRV-023', 'Fauzi Pratama', '08521174218', 'SIM B1 Umum 0001597262', '2029-03-15', 'CR-001'::varchar),
  ('DRV-024', 'Gunawan Kusuma', '08621182137', 'SIM B2 Umum 0001601683', '2030-08-22', NULL::varchar),
  ('DRV-025', 'Hasan Santoso', '08721190056', 'SIM B1 Umum 0001606104', '2027-01-01', 'CR-002'::varchar),
  ('DRV-026', 'Kurniawan Nugroho', '08821197975', 'SIM B2 Umum 0001610525', '2028-06-08', NULL::varchar),
  ('DRV-027', 'Maman Firmansyah', '08921205894', 'SIM B1 Umum 0001614946', '2029-11-15', 'CR-003'::varchar),
  ('DRV-028', 'Nanang Hidayat', '08121213813', 'SIM B2 Umum 0001619367', '2030-04-22', NULL::varchar),
  ('DRV-029', 'Oki Ramadhan', '08221221732', 'SIM B1 Umum 0001623788', '2027-09-01', 'CR-004'::varchar),
  ('DRV-030', 'Purwanto Wijaya', '08321229651', 'SIM B2 Umum 0001628209', '2028-02-08', NULL::varchar),
  ('DRV-031', 'Reza Setiawan', '08421237570', 'SIM B1 Umum 0001632630', '2029-07-15', 'CR-005'::varchar),
  ('DRV-032', 'Sugeng Hartono', '08521245489', 'SIM B2 Umum 0001637051', '2030-12-22', NULL::varchar)
) AS d(code, name, phone, license_no, expiry, carrier_code)
LEFT JOIN mst_carrier c ON c.code = d.carrier_code
ON CONFLICT (code) DO NOTHING;
