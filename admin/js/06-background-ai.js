// ============= TAB "Ảnh nền": nhờ AI vẽ nền SVG rồi ghi xuống đĩa =============
// Nền là file SVG tĩnh trong repo, KHÔNG phải dữ liệu trong DB → ghi xong phải
// commit & push mới lên production.
//
// Quy ước:
// 1. Một "nền" = MỘT BỘ nhiều biến thể khổ màn hình (desktop + mobile), tên file
//    là <tên nền>-<biến thể>.svg. Web chọn bộ MỚI NHẤT (theo updated_at trong
//    manifest) rồi mới chọn biến thể hợp màn hình — chọn theo bộ nên không bao
//    giờ lệch desktop một nền, mobile một nền.
// 2. Trùng tên là GHI ĐÈ (có hỏi lại). Khác tab "Ảnh mẫu" — bên đó tự đánh số để
//    không bao giờ ghi đè.
// 3. manifest.json là NƠI DUY NHẤT web đọc được danh sách nền (GitHub Pages
//    không cho liệt kê thư mục qua HTTP).
// 4. SVG dùng qua background-image nên script trong đó không chạy; vẫn lọc thêm
//    một lượt ở bgSanitizeSvg trước khi ghi, vì file còn nằm trong repo.
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
    // {{palette}} được bind bằng bảng màu thật lấy từ styles/_colors.css lúc
    // chạy, nên prompt luôn khớp tông web dù sau này đổi màu thương hiệu.
    prompt: `Vẽ một ảnh nền thiệp cưới sang trọng, tối giản, dùng làm nền mờ phía sau nội dung trang chủ.

Yêu cầu mỹ thuật:
- Chủ đề: thiệp cưới — hoa hồng, lá, cành mảnh, vòng hoa, hoạ tiết viền cổ điển.
- Bố cục thoáng ở GIỮA khung (chỗ đó sẽ có chữ đè lên), hoạ tiết dồn về các góc và mép.
- Nét mảnh, nhiều khoảng trắng, cảm giác nhẹ và thanh lịch. Không rối mắt.
- Không chữ, không logo, không khung ảnh.

Bảng màu (dùng đúng những màu này):
{{palette}}`,
  },
];

// Dùng CHUNG handle thư mục assets/ với tab "Ảnh mẫu" (cùng key, cùng store):
// admin kết nối một lần là cả hai tab dùng được. siIdbGet/siIdbPut khai ở
// 03-sample-images.js, SI_IDB_STORE cũng vậy — file này luôn nạp sau.
const BG_IDB_KEY = "assets-root";
const BG_MANIFEST_NAME = "manifest.json";
const BG_MAX_BYTES = 300 * 1024; // khớp ngưỡng chặn ở Edge Function
const BG_PROMPT_LS_PREFIX = "bg_prompt_"; // + <slot> → prompt admin đã sửa

// Các token màu đổ vào {{palette}} của prompt.
const BG_PALETTE_TOKENS = [
  ["--brand-primary-rgb", "hồng phấn chủ đạo"],
  ["--brand-accent-rgb", "hồng đậm để nhấn"],
  ["--surface-tint-rgb", "nền kem rất nhạt"],
  ["--text-heading-rgb", "nâu-hồng đậm cho nét đậm nhất"],
  ["--card-gold-300-rgb", "vàng cổ cho chi tiết ánh kim"],
];

let bgRootHandle = null; // thư mục assets/
let bgDirHandle = null; // thư mục đích của slot đang chọn
let bgItems = []; // nền đã có: [{ name, updated_at, variants: {key: filename} }]
let bgPendingSvg = ""; // SVG vừa sinh, chưa lưu
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

  bgLoadPrompt();
  onBackgroundVariantChange();
  bgClearPreview();

  bgDirHandle = await bgOpenSlotDir(slot);
  await bgLoadExisting();
}

function onBackgroundVariantChange() {
  const v = bgVariant();
  document.getElementById("bg-variant-note").textContent = `Khổ ${v.w}×${v.h}px`;
  bgUpdateFilenameHint();
}

function bgUpdateFilenameHint() {
  const base = bgSlugify(document.getElementById("bg-name-input")?.value || "");
  const hint = document.getElementById("bg-filename-hint");
  if (!hint) return;
  hint.textContent = base
    ? `Ghi ra: ${bgSlot().folder}/${base}-${bgVariant().key}.svg`
    : "Chỉ dùng chữ thường, số và dấu gạch ngang.";
}

// ============= Prompt (bind sẵn, admin sửa được) =============

/** Đọc bảng màu thật từ biến CSS để nhét vào prompt — luôn khớp _colors.css. */
function bgPaletteText() {
  const cs = getComputedStyle(document.documentElement);
  return BG_PALETTE_TOKENS.map(([token, desc]) => {
    const channels = cs.getPropertyValue(token).trim(); // "255 183 202"
    const hex = channels
      ? "#" +
        channels
          .split(/\s+/)
          .map((n) => Number(n).toString(16).padStart(2, "0"))
          .join("")
      : "";
    return `- ${hex} — ${desc}`;
  }).join("\n");
}

function bgPromptPreset(slot) {
  return slot.prompt.replace("{{palette}}", bgPaletteText());
}

function bgLoadPrompt() {
  const slot = bgSlot();
  const saved = localStorage.getItem(BG_PROMPT_LS_PREFIX + slot.value);
  document.getElementById("bg-prompt").value = saved || bgPromptPreset(slot);
}

function onBackgroundPromptInput() {
  localStorage.setItem(
    BG_PROMPT_LS_PREFIX + bgSlot().value,
    document.getElementById("bg-prompt").value,
  );
}

function resetBackgroundPrompt() {
  const slot = bgSlot();
  localStorage.removeItem(BG_PROMPT_LS_PREFIX + slot.value);
  document.getElementById("bg-prompt").value = bgPromptPreset(slot);
  showToast("Đã khôi phục prompt mẫu", "success");
}

// ============= Gọi AI =============

async function generateBackground() {
  const btn = document.getElementById("bg-generate-btn");
  const status = document.getElementById("bg-generate-status");
  const prompt = document.getElementById("bg-prompt").value.trim();
  if (prompt.length < 20) {
    showToast("Prompt quá ngắn", "error");
    return;
  }
  const v = bgVariant();

  btn.dataset.loading = "1";
  status.textContent = "Đang vẽ… (có thể mất 30–60 giây)";
  try {
    const res = await fetch(CONFIG.supabase.aiBackgroundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.supabase.anonKey,
        Authorization: `Bearer ${CONFIG.supabase.anonKey}`,
        "x-admin-token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ prompt, width: v.w, height: v.h }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    const svg = bgSanitizeSvg(json.svg || "");
    if (!svg) throw new Error("AI không trả về SVG hợp lệ");

    bgSetPreview(svg);
    status.textContent = `Xong (${json.provider || "ai"}, ${Math.round(
      new Blob([svg]).size / 1024,
    )}KB)`;
  } catch (e) {
    console.error(e);
    status.textContent = "";
    showToast("Không tạo được ảnh nền: " + e.message, "error");
  } finally {
    btn.dataset.loading = "";
  }
}

/**
 * Lọc lần hai ở client (Edge Function đã lọc một lượt). SVG dùng qua
 * background-image thì script không chạy, nhưng file vẫn nằm trong repo và có
 * thể bị mở trực tiếp nên vẫn phải sạch.
 * Trả "" nếu không phải SVG hợp lệ.
 */
function bgSanitizeSvg(raw) {
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end <= start) return "";
  return raw
    .slice(start, end + "</svg>".length)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .trim();
}

function bgSetPreview(svg) {
  bgPendingSvg = svg;
  if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
  // Xem trước bằng <img>: cùng hộp cát với background-image, script không chạy.
  bgPreviewUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  document.getElementById("bg-preview").src = bgPreviewUrl;
  document.getElementById("bg-preview-wrap").classList.remove("hidden");
  bgUpdateFilenameHint();
}

function bgClearPreview() {
  bgPendingSvg = "";
  if (bgPreviewUrl) {
    URL.revokeObjectURL(bgPreviewUrl);
    bgPreviewUrl = "";
  }
  document.getElementById("bg-preview-wrap").classList.add("hidden");
  document.getElementById("bg-generate-status").textContent = "";
}

// ============= Lưu xuống thư mục =============

/** Tên file: chữ thường, số, gạch ngang. "" = không hợp lệ. */
function bgSlugify(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function saveBackground() {
  if (!bgPendingSvg) {
    showToast("Chưa có ảnh nền nào để lưu", "error");
    return;
  }
  const base = bgSlugify(document.getElementById("bg-name-input").value);
  if (!base) {
    showToast("Hãy đặt tên cho nền (chữ thường, số, gạch ngang)", "error");
    return;
  }
  const bytes = new Blob([bgPendingSvg]).size;
  if (bytes > BG_MAX_BYTES) {
    showToast(`SVG nặng ${Math.round(bytes / 1024)}KB, vượt ngưỡng 300KB`, "error");
    return;
  }

  const slot = bgSlot();
  const variant = bgVariant();
  const filename = `${base}-${variant.key}.svg`;

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
    await writable.write(new Blob([bgPendingSvg], { type: "image/svg+xml" }));
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
    if (entry.kind !== "file" || !entry.name.endsWith(".svg")) continue;
    const m = entry.name.match(new RegExp(`^(.+)-(${keys.join("|")})\\.svg$`));
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
