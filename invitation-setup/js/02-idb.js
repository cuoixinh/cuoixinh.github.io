// IndexedDB: lưu tạm ảnh chưa upload (pending images) để không mất khi F5.
//
// Tách từ index.js (dòng 58–317 bản gốc). Thứ tự nạp khai báo ở loader.js.
// Khung chat XuXi ở trang chủ (js/ai-chat-media.js) GHI thẳng vào DB này theo đúng tên
// DB/khoá/shape bản ghi bên dưới — đổi ở đây thì đổi cả bên đó.

// ============= INDEXED DB — PENDING IMAGES =============
// Lưu ảnh chưa upload vào IndexedDB để sống qua reload/đóng tab. Ảnh cất dạng byte ở
// khoá `data` (CXImagePick.toStored); bản ghi kiểu cũ mang File ở khoá `file` vẫn đọc được.
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

// Đọc không được thì không ghi: ảnh vẫn còn trong RAM của trang, chỉ không sống qua F5.
async function _idbPack(file) {
  try {
    return await CXImagePick.toStored(file);
  } catch (e) {
    console.error("_idbPack:", e);
    return null;
  }
}

// Sau mỗi lần chờ đọc byte phải hỏi lại ảnh còn đang chờ không: khách xoá/thay ảnh trong
// lúc đó mà vẫn ghi là bản ghi ra sau lệnh xoá, F5 ảnh cũ sống lại.
async function _idbSaveSingle(fieldName, file) {
  const data = await _idbPack(file);
  if (!data || pendingUploads.singleImages[fieldName] !== file) return;
  await _idbPut({
    key: `${WEDDING_ID}_s_${fieldName}`,
    type: "single",
    fieldName,
    weddingId: WEDDING_ID,
    data,
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

let _lsSaveSeq = 0;
async function _idbSaveLoveStoryImages() {
  const seq = ++_lsSaveSeq; // lượt sau thắng: lượt cũ đọc byte xong muộn thì bỏ
  const entries = (
    await Promise.all(
      Object.entries(_loveStoryPendingImages).map(async ([idx, file]) => {
        const data = await _idbPack(file);
        return data && { idx: parseInt(idx), data };
      }),
    )
  ).filter(Boolean);
  if (seq !== _lsSaveSeq) return;
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
  const data = await _idbPack(file);
  if (!data || _galleryIdbKeys.get(file) !== key) return; // đã bị bỏ trong lúc đọc
  await _idbPut({
    key,
    type: "gallery",
    weddingId: WEDDING_ID,
    data,
    focalPoint: pendingFocalPoints.gallery_images.get(file) || null,
    order: Date.now(),
  });
}

async function _idbRemoveGallery(file) {
  const key = _galleryIdbKeys.get(file);
  _galleryIdbKeys.delete(file);
  await _idbDelete(key);
}

// Thứ tự album sau kéo thả: tên file cho ảnh đã lưu, khoá IDB cho ảnh chưa upload.
async function _idbSaveGalleryOrder() {
  await _idbPut({
    key: `${WEDDING_ID}_go`,
    type: "gallery_order",
    weddingId: WEDDING_ID,
    order: galleryItems().map((k) =>
      k instanceof File ? { k: _galleryIdbKeys.get(k) } : { f: k },
    ),
  });
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

// true khi có khôi phục thứ gì đó — bản xem thử dựng trước đó cần tải lại.
// Ảnh nào không còn đọc được (trình duyệt mất dữ liệu) thì bỏ hẳn bản ghi và báo khách
// chọn lại, chứ để vào hàng chờ là lúc lưu gửi lên một file rỗng.
async function _idbRestoreAll() {
  try {
    const all = await _idbGetAll();
    const mine = all.filter((r) => r.weddingId === WEDDING_ID);
    if (!mine.length) return false;
    let lost = 0;
    // Bản ghi kiểu cũ (File) đọc được thì ghi lại sang dạng byte luôn: để nguyên là lần mở
    // sau trên iPhone vẫn có thể đọc ra rỗng.
    const read = async (r) => {
      const file = await CXImagePick.fromStored(r);
      if (!file) lost++;
      else if (!r.data && r.key) {
        const { file: _old, ...rest } = r;
        _idbPack(file).then((data) => {
          // Khách đã bỏ/thay ảnh trong lúc đọc thì thôi, kẻo ghi sống lại bản ghi vừa xoá.
          const still =
            r.type === "gallery"
              ? _galleryIdbKeys.get(file) === r.key
              : pendingUploads.singleImages[r.fieldName] === file;
          if (data && still) _idbPut({ ...rest, data });
        });
      }
      return file;
    };

    // Restore single images
    for (const r of mine.filter((r) => r.type === "single")) {
      const file = await read(r);
      if (!file) {
        _idbDelete(r.key);
        continue;
      }
      pendingUploads.singleImages[r.fieldName] = file;
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
      const file = await read(r);
      if (!file) {
        _idbDelete(r.key);
        continue;
      }
      pendingUploads.galleryImages.push(file);
      if (r.focalPoint)
        pendingFocalPoints.gallery_images.set(file, r.focalPoint);
      _galleryIdbKeys.set(file, r.key);
    }

    const orderRec = mine.find((r) => r.type === "gallery_order");
    if (Array.isArray(orderRec?.order)) {
      const fileOf = new Map([..._galleryIdbKeys].map(([f, k]) => [k, f]));
      _galleryOrder = orderRec.order
        .map((o) => o.f || fileOf.get(o.k))
        .filter(Boolean);
    }

    // Restore focal-only adjustments for DB gallery images
    for (const r of mine.filter((r) => r.type === "gallery_focal")) {
      if (r.focalPoint && r.filename)
        pendingFocalPoints.gallery_images.set(r.filename, r.focalPoint);
    }

    // Restore love story pending images
    const lsRec = mine.find((r) => r.type === "love_story_images");
    if (lsRec?.images?.length) {
      const before = lost;
      for (const img of lsRec.images) {
        const file = await read(img);
        if (file) _loveStoryPendingImages[img.idx] = file;
      }
      // Ghi lại khi có tấm hỏng (bỏ nó ra) hoặc còn tấm kiểu cũ (đổi sang dạng byte).
      if (lost > before || lsRec.images.some((i) => !i.data)) _idbSaveLoveStoryImages();
    }

    if (lost) {
      showToast(
        `${lost} ảnh chưa lưu không còn đọc được trên máy này, bạn chọn lại giúp mình nhé`,
        "warning",
      );
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
    return true;
  } catch (e) {
    console.error("_idbRestoreAll:", e);
    return false;
  }
}

// (Trạng thái đăng nhập: hỏi CXAuth ở core/auth.js — CXAuth.isLoggedIn() /
//  getUserSync() để vẽ UI, await CXAuth.getUser() trước khi ghi DB.)

