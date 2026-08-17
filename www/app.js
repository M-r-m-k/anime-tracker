/* ============ إعداد قاعدة البيانات المحلية (IndexedDB) ============ */
const DB_NAME = "anime_tracker_db";
const DB_VERSION = 2;
const STORE = "anime_items";
const SETTINGS_STORE = "app_settings";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains(STORE)) {
        const store = _db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("order", "order", { unique: false });
      }
      if (!_db.objectStoreNames.contains(SETTINGS_STORE)) {
        _db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

function dbPut(item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function dbClearAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

// إضافة عناصر على دفعات صغيرة عشان الأجهزة الضعيفة تستحمل، مع استراحة بين كل دفعة
function dbBulkPutBatched(items, batchSize = 25) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function nextBatch() {
      if (i >= items.length) { resolve(); return; }
      const batch = items.slice(i, i + batchSize);
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      batch.forEach((it) => store.put(it));
      tx.oncomplete = () => {
        i += batchSize;
        // نسيب فرصة للمتصفح "يلحق نفسه" قبل الدفعة اللي بعدها
        setTimeout(nextBatch, 30);
      };
      tx.onerror = (e) => reject(e);
    }
    nextBatch();
  });
}

/* ---- إعدادات التطبيق (اسم / صورة / معرض / ألوان) ---- */
function dbSettingsGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, "readonly");
    const req = tx.objectStore(SETTINGS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

function dbSettingsPut(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function dbSettingsClearAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function dbSettingsBulkPut(entries) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    const store = tx.objectStore(SETTINGS_STORE);
    entries.forEach((e) => store.put(e));
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

/* ============ حالة التطبيق ============ */
let animeList = [];
let editMode = false;
let currentEditId = null;
let pickedImageDataUrl = null;

const statusLabels = {
  "": "بدون حالة",
  finished_watched: "منتهي - تمت مشاهدته",
  finished_boring: "منتهي - ومملّ",
  ecchi_finished: "إيتشي - منتهي",
  ecchi_unwatched: "إيتشي - لم يُشاهد",
  unwatched: "لم تتم مشاهدته",
};

const DEFAULT_COLORS = {
  "--bg": "#0e0c14",
  "--bg-elevated": "#17141f",
  "--card": "#1c1826",
  "--card-border": "#2a2438",
  "--text-primary": "#f4f1fb",
  "--text-secondary": "#9691ac",
  "--text-faint": "#635d78",
  "--accent-1": "#ffb648",
  "--accent-2": "#ff6a3d",
  "--accent-3": "#ff3d77",
  "--success": "#34d399",
  "--danger": "#ff5470",
};

const COLOR_LABELS = {
  "--bg": "الخلفية الأساسية",
  "--bg-elevated": "خلفية المودالات",
  "--card": "خلفية الكروت",
  "--card-border": "حدود الكروت",
  "--text-primary": "النص الأساسي",
  "--text-secondary": "النص الثانوي",
  "--text-faint": "النص الخافت",
  "--accent-1": "لون مميز 1 (بداية التدرج)",
  "--accent-2": "لون مميز 2 (وسط التدرج)",
  "--accent-3": "لون مميز 3 (نهاية التدرج)",
  "--success": "لون النجاح",
  "--danger": "لون الخطر/الحذف",
};

const DEFAULT_APP_NAME = "قائمة الأنمي";

// الإعدادات الحالية في الذاكرة
let appSettings = {
  appName: DEFAULT_APP_NAME,
  logo: null, // data URL للصورة المختارة كصورة تطبيق
  gallery: [], // كل الصور المرفوعة
  colors: { ...DEFAULT_COLORS },
};

/* ============ عناصر DOM ============ */
const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const fabAdd = document.getElementById("fabAdd");
const menuBtn = document.getElementById("menuBtn");
const dropdownMenu = document.getElementById("dropdownMenu");
const toggleEditBtn = document.getElementById("toggleEditBtn");
const toggleEditLabel = document.getElementById("toggleEditLabel");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const appTitleEl = document.getElementById("appTitle");
const logoDotEl = document.getElementById("logoDot");

/* ============ تصغير وضغط الصور قبل التخزين ============
   بدون الخطوة دي، أي صورة من الكاميرا (ممكن توصل 4000×3000 بكسل و8 ميجا)
   بتتخزن وتتعرض بحجمها الأصلي كامل، وده بيستهلك رامة رهيبة ويسبب كراش
   على الأجهزة الضعيفة، خصوصًا لما يبقى عندك عشرات أو مئات الصور مع بعض. */
function resizeImageFile(file, maxWidth = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ عرض القائمة ============ */
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const statusFilter = filterSelect.value;

  const filtered = animeList
    .filter((a) => (query ? a.name.toLowerCase().includes(query) : true))
    .filter((a) => (statusFilter ? a.status === statusFilter : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  filtered.forEach((anime) => {
    const card = document.createElement("div");
    card.className = "card";

    const statusKey = anime.status || "empty";
    const statusText = statusLabels[anime.status] || "بدون حالة";

    card.innerHTML = `
      <div class="card-image-wrap">
        ${
          anime.image
            ? `<img src="${anime.image}" alt="${escapeHtml(anime.name)}" loading="lazy" decoding="async" />`
            : `<div class="no-image"><svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" opacity="0.4" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`
        }
        ${editMode ? `<button class="card-edit-btn" data-id="${anime.id}"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : ""}
      </div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(anime.name)}</div>
        <div class="status-chip st-${statusKey}">${statusText}</div>
      </div>
    `;

    if (editMode) {
      card.querySelector(".card-edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openAnimeModal(anime.id);
      });
    } else {
      card.addEventListener("click", () => quickStatusCycle(anime));
    }

    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const statusCycleOrder = ["", "unwatched", "finished_watched", "finished_boring", "ecchi_unwatched", "ecchi_finished"];
async function quickStatusCycle(anime) {
  const idx = statusCycleOrder.indexOf(anime.status || "");
  const next = statusCycleOrder[(idx + 1) % statusCycleOrder.length];
  anime.status = next;
  await dbPut(anime);
  render();
}

/* ============ وضع التعديل ============ */
function setEditMode(value) {
  editMode = value;
  toggleEditLabel.textContent = editMode ? "إنهاء التعديل" : "تعديل";
  fabAdd.classList.toggle("hidden", !editMode);
  render();
}

/* ============ مودال إضافة / تعديل أنمي ============ */
const animeModalOverlay = document.getElementById("animeModalOverlay");
const animeModalTitle = document.getElementById("animeModalTitle");
const nameInput = document.getElementById("nameInput");
const statusInput = document.getElementById("statusInput");
const imageInput = document.getElementById("imageInput");
const imagePicker = document.getElementById("imagePicker");
const imagePreview = document.getElementById("imagePreview");
const imagePlaceholder = document.getElementById("imagePlaceholder");
const deleteAnimeBtn = document.getElementById("deleteAnimeBtn");

function openAnimeModal(id = null) {
  currentEditId = id;
  pickedImageDataUrl = null;

  if (id) {
    const anime = animeList.find((a) => a.id === id);
    animeModalTitle.textContent = "تعديل الأنمي";
    nameInput.value = anime.name;
    statusInput.value = anime.status || "";
    if (anime.image) {
      imagePreview.src = anime.image;
      imagePreview.classList.remove("hidden");
      imagePlaceholder.classList.add("hidden");
    } else {
      imagePreview.classList.add("hidden");
      imagePlaceholder.classList.remove("hidden");
    }
    deleteAnimeBtn.classList.remove("hidden");
  } else {
    animeModalTitle.textContent = "إضافة أنمي";
    nameInput.value = "";
    statusInput.value = "";
    imagePreview.classList.add("hidden");
    imagePlaceholder.classList.remove("hidden");
    deleteAnimeBtn.classList.add("hidden");
  }

  animeModalOverlay.classList.remove("hidden");
}

function closeAnimeModal() {
  animeModalOverlay.classList.add("hidden");
  currentEditId = null;
  pickedImageDataUrl = null;
}

imagePicker.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;
  try {
    pickedImageDataUrl = await resizeImageFile(file, 480, 0.72);
    imagePreview.src = pickedImageDataUrl;
    imagePreview.classList.remove("hidden");
    imagePlaceholder.classList.add("hidden");
  } catch (e) {
    showToast("حصلت مشكلة في تحميل الصورة");
  }
});

document.getElementById("saveAnimeBtn").addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    showToast("اكتب اسم الأنمي الأول");
    return;
  }

  if (currentEditId) {
    const anime = animeList.find((a) => a.id === currentEditId);
    anime.name = name;
    anime.status = statusInput.value;
    if (pickedImageDataUrl) anime.image = pickedImageDataUrl;
    await dbPut(anime);
  } else {
    const newItem = {
      id: "a_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      name,
      status: statusInput.value,
      image: pickedImageDataUrl || null,
      order: animeList.length,
      createdAt: Date.now(),
    };
    animeList.push(newItem);
    await dbPut(newItem);
  }

  await reloadFromDB();
  closeAnimeModal();
  showToast("تم الحفظ ✅");
});

document.getElementById("cancelAnimeBtn").addEventListener("click", closeAnimeModal);

deleteAnimeBtn.addEventListener("click", async () => {
  if (!currentEditId) return;
  await dbDelete(currentEditId);
  await reloadFromDB();
  closeAnimeModal();
  showToast("تم الحذف 🗑️");
});

fabAdd.addEventListener("click", () => openAnimeModal(null));

/* ============ القائمة المنسدلة ============ */
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
    dropdownMenu.classList.add("hidden");
  }
});

toggleEditBtn.addEventListener("click", () => {
  setEditMode(!editMode);
  dropdownMenu.classList.add("hidden");
});

/* ============ البحث والفلترة ============ */
// تأخير بسيط (debounce) قبل إعادة البناء، عشان الكتابة السريعة
// متعملش عشرات عمليات إعادة رسم للشاشة خلال ثانية واحدة
let searchDebounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 220);
});
filterSelect.addEventListener("change", render);

/* ============ توست ============ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

/* ============ إعادة التحميل من القاعدة ============ */
async function reloadFromDB() {
  animeList = await dbGetAll();
  render();
}

/* ================================================================
   إعدادات التطبيق: صورة/اسم/ألوان
   ================================================================ */
function applyAppSettingsToUI() {
  appTitleEl.textContent = appSettings.appName || DEFAULT_APP_NAME;
  document.title = appSettings.appName || DEFAULT_APP_NAME;

  if (appSettings.logo) {
    logoDotEl.outerHTML = `<img id="logoDot" class="logo-img" src="${appSettings.logo}" alt="logo" />`;
  } else {
    const current = document.getElementById("logoDot");
    if (current.tagName === "IMG") {
      current.outerHTML = `<span id="logoDot" class="logo-dot"></span>`;
    }
  }

  const colors = { ...DEFAULT_COLORS, ...(appSettings.colors || {}) };
  Object.keys(colors).forEach((varName) => {
    document.documentElement.style.setProperty(varName, colors[varName]);
  });
}

async function loadAppSettingsFromDB() {
  const rows = await dbSettingsGetAll();
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });

  appSettings = {
    appName: map.appName || DEFAULT_APP_NAME,
    logo: map.logo || null,
    gallery: map.gallery || [],
    colors: { ...DEFAULT_COLORS, ...(map.colors || {}) },
  };
  applyAppSettingsToUI();
}

async function saveAppSettingKey(key, value) {
  appSettings[key] = value;
  await dbSettingsPut(key, value);
}

/* ---- مودال صورة التطبيق ---- */
const logoModalOverlay = document.getElementById("logoModalOverlay");
const uploadLogoBtn = document.getElementById("uploadLogoBtn");
const logoImageInput = document.getElementById("logoImageInput");
const logoGallery = document.getElementById("logoGallery");

document.getElementById("changeLogoBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderLogoGallery();
  logoModalOverlay.classList.remove("hidden");
});
document.getElementById("closeLogoModalBtn").addEventListener("click", () => {
  logoModalOverlay.classList.add("hidden");
});

uploadLogoBtn.addEventListener("click", () => logoImageInput.click());

logoImageInput.addEventListener("change", async () => {
  const files = Array.from(logoImageInput.files || []);
  if (files.length === 0) return;

  try {
    const newImages = await Promise.all(
      files.map((file) => resizeImageFile(file, 480, 0.72))
    );
    appSettings.gallery = [...appSettings.gallery, ...newImages];
    await dbSettingsPut("gallery", appSettings.gallery);
    renderLogoGallery();
    logoImageInput.value = "";
    showToast("تم رفع الصور ✅");
  } catch (e) {
    showToast("حصلت مشكلة أثناء رفع الصور");
  }
});

function renderLogoGallery() {
  logoGallery.innerHTML = "";
  if (appSettings.gallery.length === 0) {
    logoGallery.innerHTML = `<p class="hint-text">لسه مفيش صور مرفوعة.</p>`;
    return;
  }
  appSettings.gallery.forEach((imgSrc, idx) => {
    const item = document.createElement("div");
    item.className = "logo-gallery-item" + (imgSrc === appSettings.logo ? " active" : "");
    item.innerHTML = `
      <img src="${imgSrc}" alt="logo option" loading="lazy" decoding="async" />
      <button class="logo-delete-btn" data-idx="${idx}" aria-label="حذف">✕</button>
    `;
    item.querySelector("img").addEventListener("click", async () => {
      await saveAppSettingKey("logo", imgSrc);
      applyAppSettingsToUI();
      renderLogoGallery();
      showToast("اتغيرت صورة التطبيق ✅");
    });
    item.querySelector(".logo-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      const wasActive = appSettings.gallery[idx] === appSettings.logo;
      appSettings.gallery.splice(idx, 1);
      await dbSettingsPut("gallery", appSettings.gallery);
      if (wasActive) {
        await saveAppSettingKey("logo", null);
        applyAppSettingsToUI();
      }
      renderLogoGallery();
    });
    logoGallery.appendChild(item);
  });
}

/* ---- مودال اسم التطبيق ---- */
const nameModalOverlay = document.getElementById("nameModalOverlay");
const appNameInput = document.getElementById("appNameInput");

document.getElementById("changeNameBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  appNameInput.value = appSettings.appName || DEFAULT_APP_NAME;
  nameModalOverlay.classList.remove("hidden");
});
document.getElementById("cancelNameBtn").addEventListener("click", () => {
  nameModalOverlay.classList.add("hidden");
});
document.getElementById("saveNameBtn").addEventListener("click", async () => {
  const newName = appNameInput.value.trim();
  if (!newName) {
    showToast("اكتب اسم الأول");
    return;
  }
  await saveAppSettingKey("appName", newName);
  applyAppSettingsToUI();
  nameModalOverlay.classList.add("hidden");
  showToast("تم تغيير الاسم ✅");
});

/* ---- مودال تعديل الألوان ---- */
const colorsModalOverlay = document.getElementById("colorsModalOverlay");
const colorsList = document.getElementById("colorsList");

document.getElementById("editColorsBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderColorsList();
  colorsModalOverlay.classList.remove("hidden");
});

function renderColorsList() {
  colorsList.innerHTML = "";
  const colors = { ...DEFAULT_COLORS, ...(appSettings.colors || {}) };
  Object.keys(DEFAULT_COLORS).forEach((varName) => {
    const row = document.createElement("div");
    row.className = "color-row";
    row.innerHTML = `
      <span class="color-row-label">${COLOR_LABELS[varName] || varName}</span>
      <input type="color" class="color-swatch" data-var="${varName}" value="${colors[varName]}" />
      <input type="text" class="color-hex text-field" data-var="${varName}" value="${colors[varName]}" />
    `;
    const swatch = row.querySelector(".color-swatch");
    const hex = row.querySelector(".color-hex");
    swatch.addEventListener("input", () => {
      hex.value = swatch.value;
      document.documentElement.style.setProperty(varName, swatch.value);
    });
    hex.addEventListener("input", () => {
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.value)) {
        swatch.value = hex.value.length === 4
          ? "#" + [...hex.value.slice(1)].map((c) => c + c).join("")
          : hex.value;
        document.documentElement.style.setProperty(varName, hex.value);
      }
    });
    colorsList.appendChild(row);
  });
}

document.getElementById("saveColorsBtn").addEventListener("click", async () => {
  const newColors = {};
  colorsList.querySelectorAll(".color-hex").forEach((input) => {
    newColors[input.dataset.var] = input.value;
  });
  await saveAppSettingKey("colors", newColors);
  colorsModalOverlay.classList.add("hidden");
  showToast("تم حفظ الألوان ✅");
});

document.getElementById("resetColorsBtn").addEventListener("click", async () => {
  await saveAppSettingKey("colors", { ...DEFAULT_COLORS });
  applyAppSettingsToUI();
  renderColorsList();
  showToast("رجعنا الألوان الافتراضية");
});

// إغلاق المودالات الجديدة بالدوس برة (بنفس سلوك باقي المودالات)
[logoModalOverlay, nameModalOverlay, colorsModalOverlay].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

/* ================================================================
   نظام التشفير (AES-GCM + PBKDF2) للتصدير/الاستيراد
   ================================================================ */
async function deriveKey(password, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 210000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function encryptJSON(jsonString, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(jsonString));
  return {
    encrypted: true,
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    data: bufToBase64(cipherBuf),
  };
}

async function decryptJSON(payload, password) {
  const salt = new Uint8Array(base64ToBuf(payload.salt));
  const iv = new Uint8Array(base64ToBuf(payload.iv));
  const key = await deriveKey(password, salt);
  const cipherBuf = base64ToBuf(payload.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}

/* ============ مودال التصدير ============ */
const exportModalOverlay = document.getElementById("exportModalOverlay");
const encryptToggle = document.getElementById("encryptToggle");
const exportPasswordWrap = document.getElementById("exportPasswordWrap");
const exportPassword = document.getElementById("exportPassword");
const exportPasswordConfirm = document.getElementById("exportPasswordConfirm");

document.getElementById("exportBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  encryptToggle.checked = false;
  exportPasswordWrap.classList.add("hidden");
  exportPassword.value = "";
  exportPasswordConfirm.value = "";
  exportModalOverlay.classList.remove("hidden");
});

encryptToggle.addEventListener("change", () => {
  exportPasswordWrap.classList.toggle("hidden", !encryptToggle.checked);
});

document.getElementById("cancelExportBtn").addEventListener("click", () => {
  exportModalOverlay.classList.add("hidden");
});

document.getElementById("confirmExportBtn").addEventListener("click", async () => {
  const useEncryption = encryptToggle.checked;

  if (useEncryption) {
    if (exportPassword.value.length < 4) {
      showToast("كلمة السر لازم تكون 4 حروف على الأقل");
      return;
    }
    if (exportPassword.value !== exportPasswordConfirm.value) {
      showToast("كلمتا السر مش متطابقتين");
      return;
    }
  }

  const exportData = {
    appName: "anime-tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    items: animeList,
    settings: appSettings,
  };
  const jsonString = JSON.stringify(exportData);

  let fileContent;
  if (useEncryption) {
    fileContent = await encryptJSON(jsonString, exportPassword.value);
  } else {
    fileContent = { encrypted: false, data: jsonString };
  }

  const blob = new Blob([JSON.stringify(fileContent)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `anime-backup-${dateStr}.animebackup`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  exportModalOverlay.classList.add("hidden");
  showToast("تم تصدير الملف ✅");
});

/* ============ مودال الاستيراد ============ */
const importModalOverlay = document.getElementById("importModalOverlay");
const importFileInput = document.getElementById("importFileInput");
const importFileLabel = document.getElementById("importFileLabel");
const importPathInput = document.getElementById("importPathInput");
const loadFromPathBtn = document.getElementById("loadFromPathBtn");
const importPasswordWrap = document.getElementById("importPasswordWrap");
const importPassword = document.getElementById("importPassword");
const importError = document.getElementById("importError");
let pendingImportPayload = null;

document.getElementById("importBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  importFileInput.value = "";
  importFileLabel.textContent = "اختيار ملف";
  importPathInput.value = "";
  importPassword.value = "";
  importPasswordWrap.classList.add("hidden");
  importError.classList.add("hidden");
  pendingImportPayload = null;
  importModalOverlay.classList.remove("hidden");
});

document.getElementById("cancelImportBtn").addEventListener("click", () => {
  importModalOverlay.classList.add("hidden");
});

function parsePendingImportText(text) {
  try {
    pendingImportPayload = JSON.parse(text);
    importPasswordWrap.classList.toggle("hidden", !pendingImportPayload.encrypted);
    importError.classList.add("hidden");
  } catch (e) {
    importError.textContent = "الملف ده تالف أو مش بصيغة صحيحة";
    importError.classList.remove("hidden");
    pendingImportPayload = null;
  }
}

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  if (!file) return;
  importFileLabel.textContent = file.name;
  const text = await file.text();
  parsePendingImportText(text);
});

// تحميل من مسار مكتوب يدويًا (بيشتغل لو التطبيق شغال جوه متصفح عادي بيدعم قراءة ملفات محلية،
// أو لو اتضاف لاحقًا دعم Capacitor Filesystem. حاليًا: محاولة عبر fetch على مسار file:// كـ fallback)
loadFromPathBtn.addEventListener("click", async () => {
  const path = importPathInput.value.trim();
  if (!path) {
    showToast("اكتب مسار الملف الأول");
    return;
  }
  try {
    const normalized = path.startsWith("/") ? "file://" + path : path;
    const res = await fetch(normalized);
    if (!res.ok) throw new Error("read failed");
    const text = await res.text();
    parsePendingImportText(text);
    if (pendingImportPayload) showToast("تم تحميل الملف من المسار ✅");
  } catch (e) {
    importError.textContent = "معرفناش نقرأ الملف من المسار ده مباشرة على الجهاز ده — استخدم اختيار ملف بدلًا منه";
    importError.classList.remove("hidden");
  }
});

document.getElementById("confirmImportBtn").addEventListener("click", async () => {
  if (!pendingImportPayload) {
    showToast("اختار ملف الأول");
    return;
  }

  // نسخة احتياطية في الذاكرة من البيانات الحالية، لو حصل فشل نرجعلها بدل ما نمسحها بلا رجعة
  const previousItems = animeList.slice();
  const previousSettings = { ...appSettings, colors: { ...appSettings.colors }, gallery: [...appSettings.gallery] };

  try {
    let jsonString;
    if (pendingImportPayload.encrypted) {
      if (!importPassword.value) {
        importError.textContent = "الملف محمي بكلمة سر، اكتبها الأول";
        importError.classList.remove("hidden");
        return;
      }
      jsonString = await decryptJSON(pendingImportPayload, importPassword.value);
    } else {
      jsonString = pendingImportPayload.data;
    }

    const parsed = JSON.parse(jsonString);
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("invalid structure");
    }

    try {
      await dbClearAll();
      await dbBulkPutBatched(parsed.items, 25);

      if (parsed.settings) {
        await dbSettingsClearAll();
        const entries = Object.keys(parsed.settings).map((key) => ({ key, value: parsed.settings[key] }));
        await dbSettingsBulkPut(entries);
      }
    } catch (writeErr) {
      // فشل أثناء الكتابة: نحاول نرجّع البيانات القديمة زي ما كانت
      try {
        await dbClearAll();
        await dbBulkPutBatched(previousItems, 25);
        await dbSettingsClearAll();
        const restoreEntries = Object.keys(previousSettings).map((key) => ({ key, value: previousSettings[key] }));
        await dbSettingsBulkPut(restoreEntries);
      } catch (restoreErr) {
        // لو حتى الاسترجاع فشل، على الأقل مانمسحش المتغيرات في الذاكرة
      }
      throw writeErr;
    }

    await reloadFromDB();
    await loadAppSettingsFromDB();

    importModalOverlay.classList.add("hidden");
    showToast(`تم استيراد ${parsed.items.length} عنصر ✅`);
  } catch (e) {
    importError.textContent = "كلمة السر غلط أو الملف تالف أو حصلت مشكلة أثناء الاستيراد — البيانات القديمة اتحافظ عليها";
    importError.classList.remove("hidden");
  }
});

/* ============ بدء التشغيل ============ */
(async function init() {
  await openDB();
  await loadAppSettingsFromDB();
  await reloadFromDB();
})();
