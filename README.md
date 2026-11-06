# LensLingo 🌿
> Aplikasi web mobile-first bergaya Google Lens untuk pembelajaran bahasa Inggris berbasis visual (*Project Based Learning*).

Arahkan kamera ke benda di sekitar, pilih area fokus dengan kotak seleksi (*bounding box*), dan LensLingo akan mengidentifikasi benda menggunakan kecerdasan buatan Google Gemini serta memberikan arti bahasa Indonesia, contoh kalimat, dan pengucapan suara.

---

## ✨ Fitur Utama

- **Camera-First Full-Screen (100dvh)**: Kamera responsif dengan palet warna *Sage* yang menenangkan mata.
- **Bounding Box Interaktif**: Kotak seleksi dapat digeser (*drag*) dan diubah ukurannya (*resize*) dengan *pointer events* (jari sentuh atau mouse).
- **Potong & Kompresi Cerdas**: Hanya area di dalam kotak yang dipotong dan dikompresi (maksimal 800px, JPEG 0.8) sebelum dikirim.
- **Deteksi Objek via Google Gemini**: Backend Vercel Serverless Function (`api/identify.js`) dengan *Structured JSON Output*.
- **Draggable Bottom Sheet**: Hasil deteksi tampil pada bottom sheet interaktif dengan 3 titik berhenti (*snap*: 20%, 50%, 90%).
- **Suara Pengucapan (*Audio Pronunciation*)**: Dengarkan pengucapan kata dalam bahasa Inggris dengan kecepatan normal maupun pelan (SpeechSynthesis API).
- **3 Chip Alternatif**: Pilihan kata kandidat lain jika identifikasi utama ingin disesuaikan tanpa perlu request ulang.
- **Daftar Belajarku**: Simpan kata kosakata yang telah dipelajari ke memori lokal browser (*localStorage*).
- **Keamanan Ketat**:
  - API Key Gemini tersimpan aman di server (*Environment Variable* Vercel), tidak bocor ke frontend atau publik GitHub.
  - Validasi *Magic Bytes* (hanya menerima file JPEG/PNG asli).
  - Teks hasil Gemini disanitasi dengan regex ketat (`^[a-z\s-]+$`) untuk mencegah *prompt injection*.
  - Foto tidak disimpan di server dan tidak dicatat ke log.

---

## 🚀 Panduan Menjalankan & Demo di HP (Vercel)

Karena akses kamera HP membutuhkan protokol **HTTPS**, cara termudah dan terbaik untuk mendemokan aplikasi di HP adalah melalui deployment Vercel:

### 1. Push ke GitHub
```bash
git remote add origin https://github.com/USERNAME/lenslingo.git
git branch -M main
git push -u origin main
```

### 2. Deploy di Vercel
1. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik **Add New...** → **Project**, lalu impor repositori **lenslingo**.
3. Pada bagian **Environment Variables**, tambahkan:
   - `GEMINI_API_KEY`: *(Isi dengan API Key dari Google AI Studio)*
   - `GEMINI_MODEL`: `gemini-2.0-flash` *(opsional, default sudah otomatis)*
4. Klik **Deploy**.

### 3. Demo di HP
Buka URL Vercel (misal: `https://lenslingo-xxx.vercel.app`) di browser HP Anda (Chrome di Android atau Safari di iOS). Izinkan akses kamera dan mulai jelajahi benda di sekitar!

---

## 💻 Pengujian Lokal di Komputer

Jika ingin menguji di komputer terlebih dahulu:

```bash
# Jalankan server pengembangan lokal
npm start
# atau
node dev-server.js
```
Buka browser di `http://localhost:3000`. Jika `GEMINI_API_KEY` belum disetel, server otomatis menggunakan `MOCK_MODE` untuk simulasi respons.

---

## 📁 Struktur Proyek

```text
lenslingo/
├── api/
│   └── identify.js         # Backend Vercel Serverless Function (Google Gemini API)
├── public/
│   ├── data/
│   │   └── words.json      # Database kosakata benda kampus lokal
│   ├── index.html          # Antarmuka kamera & bottom sheet
│   ├── style.css           # Desain visual dengan variabel warna Sage
│   └── app.js              # Logika kamera, bounding box, audio, & bottom sheet
├── dev-server.js           # Server simulasi lokal (Node.js)
├── vercel.json             # Konfigurasi routing & timeout Vercel
├── package.json
└── README.md
```
