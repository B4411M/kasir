# 🧾 Kasir Pro — Aplikasi Kasir

Aplikasi **Kasir / Point of Sale (POS)** yang profesional, ringan, dan **bisa diinstall di Android melalui Chrome**. Data tersimpan **offline** di perangkat (LocalStorage) — tidak butuh server/database.

![Kasir Pro](icons/icon-512.png)

---

## ✨ Fitur

- 🛒 **Kasir / POS** — klik produk untuk menambahkan ke keranjang, atur qty, diskon & pajak
- 📦 **Manajemen Produk** — tambah, edit, hapus produk dengan kategori, harga, stok, dan emoji
- 🧾 **Riwayat Transaksi** — semua transaksi tercatat, bisa difilter per tanggal
- 🖨️ **Cetak Struk** — hasilkan struk pembayaran dan cetak via printer
- 💳 **Metode Pembayaran** — Tunai, QRIS, Transfer
- 📱 **PWA (Progressive Web App)** — bisa diinstall ke Home Screen Android
- 📴 **Offline** — aplikasi tetap berjalan tanpa internet
- 💾 **Backup Data** — export/import data dalam format JSON
- 📊 **Export Transaksi** — export riwayat ke CSV

---

## 🚀 Cara Menggunakan

### 1. Jalankan Secara Lokal (Opsional)

Buka file `index.html` langsung di browser, atau jalankan server lokal:

```bash
# Dengan Python
cd kasir-app
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

> **Catatan:** Service Worker (PWA) hanya aktif saat diakses via `http/https` (bukan `file://`).

### 2. Hosting di GitHub Pages

1. Buat repository baru di GitHub (contoh: `kasir-app`).
2. Upload semua file dalam folder `kasir-app/` ke repository.
3. Buka **Settings → Pages**.
4. Pada **Branch**, pilih `main` / folder `/ (root)` dan klik **Save**.
5. Tunggu beberapa saat, lalu aplikasi dapat diakses di:
   `https://<username>.github.io/<nama-repo>/`

### 3. Install di Android via Chrome

1. Buka URL aplikasi (misalnya GitHub Pages) di **Chrome Android**.
2. Ketuk ikon **⋮ (menu)** di pojok kanan atas.
3. Pilih **"Tambahkan ke layar utama" / "Add to Home screen"**.
4. Atau, akan muncul banner **"Install Kasir Pro"** — ketuk **Install**.
5. Aplikasi kini terinstall dan bisa dibuka **full screen** tanpa browser.

---

## 🗂️ Struktur File

```
kasir-app/
├── index.html          # Halaman utama
├── style.css           # Styling profesional
├── app.js              # Logika aplikasi
├── manifest.json       # Konfigurasi PWA
├── sw.js               # Service Worker (offline)
├── icons/              # Icon aplikasi (192, 512, maskable)
├── generate_icons.py   # Script generate icon (optional)
└── README.md           # Dokumentasi
```

---

## 💾 Data Tersimpan Aman

Semua data (produk, transaksi, pengaturan) disimpan dengan **ganda** agar **tidak hilang saat HP mati/restart**:

- **IndexedDB** (primary) — penyimpanan besar dan tahan lama, tidak hilang saat restart aplikasi/HP
- **LocalStorage** (cadangan/fallback) — sebagai lapisan tambahan
- **Persistent Storage** — aplikasi otomatis meminta izin ke browser agar data tidak dihapus oleh pembersihan otomatis

> ✅ Produk yang sudah Anda tambahkan (asalkan stok masih ada) akan **tetap tersimpan** meskipun HP dimatikan, aplikasi ditutup, atau browser di-refresh.

Gunakan fitur **Export Data** di menu Pengaturan untuk **backup manual** berkala ke file JSON.

### Tips Tambahan
- Pastikan aplikasi digunakan via **GitHub Pages / HTTPS** (bukan `file://`) agar IndexedDB & PWA berfungsi penuh.
- Jika HP mulai lambat, gunakan **Export Data** lalu **Reset** untuk memulai baru, dan **Import** saat diperlukan.

---

## 🔧 Kustomisasi

Edit file `app.js` bagian `seedProducts()` untuk mengubah produk default toko Anda.

---

## 🛠️ Teknologi

- HTML5 + CSS3 (Flexbox/Grid, animasi)
- JavaScript (Vanilla, tanpa framework)
- PWA (Manifest + Service Worker)

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.

