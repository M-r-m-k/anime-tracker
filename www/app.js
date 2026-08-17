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
// وتقرير نسبة التقدم لعرضها في شريط التحميل
function dbBulkPutBatched(items, batchSize = 25, onProgress) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function nextBatch() {
      if (i >= items.length) {
        if (onProgress) onProgress(items.length, items.length);
        resolve();
        return;
      }
      const batch = items.slice(i, i + batchSize);
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      batch.forEach((it) => store.put(it));
      tx.oncomplete = () => {
        i += batchSize;
        if (onProgress) onProgress(Math.min(i, items.length), items.length);
        setTimeout(nextBatch, 30);
      };
      tx.onerror = (e) => reject(e);
    }
    nextBatch();
  });
}

/* ---- إعدادات التطبيق (اسم / صورة / معرض / ألوان / نصوص / حالات) ---- */
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

/* ============ القيم الافتراضية ============ */
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
  "--progress": "#3b82f6",
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
  "--progress": "لون شريط التحميل",
};

const DEFAULT_STATUSES = [
  { key: "finished_watched", label: "منتهي - تمت مشاهدته", color: "#34d399" },
  { key: "finished_boring", label: "منتهي - وممل، لن يتم تحميله مرة أخرى", color: "#9691ac" },
  { key: "ecchi_finished", label: "إيتشي - منتهي", color: "#ff3d77" },
  { key: "ecchi_unwatched", label: "إيتشي - لم يُشاهد", color: "#ff6a3d" },
  { key: "unwatched", label: "لم تتم مشاهدته", color: "#ffb648" },
];

const DEFAULT_TEXTS = {
  search_placeholder: "ابحث عن أنمي...",
  empty_title: "لسه مفيش أي أنمي مضاف",
  empty_subtitle: "افتح وضع التعديل وضيف أول عنصر",
  menu_edit: "تعديل",
  menu_edit_done: "إنهاء التعديل",
  menu_change_logo: "تغيير صورة التطبيق",
  menu_change_name: "تغيير اسم التطبيق",
  menu_edit_colors: "تعديل الألوان",
  menu_edit_texts: "تعديل النصوص",
  menu_edit_statuses: "تعديل الحالات",
  menu_export: "تصدير نسخة احتياطية",
  menu_import: "استيراد نسخة احتياطية",
  status_all: "الكل",
  status_none: "بدون حالة",
  field_label_image: "صورة الغلاف",
  image_picker_placeholder: "دوس لاختيار صورة",
  field_label_name: "الاسم",
  field_name_placeholder: "اسم الأنمي",
  field_label_status: "الحالة",
  btn_delete: "حذف",
  btn_cancel: "إلغاء",
  btn_save: "حفظ",
  btn_close: "إغلاق",
  btn_reset_default: "استرجاع الافتراضي",
  btn_choose_file: "اختيار ملف",
  btn_import: "استيراد",
  btn_upload_new_image: "رفع صورة جديدة",
  modal_add_title: "إضافة أنمي",
  modal_edit_title: "تعديل الأنمي",
  logo_modal_title: "تغيير صورة التطبيق",
  logo_modal_desc: "ارفع صورة أو أكتر، وادوس على أي صورة عشان تخليها صورة التطبيق الحالية. باقي الصور بتفضل محفوظة تقدر ترجعلها تاني وقت ما تحب.",
  name_modal_title: "تغيير اسم التطبيق",
  field_label_new_name: "الاسم الجديد",
  colors_modal_title: "تعديل الألوان",
  colors_modal_desc: "أي تغيير بيتطبق فورًا. لما تخلص دوس حفظ عشان يتثبت.",
  texts_modal_title: "تعديل النصوص",
  texts_modal_desc: "غيّر أي نص ظاهر في التطبيق زي ما تحب. الحفظ بيتطبق فورًا.",
  statuses_modal_title: "تعديل الحالات",
  statuses_modal_desc: "تقدر تحذف أي حالة أو تضيف حالة جديدة بلونها الخاص.",
  field_label_new_status: "إضافة حالة جديدة",
  field_new_status_placeholder: "اسم الحالة الجديدة",
  export_modal_title: "تصدير نسخة احتياطية",
  export_modal_desc: "هيتصدّر ملف واحد فيه كل بياناتك (الأسماء، الصور، الحالات، الشكل العام) تقدر تنقله لأي جهاز.",
  export_encrypt_label: "تشفير الملف بكلمة سر",
  export_password_warning: "⚠️ لو نسيت كلمة السر، مش هيبقى فيه طريقة لاسترجاع البيانات.",
  export_confirm_btn: "تصدير الآن",
  field_label_password: "كلمة السر",
  field_password_placeholder: "اكتب كلمة سر قوية",
  field_label_password_confirm: "تأكيد كلمة السر",
  field_password_confirm_placeholder: "اكتب كلمة السر تاني",
  field_import_password_placeholder: "اكتب كلمة سر الملف",
  import_modal_title: "استيراد نسخة احتياطية",
  import_modal_desc: "هيتم استبدال كل البيانات الحالية بالبيانات اللي في الملف.",
  field_label_choose_file: "اختار الملف من الجهاز",
  toast_saved: "تم الحفظ ✅",
  toast_deleted: "تم الحذف 🗑️",
  toast_name_saved: "تم تغيير الاسم ✅",
  toast_colors_saved: "تم حفظ الألوان ✅",
  toast_colors_reset: "رجعنا الألوان الافتراضية",
  toast_texts_saved: "تم حفظ النصوص ✅",
  toast_texts_reset: "رجعنا النصوص الافتراضية",
  toast_status_added: "تمت إضافة الحالة ✅",
  toast_status_deleted: "تم حذف الحالة 🗑️",
  toast_images_uploaded: "تم رفع الصور ✅",
  toast_logo_changed: "اتغيرت صورة التطبيق ✅",
  toast_export_done: "تم تصدير الملف ✅",
  toast_name_missing: "اكتب الاسم الأول",
  toast_status_name_missing: "اكتب اسم الحالة الأول",
  toast_image_error: "حصلت مشكلة في تحميل الصورة",
  toast_images_error: "حصلت مشكلة أثناء رفع الصور",
  toast_password_short: "كلمة السر لازم تكون 4 حروف على الأقل",
  toast_password_mismatch: "كلمتا السر مش متطابقتين",
  toast_choose_file_first: "اختار ملف الأول",
  import_error_generic: "كلمة السر غلط أو الملف تالف أو حصلت مشكلة أثناء الاستيراد — البيانات القديمة اتحافظ عليها",
  import_error_invalid_file: "الملف ده تالف أو مش بصيغة صحيحة",
  import_error_password_needed: "الملف محمي بكلمة سر، اكتبها الأول",
};

const DEFAULT_APP_NAME = "Animelist";

// الإعدادات الحالية في الذاكرة
let appSettings = {
  appName: DEFAULT_APP_NAME,
  logo: null,
  gallery: [],
  colors: { ...DEFAULT_COLORS },
  texts: { ...DEFAULT_TEXTS },
  statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
};

/* ============ حالة التطبيق ============ */
let animeList = [];
let editMode = false;
let currentEditId = null;
let pickedImageDataUrl = null;
let selectedAnimeStatus = "";
let selectedFilterStatus = "";

/* ============ عناصر DOM ============ */
const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const fabAdd = document.getElementById("fabAdd");
const menuBtn = document.getElementById("menuBtn");
const dropdownMenu = document.getElementById("dropdownMenu");
const toggleEditBtn = document.getElementById("toggleEditBtn");
const toggleEditLabel = document.getElementById("toggleEditLabel");
const searchInput = document.getElementById("searchInput");
const filterSegments = document.getElementById("filterSegments");
const appTitleEl = document.getElementById("appTitle");
const logoDotEl = document.getElementById("logoDot");

/* ============ دالة الترجمة/النصوص القابلة للتعديل ============ */
function t(key) {
  return (appSettings.texts && appSettings.texts[key]) ?? DEFAULT_TEXTS[key] ?? key;
}

function applyTexts() {
  document.querySelectorAll("[data-text-key]").forEach((el) => {
    el.textContent = t(el.dataset.textKey);
  });
  document.querySelectorAll("[data-text-placeholder-key]").forEach((el) => {
    el.placeholder = t(el.dataset.textPlaceholderKey);
  });
  toggleEditLabel.textContent = editMode ? t("menu_edit_done") : t("menu_edit");
}

/* ============ تصغير وضغط الصور قبل التخزين ============ */
function resizeImageFile(file, maxWidth = 480, quality = 0.72, onProgress) {
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(15, "جاري القراءة...");
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      if (onProgress) onProgress(50, "جاري المعالجة...");
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
        if (onProgress) onProgress(90, "جاري الحفظ...");
        const result = canvas.toDataURL("image/jpeg", quality);
        if (onProgress) onProgress(100, "تم ✅");
        resolve(result);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ شريط التقدم (Progress Bar) ============ */
function setProgress(prefix, percent, label) {
  const wrap = document.getElementById(prefix + "ProgressWrap");
  const fill = document.getElementById(prefix + "ProgressFill");
  const lbl = document.getElementById(prefix + "ProgressLabel");
  if (!wrap) return;
  wrap.classList.remove("hidden");
  const p = Math.min(100, Math.max(0, percent));
  fill.style.width = p + "%";
  lbl.textContent = label || `${Math.round(p)}%`;
}
function hideProgress(prefix) {
  const wrap = document.getElementById(prefix + "ProgressWrap");
  if (wrap) wrap.classList.add("hidden");
}

/* ============ تطبيق الألوان على الواجهة ============ */
function applyColorsToUI() {
  const root = document.documentElement;
  Object.entries(appSettings.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function applyAppIdentity() {
  appTitleEl.textContent = appSettings.appName || DEFAULT_APP_NAME;
  if (appSettings.logo) {
    logoDotEl.style.background = `url(${appSettings.logo}) center/cover`;
    logoDotEl.style.boxShadow = "none";
  } else {
    logoDotEl.style.background = "";
    logoDotEl.style.boxShadow = "";
  }
}

/* ============ تحميل الإعدادات من القاعدة مع دمج القيم الافتراضية ============ */
async function loadAppSettingsFromDB() {
  const rows = await dbSettingsGetAll();
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });

  appSettings = {
    appName: map.appName ?? DEFAULT_APP_NAME,
    logo: map.logo ?? null,
    gallery: map.gallery ?? [],
    colors: { ...DEFAULT_COLORS, ...(map.colors || {}) },
    texts: { ...DEFAULT_TEXTS, ...(map.texts || {}) },
    statuses: (map.statuses && map.statuses.length ? map.statuses : DEFAULT_STATUSES).map((s) => ({ ...s })),
  };

  applyColorsToUI();
  applyAppIdentity();
  applyTexts();
}

/* ============ عرض القائمة ============ */
function getStatusMeta(key) {
  if (!key) return { label: t("status_none"), color: "var(--text-faint)" };
  const found = appSettings.statuses.find((s) => s.key === key);
  return found ? { label: found.label, color: found.color } : { label: t("status_none"), color: "var(--text-faint)" };
}

function render() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = animeList
    .filter((a) => (query ? a.name.toLowerCase().includes(query) : true))
    .filter((a) => (selectedFilterStatus ? a.status === selectedFilterStatus : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length !== 0);

  filtered.forEach((anime) => {
    const card = document.createElement("div");
    card.className = "card";
    const meta = getStatusMeta(anime.status);

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
        <div class="status-chip" style="color:${meta.color};border-color:${hexToRgba(meta.color, 0.4)};background:${hexToRgba(meta.color, 0.1)};">${escapeHtml(meta.label)}</div>
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

async function quickStatusCycle(anime) {
  const order = ["", ...appSettings.statuses.map((s) => s.key)];
  const idx = order.indexOf(anime.status || "");
  const next = order[(idx + 1) % order.length];
  anime.status = next;
  await dbPut(anime);
  render();
}

/* ============ وضع التعديل ============ */
function setEditMode(value) {
  editMode = value;
  toggleEditLabel.textContent = editMode ? t("menu_edit_done") : t("menu_edit");
  fabAdd.classList.toggle("hidden", !editMode);
  render();
}

/* ============ عنصر واجهة الشرائح الملونة (Segmented Control) ============ */
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#")) return `rgba(99,93,120,${alpha})`;
  let c = hex.slice(1);
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderSegmented(container, options, selectedKey, onSelect) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("button");
    chip.type = "button";
    const isActive = opt.key === selectedKey;
    chip.className = "seg-chip" + (isActive ? " active" : "");
    if (isActive) {
      chip.style.background = opt.color;
      chip.style.color = "#0e0c14";
      chip.style.borderColor = opt.color;
    } else {
      chip.style.background = hexToRgba(opt.color, 0.12);
      chip.style.color = opt.color;
      chip.style.borderColor = hexToRgba(opt.color, 0.45);
    }
    chip.textContent = opt.label;
    chip.addEventListener("click", () => onSelect(opt.key));
    container.appendChild(chip);
  });
}

function getStatusOptions(includeAll) {
  const base = appSettings.statuses.map((s) => ({ key: s.key, label: s.label, color: s.color }));
  const none = { key: "", label: includeAll ? t("status_all") : t("status_none"), color: "#635d78" };
  return [none, ...base];
}

function renderFilterSegments() {
  renderSegmented(filterSegments, getStatusOptions(true), selectedFilterStatus, (key) => {
    selectedFilterStatus = key;
    renderFilterSegments();
    render();
  });
}

function renderAnimeStatusSegments() {
  const container = document.getElementById("statusSegments");
  renderSegmented(container, getStatusOptions(false), selectedAnimeStatus, (key) => {
    selectedAnimeStatus = key;
    renderAnimeStatusSegments();
  });
}

/* ============ مودال إضافة / تعديل أنمي ============ */
const animeModalOverlay = document.getElementById("animeModalOverlay");
const animeModalTitle = document.getElementById("animeModalTitle");
const nameInput = document.getElementById("nameInput");
const imageInput = document.getElementById("imageInput");
const imagePicker = document.getElementById("imagePicker");
const imagePreview = document.getElementById("imagePreview");
const imagePlaceholder = document.getElementById("imagePlaceholder");
const deleteAnimeBtn = document.getElementById("deleteAnimeBtn");

function openAnimeModal(id = null) {
  currentEditId = id;
  pickedImageDataUrl = null;
  hideProgress("image");

  if (id) {
    const anime = animeList.find((a) => a.id === id);
    animeModalTitle.textContent = t("modal_edit_title");
    nameInput.value = anime.name;
    selectedAnimeStatus = anime.status || "";
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
    animeModalTitle.textContent = t("modal_add_title");
    nameInput.value = "";
    selectedAnimeStatus = "";
    imagePreview.classList.add("hidden");
    imagePlaceholder.classList.remove("hidden");
    deleteAnimeBtn.classList.add("hidden");
  }

  renderAnimeStatusSegments();
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
    pickedImageDataUrl = await resizeImageFile(file, 480, 0.72, (p, label) => {
      setProgress("image", p, label);
    });
    imagePreview.src = pickedImageDataUrl;
    imagePreview.classList.remove("hidden");
    imagePlaceholder.classList.add("hidden");
    setTimeout(() => hideProgress("image"), 500);
  } catch (e) {
    hideProgress("image");
    showToast(t("toast_image_error"));
  }
});

document.getElementById("saveAnimeBtn").addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    showToast(t("toast_name_missing"));
    return;
  }

  if (currentEditId) {
    const anime = animeList.find((a) => a.id === currentEditId);
    anime.name = name;
    anime.status = selectedAnimeStatus;
    if (pickedImageDataUrl) anime.image = pickedImageDataUrl;
    await dbPut(anime);
  } else {
    const newItem = {
      id: "a_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      name,
      status: selectedAnimeStatus,
      image: pickedImageDataUrl || null,
      order: animeList.length,
      createdAt: Date.now(),
    };
    animeList.push(newItem);
    await dbPut(newItem);
  }

  await reloadFromDB();
  closeAnimeModal();
  showToast(t("toast_saved"));
});

document.getElementById("cancelAnimeBtn").addEventListener("click", closeAnimeModal);

deleteAnimeBtn.addEventListener("click", async () => {
  if (!currentEditId) return;
  await dbDelete(currentEditId);
  await reloadFromDB();
  closeAnimeModal();
  showToast(t("toast_deleted"));
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
let searchDebounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 220);
});

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

/* ============ مودال صورة التطبيق ============ */
const logoModalOverlay = document.getElementById("logoModalOverlay");
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
document.getElementById("uploadLogoBtn").addEventListener("click", () => logoImageInput.click());

function renderLogoGallery() {
  logoGallery.innerHTML = "";
  appSettings.gallery.forEach((imgSrc, idx) => {
    const item = document.createElement("div");
    item.className = "logo-gallery-item" + (appSettings.logo === imgSrc ? " active" : "");
    item.innerHTML = `
      <img src="${imgSrc}" alt="logo option" loading="lazy" decoding="async" />
      <button class="logo-delete-btn" data-idx="${idx}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    item.querySelector("img").addEventListener("click", async () => {
      appSettings.logo = imgSrc;
      await dbSettingsPut("logo", appSettings.logo);
      applyAppIdentity();
      renderLogoGallery();
      showToast(t("toast_logo_changed"));
    });
    item.querySelector(".logo-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      appSettings.gallery.splice(idx, 1);
      if (appSettings.logo === imgSrc) appSettings.logo = null;
      await dbSettingsPut("gallery", appSettings.gallery);
      await dbSettingsPut("logo", appSettings.logo);
      applyAppIdentity();
      renderLogoGallery();
    });
    logoGallery.appendChild(item);
  });
}

logoImageInput.addEventListener("change", async () => {
  const files = Array.from(logoImageInput.files || []);
  if (files.length === 0) return;

  try {
    const newImages = [];
    for (let i = 0; i < files.length; i++) {
      const base = (i / files.length) * 100;
      const img = await resizeImageFile(files[i], 480, 0.72, (p) => {
        setProgress("logo", base + p / files.length, `جاري رفع ${i + 1}/${files.length}...`);
      });
      newImages.push(img);
    }
    appSettings.gallery = [...appSettings.gallery, ...newImages];
    await dbSettingsPut("gallery", appSettings.gallery);
    renderLogoGallery();
    logoImageInput.value = "";
    setProgress("logo", 100, "تم ✅");
    setTimeout(() => hideProgress("logo"), 500);
    showToast(t("toast_images_uploaded"));
  } catch (e) {
    hideProgress("logo");
    showToast(t("toast_images_error"));
  }
});

/* ============ مودال اسم التطبيق ============ */
const nameModalOverlay = document.getElementById("nameModalOverlay");
const appNameInput = document.getElementById("appNameInput");

document.getElementById("changeNameBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  appNameInput.value = appSettings.appName;
  nameModalOverlay.classList.remove("hidden");
});
document.getElementById("cancelNameBtn").addEventListener("click", () => {
  nameModalOverlay.classList.add("hidden");
});
document.getElementById("saveNameBtn").addEventListener("click", async () => {
  const newName = appNameInput.value.trim();
  if (!newName) {
    showToast(t("toast_name_missing"));
    return;
  }
  appSettings.appName = newName;
  await dbSettingsPut("appName", newName);
  applyAppIdentity();
  nameModalOverlay.classList.add("hidden");
  showToast(t("toast_name_saved"));
});

/* ============ مودال تعديل الألوان ============ */
const colorsModalOverlay = document.getElementById("colorsModalOverlay");
const colorsList = document.getElementById("colorsList");
let tempColors = {};

document.getElementById("editColorsBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  tempColors = { ...appSettings.colors };
  renderColorsList();
  colorsModalOverlay.classList.remove("hidden");
});

function renderColorsList() {
  colorsList.innerHTML = "";
  Object.keys(DEFAULT_COLORS).forEach((key) => {
    const row = document.createElement("div");
    row.className = "color-row";
    row.innerHTML = `
      <span class="color-row-label">${COLOR_LABELS[key] || key}</span>
      <input type="color" value="${tempColors[key]}" data-key="${key}" />
    `;
    row.querySelector("input").addEventListener("input", (e) => {
      tempColors[key] = e.target.value;
      document.documentElement.style.setProperty(key, e.target.value);
    });
    colorsList.appendChild(row);
  });
}

document.getElementById("saveColorsBtn").addEventListener("click", async () => {
  appSettings.colors = { ...tempColors };
  await dbSettingsPut("colors", appSettings.colors);
  colorsModalOverlay.classList.add("hidden");
  showToast(t("toast_colors_saved"));
});

document.getElementById("resetColorsBtn").addEventListener("click", () => {
  tempColors = { ...DEFAULT_COLORS };
  applyColorsPreview();
  renderColorsList();
  showToast(t("toast_colors_reset"));
});

function applyColorsPreview() {
  Object.entries(tempColors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

/* ============ مودال تعديل النصوص ============ */
const textsModalOverlay = document.getElementById("textsModalOverlay");
const textsList = document.getElementById("textsList");
let tempTexts = {};

const TEXT_GROUPS_ORDER = Object.keys(DEFAULT_TEXTS);

document.getElementById("editTextsBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  tempTexts = { ...appSettings.texts };
  renderTextsList();
  textsModalOverlay.classList.remove("hidden");
});

function renderTextsList() {
  textsList.innerHTML = "";
  TEXT_GROUPS_ORDER.forEach((key) => {
    const row = document.createElement("div");
    row.className = "text-row";
    row.innerHTML = `
      <label class="field-label">${key}</label>
      <input type="text" class="text-field" value="${escapeHtml(tempTexts[key] ?? "")}" data-key="${key}" />
    `;
    row.querySelector("input").addEventListener("input", (e) => {
      tempTexts[key] = e.target.value;
    });
    textsList.appendChild(row);
  });
}

document.getElementById("saveTextsBtn").addEventListener("click", async () => {
  appSettings.texts = { ...tempTexts };
  await dbSettingsPut("texts", appSettings.texts);
  applyTexts();
  renderFilterSegments();
  textsModalOverlay.classList.add("hidden");
  showToast(t("toast_texts_saved"));
});

document.getElementById("resetTextsBtn").addEventListener("click", () => {
  tempTexts = { ...DEFAULT_TEXTS };
  renderTextsList();
  showToast(t("toast_texts_reset"));
});

/* ============ مودال تعديل الحالات ============ */
const statusesModalOverlay = document.getElementById("statusesModalOverlay");
const statusesList = document.getElementById("statusesList");
const newStatusColor = document.getElementById("newStatusColor");
const newStatusLabel = document.getElementById("newStatusLabel");

document.getElementById("editStatusesBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  renderStatusesList();
  statusesModalOverlay.classList.remove("hidden");
});
document.getElementById("closeStatusesBtn").addEventListener("click", () => {
  statusesModalOverlay.classList.add("hidden");
});

function renderStatusesList() {
  statusesList.innerHTML = "";
  appSettings.statuses.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "status-row";
    row.innerHTML = `
      <input type="color" value="${s.color}" data-idx="${idx}" class="status-color-input" />
      <input type="text" value="${escapeHtml(s.label)}" data-idx="${idx}" class="text-field status-label-input" />
      <button class="status-delete-btn" data-idx="${idx}">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    row.querySelector(".status-color-input").addEventListener("input", async (e) => {
      appSettings.statuses[idx].color = e.target.value;
      await dbSettingsPut("statuses", appSettings.statuses);
      render();
    });
    row.querySelector(".status-label-input").addEventListener("change", async (e) => {
      appSettings.statuses[idx].label = e.target.value.trim() || s.label;
      await dbSettingsPut("statuses", appSettings.statuses);
      render();
    });
    row.querySelector(".status-delete-btn").addEventListener("click", async () => {
      appSettings.statuses.splice(idx, 1);
      await dbSettingsPut("statuses", appSettings.statuses);
      renderStatusesList();
      renderFilterSegments();
      render();
      showToast(t("toast_status_deleted"));
    });
    statusesList.appendChild(row);
  });
}

document.getElementById("addStatusBtn").addEventListener("click", async () => {
  const label = newStatusLabel.value.trim();
  if (!label) {
    showToast(t("toast_status_name_missing"));
    return;
  }
  const newStatus = {
    key: "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    label,
    color: newStatusColor.value,
  };
  appSettings.statuses.push(newStatus);
  await dbSettingsPut("statuses", appSettings.statuses);
  newStatusLabel.value = "";
  renderStatusesList();
  renderFilterSegments();
  showToast(t("toast_status_added"));
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
  hideProgress("export");
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
      showToast(t("toast_password_short"));
      return;
    }
    if (exportPassword.value !== exportPasswordConfirm.value) {
      showToast(t("toast_password_mismatch"));
      return;
    }
  }

  setProgress("export", 10, "جاري تجهيز البيانات...");

  const exportData = {
    appName: "anime-tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    items: animeList,
    settings: appSettings,
  };
  const jsonString = JSON.stringify(exportData);

  setProgress("export", 40, "جاري التجهيز...");

  let fileContent;
  if (useEncryption) {
    setProgress("export", 60, "جاري التشفير...");
    fileContent = await encryptJSON(jsonString, exportPassword.value);
  } else {
    fileContent = { encrypted: false, data: jsonString };
  }

  setProgress("export", 85, "جاري حفظ الملف...");

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

  setProgress("export", 100, "تم ✅");
  setTimeout(() => {
    hideProgress("export");
    exportModalOverlay.classList.add("hidden");
  }, 500);
  showToast(t("toast_export_done"));
});

/* ============ مودال الاستيراد ============ */
const importModalOverlay = document.getElementById("importModalOverlay");
const importFileInput = document.getElementById("importFileInput");
const importPasswordWrap = document.getElementById("importPasswordWrap");
const importPassword = document.getElementById("importPassword");
const importError = document.getElementById("importError");
let pendingImportPayload = null;

document.getElementById("importBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  importFileInput.value = "";
  importPassword.value = "";
  importPasswordWrap.classList.add("hidden");
  importError.classList.add("hidden");
  hideProgress("import");
  pendingImportPayload = null;
  importModalOverlay.classList.remove("hidden");
});

document.getElementById("cancelImportBtn").addEventListener("click", () => {
  importModalOverlay.classList.add("hidden");
});

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  if (!file) return;

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > 25) {
    importError.textContent = `الملف حجمه ${sizeMB.toFixed(1)} ميجا، وده كبير على إمكانيات الجهاز وممكن يسبب تهنيج. يفضّل تستخدم ملف أصغر من 25 ميجا.`;
    importError.classList.remove("hidden");
  } else {
    importError.classList.add("hidden");
  }

  const text = await file.text();
  try {
    pendingImportPayload = JSON.parse(text);
    importPasswordWrap.classList.toggle("hidden", !pendingImportPayload.encrypted);
  } catch (e) {
    importError.textContent = t("import_error_invalid_file");
    importError.classList.remove("hidden");
    pendingImportPayload = null;
  }
});

// استبدال atomic-ish: بياخد نسخة احتياطية في الذاكرة، ولو فشل أي جزء، بيرجّع القديم
async function replaceAllDataBatched(newItems, onProgress) {
  await dbClearAll();
  await dbBulkPutBatched(newItems, 25, onProgress);
}

document.getElementById("confirmImportBtn").addEventListener("click", async () => {
  if (!pendingImportPayload) {
    showToast(t("toast_choose_file_first"));
    return;
  }

  const previousItemsSnapshot = animeList.slice();
  const previousSettingsSnapshot = { ...appSettings };

  try {
    let jsonString;
    if (pendingImportPayload.encrypted) {
      if (!importPassword.value) {
        importError.textContent = t("import_error_password_needed");
        importError.classList.remove("hidden");
        return;
      }
      setProgress("import", 10, "جاري فك التشفير...");
      jsonString = await decryptJSON(pendingImportPayload, importPassword.value);
    } else {
      jsonString = pendingImportPayload.data;
    }

    const parsed = JSON.parse(jsonString);
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("invalid structure");
    }

    try {
      await replaceAllDataBatched(parsed.items, (done, total) => {
        const pct = 15 + (done / total) * 80;
        setProgress("import", pct, `جاري الاستيراد... ${done}/${total}`);
      });

      // استيراد الإعدادات لو موجودة في الملف
      if (parsed.settings) {
        const entries = Object.entries(parsed.settings).map(([key, value]) => ({ key, value }));
        await dbSettingsBulkPut(entries);
      }

      await loadAppSettingsFromDB();
      await reloadFromDB();
      renderFilterSegments();

      setProgress("import", 100, "تم ✅");
      setTimeout(() => {
        hideProgress("import");
        importModalOverlay.classList.add("hidden");
      }, 500);
      showToast(`${t("toast_saved")} (${parsed.items.length})`);
    } catch (dbErr) {
      // فشلت الكتابة، نرجّع القديم
      hideProgress("import");
      animeList = previousItemsSnapshot;
      appSettings = previousSettingsSnapshot;
      render();
      applyColorsToUI();
      applyAppIdentity();
      applyTexts();
      throw new Error("db-write-failed");
    }
  } catch (e) {
    hideProgress("import");
    importError.textContent = t("import_error_generic");
    importError.classList.remove("hidden");
  }
});

/* ============ بدء التشغيل ============ */
(async function init() {
  await openDB();
  await loadAppSettingsFromDB();
  await reloadFromDB();
  renderFilterSegments();
})();
