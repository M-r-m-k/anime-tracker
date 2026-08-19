/* ============ إعداد قاعدة البيانات المحلية (IndexedDB) ============ */
const DB_NAME = "anime_tracker_db";
const DB_VERSION = 4;
const STORE = "anime_items";
const SETTINGS_STORE = "app_settings";
const LISTS_STORE = "lists";
const DEFAULT_LIST_ID = "anime_default";
const VAULT_NOTES_STORE = "vault_notes";
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
      if (!_db.objectStoreNames.contains(LISTS_STORE)) {
        _db.createObjectStore(LISTS_STORE, { keyPath: "id" });
      }
      if (!_db.objectStoreNames.contains(VAULT_NOTES_STORE)) {
        _db.createObjectStore(VAULT_NOTES_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

/* ---- الأسرار (Vault) ---- */
function dbVaultNotesGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_NOTES_STORE, "readonly");
    const req = tx.objectStore(VAULT_NOTES_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}
function dbVaultNotePut(note) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_NOTES_STORE, "readwrite");
    tx.objectStore(VAULT_NOTES_STORE).put(note);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}
function dbVaultNoteDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_NOTES_STORE, "readwrite");
    tx.objectStore(VAULT_NOTES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}
function dbVaultNotesClearAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_NOTES_STORE, "readwrite");
    tx.objectStore(VAULT_NOTES_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

/* ---- القوائم (Lists) ---- */
function dbListsGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, "readonly");
    const req = tx.objectStore(LISTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}
function dbListPut(list) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, "readwrite");
    tx.objectStore(LISTS_STORE).put(list);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}
function dbListDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, "readwrite");
    tx.objectStore(LISTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}
// حذف كل عناصر قائمة معيّنة (لما نحذف القائمة نفسها)، على دفعات صغيرة
function dbDeleteItemsByListId(listId, allItems) {
  const toDelete = allItems.filter((it) => (it.listId || DEFAULT_LIST_ID) === listId);
  return new Promise((resolve, reject) => {
    let i = 0;
    function nextBatch() {
      if (i >= toDelete.length) { resolve(); return; }
      const batch = toDelete.slice(i, i + 25);
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      batch.forEach((it) => store.delete(it.id));
      tx.oncomplete = () => { i += 25; setTimeout(nextBatch, 20); };
      tx.onerror = (e) => reject(e);
    }
    nextBatch();
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

const EXTRA_DEFAULT_TEXTS = {
  menu_lists: "القوائم",
  menu_vault: "🔐 الأسرار",
  menu_settings: "الإعدادات",
  field_label_encrypt_method: "اختار طريقة التشفير",
  method_pbkdf2_name: "تشفير AES-256 (قوي وسريع)",
  method_pbkdf2_desc: "بيشتق مفتاح تشفير حقيقي من كلمة السر، وبيشفّر الملف بالكامل بمعيار AES المستخدم عالميًا. أقوى خيار، وسريع كفاية عشان يشتغل من غير أي تهنيج.",
  method_xor_name: "تشفير XOR (متوسط وسريع جدًا)",
  method_xor_desc: "بيحوّل كلمة السر لمفتاح ثابت وبيدمجه مع بيانات الملف بايت بايت. أسرع كتير من التشفير القوي، وكافي لمنع أي حد يفتح الملف بسهولة بمحرر نصوص عادي.",
  method_caesar_name: "تشفير الإزاحة (الأبسط)",
  method_caesar_desc: "بيزيح كل حرف في الملف بمقدار مبني على كلمة السر. أبسط طريقة ممكنة وأسرعها على الإطلاق، مناسبة بس لو عايز تمويه خفيف مش حماية قوية فعليًا.",
  filter_pinned_only: "المثبت فقط",
  filter_hide_finished: "إخفاء المنتهي",
  filter_continue_watching: "أكمل المشاهدة",
  sort_manual: "الترتيب اليدوي",
  sort_name: "الاسم",
  sort_status: "الحالة",
  sort_progress: "نسبة التقدم",
  field_label_total_episodes: "عدد الحلقات",
  field_label_current_episode: "الحلقة الحالية",
  field_label_season: "الموسم",
  field_label_year: "السنة",
  field_label_rating: "تقييمك الشخصي",
  field_label_pinned: "تثبيت في أعلى القائمة",
  btn_watched_episode: "شاهدت الحلقة ✓ +1",
  btn_toggle_pin: "تثبيت / إلغاء التثبيت",
  btn_undo: "تراجع",
  backup_banner_text: "معملتش نسخة احتياطية من فترة",
  backup_banner_export: "تصدير الآن",
  backup_banner_dismiss: "تجاهل",
  settings_modal_title: "الإعدادات",
  settings_backup_reminder_enabled: "تفعيل تذكير النسخة الاحتياطية",
  settings_backup_reminder_days: "تذكرني كل كام يوم",
  settings_hide_finished_default: "إخفاء المنتهي افتراضيًا",
  settings_recent_changes_title: "سجل آخر التغييرات",
  toast_deleted_undo: "تم الحذف",
  toast_pinned: "تم التثبيت 📌",
  toast_unpinned: "تم إلغاء التثبيت",
  toast_episode_updated: "تم تحديث الحلقة ✅",
  toast_reorder_saved: "تم حفظ الترتيب الجديد",
  recent_change_added: "أضاف",
  recent_change_edited: "عدّل",
  recent_change_episode: "حدّث حلقة",
  no_recent_changes: "لسه مفيش أي تغييرات مسجّلة",
};
Object.assign(DEFAULT_TEXTS, EXTRA_DEFAULT_TEXTS);

const DEFAULT_SETTINGS_EXTRA = {
  backupReminder: { enabled: true, intervalDays: 7, lastExportAt: null },
  hideFinishedDefault: false,
  recentChanges: [],
};
const MAX_RECENT_CHANGES = 15;

// الإعدادات الحالية في الذاكرة
let appSettings = {
  appName: DEFAULT_APP_NAME,
  logo: null,
  gallery: [],
  colors: { ...DEFAULT_COLORS },
  texts: { ...DEFAULT_TEXTS },
  statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
  backupReminder: { ...DEFAULT_SETTINGS_EXTRA.backupReminder },
  hideFinishedDefault: false,
  recentChanges: [],
};

// فلاتر وترتيب الشاشة الرئيسية (مش بيانات محفوظة، بترجع الافتراضي كل فتح)
let currentSort = "manual";
let pinnedOnlyFilter = false;
let hideFinishedFilter = false;
let continueWatchingFilter = false;

// القائمة الحالية (زي "أنمي" أو "أفلام")
let currentListId = DEFAULT_LIST_ID;
let currentListName = "أنمي";

// حفظ إعدادات (ألوان/نصوص/حالات) القائمة الحالية بس، من غير ما تأثر على أي قائمة تانية
async function saveCurrentListSettings() {
  await dbListPut({
    id: currentListId,
    name: currentListName,
    colors: appSettings.colors,
    texts: appSettings.texts,
    statuses: appSettings.statuses,
  });
}

// تسجيل حركة في سجل آخر التغييرات (محدود بعدد صغير عشان مايكبرش لانهائي)
async function logRecentChange(type, animeName) {
  appSettings.recentChanges = appSettings.recentChanges || [];
  appSettings.recentChanges.unshift({ type, animeName, timestamp: Date.now() });
  if (appSettings.recentChanges.length > MAX_RECENT_CHANGES) {
    appSettings.recentChanges = appSettings.recentChanges.slice(0, MAX_RECENT_CHANGES);
  }
  await dbSettingsPut("recentChanges", appSettings.recentChanges);
}

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

/* ============ تحميل الإعدادات من القاعدة مع دمج القيم الافتراضية ============
   الإعدادات دي مقسومة نوعين:
   1. إعدادات عامة للتطبيق كله (اسم التطبيق، صورته) — بتفضل زي ما هي مهما بدّلت قائمة
   2. إعدادات خاصة بكل قائمة لوحدها (الألوان، النصوص، الحالات) — بتتغيّر مع كل قائمة */
async function loadAppSettingsFromDB() {
  const rows = await dbSettingsGetAll();
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });

  appSettings = {
    appName: map.appName ?? DEFAULT_APP_NAME,
    logo: map.logo ?? null,
    gallery: map.gallery ?? [],
    colors: { ...DEFAULT_COLORS },
    texts: { ...DEFAULT_TEXTS },
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    backupReminder: { ...DEFAULT_SETTINGS_EXTRA.backupReminder, ...(map.backupReminder || {}) },
    hideFinishedDefault: map.hideFinishedDefault ?? false,
    recentChanges: map.recentChanges ?? [],
  };

  hideFinishedFilter = appSettings.hideFinishedDefault;
  currentListId = map.currentListId ?? DEFAULT_LIST_ID;

  applyAppIdentity();
}

// يتأكد إن القائمة الافتراضية موجودة (أول تشغيل للتطبيق)، وبيحمّل إعدادات
// (ألوان/نصوص/حالات) القائمة الحالية المختارة
async function loadCurrentListSettings() {
  const lists = await dbListsGetAll();

  if (lists.length === 0) {
    // أول تشغيل خالص: نجهّز القائمة الافتراضية (أنمي) بالإعدادات الافتراضية العادية
    await dbListPut({
      id: DEFAULT_LIST_ID,
      name: "أنمي",
      colors: DEFAULT_COLORS,
      texts: DEFAULT_TEXTS,
      statuses: DEFAULT_STATUSES,
    });
    currentListId = DEFAULT_LIST_ID;
  }

  const allLists = lists.length === 0 ? await dbListsGetAll() : lists;
  let activeList = allLists.find((l) => l.id === currentListId) || allLists[0];
  currentListId = activeList.id;
  currentListName = activeList.name;

  appSettings.colors = { ...DEFAULT_COLORS, ...(activeList.colors || {}) };
  appSettings.texts = { ...DEFAULT_TEXTS, ...(activeList.texts || {}) };
  appSettings.statuses = (activeList.statuses && activeList.statuses.length ? activeList.statuses : DEFAULT_STATUSES).map((s) => ({ ...s }));

  applyColorsToUI();
  applyTexts();
  updateListBadge();
}

function updateListBadge() {
  const badge = document.getElementById("currentListBadge");
  if (badge) badge.textContent = `📚 ${currentListName}`;
}

/* ============ عرض القائمة ============ */
function getStatusMeta(key) {
  if (!key) return { label: t("status_none"), color: "var(--text-faint)" };
  const found = appSettings.statuses.find((s) => s.key === key);
  return found ? { label: found.label, color: found.color } : { label: t("status_none"), color: "var(--text-faint)" };
}

// حساب نسبة التقدم لأنمي (بيتعامل بأمان مع عناصر قديمة ملهاش الحقول دي أصلًا)
function getProgress(anime) {
  const total = Number(anime.totalEpisodes) || 0;
  const current = Number(anime.currentEpisode) || 0;
  if (total <= 0) return null;
  const clampedCurrent = Math.min(current, total);
  const percent = Math.round((clampedCurrent / total) * 100);
  return { current: clampedCurrent, total, percent };
}

function buildBlockInner(anime) {
  const meta = getStatusMeta(anime.status);
  const hasNotes = !!(anime.notes && anime.notes.trim());
  const progress = getProgress(anime);
  const isPinned = !!anime.pinned;

  return `
    <div class="card" data-id="${anime.id}">
      <div class="card-image-wrap">
        ${
          anime.image
            ? `<img src="${anime.image}" alt="${escapeHtml(anime.name)}" loading="lazy" decoding="async" />`
            : `<div class="no-image"><svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" opacity="0.4" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`
        }
        ${isPinned ? `<span class="pin-badge">📌</span>` : ""}
        ${editMode ? `<button class="drag-handle" data-id="${anime.id}" title="اسحب للترتيب">⠿</button>` : ""}
        ${editMode ? `<button class="card-edit-btn" data-id="${anime.id}"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : ""}
      </div>
      <div class="card-info">
        <div class="card-title" data-id="${anime.id}">${escapeHtml(anime.name)}</div>
        <div class="status-chip" style="color:${meta.color};border-color:${hexToRgba(meta.color, 0.4)};background:${hexToRgba(meta.color, 0.1)};">${escapeHtml(meta.label)}</div>
        ${
          progress
            ? `<div class="mini-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div><span class="mini-progress-text">${progress.current}/${progress.total} · ${progress.percent}%</span></div>`
            : ""
        }
      </div>
      <button class="note-btn${hasNotes ? " has-notes" : ""}" data-id="${anime.id}" title="ملاحظات">📄</button>
    </div>
    <div class="notes-panel hidden" data-id="${anime.id}">
      ${
        editMode
          ? `<textarea class="notes-edit" data-id="${anime.id}" placeholder="اكتب ملاحظاتك عن الأنمي هنا...">${escapeHtml(anime.notes || "")}</textarea>`
          : `<p class="notes-text">${hasNotes ? escapeHtml(anime.notes) : "مفيش ملاحظات مكتوبة"}</p>`
      }
    </div>
  `;
}

function buildAnimeBlock(anime) {
  return `<div class="anime-block" data-block-id="${anime.id}">${buildBlockInner(anime)}</div>`;
}

function getFilteredSortedList() {
  const query = searchInput.value.trim().toLowerCase();

  let list = animeList
    .filter((a) => (query ? a.name.toLowerCase().includes(query) : true))
    .filter((a) => (selectedFilterStatus ? a.status === selectedFilterStatus : true))
    .filter((a) => (pinnedOnlyFilter ? !!a.pinned : true))
    .filter((a) => {
      if (!hideFinishedFilter) return true;
      const p = getProgress(a);
      return !(p && p.current >= p.total);
    })
    .filter((a) => {
      if (!continueWatchingFilter) return true;
      const p = getProgress(a);
      return !!(p && p.current > 0 && p.current < p.total);
    });

  if (currentSort === "name") {
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
  } else if (currentSort === "status") {
    list = list.slice().sort((a, b) => (a.status || "").localeCompare(b.status || ""));
  } else if (currentSort === "progress") {
    list = list.slice().sort((a, b) => {
      const pa = getProgress(a)?.percent ?? -1;
      const pb = getProgress(b)?.percent ?? -1;
      return pb - pa;
    });
  } else {
    list = list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // التثبيت دايمًا فوق، من غير ما يلغي الترتيب التاني جوه كل مجموعة
  const pinned = list.filter((a) => a.pinned);
  const rest = list.filter((a) => !a.pinned);
  return [...pinned, ...rest];
}

function render() {
  const filtered = getFilteredSortedList();
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  grid.innerHTML = filtered.map(buildAnimeBlock).join("");
}

// مستمع أحداث واحد بس على الشاشة كلها (Event Delegation) بدل ما كل كارت
// ياخد مستمع لوحده، ده أخف بكتير مع عدد كبير من العناصر ومش محتاج
// نعيد ربطه بعد كل إعادة بناء جزئية أو كاملة
grid.addEventListener("click", (e) => {
  if (dragState.active) return; // متجاهلش أي دوسة أثناء عملية سحب شغالة

  const editBtn = e.target.closest(".card-edit-btn");
  if (editBtn) {
    e.stopPropagation();
    openAnimeModal(editBtn.dataset.id);
    return;
  }

  const noteBtn = e.target.closest(".note-btn");
  if (noteBtn) {
    e.stopPropagation();
    const panel = grid.querySelector(`.notes-panel[data-id="${noteBtn.dataset.id}"]`);
    if (panel) panel.classList.toggle("hidden");
    return;
  }

  const titleEl = e.target.closest(".card-title");
  if (titleEl) {
    e.stopPropagation();
    openDetailModal(titleEl.dataset.id);
    return;
  }

  const card = e.target.closest(".card");
  if (card && !editMode) {
    const anime = animeList.find((a) => a.id === card.dataset.id);
    if (anime) quickStatusCycle(anime);
  }
});

// حفظ الملاحظات تلقائيًا لما تتغيّر (بس وقت وضع التعديل، لأن الـ textarea
// مش موجودة أصلًا إلا في وضع التعديل)
let notesSaveTimer;
grid.addEventListener("input", (e) => {
  const ta = e.target.closest(".notes-edit");
  if (!ta) return;
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => {
    const anime = animeList.find((a) => a.id === ta.dataset.id);
    if (anime) {
      anime.notes = ta.value;
      dbPut(anime).catch(() => {});
    }
  }, 400);
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============ السحب والترتيب اليدوي (Pointer Events - خفيف ومناسب للمس) ============
   شغّال بس في وضع التعديل، وبيحرك العناصر في الـ DOM مباشرة أثناء السحب
   من غير أي كتابة في القاعدة إلا لما تسيب إصبعك (عشان مايبقاش فيه أي تهنيج أثناء الحركة) */
const dragState = { active: false, blockEl: null, startY: 0, startIndex: 0 };

grid.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".drag-handle");
  if (!handle || !editMode) return;
  const block = handle.closest(".anime-block");
  if (!block) return;

  dragState.active = true;
  dragState.blockEl = block;
  dragState.startY = e.clientY;
  block.classList.add("dragging");
  handle.setPointerCapture(e.pointerId);
});

grid.addEventListener("pointermove", (e) => {
  if (!dragState.active || !dragState.blockEl) return;
  const dragged = dragState.blockEl;
  const siblings = Array.from(grid.querySelectorAll(".anime-block")).filter((el) => el !== dragged);

  // نلاقي أول عنصر تحت الإصبع اللي منتصفه أسفل نقطة اللمس، ونحط الكارت المسحوب قبله
  let targetEl = null;
  for (const sib of siblings) {
    const rect = sib.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      targetEl = sib;
      break;
    }
  }

  if (targetEl) {
    if (targetEl !== dragged.nextElementSibling) grid.insertBefore(dragged, targetEl);
  } else {
    // مفيش عنصر تحت الإصبع (يعني وصلنا لآخر القائمة)، نحط الكارت في الآخر
    if (grid.lastElementChild !== dragged) grid.appendChild(dragged);
  }
});

grid.addEventListener("pointerup", async () => {
  if (!dragState.active) return;
  dragState.active = false;
  if (dragState.blockEl) dragState.blockEl.classList.remove("dragging");
  dragState.blockEl = null;

  // نحفظ الترتيب الجديد بس للعناصر الظاهرة دلوقتي على الشاشة
  const blocks = Array.from(grid.querySelectorAll(".anime-block"));
  const updates = [];
  blocks.forEach((block, index) => {
    const anime = animeList.find((a) => a.id === block.dataset.blockId);
    if (anime && anime.order !== index) {
      anime.order = index;
      updates.push(anime);
    }
  });

  if (updates.length > 0) {
    await dbBulkPutBatched(updates, 25);
    showToast(t("toast_reorder_saved"));
  }
});

// تحديث سريع لكارت واحد بس، من غير إعادة بناء الشاشة كلها
function tryUpdateCardInPlace(anime) {
  if (selectedFilterStatus && anime.status !== selectedFilterStatus) return false;

  const card = grid.querySelector(`.card[data-id="${anime.id}"]`);
  if (!card) return false;

  const chip = card.querySelector(".status-chip");
  if (!chip) return false;

  const meta = getStatusMeta(anime.status);
  chip.textContent = meta.label;
  chip.style.color = meta.color;
  chip.style.borderColor = hexToRgba(meta.color, 0.4);
  chip.style.background = hexToRgba(meta.color, 0.1);
  return true;
}

// تحديث كارت موجود بالكامل (بعد تعديل اسم/صورة) من غير إعادة بناء الشاشة كلها
function tryReplaceBlockInPlace(anime) {
  const query = searchInput.value.trim().toLowerCase();
  if (query && !anime.name.toLowerCase().includes(query)) return false;
  if (selectedFilterStatus && anime.status !== selectedFilterStatus) return false;

  const block = grid.querySelector(`.anime-block[data-block-id="${anime.id}"]`);
  if (!block) return false;

  const wasNotesOpen = !block.querySelector(".notes-panel")?.classList.contains("hidden");
  block.innerHTML = buildBlockInner(anime);
  if (wasNotesOpen) block.querySelector(".notes-panel").classList.remove("hidden");
  return true;
}

// إزالة كارت واحد من الشاشة من غير إعادة بناء كامل
function removeBlockInPlace(id) {
  const block = grid.querySelector(`.anime-block[data-block-id="${id}"]`);
  if (block) block.remove();
  emptyState.classList.toggle("hidden", grid.children.length !== 0);
}

async function quickStatusCycle(anime) {
  const order = ["", ...appSettings.statuses.map((s) => s.key)];
  const idx = order.indexOf(anime.status || "");
  const next = order[(idx + 1) % order.length];
  anime.status = next;

  const updatedInPlace = tryUpdateCardInPlace(anime);
  if (!updatedInPlace) render();

  dbPut(anime).catch(() => {});
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
const totalEpisodesInput = document.getElementById("totalEpisodesInput");
const currentEpisodeDisplay = document.getElementById("currentEpisodeDisplay");
const seasonInput = document.getElementById("seasonInput");
const yearInput = document.getElementById("yearInput");
const pinnedInput = document.getElementById("pinnedInput");
const ratingStarsEl = document.getElementById("ratingStars");
let modalCurrentEpisode = 0;
let modalRating = 0;

function renderStars(container, value, editable, onSelect) {
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (i <= value ? " filled" : "");
    star.textContent = i <= value ? "⭐" : "☆";
    if (editable) {
      star.addEventListener("click", () => onSelect(i === value ? 0 : i));
    }
    container.appendChild(star);
  }
}

function openAnimeModal(id = null) {
  currentEditId = id;
  pickedImageDataUrl = null;
  hideProgress("image");

  if (id) {
    const anime = animeList.find((a) => a.id === id);
    animeModalTitle.textContent = t("modal_edit_title");
    nameInput.value = anime.name;
    selectedAnimeStatus = anime.status || "";
    totalEpisodesInput.value = anime.totalEpisodes || "";
    modalCurrentEpisode = Number(anime.currentEpisode) || 0;
    seasonInput.value = anime.season || "";
    yearInput.value = anime.year || "";
    pinnedInput.checked = !!anime.pinned;
    modalRating = Number(anime.rating) || 0;
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
    totalEpisodesInput.value = "";
    modalCurrentEpisode = 0;
    seasonInput.value = "";
    yearInput.value = "";
    pinnedInput.checked = false;
    modalRating = 0;
    imagePreview.classList.add("hidden");
    imagePlaceholder.classList.remove("hidden");
    deleteAnimeBtn.classList.add("hidden");
  }

  currentEpisodeDisplay.textContent = modalCurrentEpisode;
  function refreshModalStars() {
    renderStars(ratingStarsEl, modalRating, true, (v) => {
      modalRating = v;
      refreshModalStars();
    });
  }
  refreshModalStars();
  renderAnimeStatusSegments();
  animeModalOverlay.classList.remove("hidden");
}

function closeAnimeModal() {
  animeModalOverlay.classList.add("hidden");
  currentEditId = null;
  pickedImageDataUrl = null;
}

document.getElementById("episodeMinusBtn").addEventListener("click", () => {
  modalCurrentEpisode = Math.max(0, modalCurrentEpisode - 1);
  currentEpisodeDisplay.textContent = modalCurrentEpisode;
});
document.getElementById("episodePlusBtn").addEventListener("click", () => {
  modalCurrentEpisode += 1;
  currentEpisodeDisplay.textContent = modalCurrentEpisode;
});

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

// لو وصلت للحلقة الأخيرة، نحاول نحوّل الحالة تلقائيًا لأول حالة أساسها
// "منتهي" (finished_watched)، لو المستخدم حذفها أو غيّرها بنتجاهل الخطوة بأمان
function maybeAutoFinish(anime) {
  const total = Number(anime.totalEpisodes) || 0;
  if (total > 0 && Number(anime.currentEpisode) >= total) {
    const finishedStatus = appSettings.statuses.find((s) => s.key === "finished_watched");
    if (finishedStatus) anime.status = finishedStatus.key;
  }
}

document.getElementById("saveAnimeBtn").addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    showToast(t("toast_name_missing"));
    return;
  }

  let isNewItem = false;
  let savedAnime;
  const changeType = currentEditId ? "edited" : "added";

  const commonFields = {
    name,
    status: selectedAnimeStatus,
    totalEpisodes: totalEpisodesInput.value ? Number(totalEpisodesInput.value) : 0,
    currentEpisode: modalCurrentEpisode,
    season: seasonInput.value ? Number(seasonInput.value) : null,
    year: yearInput.value ? Number(yearInput.value) : null,
    pinned: pinnedInput.checked,
    rating: modalRating,
  };

  if (currentEditId) {
    savedAnime = animeList.find((a) => a.id === currentEditId);
    Object.assign(savedAnime, commonFields);
    if (pickedImageDataUrl) savedAnime.image = pickedImageDataUrl;
    maybeAutoFinish(savedAnime);
    await dbPut(savedAnime);
  } else {
    isNewItem = true;
    savedAnime = {
      id: "a_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      listId: currentListId,
      ...commonFields,
      image: pickedImageDataUrl || null,
      notes: "",
      lastWatchedAt: null,
      order: animeList.length,
      createdAt: Date.now(),
    };
    maybeAutoFinish(savedAnime);
    animeList.push(savedAnime);
    await dbPut(savedAnime);
  }

  if (isNewItem || !tryReplaceBlockInPlace(savedAnime)) {
    render();
  }

  await logRecentChange(changeType, name);
  closeAnimeModal();
  showToast(t("toast_saved"));
});

document.getElementById("cancelAnimeBtn").addEventListener("click", closeAnimeModal);

// حذف مع فرصة تراجع: العنصر بيتشال من الشاشة فورًا، لكن الحذف الفعلي من
// القاعدة بيستنى شوية ثواني عشان تقدر تتراجع لو دوست غلط
let pendingDelete = null;
let pendingDeleteTimer = null;

deleteAnimeBtn.addEventListener("click", () => {
  if (!currentEditId) return;
  const idToDelete = currentEditId;
  const animeSnapshot = animeList.find((a) => a.id === idToDelete);
  if (!animeSnapshot) return;

  animeList = animeList.filter((a) => a.id !== idToDelete);
  removeBlockInPlace(idToDelete);
  closeAnimeModal();

  pendingDelete = animeSnapshot;
  clearTimeout(pendingDeleteTimer);
  pendingDeleteTimer = setTimeout(async () => {
    if (pendingDelete && pendingDelete.id === idToDelete) {
      await dbDelete(idToDelete);
      await logRecentChange("edited", `${t("btn_delete")}: ${animeSnapshot.name}`);
      pendingDelete = null;
    }
  }, 5000);

  showToastWithAction(t("toast_deleted_undo"), t("btn_undo"), () => {
    clearTimeout(pendingDeleteTimer);
    if (pendingDelete) {
      animeList.push(pendingDelete);
      dbPut(pendingDelete).catch(() => {});
      pendingDelete = null;
      render();
    }
  });
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
  const msgEl = document.getElementById("toastMessage");
  const actionBtn = document.getElementById("toastActionBtn");
  msgEl.textContent = msg;
  actionBtn.classList.add("hidden");
  actionBtn.onclick = null;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

// توست فيه زرار فعل إضافي (زي "تراجع")، بيفضل ظاهر شوية أطول
function showToastWithAction(msg, actionLabel, onAction) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMessage");
  const actionBtn = document.getElementById("toastActionBtn");
  msgEl.textContent = msg;
  actionBtn.textContent = actionLabel;
  actionBtn.classList.remove("hidden");
  actionBtn.onclick = () => {
    onAction();
    toast.classList.add("hidden");
    clearTimeout(toastTimer);
  };
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 5000);
}

/* ============ إعادة التحميل من القاعدة ============
   بنجيب كل العناصر، وبنفلتر في الذاكرة بس عناصر القائمة الحالية —
   ده بيخلي animeList دايمًا معبّر عن القائمة المفتوحة بس، ومعظم الكود
   القديم (البحث/الفرز/العرض) بيفضل شغال زي ما هو من غير أي تعديل */
async function reloadFromDB() {
  const all = await dbGetAll();
  animeList = all.filter((a) => (a.listId || DEFAULT_LIST_ID) === currentListId);
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
  await saveCurrentListSettings();
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
  await saveCurrentListSettings();
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
      await saveCurrentListSettings();
      render();
    });
    row.querySelector(".status-label-input").addEventListener("change", async (e) => {
      appSettings.statuses[idx].label = e.target.value.trim() || s.label;
      await saveCurrentListSettings();
      render();
    });
    row.querySelector(".status-delete-btn").addEventListener("click", async () => {
      appSettings.statuses.splice(idx, 1);
      await saveCurrentListSettings();
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
  await saveCurrentListSettings();
  newStatusLabel.value = "";
  renderStatusesList();
  renderFilterSegments();
  showToast(t("toast_status_added"));
});

/* ================================================================
   نظام التشفير (AES-GCM + PBKDF2) للتصدير/الاستيراد
   ================================================================ */
// عدد دورات مخفّض بشكل كبير (كان 210,000) — التقليل الكبير ده هو اللي بيمنع
// أي تهنيج فعليًا وقت التشفير أو فك التشفير، مع الحفاظ على حماية معقولة
const PBKDF2_ITERATIONS = 8000;

async function deriveKey(password, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufToBase64(buf) {
  // معالجة البيانات على شكل كتل كبيرة (32KB في المرة) بدل بايت بايت،
  // ده أسرع بمراحل ويمنع تعليق الجهاز مع الملفات الكبيرة عند التشفير
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000; // 32768 بايت لكل كتلة (آمن ومايتعديش حد الاستدعاء)
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* ---- الطريقة 1: تشفير قوي (AES-256-GCM + PBKDF2 مخفّف) ---- */
async function pbkdf2Encrypt(jsonString, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(jsonString));
  return {
    encrypted: true,
    method: "pbkdf2",
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    data: bufToBase64(cipherBuf),
  };
}
async function pbkdf2Decrypt(payload, password) {
  const salt = new Uint8Array(base64ToBuf(payload.salt));
  const iv = new Uint8Array(base64ToBuf(payload.iv));
  const key = await deriveKey(password, salt);
  const cipherBuf = base64ToBuf(payload.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}

/* ---- الطريقة 2: تشفير XOR (متوسط، أسرع بكتير، بدون أي عمليات معقدة) ---- */
async function deriveXorKeyBytes(password) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return new Uint8Array(hash);
}
async function xorEncrypt(jsonString, password) {
  const keyBytes = await deriveXorKeyBytes(password);
  const dataBytes = new TextEncoder().encode(jsonString);
  const outBytes = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) outBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  return { encrypted: true, method: "xor", data: bufToBase64(outBytes.buffer) };
}
async function xorDecrypt(payload, password) {
  const keyBytes = await deriveXorKeyBytes(password);
  const cipherBytes = new Uint8Array(base64ToBuf(payload.data));
  const outBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) outBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
  return new TextDecoder().decode(outBytes);
}

/* ---- الطريقة 3: تشفير إزاحة بسيط (Caesar، أبسط وأسرع طريقة ممكنة) ---- */
function passwordToShift(password) {
  let sum = 0;
  for (let i = 0; i < password.length; i++) sum += password.charCodeAt(i);
  return (sum % 255) + 1;
}
async function caesarEncrypt(jsonString, password) {
  const shift = passwordToShift(password);
  const bytes = new TextEncoder().encode(jsonString);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] + shift) % 256;
  return { encrypted: true, method: "caesar", data: bufToBase64(out.buffer) };
}
async function caesarDecrypt(payload, password) {
  const shift = passwordToShift(password);
  const bytes = new Uint8Array(base64ToBuf(payload.data));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] - shift + 256) % 256;
  return new TextDecoder().decode(out);
}

/* ---- موزّع الطرق (Dispatch) ---- */
async function encryptJSON(jsonString, password, method) {
  if (method === "xor") return xorEncrypt(jsonString, password);
  if (method === "caesar") return caesarEncrypt(jsonString, password);
  return pbkdf2Encrypt(jsonString, password);
}
async function decryptJSON(payload, password) {
  const method = payload.method || "pbkdf2"; // ملفات قديمة قبل إضافة الطرق التلاتة
  if (method === "xor") return xorDecrypt(payload, password);
  if (method === "caesar") return caesarDecrypt(payload, password);
  return pbkdf2Decrypt(payload, password);
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

// اختيار طريقة التشفير (تلت أزرار حمراء) + أزرار المعلومات تحت كل واحد
let selectedEncryptMethod = "pbkdf2";
document.querySelectorAll(".encrypt-method-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedEncryptMethod = btn.dataset.method;
    document.querySelectorAll(".encrypt-method-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
});
document.querySelectorAll(".method-info-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panelId = "methodInfo" + btn.dataset.method.charAt(0).toUpperCase() + btn.dataset.method.slice(1);
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle("hidden");
  });
});

document.getElementById("cancelExportBtn").addEventListener("click", () => {
  exportModalOverlay.classList.add("hidden");
});

// حفظ حقيقي على تخزين الجهاز عن طريق إضافة Capacitor الرسمية (Filesystem)
// بدل الاعتماد على حيلة رابط تحميل المتصفح اللي مش شغالة جوه الـ WebView.
// بنحفظ في فولدر Download العام (المشترك) عشان يبقى ظاهر لمدير الملفات
// ولأي تطبيق تاني، مش في مكان خاص بالتطبيق نفسه ومخفي عن الباقي.
async function saveFileToDevice(filename, textContent) {
  try {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (!plugins || !plugins.Filesystem || !plugins.Share) return { ok: false };

    const { Filesystem, Directory, Encoding, Share } = plugins;
    const writeResult = await Filesystem.writeFile({
      path: filename,
      data: textContent,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({
      title: filename,
      url: writeResult.uri,
      dialogTitle: "احفظ النسخة الاحتياطية",
    });

    return { ok: true, location: "shared" };
  } catch (err) {
    return { ok: false, error: err };
  }
}

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
    fileContent = await encryptJSON(jsonString, exportPassword.value, selectedEncryptMethod);
  } else {
    fileContent = { encrypted: false, data: jsonString };
  }

  setProgress("export", 85, "جاري حفظ الملف...");

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `anime-backup-${dateStr}.animebackup`;
  const finalText = JSON.stringify(fileContent);

  const nativeResult = await saveFileToDevice(filename, finalText);

  if (!nativeResult.ok) {
    // احتياطي: طريقة المتصفح العادية (بتشتغل في متصفح كمبيوتر عادي وقت الاختبار)
    const blob = new Blob([finalText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  setProgress("export", 100, "تم ✅");
  setTimeout(() => {
    hideProgress("export");
    exportModalOverlay.classList.add("hidden");
  }, 500);

  // نسجّل وقت آخر تصدير ناجح عشان تذكير النسخة الاحتياطية يحسب صح
  appSettings.backupReminder.lastExportAt = Date.now();
  await dbSettingsPut("backupReminder", appSettings.backupReminder);
  backupBannerDismissedThisSession = false;
  checkBackupReminder();

  if (nativeResult.ok) {
    showToast(`اختار مكان الحفظ من القائمة اللي هتظهر ✅`);
  } else {
    showToast(t("toast_export_done"));
  }
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

// حذف عناصر القائمة الحالية بس (مش كل القوائم)، على دفعات صغيرة
function dbClearCurrentListItems(allItems) {
  const toDelete = allItems.filter((it) => (it.listId || DEFAULT_LIST_ID) === currentListId);
  return new Promise((resolve, reject) => {
    let i = 0;
    function nextBatch() {
      if (i >= toDelete.length) { resolve(); return; }
      const batch = toDelete.slice(i, i + 25);
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      batch.forEach((it) => store.delete(it.id));
      tx.oncomplete = () => { i += 25; setTimeout(nextBatch, 20); };
      tx.onerror = (e) => reject(e);
    }
    nextBatch();
  });
}

// استبدال atomic-ish: بيمسح عناصر القائمة الحالية بس، ويحط الجديدة بدل منها،
// من غير ما يلمس أي قائمة تانية خالص
async function replaceAllDataBatched(newItems, onProgress) {
  const allItemsNow = await dbGetAll();
  await dbClearCurrentListItems(allItemsNow);
  const itemsWithListId = newItems.map((it) => ({ ...it, listId: currentListId }));
  await dbBulkPutBatched(itemsWithListId, 25, onProgress);
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

      // نفصل إعدادات القائمة (ألوان/نصوص/حالات) عن الإعدادات العامة للتطبيق
      if (parsed.settings) {
        const { colors, texts, statuses, ...globalOnly } = parsed.settings;
        const entries = Object.entries(globalOnly).map(([key, value]) => ({ key, value }));
        await dbSettingsBulkPut(entries);

        if (colors) appSettings.colors = { ...DEFAULT_COLORS, ...colors };
        if (texts) appSettings.texts = { ...DEFAULT_TEXTS, ...texts };
        if (statuses && statuses.length) appSettings.statuses = statuses.map((s) => ({ ...s }));
        await saveCurrentListSettings();
      }

      await loadAppSettingsFromDB();
      await loadCurrentListSettings();
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
      applyTexts();
      throw new Error("db-write-failed");
    }
  } catch (e) {
    hideProgress("import");
    importError.textContent = t("import_error_generic");
    importError.classList.remove("hidden");
  }
});

/* ============ مودال تفاصيل الأنمي ============ */
const detailModalOverlay = document.getElementById("detailModalOverlay");
let currentDetailId = null;

function formatRelativeDate(ts) {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return "اليوم";
  if (diffDays === 1) return "من يوم";
  if (diffDays < 30) return `من ${diffDays} يوم`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `من ${diffMonths} شهر`;
  return `من ${Math.floor(diffMonths / 12)} سنة`;
}

function openDetailModal(id) {
  const anime = animeList.find((a) => a.id === id);
  if (!anime) return;
  currentDetailId = id;

  document.getElementById("detailTitle").textContent = anime.name;

  const imgWrap = document.getElementById("detailImageWrap");
  imgWrap.innerHTML = anime.image
    ? `<img src="${anime.image}" alt="${escapeHtml(anime.name)}" />`
    : `<div class="no-image"><svg viewBox="0 0 24 24" width="34" height="34"><path fill="currentColor" opacity="0.4" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`;

  const seasonYearEl = document.getElementById("detailSeasonYear");
  const parts = [];
  if (anime.season) parts.push(`الموسم ${anime.season}`);
  if (anime.year) parts.push(anime.year);
  seasonYearEl.textContent = parts.join(" · ");
  seasonYearEl.classList.toggle("hidden", parts.length === 0);

  const progress = getProgress(anime);
  document.getElementById("detailProgressText").textContent = progress ? `${progress.current} / ${progress.total}` : "بدون عدد حلقات محدد";
  document.getElementById("detailProgressPercent").textContent = progress ? `${progress.percent}%` : "";
  document.getElementById("detailProgressFill").style.width = progress ? `${progress.percent}%` : "0%";

  renderStars(document.getElementById("detailRatingStars"), Number(anime.rating) || 0, true, async (v) => {
    anime.rating = v;
    await dbPut(anime);
    refreshDetailStars();
  });
  function refreshDetailStars() {
    renderStars(document.getElementById("detailRatingStars"), Number(anime.rating) || 0, true, async (v) => {
      anime.rating = v;
      await dbPut(anime);
      refreshDetailStars();
    });
  }

  const pinBtn = document.getElementById("detailPinBtn");
  pinBtn.classList.toggle("btn-active", !!anime.pinned);

  const lastWatchedEl = document.getElementById("detailLastWatched");
  lastWatchedEl.textContent = anime.lastWatchedAt ? `آخر مشاهدة: ${formatRelativeDate(anime.lastWatchedAt)}` : "";

  detailModalOverlay.classList.remove("hidden");
}

document.getElementById("closeDetailBtn").addEventListener("click", () => {
  detailModalOverlay.classList.add("hidden");
  currentDetailId = null;
});

document.getElementById("watchedEpisodeBtn").addEventListener("click", async () => {
  const anime = animeList.find((a) => a.id === currentDetailId);
  if (!anime) return;
  const total = Number(anime.totalEpisodes) || 0;
  const current = Number(anime.currentEpisode) || 0;
  if (total > 0 && current >= total) {
    showToast("خلصت كل الحلقات بالفعل ✅");
    return;
  }
  anime.currentEpisode = current + 1;
  anime.lastWatchedAt = Date.now();
  maybeAutoFinish(anime);
  await dbPut(anime);
  await logRecentChange("episode", anime.name);
  openDetailModal(anime.id); // إعادة رسم شاشة التفاصيل بالأرقام الجديدة
  tryReplaceBlockInPlace(anime); // تحديث الكارت في الخلفية لو ظاهر في القائمة
  showToast(t("toast_episode_updated"));
});

document.getElementById("detailPinBtn").addEventListener("click", async () => {
  const anime = animeList.find((a) => a.id === currentDetailId);
  if (!anime) return;
  anime.pinned = !anime.pinned;
  await dbPut(anime);
  document.getElementById("detailPinBtn").classList.toggle("btn-active", anime.pinned);
  showToast(anime.pinned ? t("toast_pinned") : t("toast_unpinned"));
  render(); // التثبيت بيغيّر ترتيب العرض فعليًا فمحتاجين إعادة بناء كاملة هنا
});

/* ============ شريط تذكير النسخة الاحتياطية ============ */
const backupBanner = document.getElementById("backupBanner");
let backupBannerDismissedThisSession = false;

function checkBackupReminder() {
  if (backupBannerDismissedThisSession) return;
  const r = appSettings.backupReminder;
  if (!r || !r.enabled) {
    backupBanner.classList.add("hidden");
    return;
  }
  const intervalMs = (r.intervalDays || 7) * 86400000;
  const last = r.lastExportAt;
  const due = !last || (Date.now() - last) > intervalMs;
  backupBanner.classList.toggle("hidden", !due);
}

document.getElementById("backupBannerExportBtn").addEventListener("click", () => {
  document.getElementById("exportBtn").click();
});
document.getElementById("backupBannerDismissBtn").addEventListener("click", () => {
  backupBannerDismissedThisSession = true;
  backupBanner.classList.add("hidden");
});

/* ============ مودال الإعدادات ============ */
const settingsModalOverlay = document.getElementById("settingsModalOverlay");
const backupReminderToggle = document.getElementById("backupReminderToggle");
const backupReminderDaysInput = document.getElementById("backupReminderDaysInput");
const hideFinishedDefaultToggle = document.getElementById("hideFinishedDefaultToggle");

document.getElementById("openSettingsBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  backupReminderToggle.checked = appSettings.backupReminder.enabled;
  backupReminderDaysInput.value = appSettings.backupReminder.intervalDays;
  hideFinishedDefaultToggle.checked = appSettings.hideFinishedDefault;
  renderRecentChanges();
  settingsModalOverlay.classList.remove("hidden");
});

function renderRecentChanges() {
  const list = document.getElementById("recentChangesList");
  const changes = appSettings.recentChanges || [];
  if (changes.length === 0) {
    list.innerHTML = `<p class="hint-text">${t("no_recent_changes")}</p>`;
    return;
  }
  const typeLabels = {
    added: t("recent_change_added"),
    edited: t("recent_change_edited"),
    episode: t("recent_change_episode"),
  };
  list.innerHTML = changes
    .map((c) => `
      <div class="recent-change-row">
        <span>${typeLabels[c.type] || c.type} — ${escapeHtml(c.animeName)}</span>
        <span class="recent-change-time">${formatRelativeDate(c.timestamp)}</span>
      </div>
    `)
    .join("");
}

async function saveSettingsAndClose() {
  appSettings.backupReminder.enabled = backupReminderToggle.checked;
  appSettings.backupReminder.intervalDays = Math.max(1, Number(backupReminderDaysInput.value) || 7);
  appSettings.hideFinishedDefault = hideFinishedDefaultToggle.checked;
  await dbSettingsPut("backupReminder", appSettings.backupReminder);
  await dbSettingsPut("hideFinishedDefault", appSettings.hideFinishedDefault);
  checkBackupReminder();
  settingsModalOverlay.classList.add("hidden");
}
document.getElementById("closeSettingsBtn").addEventListener("click", saveSettingsAndClose);

/* ============ زرار الفرز ============ */
const sortMenu = document.getElementById("sortMenu");
document.getElementById("sortBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  sortMenu.classList.toggle("hidden");
});
document.querySelectorAll(".sort-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentSort = btn.dataset.sort;
    document.querySelectorAll(".sort-option").forEach((b) => b.classList.toggle("active", b === btn));
    sortMenu.classList.add("hidden");
    render();
  });
});
document.addEventListener("click", (e) => {
  if (!sortMenu.contains(e.target) && e.target.id !== "sortBtn") {
    sortMenu.classList.add("hidden");
  }
});

/* ============ أزرار الفلاتر السريعة (المثبت / إخفاء المنتهي / أكمل المشاهدة) ============ */
const pinnedFilterBtn = document.getElementById("pinnedFilterBtn");
const hideFinishedBtn = document.getElementById("hideFinishedBtn");
const continueWatchingBtn = document.getElementById("continueWatchingBtn");

pinnedFilterBtn.addEventListener("click", () => {
  pinnedOnlyFilter = !pinnedOnlyFilter;
  pinnedFilterBtn.classList.toggle("active", pinnedOnlyFilter);
  render();
});
hideFinishedBtn.addEventListener("click", () => {
  hideFinishedFilter = !hideFinishedFilter;
  hideFinishedBtn.classList.toggle("active", hideFinishedFilter);
  render();
});
continueWatchingBtn.addEventListener("click", () => {
  continueWatchingFilter = !continueWatchingFilter;
  continueWatchingBtn.classList.toggle("active", continueWatchingFilter);
  render();
});

/* ============ إدارة القوائم المتعددة ============ */

// استبدال كلمة "أنمي" بكلمة القائمة الجديدة في كل نص، مرة واحدة وقت الإنشاء
// (مش نظام قوالب حي، عشان يفضل بسيط وتقدر تعدل أي نص بعد كده براحتك)
function substituteListWord(text, newWord) {
  if (typeof text !== "string") return text;
  return text
    .replace(/الأنمي/g, `ال${newWord}`)
    .replace(/أنمي/g, newWord)
    .replace(/انمي/g, newWord);
}

function buildTextsForNewList(sourceTexts, newWord) {
  const result = {};
  Object.entries(sourceTexts).forEach(([key, value]) => {
    result[key] = substituteListWord(value, newWord);
  });
  return result;
}

async function switchToList(listId) {
  currentListId = listId;
  await dbSettingsPut("currentListId", listId);
  await loadCurrentListSettings();
  await reloadFromDB();
  renderFilterSegments();
  render();
}

async function createNewList(name) {
  const id = "list_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await dbListPut({
    id,
    name,
    colors: { ...appSettings.colors },
    statuses: appSettings.statuses.map((s) => ({ ...s })),
    texts: buildTextsForNewList(appSettings.texts, name),
  });
  return id;
}

const listsModalOverlay = document.getElementById("listsModalOverlay");
const listsListEl = document.getElementById("listsListEl");

document.getElementById("openListsBtn").addEventListener("click", async () => {
  dropdownMenu.classList.add("hidden");
  await renderListsModal();
  listsModalOverlay.classList.remove("hidden");
});
document.getElementById("closeListsBtn").addEventListener("click", () => {
  listsModalOverlay.classList.add("hidden");
});
document.getElementById("currentListBadge").addEventListener("click", async () => {
  await renderListsModal();
  listsModalOverlay.classList.remove("hidden");
});

async function renderListsModal() {
  const [lists, allItems] = await Promise.all([dbListsGetAll(), dbGetAll()]);
  const counts = {};
  allItems.forEach((it) => {
    const lid = it.listId || DEFAULT_LIST_ID;
    counts[lid] = (counts[lid] || 0) + 1;
  });

  listsListEl.innerHTML = lists
    .map((l) => `
      <div class="list-row${l.id === currentListId ? " active" : ""}" data-id="${l.id}">
        <div class="list-row-info">
          <span class="list-row-name">${escapeHtml(l.name)}</span>
          <span class="list-row-count">${counts[l.id] || 0} عنصر</span>
        </div>
        <div class="list-row-actions">
          ${l.id === currentListId ? `<span class="list-current-tag">الحالية</span>` : `<button class="btn btn-ghost list-switch-btn" data-id="${l.id}">فتح</button>`}
          ${lists.length > 1 ? `<button class="list-delete-btn" data-id="${l.id}" data-name="${escapeHtml(l.name)}">🗑️</button>` : ""}
        </div>
      </div>
    `)
    .join("");

  listsListEl.querySelectorAll(".list-switch-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await switchToList(btn.dataset.id);
      listsModalOverlay.classList.add("hidden");
    });
  });

  listsListEl.querySelectorAll(".list-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = window.confirm(`متأكد إنك عايز تمسح قائمة "${btn.dataset.name}" وكل اللي فيها؟`);
      if (!ok) return;
      const allItemsNow = await dbGetAll();
      await dbDeleteItemsByListId(btn.dataset.id, allItemsNow);
      await dbListDelete(btn.dataset.id);
      if (btn.dataset.id === currentListId) {
        const remaining = await dbListsGetAll();
        await switchToList(remaining[0].id);
      }
      await renderListsModal();
    });
  });
}

document.getElementById("newListBtn").addEventListener("click", async () => {
  const name = window.prompt("اسم القائمة الجديدة (مثلاً: أفلام)");
  if (!name || !name.trim()) return;
  const id = await createNewList(name.trim());
  await switchToList(id);
  listsModalOverlay.classList.add("hidden");
  showToast(`تم إنشاء قائمة "${name.trim()}" ✅`);
});

/* ================================================================
   الأسرار (Vault) — شاشة منفصلة تمامًا، مش بتلمس الشاشة الرئيسية
   ولا دالة render() بتاعتها خالص. تصميم مبسّط عمدًا (كلمة مرور واحدة
   بس، بدون كلمة استرداد، بدون تشفير مزدوج) عشان يفضل بسيط وسريع
   ومفيش فيه احتمال فشل معقّد.
   ================================================================ */
const VAULT_META_KEY = "vaultMeta";
const VAULT_VERIFIER_TEXT = "vault-unlock-check";
const VAULT_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 دقايق خمول = قفل تلقائي

let vaultKey = null; // مفتاح AES-GCM في الذاكرة بس، مش بيتخزن أبدًا
let vaultNotes = []; // نسخة مفكوكة التشفير في الذاكرة أثناء الفتح بس
let vaultCurrentNoteId = null;
let vaultAutoLockTimer = null;
let vaultFailedAttempts = 0;

async function deriveVaultKey(password, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function vaultEncryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: bufToBase64(iv), data: bufToBase64(cipherBuf) };
}
async function vaultDecryptText(key, payload) {
  const iv = new Uint8Array(base64ToBuf(payload.iv));
  const cipherBuf = base64ToBuf(payload.data);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}

function showVaultScreen(id) {
  document.querySelectorAll(".vault-screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function resetVaultAutoLockTimer() {
  clearTimeout(vaultAutoLockTimer);
  vaultAutoLockTimer = setTimeout(vaultLock, VAULT_AUTO_LOCK_MS);
}

function vaultLock() {
  clearTimeout(vaultAutoLockTimer);
  vaultKey = null;
  vaultNotes = [];
  vaultCurrentNoteId = null;
  document.getElementById("vaultUnlockPassword").value = "";
  document.getElementById("vaultOverlay").classList.add("hidden");
}

async function openVaultOverlay() {
  document.getElementById("vaultOverlay").classList.remove("hidden");
  const meta = (await dbSettingsGetAll()).find((r) => r.key === VAULT_META_KEY);
  if (meta && meta.value) {
    document.getElementById("vaultUnlockError").classList.add("hidden");
    document.getElementById("vaultUnlockPassword").value = "";
    showVaultScreen("vaultUnlockScreen");
  } else {
    document.getElementById("vaultSetupError").classList.add("hidden");
    document.getElementById("vaultSetupPassword").value = "";
    document.getElementById("vaultSetupPasswordConfirm").value = "";
    showVaultScreen("vaultSetupScreen");
  }
}

document.getElementById("openVaultBtn").addEventListener("click", () => {
  dropdownMenu.classList.add("hidden");
  openVaultOverlay();
});

document.getElementById("vaultSetupCloseBtn").addEventListener("click", () => {
  document.getElementById("vaultOverlay").classList.add("hidden");
});
document.getElementById("vaultUnlockCloseBtn").addEventListener("click", () => {
  document.getElementById("vaultOverlay").classList.add("hidden");
});
document.getElementById("vaultResetCloseBtn").addEventListener("click", () => {
  document.getElementById("vaultOverlay").classList.add("hidden");
});

document.getElementById("vaultSetupBtn").addEventListener("click", async () => {
  const pw = document.getElementById("vaultSetupPassword").value;
  const pwConfirm = document.getElementById("vaultSetupPasswordConfirm").value;
  const errEl = document.getElementById("vaultSetupError");

  if (pw.length < 4) {
    errEl.textContent = "كلمة المرور لازم تكون 4 حروف على الأقل";
    errEl.classList.remove("hidden");
    return;
  }
  if (pw !== pwConfirm) {
    errEl.textContent = "كلمتا المرور مش متطابقتين";
    errEl.classList.remove("hidden");
    return;
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey(pw, salt);
  const verifier = await vaultEncryptText(key, VAULT_VERIFIER_TEXT);

  await dbSettingsPut(VAULT_META_KEY, { salt: bufToBase64(salt), verifier });

  vaultKey = key;
  vaultNotes = [];
  vaultFailedAttempts = 0;
  showVaultScreen("vaultNotesScreen");
  renderVaultNotesList();
  resetVaultAutoLockTimer();
});

document.getElementById("vaultUnlockBtn").addEventListener("click", async () => {
  const pw = document.getElementById("vaultUnlockPassword").value;
  const errEl = document.getElementById("vaultUnlockError");

  if (vaultFailedAttempts >= 5) {
    errEl.textContent = "محاولات كتير غلط، استنى شوية وجرب تاني";
    errEl.classList.remove("hidden");
    return;
  }

  const meta = (await dbSettingsGetAll()).find((r) => r.key === VAULT_META_KEY);
  if (!meta) return;

  try {
    const salt = new Uint8Array(base64ToBuf(meta.value.salt));
    const key = await deriveVaultKey(pw, salt);
    const check = await vaultDecryptText(key, meta.value.verifier);
    if (check !== VAULT_VERIFIER_TEXT) throw new Error("wrong");

    vaultKey = key;
    vaultFailedAttempts = 0;
    errEl.classList.add("hidden");

    const allEncrypted = await dbVaultNotesGetAll();
    vaultNotes = [];
    for (const n of allEncrypted) {
      try {
        const decrypted = JSON.parse(await vaultDecryptText(key, n));
        vaultNotes.push({ id: n.id, title: decrypted.title, content: decrypted.content, updatedAt: n.updatedAt, createdAt: n.createdAt });
      } catch (e) { /* تجاهل ملاحظة تالفة بدل ما توقف الباقي */ }
    }

    showVaultScreen("vaultNotesScreen");
    renderVaultNotesList();
    resetVaultAutoLockTimer();
  } catch (e) {
    vaultFailedAttempts++;
    errEl.textContent = "كلمة المرور غلط";
    errEl.classList.remove("hidden");
    if (vaultFailedAttempts >= 5) {
      setTimeout(() => { vaultFailedAttempts = 0; }, 8000);
    }
  }
});

document.getElementById("vaultForgotBtn").addEventListener("click", () => {
  showVaultScreen("vaultResetScreen");
});
document.getElementById("vaultCancelResetBtn").addEventListener("click", () => {
  showVaultScreen("vaultUnlockScreen");
});
document.getElementById("vaultConfirmResetBtn").addEventListener("click", async () => {
  const ok = window.confirm("متأكد تمامًا؟ هيتمسح كل شيء نهائيًا وميرجعش.");
  if (!ok) return;
  await dbVaultNotesClearAll();
  const tx = db.transaction(SETTINGS_STORE, "readwrite");
  tx.objectStore(SETTINGS_STORE).delete(VAULT_META_KEY);
  tx.oncomplete = () => {
    vaultKey = null;
    vaultNotes = [];
    showToast("تم تصفير الخزنة");
    showVaultScreen("vaultSetupScreen");
  };
});

document.getElementById("vaultLockBtn").addEventListener("click", vaultLock);

/* ---- قائمة الملاحظات ---- */
function renderVaultNotesList() {
  const query = document.getElementById("vaultSearchInput").value.trim().toLowerCase();
  const list = document.getElementById("vaultNotesList");
  const empty = document.getElementById("vaultEmptyState");

  const filtered = vaultNotes
    .filter((n) => !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  empty.classList.toggle("hidden", filtered.length !== 0);
  list.innerHTML = filtered
    .map((n) => `
      <div class="vault-note-card" data-id="${n.id}">
        <div class="vault-note-title">${escapeHtml(n.title || "(بدون عنوان)")}</div>
        <div class="vault-note-snippet">${escapeHtml((n.content || "").slice(0, 60))}</div>
        <div class="vault-note-time">${formatRelativeDate(n.updatedAt)}</div>
      </div>
    `)
    .join("");

  list.querySelectorAll(".vault-note-card").forEach((card) => {
    card.addEventListener("click", () => openVaultEditor(card.dataset.id));
  });
}

document.getElementById("vaultSearchInput").addEventListener("input", () => {
  resetVaultAutoLockTimer();
  renderVaultNotesList();
});
document.getElementById("vaultNewNoteBtn").addEventListener("click", () => openVaultEditor(null));

/* ---- محرر الملاحظة ---- */
let vaultSaveTimer = null;

function openVaultEditor(id) {
  resetVaultAutoLockTimer();
  vaultCurrentNoteId = id;
  const note = id ? vaultNotes.find((n) => n.id === id) : null;
  document.getElementById("vaultNoteTitle").value = note ? note.title : "";
  document.getElementById("vaultNoteContent").value = note ? note.content : "";
  document.getElementById("vaultDeleteNoteBtn").classList.toggle("hidden", !note);
  document.getElementById("vaultSaveIndicator").textContent = "";
  showVaultScreen("vaultEditorScreen");
}

document.getElementById("vaultEditorBackBtn").addEventListener("click", () => {
  showVaultScreen("vaultNotesScreen");
  renderVaultNotesList();
});

async function vaultAutoSave() {
  const title = document.getElementById("vaultNoteTitle").value.trim();
  const content = document.getElementById("vaultNoteContent").value;
  if (!title && !content) return;

  const indicator = document.getElementById("vaultSaveIndicator");
  indicator.textContent = "جاري الحفظ...";

  const now = Date.now();
  if (!vaultCurrentNoteId) {
    vaultCurrentNoteId = "n_" + now + "_" + Math.random().toString(36).slice(2, 8);
  }

  const plainPayload = JSON.stringify({ title, content });
  const encrypted = await vaultEncryptText(vaultKey, plainPayload);
  const existing = vaultNotes.find((n) => n.id === vaultCurrentNoteId);
  const createdAt = existing ? existing.createdAt : now;

  await dbVaultNotePut({ id: vaultCurrentNoteId, iv: encrypted.iv, data: encrypted.data, createdAt, updatedAt: now });

  const idx = vaultNotes.findIndex((n) => n.id === vaultCurrentNoteId);
  const updatedNote = { id: vaultCurrentNoteId, title, content, createdAt, updatedAt: now };
  if (idx >= 0) vaultNotes[idx] = updatedNote;
  else vaultNotes.push(updatedNote);

  indicator.textContent = "✓ تم الحفظ";
  document.getElementById("vaultDeleteNoteBtn").classList.remove("hidden");
}

["vaultNoteTitle", "vaultNoteContent"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    resetVaultAutoLockTimer();
    clearTimeout(vaultSaveTimer);
    document.getElementById("vaultSaveIndicator").textContent = "...";
    vaultSaveTimer = setTimeout(vaultAutoSave, 500);
  });
});

document.getElementById("vaultDeleteNoteBtn").addEventListener("click", async () => {
  if (!vaultCurrentNoteId) return;
  const ok = window.confirm("تحذف الملاحظة دي؟");
  if (!ok) return;
  await dbVaultNoteDelete(vaultCurrentNoteId);
  vaultNotes = vaultNotes.filter((n) => n.id !== vaultCurrentNoteId);
  showVaultScreen("vaultNotesScreen");
  renderVaultNotesList();
  showToast("تم الحذف 🗑️");
});

/* ============ بدء التشغيل ============ */
(async function init() {
  await openDB();
  await loadAppSettingsFromDB();
  await loadCurrentListSettings();
  await reloadFromDB();
  renderFilterSegments();
  hideFinishedBtn.classList.toggle("active", hideFinishedFilter);
  checkBackupReminder();
})();
