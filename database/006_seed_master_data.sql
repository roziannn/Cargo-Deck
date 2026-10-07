-- Development master data: vehicles, cubstool (carton items) and locations. All names, addresses and
-- phone numbers are made up. Safe to re-run: rows already present (same name / item code / location code) are skipped.
-- Dimensions: vehicles in metres, cubstool in centimetres; weights in kilograms.

-- Vehicles (33)
INSERT INTO mst_vehicle (name, type, climate, cbm, dimensions_l, dimensions_w, floor_area, max_height, max_payload, created_by)
SELECT v.name, v.type, v.climate, round(v.l * v.w * v.h, 2), v.l, v.w, round(v.l * v.w, 2), v.h, v.payload, 'seed'
FROM (VALUES
  ('Pickup Bak L300', 'Pickup', 'NON_AC', 2.3::numeric, 1.6::numeric, 1.2::numeric, 900::numeric),
  ('Pickup Box L300', 'Pickup', 'NON_AC', 2.3::numeric, 1.6::numeric, 1.4::numeric, 850::numeric),
  ('Pickup Box AC L300', 'Pickup', 'AC', 2.2::numeric, 1.55::numeric, 1.3::numeric, 700::numeric),
  ('Pickup Box Carry', 'Pickup', 'NON_AC', 2.1::numeric, 1.45::numeric, 1.3::numeric, 750::numeric),
  ('Blind Van Grand Max', 'Blind Van', 'NON_AC', 2.0::numeric, 1.3::numeric, 1.2::numeric, 700::numeric),
  ('Blind Van Luxio AC', 'Blind Van', 'AC', 1.9::numeric, 1.3::numeric, 1.15::numeric, 600::numeric),
  ('CDE Box 4 Roda', 'CDE', 'NON_AC', 3.2::numeric, 1.7::numeric, 1.7::numeric, 1800::numeric),
  ('CDE Box AC 4 Roda', 'CDE', 'AC', 3.1::numeric, 1.65::numeric, 1.65::numeric, 1500::numeric),
  ('CDE Bak Terbuka', 'CDE', 'NON_AC', 3.2::numeric, 1.7::numeric, 1.5::numeric, 2000::numeric),
  ('CDE Long Box', 'CDE', 'NON_AC', 3.8::numeric, 1.75::numeric, 1.75::numeric, 2000::numeric),
  ('CDE Wingbox Mini', 'CDE', 'NON_AC', 3.5::numeric, 1.75::numeric, 1.8::numeric, 1900::numeric),
  ('CDE Box Pendingin', 'CDE', 'AC', 3.2::numeric, 1.7::numeric, 1.7::numeric, 1500::numeric),
  ('CDD Box Standar', 'CDD', 'NON_AC', 4.2::numeric, 2.0::numeric, 2.0::numeric, 3500::numeric),
  ('CDD Box Long', 'CDD', 'NON_AC', 4.8::numeric, 2.0::numeric, 2.1::numeric, 3800::numeric),
  ('CDD Box AC', 'CDD', 'AC', 4.2::numeric, 2.0::numeric, 2.0::numeric, 3000::numeric),
  ('CDD Bak Terbuka', 'CDD', 'NON_AC', 4.5::numeric, 2.0::numeric, 1.6::numeric, 4000::numeric),
  ('CDD Wingbox', 'CDD', 'NON_AC', 4.8::numeric, 2.05::numeric, 2.2::numeric, 3800::numeric),
  ('CDD Box Pendingin Long', 'CDD', 'AC', 4.8::numeric, 2.0::numeric, 2.1::numeric, 3200::numeric),
  ('CDD Box Tinggi', 'CDD', 'NON_AC', 4.4::numeric, 2.0::numeric, 2.3::numeric, 3500::numeric),
  ('Fuso Box 6 Roda', 'Fuso', 'NON_AC', 5.6::numeric, 2.2::numeric, 2.3::numeric, 6500::numeric),
  ('Fuso Box Long', 'Fuso', 'NON_AC', 6.2::numeric, 2.3::numeric, 2.4::numeric, 7000::numeric),
  ('Fuso Box AC', 'Fuso', 'AC', 5.8::numeric, 2.2::numeric, 2.3::numeric, 5500::numeric),
  ('Fuso Wingbox', 'Fuso', 'NON_AC', 6.2::numeric, 2.3::numeric, 2.5::numeric, 7000::numeric),
  ('Fuso Bak Terbuka', 'Fuso', 'NON_AC', 6.0::numeric, 2.3::numeric, 1.8::numeric, 8000::numeric),
  ('Fuso Box Pendingin', 'Fuso', 'AC', 6.0::numeric, 2.3::numeric, 2.3::numeric, 5500::numeric),
  ('Tronton Box', 'Tronton', 'NON_AC', 7.5::numeric, 2.4::numeric, 2.5::numeric, 12000::numeric),
  ('Tronton Wingbox', 'Tronton', 'NON_AC', 9.0::numeric, 2.4::numeric, 2.6::numeric, 14000::numeric),
  ('Tronton Box AC', 'Tronton', 'AC', 8.0::numeric, 2.4::numeric, 2.5::numeric, 10000::numeric),
  ('Trailer 20 ft', 'Trailer', 'NON_AC', 5.9::numeric, 2.35::numeric, 2.39::numeric, 21000::numeric),
  ('Trailer 40 ft', 'Trailer', 'NON_AC', 12.03::numeric, 2.35::numeric, 2.39::numeric, 26000::numeric),
  ('Trailer 40 ft High Cube', 'Trailer', 'NON_AC', 12.03::numeric, 2.35::numeric, 2.69::numeric, 26000::numeric),
  ('Reefer 20 ft', 'Trailer', 'AC', 5.45::numeric, 2.29::numeric, 2.2::numeric, 19000::numeric),
  ('Reefer 40 ft', 'Trailer', 'AC', 11.58::numeric, 2.29::numeric, 2.25::numeric, 26000::numeric)
) AS v(name, type, climate, l, w, h, payload)
WHERE NOT EXISTS (SELECT 1 FROM mst_vehicle x WHERE x.name = v.name);

-- Cubstool (32)
INSERT INTO mst_cubstool (name, item_code, length, width, height, weight, color, created_by)
SELECT i.name, i.code, i.l, i.w, i.h, i.weight, i.color, 'seed'
FROM (VALUES
  ('CT-001', 'Karton Vitamin C 500 mg', 40::numeric, 30::numeric, 25::numeric, 8.5::numeric, 'Orange'),
  ('CT-002', 'Karton Paracetamol 500 mg', 40::numeric, 30::numeric, 22::numeric, 7.2::numeric, 'White'),
  ('CT-003', 'Karton Sirup Batuk 60 ml', 38::numeric, 28::numeric, 20::numeric, 9.0::numeric, 'Brown'),
  ('CT-004', 'Karton Minuman Elektrolit', 45::numeric, 32::numeric, 26::numeric, 12.5::numeric, 'Blue'),
  ('CT-005', 'Karton Susu Nutrisi 400 g', 42::numeric, 32::numeric, 24::numeric, 11.0::numeric, 'Yellow'),
  ('CT-006', 'Karton Biskuit Bayi', 40::numeric, 30::numeric, 28::numeric, 5.5::numeric, 'Pink'),
  ('CT-007', 'Karton Hand Sanitizer 100 ml', 36::numeric, 26::numeric, 18::numeric, 6.8::numeric, 'Green'),
  ('CT-008', 'Karton Masker Medis', 50::numeric, 35::numeric, 30::numeric, 4.5::numeric, 'White'),
  ('CT-009', 'Karton Sarung Tangan Latex', 48::numeric, 30::numeric, 28::numeric, 6.0::numeric, 'Blue'),
  ('CT-010', 'Karton Plester Luka', 35::numeric, 25::numeric, 20::numeric, 3.2::numeric, 'Red'),
  ('CT-011', 'Karton Antiseptik 100 ml', 36::numeric, 26::numeric, 18::numeric, 7.0::numeric, 'Purple'),
  ('CT-012', 'Karton Minyak Kayu Putih 60 ml', 34::numeric, 26::numeric, 18::numeric, 6.4::numeric, 'Green'),
  ('CT-013', 'Karton Obat Tetes Mata', 30::numeric, 24::numeric, 16::numeric, 2.8::numeric, 'Blue'),
  ('CT-014', 'Karton Salep Kulit', 32::numeric, 24::numeric, 16::numeric, 2.5::numeric, 'White'),
  ('CT-015', 'Karton Multivitamin Anak', 38::numeric, 28::numeric, 22::numeric, 6.6::numeric, 'Orange'),
  ('CT-016', 'Karton Madu 250 g', 40::numeric, 30::numeric, 22::numeric, 10.5::numeric, 'Yellow'),
  ('CT-017', 'Karton Teh Herbal', 42::numeric, 30::numeric, 28::numeric, 4.2::numeric, 'Green'),
  ('CT-018', 'Karton Kopi Sachet', 44::numeric, 32::numeric, 30::numeric, 7.8::numeric, 'Brown'),
  ('CT-019', 'Karton Air Mineral 600 ml', 38::numeric, 28::numeric, 26::numeric, 15.5::numeric, 'Blue'),
  ('CT-020', 'Karton Minuman Isotonik 500 ml', 40::numeric, 30::numeric, 26::numeric, 13.8::numeric, 'Red'),
  ('CT-021', 'Karton Susu UHT 200 ml', 36::numeric, 28::numeric, 22::numeric, 9.6::numeric, 'White'),
  ('CT-022', 'Karton Mie Instan', 52::numeric, 38::numeric, 30::numeric, 10.2::numeric, 'Red'),
  ('CT-023', 'Karton Biskuit Gandum', 46::numeric, 34::numeric, 28::numeric, 6.9::numeric, 'Brown'),
  ('CT-024', 'Karton Cokelat Batang', 40::numeric, 30::numeric, 20::numeric, 5.8::numeric, 'Brown'),
  ('CT-025', 'Karton Sabun Mandi', 44::numeric, 32::numeric, 26::numeric, 8.4::numeric, 'Green'),
  ('CT-026', 'Karton Sampo Sachet', 42::numeric, 30::numeric, 24::numeric, 7.1::numeric, 'Purple'),
  ('CT-027', 'Karton Pasta Gigi', 40::numeric, 28::numeric, 22::numeric, 8.9::numeric, 'Blue'),
  ('CT-028', 'Karton Tisu Wajah', 50::numeric, 36::numeric, 32::numeric, 5.0::numeric, 'White'),
  ('CT-029', 'Karton Popok Bayi M', 60::numeric, 40::numeric, 38::numeric, 6.5::numeric, 'Yellow'),
  ('CT-030', 'Karton Popok Bayi L', 62::numeric, 42::numeric, 40::numeric, 7.4::numeric, 'Orange'),
  ('CT-031', 'Karton Infus NaCl 500 ml', 44::numeric, 34::numeric, 28::numeric, 14.2::numeric, 'Grey'),
  ('CT-032', 'Karton Spuit 3 ml', 40::numeric, 30::numeric, 24::numeric, 5.6::numeric, 'Grey')
) AS i(code, name, l, w, h, weight, color)
WHERE NOT EXISTS (SELECT 1 FROM mst_cubstool x WHERE x.item_code = i.code);

-- Locations (39: 8 warehouses, 31 customers)
INSERT INTO mst_location (code, name, type, address, city, province, contact_name, contact_phone, created_by)
SELECT l.code, l.name, l.type, l.address, l.city, l.province, l.contact_name, l.contact_phone, 'seed'
FROM (VALUES
  ('WH-JKT', 'Gudang Pusat Jakarta', 'WAREHOUSE', 'Jl. Pulogadung No. 12, Kawasan Industri Pulogadung', 'Jakarta Timur', 'DKI Jakarta', 'Budi Santoso', '021-555-1000'),
  ('WH-CKR', 'Gudang Cikarang', 'WAREHOUSE', 'Jl. Jababeka Raya Blok C-14, Kawasan Industri Jababeka', 'Bekasi', 'Jawa Barat', 'Sari Kusuma', '022-555-1037'),
  ('WH-BDG', 'Gudang Bandung', 'WAREHOUSE', 'Jl. Soekarno Hatta No. 301, Gedebage', 'Bandung', 'Jawa Barat', 'Agus Rahayu', '022-555-1074'),
  ('WH-SMG', 'Gudang Semarang', 'WAREHOUSE', 'Jl. Raya Kaligawe Km 5', 'Semarang', 'Jawa Tengah', 'Dewi Lestari', '024-555-1111'),
  ('WH-SBY', 'Gudang Surabaya', 'WAREHOUSE', 'Jl. Rungkut Industri III No. 8', 'Surabaya', 'Jawa Timur', 'Rizky Pratama', '031-555-1148'),
  ('WH-MDN', 'Gudang Medan', 'WAREHOUSE', 'Jl. Pulau Batam No. 7, KIM II', 'Medan', 'Sumatera Utara', 'Maya Saputra', '061-555-1185'),
  ('WH-MKS', 'Gudang Makassar', 'WAREHOUSE', 'Jl. Kapasa Raya No. 21, KIMA', 'Makassar', 'Sulawesi Selatan', 'Hendra Setiawan', '0411-555-1222'),
  ('WH-BPN', 'Gudang Balikpapan', 'WAREHOUSE', 'Jl. Soekarno Hatta Km 4', 'Balikpapan', 'Kalimantan Timur', 'Lestari Wijaya', '0542-555-1259'),
  ('CU-001', 'PT Mitra Sehat Distribusi', 'CUSTOMER', 'Jl. Daan Mogot No. 88', 'Jakarta Barat', 'DKI Jakarta', 'Fajar Hidayat', '021-555-1296'),
  ('CU-002', 'PT Sinar Farma Utama', 'CUSTOMER', 'Jl. TB Simatupang No. 15', 'Jakarta Selatan', 'DKI Jakarta', 'Rina Nugroho', '021-555-1333'),
  ('CU-003', 'Apotek Medika Sentosa Pusat', 'CUSTOMER', 'Jl. Kramat Raya No. 102', 'Jakarta Pusat', 'DKI Jakarta', 'Eko Santoso', '021-555-1370'),
  ('CU-004', 'RS Harapan Bunda', 'CUSTOMER', 'Jl. Raya Bogor Km 22', 'Jakarta Timur', 'DKI Jakarta', 'Wulan Kusuma', '021-555-1407'),
  ('CU-005', 'PT Bumi Waras Niaga', 'CUSTOMER', 'Jl. Imam Bonjol No. 45', 'Tangerang', 'Banten', 'Dimas Rahayu', '021-555-1444'),
  ('CU-006', 'Klinik Pratama Sejahtera', 'CUSTOMER', 'Jl. Raya Serpong No. 9', 'Tangerang Selatan', 'Banten', 'Putri Lestari', '021-555-1481'),
  ('CU-007', 'PT Cahaya Medika Distribusi', 'CUSTOMER', 'Jl. Ahmad Yani No. 60', 'Bekasi', 'Jawa Barat', 'Andi Pratama', '022-555-1518'),
  ('CU-008', 'PT Nusantara Farmasi Lestari', 'CUSTOMER', 'Jl. Pajajaran No. 140', 'Bogor', 'Jawa Barat', 'Yuni Saputra', '022-555-1555'),
  ('CU-009', 'Apotek Sehat Selalu Depok', 'CUSTOMER', 'Jl. Margonda Raya No. 330', 'Depok', 'Jawa Barat', 'Irfan Setiawan', '022-555-1592'),
  ('CU-010', 'PT Priangan Medika Jaya', 'CUSTOMER', 'Jl. Asia Afrika No. 77', 'Bandung', 'Jawa Barat', 'Nadia Wijaya', '022-555-1629'),
  ('CU-011', 'RS Kasih Ibu Cirebon', 'CUSTOMER', 'Jl. Tuparev No. 55', 'Cirebon', 'Jawa Barat', 'Joko Hidayat', '022-555-1666'),
  ('CU-012', 'PT Tirta Husada Semarang', 'CUSTOMER', 'Jl. Pemuda No. 118', 'Semarang', 'Jawa Tengah', 'Ayu Nugroho', '024-555-1703'),
  ('CU-013', 'Apotek Sumber Waras Solo', 'CUSTOMER', 'Jl. Slamet Riyadi No. 204', 'Surakarta', 'Jawa Tengah', 'Budi Santoso', '024-555-1740'),
  ('CU-014', 'PT Mataram Sehat Sejahtera', 'CUSTOMER', 'Jl. Malioboro No. 31', 'Yogyakarta', 'DI Yogyakarta', 'Sari Kusuma', '0274-555-1777'),
  ('CU-015', 'PT Bintang Timur Farma', 'CUSTOMER', 'Jl. Basuki Rahmat No. 92', 'Surabaya', 'Jawa Timur', 'Agus Rahayu', '031-555-1814'),
  ('CU-016', 'RS Permata Hati Malang', 'CUSTOMER', 'Jl. Ijen No. 14', 'Malang', 'Jawa Timur', 'Dewi Lestari', '031-555-1851'),
  ('CU-017', 'Apotek Gajah Mada Sidoarjo', 'CUSTOMER', 'Jl. Pahlawan No. 27', 'Sidoarjo', 'Jawa Timur', 'Rizky Pratama', '031-555-1888'),
  ('CU-018', 'PT Kencana Medika Denpasar', 'CUSTOMER', 'Jl. Teuku Umar No. 66', 'Denpasar', 'Bali', 'Maya Saputra', '0361-555-1925'),
  ('CU-019', 'PT Samudra Farma Medan', 'CUSTOMER', 'Jl. Gatot Subroto No. 150', 'Medan', 'Sumatera Utara', 'Hendra Setiawan', '061-555-1962'),
  ('CU-020', 'RS Bunda Kasih Medan', 'CUSTOMER', 'Jl. Imam Bonjol No. 6', 'Medan', 'Sumatera Utara', 'Lestari Wijaya', '061-555-1999'),
  ('CU-021', 'PT Andalas Sehat Padang', 'CUSTOMER', 'Jl. Sudirman No. 40', 'Padang', 'Sumatera Barat', 'Fajar Hidayat', '0751-555-2036'),
  ('CU-022', 'PT Riau Medika Pekanbaru', 'CUSTOMER', 'Jl. Soekarno Hatta No. 215', 'Pekanbaru', 'Riau', 'Rina Nugroho', '0761-555-2073'),
  ('CU-023', 'PT Sriwijaya Farma Palembang', 'CUSTOMER', 'Jl. Jenderal Sudirman No. 330', 'Palembang', 'Sumatera Selatan', 'Eko Santoso', '0711-555-2110'),
  ('CU-024', 'Apotek Lampung Sehat', 'CUSTOMER', 'Jl. Raden Intan No. 58', 'Bandar Lampung', 'Lampung', 'Wulan Kusuma', '0721-555-2147'),
  ('CU-025', 'PT Borneo Farma Balikpapan', 'CUSTOMER', 'Jl. MT Haryono No. 120', 'Balikpapan', 'Kalimantan Timur', 'Dimas Rahayu', '0542-555-2184'),
  ('CU-026', 'PT Kalimantan Medika Banjarmasin', 'CUSTOMER', 'Jl. A. Yani Km 3', 'Banjarmasin', 'Kalimantan Selatan', 'Putri Lestari', '0511-555-2221'),
  ('CU-027', 'PT Pontianak Sehat Mandiri', 'CUSTOMER', 'Jl. Gajah Mada No. 82', 'Pontianak', 'Kalimantan Barat', 'Andi Pratama', '0561-555-2258'),
  ('CU-028', 'PT Celebes Farma Makassar', 'CUSTOMER', 'Jl. Urip Sumoharjo No. 99', 'Makassar', 'Sulawesi Selatan', 'Yuni Saputra', '0411-555-2295'),
  ('CU-029', 'RS Siloam Manado Selatan', 'CUSTOMER', 'Jl. Sam Ratulangi No. 12', 'Manado', 'Sulawesi Utara', 'Irfan Setiawan', '0431-555-2332'),
  ('CU-030', 'PT Timur Raya Distribusi Kupang', 'CUSTOMER', 'Jl. El Tari No. 24', 'Kupang', 'Nusa Tenggara Timur', 'Nadia Wijaya', '0380-555-2369'),
  ('CU-031', 'PT Papua Medika Jayapura', 'CUSTOMER', 'Jl. Ahmad Yani No. 5', 'Jayapura', 'Papua', 'Joko Hidayat', '0967-555-2406')
) AS l(code, name, type, address, city, province, contact_name, contact_phone)
ON CONFLICT (code) DO NOTHING;
