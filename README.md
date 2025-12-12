# Netflix Access Hub

Dashboard untuk menampilkan kode akses Netflix secara otomatis dari Gmail.

## ✨ Fitur

- **Kode OTP** - Login verification codes
- **Kode Akses Sementara** - Temporary access codes dengan info peminta
- **Link Household** - Update household links

## 🚀 Setup

### 1. Setup Google Apps Script

1. Buka [script.google.com](https://script.google.com) → New Project
2. Copy-paste isi `google-apps-script/Code.gs`
3. Deploy → New Deployment → Web App → "Anyone"
4. Copy URL dan paste ke `script.js`

### 2. Deploy ke GitHub Pages

1. Push ke repository
2. Settings → Pages → Deploy from branch (main)
3. Akses: `https://harisratnopambudi.github.io/netflixhub/`

## 📁 Files

- `index.html` - Halaman utama
- `style.css` - Styling
- `script.js` - Frontend logic
- `google-apps-script/Code.gs` - Backend Gmail reader

## 🔒 Keamanan

- Email diblur untuk privasi
- Hanya menampilkan email Netflix
- Kredensial aman di Google Apps Script

---
Build by **Haris Ratno Pambudi**
