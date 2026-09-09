// ============= TAB "Ảnh nền": tải ảnh lên + chọn điểm nhìn =============
// Nền là file ảnh tĩnh trong repo, KHÔNG phải dữ liệu trong DB → ghi xong phải
// commit & push mới lên production.
//
// Luồng: chọn ảnh từ máy → nén thành WebP → xem trước ở nhiều khổ màn → đặt
// điểm nhìn → ghi xuống đĩa + cập nhật manifest.
//
// Quy ước:
// 1. Một "nền" = MỘT BỘ nhiều biến thể khổ màn hình (desktop + mobile), tên file
//    là <tên nền>-<biến thể>.webp. Web chọn bộ MỚI NHẤT (theo updated_at trong
//    manifest) rồi mới chọn biến thể hợp màn hình — chọn theo bộ nên không bao
//    giờ lệch desktop một nền, mobile một nền.
// 2. Trùng tên là GHI ĐÈ (có hỏi lại). Khác tab "Ảnh mẫu" — bên đó tự đánh số để
//    không bao giờ ghi đè.
// 3. manifest.json là NƠI DUY NHẤT web đọc được danh sách nền (GitHub Pages
//    không cho liệt kê thư mục qua HTTP). Điểm nhìn cũng nằm trong đó, ở khoá
//    `focal` của mỗi bộ, tách theo biến thể — js/hero-background.js đọc ra rồi
//    đặt thành background-position.
//
// Thêm chỗ dùng nền mới về sau: thêm MỘT mục vào BG_SLOTS, không sửa gì khác.

const BG_SLOTS = [
  {
    value: "started",
    label: "Màn mở đầu trang chủ",
    folder: "background/started", // đường dẫn con trong assets/, cho phép nhiều cấp
    note: "Nền mờ phía sau khối chào ở đầu trang chủ",
    variants: [
      { key: "desktop", label: "Desktop (ngang)", w: 1920, h: 1080 },
      { key: "mobile", label: "Mobile (dọc)", w: 1080, h: 1920 },
    ],
  },
];

// Khổ màn dùng để xem trước điểm nhìn. Chiều cao là chiều cao KHUNG NHÌN vì màn
// mở đầu cao đúng một màn (--vh) — nhờ vậy khung ở đây khớp với trang thật.
const BG_FRAMES = [
  { label: "Điện thoại", w: 390, h: 844 },
  { label: "Máy tính bảng", w: 820, h: 1180 },
  { label: 'Laptop 13"', w: 1440, h: 800 },
  { label: "Màn rộng", w: 1920, h: 1080 },
];

// Dùng CHUNG handle thư mục assets/ với tab "Ảnh mẫu" (cùng key, cùng store):
// admin kết nối một lần là cả hai tab dùng được. siIdbGet/siIdbPut khai ở
// 03-sample-images.js, SI_IDB_STORE cũng vậy — file này luôn nạp sau.
const BG_IDB_KEY = "assets-root";
const BG_MANIFEST_NAME = "manifest.json";
const BG_MAX_MB = 1.2; // trần dung lượng ảnh nền ghi ra đĩa
const BG_WEBP_QUALITY = 0.9;
// Nền chỉ hiện ở khổ nền nên không cần lớn hơn cạnh dài nhất của biến thể.
const BG_MAX_SIDE = 1920;
// Ảnh đặt tay vào thư mục (chưa qua tab này) vẫn phải hiện ra để sửa điểm nhìn.
const BG_EXT_RE = /\.(webp|png|jpe?g|avif)$/i;

let bgRootHandle = null; // thư mục assets/
let bgDirHandle = null; // thư mục đích của slot đang chọn
let bgItems = []; // nền đã có: [{ name, updated_at, variants: {key: file}, focal: {key: {x,y}} }]
let bgPending = null; // ảnh đang chờ lưu: { blob, w, h, focal, url }

// ============= Init tab =============

async function initBackgroundPanel() {
  if (!("showDirectoryPicker" in window)) {
    document.getElementById("bg-unsupported-banner").classList.remove("hidden");
    document.getElementById("bg-body").classList.add("hidden");
    return;
  }

  bgPopulateSlotDropdown();
  bgInitDropZone();

  const savedHandle = await siIdbGet(SI_IDB_STORE, BG_IDB_KEY).catch(() => null);
  if (!savedHandle) {
    bgSetFolderStatus("disconnected");
    return;
  }

  bgRootHandle = savedHandle;
  const perm = await bgRootHandle
    .queryPermission({ mode: "readwrite" })
    .catch(() => "denied");
  bgSetFolderStatus(perm === "granted" ? "connected" : "needs-reauth", savedHandle.name);
  if (perm === "granted") await onBackgroundSlotChange();
}

function bgPopulateSlotDropdown() {
  const select = document.getElementById("bg-slot-select");
  if (select.dataset.populated) return;
  BG_SLOTS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = `${s.label} — ${s.folder}/`;
    select.appendChild(opt);
  });
  select.dataset.populated = "1";
}

function bgSlot() {
  const v = document.getElementById("bg-slot-select").value;
  return BG_SLOTS.find((s) => s.value === v) || BG_SLOTS[0];
}

function bgVariant() {
  const slot = bgSlot();
  const v = document.getElementById("bg-variant-select").value;
  return slot.variants.find((x) => x.key === v) || slot.variants[0];
}

// ============= Kết nối thư mục =============

function bgSetFolderStatus(state, folderName = "") {
  const statusEl = document.getElementById("bg-folder-status");
  const btn = document.getElementById("bg-connect-btn");
  const picker = document.getElementById("bg-picker");

  if (state === "connected") {
    statusEl.textContent = `✅ Đã kết nối${folderName ? ` — ${folderName}/` : ""}`;
    statusEl.className = "text-xs text-green-600 mt-0.5";
    btn.textContent = "Đổi thư mục";
    btn.dataset.mode = "pick";
    picker.classList.remove("hidden");
  } else if (state === "needs-reauth") {
    statusEl.textContent = "⚠️ Cần cấp lại quyền truy cập thư mục";
    statusEl.className = "text-xs text-amber-600 mt-0.5";
    btn.textContent = "Cấp lại quyền";
    btn.dataset.mode = "regrant";
    picker.classList.add("hidden");
  } else {
    statusEl.textContent = "Chưa kết nối";
    statusEl.className = "text-xs text-gray-500 mt-0.5";
    btn.textContent = "Chọn thư mục";
    btn.dataset.mode = "pick";
    picker.classList.add("hidden");
  }
}

async function connectBackgroundRootFolder() {
  const btn = document.getElementById("bg-connect-btn");
  try {
    if (btn.dataset.mode === "regrant" && bgRootHandle) {
      const perm = await bgRootHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        showToast("Chưa cấp quyền truy cập thư mục", "error");
        return;
      }
      bgSetFolderStatus("connected", bgRootHandle.name);
      await onBackgroundSlotChange();
      return;
    }

    const handle = await window.showDirectoryPicker({
      id: "cx-assets-root", // cùng id với tab "Ảnh mẫu" → mở sẵn đúng thư mục
      mode: "readwrite",
    });
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      showToast("Chưa cấp quyền truy cập thư mục", "error");
      return;
    }

    bgRootHandle = handle;
    bgDirHandle = null;
    await siIdbPut(SI_IDB_STORE, BG_IDB_KEY, handle);
    bgSetFolderStatus("connected", handle.name);
    showToast("Đã kết nối thư mục gốc: " + handle.name, "success");
    await onBackgroundSlotChange();
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      showToast("Lỗi chọn thư mục: " + e.message, "error");
    }
  }
}

/** Mọi thư mục đích tab này ghi ra — dùng để nhận ra thư mục gốc chọn nhầm. */
const bgAllFolders = () => [...BG_SLOTS.map((s) => s.folder), HP_FOLDER];

/**
 * Đoạn đường dẫn còn phải đi TỪ thư mục đã kết nối tới thư mục đích, hoặc
 * `null` nếu đích nằm NGOÀI thư mục đã kết nối (không đi ngược lên được).
 * Người dùng hay chọn thẳng một thư mục con (assets/background/started) thay vì
 * assets/: nối đủ đường dẫn vào đó là đẻ ra started/background/started. Cắt
 * phần đã nằm trong tên thư mục gốc lo được ca đó, nhưng đích KHÁC
 * (thumbnail_started) thì không tài nào với tới — phải báo, đừng tạo bừa.
 */
function bgSlotParts(slot) {
  const parts = slot.folder.split("/");
  const root = bgRootHandle?.name || "";
  const i = parts.lastIndexOf(root);
  if (i >= 0) return parts.slice(i + 1);
  const insideAnother = bgAllFolders().some((f) => f.split("/").includes(root));
  return insideAnother ? null : parts;
}

/** Câu nhắc khi thư mục gốc đang chọn không với tới được thư mục đích. */
function bgUnreachableMsg(slot) {
  return `Thư mục đang kết nối (${bgRootHandle?.name}/) không chứa ${slot.folder}/ — hãy bấm "Đổi thư mục" và chọn đúng assets/`;
}

/**
 * Mở (tạo nếu chưa có) thư mục đích của slot. Đường dẫn NHIỀU CẤP nên đi lần
 * lượt từng đoạn — getDirectoryHandle chỉ nhận một cấp mỗi lần.
 * `create: false` để chỉ xem, không tự tạo thư mục rỗng khi mới mở tab.
 */
async function bgOpenSlotDir(slot, { create = false } = {}) {
  const parts = bgRootHandle && bgSlotParts(slot);
  if (!parts) return null;
  let dir = bgRootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create }).catch(() => null);
    if (!dir) return null;
  }
  return dir;
}

// ============= Đổi slot / biến thể =============

async function onBackgroundSlotChange() {
  const slot = bgSlot();
  document.getElementById("bg-slot-note").textContent = slot.note || "";

  const vSelect = document.getElementById("bg-variant-select");
  vSelect.innerHTML = "";
  slot.variants.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.key;
    opt.textContent = `${v.label} — ${v.w}×${v.h}`;
    vSelect.appendChild(opt);
  });

  onBackgroundVariantChange();
  bgClearPreview();

  bgDirHandle = await bgOpenSlotDir(slot);
  await bgLoadExisting();
  // Ba ô ảnh trang trí không theo slot nào, nhưng cùng cần thư mục gốc đã kết
  // nối — nạp ở đây là chỗ duy nhất chắc chắn đã có handle.
  await loadHeroPicks();
}

function onBackgroundVariantChange() {
  const v = bgVariant();
  document.getElementById("bg-variant-note").textContent =
    `Khổ tham chiếu ${v.w}×${v.h}px — ảnh giữ nguyên tỉ lệ gốc, điểm nhìn lo phần cắt`;
  bgUpdateFilenameHint();
  bgRenderFrames();
}

function bgUpdateFilenameHint() {
  const base = bgSlugify(document.getElementById("bg-name-input")?.value || "");
  const hint = document.getElementById("bg-filename-hint");
  if (!hint) return;
  // Hiện ĐƯỜNG DẪN THẬT tính từ thư mục đã kết nối — chọn nhầm thư mục con là
  // thấy ngay ở đây, không phải đi tìm file lạc.
  const parts = bgSlotParts(bgSlot());
  if (!parts) {
    hint.textContent = bgUnreachableMsg(bgSlot());
    return;
  }
  const dir = [bgRootHandle?.name, ...parts].filter(Boolean).join("/");
  hint.textContent = base
    ? `Ghi ra: ${dir}/${base}-${bgVariant().key}.webp`
    : "Chỉ dùng chữ thường, số và dấu gạch ngang.";
}

// ============= Chọn ảnh + nén =============

function bgInitDropZone() {
  const drop = document.getElementById("bg-drop");
  if (!drop || drop.dataset.cxReady) return;
  drop.dataset.cxReady = "1";

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      stop(e);
      drop.classList.add("border-rose-400", "bg-rose-50/60");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      stop(e);
      drop.classList.remove("border-rose-400", "bg-rose-50/60");
    }),
  );
  drop.addEventListener("drop", (e) => bgPickFile(e.dataTransfer?.files?.[0]));
}

/** Nhận ảnh từ ô chọn file hoặc kéo thả, nén rồi hiện phần xem trước. */
async function bgPickFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("File này không phải ảnh", "error");
    return;
  }

  try {
    const out = await bgToWebp(file);
    bgClearPreview();
    bgPending = { ...out, focal: null, url: URL.createObjectURL(out.blob) };

    document.getElementById("bg-preview").src = bgPending.url;
    document.getElementById("bg-preview-meta").textContent =
      `— ${out.w}×${out.h} · ${bgFormatSize(out.blob.size)}` +
      (out.quality < BG_WEBP_QUALITY ? ` · nén mạnh (q${out.quality.toFixed(1)})` : "");
    document.getElementById("bg-preview-wrap").classList.remove("hidden");

    // Tên gợi ý từ tên file gốc, vẫn sửa được trước khi lưu.
    const nameInput = document.getElementById("bg-name-input");
    if (!nameInput.value) nameInput.value = bgSlugify(file.name.replace(/\.[^.]+$/, ""));

    bgUpdateFilenameHint();
    bgRenderPendingFocal();
    bgRenderFrames();
  } catch (e) {
    console.error(e);
    showToast("Không đọc được ảnh: " + e.message, "error");
  }
}

/**
 * Thu nhỏ về đúng khổ cần rồi mã hoá WebP, hạ chất lượng dần cho tới khi lọt
 * trần dung lượng. GIỮ NGUYÊN TỈ LỆ gốc — phần cắt là việc của background-size
 * cover trên trang, và điểm nhìn quyết định cắt bên nào.
 */
async function bgToWebp(
  file,
  { maxSide = BG_MAX_SIDE, minSide = 0, quality: q0 = BG_WEBP_QUALITY } = {},
) {
  const bmp = await createImageBitmap(file);
  // maxSide chặn cạnh DÀI; minSide kéo cạnh NGẮN lên cho ô cắt vuông không bị
  // nhoè — ô vuông chỉ ăn phần cạnh ngắn nên chặn theo cạnh dài là thiếu pixel.
  let scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  if (minSide) scale = Math.max(scale, Math.min(1, minSide / Math.min(bmp.width, bmp.height)));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const encode = (q) =>
    new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("không mã hoá được WebP"))),
        "image/webp",
        q,
      ),
    );

  let quality = q0;
  let blob = await encode(quality);
  while (blob.size > BG_MAX_MB * 1024 * 1024 && quality > 0.4) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    blob = await encode(quality);
  }
  return { blob, w, h, quality };
}

function bgFormatSize(bytes) {
  return bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(2) + " MB"
    : Math.round(bytes / 1024) + " KB";
}

/** Bỏ ảnh đang chờ lưu. */
function bgClearPreview() {
  if (bgPending?.url) URL.revokeObjectURL(bgPending.url);
  bgPending = null;
  const wrap = document.getElementById("bg-preview-wrap");
  if (wrap) wrap.classList.add("hidden");
  bgRenderFrames();
}

// ============= Điểm nhìn =============
//
// Điểm nhìn = toạ độ % TRÊN ẢNH của chỗ quan trọng nhất; trang đặt thẳng vào
// background-position. Chưa đặt thì trang giữ `center top` của CSS, nên khung
// xem trước ở đây cũng lấy mốc đó làm mặc định.

const BG_FALLBACK_FOCAL = { x: 50, y: 0 };

/** Giá trị background-position của một điểm nhìn (null = mặc định của CSS). */
function bgFocalPos(focal) {
  const f = focal || BG_FALLBACK_FOCAL;
  return `${f.x}% ${f.y}%`;
}

function bgFocalLabel(focal) {
  return focal ? `🎯 ${focal.x}/${focal.y}` : "chưa đặt — dùng mặc định (giữa, sát mép trên)";
}

/* Không mask: .hero-bg ở styles/tailwind-src.css trải KÍN màn mở đầu, nên khung
   xem trước cũng để nguyên cả ảnh. Đổi .hero-bg thành dải một phần màn thì phải
   dựng lại mask ở đây, không thì xem trước hứa một đằng trang thật ra một nẻo. */
const bgFrameDefs = () => BG_FRAMES.map((f) => ({ ...f }));

/**
 * Vẽ dãy khung xem trước cho ảnh đang chờ lưu: mỗi khung mô phỏng màn mở đầu ở
 * một khổ màn, nên thấy ngay điểm nhìn cắt mất gì ở khổ nào.
 */
function bgRenderFrames() {
  const box = document.getElementById("bg-frames");
  if (!box) return;
  box.innerHTML = "";
  if (!bgPending) return;

  const pos = bgFocalPos(bgPending.focal);
  bgFrameDefs().forEach((f) => {
    const cell = document.createElement("div");
    cell.innerHTML = `
      <div class="rounded-lg overflow-hidden border border-gray-200 bg-[rgb(var(--surface-tint-rgb))]"
           style="aspect-ratio:${f.w}/${f.h}">
        <div class="w-full h-full" style="
          background-image:url('${bgPending.url}');
          background-size:cover;background-repeat:no-repeat;background-position:${pos};
          -webkit-mask-image:${f.mask};mask-image:${f.mask};"></div>
      </div>
      <p class="text-[11px] text-gray-500 text-center mt-1">${escapeHtml(f.label)}</p>`;
    box.appendChild(cell);
  });
}

function bgRenderPendingFocal() {
  const el = document.getElementById("bg-pending-focal");
  if (el) el.textContent = bgFocalLabel(bgPending?.focal);
}

/** Chỉnh điểm nhìn cho ảnh CHƯA lưu — lưu xong mới ghi vào manifest. */
function bgEditPendingFocal() {
  if (!bgPending) return;
  openFocalPointPicker(
    bgPending.url,
    bgPending.focal || BG_FALLBACK_FOCAL,
    (focal) => {
      bgPending.focal = focal;
      bgRenderPendingFocal();
      bgRenderFrames();
    },
    null,
    bgFrameDefs(),
  );
}

/** Chỉnh điểm nhìn của một biến thể ĐÃ lưu; áp vào manifest ngay khi bấm Áp dụng. */
function bgEditFocal(name, variantKey) {
  const item = bgItems.find((x) => x.name === name);
  if (!item?.variants[variantKey]) return;
  const slot = bgSlot();
  const src = `/assets/${slot.folder}/${item.variants[variantKey]}`;

  openFocalPointPicker(
    src,
    item.focal?.[variantKey] || BG_FALLBACK_FOCAL,
    async (focal) => {
      item.focal = { ...(item.focal || {}), [variantKey]: focal };
      await bgSyncManifest();
      bgRenderList();
      showToast(`Đã đặt điểm nhìn ${variantKey}: ${focal.x}/${focal.y}`, "success");
    },
    null,
    bgFrameDefs(),
  );
}

// ============= Lưu xuống thư mục =============

/** Tên file: chữ thường, số, gạch ngang. "" = không hợp lệ. */
function bgSlugify(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function saveBackground() {
  if (!bgPending) {
    showToast("Chưa chọn ảnh nào để lưu", "error");
    return;
  }
  const base = bgSlugify(document.getElementById("bg-name-input").value);
  if (!base) {
    showToast("Hãy đặt tên cho nền (chữ thường, số, gạch ngang)", "error");
    return;
  }

  const slot = bgSlot();
  const variant = bgVariant();
  const filename = `${base}-${variant.key}.webp`;
  const focal = bgPending.focal;

  try {
    if (!bgSlotParts(slot)) throw new Error(bgUnreachableMsg(slot));
    bgDirHandle = await bgOpenSlotDir(slot, { create: true });
    if (!bgDirHandle) throw new Error("không mở được thư mục " + slot.folder);

    if (await bgFileExists(bgDirHandle, filename)) {
      const ok = await showConfirm(
        "Ghi đè file?",
        `${slot.folder}/${filename} đã có. Ghi đè bằng ảnh vừa chọn?`,
        { confirmText: "Ghi đè" },
      );
      if (!ok) return;
    }

    const fh = await bgDirHandle.getFileHandle(filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(bgPending.blob);
    await writable.close();

    await bgLoadExisting();
    // Điểm nhìn vừa chọn thuộc về file vừa ghi — gắn vào bộ tương ứng SAU khi
    // quét lại thư mục, không thì lượt sync sẽ ghi đè bằng giá trị cũ.
    if (focal) {
      const item = bgItems.find((x) => x.name === base);
      if (item) item.focal = { ...(item.focal || {}), [variant.key]: focal };
    }
    await bgSyncManifest();
    bgRenderList();
    bgClearPreview();
    showToast(`Đã lưu ${filename}`, "success");
  } catch (e) {
    console.error(e);
    showToast("Không ghi được file: " + e.message, "error");
  }
}

async function bgFileExists(dirHandle, filename) {
  try {
    await dirHandle.getFileHandle(filename, { create: false });
    return true;
  } catch {
    return false;
  }
}

// ============= Đọc / xoá nền đã có =============

/** Gom file trong thư mục thành các BỘ theo tên gốc (bỏ hậu tố -<biến thể>). */
async function bgLoadExisting() {
  const empty = document.getElementById("bg-empty");
  bgItems = [];

  if (!bgDirHandle) {
    document.getElementById("bg-list").innerHTML = "";
    empty.classList.remove("hidden");
    empty.textContent = "Thư mục chưa tồn tại — lưu nền đầu tiên là tự tạo.";
    document.getElementById("bg-active-note").textContent = "";
    return;
  }

  const slot = bgSlot();
  const keys = slot.variants.map((v) => v.key);
  const focals = await bgReadFocal();
  const byName = new Map();

  for await (const entry of bgDirHandle.values()) {
    if (entry.kind !== "file" || !BG_EXT_RE.test(entry.name)) continue;
    const m = entry.name.match(new RegExp(`^(.+)-(${keys.join("|")})\\.[a-z0-9]+$`, "i"));
    if (!m) continue;
    const [, name, key] = m;
    const file = await entry.getFile();
    const item = byName.get(name) || {
      name,
      updated_at: 0,
      variants: {},
      focal: focals[name] || null,
    };
    item.variants[key.toLowerCase()] = entry.name;
    // updated_at của BỘ = lần sửa gần nhất trong các biến thể của nó.
    item.updated_at = Math.max(item.updated_at, file.lastModified);
    byName.set(name, item);
  }

  bgItems = [...byName.values()].sort((a, b) => b.updated_at - a.updated_at);
  bgRenderList();
}

function bgRenderList() {
  const list = document.getElementById("bg-list");
  const empty = document.getElementById("bg-empty");
  const slot = bgSlot();

  // Bắt click ở CẢ lưới, không gắn từng nút: <x-button> tự thay mình bằng
  // <button> lúc được chèn vào trang, nên listener gắn trước đó rơi mất theo
  // thẻ cũ.
  if (!list.dataset.cxReady) {
    list.dataset.cxReady = "1";
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-focal],[data-act='del']");
      const card = btn?.closest("[data-bg-name]");
      if (!btn || !card) return;
      const name = card.dataset.bgName;
      if (btn.hasAttribute("data-focal")) bgEditFocal(name, btn.getAttribute("data-focal"));
      else deleteBackground(name);
    });
  }

  list.innerHTML = "";
  empty.classList.toggle("hidden", bgItems.length > 0);
  empty.textContent = "Thư mục chưa có nền nào.";
  document.getElementById("bg-active-note").textContent = bgItems.length
    ? `Trang web dùng bộ mới nhất: ${bgItems[0].name}`
    : "";

  bgItems.forEach((item) => list.appendChild(bgCard(item, slot)));
}

function bgCard(item, slot) {
  const missing = slot.variants.filter((v) => !item.variants[v.key]);
  const el = document.createElement("div");
  el.className = "rounded-xl border border-gray-200 overflow-hidden";
  el.dataset.bgName = item.name;
  // Ảnh đại diện: ưu tiên biến thể đầu tiên của slot (desktop), thiếu thì lấy tạm cái có.
  const thumbKey = item.variants[slot.variants[0].key]
    ? slot.variants[0].key
    : Object.keys(item.variants)[0];
  const thumb = item.variants[thumbKey];

  const focalRows = Object.keys(item.variants)
    .map((key) => {
      const f = item.focal?.[key];
      return `
        <div class="flex items-center justify-between gap-2 text-[11px] text-gray-500">
          <span class="truncate">${escapeHtml(key)} — ${f ? `🎯 ${f.x}/${f.y}` : "chưa đặt"}</span>
          <x-button variant="ghost" size="sm" type="button" data-focal="${escapeHtml(key)}" class="underline shrink-0">
            Điểm nhìn
          </x-button>
        </div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="aspect-video bg-[rgb(var(--checkerboard-rgb))]">
      <img src="/assets/${slot.folder}/${thumb}" alt=""
           class="w-full h-full object-cover" loading="lazy"
           style="object-position:${bgFocalPos(item.focal?.[thumbKey])}" />
    </div>
    <div class="p-2.5">
      <div class="text-xs font-medium text-gray-800 truncate">${escapeHtml(item.name)}</div>
      <div class="text-[11px] text-gray-500 mt-0.5">
        ${Object.keys(item.variants).join(" · ")}
        ${missing.length ? `<span class="text-amber-600">— thiếu ${missing.map((v) => v.key).join(", ")}</span>` : ""}
      </div>
      <div class="mt-1.5 space-y-1">${focalRows}</div>
      <x-button variant="ghost" tone="danger" size="sm" type="button" data-act="del" class="mt-2 underline">Xoá</x-button>
    </div>`;
  return el;
}

async function deleteBackground(name) {
  const item = bgItems.find((x) => x.name === name);
  if (!item || !bgDirHandle) return;
  const ok = await showConfirm(
    "Xoá nền?",
    `Xoá ${Object.keys(item.variants).length} file của bộ "${name}"? Không hoàn tác được.`,
    { confirmText: "Xoá" },
  );
  if (!ok) return;

  try {
    for (const filename of Object.values(item.variants)) {
      await bgDirHandle.removeEntry(filename);
    }
    await bgLoadExisting();
    await bgSyncManifest();
    showToast("Đã xoá " + name, "success");
  } catch (e) {
    console.error(e);
    showToast("Không xoá được: " + e.message, "error");
  }
}

// ============= manifest.json =============

/** Điểm nhìn đang khai trong manifest, gom theo tên bộ ({} nếu chưa có file). */
async function bgReadFocal() {
  try {
    const fh = await bgDirHandle.getFileHandle(BG_MANIFEST_NAME, { create: false });
    const json = JSON.parse(await (await fh.getFile()).text());
    const out = {};
    (json.backgrounds || []).forEach((b) => {
      if (b?.name && b.focal) out[b.name] = b.focal;
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * Ghi lại manifest.json — NƠI DUY NHẤT web đọc được danh sách nền.
 * Gọi SAU bgLoadExisting() để lấy đúng danh sách vừa quét: danh sách file dựng
 * lại từ thư mục, còn điểm nhìn chỉ có trong manifest nên đi theo bgItems.focal.
 */
async function bgSyncManifest() {
  if (!bgDirHandle) return;
  const slot = bgSlot();

  const json = {
    path: `/assets/${slot.folder}`,
    updated_at: new Date().toISOString(),
    // Đã sắp mới nhất trước; web lấy phần tử đầu có biến thể hợp màn hình.
    backgrounds: bgItems.map((item) => ({
      name: item.name,
      updated_at: new Date(item.updated_at).toISOString(),
      variants: item.variants,
      ...(item.focal && Object.keys(item.focal).length ? { focal: item.focal } : {}),
    })),
  };

  try {
    const fh = await bgDirHandle.getFileHandle(BG_MANIFEST_NAME, { create: true });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(json, null, 2));
    await writable.close();
  } catch (e) {
    console.error("Không ghi được manifest.json:", e);
    showToast("Đã lưu file nhưng không ghi được manifest.json — xem console", "warning");
  }
}

// ============= Ba ô ảnh trang trí của màn mở đầu =============
//
// Khác phần trên ở chỗ đây KHÔNG phải danh sách: đúng ba ô, tên file cố định
// (pick-1..3.webp) nên index.html viết thẳng src, chọn ảnh mới chỉ là ghi đè.
// manifest.json trong thư mục này chỉ để mang ĐIỂM NHÌN của từng ô, xếp theo
// đúng thứ tự ba ô — js/hero-background.js đọc ra rồi đặt vào object-position.
// Ô hiển thị VUÔNG nên ảnh không vuông sẽ bị xén, điểm nhìn quyết định xén bên
// nào; chưa đặt thì trang giữ `center 35%` của .hero-pick img.

const HP_FOLDER = "background/thumbnail_started";
const HP_LABELS = ["Ô trái", "Ô giữa (to hơn)", "Ô phải"];
// Ô hiển thị VUÔNG, cạnh tối đa 232px → cần ~700px cho màn 3x, và số đo phải
// tính theo cạnh NGẮN của ảnh vì ô vuông cắt bỏ phần thừa của cạnh dài.
const HP_MIN_SIDE = 720;
const HP_MAX_SIDE = 1440; // trần cạnh dài, cho ảnh rất dài không phình file
const HP_QUALITY = 0.92;
const HP_FALLBACK_FOCAL = { x: 50, y: 35 };

// [{ file, url, blob, focal, onDisk }] — blob khác null nghĩa là đang chờ lưu.
let bgHeroPicks = [];

const hpSlot = () => ({ folder: HP_FOLDER });

function hpBlank(i) {
  return { file: `pick-${i + 1}.webp`, url: null, blob: null, focal: null, onDisk: false };
}

/** Đọc ba file + điểm nhìn từ thư mục (bỏ qua êm nếu thư mục chưa tồn tại). */
async function loadHeroPicks() {
  // Mọi url ở đây đều là objectURL (đọc từ đĩa hoặc blob đang chờ lưu).
  bgHeroPicks.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  bgHeroPicks = HP_LABELS.map((_, i) => hpBlank(i));

  const dir = await bgOpenSlotDir(hpSlot());
  if (dir) {
    const focals = await hpReadFocal(dir);
    for (const p of bgHeroPicks) {
      const fh = await dir.getFileHandle(p.file, { create: false }).catch(() => null);
      if (!fh) continue;
      p.onDisk = true;
      // Đọc từ đĩa chứ không lấy URL của trang: file vừa ghi đè hay còn nằm
      // trong cache HTTP, hiện lại ảnh cũ thì tưởng lưu hỏng.
      p.url = URL.createObjectURL(await fh.getFile());
      p.focal = focals[p.file] || null;
    }
  }
  renderHeroPicks();
}

async function hpReadFocal(dir) {
  try {
    const fh = await dir.getFileHandle(BG_MANIFEST_NAME, { create: false });
    const json = JSON.parse(await (await fh.getFile()).text());
    const out = {};
    (json.picks || []).forEach((p) => {
      if (p?.file && p.focal) out[p.file] = p.focal;
    });
    return out;
  } catch {
    return {};
  }
}

function renderHeroPicks() {
  const grid = document.getElementById("bg-pick-grid");
  if (!grid) return;

  // Một listener cho cả lưới: <x-button> tự thay mình bằng <button> lúc chèn
  // nên listener gắn từng nút sẽ rơi mất theo thẻ cũ.
  if (!grid.dataset.cxReady) {
    grid.dataset.cxReady = "1";
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hp-act]");
      if (btn) heroPickEditFocal(+btn.closest("[data-hp]").dataset.hp);
    });
    grid.addEventListener("change", (e) => {
      const input = e.target.closest("input[type='file']");
      if (!input) return;
      heroPickChoose(+input.closest("[data-hp]").dataset.hp, input.files[0]);
      input.value = "";
    });
  }

  grid.innerHTML = bgHeroPicks
    .map((p, i) => {
      const state = p.blob
        ? '<span class="text-rose-600">● chưa lưu</span>'
        : p.onDisk
          ? "đã có trong thư mục"
          : '<span class="text-amber-600">chưa có ảnh</span>';
      const focal = p.focal ? `🎯 ${p.focal.x}/${p.focal.y}` : "điểm nhìn mặc định";
      const thumb = p.url
        ? `<img src="${p.url}" alt="" class="w-full h-full object-cover"
               style="object-position:${bgFocalPos(p.focal || HP_FALLBACK_FOCAL)}" />`
        : '<div class="w-full h-full grid place-items-center text-xs text-gray-400">Chưa có ảnh</div>';
      return `
        <div class="rounded-xl border border-gray-200 overflow-hidden" data-hp="${i}">
          <div class="aspect-square bg-[rgb(var(--checkerboard-rgb))]">${thumb}</div>
          <div class="p-2.5">
            <div class="text-xs font-medium text-gray-800">${escapeHtml(HP_LABELS[i])}</div>
            <div class="text-[11px] text-gray-500 mt-0.5">${state} · ${focal}</div>
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <label class="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-700 hover:border-rose-300 hover:bg-rose-50/40">
                Chọn ảnh
                <input type="file" accept="image/*" class="hidden" />
              </label>
              <x-button variant="ghost" size="sm" type="button" data-hp-act="focal" class="underline"
                        ${p.url ? "" : "disabled"}>Điểm nhìn</x-button>
            </div>
          </div>
        </div>`;
    })
    .join("");

  const status = document.getElementById("bg-pick-status");
  if (status) {
    const parts = bgSlotParts(hpSlot());
    const dir = parts ? [bgRootHandle?.name, ...parts].filter(Boolean).join("/") : "";
    const dirty = bgHeroPicks.filter((p) => p.blob).length;
    status.textContent = !parts
      ? bgUnreachableMsg(hpSlot())
      : dirty
        ? `${dirty} ô đang chờ lưu → ${dir}/`
        : `Ghi ra: ${dir}/pick-1…3.webp`;
  }
}

/** Nhận ảnh cho một ô, nén rồi giữ trong bộ nhớ cho tới khi bấm Lưu. */
async function heroPickChoose(i, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("File này không phải ảnh", "error");
    return;
  }
  try {
    const out = await bgToWebp(file, {
      maxSide: HP_MAX_SIDE,
      minSide: HP_MIN_SIDE,
      quality: HP_QUALITY,
    });
    const p = bgHeroPicks[i];
    if (p.url) URL.revokeObjectURL(p.url);
    p.blob = out.blob;
    p.url = URL.createObjectURL(out.blob);
    renderHeroPicks();
  } catch (e) {
    console.error(e);
    showToast("Không đọc được ảnh: " + e.message, "error");
  }
}

/** Điểm nhìn của ô: xem trước bằng dãy tỉ lệ mặc định (có sẵn ô vuông). */
function heroPickEditFocal(i) {
  const p = bgHeroPicks[i];
  if (!p?.url) return;
  openFocalPointPicker(p.url, p.focal || HP_FALLBACK_FOCAL, (focal) => {
    p.focal = focal;
    renderHeroPicks();
  });
}

/** Ghi các ô vừa đổi xuống đĩa rồi ghi lại manifest (điểm nhìn của cả ba ô). */
async function saveHeroPicks() {
  if (!bgRootHandle) {
    showToast("Chưa kết nối thư mục assets/", "error");
    return;
  }
  try {
    if (!bgSlotParts(hpSlot())) throw new Error(bgUnreachableMsg(hpSlot()));
    const dir = await bgOpenSlotDir(hpSlot(), { create: true });
    if (!dir) throw new Error("không mở được thư mục " + HP_FOLDER);

    let written = 0;
    for (const p of bgHeroPicks) {
      if (!p.blob) continue;
      const fh = await dir.getFileHandle(p.file, { create: true });
      const writable = await fh.createWritable();
      await writable.write(p.blob);
      await writable.close();
      p.onDisk = true;
      written++;
    }
    await hpSyncManifest(dir);
    await loadHeroPicks();
    showToast(written ? `Đã lưu ${written} ô ảnh` : "Đã cập nhật điểm nhìn", "success");
  } catch (e) {
    console.error(e);
    showToast("Không ghi được file: " + e.message, "error");
  }
}

async function hpSyncManifest(dir) {
  const json = {
    path: `/assets/${HP_FOLDER}`,
    updated_at: new Date().toISOString(),
    // Đúng thứ tự ba ô — trang đọc theo chỉ số, không theo tên.
    picks: bgHeroPicks.map((p) => ({
      file: p.file,
      ...(p.focal ? { focal: p.focal } : {}),
    })),
  };
  try {
    const fh = await dir.getFileHandle(BG_MANIFEST_NAME, { create: true });
    const writable = await fh.createWritable();
    await writable.write(JSON.stringify(json, null, 2));
    await writable.close();
  } catch (e) {
    console.error("Không ghi được manifest.json của ba ô ảnh:", e);
    showToast("Đã lưu ảnh nhưng không ghi được manifest.json — xem console", "warning");
  }
}
