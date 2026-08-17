/* ============ إعداد قاعدة البيانات المحلية (IndexedDB) ============ */
const DB_NAME = "anime_tracker_db";
const DB_VERSION = 1;
const STORE = "anime_items";
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

function dbBulkPut(items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    items.forEach((it) => store.put(it));
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
            ? `<img src="${anime.image}" alt="${escapeHtml(anime.name)}" />`
            : `<div class="no-image"><svg viewBox="0 0 24 24" width="34" height="34"><path fill="currentColor" opacity="0.4" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`
        }
        <div class="status-chip st-${statusKey}">${statusText}</div>
        ${editMode ? `<button class="card-edit-btn" data-id="${anime.id}"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : ""}
      </div>
      <div class="card-title">${escapeHtml(anime.name)}</div>
    `;

    if (editMode) {
      card.querySelector(".card-edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openAnimeModal(anime.id);
      });
    } else {
      // في غير وضع التعديل: الضغط على الكارت يفتح تغيير الحالة السريع
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

// دوسة على الكارت (خارج وضع التعديل) بتلف على الحالات بسرعة
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

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pickedImageDataUrl = reader.result;
    imagePreview.src = pickedImageDataUrl;
    imagePreview.classList.remove("hidden");
    imagePlaceholder.classList.add("hidden");
  };
  reader.readAsDataURL(file);
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
searchInput.addEventListener("input", render);
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
    version: 1,
    exportedAt: new Date().toISOString(),
    items: animeList,
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
  pendingImportPayload = null;
  importModalOverlay.classList.remove("hidden");
});

document.getElementById("cancelImportBtn").addEventListener("click", () => {
  importModalOverlay.classList.add("hidden");
});

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    pendingImportPayload = JSON.parse(text);
    importPasswordWrap.classList.toggle("hidden", !pendingImportPayload.encrypted);
    importError.classList.add("hidden");
  } catch (e) {
    importError.textContent = "الملف ده تالف أو مش بصيغة صحيحة";
    importError.classList.remove("hidden");
    pendingImportPayload = null;
  }
});

document.getElementById("confirmImportBtn").addEventListener("click", async () => {
  if (!pendingImportPayload) {
    showToast("اختار ملف الأول");
    return;
  }

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

    await dbClearAll();
    await dbBulkPut(parsed.items);
    await reloadFromDB();

    importModalOverlay.classList.add("hidden");
    showToast(`تم استيراد ${parsed.items.length} عنصر ✅`);
  } catch (e) {
    importError.textContent = "كلمة السر غلط أو الملف تالف";
    importError.classList.remove("hidden");
  }
});

/* ============ بدء التشغيل ============ */
(async function init() {
  await openDB();
  await reloadFromDB();
})();
