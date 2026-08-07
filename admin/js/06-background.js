// ============= TAB "Ảnh nền": dán HTML, xem trước, chụp thành ảnh =============
// Nền là file ảnh tĩnh trong repo, KHÔNG phải dữ liệu trong DB → ghi xong phải
// commit & push mới lên production.
//
// Luồng: admin tự dán mã HTML → bấm Run xem trong iframe → "Chụp thành ảnh nền"
// ra WebP → ghi xuống đĩa. HTML chỉ là bản vẽ trung gian, không lưu lại và không
// bao giờ chèn vào DOM của trang.
//
// NGUYÊN TẮC: iframe thấy gì thì ảnh chụp phải ra đúng thế. Bước chụp vì vậy tự
// dò MỌI tài nguyên mà mã tham chiếu rồi nhúng vào (xem bgInlineAssets) — không
// dựa vào danh sách ảnh đã chọn. Bảng "Đường dẫn ảnh" chỉ là tiện ích chép đường
// dẫn, bỏ trống vẫn chụp bình thường.
//
// Quy ước:
// 1. Một "nền" = MỘT BỘ nhiều biến thể khổ màn hình (desktop + mobile), tên file
//    là <tên nền>-<biến thể>.webp. Web chọn bộ MỚI NHẤT (theo updated_at trong
//    manifest) rồi mới chọn biến thể hợp màn hình — chọn theo bộ nên không bao
//    giờ lệch desktop một nền, mobile một nền.
// 2. Trùng tên là GHI ĐÈ (có hỏi lại). Khác tab "Ảnh mẫu" — bên đó tự đánh số để
//    không bao giờ ghi đè.
// 3. manifest.json là NƠI DUY NHẤT web đọc được danh sách nền (GitHub Pages
//    không cho liệt kê thư mục qua HTTP).
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

// Dùng CHUNG handle thư mục assets/ với tab "Ảnh mẫu" (cùng key, cùng store):
// admin kết nối một lần là cả hai tab dùng được. siIdbGet/siIdbPut khai ở
// 03-sample-images.js, SI_IDB_STORE cũng vậy — file này luôn nạp sau.
const BG_IDB_KEY = "assets-root";
const BG_MANIFEST_NAME = "manifest.json";
const BG_MAX_MB = 1.2; // trần dung lượng ảnh nền ghi ra đĩa
const BG_CAPTURE_QUALITY = 0.9;
const BG_HTML_LS_KEY = "bg_html_draft"; // mã đang soạn, giữ qua F5

let bgRootHandle = null; // thư mục assets/
let bgDirHandle = null; // thư mục đích của slot đang chọn
let bgItems = []; // nền đã có: [{ name, updated_at, variants: {key: filename} }]
let bgPhotos = []; // bảng tra đường dẫn: [{ path, w, h }] — KHÔNG liên quan tới việc chụp
let bgPendingBlob = null; // ảnh đã chụp, chưa lưu
let bgPreviewUrl = ""; // blob: URL của ảnh xem trước (phải revoke khi thay)

// ============= Init tab =============

async function initBackgroundPanel() {
  if (!("showDirectoryPicker" in window)) {
    document.getElementById("bg-unsupported-banner").classList.remove("hidden");
    document.getElementById("bg-body").classList.add("hidden");
    return;
  }

  bgPopulateSlotDropdown();

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

/**
 * Mở (tạo nếu chưa có) thư mục đích của slot. Đường dẫn NHIỀU CẤP nên đi lần
 * lượt từng đoạn — getDirectoryHandle chỉ nhận một cấp mỗi lần.
 * `create: false` để chỉ xem, không tự tạo thư mục rỗng khi mới mở tab.
 */
async function bgOpenSlotDir(slot, { create = false } = {}) {
  if (!bgRootHandle) return null;
  let dir = bgRootHandle;
  for (const part of slot.folder.split("/")) {
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

  bgInitEditor();
  onBackgroundVariantChange();
  bgClearPreview();

  bgDirHandle = await bgOpenSlotDir(slot);
  await bgLoadExisting();
}

function onBackgroundVariantChange() {
  const v = bgVariant();
  document.getElementById("bg-variant-note").textContent = `Khổ ${v.w}×${v.h}px`;
  bgUpdateFilenameHint();
  // Đổi khổ thì khung xem trước phải đo lại, không thì vẫn đang theo khổ cũ.
  bgFitPreview();
}

function bgUpdateFilenameHint() {
  const base = bgSlugify(document.getElementById("bg-name-input")?.value || "");
  const hint = document.getElementById("bg-filename-hint");
  if (!hint) return;
  hint.textContent = base
    ? `Ghi ra: ${bgSlot().folder}/${base}-${bgVariant().key}.webp`
    : "Chỉ dùng chữ thường, số và dấu gạch ngang.";
}

// ============= Bảng tra đường dẫn ảnh =============
// Thuần tiện ích: chép đường dẫn để dán vào mã. KHÔNG dính gì tới bước chụp —
// mã trỏ ảnh nào thì lúc chụp dò đúng ảnh đó, kể cả khi bảng này rỗng.

/**
 * Chọn ảnh CÓ SẴN trong assets/ để lấy đường dẫn WEB (/assets/…) — đó mới là thứ
 * dùng được trong HTML, chạy cả ở local lẫn GitHub Pages. resolve() trả null
 * nghĩa là file nằm ngoài thư mục đã kết nối → không suy ra được đường dẫn web.
 */
async function bgPickPhotos() {
  if (!bgRootHandle) {
    showToast("Hãy kết nối thư mục assets/ trước", "error");
    return;
  }
  try {
    const handles = await window.showOpenFilePicker({
      id: "cx-assets-root",
      multiple: true,
      types: [
        {
          description: "Ảnh",
          accept: { "image/*": [".webp", ".jpg", ".jpeg", ".png", ".avif", ".gif", ".svg"] },
        },
      ],
    });

    let outside = 0;
    for (const handle of handles) {
      const segs = await bgRootHandle.resolve(handle);
      if (!segs) {
        outside++;
        continue;
      }
      const path = "/assets/" + segs.join("/");
      if (bgPhotos.some((p) => p.path === path)) continue;

      const dim = await bgImageSize(path);
      bgPhotos.push({ path, w: dim.w, h: dim.h });
    }

    if (outside) {
      showToast(
        `${outside} ảnh nằm ngoài thư mục assets/ nên bỏ qua — hãy copy ảnh vào assets/ trước`,
        "error",
      );
    }
    bgRenderPhotos();
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error(e);
      showToast("Lỗi chọn ảnh: " + e.message, "error");
    }
  }
}

/** Kích thước thật của ảnh, đọc qua HTTP. Lỗi thì trả 0 (vẫn hiện được đường dẫn). */
function bgImageSize(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = path;
  });
}

function bgRemovePhoto(path) {
  bgPhotos = bgPhotos.filter((p) => p.path !== path);
  bgRenderPhotos();
}

async function bgCopyPath(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Đã chép ${label}`, "success");
  } catch {
    showToast("Trình duyệt chặn chép tự động — hãy bôi đen rồi Ctrl+C", "error");
  }
}

function bgCopyAllPaths() {
  if (!bgPhotos.length) return;
  bgCopyPath(bgPhotos.map((p) => p.path).join("\n"), `${bgPhotos.length} đường dẫn`);
}

function bgRenderPhotos() {
  const list = document.getElementById("bg-photo-list");
  const empty = document.getElementById("bg-photo-empty");
  const count = document.getElementById("bg-photo-count");

  list.innerHTML = "";
  empty.classList.toggle("hidden", bgPhotos.length > 0);
  count.textContent = bgPhotos.length ? `— ${bgPhotos.length} ảnh` : "";
  document
    .getElementById("bg-copy-all-btn")
    .classList.toggle("hidden", bgPhotos.length === 0);

  bgPhotos.forEach((p) => {
    const el = document.createElement("div");
    el.className = "flex items-center gap-2 rounded-lg border border-gray-200 p-1.5";
    el.innerHTML = `
      <div class="w-10 h-10 shrink-0 rounded bg-[rgb(var(--checkerboard-rgb))] overflow-hidden">
        <img src="${escapeHtml(p.path)}" alt="" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[11px] font-mono text-gray-700 truncate" title="${escapeHtml(p.path)}">
          ${escapeHtml(p.path)}
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] text-gray-400">${p.w}×${p.h}</span>
          <button type="button" data-act="copy" class="text-[10px] text-rose-500 underline">Chép</button>
          <button type="button" data-act="del" class="text-[10px] text-gray-400 underline">Bỏ</button>
        </div>
      </div>`;
    el.querySelector('[data-act="copy"]').onclick = () => bgCopyPath(p.path, "đường dẫn");
    el.querySelector('[data-act="del"]').onclick = () => bgRemovePhoto(p.path);
    list.appendChild(el);
  });
}

// ============= Soạn mã + xem trước bằng iframe =============

/** Ô soạn mã của <x-textarea>. Gọi sau khi component đã upgrade (loader nạp trước). */
function bgHtmlBox() {
  return document.querySelector("#bg-editor-wrap textarea#bg-html-source");
}

/**
 * Gắn cụm Hoàn tác/Làm lại + khôi phục bản nháp. Gọi mỗi lần mở tab; attachUndoRedo
 * tự bỏ qua lần gọi thứ hai trên cùng ô nên không nhân đôi thanh công cụ.
 */
function bgInitEditor() {
  const box = bgHtmlBox();
  if (!box || box.dataset.cxReady) return;
  box.dataset.cxReady = "1";

  box.value = localStorage.getItem(BG_HTML_LS_KEY) || "";
  box.addEventListener("input", () => {
    localStorage.setItem(BG_HTML_LS_KEY, box.value);
  });
  if (window.attachUndoRedo) attachUndoRedo(box, { max: 100 });
  if (box.value) bgRunPreview();
}

/**
 * Đo lại khung xem trước: iframe luôn ở kích thước THẬT của khổ rồi thu nhỏ bằng
 * transform, nhờ vậy mã bên trong không phải biết gì về việc đang bị thu nhỏ.
 * Tách riêng khỏi bgRunPreview để lúc kéo cửa sổ chỉ chỉnh tỉ lệ, không nạp lại
 * nội dung (đỡ nháy).
 */
function bgFitPreview() {
  const frame = document.getElementById("bg-iframe");
  const boxEl = document.getElementById("bg-iframe-box");
  if (!frame || !boxEl) return;

  const v = bgVariant();
  const scale = Math.min(1, (boxEl.clientWidth || v.w) / v.w);

  frame.style.width = v.w + "px";
  frame.style.height = v.h + "px";
  frame.style.transform = `scale(${scale})`;
  boxEl.style.height = Math.round(v.h * scale) + "px";
  document.getElementById("bg-preview-scale").textContent =
    `${v.w}×${v.h} · thu ${Math.round(scale * 100)}%`;
}

/**
 * Đổ mã đang soạn vào iframe. `sandbox=""` chặn hẳn script — khớp với bgSanitizeHtml
 * ở bước chụp, nên hai bên cho ra cùng một kết quả. Đường dẫn trong srcdoc giải theo
 * URL trang admin, đúng bằng cách bgUrlToDataUrl giải lúc chụp.
 */
function bgRunPreview() {
  const box = bgHtmlBox();
  const frame = document.getElementById("bg-iframe");
  if (!box || !frame) return;
  bgFitPreview();
  frame.srcdoc = box.value;
}

// Kéo cửa sổ → chỉ đo lại tỉ lệ, không nạp lại nội dung.
window.addEventListener("resize", bgFitPreview);

// ============= Chụp thành ảnh =============

async function captureBackground() {
  const box = bgHtmlBox();
  const btn = document.getElementById("bg-capture-btn");
  const status = document.getElementById("bg-capture-status");
  if (!box || !box.value.trim()) {
    showToast("Chưa có mã HTML nào để chụp", "error");
    return;
  }
  const v = bgVariant();

  btn.dataset.loading = "1";
  status.textContent = "Đang chụp…";
  try {
    const html = bgSanitizeHtml(box.value);
    if (!html) throw new Error("chưa có nội dung");

    const { file, failed } = await bgCaptureHtml(html, v.w, v.h);
    bgSetPreview(file);
    status.textContent = `Xong — ${Math.round(file.size / 1024)}KB`;
    // Không im lặng nuốt: ảnh tải không nổi thì nó THIẾU trong file, dù iframe
    // có thể vẫn hiện (vd ảnh khác origin bị CORS chặn đọc).
    if (failed.length) {
      showToast(
        `Chụp xong nhưng ${failed.length} tài nguyên không nhúng được nên bị thiếu: ` +
          failed.slice(0, 3).join(", ") +
          (failed.length > 3 ? "…" : ""),
        "warning",
      );
    }
    document.getElementById("bg-preview-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    console.error(e);
    status.textContent = "";
    showToast("Không chụp được: " + e.message, "error");
  } finally {
    btn.dataset.loading = "";
  }
}

/**
 * Bỏ những thứ CHẠY ĐƯỢC khỏi mã trước khi đem chụp.
 *
 * Chỉ gỡ đúng phần script — KHÔNG đụng tới tham chiếu ảnh/font, vì bước chụp phải
 * ra đúng thứ iframe đang hiện. Cũng vì thế danh sách này khớp với những gì
 * `sandbox=""` của iframe vốn đã chặn, nên hai bên nhìn giống nhau.
 * Không cắt phần trước <html>: mã tự viết có thể mở đầu bằng <!DOCTYPE>, comment
 * hoặc chỉ là một mẩu <div> — cứ để nguyên, trình duyệt tự bọc.
 */
function bgSanitizeHtml(raw) {
  return String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<\/?form\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * Dò MỌI tài nguyên mã đang trỏ tới rồi nhúng thành data: URI.
 *
 * Đây là chỗ giữ lời hứa "iframe thấy gì thì ảnh chụp ra thế": không dựa vào danh
 * sách ảnh đã chọn mà đọc thẳng từ mã, nên mã trỏ ảnh nào cũng chụp được.
 * `data:` và `#…` (gradient/filter nội bộ của SVG) bỏ qua — đã tự chứa sẵn.
 *
 * Trả { html, failed } — `failed` là các đường dẫn tải không nổi, để báo cho admin
 * biết ảnh nào sẽ thiếu thay vì lặng lẽ ra ảnh trống.
 */
async function bgInlineAssets(html) {
  const failed = [];
  let out = await bgInlineStylesheets(html, failed);

  const urls = new Set();
  const push = (u) => {
    const url = String(u || "").trim().replace(/^['"]|['"]$/g, "");
    if (url && !url.startsWith("data:") && !url.startsWith("#")) urls.add(url);
  };

  for (const m of out.matchAll(/\s(?:src|poster|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi)) {
    push(m[1].slice(1, -1));
  }
  for (const m of out.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) push(m[1]);

  for (const url of urls) {
    const dataUrl = await bgUrlToDataUrl(url);
    if (dataUrl) out = out.split(url).join(dataUrl);
    else failed.push(url);
  }
  return { html: out, failed };
}

/**
 * Đổi <link rel="stylesheet"> thành <style> nội dung thật. Phải chạy TRƯỚC bước dò
 * `url()` vì CSS ngoài thường trỏ thêm ảnh — nhúng sau thì sót.
 * Lưu ý: `url()` tương đối bên trong CSS đó được giải theo trang admin chứ không
 * theo vị trí file CSS, nên nên dùng đường dẫn tuyệt đối trong CSS ngoài.
 */
async function bgInlineStylesheets(html, failed) {
  let out = html;
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    const m = tag.match(/href\s*=\s*("[^"]*"|'[^']*')/i);
    if (!m) continue;

    const url = m[1].slice(1, -1);
    const css = await bgUrlToText(url);
    if (css === null) failed.push(url);
    out = out.split(tag).join(css === null ? "" : `<style>${css}</style>`);
  }
  return out;
}

/** Như bgUrlToDataUrl nhưng lấy văn bản (dùng cho CSS). null nếu tải hụt. */
async function bgUrlToText(url) {
  try {
    const res = await fetch(new URL(url, location.href).href, { cache: "force-cache" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Tải một tài nguyên rồi đổi sang data: URI. Giải đường dẫn theo CHÍNH trang admin
 * (giống hệt cách iframe srcdoc giải), nên đường dẫn tương đối hay tuyệt đối đều
 * ra cùng một file ở cả hai nơi. Ảnh khác origin mà chặn CORS thì trả null.
 */
async function bgUrlToDataUrl(url) {
  try {
    const abs = new URL(url, location.href).href;
    const res = await fetch(abs, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Chụp HTML thành ảnh WebP đúng khổ w×h. Trả { file, failed }.
 *
 * Đi qua <foreignObject> trong SVG: đây là cách DUY NHẤT dựng HTML thành bitmap
 * mà không cần thư viện ngoài. Ba ràng buộc phải tôn trọng, sai là ra ảnh trắng:
 *  - Tài nguyên phải NHÚNG thành data: URI. SVG nạp qua <img> là hộp cát không
 *    tải được file ngoài, để nguyên /assets/… là mất ảnh.
 *  - Nội dung phải là XML hợp lệ → chuẩn hoá qua DOMParser + XMLSerializer, vì
 *    HTML viết tay thường thiếu thẻ đóng.
 *  - Dùng data: URI cho chính file SVG (không phải blob:) để canvas không bị
 *    đánh dấu nhiễm bẩn, nếu không toBlob() sẽ ném lỗi bảo mật.
 *
 * Giới hạn của <foreignObject> (không có cách vòng): font tải từ mạng,
 * backdrop-filter và mix-blend-mode không dựng được.
 */
async function bgCaptureHtml(html, w, h) {
  const { html: inlined, failed } = await bgInlineAssets(html);

  const doc = new DOMParser().parseFromString(inlined, "text/html");
  doc.documentElement.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  // Ép khung đúng khổ: mã không đặt kích thước (hoặc đặt lệch) thì ảnh ra bị viền
  // trắng hoặc cắt cụt. Ép ở đây nên mã tự viết không cần nhớ quy tắc này.
  doc.documentElement.setAttribute("style", `width:${w}px;height:${h}px;margin:0;overflow:hidden`);
  if (doc.body) {
    doc.body.setAttribute(
      "style",
      `${doc.body.getAttribute("style") || ""};width:${w}px;height:${h}px;margin:0;overflow:hidden`,
    );
  }
  const xhtml = new XMLSerializer().serializeToString(doc.documentElement);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;

  const img = new Image();
  img.width = w;
  img.height = h;
  img.src = "data:image/svg+xml;charset=utf-8;base64," + bgB64Utf8(svg);
  try {
    await img.decode();
  } catch (e) {
    throw new Error("không dựng được HTML thành ảnh — nhiều khả năng mã sai cú pháp");
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // Nền trắng: HTML trong suốt mà WebP giữ alpha thì hero sẽ nhìn thủng xuống dưới.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", BG_CAPTURE_QUALITY),
  );
  if (!blob) throw new Error("trình duyệt không mã hoá được WebP");

  // Nén thêm CHỈ KHI vượt trần — ảnh nhẹ giữ nguyên chất lượng vừa chụp.
  const { file } = await ImageHelper.compressIfNeeded(
    new File([blob], "bg.webp", { type: "image/webp" }),
    { maxWidth: w, maxHeight: h, maxSizeMB: BG_MAX_MB },
  );
  return { file, failed };
}

/** btoa() chỉ nhận latin1 — HTML có tiếng Việt nên phải qua UTF-8 trước. */
function bgB64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CHUNK = 0x8000; // tránh tràn stack khi spread mảng lớn
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function bgSetPreview(blob) {
  bgPendingBlob = blob;
  if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
  bgPreviewUrl = URL.createObjectURL(blob);
  document.getElementById("bg-preview").src = bgPreviewUrl;
  document.getElementById("bg-preview-wrap").classList.remove("hidden");
  bgUpdateFilenameHint();
}

/** Bỏ ảnh đã chụp. KHÔNG đụng ô soạn mã — sửa tiếp rồi chụp lại là chuyện thường. */
function bgClearPreview() {
  bgPendingBlob = null;
  if (bgPreviewUrl) {
    URL.revokeObjectURL(bgPreviewUrl);
    bgPreviewUrl = "";
  }
  document.getElementById("bg-preview-wrap").classList.add("hidden");
  document.getElementById("bg-capture-status").textContent = "";
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
  if (!bgPendingBlob) {
    showToast("Chưa có ảnh nền nào để lưu", "error");
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

  try {
    bgDirHandle = await bgOpenSlotDir(slot, { create: true });
    if (!bgDirHandle) throw new Error("không mở được thư mục " + slot.folder);

    if (await bgFileExists(bgDirHandle, filename)) {
      const ok = await showConfirm(
        "Ghi đè file?",
        `${slot.folder}/${filename} đã có. Ghi đè bằng ảnh vừa tạo?`,
        { confirmText: "Ghi đè" },
      );
      if (!ok) return;
    }

    const fh = await bgDirHandle.getFileHandle(filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(bgPendingBlob);
    await writable.close();

    await bgLoadExisting();
    await bgSyncManifest();
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
  const list = document.getElementById("bg-list");
  const empty = document.getElementById("bg-empty");
  bgItems = [];
  list.innerHTML = "";

  if (!bgDirHandle) {
    empty.classList.remove("hidden");
    empty.textContent = "Thư mục chưa tồn tại — lưu nền đầu tiên là tự tạo.";
    document.getElementById("bg-active-note").textContent = "";
    return;
  }

  const slot = bgSlot();
  const keys = slot.variants.map((v) => v.key);
  const byName = new Map();

  for await (const entry of bgDirHandle.values()) {
    if (entry.kind !== "file" || !entry.name.endsWith(".webp")) continue;
    const m = entry.name.match(new RegExp(`^(.+)-(${keys.join("|")})\\.webp$`));
    if (!m) continue;
    const [, name, key] = m;
    const file = await entry.getFile();
    const item = byName.get(name) || { name, updated_at: 0, variants: {} };
    item.variants[key] = entry.name;
    // updated_at của BỘ = lần sửa gần nhất trong các biến thể của nó.
    item.updated_at = Math.max(item.updated_at, file.lastModified);
    byName.set(name, item);
  }

  bgItems = [...byName.values()].sort((a, b) => b.updated_at - a.updated_at);

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
  // Ảnh đại diện: ưu tiên biến thể đầu tiên của slot (desktop), thiếu thì lấy tạm cái có.
  const thumb = item.variants[slot.variants[0].key] || Object.values(item.variants)[0];
  el.innerHTML = `
    <div class="aspect-video bg-[rgb(var(--checkerboard-rgb))]">
      <img src="/assets/${slot.folder}/${thumb}" alt=""
           class="w-full h-full object-cover" loading="lazy" />
    </div>
    <div class="p-2.5">
      <div class="text-xs font-medium text-gray-800 truncate">${escapeHtml(item.name)}</div>
      <div class="text-[11px] text-gray-500 mt-0.5">
        ${Object.keys(item.variants).join(" · ")}
        ${missing.length ? `<span class="text-amber-600">— thiếu ${missing.map((v) => v.key).join(", ")}</span>` : ""}
      </div>
      <button type="button" class="mt-2 text-[11px] text-rose-500 underline">Xoá</button>
    </div>`;
  el.querySelector("button").onclick = () => deleteBackground(item.name);
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

/**
 * Ghi lại manifest.json — NƠI DUY NHẤT web đọc được danh sách nền.
 * Gọi SAU bgLoadExisting() để lấy đúng danh sách vừa quét.
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
