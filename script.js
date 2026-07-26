(function () {
  const state = {
    items: [],
    transactions: [],
    range: "month",
    search: "",
    editingId: null,
  };

  // ---------- Penyimpanan otomatis di perangkat (IndexedDB) ----------
  const DB_NAME = "catatanStrukDB";
  const DB_VERSION = 1;
  const STORE_NAME = "transactions";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB tidak didukung perangkat ini"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function loadTransactionsFromDB() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("Gagal memuat data tersimpan:", err);
      return [];
    }
  }

  // Simpan ulang seluruh riwayat ke IndexedDB — dipanggil tiap ada tambah/edit/hapus/impor.
  async function persistTransactions() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        state.transactions.forEach((t) => store.put(t));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error("Gagal menyimpan data ke perangkat:", err);
    }
  }

  const fmtRp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const fmtRpCompact = (n) => {
    n = Math.round(n);
    if (n >= 1000000)
      return (
        (n / 1000000).toFixed(1).replace(".", ",").replace(",0", "") + "jt"
      );
    if (n >= 1000) return Math.round(n / 1000) + "rb";
    return String(n);
  };
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const escapeHtml = (s) =>
    (s || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // Rupiah: user types "17.000" meaning 17rb, bukan 17 koma nol. Ambil digitnya saja.
  const parseRupiah = (v) => {
    const digits = String(v == null ? "" : v).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  const formatRupiahDisplay = (v) => {
    const n = parseRupiah(v);
    return n ? n.toLocaleString("id-ID") : "";
  };
  // Format sambil mengetik, sambil menjaga posisi kursor tetap wajar
  function formatRupiahOnInput(el) {
    const oldPos = el.selectionStart;
    const digitsBefore = el.value.slice(0, oldPos).replace(/[^\d]/g, "").length;
    const n = parseRupiah(el.value);
    const formatted = n ? n.toLocaleString("id-ID") : "";
    el.value = formatted;
    let count = 0,
      pos = formatted.length;
    for (let k = 0; k < formatted.length; k++) {
      if (/\d/.test(formatted[k])) count++;
      if (count === digitsBefore) {
        pos = k + 1;
        break;
      }
    }
    if (digitsBefore === 0) pos = 0;
    el.setSelectionRange(pos, pos);
    return n;
  }

  document.getElementById("txDate").value = todayStr();

  // ---------- Top bar date ----------
  const dayNames = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jum'at",
    "Sabtu",
  ];
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  function tickClock() {
    const now = new Date();
    document.getElementById("dateChip").textContent =
      `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }
  tickClock();
  setInterval(tickClock, 30000);

  // ---------- Tabs (Struk / Manual) ----------
  const TAB_ON = ["bg-blue", "text-white"];
  const TAB_OFF = ["bg-gray-soft", "text-muted"];
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        b.classList.remove("active", ...TAB_ON);
        b.classList.add(...TAB_OFF);
      });
      btn.classList.remove(...TAB_OFF);
      btn.classList.add("active", ...TAB_ON);
      const target = btn.dataset.tab;
      document
        .getElementById("panel-scan")
        .classList.toggle("hidden", target !== "scan");
      document
        .getElementById("panel-manual")
        .classList.toggle("hidden", target !== "manual");
      if (target === "manual") document.getElementById("manName").focus();
    });
  });

  document.getElementById("fabAdd").addEventListener("click", () => {
    document.querySelector('.tab[data-tab="manual"]').click();
    document
      .getElementById("entryCard")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Manual quick-add form ----------
  const manPriceInput = document.getElementById("manPrice");
  manPriceInput.addEventListener("input", () =>
    formatRupiahOnInput(manPriceInput),
  );

  document.getElementById("manAddBtn").addEventListener("click", () => {
    const name = document.getElementById("manName").value.trim();
    const qty = parseFloat(document.getElementById("manQty").value) || 1;
    const price = parseRupiah(manPriceInput.value);
    if (!name || price <= 0) {
      document.getElementById("manName").focus();
      return;
    }
    state.items.push({ name, qty, price });
    document.getElementById("manName").value = "";
    document.getElementById("manQty").value = 1;
    manPriceInput.value = "";
    document.getElementById("manName").focus();
    renderItems();
  });
  manPriceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("manAddBtn").click();
  });

  // ---------- Item table rendering ----------
  const itemsBody = document.getElementById("itemsBody");
  function renderItems() {
    if (state.items.length === 0) {
      itemsBody.innerHTML =
        '<tr><td colspan="4" class="text-center text-muted text-xs py-4">Belum ada item. Pindai struk atau isi manual di atas.</td></tr>';
    } else {
      itemsBody.innerHTML = state.items
        .map(
          (it, i) => `
        <tr>
          <td class="py-1.5 px-1 border-b border-dashed border-line"><input data-i="${i}" data-f="name" value="${escapeHtml(it.name)}" placeholder="nama barang" class="w-full border-0 bg-transparent font-mono text-[12.5px] text-ink p-[3px] focus:outline focus:outline-1 focus:outline-blue focus:rounded-[4px]"></td>
          <td class="py-1.5 px-1 border-b border-dashed border-line text-right"><input data-i="${i}" data-f="qty" value="${it.qty}" inputmode="numeric" style="text-align:right" class="w-full border-0 bg-transparent font-mono text-[12.5px] text-ink p-[3px] focus:outline focus:outline-1 focus:outline-blue focus:rounded-[4px]"></td>
          <td class="py-1.5 px-1 border-b border-dashed border-line text-right"><input data-i="${i}" data-f="price" value="${formatRupiahDisplay(it.price)}" inputmode="numeric" style="text-align:right" class="w-full border-0 bg-transparent font-mono text-[12.5px] text-ink p-[3px] focus:outline focus:outline-1 focus:outline-blue focus:rounded-[4px]"></td>
          <td class="py-1.5 px-1 border-b border-dashed border-line">
            <button type="button" class="row-del flex items-center justify-center text-red cursor-pointer bg-transparent border-0 p-0.5 hover:opacity-70" data-i="${i}" title="Hapus baris">${iconX("row-del-icon")}</button>
          </td>
        </tr>`,
        )
        .join("");
    }
    updateTotal();
  }
  function updateTotal() {
    const total = state.items.reduce(
      (s, it) => s + (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 1),
      0,
    );
    document.getElementById("txTotal").textContent = fmtRp(total);
  }
  itemsBody.addEventListener("input", (e) => {
    const i = e.target.dataset.i,
      f = e.target.dataset.f;
    if (i === undefined) return;
    if (f === "price") {
      state.items[i][f] = formatRupiahOnInput(e.target);
    } else {
      state.items[i][f] = e.target.value;
    }
    if (f === "price" || f === "qty") updateTotal();
  });
  itemsBody.addEventListener("click", (e) => {
    const delBtn = e.target.closest(".row-del");
    if (delBtn) {
      state.items.splice(+delBtn.dataset.i, 1);
      renderItems();
    }
  });
  document.getElementById("addItemBtn").addEventListener("click", () => {
    state.items.push({ name: "", qty: 1, price: 0 });
    renderItems();
  });
  document.getElementById("clearTxBtn").addEventListener("click", () => {
    state.items = [];
    state.editingId = null;
    document.getElementById("previewWrap").style.display = "none";
    document.getElementById("ocrStatus").textContent = "";
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakBtn.classList.add("hidden");
    speakBtn.classList.remove("bg-blue", "text-white");
    speakBtn.classList.add("bg-gray-soft", "text-ink");
    renderItems();
  });

  // ---------- Camera / upload + OCR ----------
  const fileInput = document.getElementById("fileInput");
  const previewWrap = document.getElementById("previewWrap");
  const previewImg = document.getElementById("previewImg");
  const scanline = document.getElementById("scanline");
  const ocrStatus = document.getElementById("ocrStatus");
  const speakBtn = document.getElementById("speakBtn");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewWrap.style.display = "block";
    speakBtn.classList.add("hidden");
    runOCR(url);
  });

  async function runOCR(imgUrl) {
    scanline.style.display = "block";
    ocrStatus.textContent = "Memuat mesin baca teks…";
    try {
      const result = await Tesseract.recognize(imgUrl, "ind+eng", {
        logger: (m) => {
          if (m.status && m.progress !== undefined) {
            ocrStatus.textContent = `${m.status}… ${Math.round(m.progress * 100)}%`;
          }
        },
      });
      scanline.style.display = "none";
      ocrStatus.textContent =
        "Selesai membaca. Periksa hasil di tabel, perbaiki jika ada yang meleset.";
      const parsed = parseReceipt(result.data.text);
      applyParsed(parsed);
      speakReceipt(parsed);
    } catch (err) {
      scanline.style.display = "none";
      ocrStatus.textContent =
        "Gagal membaca struk otomatis — isi manual di tab sebelah.";
      console.error(err);
    }
  }

  // ---------- Baca struk dengan suara (text-to-speech) ----------
  let lastSpokenParsed = null;

  function buildSpeechText(parsed) {
    if (!parsed || !parsed.items.length) {
      return "Maaf, tidak ada barang yang terbaca jelas dari foto ini. Silakan periksa atau isi manual.";
    }
    const parts = parsed.items.map(
      (it) => `${it.name}, harga ${it.price.toLocaleString("id-ID")} rupiah`,
    );
    let text =
      `Ditemukan ${parsed.items.length} barang di struk ini. ` +
      parts.join(". ") +
      ".";
    if (parsed.total) {
      text += ` Total belanja ${parsed.total.toLocaleString("id-ID")} rupiah.`;
    }
    return text;
  }

  function speakReceipt(parsed) {
    if (!("speechSynthesis" in window)) {
      ocrStatus.textContent +=
        " (Perangkat ini tidak mendukung pembacaan suara otomatis.)";
      return;
    }
    lastSpokenParsed = parsed;
    speakBtn.classList.remove("hidden");
    doSpeak(buildSpeechText(parsed));
  }

  function doSpeak(text) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith("id"),
    );
    if (idVoice) utter.voice = idVoice;
    utter.onstart = () => {
      speakBtn.classList.remove("bg-gray-soft", "text-ink");
      speakBtn.classList.add("bg-blue", "text-white");
    };
    utter.onend = () => {
      speakBtn.classList.remove("bg-blue", "text-white");
      speakBtn.classList.add("bg-gray-soft", "text-ink");
    };
    utter.onerror = () => {
      speakBtn.classList.remove("bg-blue", "text-white");
      speakBtn.classList.add("bg-gray-soft", "text-ink");
    };
    window.speechSynthesis.speak(utter);
  }

  speakBtn.addEventListener("click", () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      speakBtn.classList.remove("bg-blue", "text-white");
      speakBtn.classList.add("bg-gray-soft", "text-ink");
      return;
    }
    doSpeak(buildSpeechText(lastSpokenParsed));
  });

  function parseReceipt(text) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const skipWords = [
      "NPWP",
      "KASIR",
      "STRUK",
      "TERIMA KASIH",
      "TUNAI",
      "KEMBALI",
      "CHANGE",
      "CASH",
      "PPN",
      "PAJAK",
      "JUMLAH ITEM",
      "BAYAR",
      "NO.",
      "ALAMAT",
      "TELP",
      "JL.",
      "PT ",
      "INDOMARET",
      "ALFAMART",
      "TANGGAL",
      "SUBTOTAL",
      "SUB TOTAL",
    ];
    const priceRe = /([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{3,})\s*$/;
    const items = [];
    let total = null;

    for (const raw of lines) {
      const upper = raw.toUpperCase();
      const isTotalLine = /\bTOTAL\b/.test(upper) && !/SUB\s*TOTAL/.test(upper);
      const m = raw.match(priceRe);
      if (!m) continue;
      const value = parseInt(m[1].replace(/[.,]/g, ""), 10);
      if (isNaN(value) || value <= 0) continue;

      if (isTotalLine) {
        total = value;
        continue;
      }
      if (skipWords.some((w) => upper.includes(w))) continue;

      let name = raw.slice(0, m.index).trim();
      name = name.replace(/^[x×*]?\s*\d+\s*[x×]\s*/i, "").trim();
      if (name.length < 2) continue;
      if (value > 5000000) continue;

      items.push({ name, qty: 1, price: value });
    }
    return { items, total };
  }

  function applyParsed(parsed) {
    if (parsed.items.length) {
      state.items = state.items.concat(parsed.items);
    }
    renderItems();
    if (parsed.total && parsed.items.length === 0) {
      state.items.push({
        name: "Belanja (total dari struk)",
        qty: 1,
        price: parsed.total,
      });
      renderItems();
    }
  }

  // ---------- Save / update transaction ----------
  document.getElementById("saveTxBtn").addEventListener("click", () => {
    const valid = state.items.filter(
      (it) =>
        (parseFloat(it.price) || 0) > 0 && (it.name || "").trim().length > 0,
    );
    if (valid.length === 0) {
      ocrStatus.textContent =
        "Isi minimal satu barang dengan nama dan harga sebelum menyimpan.";
      return;
    }
    const date = document.getElementById("txDate").value || todayStr();
    const total = valid.reduce(
      (s, it) => s + (parseFloat(it.price) || 0) * (parseFloat(it.qty) || 1),
      0,
    );
    const source =
      document.querySelector(".tab.active").dataset.tab === "manual" ||
      !previewImg.src
        ? "manual"
        : "struk";
    const record = {
      id: state.editingId || Date.now(),
      date,
      source: state.editingId
        ? state.transactions.find((t) => t.id === state.editingId)?.source ||
          source
        : source,
      items: valid.map((it) => ({
        name: it.name,
        qty: parseFloat(it.qty) || 1,
        price: parseFloat(it.price) || 0,
      })),
      total,
    };
    if (state.editingId) {
      state.transactions = state.transactions.map((t) =>
        t.id === state.editingId ? record : t,
      );
    } else {
      state.transactions.push(record);
    }
    state.editingId = null;
    state.items = [];
    previewWrap.style.display = "none";
    previewImg.src = "";
    ocrStatus.textContent =
      "Struk tersimpan di riwayat belanja (tersimpan otomatis di perangkat ini).";
    renderItems();
    renderLedger();
    tickClock();
    persistTransactions();
  });

  // ---------- Filter pills ----------
  const PILL_BASE = ["border-line", "text-muted", "bg-white"];
  const PILL_ACTIVE = {
    month: ["border-orange", "text-orange", "bg-orange-soft"],
    lastmonth: ["border-blue", "text-blue", "bg-blue-soft"],
    all: ["border-ink", "text-ink", "bg-gray-soft"],
  };
  document.querySelectorAll(".pill").forEach((p) => {
    p.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach((x) => {
        x.classList.remove(...PILL_ACTIVE[x.dataset.range]);
        x.classList.add(...PILL_BASE);
      });
      p.classList.remove(...PILL_BASE);
      p.classList.add(...PILL_ACTIVE[p.dataset.range]);
      state.range = p.dataset.range;
      renderLedger();
    });
  });
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderLedger();
  });

  function inRange(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    if (state.range === "all") return true;
    if (state.range === "month") {
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }
    if (state.range === "lastmonth") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
      );
    }
    return true;
  }

  function renderLedger() {
    const labelMap = {
      month: "Total bulan ini",
      lastmonth: "Total bulan lalu",
      all: "Total semua waktu",
    };
    document.getElementById("summaryLabel").textContent = labelMap[state.range];

    let list = state.transactions.filter((t) => inRange(t.date));
    if (state.search) {
      list = list.filter((t) =>
        t.items.some((it) => it.name.toLowerCase().includes(state.search)),
      );
    }
    list = list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const total = list.reduce((s, t) => s + t.total, 0);
    document.getElementById("rangeTotal").textContent = fmtRp(total);

    const wrap = document.getElementById("ledgerList");
    if (list.length === 0) {
      wrap.innerHTML =
        '<div class="text-center text-muted text-[13px] py-6 px-2.5 bg-card border border-line rounded-[14px]">Belum ada struk yang cocok. Pindai atau isi manual di atas.</div>';
    } else {
      wrap.innerHTML = list
        .map((t) => {
          const title =
            t.items[0].name +
            (t.items.length > 1 ? ` +${t.items.length - 1} lainnya` : "");
          const badgeCls =
            t.source === "manual"
              ? "bg-blue-soft text-blue"
              : "bg-orange-soft text-orange";
          return `
        <div class="ledger-card bg-card border border-line rounded-[14px] p-3.5 mb-2.5" data-id="${t.id}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-col gap-1.5 min-w-0">
              <span class="text-[10px] font-extrabold tracking-wide px-2.5 py-[3px] rounded-full w-fit uppercase ${badgeCls}">${t.source === "manual" ? "MANUAL" : "STRUK"}</span>
              <span class="font-semibold text-[13.5px] text-ink truncate">${escapeHtml(title)}</span>
              <span class="inline-flex items-center gap-1 text-[11px] text-muted">${iconCalendar("flex-shrink-0")} ${t.date}</span>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
              <span class="font-mono font-bold text-[14px] text-ink whitespace-nowrap">${fmtRp(t.total)}</span>
              <div class="flex gap-1">
                <button class="icon-btn view-btn bg-transparent border-0 cursor-pointer p-1 rounded-md hover:bg-gray-soft inline-flex items-center justify-center text-purple transition-colors" data-id="${t.id}" title="Lihat detail">${iconEye("")}</button>
                <button class="icon-btn edit-btn bg-transparent border-0 cursor-pointer p-1 rounded-md hover:bg-gray-soft inline-flex items-center justify-center text-blue transition-colors" data-id="${t.id}" title="Edit">${iconPencil("")}</button>
                <button class="icon-btn del-btn bg-transparent border-0 cursor-pointer p-1 rounded-md hover:bg-gray-soft inline-flex items-center justify-center text-red transition-colors" data-id="${t.id}" title="Hapus">${iconTrash("")}</button>
              </div>
            </div>
          </div>
          <div class="ledger-items hidden mt-2.5 pt-2.5 border-t border-dashed border-line text-[12px] leading-relaxed text-muted font-mono" id="detail-${t.id}">
            ${t.items.map((it) => `${escapeHtml(it.name)} · ${it.qty}x · ${fmtRp(it.price)}`).join("<br>")}
          </div>
        </div>`;
        })
        .join("");
    }
    renderChart();
  }

  // ---------- Grafik pengeluaran per bulan ----------
  function renderChart() {
    const chartEmpty = document.getElementById("chartEmpty");
    const chartBars = document.getElementById("chartBars");

    const totalsByMonth = {};
    state.transactions.forEach((t) => {
      const key = t.date.slice(0, 7); // YYYY-MM
      totalsByMonth[key] = (totalsByMonth[key] || 0) + t.total;
    });
    const keys = Object.keys(totalsByMonth).sort();
    const last6 = keys.slice(-6);

    if (last6.length === 0) {
      chartEmpty.classList.remove("hidden");
      chartBars.classList.add("hidden");
      chartBars.innerHTML = "";
      return;
    }
    chartEmpty.classList.add("hidden");
    chartBars.classList.remove("hidden");

    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const max = Math.max(...last6.map((k) => totalsByMonth[k]), 1);

    chartBars.innerHTML = last6
      .map((k) => {
        const [y, m] = k.split("-");
        const label = monthNames[parseInt(m, 10) - 1].slice(0, 3);
        const val = totalsByMonth[k];
        const heightPct = Math.max((val / max) * 100, 3);
        const isCurrent = k === currentKey;
        const gradCls = isCurrent
          ? "from-coral to-[#FFB199]"
          : "from-blue to-[#A9C6FC]";
        return `
        <div class="chart-bar-col flex-1 min-w-0 flex flex-col items-center h-full">
          <div class="bar-track flex-1 w-full flex items-end justify-center">
            <div class="chart-bar w-full max-w-9 min-h-1 rounded-t-[7px] rounded-b-[3px] bg-gradient-to-b ${gradCls} transition-[height] duration-300 ease-out" style="height:${heightPct}%" title="${label} ${y} — ${fmtRp(val)}"></div>
          </div>
          <div class="font-mono text-[10.5px] font-bold text-ink mt-2 whitespace-nowrap">${label}</div>
          <div class="font-mono text-[9px] text-muted mt-0.5 whitespace-nowrap">${fmtRpCompact(val)}</div>
        </div>`;
      })
      .join("");
  }

  function iconEye(cls) {
    return `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  function iconPencil(cls) {
    return `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
  }
  function iconTrash(cls) {
    return `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z"/></svg>`;
  }
  function iconX(cls) {
    return `<svg class="${cls}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }
  function iconCalendar(cls) {
    return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  }

  document.getElementById("ledgerList").addEventListener("click", (e) => {
    const view = e.target.closest(".view-btn");
    const edit = e.target.closest(".edit-btn");
    const del = e.target.closest(".del-btn");

    if (view) {
      const el = document.getElementById("detail-" + view.dataset.id);
      el.classList.toggle("hidden");
    }
    if (del) {
      state.transactions = state.transactions.filter(
        (t) => t.id !== +del.dataset.id,
      );
      renderLedger();
      persistTransactions();
    }
    if (edit) {
      const t = state.transactions.find((t) => t.id === +edit.dataset.id);
      if (!t) return;
      state.items = t.items.map((it) => ({ ...it }));
      document.getElementById("txDate").value = t.date;
      state.editingId = t.id;
      renderItems();
      document
        .getElementById("entryCard")
        .scrollIntoView({ behavior: "smooth", block: "start" });
      ocrStatus.textContent =
        "Mode edit — ubah item lalu tekan Simpan untuk memperbarui.";
    }
  });

  // ---------- Export / Import (persistence workaround, no localStorage) ----------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.transactions, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `struk-masuk-${todayStr()}.json`;
    a.click();
  });

  function formatDateID(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  document.getElementById("exportPdfBtn").addEventListener("click", () => {
    if (!(window.jspdf && window.jspdf.jsPDF)) {
      ocrStatus.textContent =
        "Gagal memuat modul PDF. Periksa koneksi internet lalu coba lagi.";
      return;
    }
    let list = state.transactions.filter((t) => inRange(t.date));
    if (state.search) {
      list = list.filter((t) =>
        t.items.some((it) => it.name.toLowerCase().includes(state.search)),
      );
    }
    if (list.length === 0) {
      ocrStatus.textContent =
        "Belum ada data belanja pada periode ini untuk diekspor ke PDF.";
      return;
    }
    list = list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    const now = new Date();
    let title;
    if (state.range === "month") {
      title = `Pengeluaran Uang Di Bulan ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    } else if (state.range === "lastmonth") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      title = `Pengeluaran Uang Di Bulan ${monthNames[lm.getMonth()]} ${lm.getFullYear()}`;
    } else {
      title = `Pengeluaran Uang — Semua Periode`;
    }

    const rows = [];
    list.forEach((t) => {
      t.items.forEach((it) => {
        rows.push([
          formatDateID(t.date),
          it.name,
          String(it.qty),
          fmtRp(it.price),
        ]);
      });
    });
    const grandTotal = list.reduce((s, t) => s + t.total, 0);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Dicetak: ${formatDateID(todayStr())}  ·  ${list.length} struk  ·  ${rows.length} item`,
      14,
      25,
    );

    doc.autoTable({
      startY: 31,
      head: [["Tanggal", "Nama Barang", "Qty", "Harga"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        2: { halign: "right", cellWidth: 18 },
        3: { halign: "right", cellWidth: 32 },
      },
      alternateRowStyles: { fillColor: [244, 246, 250] },
    });

    const finalY = doc.lastAutoTable.finalY || 31;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 8, 196, finalY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Total Keseluruhan", 14, finalY + 18);
    doc.text(fmtRp(grandTotal), 196, finalY + 18, { align: "right" });

    doc.save(`pengeluaran-${state.range}-${todayStr()}.pdf`);
    ocrStatus.textContent = "PDF pengeluaran berhasil dibuat dan diunduh.";
  });

  document
    .getElementById("importBtn")
    .addEventListener("click", () =>
      document.getElementById("importFile").click(),
    );
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          state.transactions = state.transactions.concat(
            data.map((t, idx) => ({
              source: "struk",
              ...t,
              id: t.id || Date.now() + idx,
            })),
          );
          renderLedger();
          ocrStatus.textContent =
            "Data berhasil diimpor (tersimpan otomatis di perangkat ini).";
          persistTransactions();
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

  // ---------- Muat data tersimpan saat aplikasi dibuka ----------
  (async function init() {
    state.transactions = await loadTransactionsFromDB();
    renderItems();
    renderLedger();
    if (state.transactions.length) {
      ocrStatus.textContent = `Memuat ${state.transactions.length} struk tersimpan dari perangkat ini.`;
    }
  })();
})();
