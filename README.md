# 🧾 Receipt Tracker

A browser-based monthly expense tracker. Scan a shopping receipt with your
camera (auto-read via OCR) or add items manually — everything gets neatly
organized into monthly summaries.

## Features

- [x] 📷 Receipt scanning — automatic OCR via Tesseract.js, tuned for convenience-store receipts
- [x] ✍️ Manual entry for item name, quantity, and price
- [x] 📊 Automatic monthly summaries (This Month / Last Month / All Time)
- [x] 🔍 Search transactions by item name
- [x] 👁️ View, ✏️ edit, and 🗑️ delete saved transactions
- [x] ⇩ Export data as `.json`
- [x] ⇧ Import data back in
- [x] 100% client-side — pure HTML, CSS, and JavaScript, no backend needed

## Usage

1. Clone this repo
2. Open `index.html` in your browser (make sure `style.css` and `script.js` are in the same folder)
3. Start tracking your spending!

## File structure

```
├── index.html
└── script.js
```

## Notes

Since this is a static app with no backend, data only persists while the tab
is open. Use the **Export** button to save your data as a `.json` file, and
**Import** to load it back in on your next visit.

## Built with

- [Tesseract.js](https://github.com/naptha/tesseract.js) for in-browser OCR
- Vanilla JavaScript, no frameworks or build step required
