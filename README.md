# Cargo Deck

Aplikasi web untuk merencanakan dan memantau pengiriman barang lewat jalur darat di dalam negeri. Titik awalnya adalah rencana pengiriman (shipping plan): dari mana barang berangkat, ke mana tujuannya, kapan harus tiba, lalu barangnya ditata dulu di dalam truk lewat simulasi 3D sebelum rencana itu disetujui.

Sampai sekarang yang sudah jalan baru bagian perencanaan. Tahap sesudahnya (booking armada, loading, dispatch, tracking, POD) belum dibuat, lihat bagian [Yang belum selesai](#yang-belum-selesai).

Semua kode ada di satu aplikasi Next.js. Tidak ada backend terpisah: halaman, API, dan akses database sama-sama berada di folder `logistik-shipping-fe`.

## Alur yang dicakup

Alur yang dituju kira-kira begini:

```
Shipping Plan -> Simulasi muatan -> Approval -> Booking armada -> Picking/packing
   -> Loading -> Surat jalan -> Dispatch -> Tracking -> Tiba -> POD -> Tutup + biaya
```

Dua tahap pertama plus approval sudah ada. Siklus status satu plan:

```
DRAFT -> PLANNED -> APPROVED
   \         \          \
    +---------+----------+--> CANCELLED
```

- `DRAFT`: header plan sudah diisi (origin, tujuan, tanggal, prioritas), belum ada muatan.
- `PLANNED`: simulasi muatan sudah disimpan ke plan (kendaraan, barang, jumlah).
- `APPROVED`: plan disetujui. Setelah ini plan tidak bisa diubah lagi.
- `CANCELLED`: dibatalkan, wajib ada alasan. Tidak bisa dibuka lagi.

Setiap perpindahan status dicatat di riwayat plan lengkap dengan siapa dan kapan.

## Stack

Next.js 16 (App Router) dengan React 19 dan TypeScript, Tailwind CSS 4, komponen UI berbasis shadcn/Radix. Simulasi muatan memakai three.js lewat react-three-fiber, dengan algoritma penataan 3D sendiri. Database PostgreSQL, diakses dengan `pg` tanpa ORM. Package manager pnpm, Node 22.

## Struktur folder

```
database/                 skrip SQL, dijalankan berurutan
logistik-shipping-fe/
  app/
    (auth)/login          halaman login
    (platform)/           halaman setelah login (sidebar + breadcrumb)
      master/             vehicle, cubstool, location
      shipping/plan/      daftar, buat, ubah, detail plan
      shipping/container-load/create   simulasi muatan 3D
      settings/           role, menu, account, user
    api/v1/               route handler (API)
  components/             komponen UI dan komponen bersama
  lib/api/                client untuk memanggil API dari browser
  lib/server/             db, auth, repository, service (sisi server)
```

Di sisi server alurnya selalu sama: `route.ts` menerima request, `services` berisi validasi dan aturan bisnis, `repositories` berisi query SQL. Route handler tidak menyentuh SQL langsung.

## Menjalankan di lokal

Butuh PostgreSQL 13 atau lebih baru (skrip memakai `gen_random_uuid()` dan `trim_scale()`).

Jalankan skrip SQL berurutan pada database kosong. Semuanya aman diulang.

```bash
psql -d nama_database -f database/001_create_core_access_tables.sql
psql -d nama_database -f database/002_auth_and_seed.sql
psql -d nama_database -f database/003_master_vehicle_cubstool.sql
psql -d nama_database -f database/004_shipping_plan.sql
psql -d nama_database -f database/005_user_management.sql
psql -d nama_database -f database/006_seed_master_data.sql   # data contoh, opsional
```

Lalu buat `logistik-shipping-fe/.env.local`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=isi_password
DB_NAME=nama_database
DB_SSL=false
AUTH_SECRET=string-acak-minimal-32-karakter
NEXT_PUBLIC_API_BASE_URL=
```

`AUTH_SECRET` bisa dibuat dengan `openssl rand -base64 48`. `DB_SSL=true` dipakai kalau database di hosting yang mewajibkan SSL. `NEXT_PUBLIC_API_BASE_URL` sengaja dikosongkan supaya aplikasi memanggil API miliknya sendiri. Variabel `.env*` sudah di-ignore git.

Setelah itu:

```bash
cd logistik-shipping-fe
pnpm install
pnpm dev
```

Skrip 006 hanya berisi data contoh (nama, alamat, dan nomor telepon karangan) untuk development, jadi tidak perlu dijalankan di lingkungan produksi. Dimensi kendaraan dalam meter, dimensi barang dalam sentimeter, berat dalam kilogram.

Buka http://localhost:3000. Akun bawaan dari skrip seed adalah `admin` dengan password `Admin123!`. Ganti password itu secepatnya:

```sql
UPDATE core_user
SET password_hash = crypt('password_baru', gen_salt('bf'))
WHERE username = 'admin';
```

Ada juga `Dockerfile` di folder FE, tapi isinya menjalankan `pnpm dev`, jadi hanya cocok untuk development.

## Database

Nama tabel dan kolom memakai snake_case. API mengubahnya jadi camelCase di `lib/server/db.ts` (`new_id` menjadi `newId`), jadi frontend tidak perlu tahu bedanya.

| Skrip | Isi |
|---|---|
| 001 | `core_role`, `core_role_claim`, `core_menu`, `core_menu_function`, `core_role_menu` |
| 002 | `core_user`, role Administrator, user admin, menu dasar |
| 003 | `mst_vehicle`, `mst_cubstool` |
| 004 | `mst_location`, `shipping_plan`, `shipping_plan_item`, `shipping_plan_history`, kolom `max_payload` di kendaraan, menu Shipping Plan dan Location |
| 005 | unique index username dan email (tanpa membedakan huruf besar-kecil), menu Settings > User |
| 006 | data contoh: 33 kendaraan, 32 barang (cubstool), 39 lokasi (8 gudang, 31 customer) |

Tabel master, role, menu, dan plan punya `id` (identity) dan `new_id` (uuid). Relasi antar tabel dan URL di API memakai `new_id`, bukan `id`.

Item di `shipping_plan_item` menyimpan salinan kode, nama, dan berat barang saat plan disimpan, supaya plan lama tidak berubah kalau master barangnya diedit kemudian.

## Login dan hak akses

Login ada di `POST /api/v1/Auth/login-sso`. Passwordnya dicek di dalam Postgres dengan `pgcrypto` (bcrypt), lalu server mengeluarkan token JWT HS256 yang berlaku 8 jam. Token disimpan di browser dan dikirim sebagai `Authorization: Bearer ...` di setiap request. Semua endpoint kecuali login menolak request tanpa token yang valid (401).

User yang bisa login ada di tabel `core_user` dan dikelola dari Settings > User: tambah user, ubah data, ganti password, dan menonaktifkan akun. Password minimal 8 karakter dan tidak pernah dikirim balik oleh API. Username dan email unik tanpa membedakan huruf besar-kecil, dan akun sendiri tidak bisa dinonaktifkan supaya tidak terkunci.

Email user dipakai sebagai `user_principal_name` di `core_role_claim`, jadi saat user ditambahkan ke sebuah role dari halaman Role, yang dicari adalah isi `core_user`. Kalau email seorang user diubah, keanggotaan rolenya ikut dipindahkan.

Menu di sidebar tidak tertulis di kode. Menu diambil dari tabel `core_menu`, difilter berdasarkan role milik user (lewat `core_role_claim` dan `core_role_menu`). Role, menu, dan akses per role diatur dari halaman Settings. Menu baru otomatis tidak terlihat oleh siapa pun sampai diberi akses ke sebuah role.

## API

Semua di bawah `/api/v1`. Format JSON, nama field camelCase.

| Endpoint | Fungsi |
|---|---|
| `Auth/login-sso` | login |
| `CoreRole`, `CoreRoleClaim/*` | role dan user per role |
| `CoreUser` | daftar, tambah, dan ubah user login (`PUT CoreUser/{id}`, password opsional) |
| `DataHris/get-name/lov` | pencarian user untuk ditambahkan ke role (`?search=&limit=`), mencari di `core_user` |
| `CoreMenu/*` | menu, tombol (function), akses role ke menu, menu untuk sidebar |
| `MstVehicle`, `MstCubstool`, `MstLocation` | master data, masing-masing dengan `lov-*` untuk daftar pilihan |
| `ShippingPlan` | daftar dan buat plan |
| `ShippingPlan/{id}` | detail (berikut item dan riwayat) dan ubah header |
| `ShippingPlan/{id}/load` | simpan hasil simulasi muatan ke plan |
| `ShippingPlan/{id}/status` | `{ "action": "approve" }` atau `{ "action": "cancel", "note": "..." }` |

Kesalahan input dibalas 400, perubahan yang tidak boleh untuk status plan saat ini dibalas 409, data tidak ditemukan 404. Isi pesannya dalam bentuk `{ "message": "..." }`.

## Simulasi muatan

Halaman `shipping/container-load/create` menata barang di dalam bak truk dengan ukuran aslinya. Dimensi tiap karton diambil dari master Cubstool (cm), dimensi bak dari master Vehicle (m). Karton yang belum punya dimensi memakai ukuran default 40 x 30 x 25 cm dan diberi tanda di layar.

Aturan penataannya ada di `lib/cargo-packing.ts`, terpisah dari tampilan supaya bisa diuji sendiri:

- Karton boleh diputar 90 derajat di lantai, tapi tidak digulingkan.
- Setiap karton ditaruh di posisi terendah yang tersedia, lalu yang paling dekat kabin, lalu melebar ke samping. Akibatnya lantai pasti terisi dulu sampai tidak ada karton yang muat lagi, baru lapisan berikutnya dimulai, dan muatan terbentuk seperti dinding dari kabin ke belakang.
- Karton yang ditumpuk harus punya minimal 75% alasnya tertopang karton di bawahnya, jadi tidak ada yang menggantung.
- Karton paling berat didahulukan, jadi yang berat mengisi lantai dan yang lebih ringan berada di atasnya. Kalau urutan ini membuat ada karton yang tidak muat, urutan lain (berdasarkan luas alas dan tinggi) dicoba supaya lebih banyak yang terangkut.
- Dari beberapa variasi urutan yang dicoba, hasil yang memuat paling banyak (lalu paling pendek) dipakai.

Dengan ukuran yang berbeda-beda, celah kecil di lantai tidak bisa dihindari sepenuhnya. Yang dijamin: tidak ada tumpang tindih, tidak ada yang keluar bak, dan tidak ada karton tanpa tumpuan.

Persentase yang ditampilkan adalah volume terpakai (volume semua karton dibanding ruang dalam bak), bukan lagi hitungan slot. Angka itu juga yang disimpan ke plan. Tampilan "Lantai" menunjukkan berapa persen lantai tertutup. Kalau jumlah yang diminta melebihi yang muat, sisanya ditandai "tidak muat" dan plan tidak bisa disimpan sampai jumlahnya dikurangi.

Kendaraan digambar dari jenisnya: pickup dengan kap mesin, truk box (CDE, CDD, Fuso) dengan kabin datar, serta tronton dan trailer dengan dua gandar belakang. Kendaraan dengan climate AC mendapat unit pendingin di atap. Dari panel kiri, mengarahkan kursor ke sebuah produk menyorot semua kartonnya di truk.

Kalau dibuka dengan `?planId=...`, hasilnya bisa disimpan ke plan lewat tombol "Simpan ke Shipping Plan". Tanpa `planId`, halaman tetap bisa dipakai sendiri dan hasilnya hanya tersimpan di browser.

Berat dihitung dari kolom `weight` Cubstool dan dianggap dalam kilogram. Pengecekan berat hanya jalan kalau kendaraan sudah diisi Max Payload di Master Vehicle. Penataan belum memperhitungkan batas tumpukan per produk atau barang yang tidak boleh ditumpuk.

## Yang belum selesai

Beberapa halaman masih memanggil API dari backend lama (.NET) yang sudah tidak dipakai, jadi belum berfungsi: Audit Trail, Transaction/Approval, serta data yang dibutuhkan modul validasi (produk, product step, requirement category, validation form) dan notifikasi di lonceng atas. Endpoint-nya perlu dibuat ulang di `app/api/v1` dengan pola yang sama seperti modul yang sudah jadi. Dashboard dan Verification/Ongoing Process saat ini masih halaman statis atau placeholder.

Untuk alur pengirimannya sendiri, rencana tahap berikutnya:

1. Booking armada: master driver dan carrier, alokasi kendaraan, estimasi biaya.
2. Loading dan dispatch: checklist muat, nomor segel, cetak surat jalan, status in transit.
3. Tracking dan POD: checkpoint, ETA, bukti terima, selisih barang.
4. Exception, biaya freight, dan laporan (on-time, utilisasi muatan, biaya per kg).

Approval plan sekarang belum dibatasi per role, siapa pun yang login bisa menyetujui.

Satu hal kecil di sisi tooling: `npx tsc --noEmit` masih melaporkan dua error tipe lama, di `components/status-badge.tsx` dan `verification/ongoing-process/page.tsx` (varian badge `warning` dan `info` yang tidak ada di komponen Badge). Belum dibereskan.

## Lisensi

MIT, lihat [LICENSE](LICENSE).
