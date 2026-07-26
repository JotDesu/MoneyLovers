# 🧾 Receipt Tracker

A browser-based monthly expense tracker. Scan a shopping receipt with your
camera (auto-read via OCR, then read back out loud) or add items manually —
everything gets neatly organized into monthly summaries, charts, and PDF
reports.

## Features

- [x] 📷 Receipt scanning — automatic OCR via Tesseract.js, tuned for convenience-store receipts
- [x] 🔊 Auto read-aloud — scanned items and totals are read back to you in Indonesian (Web Speech API)
- [x] ✍️ Manual entry for item name, quantity, and price
- [x] 💰 Smart Rupiah formatting — type `17.000`, it's read as 17 thousand, not 17
- [x] 📊 Automatic monthly summaries (This Month / Last Month / All Time)
- [x] 📈 Monthly spending chart — last 6 months at a glance
- [x] 🔍 Search transactions by item name
- [x] 👁️ View, ✏️ edit, and 🗑️ delete saved transactions
- [x] 🧾 Export a monthly report as PDF — title, itemized table, grand total
- [x] ⇩ Export data as `.json` / ⇧ Import it back in
- [x] 💾 Auto-saved on your device via IndexedDB — no need to import every visit
- [x] 📱 Responsive — works cleanly on both mobile and desktop
- [x] 100% client-side — pure HTML, Tailwind CSS, and JavaScript, no backend needed

## Usage

1. Clone this repo
2. Open `index.html` in your browser (make sure `script.js` is in the same folder)
3. Start tracking your spending!

## File structure

```
├── index.html
└── script.js
```

## Notes

This is a fully static app with no backend — all your data is stored locally
in the browser via **IndexedDB**, so it's still there the next time you open
the app, even after closing the tab. Use **Export** anytime to save a `.json`
backup, and **Import** to restore it (handy if you switch browsers or
devices).

## Built with

- [Tesseract.js](https://github.com/naptha/tesseract.js) for in-browser OCR
- [jsPDF](https://github.com/parallax/jsPDF) + AutoTable for PDF reports
- [Tailwind CSS](https://tailwindcss.com/) for styling
- Web Speech API for text-to-speech
- Vanilla JavaScript, no frameworks or build step required

---

by andiana.aji
