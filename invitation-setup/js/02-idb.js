// IndexedDB: lưu tạm ảnh chưa upload (pending images) để không mất khi F5.
//
// Tách từ index.js (dòng 58–317 bản gốc). Thứ tự nạp khai báo ở loader.js.

// ============= INDEXED DB — PENDING IMAGES =============
// Lưu File objects (ảnh chưa upload) vào IndexedDB để sống qua reload/đóng tab.
// localStorage không chứa được File/Blob nên cần IDB.
const _IDB_NAME = "cuoixinh_pending";
const _IDB_VER = 1;
const _IDB_STORE = "uploads";
let _idb = null;

function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, _IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE))
        db.createObjectStore(_IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = (e) => {
      _idb = e.target.result;
      resolve(_idb);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function _idbPut(record) {
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      tx.objectStore(_IDB_STORE).put(record);
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    console.error("_idbPut:", e);
  }
}

async function _idbDelete(key) {
  if (!key) return;
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      tx.objectStore(_IDB_STORE).delete(key);
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    console.error("_idbDelete:", e);
  }
}

async function _idbGetAll() {
  try {
    const db = await _openIDB();
    return await new Promise((res, rej) => {
      const req = db
        .transaction(_IDB_STORE, "readonly")
        .objectStore(_IDB_STORE)
        .getAll();
      req.onsuccess = (e) => res(e.target.result || []);
      req.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    console.error("_idbGetAll:", e);
    return [];
  }
}

async function _idbClearWedding() {
  try {
    const all = await _idbGetAll();
    const keys = all
      .filter((r) => r.weddingId === WEDDING_ID)
      .map((r) => r.key);
    if (!keys.length) return;
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      const store = tx.objectStore(_IDB_STORE);
      keys.forEach((k) => store.delete(k));
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    console.error("_idbClearWedding:", e);
  }
}

// File → IDB key — cần để biết key nào cần xoá khi user bỏ ảnh gallery pending
const _galleryIdbKeys = new Map();

async function _idbSaveSingle(fieldName, file) {
  await _idbPut({
    key: `${WEDDING_ID}_s_${fieldName}`,
    type: "single",
    fieldName,
    weddingId: WEDDING_ID,
    file,
    focalPoint: pendingFocalPoints[fieldName] || null,
  });
}

async function _idbSaveFocal(fieldName) {
  await _idbPut({
    key: `${WEDDING_ID}_sf_${fieldName}`,
    type: "focal_only",
    fieldName,
    weddingId: WEDDING_ID,
    focalPoint: pendingFocalPoints[fieldName] || null,
  });
}

async function _idbSaveLoveStoryImages() {
  const entries = Object.entries(_loveStoryPendingImages).map(
    ([idx, file]) => ({ idx: parseInt(idx), file }),
  );
  if (!entries.length) {
    await _idbDelete(`${WEDDING_ID}_lsImg`);
    return;
  }
  await _idbPut({
    key: `${WEDDING_ID}_lsImg`,
    type: "love_story_images",
    weddingId: WEDDING_ID,
    images: entries,
  });
}

async function _idbAddGallery(file) {
  const key = `${WEDDING_ID}_g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  _galleryIdbKeys.set(file, key);
  await _idbPut({
    key,
    type: "gallery",
    weddingId: WEDDING_ID,
    file,
    focalPoint: pendingFocalPoints.gallery_images.get(file) || null,
    order: Date.now(),
  });
}

async function _idbRemoveGallery(file) {
  const key = _galleryIdbKeys.get(file);
  _galleryIdbKeys.delete(file);
  await _idbDelete(key);
}

async function _idbSaveGalleryFocal(filename) {
  await _idbPut({
    key: `${WEDDING_ID}_gf_${filename}`,
    type: "gallery_focal",
    filename,
    weddingId: WEDDING_ID,
    focalPoint: pendingFocalPoints.gallery_images.get(filename) || null,
  });
}

async function _idbUpdateGalleryFocal(file) {
  const key = _galleryIdbKeys.get(file);
  if (!key) return;
  try {
    const db = await _openIDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, "readwrite");
      const store = tx.objectStore(_IDB_STORE);
      const req = store.get(key);
      req.onsuccess = (e) => {
        const record = e.target.result;
        if (record) {
          record.focalPoint =
            pendingFocalPoints.gallery_images.get(file) || null;
          store.put(record);
        }
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    console.error("_idbUpdateFocal:", e);
  }
}

async function _idbRestoreAll() {
  try {
    const all = await _idbGetAll();
    const mine = all.filter((r) => r.weddingId === WEDDING_ID);
    if (!mine.length) return;

    // Restore single images
    for (const r of mine.filter((r) => r.type === "single")) {
      pendingUploads.singleImages[r.fieldName] = r.file;
      if (r.focalPoint) pendingFocalPoints[r.fieldName] = r.focalPoint;
    }

    // Restore focal-only adjustments for DB images (overrides DB value from fillForm)
    for (const r of mine.filter((r) => r.type === "focal_only")) {
      if (r.focalPoint) pendingFocalPoints[r.fieldName] = r.focalPoint;
    }

    // Restore gallery sorted by insertion order
    const gallery = mine
      .filter((r) => r.type === "gallery")
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const r of gallery) {
      pendingUploads.galleryImages.push(r.file);
      if (r.focalPoint)
        pendingFocalPoints.gallery_images.set(r.file, r.focalPoint);
      _galleryIdbKeys.set(r.file, r.key);
    }

    // Restore focal-only adjustments for DB gallery images
    for (const r of mine.filter((r) => r.type === "gallery_focal")) {
      if (r.focalPoint && r.filename)
        pendingFocalPoints.gallery_images.set(r.filename, r.focalPoint);
    }

    // Restore love story pending images
    const lsRec = mine.find((r) => r.type === "love_story_images");
    if (lsRec?.images?.length) {
      lsRec.images.forEach(({ idx, file }) => {
        _loveStoryPendingImages[idx] = file;
      });
    }

    // Re-render image UIs với dữ liệu vừa restore
    [
      "cover_image_url",
      "groom_image_url",
      "bride_image_url",
      "groom_qr_url",
      "bride_qr_url",
    ].forEach((f) => renderSingleImageUpload(f));
    renderGalleryGrid();
    if (Object.keys(_loveStoryPendingImages).length) renderLoveStoryList();
  } catch (e) {
    console.error("_idbRestoreAll:", e);
  }
}

function getCurrentUser() {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!key) return null;
    let raw = localStorage.getItem(key);
    if (!raw) return null;
    // supabase-js v2 có thể lưu dạng "base64-<b64(json)>" → giải mã (UTF-8) trước khi parse
    if (raw.startsWith("base64-")) {
      raw = decodeURIComponent(escape(atob(raw.slice(7))));
    }
    return JSON.parse(raw)?.user ?? null;
  } catch (e) {
    return null;
  }
}

