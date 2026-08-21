// ============= TAB: Font chữ =============
// Gồm 2 nguồn, đọc trực tiếp từ file gốc (không chép tay) để khỏi lệch khi ai
// đó thêm/xoá font ở nguồn mà quên cập nhật tab này:
//   · Font tự host — styles/_fonts.css (nạp sẵn qua build.css, không cần tải gì
//     thêm để xem trước).
//   · Font Google (CDN) — THEME_FONTS trong core/helpers/theme-setting-helper.js,
//     đúng danh sách bảng chọn font ở tab Giao diện của trang thiết lập thiệp.
//     Chỉ fetch file này để LẤY VĂN BẢN parse mảng, không nạp làm script (file
//     đó gắn cả runtime chỉnh sửa live-preview, không hợp với trang admin).

let _fontsLoaded = false;

function initFontsPanel() {
  if (_fontsLoaded) return;
  _fontsLoaded = true;
  loadFontsList();

  const textInput = document.getElementById("fonts-preview-text");
  const sizeInput = document.getElementById("fonts-preview-size");
  const sizeLabel = document.getElementById("fonts-preview-size-label");

  textInput.addEventListener("input", () => applyFontsPreview());
  sizeInput.addEventListener("input", () => {
    sizeLabel.textContent = `${sizeInput.value}px`;
    applyFontsPreview();
  });
}

function applyFontsPreview() {
  const text = document.getElementById("fonts-preview-text").value || " ";
  const size = document.getElementById("fonts-preview-size").value;
  document.querySelectorAll(".font-preview-sample").forEach((el) => {
    el.textContent = text;
    el.style.fontSize = `${size}px`;
  });
}

// Gom @font-face theo tiêu đề nhóm dạng "/* ── Tên nhóm ──…── */" đứng trước —
// đúng cách styles/_fonts.css đang chia mục (viết tay, serif, sans…).
function parseSelfHostedFonts(css) {
  const groups = [];
  let current = { name: "Khác", fonts: [] };
  const lines = css.split("\n");
  const headingRe = /^\/\*\s*──+\s*(.+?)\s*──+\s*\*\/$/;
  const familyRe = /font-family:\s*["']([^"']+)["']/;

  for (const line of lines) {
    const heading = line.trim().match(headingRe);
    if (heading) {
      if (current.fonts.length) groups.push(current);
      current = { name: heading[1], fonts: [] };
      continue;
    }
    const family = line.match(familyRe);
    if (family && !current.fonts.includes(family[1])) {
      current.fonts.push(family[1]);
    }
  }
  if (current.fonts.length) groups.push(current);
  return groups;
}

const GOOGLE_FONT_TYPE_LABEL = {
  heading: "Tiêu đề",
  body: "Nội dung",
  both: "Dùng được cả hai",
};

// Trích mảng THEME_FONTS ([{ name: "...", type: "..." }, …]) từ mã nguồn thay
// vì import module — file gốc không phải ES module và có tác dụng phụ khi chạy.
function parseGoogleFonts(js) {
  const familyRe = /\{\s*name:\s*"([^"]+)",\s*type:\s*"([^"]+)"\s*\}/g;
  const byType = { heading: [], body: [], both: [] };
  let m;
  while ((m = familyRe.exec(js))) {
    if (byType[m[2]]) byType[m[2]].push(m[1]);
  }
  return Object.entries(byType)
    .filter(([, fonts]) => fonts.length)
    .map(([type, fonts]) => ({ name: GOOGLE_FONT_TYPE_LABEL[type], fonts }));
}

async function loadFontsList() {
  const host = document.getElementById("fonts-groups");
  try {
    const [selfHostedRes, googleRes] = await Promise.all([
      fetch("../styles/_fonts.css"),
      fetch("../core/helpers/theme-setting-helper.js"),
    ]);
    if (!selfHostedRes.ok) throw new Error("HTTP " + selfHostedRes.status);
    if (!googleRes.ok) throw new Error("HTTP " + googleRes.status);

    const selfHostedGroups = parseSelfHostedFonts(await selfHostedRes.text());
    const googleGroups = parseGoogleFonts(await googleRes.text());

    loadGoogleFontsCss(googleGroups.flatMap((g) => g.fonts));

    const selfHostedCount = selfHostedGroups.reduce((n, g) => n + g.fonts.length, 0);
    renderFontsSection(
      "fonts-selfhosted",
      `Font tự host — toàn bộ file trong assets/fonts (${selfHostedCount})`,
      selfHostedGroups,
    );
    renderFontsSection(
      "fonts-google",
      "Font Google — CDN (bảng chọn font ở trang thiết lập thiệp)",
      googleGroups,
    );
  } catch (err) {
    console.error("[fonts] không đọc được danh sách font:", err);
    host.innerHTML = `<p class="text-sm text-red-500">Không tải được danh sách font.</p>`;
  }
}

// Một request duy nhất cho toàn bộ font Google cần xem trước, thay vì mỗi thẻ
// một request riêng.
function loadGoogleFontsCss(fontNames) {
  if (!fontNames.length) return;
  const families = fontNames
    .map((n) => `family=${n.trim().replace(/\s+/g, "+")}:ital,wght@0,400;0,600`)
    .join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

function renderFontsSection(hostId, title, groups) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = `
    <h3 class="text-xs font-semibold text-gray-500 uppercase mb-3">${escapeHtml(title)}</h3>
    <div class="space-y-4">
      ${groups
        .map(
          (g) => `
        <div>
          <h4 class="text-[11px] font-medium text-gray-400 mb-2">${escapeHtml(g.name)}</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${g.fonts.map(renderFontCard).join("")}
          </div>
        </div>`,
        )
        .join("")}
    </div>`;

  if (typeof cxRenderIcons === "function") cxRenderIcons(host);
  applyFontsPreview();
}

function renderFontCard(fontName) {
  const safe = escapeHtml(fontName);
  return `
    <button
      type="button"
      onclick="fontsCopyName('${fontName.replace(/'/g, "\\'")}')"
      class="group text-left p-4 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50/40 transition-colors"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-gray-500">${safe}</span>
        <i data-icon="copy" data-size="14" class="text-gray-300 group-hover:text-violet-400"></i>
      </div>
      <div
        class="font-preview-sample text-gray-800 truncate"
        style="font-family: '${fontName}';"
      ></div>
    </button>`;
}

function fontsCopyName(fontName) {
  navigator.clipboard
    .writeText(fontName)
    .then(() => showToast(`Đã copy "${fontName}"`, "success", "copy"))
    .catch(() => showToast("Không copy được, trình duyệt chặn clipboard", "error"));
}
