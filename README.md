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

Next.js 16 (App Router) dengan React 19 dan TypeScript, Tailwind CSS 4, komponen UI berbasis shadcn/Radix. Simulasi muatan memakai three.js lewat react-three-fiber. Database PostgreSQL, diakses dengan `pg` tanpa ORM. Package manager pnpm, Node 22.

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
      settings/           role, menu, account
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

Tabel master, role, menu, dan plan punya `id` (identity) dan `new_id` (uuid). Relasi antar tabel dan URL di API memakai `new_id`, bukan `id`.

Item di `shipping_plan_item` menyimpan salinan kode, nama, dan berat barang saat plan disimpan, supaya plan lama tidak berubah kalau master barangnya diedit kemudian.

## Login dan hak akses

Login ada di `POST /api/v1/Auth/login-sso`. Passwordnya dicek di dalam Postgres dengan `pgcrypto` (bcrypt), lalu server mengeluarkan token JWT HS256 yang berlaku 8 jam. Token disimpan di browser dan dikirim sebagai `Authorization: Bearer ...` di setiap request. Semua endpoint kecuali login menolak request tanpa token yang valid (401).

User yang bisa login ada di tabel `core_user`. Untuk sekarang belum ada halaman untuk menambah user login baru, jadi user baru dimasukkan lewat SQL, mengikuti contoh di `002_auth_and_seed.sql`. Email user dipakai sebagai `user_principal_name` di `core_role_claim`, jadi saat user ditambahkan ke sebuah role dari halaman Role, yang dicari adalah isi `core_user`.

Menu di sidebar tidak tertulis di kode. Menu diambil dari tabel `core_menu`, difilter berdasarkan role milik user (lewat `core_role_claim` dan `core_role_menu`). Role, menu, dan akses per role diatur dari halaman Settings. Menu baru otomatis tidak terlihat oleh siapa pun sampai diberi akses ke sebuah role.

## API

Semua di bawah `/api/v1`. Format JSON, nama field camelCase.

| Endpoint | Fungsi |
|---|---|
| `Auth/login-sso` | login |
| `CoreRole`, `CoreRoleClaim/*` | role dan user per role |
| `DataHris/get-name/lov` | pencarian user untuk ditambahkan ke role (`?search=&limit=`), mencari di `core_user` |
| `CoreMenu/*` | menu, tombol (function), akses role ke menu, menu untuk sidebar |
| `MstVehicle`, `MstCubstool`, `MstLocation` | master data, masing-masing dengan `lov-*` untuk daftar pilihan |
| `ShippingPlan` | daftar dan buat plan |
| `ShippingPlan/{id}` | detail (berikut item dan riwayat) dan ubah header |
| `ShippingPlan/{id}/load` | simpan hasil simulasi muatan ke plan |
| `ShippingPlan/{id}/status` | `{ "action": "approve" }` atau `{ "action": "cancel", "note": "..." }` |

Kesalahan input dibalas 400, perubahan yang tidak boleh untuk status plan saat ini dibalas 409, data tidak ditemukan 404. Isi pesannya dalam bentuk `{ "message": "..." }`.

## Simulasi muatan

Halaman `shipping/container-load/create` menata barang di dalam bak truk. Aturannya: lantai diisi penuh dulu (melebar, lalu maju ke belakang) sebelum lapisan kedua dimulai, dan blok dirapatkan tanpa celah. Ukuran satu blok dihitung dari dimensi bak lalu diregangkan supaya pas memenuhi ruangnya.

Kalau dibuka dengan `?planId=...`, hasilnya bisa disimpan ke plan lewat tombol Save to Plan. Tanpa `planId`, halaman tetap bisa dipakai sendiri dan hasilnya hanya tersimpan di browser.

Ada dua catatan soal hitungannya:

- Ukuran barang di tampilan belum diambil dari dimensi Cubstool. Semua barang digambar sama besar, jadi persentase "slot terpakai" itu hitungan slot, bukan volume asli.
- Berat dihitung dari kolom `weight` Cubstool dan dianggap dalam kilogram. Pengecekan berat hanya jalan kalau kendaraan sudah diisi Max Payload di Master Vehicle.

## Yang belum selesai

Beberapa halaman masih memanggil API dari backend lama (.NET) yang sudah tidak dipakai, jadi belum berfungsi: Audit Trail, Transaction/Approval, serta data yang dibutuhkan modul validasi (produk, product step, requirement category, validation form) dan notifikasi di lonceng atas. Endpoint-nya perlu dibuat ulang di `app/api/v1` dengan pola yang sama seperti modul yang sudah jadi. Dashboard dan Verification/Ongoing Process saat ini masih halaman statis atau placeholder.

Yang juga masih kurang: halaman untuk membuat dan mengelola user login (lihat bagian login di atas).

Untuk alur pengirimannya sendiri, rencana tahap berikutnya:

1. Booking armada: master driver dan carrier, alokasi kendaraan, estimasi biaya.
2. Loading dan dispatch: checklist muat, nomor segel, cetak surat jalan, status in transit.
3. Tracking dan POD: checkpoint, ETA, bukti terima, selisih barang.
4. Exception, biaya freight, dan laporan (on-time, utilisasi muatan, biaya per kg).

Approval plan sekarang belum dibatasi per role, siapa pun yang login bisa menyetujui.

Satu hal kecil di sisi tooling: `npx tsc --noEmit` masih melaporkan dua error tipe lama, di `components/status-badge.tsx` dan `verification/ongoing-process/page.tsx` (varian badge `warning` dan `info` yang tidak ada di komponen Badge). Belum dibereskan.

## Lisensi

MIT, lihat [LICENSE](LICENSE).
