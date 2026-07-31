// ============= TAB "Ảnh mẫu": kho ảnh tĩnh dùng chung =============
// Khác với tab "Dữ liệu mẫu" (bộ ảnh + nội dung demo RIÊNG của từng theme),
// tab này là kho ảnh DÙNG CHUNG cho cả web: icon hoa trang trí cho tab Giao
// diện, khung viền, ảnh landing… Không có state phức tạp — chọn thư mục đích,
// thả ảnh vào là ghi thẳng xuống đĩa (File System Access API, Chrome/Edge
// desktop mở qua localhost).
//
// Quy ước (giữ đúng "rule" của tab Dữ liệu mẫu):
// 0. Thả ảnh vào là ảnh nằm CHỜ (chưa đụng đĩa), bấm "Lưu vào thư mục" mới ghi.
//    Trước lúc lưu vẫn chỉnh được điểm lấy nét hoặc bỏ bớt ảnh.
// 1. Nén ĐÚNG MỘT LẦN, ngay lúc thả vào hàng chờ (axStageFiles), qua
//    ImageHelper.prepareImage() — cùng hàm với tab Dữ liệu mẫu và luồng khách ở
//    invitation-setup, chỉ khác ngưỡng (lấy theo danh mục). Ảnh đã đạt ngưỡng
//    thì giữ nguyên file gốc (không mã hoá lại → không mất chất lượng vô ích);
//    GIF/AVIF/BMP/SVG bị ImageHelper.canRecompress() loại nên luôn giữ nguyên.
//    Lúc lưu KHÔNG xử lý gì nữa, chỉ ghi thẳng blob xuống đĩa.
// 2. Tên file đặt theo TÊN THƯ MỤC + số thứ tự: flowers_01.png, flowers_02.png…
//    (tên gốc lúc tải về thường vô nghĩa). Số chạy tiếp từ số lớn nhất đang có
//    nên không bao giờ ghi đè; ảnh cũ chỉ mất khi bấm Xoá — ngược hẳn với tab
//    Dữ liệu mẫu (ghi đè cả thư mục), vì kho này có thể đang được thiệp thật
//    tham chiếu tới.
// 3. Thư mục gốc là thư mục ASSETS của dự án, mỗi danh mục là MỘT thư mục con
//    ngay trong đó (assets/flowers, assets/frames…) — không lồng nhiều cấp.
//    URL trên web dựng lại từ tên thư mục gốc: /<gốc>/<danh mục>/<file>.
//
// Ảnh ghi ra là file tĩnh trong repo → phải commit & push mới lên production.

// Danh mục dựng sẵn. Thêm loại ảnh mới → thêm 1 dòng ở đây (không có preset thì
// vẫn tự gõ tên thư mục được ở ô "Khác").
// folder: tên thư mục con trong assets/, ĐÚNG MỘT CẤP.
// maxPx / maxSizeMB: ngưỡng nén riêng của danh mục, thiếu thì lấy AX_DEFAULT_LIMITS
// (đúng ngưỡng ảnh khách tự upload: 1920px, 1MB).
const AX_PRESETS = [
  {
    value: "flowers",
    label: "Icon hoa trang trí",
    folder: "flowers",
    note: "Icon hoa, lá, hoạ tiết chèn vào thiệp ở tab Giao diện",
    maxPx: 1024,
    maxSizeMB: 0.3,
  },
  {
    value: "frames",
    label: "Khung & viền trang trí",
    folder: "frames",
    note: "Khung ảnh, viền, đường chia trang trí",
    maxPx: 1600,
    maxSizeMB: 0.5,
  },
  {
    value: "images",
    label: "Ảnh landing page",
    folder: "images",
    note: "Ảnh minh hoạ ngoài trang chủ",
  },
];

const AX_DEFAULT_LIMITS = { maxPx: 1920, maxSizeMB: 1 };
const AX_CUSTOM_VALUE = "__custom__";

const AX_IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i;
const AX_LAST_FOLDER_KEY = "ax_last_folder";
// manifest.json là NƠI DUY NHẤT lưu metadata của kho: danh sách ảnh (GitHub
// Pages không cho list thư mục qua HTTP nên client chỉ đọc được file này) và
// điểm lấy nét của từng ảnh. Vì vậy thư mục nào cũng có, không riêng danh mục nào.
const AX_MANIFEST_NAME = "manifest.json";
const AX_DEFAULT_FOCAL = { x: 50, y: 50 };

// Handle thư mục gốc nằm chung store "handles" của tab Dữ liệu mẫu (IndexedDB
// cx_admin_fs) nhưng KHÁC KEY — hai tab chọn hai thư mục khác nhau. Dùng lại
// siIdbGet/siIdbPut khai báo ở js/03-sample-images.js: file đó luôn nạp trước
// file này (xem mảng SCRIPTS trong loader.js).
const AX_IDB_KEY = "assets-root";

let axRootHandle = null; // thư mục assets/
let axDirHandle = null; // thư mục đích; null = tên hợp lệ nhưng thư mục chưa tồn tại
let axCurrentFolder = ""; // tên thư mục con đang mở, vd "flowers"
let axFiles = []; // ảnh ĐÃ có trên đĩa: [{ name, size, dim, focal, previewUrl }]
let axPending = []; // ảnh CHỜ lưu: [{ file, size, dim, focal, previewUrl }]
let axFocalDirty = false; // điểm lấy nét của ảnh ĐÃ lưu vừa đổi → manifest cần ghi lại

// ============= Init tab =============

async function initAssetImagesPanel() {
  if (!("showDirectoryPicker" in window)) {
    document.getElementById("ax-unsupported-banner").classList.remove("hidden");
    document.getElementById("ax-body").classList.add("hidden");
    return;
  }

  axPopulatePresetDropdown();
  axBindDropzone();

  const savedHandle = await siIdbGet(SI_IDB_STORE, AX_IDB_KEY).catch(() => null);
  if (!savedHandle) {
    axSetFolderStatus("disconnected");
    return;
  }

  axRootHandle = savedHandle;
  const perm = await axRootHandle
    .queryPermission({ mode: "readwrite" })
    .catch(() => "denied");
  axSetFolderStatus(perm === "granted" ? "connected" : "needs-reauth", savedHandle.name);
  if (perm === "granted") await axRestoreLastFolder();
}

function axPopulatePresetDropdown() {
  const select = document.getElementById("ax-preset-select");
  if (select.dataset.populated) return;
  AX_PRESETS.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = `${p.label} — ${p.folder}/`;
    select.appendChild(opt);
  });
  const other = document.createElement("option");
  other.value = AX_CUSTOM_VALUE;
  other.textContent = "Khác (tự nhập tên thư mục)…";
  select.appendChild(other);
  select.dataset.populated = "1";
}

// Sau F5 / quay lại tab, mở luôn thư mục làm dở lần trước.
async function axRestoreLastFolder() {
  if (axCurrentFolder) return;
  const last = localStorage.getItem(AX_LAST_FOLDER_KEY);
  if (!last || !axNormalizeFolder(last)) return;

  const preset = AX_PRESETS.find((p) => p.folder === last);
  const select = document.getElementById("ax-preset-select");
  select.value = preset ? preset.value : AX_CUSTOM_VALUE;
  if (!preset) {
    document.getElementById("ax-custom-path-wrap").classList.remove("hidden");
    document.getElementById("ax-path-input").value = last;
  }
  await axOpenFolder(last, { silent: true });
}

function axSetFolderStatus(state, folderName = "") {
  const statusEl = document.getElementById("ax-folder-status");
  const btn = document.getElementById("ax-connect-btn");
  const picker = document.getElementById("ax-picker");

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
    axClosePanel();
  } else {
    statusEl.textContent = "Chưa kết nối";
    statusEl.className = "text-xs text-gray-500 mt-0.5";
    btn.textContent = "Chọn thư mục";
    btn.dataset.mode = "pick";
    picker.classList.add("hidden");
    axClosePanel();
  }
}

async function connectAssetRootFolder() {
  const btn = document.getElementById("ax-connect-btn");
  try {
    if (btn.dataset.mode === "regrant" && axRootHandle) {
      const perm = await axRootHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        showToast("Chưa cấp quyền truy cập thư mục", "error");
        return;
      }
      axSetFolderStatus("connected", axRootHandle.name);
      await axRestoreLastFolder();
      return;
    }

    if (!(await axConfirmDiscard())) return;

    const handle = await window.showDirectoryPicker({
      id: "cx-assets-root",
      mode: "readwrite",
    });
    const perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      showToast("Chưa cấp quyền truy cập thư mục", "error");
      return;
    }

    axRootHandle = handle;
    axDirHandle = null;
    axCurrentFolder = "";
    await siIdbPut(SI_IDB_STORE, AX_IDB_KEY, handle);
    axSetFolderStatus("connected", handle.name);
    showToast("Đã kết nối thư mục gốc: " + handle.name, "success");
    await axRestoreLastFolder();
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      showToast("Lỗi chọn thư mục: " + e.message, "error");
    }
  }
}

// ============= Chọn thư mục đích =============

/**
 * Chuẩn hoá tên thư mục con do người dùng gõ. ĐÚNG MỘT CẤP — gõ "decor/flowers"
 * bị loại, vì thư mục gốc đã là assets/ rồi.
 * @returns {string} "" nếu không hợp lệ (rỗng, có "/", "..", ký tự lạ…)
 */
function axNormalizeFolder(raw) {
  const name = String(raw || "").trim();
  // Có dấu / hoặc \ là loại thẳng, KHÔNG cắt bớt: "../../etc" mà cắt thành
  // "etc" thì người gõ tưởng đang ở chỗ khác so với thư mục thật được mở.
  if (/[/\\]/.test(name)) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return "";
  return name;
}

function axLimitsFor(folder) {
  const preset = AX_PRESETS.find((p) => p.folder === folder);
  return {
    maxPx: preset?.maxPx || AX_DEFAULT_LIMITS.maxPx,
    maxSizeMB: preset?.maxSizeMB || AX_DEFAULT_LIMITS.maxSizeMB,
    label: preset?.label || "",
    note: preset?.note || "",
    manifest: !!preset?.manifest,
  };
}

async function onAssetPresetChange() {
  if (!(await axConfirmDiscard())) {
    axSyncSelectToCurrent();
    return;
  }

  const value = document.getElementById("ax-preset-select").value;
  const customWrap = document.getElementById("ax-custom-path-wrap");

  if (value === AX_CUSTOM_VALUE) {
    customWrap.classList.remove("hidden");
    axClosePanel();
    axCurrentFolder = "";
    document.getElementById("ax-path-input").focus();
    return;
  }

  customWrap.classList.add("hidden");
  const preset = AX_PRESETS.find((p) => p.value === value);
  if (!preset) {
    axClosePanel();
    axCurrentFolder = "";
    return;
  }
  await axOpenFolder(preset.folder);
}

async function openAssetFolder() {
  const folder = axNormalizeFolder(document.getElementById("ax-path-input").value);
  if (!folder) {
    showToast("Tên thư mục không hợp lệ — 1 cấp, chỉ chữ, số, dấu - và _", "warning");
    return;
  }
  if (folder !== axCurrentFolder && !(await axConfirmDiscard())) return;
  document.getElementById("ax-path-input").value = folder;
  await axOpenFolder(folder);
}

/**
 * Mở thư mục con trong assets/. Thư mục chưa tồn tại KHÔNG bị tạo ngay — chỉ
 * tạo lúc upload ảnh đầu tiên, để gõ nhầm tên không đẻ ra thư mục rác.
 */
async function axOpenFolder(folder, { silent = false } = {}) {
  if (!axRootHandle) return;

  axCurrentFolder = folder;
  try {
    localStorage.setItem(AX_LAST_FOLDER_KEY, folder);
  } catch (e) {}

  try {
    axDirHandle = await axRootHandle.getDirectoryHandle(folder, { create: false });
  } catch (e) {
    axDirHandle = null;
    if (e.name !== "NotFoundError" && e.name !== "TypeMismatchError") {
      console.error(e);
      showToast("Không mở được thư mục: " + e.message, "error");
      axClosePanel();
      return;
    }
    if (!silent) {
      showToast(`Chưa có thư mục ${folder}/ — sẽ tạo khi upload ảnh đầu tiên`, "warning");
    }
  }

  await axLoadFiles();
}

function axClosePanel() {
  const panel = document.getElementById("ax-panel");
  if (panel) panel.classList.add("hidden");
  axClearGrid();
  axRevokePreviews(axFiles);
  axRevokePreviews(axPending);
  axFiles = [];
  axPending = [];
  axFocalDirty = false;
  axDirHandle = null;
}

/**
 * Hỏi trước khi rời thư mục đang có thay đổi chưa lưu (ảnh chờ + điểm lấy nét
 * chỉ nằm trong RAM, đổi thư mục là mất sạch).
 * @returns {Promise<boolean>} true = cứ đi tiếp
 */
async function axConfirmDiscard() {
  if (!axIsDirty()) return true;
  const what = axPending.length
    ? `${axPending.length} ảnh đang chờ lưu`
    : "điểm lấy nét vừa chỉnh";
  return showConfirm(
    "Bỏ thay đổi chưa lưu?",
    `Thư mục ${axFolderUrl()}/ còn ${what}.\nRời đi bây giờ là mất phần chưa lưu.`,
    { confirmText: "Bỏ thay đổi" },
  );
}

// Trả dropdown về đúng thư mục đang mở (dùng khi người dùng huỷ ở hộp thoại xác nhận).
function axSyncSelectToCurrent() {
  const select = document.getElementById("ax-preset-select");
  const preset = AX_PRESETS.find((p) => p.folder === axCurrentFolder);
  select.value = axCurrentFolder ? (preset ? preset.value : AX_CUSTOM_VALUE) : "";
  document
    .getElementById("ax-custom-path-wrap")
    .classList.toggle("hidden", !axCurrentFolder || !!preset);
}

// ============= Đọc & render danh sách ảnh =============

// Luôn gọi SAU khi đã vẽ lại grid: thu hồi blob URL lúc <img> cũ còn trong DOM
// thì ảnh chưa kịp tải (loading="lazy") sẽ báo ERR_FILE_NOT_FOUND ra console.
function axRevokePreviews(list) {
  list.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
}

// Điểm lấy nét của ảnh có sẵn nằm trong manifest.json — file duy nhất mang
// metadata của thư mục.
async function axReadManifestFocals(dirHandle) {
  try {
    const file = await (await dirHandle.getFileHandle(AX_MANIFEST_NAME)).getFile();
    const json = JSON.parse(await file.text());
    const map = {};
    (json.images || []).forEach((img) => {
      if (img?.file && img.focal_point) map[img.file] = img.focal_point;
    });
    return map;
  } catch (e) {
    return {}; // chưa có manifest / hỏng → coi như mọi ảnh ở giữa
  }
}

/**
 * @param {Object} [focalOverrides] { "<tên file>": {x,y} } — điểm lấy nét vừa
 *   chọn cho ảnh mới ghi, manifest trên đĩa chưa kịp biết.
 */
async function axLoadFiles(focalOverrides = null) {
  if (!axCurrentFolder) return;

  const prevFiles = axFiles;
  axFiles = [];

  if (axDirHandle) {
    showLoading(true, "Đang đọc thư mục...");
    try {
      const focals = await axReadManifestFocals(axDirHandle);
      const handles = [];
      for await (const [name, handle] of axDirHandle.entries()) {
        if (handle.kind === "file" && AX_IMAGE_EXT_RE.test(name)) {
          handles.push([name, handle]);
        }
      }
      handles.sort((a, b) =>
        a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }),
      );

      for (const [name, handle] of handles) {
        const file = await handle.getFile();
        const dim = await ImageHelper.getImageDimensions(file).catch(() => null);
        const focal = focalOverrides?.[name] || focals[name] || { ...AX_DEFAULT_FOCAL };
        axFiles.push({
          name,
          size: file.size,
          dim,
          focal,
          previewUrl: URL.createObjectURL(file),
        });
      }
    } catch (e) {
      console.error(e);
      showToast("Không đọc được thư mục: " + e.message, "error");
    } finally {
      showLoading(false);
    }
  }

  axRenderPanel();
  axRevokePreviews(prevFiles);
}

function axFormatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Đường dẫn dùng được luôn trong code/HTML: tính từ gốc site (assets/ nằm ngay
// gốc repo) nên không phụ thuộc file đang nằm sâu mấy tầng.
function axFolderUrl() {
  return `/${axRootHandle?.name || "assets"}/${axCurrentFolder}`;
}

function axPublicUrl(name) {
  return `${axFolderUrl()}/${name}`;
}

function axRenderPanel() {
  const panel = document.getElementById("ax-panel");
  panel.classList.remove("hidden");

  const limits = axLimitsFor(axCurrentFolder);
  document.getElementById("ax-path-label").textContent = `${axFolderUrl()}/`;

  const totalBytes = axFiles.reduce((sum, f) => sum + f.size, 0);
  const meta = [];
  if (limits.label) meta.push(limits.label);
  meta.push(
    axDirHandle
      ? `${axFiles.length} ảnh · ${axFormatSize(totalBytes)}`
      : "Thư mục chưa tồn tại — sẽ tạo khi lưu",
  );
  if (axPending.length) meta.push(`${axPending.length} ảnh chờ lưu`);
  if (limits.note) meta.push(limits.note);
  document.getElementById("ax-folder-meta").textContent = meta.join(" · ");

  document.getElementById("ax-limit-hint").textContent =
    `Ảnh vượt ${limits.maxPx}px hoặc ${axFormatSize(limits.maxSizeMB * 1024 * 1024)} sẽ được nén ngay khi thả vào (GIF/SVG giữ nguyên)`;

  axRenderGrid();
  axRenderSaveBar();
}

function axIsDirty() {
  return axPending.length > 0 || axFocalDirty;
}

function axRenderSaveBar() {
  const btn = document.getElementById("ax-save-btn");
  const status = document.getElementById("ax-dirty-status");
  if (!btn || !status) return;
  const dirty = axIsDirty();
  btn.disabled = !dirty;
  btn.classList.toggle("opacity-50", !dirty);
  status.classList.toggle("hidden", !dirty);
  status.textContent = axPending.length
    ? `● ${axPending.length} ảnh chờ lưu vào thư mục`
    : "● Điểm lấy nét đã đổi, chưa lưu";
}

// Nền ca-rô để thấy vùng trong suốt của icon PNG.
const AX_CHECKER_STYLE =
  "background-image:" +
  "linear-gradient(45deg,#f1f5f9 25%,transparent 25%)," +
  "linear-gradient(-45deg,#f1f5f9 25%,transparent 25%)," +
  "linear-gradient(45deg,transparent 75%,#f1f5f9 75%)," +
  "linear-gradient(-45deg,transparent 75%,#f1f5f9 75%);" +
  "background-size:16px 16px;" +
  "background-position:0 0,0 8px,8px -8px,-8px 0;";

// Gỡ node KHÔNG huỷ ngay lượt tải ảnh đang dở: thu hồi blob URL sau đó là
// Chrome bắn ERR_FILE_NOT_FOUND ra console. Bỏ src trước thì lượt tải bị huỷ hẳn.
function axClearGrid() {
  const grid = document.getElementById("ax-grid");
  if (!grid) return;
  grid.querySelectorAll("img").forEach((img) => img.removeAttribute("src"));
  grid.innerHTML = "";
}

function axIsDefaultFocal(focal) {
  return !focal || (focal.x === AX_DEFAULT_FOCAL.x && focal.y === AX_DEFAULT_FOCAL.y);
}

/**
 * Một ô ảnh. Nút chỉnh điểm lấy nét nằm GÓC DƯỚI TRÁI và chỉ hiện khi rê chuột
 * (hoặc khi ảnh đã được chỉnh) — mặc định không bày ra, giống tab Dữ liệu mẫu.
 * @param {Object} item ảnh trên đĩa hoặc ảnh chờ lưu
 * @param {{ pending?: boolean, title: string, subtitle: string }} opts
 */
function axBuildCard(item, opts) {
  const card = document.createElement("div");
  card.className =
    "group relative rounded-xl border overflow-hidden bg-white transition-colors " +
    (opts.pending
      ? "border-amber-300 hover:border-amber-400"
      : "border-gray-200 hover:border-rose-300");

  const focalMoved = !axIsDefaultFocal(item.focal);
  card.innerHTML = `
    <div class="aspect-square flex items-center justify-center p-3" style="${AX_CHECKER_STYLE}">
      <img src="${item.previewUrl}" alt="${escapeHtml(opts.title)}" loading="lazy" class="max-w-full max-h-full object-contain" />
    </div>
    <div class="p-2 border-t border-gray-100">
      <div class="text-xs font-medium text-gray-700 truncate" title="${escapeHtml(opts.title)}">${escapeHtml(opts.title)}</div>
      <div class="text-[11px] text-gray-400 mt-0.5">${escapeHtml(opts.subtitle)}</div>
    </div>
    ${
      opts.pending
        ? '<span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-medium">Chờ lưu</span>'
        : ""
    }
    <button type="button" data-act="focal" title="Chỉnh điểm lấy nét"
      class="absolute bottom-14 left-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-opacity ${
        focalMoved ? "" : "opacity-0 group-hover:opacity-100"
      }">
      <i class="fas fa-crosshairs text-xs"></i>
    </button>
    <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      ${
        opts.pending
          ? ""
          : `<button type="button" data-act="copy" title="Copy đường dẫn" class="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center">
               <i class="fas fa-link text-xs"></i>
             </button>`
      }
      <button type="button" data-act="remove" title="${opts.pending ? "Bỏ ảnh này" : "Xoá ảnh"}" class="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
  `;
  return card;
}

function axRenderGrid() {
  const grid = document.getElementById("ax-grid");
  const empty = document.getElementById("ax-empty");
  axClearGrid();
  empty.classList.toggle("hidden", axFiles.length + axPending.length > 0);

  axFiles.forEach((f) => {
    const dimText = f.dim ? ` · ${f.dim.width}×${f.dim.height}` : "";
    const focalText = axIsDefaultFocal(f.focal) ? "" : ` · 🎯 ${f.focal.x}/${f.focal.y}`;
    const card = axBuildCard(f, {
      title: f.name,
      subtitle: `${axFormatSize(f.size)}${dimText}${focalText}`,
    });
    // Gắn listener thay vì nhét tên file vào onclick="" — tên file có thể chứa
    // dấu nháy làm vỡ attribute.
    card.querySelector('[data-act="copy"]').onclick = () =>
      axCopy(axPublicUrl(f.name), "Đã copy đường dẫn");
    card.querySelector('[data-act="remove"]').onclick = () => axDeleteFile(f.name);
    card.querySelector('[data-act="focal"]').onclick = () => axAdjustFocal(f, false);
    grid.appendChild(card);
  });

  axPending.forEach((p, idx) => {
    const dimText = p.dim ? ` · ${p.dim.width}×${p.dim.height}` : "";
    const focalText = axIsDefaultFocal(p.focal) ? "" : ` · 🎯 ${p.focal.x}/${p.focal.y}`;
    const card = axBuildCard(p, {
      pending: true,
      title: p.file.name,
      subtitle: `${axFormatSize(p.size)}${dimText}${focalText}`,
    });
    card.querySelector('[data-act="remove"]').onclick = () => axRemovePending(idx);
    card.querySelector('[data-act="focal"]').onclick = () => axAdjustFocal(p, true);
    grid.appendChild(card);
  });
}

// Ảnh đã lưu đổi điểm lấy nét → chỉ manifest.json cần ghi lại, nên vẫn phải bấm
// Lưu (không lén ghi đĩa sau lưng người dùng).
function axAdjustFocal(item, isPending) {
  openFocalPointPicker(item.previewUrl, item.focal, (focal) => {
    item.focal = focal;
    if (!isPending) axFocalDirty = true;
    axRenderPanel();
    showToast("Đã cập nhật điểm lấy nét — nhớ bấm Lưu", "success");
  });
}

function axRemovePending(idx) {
  const [removed] = axPending.splice(idx, 1);
  if (removed?.previewUrl) {
    axClearGrid(); // huỷ lượt tải đang dở trước khi thu hồi blob
    URL.revokeObjectURL(removed.previewUrl);
  }
  axRenderPanel();
}

async function axCopy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMsg, "success");
  } catch (e) {
    showAlert("Copy thủ công", text, "info");
  }
}

function axCopyAllPaths() {
  if (!axFiles.length) {
    showToast("Thư mục chưa có ảnh nào", "warning");
    return;
  }
  return axCopy(
    axFiles.map((f) => axPublicUrl(f.name)).join("\n"),
    `Đã copy ${axFiles.length} đường dẫn`,
  );
}

// ============= Chọn ảnh → hàng chờ (chưa đụng đĩa) =============

function axBindDropzone() {
  const zone = document.getElementById("ax-dropzone");
  if (!zone || zone.dataset.bound) return;
  zone.dataset.bound = "1";

  zone.addEventListener("click", () =>
    document.getElementById("ax-file-input").click(),
  );

  const hl = (on) => (e) => {
    e.preventDefault();
    zone.classList.toggle("border-rose-400", on);
    zone.classList.toggle("bg-rose-50", on);
  };
  zone.addEventListener("dragenter", hl(true));
  zone.addEventListener("dragover", hl(true));
  zone.addEventListener("dragleave", hl(false));
  zone.addEventListener("drop", (e) => {
    hl(false)(e);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) axStageFiles(files);
  });
}

function axHandleUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  return axStageFiles(files);
}

/**
 * Nhận nhiều ảnh cùng lúc và xếp vào hàng chờ. KHÔNG ghi gì xuống đĩa.
 *
 * Nén NGAY TẠI ĐÂY, đúng một lần — cùng quy ước với tab Dữ liệu mẫu và luồng
 * khách ở invitation-setup (ImageHelper.prepareImage). Bấm Lưu chỉ còn ghi thẳng
 * blob xuống đĩa. Nhờ vậy dung lượng/kích thước hiện trong hàng chờ cũng là số
 * THẬT sẽ nằm trên đĩa, chứ không phải số của bản gốc.
 *
 * Ngưỡng lấy theo danh mục đang mở — đổi thư mục thì axConfirmDiscard() bắt dọn
 * hàng chờ trước, nên ảnh trong hàng chờ luôn thuộc đúng danh mục này.
 */
async function axStageFiles(files) {
  if (!axRootHandle || !axCurrentFolder) {
    showToast("Chưa chọn thư mục đích", "warning");
    return;
  }

  const images = files.filter((f) => f.type.startsWith("image/"));
  const notImages = files.length - images.length;
  if (!images.length) {
    showToast("Không có file ảnh nào", "warning");
    return;
  }

  const limits = axLimitsFor(axCurrentFolder);
  const imageLimits = {
    maxWidth: limits.maxPx,
    maxHeight: limits.maxPx,
    maxSizeMB: limits.maxSizeMB,
  };

  let compressed = 0;
  let savedBytes = 0;

  showLoading(true, `Đang đọc ${images.length} ảnh...`);
  try {
    for (let i = 0; i < images.length; i++) {
      const original = images[i];
      showLoading(true, `Đang xử lý ảnh ${i + 1}/${images.length}...`);

      let file = original;
      try {
        const res = await ImageHelper.prepareImage(original, imageLimits);
        if (res.compressed) {
          file = res.file;
          savedBytes += res.savedBytes;
          compressed++;
        }
      } catch (e) {
        // Nén lỗi (ảnh > 50MB, file hỏng…) không được chặn cả mẻ — giữ bản gốc.
        console.warn("Không nén được ảnh, giữ nguyên bản gốc:", original.name, e);
      }

      const dim = await ImageHelper.getImageDimensions(file).catch(() => null);
      axPending.push({
        file,
        size: file.size,
        dim,
        focal: { ...AX_DEFAULT_FOCAL },
        previewUrl: URL.createObjectURL(file),
      });
    }
  } finally {
    showLoading(false);
  }

  axRenderPanel();
  const msg = [`Đã thêm ${images.length} ảnh vào hàng chờ — bấm Lưu để ghi`];
  if (compressed) msg.push(`nén ${compressed} ảnh (giảm ${axFormatSize(savedBytes)})`);
  if (notImages) msg.push(`bỏ qua ${notImages} file không phải ảnh`);
  showToast(msg.join(" · "), notImages ? "warning" : "success");
}

// Đuôi file lấy theo blob SAU khi nén (canvas có thể đổi định dạng), không có
// thì giữ đuôi gốc.
function axExtFromBlob(blob, originalName) {
  const type = (blob.type || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("svg")) return "svg";
  if (type.includes("gif")) return "gif";
  if (type.includes("avif")) return "avif";
  const m = /\.([a-z0-9]+)$/i.exec(originalName || "");
  return m ? m[1].toLowerCase() : "png";
}

// Tên file KHÔNG lấy theo tên gốc (ảnh tải về hay có kiểu
// "chatgpt-image-18-26-48-30-thg-7-2026.png") mà đặt theo tên thư mục + số thứ
// tự: flowers_01.png, flowers_02.png… Số chạy tiếp từ số lớn nhất đang có nên
// KHÔNG bao giờ đè lên ảnh cũ (ảnh cũ có thể đang được thiệp thật dùng).
function axIndexFromName(name, folder) {
  const esc = folder.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const m = new RegExp(`^${esc}_(\\d+)\\.`, "i").exec(name);
  return m ? parseInt(m[1], 10) : 0;
}

// Số kế tiếp = max hiện có + 1, tính trên MỌI đuôi file: flowers_01.png đã có
// thì ảnh .webp mới cũng không được mang số 01 (nhìn vào tưởng cùng một ảnh).
function axNextIndex(taken, folder) {
  let max = 0;
  taken.forEach((name) => {
    max = Math.max(max, axIndexFromName(name, folder));
  });
  return max + 1;
}

function axIndexedName(folder, index, ext) {
  return `${folder}_${String(index).padStart(2, "0")}.${ext}`;
}

async function axWriteFile(dirHandle, filename, blob) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * Ghi lại manifest.json của thư mục — vừa là danh sách ảnh cho web đọc, vừa là
 * chỗ duy nhất lưu điểm lấy nét. Gọi SAU axLoadFiles(): danh sách lấy thẳng từ
 * axFiles nên luôn khớp đĩa.
 */
async function axSyncManifest() {
  if (!axDirHandle) return;

  const json = {
    path: axFolderUrl(),
    updated_at: new Date().toISOString(),
    images: axFiles.map((f) => ({
      file: f.name,
      url: axPublicUrl(f.name),
      width: f.dim?.width || null,
      height: f.dim?.height || null,
      size: f.size,
      focal_point: f.focal || { ...AX_DEFAULT_FOCAL },
    })),
  };

  try {
    await axWriteFile(
      axDirHandle,
      AX_MANIFEST_NAME,
      new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
    );
  } catch (e) {
    console.error("Không ghi được manifest.json:", e);
    showToast("Ảnh đã lưu nhưng không ghi được manifest.json — xem console", "warning");
  }
}

// ============= Lưu xuống thư mục =============

/**
 * Nén + ghi toàn bộ ảnh đang chờ, rồi ghi lại manifest.json (kèm điểm lấy nét
 * của cả ảnh cũ). Đây là chỗ DUY NHẤT động vào đĩa ngoài nút Xoá.
 */
async function axSaveChanges() {
  if (!axRootHandle || !axCurrentFolder || !axIsDirty()) return;

  const btn = document.getElementById("ax-save-btn");
  btn.disabled = true;

  // Đến lúc thật sự có ảnh mới tạo thư mục.
  if (!axDirHandle) {
    try {
      axDirHandle = await axRootHandle.getDirectoryHandle(axCurrentFolder, {
        create: true,
      });
    } catch (e) {
      console.error(e);
      showToast("Không tạo được thư mục: " + e.message, "error");
      axRenderSaveBar();
      return;
    }
  }

  // Tên đã có trên đĩa (lowercase: macOS/Windows không phân biệt hoa thường).
  const taken = new Set(axFiles.map((f) => f.name.toLowerCase()));
  for await (const [name, handle] of axDirHandle.entries()) {
    if (handle.kind === "file") taken.add(name.toLowerCase());
  }

  let nextIndex = axNextIndex(taken, axCurrentFolder);
  // Điểm lấy nét đang giữ trong RAM (ảnh cũ vừa chỉnh + ảnh mới sắp ghi).
  // axLoadFiles() đọc lại manifest CŨ nên thiếu map này là mất hết chỉnh sửa.
  const newFocals = {};
  axFiles.forEach((f) => {
    newFocals[f.name] = f.focal;
  });
  const savedNames = [];
  const leftover = []; // ảnh ghi lỗi → giữ trong hàng chờ để thử lại
  const errors = [];

  const total = axPending.length;
  try {
    for (let i = 0; i < total; i++) {
      const item = axPending[i];
      showLoading(true, `Đang ghi ảnh ${i + 1}/${total}...`);
      try {
        // item.file đã được nén sẵn lúc thả vào hàng chờ (axStageFiles) →
        // ở đây chỉ ghi thẳng.
        const filename = axIndexedName(
          axCurrentFolder,
          nextIndex,
          axExtFromBlob(item.file, item.file.name),
        );
        await axWriteFile(axDirHandle, filename, item.file);
        // Chỉ nhích số khi ghi XONG: ảnh lỗi không để lại lỗ hổng số thứ tự.
        nextIndex++;
        taken.add(filename.toLowerCase());
        newFocals[filename] = item.focal;
        savedNames.push(filename);
      } catch (e) {
        console.error("Không ghi được ảnh:", item.file.name, e);
        errors.push(`${item.file.name}: ${e.message || e.name}`);
        leftover.push(item);
      }
    }
  } finally {
    showLoading(false);
  }

  // Ảnh đã ghi xong thì bỏ khỏi hàng chờ (ảnh lỗi ở lại để bấm Lưu lần nữa).
  axClearGrid();
  axPending
    .filter((p) => !leftover.includes(p))
    .forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
  axPending = leftover;

  await axLoadFiles(newFocals);
  await axSyncManifest();
  axFocalDirty = false;
  axRenderPanel();

  if (savedNames.length) {
    const range =
      savedNames.length > 1
        ? `${savedNames[0]} → ${savedNames[savedNames.length - 1]}`
        : savedNames[0];
    showToast(
      `Đã lưu ${savedNames.length} ảnh vào ${axFolderUrl()}/ (${range})`,
      "success",
    );
  } else if (!errors.length) {
    showToast("Đã lưu điểm lấy nét vào manifest.json", "success");
  }

  if (errors.length) {
    showAlert(
      `${errors.length} ảnh lỗi`,
      errors.slice(0, 10).join("\n") +
        (errors.length > 10 ? `\n… và ${errors.length - 10} ảnh khác` : ""),
      "error",
    );
  }
}

// ============= Xoá ảnh =============

async function axDeleteFile(name) {
  if (!axDirHandle) return;
  const ok = await showConfirm(
    "Xoá ảnh?",
    `Xoá "${name}" khỏi ${axFolderUrl()}/.\nẢnh đang được thiệp nào đó dùng sẽ vỡ ảnh. Không hoàn tác được.`,
    { confirmText: "Xoá" },
  );
  if (!ok) return;

  // Điểm lấy nét đang chỉnh dở của những ảnh CÒN LẠI phải giữ, nếu không nạp
  // lại từ manifest là mất. Xoá vốn đã ghi đĩa nên tiện thể ghi luôn manifest →
  // hết dirty.
  const keepFocals = {};
  axFiles.forEach((f) => {
    if (f.name !== name) keepFocals[f.name] = f.focal;
  });

  try {
    // Blob preview trỏ thẳng vào file trên đĩa: xoá file trước khi gỡ <img>
    // (ảnh loading="lazy" chưa kịp tải) là Chrome báo ERR_FILE_NOT_FOUND.
    axClearGrid();
    await axDirHandle.removeEntry(name);
    showToast("Đã xoá " + name, "success");
  } catch (e) {
    console.error(e);
    showToast("Không xoá được: " + e.message, "error");
  }
  await axLoadFiles(keepFocals);
  await axSyncManifest();
  axFocalDirty = false;
  axRenderSaveBar();
}
