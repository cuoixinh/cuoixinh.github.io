// ============= TAB "Dữ liệu mẫu": phần ẢNH =============
// Bộ demo của mỗi theme nằm ở assets/data-template/<theme>/, ghi qua File System
// Access API (Chrome/Edge desktop, mở qua localhost). File này lo ẢNH + khung
// state/nháp/lưu; phần CHỮ ở 04-sample-data.js, dùng chung siData/siMarkDirty
// khai báo tại đây.
//
// Quy ước:
// 1. Chọn theme → QUÉT thư mục, bind mọi ảnh sẵn có (kể cả khi thiếu data.json)
//    để không phải up lại → không sinh file trùng.
// 2. Mọi thay đổi ghi bản nháp vào IndexedDB → F5 không mất ảnh đang nhập.
// 3. "Lưu vào ổ đĩa" GHI ĐÈ toàn bộ ảnh trong thư mục.
// 4. Nén ĐÚNG MỘT LẦN lúc ảnh vào state, qua ImageHelper.prepareImage() với
//    ngưỡng SI_IMAGE_LIMITS (≤1920px, ≤1.5MB); lúc lưu chỉ ghi blob xuống đĩa.

// Danh sách mẫu lấy từ bảng `templates` (edge function public-templates) — thêm
// mẫu mới chỉ cần một hàng trong DB, không sửa file này. Hỏng mạng thì để trống,
// người dùng bấm lại tab là gọi lại.
let SI_THEMES = [];

async function siLoadThemes() {
  if (SI_THEMES.length) return SI_THEMES;
  try {
    const res = await fetch(
      `${CONFIG.supabase.edgeUrl}?resource=public-templates`,
      { headers: { Authorization: `Bearer ${CONFIG.supabase.anonKey}` } },
    );
    if (!res.ok) return SI_THEMES;
    const rows = await res.json();
    SI_THEMES = (Array.isArray(rows) ? rows : [])
      .filter((t) => t.theme)
      .map((t) => ({ value: t.theme, label: t.name || t.theme }));
  } catch (e) {
    console.error("Không tải được danh sách mẫu:", e);
  }
  return SI_THEMES;
}

const SI_FOCAL_POINT_FIELDS = [
  "cover_image_url",
  "groom_image_url",
  "bride_image_url",
];
const SI_CROP_FIELDS = ["groom_qr_url", "bride_qr_url"];
const SI_SINGLE_FIELDS = [...SI_FOCAL_POINT_FIELDS, ...SI_CROP_FIELDS];
const SI_MAX_GALLERY = 10;
const SI_MAX_LOVE_STORY = CONFIG.maxLoveStoryItems || 10;

const SI_IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const SI_LAST_THEME_KEY = "si_last_theme";

// Ngưỡng nén của ảnh mẫu — RỘNG HƠN ảnh khách tự upload. Khai báo ở
// CONFIG.image.sampleData (core/config.js); phần không khai lấy theo mặc định
// của ImageHelper (khung ảnh 1920px).
const SI_IMAGE_LIMITS = CONFIG.image.sampleData;

// Cờ "lưu dở dang": đặt lúc bắt đầu ghi, xoá ở finally. Trang chết giữa chừng
// thì cờ còn lại → lần mở sau tự ghi tiếp. Chặn số vòng để không lặp vô tận.
const SI_RESUME_KEY = "si_resume_save";
const SI_MAX_RESUME = 5;

const SI_FIELD_BASENAME = {
  cover_image_url: "cover",
  groom_image_url: "groom",
  bride_image_url: "bride",
  groom_qr_url: "groom-qr",
  bride_qr_url: "bride-qr",
};

// Thống kê ảnh bị nén trong lần nạp gần nhất (siBindImage cộng dồn) — chỉ để báo
// cho admin biết thư mục theme vừa có ảnh quá khổ.
const siLoadCompressed = { count: 0, savedBytes: 0 };

let siRootHandle = null;
let siThemeHandle = null;
let siCurrentTheme = null;
let siData = null;

// ============= IndexedDB: directory handle + bản nháp =============
// store "handles": handle thư mục đã chọn. store "drafts": bản nháp theo theme
// (chứa Blob nên localStorage không dùng được).

const SI_IDB_NAME = "cx_admin_fs";
const SI_IDB_VER = 2;
const SI_IDB_STORE = "handles";
const SI_IDB_DRAFT_STORE = "drafts";
const SI_IDB_KEY = "data-template-root";

// Giữ lại 1 connection: mở connection mới cho từng thao tác sẽ chặn lần nâng
// version sau (connection cũ chưa đóng → upgrade bị "blocked").
let siIdbConn = null;

function siOpenIdb() {
  if (siIdbConn) return Promise.resolve(siIdbConn);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SI_IDB_NAME, SI_IDB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SI_IDB_STORE))
        db.createObjectStore(SI_IDB_STORE);
      if (!db.objectStoreNames.contains(SI_IDB_DRAFT_STORE))
        db.createObjectStore(SI_IDB_DRAFT_STORE);
    };
    req.onsuccess = () => {
      siIdbConn = req.result;
      siIdbConn.onversionchange = () => {
        siIdbConn.close();
        siIdbConn = null;
      };
      resolve(siIdbConn);
    };
    req.onerror = () => reject(req.error);
  });
}

async function siIdbGet(storeName, key) {
  const db = await siOpenIdb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function siIdbPut(storeName, key, value) {
  const db = await siOpenIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function siIdbDelete(storeName, key) {
  const db = await siOpenIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const siIdbGetHandle = () => siIdbGet(SI_IDB_STORE, SI_IDB_KEY);
const siIdbSetHandle = (handle) => siIdbPut(SI_IDB_STORE, SI_IDB_KEY, handle);

// ============= Init tab =============

async function initSampleImagesPanel() {
  if (!("showDirectoryPicker" in window)) {
    document.getElementById("si-unsupported-banner").classList.remove("hidden");
    document.getElementById("si-body").classList.add("hidden");
    return;
  }

  await siPopulateThemeDropdown();

  const savedHandle = await siIdbGetHandle().catch(() => null);
  if (!savedHandle) {
    siSetFolderStatus("disconnected");
    return;
  }

  siRootHandle = savedHandle;
  const perm = await siRootHandle
    .queryPermission({ mode: "readwrite" })
    .catch(() => "denied");
  siSetFolderStatus(perm === "granted" ? "connected" : "needs-reauth");
  if (perm === "granted") await siRestoreLastTheme();
}

// Sau F5 (hoặc quay lại tab), tự chọn lại theme đang làm dở để nạp luôn
// ảnh trên đĩa + bản nháp, khỏi phải bấm lại.
async function siRestoreLastTheme() {
  const select = document.getElementById("si-theme-select");
  if (!select || select.value) return;
  const last = localStorage.getItem(SI_LAST_THEME_KEY);
  const themes = await siLoadThemes();
  if (!last || !themes.some((t) => t.value === last)) return;
  select.value = last;
  await onSampleImagesThemeChange();
}

async function siPopulateThemeDropdown() {
  const select = document.getElementById("si-theme-select");
  if (select.dataset.populated) return;
  const themes = await siLoadThemes();
  if (!themes.length || select.dataset.populated) return;
  themes.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  });
  select.dataset.populated = "1";
}

function siSetFolderStatus(state) {
  const statusEl = document.getElementById("si-folder-status");
  const btn = document.getElementById("si-connect-btn");
  const themeWrap = document.getElementById("si-theme-select-wrap");

  if (state === "connected") {
    statusEl.textContent = "✅ Đã kết nối";
    statusEl.className = "text-xs text-green-600 mt-0.5";
    btn.textContent = "Đổi thư mục";
    btn.dataset.mode = "pick";
    themeWrap.classList.remove("hidden");
  } else if (state === "needs-reauth") {
    statusEl.textContent = "⚠️ Cần cấp lại quyền truy cập thư mục";
    statusEl.className = "text-xs text-amber-600 mt-0.5";
    btn.textContent = "Cấp lại quyền";
    btn.dataset.mode = "regrant";
    themeWrap.classList.add("hidden");
    document.getElementById("si-form").classList.add("hidden");
  } else {
    statusEl.textContent = "Chưa kết nối";
    statusEl.className = "text-xs text-gray-500 mt-0.5";
    btn.textContent = "Chọn thư mục";
    btn.dataset.mode = "pick";
    themeWrap.classList.add("hidden");
    document.getElementById("si-form").classList.add("hidden");
  }
}

async function connectSampleImagesFolder() {
  const btn = document.getElementById("si-connect-btn");
  try {
    if (btn.dataset.mode === "regrant" && siRootHandle) {
      const perm = await siRootHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        showToast("Chưa cấp quyền truy cập thư mục", "error");
        return;
      }
      siSetFolderStatus("connected");
      await siRestoreLastTheme();
      return;
    }

    const handle = await window.showDirectoryPicker();
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      showToast("Chưa cấp quyền truy cập thư mục", "error");
      return;
    }
    siRootHandle = handle;
    await siIdbSetHandle(handle);
    siSetFolderStatus("connected");
    showToast("Đã kết nối thư mục", "success");
    await siRestoreLastTheme();
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      showToast("Lỗi chọn thư mục: " + e.message, "error");
    }
  }
}

// ============= Chọn theme → load data hiện có =============

async function onSampleImagesThemeChange() {
  await siFlushDraft();

  const theme = document.getElementById("si-theme-select").value;
  document.getElementById("si-form").classList.add("hidden");
  siCurrentTheme = null;
  siThemeHandle = null;
  if (!theme) {
    localStorage.removeItem(SI_LAST_THEME_KEY);
    return;
  }
  if (!siRootHandle) return;

  showLoading(true, "Đang tải dữ liệu...");
  try {
    siThemeHandle = await siRootHandle.getDirectoryHandle(theme, {
      create: true,
    });
    siCurrentTheme = theme;
    localStorage.setItem(SI_LAST_THEME_KEY, theme);

    const foundOnDisk = await siLoadThemeData();

    // Có nháp chưa lưu → nó mới là bản đang làm dở, đè lên dữ liệu đọc từ đĩa.
    const draft = await siIdbGet(SI_IDB_DRAFT_STORE, theme).catch(() => null);
    if (draft) {
      siApplyDraft(draft);
      siShowDraftBanner(draft.updatedAt);
      siSetDirtyIndicator(true);
    } else {
      siShowDraftBanner(null);
      siSetDirtyIndicator(false);
      if (foundOnDisk) {
        showToast(`Đã nạp ${foundOnDisk} ảnh có sẵn trong thư mục`, "default", "folder-open");
      }
    }

    document.getElementById("si-form").classList.remove("hidden");
  } catch (e) {
    console.error(e);
    showToast("Lỗi tải dữ liệu theme: " + e.message, "error");
  } finally {
    showLoading(false);
  }

  // Nạp xong mới xét: lần lưu trước có bỏ dở không thì ghi tiếp cho xong.
  await siResumeSaveIfInterrupted();
}

function siEmptySingle() {
  return { blob: null, focal: { x: 50, y: 50 }, previewUrl: null };
}

function siEmptyData() {
  const singleImages = {};
  SI_SINGLE_FIELDS.forEach((f) => (singleImages[f] = siEmptySingle()));
  // content: phần chữ của thiệp mẫu (04-sample-data.js) — cùng nằm trong
  // data.json của theme, cùng luồng nháp/lưu với ảnh.
  return { singleImages, gallery: [], loveStory: [], content: siContentDefaults() };
}

// data.json hỏng cú pháp là ca nguy hiểm nhất: parse lỗi → tưởng thư mục chưa có
// gì → bấm Lưu là ghi đè mất điểm lấy nét, phần chữ, thứ tự album. Phải phân biệt
// "chưa có file" (bình thường) với "có mà hỏng" (báo động + sao lưu trước khi ghi).
let siJsonBroken = null; // { text, message } khi data.json có nhưng parse lỗi

async function siReadJsonSafe(dirHandle) {
  siJsonBroken = null;
  let text;
  try {
    const fh = await dirHandle.getFileHandle("data.json");
    text = await (await fh.getFile()).text();
  } catch (e) {
    return {}; // chưa có data.json → thư mục mới, không có gì để mất
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    siJsonBroken = { text, message: e.message };
    console.error("data.json hỏng cú pháp:", e.message);
    return {};
  }
}

// Trước khi ghi đè một data.json hỏng, chép nguyên văn ra data.json.bak để còn
// đường lấy lại phần chữ / điểm lấy nét đã gõ.
async function siBackupBrokenJson() {
  if (!siJsonBroken || !siThemeHandle) return false;
  try {
    await siWriteFile(
      siThemeHandle,
      "data.json.bak",
      new Blob([siJsonBroken.text], { type: "text/plain" }),
    );
    return true;
  } catch (e) {
    console.error("Không sao lưu được data.json hỏng:", e);
    return false;
  }
}

// Đọc file thành Blob TRONG BỘ NHỚ: File của File System Access API chỉ là con trỏ
// tới đường dẫn, mà lúc lưu ta ghi đè/đổi tên chính những file đó.
async function siReadAsMemoryFile(dirHandle, filename) {
  if (!filename) return null;
  try {
    const fh = await dirHandle.getFileHandle(filename);
    const file = await fh.getFile();
    const buf = await file.arrayBuffer();
    return new File([buf], filename, {
      type: file.type || siTypeFromName(filename),
    });
  } catch (e) {
    return null;
  }
}

// Nén ngay lúc BIND (ảnh mẫu hay được chép tay vào thư mục, còn nguyên cỡ gốc) để
// mọi blob trong siData đều đã đạt chuẩn và bước lưu chỉ việc ghi.
// Ảnh đạt ngưỡng → giữ nguyên + ghi dấu vết file gốc (srcName/srcSize) cho
// siIsUnchanged() bỏ qua lúc ghi; ảnh vừa nén → bỏ dấu vết vì bản trong RAM không
// còn khớp đĩa. GIF/AVIF/BMP bị canRecompress() loại nên luôn giữ nguyên.
async function siBindImage(dirHandle, filename) {
  const raw = await siReadAsMemoryFile(dirHandle, filename);
  if (!raw) return null;

  try {
    const { file, compressed } = await ImageHelper.prepareImage(raw, SI_IMAGE_LIMITS);
    if (compressed) {
      siLoadCompressed.count++;
      siLoadCompressed.savedBytes += raw.size - file.size;
      return { blob: file, srcName: null, srcSize: 0 };
    }
  } catch (e) {
    // Nén lỗi (ảnh > 50MB, file hỏng…) không được làm hỏng cả lần nạp.
    console.warn("Không nén được ảnh, giữ nguyên bản gốc:", filename, e);
  }

  return { blob: raw, srcName: filename, srcSize: raw.size };
}

function siTypeFromName(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "bmp") return "image/bmp";
  return "image/jpeg";
}

// Danh sách file ảnh thật sự đang nằm trong thư mục theme (đã sort tự nhiên để
// gallery-02 đứng sau gallery-01 chứ không phải gallery-10).
async function siListImageFiles(dirHandle) {
  const names = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && SI_IMAGE_EXT_RE.test(name)) names.push(name);
  }
  return names.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function siRevokePreviews() {
  if (!siData) return;
  const urls = [
    ...Object.values(siData.singleImages).map((e) => e.previewUrl),
    ...siData.gallery.map((i) => i.previewUrl),
    ...siData.loveStory.map((i) => i.previewUrl),
  ];
  urls.forEach((u) => u && URL.revokeObjectURL(u));
}

/**
 * Nạp dữ liệu của theme đang chọn: QUÉT thư mục rồi bind mọi ảnh tìm được.
 * data.json chỉ là nguồn METADATA (điểm lấy nét, nội dung mốc yêu) và thứ tự ưu
 * tiên; file ảnh lấy theo những gì thực sự có trên đĩa.
 * @returns {Promise<number>} số ảnh đã bind từ đĩa
 */
async function siLoadThemeData() {
  siRevokePreviews();
  siData = siEmptyData();
  siSuspendDraft = true;
  siLoadCompressed.count = 0;
  siLoadCompressed.savedBytes = 0;

  try {
    const json = await siReadJsonSafe(siThemeHandle);
    siData.content = siNormalizeContent(json.content);
    const diskNames = await siListImageFiles(siThemeHandle);
    const used = new Set();

    // Nhận tên file (ưu tiên tên ghi trong data.json, không có/không khớp thì
    // dò theo quy ước đặt tên) và đánh dấu đã dùng để không bind trùng.
    const claim = (jsonName, matcher) => {
      let name =
        jsonName && diskNames.includes(jsonName) && !used.has(jsonName)
          ? jsonName
          : matcher
            ? diskNames.find((n) => !used.has(n) && matcher(n))
            : null;
      if (!name) return null;
      used.add(name);
      return name;
    };

    // --- Ảnh đơn: cover.* / groom.* / bride.* / groom-qr.* / bride-qr.* ---
    for (const field of SI_SINGLE_FIELDS) {
      const prefix = SI_FIELD_BASENAME[field] + ".";
      const name = claim(json[field], (n) =>
        n.toLowerCase().startsWith(prefix),
      );
      if (!name) continue;
      const bound = await siBindImage(siThemeHandle, name);
      if (!bound) continue;
      siData.singleImages[field] = {
        ...bound,
        focal: json.image_focal_points?.[field] || { x: 50, y: 50 },
        previewUrl: URL.createObjectURL(bound.blob),
      };
    }

    // --- Câu chuyện tình yêu: text từ data.json, ảnh theo love-story-NN.* ---
    const loveStoryArr = Array.isArray(json.love_story) ? json.love_story : [];
    const lsPlan = loveStoryArr.slice(0, SI_MAX_LOVE_STORY).map((item, i) => ({
      date: item.date || "",
      title: item.title || "",
      content: item.content || "",
      focal: item.focal_point || { x: 50, y: 50 },
      name: claim(item.image_url, (n) =>
        n.toLowerCase().startsWith(`love-story-${String(i + 1).padStart(2, "0")}.`),
      ),
    }));
    // Ảnh love-story-* có trên đĩa nhưng data.json chưa khai → thêm mốc trống
    diskNames
      .filter((n) => !used.has(n) && /^love-story-\d+\./i.test(n))
      .forEach((n) => {
        if (lsPlan.length >= SI_MAX_LOVE_STORY) return;
        used.add(n);
        lsPlan.push({
          date: "",
          title: "",
          content: "",
          focal: { x: 50, y: 50 },
          name: n,
        });
      });

    // --- Album ảnh: data.json trước, rồi gallery-NN.* còn sót, cuối cùng là
    // ảnh tên lạ (chép tay vào thư mục) — lưu lại sẽ được đổi về gallery-NN ---
    const galleryPlan = (
      Array.isArray(json.gallery_images) ? json.gallery_images : []
    )
      .map((n) => claim(n, null))
      .filter(Boolean);
    diskNames
      .filter((n) => !used.has(n) && /^gallery-\d+\./i.test(n))
      .forEach((n) => {
        if (galleryPlan.length >= SI_MAX_GALLERY) return;
        used.add(n);
        galleryPlan.push(n);
      });
    const strays = diskNames.filter((n) => !used.has(n));
    strays.forEach((n) => {
      if (galleryPlan.length >= SI_MAX_GALLERY) return;
      used.add(n);
      galleryPlan.push(n);
    });

    for (const name of galleryPlan.slice(0, SI_MAX_GALLERY)) {
      const bound = await siBindImage(siThemeHandle, name);
      if (!bound) continue;
      siData.gallery.push({
        ...bound,
        focal: json.image_focal_points?.gallery_images?.[name] || {
          x: 50,
          y: 50,
        },
        previewUrl: URL.createObjectURL(bound.blob),
      });
    }

    for (const item of lsPlan) {
      const bound = await siBindImage(siThemeHandle, item.name);
      siData.loveStory.push({
        date: item.date,
        title: item.title,
        content: item.content,
        blob: bound ? bound.blob : null,
        focal: item.focal,
        previewUrl: bound ? URL.createObjectURL(bound.blob) : null,
        srcName: bound ? bound.srcName : null,
        srcSize: bound ? bound.srcSize : 0,
      });
    }

    if (siJsonBroken) {
      showToast(
        `data.json LỖI CÚ PHÁP (${siJsonBroken.message}) — điểm lấy nét và phần chữ KHÔNG nạp được. Sửa file rồi chọn lại theme; bấm Lưu bây giờ sẽ ghi đè bằng giá trị mặc định.`,
        "error",
      );
    }

    const skipped = strays.length - strays.filter((n) => used.has(n)).length;
    if (skipped > 0) {
      showToast(`${skipped} ảnh trong thư mục bị bỏ qua (vượt giới hạn)`, "warning");
    }

    if (siLoadCompressed.count > 0) {
      showToast(
        `Đã nén ${siLoadCompressed.count} ảnh quá khổ trong thư mục (giảm ${siFormatMB(siLoadCompressed.savedBytes)}) — bấm Lưu để ghi đè xuống đĩa`,
        "warning",
      );
    }

    siRenderAll();
    return used.size;
  } finally {
    siSuspendDraft = false;
  }
}

function siRenderAll() {
  SI_SINGLE_FIELDS.forEach(siRenderSingleImage);
  siRenderGallery();
  siRenderLoveStory();
  siRenderContentForm();
  siRenderTimeline();
}

// ============= Bản nháp: giữ ảnh đang nhập qua F5 =============
// siData chứa Blob nên localStorage không lưu được → mỗi theme một bản nháp
// trong IndexedDB. Ghi sau mỗi thay đổi (debounce), xoá khi lưu ra đĩa xong.

let siDraftTimer = null;
let siSuspendDraft = false; // đang nạp dữ liệu → đừng ghi đè nháp
let siDirty = false; // có thay đổi chưa ghi ra đĩa

// immediate=true cho thay đổi ảnh (ít khi xảy ra, nhưng F5 ngay sau đó là mất
// công up lại); gõ chữ thì debounce cho đỡ ghi IDB liên tục.
function siMarkDirty(immediate = false) {
  if (siSuspendDraft || !siCurrentTheme || !siData) return;
  siSetDirtyIndicator(true);
  clearTimeout(siDraftTimer);
  siDraftTimer = null;
  if (immediate) {
    siSaveDraft();
    return;
  }
  siDraftTimer = setTimeout(() => {
    siDraftTimer = null;
    siSaveDraft();
  }, 800);
}

// Ghi nốt nháp còn treo — gọi trước khi đổi theme (siCurrentTheme sắp đổi,
// nếu để timer tự chạy thì nháp của theme cũ bị ghi nhầm sang key theme mới).
async function siFlushDraft() {
  if (!siDraftTimer) return;
  clearTimeout(siDraftTimer);
  siDraftTimer = null;
  await siSaveDraft();
}

// Đóng tab / F5 lúc timer còn treo → ghi luôn phần chữ vừa gõ (ảnh thì đã ghi
// ngay từ lúc chọn nên không phụ thuộc lần ghi này).
window.addEventListener("pagehide", () => {
  if (siDraftTimer) {
    clearTimeout(siDraftTimer);
    siDraftTimer = null;
    siSaveDraft();
  }
});

function siSetDirtyIndicator(on) {
  siDirty = on;
  document.getElementById("si-dirty-status")?.classList.toggle("hidden", !on);
}

function siShowDraftBanner(updatedAt) {
  const banner = document.getElementById("si-draft-banner");
  if (!banner) return;
  if (!updatedAt) {
    banner.classList.add("hidden");
    return;
  }
  document.getElementById("si-draft-banner-text").textContent =
    `Đã khôi phục bản nháp lúc ${new Date(updatedAt).toLocaleString("vi-VN")} — nội dung này CHƯA được ghi vào thư mục theme.`;
  banner.classList.remove("hidden");
}

async function siSaveDraft() {
  if (!siCurrentTheme || !siData) return;
  const singleImages = {};
  SI_SINGLE_FIELDS.forEach((f) => {
    const entry = siData.singleImages[f];
    singleImages[f] = {
      blob: entry.blob,
      focal: entry.focal,
      srcName: entry.srcName || null,
      srcSize: entry.srcSize || 0,
    };
  });
  const draft = {
    theme: siCurrentTheme,
    updatedAt: Date.now(),
    content: siData.content,
    singleImages,
    gallery: siData.gallery.map((i) => ({
      blob: i.blob,
      focal: i.focal,
      srcName: i.srcName || null,
      srcSize: i.srcSize || 0,
    })),
    loveStory: siData.loveStory.map((i) => ({
      date: i.date,
      title: i.title,
      content: i.content,
      blob: i.blob,
      focal: i.focal,
      srcName: i.srcName || null,
      srcSize: i.srcSize || 0,
    })),
  };
  try {
    await siIdbPut(SI_IDB_DRAFT_STORE, siCurrentTheme, draft);
  } catch (e) {
    console.warn("Không lưu được bản nháp:", e);
  }
}

// Blob URL không sống qua reload nên phải tạo lại từ blob trong nháp.
function siApplyDraft(draft) {
  siRevokePreviews();
  siSuspendDraft = true;
  try {
    const toEntry = (o) => ({
      blob: o?.blob || null,
      focal: o?.focal || { x: 50, y: 50 },
      previewUrl: o?.blob ? URL.createObjectURL(o.blob) : null,
      srcName: o?.srcName || null,
      srcSize: o?.srcSize || 0,
    });
    siData = siEmptyData();
    siData.content = siNormalizeContent(draft.content);
    SI_SINGLE_FIELDS.forEach((f) => {
      if (draft.singleImages?.[f]) {
        siData.singleImages[f] = toEntry(draft.singleImages[f]);
      }
    });
    siData.gallery = (draft.gallery || [])
      .filter((o) => o.blob)
      .map(toEntry);
    siData.loveStory = (draft.loveStory || []).map((o) => ({
      date: o.date || "",
      title: o.title || "",
      content: o.content || "",
      ...toEntry(o),
    }));
    siRenderAll();
  } finally {
    siSuspendDraft = false;
  }
}

async function siDiscardDraft() {
  if (!siCurrentTheme) return;
  if (!confirm("Bỏ bản nháp và tải lại ảnh đang có trong thư mục theme?")) return;
  clearTimeout(siDraftTimer);
  showLoading(true, "Đang tải lại...");
  try {
    await siIdbDelete(SI_IDB_DRAFT_STORE, siCurrentTheme);
    await siLoadThemeData();
    siShowDraftBanner(null);
    siSetDirtyIndicator(false);
    showToast("Đã bỏ bản nháp", "success");
  } catch (e) {
    console.error(e);
    showToast("Lỗi tải lại: " + e.message, "error");
  } finally {
    showLoading(false);
  }
}

// Bản cục bộ: trang admin không nạp core/utils.js nên không dùng được bản chung.
// Giữ đồng bộ với escapeHtml() trong core/utils.js (escape đủ 5 ký tự).
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============= Ảnh đơn (cover / groom / bride / QR) =============

function siRenderSingleImage(fieldName) {
  const container = document.getElementById(`si-${fieldName}-container`);
  if (!container) return;

  const entry = siData.singleImages[fieldName];
  const isFocal = SI_FOCAL_POINT_FIELDS.includes(fieldName);
  const isCrop = SI_CROP_FIELDS.includes(fieldName);
  const sizeClass =
    fieldName === "cover_image_url" ? "aspect-[3/4]" : "aspect-square";
  const fpStyle = isFocal
    ? ` style="object-position: ${entry.focal.x}% ${entry.focal.y}%"`
    : "";

  if (entry.previewUrl) {
    const adjustBtn = isCrop
      ? `<x-button variant="overlay" size="xs" icon-only type="button" onclick="siRecropSingle('${fieldName}')" title="Cắt lại ảnh" class="absolute bottom-1 right-1"><i data-icon="crop" class="text-xs"></i></x-button>`
      : isFocal
        ? `<x-button variant="overlay" size="xs" icon-only type="button" onclick="siAdjustSingleFocal('${fieldName}')" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1"><i data-icon="crosshair" class="text-xs"></i></x-button>`
        : "";
    container.innerHTML = `
      <div class="relative ${sizeClass} rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100">
        <img src="${entry.previewUrl}" class="w-full h-full object-cover"${fpStyle} />
        ${adjustBtn}
        <x-button tone="danger" size="xs" icon-only type="button" onclick="siRemoveSingle('${fieldName}')" class="absolute top-1 right-1">
          <i data-icon="x" class="text-xs text-white"></i>
        </x-button>
      </div>`;
  } else {
    container.innerHTML = `
      <x-button variant="outline" size="sm" type="button" onclick="document.getElementById('si-${fieldName}-file-input').click()">
        <i data-icon="image" class="text-xs"></i> Chọn ảnh
      </x-button>`;
  }
}

async function siHandleSingleUpload(event, fieldName) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Chỉ chấp nhận file ảnh!", "error");
    return;
  }

  if (SI_CROP_FIELDS.includes(fieldName)) {
    openImageCropModal(file, (blob) => siStoreCropped(fieldName, blob));
    return;
  }

  const current = siData.singleImages[fieldName].focal;
  openFocalPointPicker(file, current, async (focal) => {
    showLoading(true, "Đang xử lý ảnh...");
    try {
      const { file: processed } = await ImageHelper.prepareImage(file, SI_IMAGE_LIMITS);
      siData.singleImages[fieldName] = {
        blob: processed,
        focal,
        previewUrl: URL.createObjectURL(processed),
      };
      siRenderSingleImage(fieldName);
      siMarkDirty(true);
    } catch (e) {
      showToast("Lỗi xử lý ảnh: " + e.message, "error");
    } finally {
      showLoading(false);
    }
  });
}

function siAdjustSingleFocal(fieldName) {
  const entry = siData.singleImages[fieldName];
  if (!entry.previewUrl) return;
  openFocalPointPicker(entry.previewUrl, entry.focal, (focal) => {
    entry.focal = focal;
    siRenderSingleImage(fieldName);
    siMarkDirty(true);
    showToast("Đã cập nhật điểm lấy nét", "success");
  });
}

// Ảnh vừa cắt xong (QR) → vào state. Cắt lần đầu và cắt lại đều đi qua đây để
// chỉ có MỘT chỗ quyết định ảnh được nén thế nào.
async function siStoreCropped(fieldName, blob) {
  if (!blob) return;
  const cropped = new File([blob], "cropped.png", { type: "image/png" });
  // Đi qua prepareImage như mọi ảnh khác cho đồng nhất. Ảnh cắt ra đã 800x800
  // nên hầu như luôn đạt ngưỡng → trả nguyên bản, không mã hoá lại.
  let processed = cropped;
  try {
    processed = (await ImageHelper.prepareImage(cropped, SI_IMAGE_LIMITS)).file;
  } catch (e) {
    console.warn("Không nén được ảnh cắt, giữ nguyên bản gốc:", e);
  }
  siData.singleImages[fieldName] = {
    blob: processed,
    focal: { x: 50, y: 50 },
    previewUrl: URL.createObjectURL(processed),
  };
  siRenderSingleImage(fieldName);
  siMarkDirty(true);
}

function siRecropSingle(fieldName) {
  const entry = siData.singleImages[fieldName];
  if (!entry.blob) return;
  openImageCropModal(entry.blob, (blob) => siStoreCropped(fieldName, blob));
}

function siRemoveSingle(fieldName) {
  siData.singleImages[fieldName] = siEmptySingle();
  siRenderSingleImage(fieldName);
  siMarkDirty(true);
}

// ============= Album ảnh (gallery) =============

function siRenderGallery() {
  const container = document.getElementById("si-gallery-container");
  container.innerHTML = "";

  siData.gallery.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className =
      "relative aspect-square rounded-xl overflow-hidden border border-rose-200 shadow-sm group bg-gray-100";
    div.innerHTML = `
      <img src="${item.previewUrl}" class="w-full h-full object-cover" style="object-position: ${item.focal.x}% ${item.focal.y}%" />
      <x-button variant="overlay" size="xs" icon-only type="button" onclick="siAdjustGalleryFocal(${idx})" title="Chỉnh điểm lấy nét" class="absolute bottom-1 right-1">
        <i data-icon="crosshair" class="text-xs"></i>
      </x-button>
      <x-button tone="danger" size="xs" icon-only type="button" onclick="siRemoveGalleryImage(${idx})" class="absolute top-1 right-1">
        <i data-icon="x" class="text-xs text-white"></i>
      </x-button>
    `;
    container.appendChild(div);
  });

  document.getElementById("si-gallery-count").textContent =
    `${siData.gallery.length}/${SI_MAX_GALLERY}`;

  document.getElementById("si-gallery-add-btn")?.remove();
  if (siData.gallery.length < SI_MAX_GALLERY) {
    const btn = document.createElement("button");
    btn.id = "si-gallery-add-btn";
    btn.type = "button";
    btn.className =
      "mt-2 flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-rose-300 text-xs text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer";
    btn.innerHTML = `<i data-icon="image" class="text-xs"></i> Thêm ảnh`;
    btn.onclick = () =>
      document.getElementById("si-gallery-file-input").click();
    container.insertAdjacentElement("afterend", btn);
  }
}

async function siHandleGalleryUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  const room = SI_MAX_GALLERY - siData.gallery.length;
  if (room <= 0) {
    showToast(`Tối đa ${SI_MAX_GALLERY} ảnh`, "warning");
    return;
  }

  showLoading(true, "Đang xử lý ảnh...");
  try {
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) continue;
      const { file: processed } = await ImageHelper.prepareImage(file, SI_IMAGE_LIMITS);
      siData.gallery.push({
        blob: processed,
        focal: { x: 50, y: 50 },
        previewUrl: URL.createObjectURL(processed),
      });
    }
  } catch (e) {
    showToast("Lỗi xử lý ảnh: " + e.message, "error");
  } finally {
    showLoading(false);
  }
  siRenderGallery();
  siMarkDirty(true);
}

function siAdjustGalleryFocal(idx) {
  const item = siData.gallery[idx];
  if (!item) return;
  openFocalPointPicker(item.previewUrl, item.focal, (focal) => {
    item.focal = focal;
    siRenderGallery();
    siMarkDirty(true);
    showToast("Đã cập nhật điểm lấy nét", "success");
  });
}

function siRemoveGalleryImage(idx) {
  siData.gallery.splice(idx, 1);
  siRenderGallery();
  siMarkDirty(true);
}

// ============= Câu chuyện tình yêu =============

function siRenderLoveStory() {
  const list = document.getElementById("si-love-story-list");
  list.innerHTML = "";

  siData.loveStory.forEach((item, idx) => {
    const fpStyle = item.previewUrl
      ? ` style="object-position: ${item.focal.x}% ${item.focal.y}%"`
      : "";
    const div = document.createElement("div");
    div.className = "p-4 border border-gray-200 rounded-xl space-y-2 bg-rose-50/40";
    div.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span id="si-ls-label-${idx}" class="text-xs font-medium text-rose-400">${escapeHtml(item.title) || `Mốc ${idx + 1}`}</span>
        <x-button variant="ghost" tone="danger" size="sm" type="button" onclick="siRemoveLoveStoryItem(${idx})">
          <i data-icon="trash-2"></i> Xóa
        </x-button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="text" value="${escapeHtml(item.date)}" placeholder="Ví dụ: Mùa xuân năm 2020"
          class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300"
          oninput="siData.loveStory[${idx}].date=this.value;siMarkDirty();" />
        <input type="text" value="${escapeHtml(item.title)}" placeholder="Ví dụ: Lần đầu gặp gỡ"
          class="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-rose-300"
          oninput="siData.loveStory[${idx}].title=this.value;siMarkDirty();const lb=document.getElementById('si-ls-label-${idx}');if(lb)lb.textContent=this.value||'Mốc ${idx + 1}';" />
      </div>
      <textarea rows="2" placeholder="Nội dung..."
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-rose-300"
        oninput="siData.loveStory[${idx}].content=this.value;siMarkDirty();">${escapeHtml(item.content)}</textarea>
      <div class="flex items-center gap-2">
        <input type="file" id="si-ls-file-input-${idx}" accept="image/*" class="hidden" onchange="siHandleLoveStoryUpload(event, ${idx})" />
        ${
          item.previewUrl
            ? `<div class="relative w-16 h-16 rounded-xl overflow-hidden border border-rose-200 flex-shrink-0">
                <img src="${item.previewUrl}" class="w-full h-full object-cover"${fpStyle} />
                <x-button variant="overlay" size="xs" icon-only type="button" onclick="siAdjustLoveStoryFocal(${idx})" title="Chỉnh điểm lấy nét" class="absolute bottom-0.5 right-0.5">
                  <i data-icon="crosshair" style="font-size:10px"></i>
                </x-button>
                <x-button variant="overlay" tone="danger" size="xs" icon-only type="button" onclick="siRemoveLoveStoryImage(${idx})" class="absolute top-0.5 right-0.5">
                  <i data-icon="x" style="font-size:10px"></i>
                </x-button>
              </div>`
            : `<x-button variant="outline" size="sm" type="button" onclick="document.getElementById('si-ls-file-input-${idx}').click()">
                <i data-icon="image"></i> Thêm ảnh
              </x-button>`
        }
      </div>
    `;
    list.appendChild(div);
  });

  document.getElementById("si-love-story-count").textContent =
    `${siData.loveStory.length}/${SI_MAX_LOVE_STORY}`;
}

function siAddLoveStoryItem() {
  if (siData.loveStory.length >= SI_MAX_LOVE_STORY) {
    showToast(`Tối đa ${SI_MAX_LOVE_STORY} mốc`, "warning");
    return;
  }
  siData.loveStory.push({
    date: "",
    title: "",
    content: "",
    blob: null,
    focal: { x: 50, y: 50 },
    previewUrl: null,
  });
  siRenderLoveStory();
  siMarkDirty(true);
}

function siRemoveLoveStoryItem(idx) {
  siData.loveStory.splice(idx, 1);
  siRenderLoveStory();
  siMarkDirty(true);
}

async function siHandleLoveStoryUpload(event, idx) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Chỉ chấp nhận file ảnh!", "error");
    return;
  }

  const current = siData.loveStory[idx].focal;
  openFocalPointPicker(file, current, async (focal) => {
    showLoading(true, "Đang xử lý ảnh...");
    try {
      const { file: processed } = await ImageHelper.prepareImage(file, SI_IMAGE_LIMITS);
      siData.loveStory[idx].blob = processed;
      siData.loveStory[idx].focal = focal;
      siData.loveStory[idx].previewUrl = URL.createObjectURL(processed);
      siRenderLoveStory();
      siMarkDirty(true);
    } catch (e) {
      showToast("Lỗi xử lý ảnh: " + e.message, "error");
    } finally {
      showLoading(false);
    }
  });
}

function siAdjustLoveStoryFocal(idx) {
  const item = siData.loveStory[idx];
  if (!item.previewUrl) return;
  openFocalPointPicker(item.previewUrl, item.focal, (focal) => {
    item.focal = focal;
    siRenderLoveStory();
    siMarkDirty(true);
  });
}

function siRemoveLoveStoryImage(idx) {
  siData.loveStory[idx].blob = null;
  siData.loveStory[idx].previewUrl = null;
  siData.loveStory[idx].focal = { x: 50, y: 50 };
  siRenderLoveStory();
  siMarkDirty(true);
}

// ============= Lưu vào ổ đĩa =============

// Dò scan server (scripts/server.js) có đang bật không: nó chỉ phục vụ /scan,
// path khác trả 404 nhưng vẫn kèm CORS header → fetch resolve là server sống.
async function siScanServerUp(timeoutMs = 1500) {
  try {
    await fetch(`${SCAN_SERVER}/ping`, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch (e) {
    return false;
  }
}

async function siWriteFile(dirHandle, filename, blob) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
}

// Ảnh đọc lên từ chính thư mục này, chưa đổi gì và vẫn giữ nguyên tên file →
// khỏi ghi lại. Bộ ảnh mẫu nặng ~35 MB nên nếu lần lưu nào cũng chép lại tất
// thì vừa lâu vừa dễ hỏng giữa chừng (mất luôn data.json ghi ở bước cuối).
async function siIsUnchanged(entry, filename) {
  // Đường nhanh, không đụng đĩa: blob đọc lên từ chính file đó, chưa ai thay.
  if (entry.srcName === filename && entry.srcSize === entry.blob.size) return true;

  // Không có dấu vết thì đối chiếu thẳng với file trên đĩa. Bản nháp trong
  // IndexedDB không mang srcName của ảnh vừa ghi ở lần lưu bị cắt ngang, thiếu
  // nhánh này thì mỗi lần lưu tiếp lại chép lại cả vài chục MB.
  try {
    const file = await (await siThemeHandle.getFileHandle(filename)).getFile();
    if (file.size !== entry.blob.size) return false;
    return await siSameBytes(file, entry.blob);
  } catch (e) {
    return false; // chưa có file trên đĩa → cứ ghi
  }
}

// So từng byte chứ không chỉ so kích thước: hai ảnh khác nhau vẫn có thể trùng
// số byte, bỏ qua nhầm thì ảnh mới không bao giờ xuống đĩa. Đọc nhanh hơn ghi
// nhiều lần nên vẫn lời.
async function siSameBytes(fileA, blobB) {
  const [a, b] = await Promise.all([fileA.arrayBuffer(), blobB.arrayBuffer()]);
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
  return true;
}

// Ghi 1 ảnh, kèm tiến độ. Lỗi được bọc lại cho biết CHẾT Ở FILE NÀO — trước đây
// chỉ nhận được message trống rỗng của DOMException, không lần ra được.
async function siWriteImage(entry, filename, progress) {
  if (await siIsUnchanged(entry, filename)) {
    progress(filename, true);
    return;
  }
  progress(filename, false);
  try {
    await siWriteFile(siThemeHandle, filename, entry.blob);
  } catch (e) {
    throw new Error(`ghi "${filename}" thất bại — ${e.name || "Lỗi"}: ${e.message}`);
  }
  entry.srcName = filename;
  entry.srcSize = entry.blob.size;
}

function siFormatMB(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// ============= Lưu dở dang → tự ghi tiếp =============

function siReadResumeState() {
  try {
    const raw = localStorage.getItem(SI_RESUME_KEY);
    const st = raw ? JSON.parse(raw) : null;
    return st && typeof st.theme === "string" ? st : null;
  } catch (e) {
    return null;
  }
}

// Đặt cờ TRƯỚC khi động vào đĩa. Giữ nguyên số vòng đã nối tiếp (siResumeSave
// đã tăng sẵn), lượt lưu tay bình thường thì không có cờ cũ nên về 0.
function siMarkSaveStarted() {
  const prev = siReadResumeState();
  const attempts = prev && prev.theme === siCurrentTheme ? prev.attempts || 0 : 0;
  try {
    localStorage.setItem(
      SI_RESUME_KEY,
      JSON.stringify({ theme: siCurrentTheme, attempts }),
    );
  } catch (e) {}
}

function siClearSaveFlag() {
  try {
    localStorage.removeItem(SI_RESUME_KEY);
  } catch (e) {}
}

// Gọi sau khi theme đã nạp xong (kể cả từ bản nháp): thấy cờ còn sót nghĩa là
// lần lưu trước chết giữa chừng → ghi tiếp. Ảnh nào đã đúng trên đĩa sẽ được
// siIsUnchanged() bỏ qua nên mỗi vòng chỉ ghi phần còn thiếu, vài vòng là xong.
async function siResumeSaveIfInterrupted() {
  const st = siReadResumeState();
  if (!st || st.theme !== siCurrentTheme || !siThemeHandle) return;

  const attempts = (st.attempts || 0) + 1;
  if (attempts > SI_MAX_RESUME) {
    siClearSaveFlag();
    showToast(
      `Lần lưu trước bị cắt ngang ${SI_MAX_RESUME} lần liên tiếp — hãy bấm "Lưu vào ổ đĩa" và xem console`,
      "warning",
    );
    return;
  }

  try {
    localStorage.setItem(
      SI_RESUME_KEY,
      JSON.stringify({ theme: siCurrentTheme, attempts }),
    );
  } catch (e) {}

  showToast(`Lần lưu trước chưa xong — đang ghi tiếp (vòng ${attempts}/${SI_MAX_RESUME})`, "default", "hourglass");
  await saveSampleImages({ scan: false });
}

// Ghi RIÊNG phần chữ vào data.json, giữ nguyên tham chiếu ảnh đang có trên
// đĩa. Dùng ở 2 chỗ: đầu lần lưu (để chữ an toàn ngay, không phải chờ ghi xong
// vài chục MB ảnh) và ở nhánh lỗi (ảnh đứt giữa chừng thì chữ vẫn còn).
async function siWriteContentOnly() {
  if (!siThemeHandle || !siData?.content) return false;
  try {
    const old = await siReadJsonSafe(siThemeHandle);
    old.content = siCollectContent();
    if (siData.loveStory.length) {
      const oldLs = Array.isArray(old.love_story) ? old.love_story : [];
      old.love_story = siData.loveStory.map((item, i) => {
        const entry = { date: item.date, title: item.title, content: item.content };
        if (oldLs[i]?.image_url) {
          entry.image_url = oldLs[i].image_url;
          entry.focal_point = oldLs[i].focal_point;
        }
        return entry;
      });
    }
    old.updated_at = new Date().toISOString();
    await siWriteFile(
      siThemeHandle,
      "data.json",
      new Blob([JSON.stringify(old, null, 2)], { type: "application/json" }),
    );
    return true;
  } catch (e) {
    console.error("Không cứu được phần chữ:", e);
    return false;
  }
}

function siExtFromBlob(blob, fallback) {
  const type = blob.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return fallback;
}

// Ghi đè toàn bộ: mọi FILE ẢNH trong thư mục theme không nằm trong bộ vừa ghi
// đều bị xoá (ảnh đổi đuôi, ảnh chép tay, ảnh thừa sau khi bớt album...). File
// không phải ảnh (data.json, README...) giữ nguyên.
async function siWipeOtherImages(dirHandle, keepFiles) {
  const toDelete = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "file") continue;
    if (keepFiles.has(name) || !SI_IMAGE_EXT_RE.test(name)) continue;
    toDelete.push(name);
  }
  for (const name of toDelete) {
    try {
      await dirHandle.removeEntry(name);
    } catch (e) {
      console.warn("Không xoá được file ảnh cũ:", name, e);
    }
  }
  return toDelete.length;
}

// scan: chỉ true khi người dùng TỰ bấm "Lưu vào ổ đĩa" (nút không truyền tham
// số). Nhánh ghi tiếp tự động truyền false — đừng hỏi han lúc người ta chỉ vừa
// chọn theme, cũng đừng bật modal scan mà họ không hề bấm gì.
async function saveSampleImages({ scan = true } = {}) {
  if (!siThemeHandle || !siCurrentTheme) {
    showToast("Chưa chọn theme hoặc chưa kết nối thư mục", "error");
    return;
  }

  // Hỏi NGAY ĐẦU, trước khi chạm vào đĩa. Báo ở cuối thì vô dụng: lúc đó ảnh đã
  // ghi ra, Live Server thấy file mới là reload trang, popup biến mất trước khi
  // đọc kịp. Ở đây chưa file nào đổi nên trang còn đứng yên.
  if (scan && !(await siScanServerUp())) {
    if (!(await showScanServerHelp())) return;
    scan = false;
  }

  // File hỏng mà vẫn muốn lưu → giữ lại nguyên văn bản cũ đã, đừng ghi đè mất.
  const backedUp = await siBackupBrokenJson();

  const btn = document.getElementById("si-save-btn");
  btn.disabled = true;
  siMarkSaveStarted();
  showLoading(true, "Đang lưu phần chữ...");

  try {
    // Ghi phần CHỮ TRƯỚC (nhẹ, gõ tay mất công nhất) kèm tham chiếu ảnh cũ, để
    // ảnh nặng ghi đứt giữa chừng không kéo chữ chết theo. Cuối hàm data.json
    // được ghi đè lại lần nữa với tên ảnh chuẩn.
    await siWriteContentOnly();

    // Ảnh trong siData đã được nén sẵn lúc chọn/lúc bind từ đĩa (siBindImage) →
    // ở đây chỉ ghi thẳng, không đụng canvas nữa.
    const json = { image_focal_points: { gallery_images: {} } };
    const keepFiles = new Set(["data.json"]);

    // Tiến độ: bộ ảnh mẫu cỡ vài chục MB, ghi hết mất cả phút. Không hiện gì
    // thì dễ tưởng treo rồi F5 giữa chừng — mà F5 lúc đó là mất data.json.
    const total =
      SI_SINGLE_FIELDS.filter((f) => siData.singleImages[f].blob).length +
      siData.gallery.length +
      siData.loveStory.filter((i) => i.blob).length;
    let done = 0;
    let skipped = 0;
    const progress = (filename, unchanged) => {
      done++;
      if (unchanged) skipped++;
      showLoading(
        true,
        `Đang lưu ảnh ${done}/${total} — ${unchanged ? "giữ nguyên" : "ghi"} ${filename}`,
      );
    };

    for (const field of SI_SINGLE_FIELDS) {
      const entry = siData.singleImages[field];
      if (!entry.blob) continue;
      const isCrop = SI_CROP_FIELDS.includes(field);
      const ext = isCrop ? "png" : siExtFromBlob(entry.blob, "jpg");
      const filename = `${SI_FIELD_BASENAME[field]}.${ext}`;
      await siWriteImage(entry, filename, progress);
      keepFiles.add(filename);
      json[field] = filename;
      if (SI_FOCAL_POINT_FIELDS.includes(field)) {
        json.image_focal_points[field] = entry.focal;
      }
    }

    const galleryNames = [];
    for (let i = 0; i < siData.gallery.length; i++) {
      const item = siData.gallery[i];
      const ext = siExtFromBlob(item.blob, "jpg");
      const filename = `gallery-${String(i + 1).padStart(2, "0")}.${ext}`;
      await siWriteImage(item, filename, progress);
      keepFiles.add(filename);
      galleryNames.push(filename);
      json.image_focal_points.gallery_images[filename] = item.focal;
    }
    if (galleryNames.length) json.gallery_images = galleryNames;

    const loveStoryOut = [];
    for (let i = 0; i < siData.loveStory.length; i++) {
      const item = siData.loveStory[i];
      const entry = { date: item.date, title: item.title, content: item.content };
      if (item.blob) {
        const ext = siExtFromBlob(item.blob, "jpg");
        const filename = `love-story-${String(i + 1).padStart(2, "0")}.${ext}`;
        await siWriteImage(item, filename, progress);
        keepFiles.add(filename);
        entry.image_url = filename;
        entry.focal_point = item.focal;
      }
      loveStoryOut.push(entry);
    }
    if (loveStoryOut.length) json.love_story = loveStoryOut;

    showLoading(true, "Đang ghi data.json...");

    // Phần chữ của thiệp mẫu (tên, ngày giờ, địa điểm, lịch trình…).
    json.content = siCollectContent();

    // Xoá ảnh cũ TRƯỚC khi ghi JSON, để nếu lỗi giữa chừng thì data.json cũ
    // vẫn trỏ tới đúng bộ ảnh còn nguyên vẹn.
    const removed = await siWipeOtherImages(siThemeHandle, keepFiles);

    json.updated_at = new Date().toISOString();
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    await siWriteFile(siThemeHandle, "data.json", jsonBlob);

    // Lưu xong → bản nháp hết vai trò; đọc lại từ đĩa để state khớp đúng
    // những gì đang nằm trong thư mục (tên file đã được đánh số lại).
    clearTimeout(siDraftTimer);
    await siIdbDelete(SI_IDB_DRAFT_STORE, siCurrentTheme).catch(() => {});
    await siLoadThemeData();
    siShowDraftBanner(null);
    siSetDirtyIndicator(false);

    showToast(
      `Đã lưu dữ liệu mẫu cho theme ${siCurrentTheme}` +
        (backedUp ? " (bản data.json hỏng đã chép sang data.json.bak)" : "") +
        (skipped ? ` (${skipped} ảnh không đổi nên giữ nguyên)` : "") +
        (removed ? ` (đã xoá ${removed} ảnh cũ)` : ""),
      "success",
    );

    // Ảnh demo vừa đổi → chụp lại thumbnail preview của template này (dùng
    // chung "Scan Image IFrame" ở tab Templates, xem 02-templates.js).
    if (scan && typeof startScanImages === "function") {
      startScanImages([siCurrentTheme]);
    }
  } catch (e) {
    console.error(e);
    // Ảnh chết giữa chừng → data.json chưa ghi. Đừng để mất luôn phần chữ.
    const rescued = await siWriteContentOnly();
    showToast(
      "Lỗi lưu: " +
        e.message +
        (rescued ? " — đã kịp giữ phần chữ vào data.json" : ""),
      "error",
    );
  } finally {
    // Chạy cho cả thành công lẫn lỗi ĐÃ BÁO. Trang chết ngang thì finally
    // không chạy → cờ ở lại để lần mở sau ghi tiếp.
    siClearSaveFlag();
    btn.disabled = false;
    showLoading(false);
  }
}

function siPreviewTheme() {
  if (!siCurrentTheme) {
    showToast("Hãy chọn theme trước", "warning");
    return;
  }
  // Trang xem thử fetch assets/data-template/<theme>/ → chỉ thấy ảnh đã ghi.
  if (siDirty) {
    showToast("Có thay đổi chưa lưu — bản xem thử vẫn là ảnh cũ trên đĩa", "warning");
  }
  window.open(
    `../public/themes/${siCurrentTheme}/index.html?preview=true`,
    "_blank",
  );
}
