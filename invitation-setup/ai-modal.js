// ============================================================
// AI: TẠO NỘI DUNG THIỆP
// Tách khỏi index.js/index.html cho gọn. Nạp SAU index.js
// (cần WEDDING_ID, showToast, openBottomSheet, các hàm form... ở global).
// Style: ai-modal.css.
// ============================================================

// ── Markup modal (bơm vào body/footer của base bottom-sheet) ────────────────
const _AI_BODY_HTML = `
  <div class="px-5 py-4 min-h-full flex flex-col">
    <!-- FORM NHẬP -->
    <div id="ai-form" class="space-y-5">
      <!-- Thông tin -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-gray-500">Thông tin cô dâu/chú rể</label>
          <div class="flex items-center gap-2">
            <button type="button" data-ai-speech onclick="openAiSpeech('ai-info')" class="ai-chip ai-chip-mic">
              <i data-lucide="mic" style="width: 12px; height: 12px"></i>
              Nói
            </button>
            <button type="button" onclick="insertAiInfoTemplate()" class="ai-chip">
              <i data-lucide="clipboard-list" style="width: 12px; height: 12px"></i>
              Chèn mẫu
            </button>
          </div>
        </div>
        <x-textarea
          bare
          id="ai-info"
          rows="6"
          maxlength="2500"
          input-class="ai-inp resize-none"
          placeholder="Nhập thông tin chú rể, cô dâu, ngày giờ cưới, địa điểm, cha mẹ hai bên, số tài khoản,..."
        ></x-textarea>
      </div>

      <!-- Câu chuyện tình yêu -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-gray-500">Câu chuyện tình yêu</label>
          <button type="button" data-ai-speech onclick="openAiSpeech('ai-bullets')" class="ai-chip ai-chip-mic">
            <i data-lucide="mic" style="width: 12px; height: 12px"></i>
            Nói
          </button>
        </div>
        <x-textarea
          bare
          id="ai-bullets"
          rows="6"
          maxlength="1500"
          input-class="ai-inp resize-none"
          placeholder="Ví dụ: gặp nhau 2021 ở Đà Lạt; lần đầu nắm tay ở Quy Nhơn; cầu hôn đúng dịp sinh nhật…"
        ></x-textarea>
      </div>

      <!-- Văn phong -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5">Văn phong</label>
        <div class="ai-tone-wrap">
          <button type="button" class="ai-tone-nav" onclick="scrollAiTones(-1)" aria-label="Trước">
            <i data-lucide="chevron-left" style="width: 16px; height: 16px"></i>
          </button>
          <div id="ai-tone" class="ai-tone-scroll">
            <button type="button" data-tone="romantic" class="ai-tone-btn">Lãng mạn</button>
            <button type="button" data-tone="traditional" class="ai-tone-btn">Truyền thống</button>
            <button type="button" data-tone="humorous" class="ai-tone-btn">Dí dỏm</button>
            <button type="button" data-tone="poetic" class="ai-tone-btn">Thơ mộng</button>
            <button type="button" data-tone="modern" class="ai-tone-btn">Hiện đại</button>
            <button type="button" data-tone="luxury" class="ai-tone-btn">Sang trọng</button>
            <button type="button" data-tone="cute" class="ai-tone-btn">Dễ thương</button>
            <button type="button" data-tone="vintage" class="ai-tone-btn">Cổ điển</button>
          </div>
          <button type="button" class="ai-tone-nav" onclick="scrollAiTones(1)" aria-label="Sau">
            <i data-lucide="chevron-right" style="width: 16px; height: 16px"></i>
          </button>
        </div>
      </div>

      <!-- Vùng miền -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1.5">Vùng miền</label>
        <div class="ai-cselect">
          <input type="hidden" id="ai-region" value="" />
          <button type="button" class="ai-inp ai-select ai-cselect-btn">
            <span class="ai-cselect-label">Tự động</span>
          </button>
          <div class="ai-cselect-panel hidden">
            <button type="button" class="ai-cselect-opt sel" data-value="">Tự động</button>
            <button type="button" class="ai-cselect-opt" data-value="bac">Miền Bắc</button>
            <button type="button" class="ai-cselect-opt" data-value="trung">Miền Trung</button>
            <button type="button" class="ai-cselect-opt" data-value="nam">Miền Nam</button>
          </div>
        </div>
      </div>

    </div>

    <!-- PREVIEW KẾT QUẢ -->
    <div id="ai-preview" class="hidden space-y-4">
      <div
        id="ai-stream-status"
        class="hidden items-center gap-2 text-xs font-medium text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2"
      >
        <i data-lucide="loader-2" class="animate-spin" style="width: 14px; height: 14px"></i>
        <span>AI đang viết, nội dung hiện dần bên dưới…</span>
      </div>
      <div id="ai-preview-content" class="space-y-4"></div>
    </div>

    <!-- LỊCH SỬ TẠO (localStorage) -->
    <div id="ai-history" class="hidden space-y-3">
      <p class="text-xs text-gray-500">
        Các nội dung AI đã tạo trên thiết bị này. Bấm “Xem trước” để xem lại,
        rồi áp dụng hoặc tạo lại (bản tạo lại được tính là một lần tạo mới).
      </p>
      <div id="ai-history-list" class="space-y-2.5"></div>
    </div>
  </div>
`;

const _AI_FOOTER_HTML = `
  <div class="px-5 py-3.5 border-t border-gray-100 bg-white">
    <div id="ai-footer-form" class="flex gap-2">
      <button
        type="button"
        onclick="clearAiForm()"
        aria-label="Xoá toàn bộ nội dung đã nhập"
        title="Xoá toàn bộ"
        class="w-8 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
      >
        <i data-lucide="eraser" style="width:16px;height:16px"></i>
      </button>
      <button
        type="button"
        id="ai-generate-btn"
        onclick="submitAiGenerate()"
        class="btn-pink flex-1 justify-center h-11"
      >
        <i data-lucide="sparkles"></i> Tạo nội dung
      </button>
    </div>
    <div id="ai-footer-preview" class="hidden gap-2">
      <button
        type="button"
        id="ai-back-btn"
        onclick="backToAiForm()"
        class="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Tạo lại
      </button>
      <button
        type="button"
        id="ai-apply-btn"
        onclick="applyAiResult()"
        class="flex-1 h-11 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        Áp dụng vào thiệp
      </button>
    </div>
    <div id="ai-footer-history" class="hidden">
      <button
        type="button"
        onclick="backFromAiHistory()"
        class="ai-back-btn"
      >
        <i data-lucide="arrow-left" style="width: 16px; height: 16px"></i> Quay lại
      </button>
    </div>
  </div>
`;

// ── State ────────────────────────────────────────────────────────────────────
let _aiResult = null;
let _aiTone = "romantic";
let _aiSheet = null;
let _aiSelectDocBound = false; // đã gắn listener đóng dropdown khi click ra ngoài chưa
let _aiViewBeforeHistory = "form"; // để "Quay lại" từ lịch sử về đúng bước trước đó

// Cache nội dung đang nhập trong modal AI → lỡ tắt vào lại không phải gõ lại.
const AI_DRAFT_KEY = `cuoixinh_ai_draft_${WEDDING_ID}`;
// Lịch sử các nội dung AI đã tạo (chỉ lưu localStorage, KHÔNG lưu DB).
const AI_HISTORY_KEY = `cuoixinh_ai_history_${WEDDING_ID}`;
// Ghi nhớ đã thu gọn thẻ mời AI (chỉ còn icon) — giữ qua các lần tải lại trang.
const AI_FAB_KEY = `cuoixinh_ai_fab_collapsed_${WEDDING_ID}`;
const AI_HISTORY_MAX = 12;

function _saveAiDraft() {
  try {
    localStorage.setItem(
      AI_DRAFT_KEY,
      JSON.stringify({
        tone: _aiTone,
        region: document.getElementById("ai-region")?.value || "",
        bullets: document.getElementById("ai-bullets")?.value || "",
        info: document.getElementById("ai-info")?.value || "",
      }),
    );
  } catch {}
}

function _loadAiDraft() {
  try {
    return JSON.parse(localStorage.getItem(AI_DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

function _setAiTone(tone) {
  _aiTone = tone;
  document.querySelectorAll("#ai-tone .ai-tone-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tone === tone);
  });
  _saveAiDraft();
}

function openAiModal() {
  if (_aiSheet) return; // đang mở

  // Đã mở popup AI → thu gọn thẻ mời về icon nhỏ (như bấm "x"). Khi thoát modal
  // sẽ chỉ còn lại icon, không hiện lại thẻ to.
  dismissAiFab();

  const sheet = openBottomSheet({
    id: "ai-sheet",
    title: `<span class="inline-flex items-center gap-2"><i data-lucide="sparkles" style="width:18px;height:18px" class="text-rose-500"></i> Tạo nội dung bằng AI</span>`,
    height: "92vh",
    onClose: () => {
      _aiTeardownActiveEdit();
      _aiSheet = null;
    },
  });
  if (!sheet) return;
  _aiSheet = sheet;

  // Bơm nội dung (form + preview) vào body, và footer (nút hành động) vào footer
  sheet.body.className = "flex-1 min-h-0 overflow-y-auto";
  sheet.body.innerHTML = _AI_BODY_HTML;
  sheet.footer.innerHTML = _AI_FOOTER_HTML;

  // Chỉ khôi phục nội dung người dùng đã nhập TRONG modal (nháp localStorage).
  // KHÔNG tự động bind dữ liệu từ thiệp/form thiết lập vào popup nữa.
  const draft = _loadAiDraft() || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  set("ai-bullets", draft.bullets);
  set("ai-info", draft.info);
  _aiSelectApply("ai-region", draft.region);
  _aiTone = draft.tone || "romantic";

  _injectAiHistoryButton();
  _wireAiForm();
  _syncAiClearButtons(); // hiện nút "x" nếu nháp khôi phục có nội dung
  _setAiView("form");
  _setAiTone(_aiTone);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Gắn nút "Lịch sử" vào header của bottom-sheet, cùng nhóm bên phải với nút X.
function _injectAiHistoryButton() {
  const xBtn = document.getElementById("ai-sheet-x-btn");
  if (!xBtn || document.getElementById("ai-history-btn")) return;
  const hb = document.createElement("button");
  hb.type = "button";
  hb.id = "ai-history-btn";
  hb.title = "Lịch sử tạo";
  // Cùng khuôn với nút X (p-1.5, icon 20px, SVG thô) để canh thẳng hàng tuyệt đối.
  // Icon "clipboard-clock" (Lucide) — dán SVG thô để không bị svg.lucide{width:1em} bóp nhỏ.
  hb.className =
    "p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors";
  hb.innerHTML = `<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14v2.2l1.6 1"/><path d="M16 4h2a2 2 0 0 1 2 2v.832"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/><circle cx="16" cy="16" r="6"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>`;
  hb.addEventListener("click", openAiHistory);
  // Gom [lịch sử][X] vào một nhóm để justify-between không đẩy nút ra giữa header.
  const group = document.createElement("div");
  group.className = "flex items-center gap-1";
  xBtn.parentNode.insertBefore(group, xBtn);
  group.appendChild(hb);
  group.appendChild(xBtn);
}

function closeAiModal() {
  _aiSheet?.close();
  _aiSheet = null;
}

// Gắn listener cho các control trong modal (phải gọi mỗi lần mở vì DOM dựng lại).
function _wireAiForm() {
  const tone = document.getElementById("ai-tone");
  if (tone) {
    tone.addEventListener("click", (e) => {
      const btn = e.target.closest(".ai-tone-btn");
      if (btn && btn.dataset.tone) _setAiTone(btn.dataset.tone);
    });
  }
  ["ai-bullets", "ai-info"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", _saveAiDraft);
    // Cụm Hoàn tác/Làm lại (x-undo.js) + nút micro "Nói để nhập" (x-speech.js) —
    // nổi góc dưới-phải ô. speech.questions: câu hỏi gợi ý để người dùng nói.
    window.attachUndoRedo?.(document.getElementById(id), {
      speech: _AI_SPEECH[id],
    });
  });

  // Trình duyệt không hỗ trợ giọng nói → gỡ nút "Nói" trên hàng label.
  if (!window.speechSupported?.()) {
    document
      .querySelectorAll("#ai-form [data-ai-speech]")
      .forEach((b) => b.remove());
  }

  _wireAiSelects();
}

// Mở hộp thoại "Nói để nhập" cho một ô (dùng chung cấu hình _AI_SPEECH với nút mic
// góc dưới-phải của x-undo). Gọi từ nút "Nói" trên hàng label.
function openAiSpeech(id) {
  const ta = document.getElementById(id);
  if (!ta) return;
  const cfg = _AI_SPEECH[id] || {};
  window.openSpeechDialog?.({
    target: ta,
    questions: cfg.questions || [],
    lang: cfg.lang || "vi-VN",
    title: cfg.title,
  });
}

// Cấu hình "Nói để nhập" cho từng ô: tiêu đề popup + câu hỏi gợi ý (đọc để trả lời).
const _AI_SPEECH = {
  "ai-info": {
    title: "Nói thông tin cô dâu / chú rể",
    questions: [
      "Tên chú rể và tên cô dâu là gì?",
      "Ngày và giờ tổ chức lễ cưới?",
      "Địa điểm tổ chức ở đâu?",
      "Tên bố mẹ hai bên?",
      "Số tài khoản mừng cưới (nếu có)?",
      "Lịch trình ngày cưới (giờ đón dâu, lễ, tiệc)?",
    ],
  },
  "ai-bullets": {
    title: "Kể chuyện tình yêu",
    questions: [
      "Hai bạn quen nhau khi nào, ở đâu?",
      "Kỷ niệm đáng nhớ nhất là gì?",
      "Màn cầu hôn diễn ra thế nào?",
      "Điều bạn yêu nhất ở đối phương?",
    ],
  },
};

// Đồng bộ nút "x" của các <x-textarea> sau khi gán value bằng code (khôi phục nháp
// / xem trước lịch sử) — vì gán .value trực tiếp không phát sự kiện input.
function _syncAiClearButtons() {
  ["ai-info", "ai-bullets"].forEach((id) => {
    document.getElementById(id)?.closest("x-textarea")?.syncClearBtn?.();
  });
}

// Xoá sạch toàn bộ nội dung ĐANG NHẬP trong popup AI (không đụng gì tới thiệp —
// nội dung chưa được áp dụng). Đưa mọi ô về trống, vùng miền/số mốc về "Tự động",
// văn phong về mặc định; rồi lưu nháp trống lại.
function clearAiForm() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  set("ai-info", "");
  set("ai-bullets", "");
  _aiSelectApply("ai-region", "");
  _aiTone = "romantic";
  _setAiTone(_aiTone);
  _syncAiClearButtons();
  _saveAiDraft();
  document.getElementById("ai-info")?.focus();
}

// Cuộn dải văn phong sang trái/phải (nút mũi tên).
function scrollAiTones(dir) {
  const el = document.getElementById("ai-tone");
  if (el) el.scrollBy({ left: dir * 170, behavior: "smooth" });
}

// Combobox tuỳ biến (dropdown rộng đúng bằng control). Mỗi .ai-cselect gồm:
// input hidden giữ value + nút hiển thị + panel các option.
function _wireAiSelects() {
  document.querySelectorAll("#ai-form .ai-cselect").forEach((root) => {
    const btn = root.querySelector(".ai-cselect-btn");
    const panel = root.querySelector(".ai-cselect-panel");
    const label = root.querySelector(".ai-cselect-label");
    const hidden = root.querySelector('input[type="hidden"]');
    if (!btn || !panel) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = panel.classList.contains("hidden");
      _closeAllAiSelects();
      panel.classList.toggle("hidden", !willOpen);
      btn.classList.toggle("open", willOpen);
    });

    panel.querySelectorAll(".ai-cselect-opt").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const val = opt.dataset.value || "";
        if (hidden) hidden.value = val;
        if (label) {
          // "" nay là lựa chọn thật "Tự động" (không còn là placeholder trống).
          label.textContent = opt.textContent.trim();
          label.classList.remove("is-placeholder");
        }
        panel
          .querySelectorAll(".ai-cselect-opt")
          .forEach((o) => o.classList.toggle("sel", o === opt));
        panel.classList.add("hidden");
        btn.classList.remove("open");
        _saveAiDraft();
      });
    });
  });

  // Click ra ngoài → đóng mọi dropdown (gắn 1 lần cho document).
  if (!_aiSelectDocBound) {
    document.addEventListener("click", _closeAllAiSelects);
    _aiSelectDocBound = true;
  }
}

function _closeAllAiSelects() {
  document
    .querySelectorAll(".ai-cselect-panel")
    .forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".ai-cselect-btn.open")
    .forEach((b) => b.classList.remove("open"));
}

// Set value cho 1 combobox tuỳ biến + cập nhật nhãn/hạng mục đang chọn (dùng khi khôi phục nháp).
function _aiSelectApply(hiddenId, value) {
  const hidden = document.getElementById(hiddenId);
  if (!hidden) return;
  hidden.value = value || "";
  const root = hidden.closest(".ai-cselect");
  if (!root) return;
  const label = root.querySelector(".ai-cselect-label");
  let matched = null;
  root.querySelectorAll(".ai-cselect-opt").forEach((o) => {
    const on = (o.dataset.value || "") === (value || "");
    o.classList.toggle("sel", on);
    if (on) matched = o;
  });
  if (label && matched) {
    label.textContent = matched.textContent.trim();
    label.classList.remove("is-placeholder");
  }
}

// Chuyển giữa các bước: 'form' (nhập), 'preview' (kết quả), 'history' (lịch sử).
function _setAiView(view) {
  const bodies = {
    form: "ai-form",
    preview: "ai-preview",
    history: "ai-history",
  };
  const footers = {
    form: "ai-footer-form",
    preview: "ai-footer-preview",
    history: "ai-footer-history",
  };
  Object.entries(bodies).forEach(([v, id]) =>
    document.getElementById(id)?.classList.toggle("hidden", v !== view),
  );
  Object.entries(footers).forEach(([v, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", v !== view);
    if (id === "ai-footer-preview") el.classList.toggle("flex", v === view);
  });
}

function backToAiForm() {
  _aiTeardownActiveEdit();
  _setAiView("form");
  // reset trạng thái streaming của khu preview
  const status = document.getElementById("ai-stream-status");
  if (status) (status.classList.add("hidden"), status.classList.remove("flex"));
  document
    .getElementById("ai-preview-content")
    ?.closest(".overflow-y-auto")
    ?.classList.remove("ai-lock-scroll");
}

// ── Lịch sử tạo (chỉ localStorage) ────────────────────────────────────────────
const _AI_TONE_NAMES = {
  romantic: "Lãng mạn",
  traditional: "Truyền thống",
  humorous: "Dí dỏm",
  poetic: "Thơ mộng",
  modern: "Hiện đại",
  luxury: "Sang trọng",
  cute: "Dễ thương",
  vintage: "Cổ điển",
};

function _loadAiHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _pushAiHistory(payload, result) {
  if (!result) return;
  try {
    // Tên hiển thị nay do AI trích xuất (payload không còn tên) → lấy từ result.fields.
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      groom: result.fields?.groom_name || "",
      bride: result.fields?.bride_name || "",
      tone: payload.tone || "",
      story_quote: result.story_quote || "",
      payload, // giữ input đã dùng để "Xem trước" có thể khôi phục & tạo lại
      result,
    };
    const list = _loadAiHistory();
    list.unshift(entry);
    localStorage.setItem(
      AI_HISTORY_KEY,
      JSON.stringify(list.slice(0, AI_HISTORY_MAX)),
    );
  } catch {}
}

function _fmtAiHistoryTime(ts) {
  try {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function openAiHistory() {
  if (!document.getElementById("ai-history")) return;
  _aiViewBeforeHistory =
    _aiResult &&
    !document.getElementById("ai-preview")?.classList.contains("hidden")
      ? "preview"
      : "form";
  _renderAiHistory();
  _setAiView("history");
}

function backFromAiHistory() {
  _setAiView(
    _aiViewBeforeHistory === "preview" && _aiResult ? "preview" : "form",
  );
}

function _renderAiHistory() {
  const box = document.getElementById("ai-history-list");
  if (!box) return;
  const list = _loadAiHistory();
  if (!list.length) {
    box.innerHTML = `<div class="ai-history-empty text-center text-sm text-gray-400 py-10">
        <i data-lucide="list" style="width:28px;height:28px" class="mx-auto mb-2 opacity-60"></i>
        <p>Chưa có nội dung nào được tạo trên thiết bị này.</p>
      </div>`;
    if (typeof lucide !== "undefined") lucide.createIcons();
    return;
  }
  box.innerHTML = list
    .map((e) => {
      const couple = `${escapeHtml(e.groom || "?")} ❤ ${escapeHtml(e.bride || "?")}`;
      const quote = e.story_quote
        ? `<p class="text-xs text-gray-600 mt-1 italic line-clamp-2">${escapeHtml(e.story_quote)}</p>`
        : "";
      const tone = e.tone
        ? `<span class="flex-shrink-0 text-[11px] text-rose-500 bg-rose-50 rounded-full px-2 py-0.5">${escapeHtml(_AI_TONE_NAMES[e.tone] || e.tone)}</span>`
        : "";
      return `<div class="border border-gray-100 rounded-xl p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-800 truncate">${couple}</p>
              <p class="text-[11px] text-gray-400 mt-0.5">${_fmtAiHistoryTime(e.at)}</p>
            </div>
            ${tone}
          </div>
          ${quote}
          <div class="flex gap-2 mt-2.5">
            <button type="button" onclick="previewAiHistory('${e.id}')"
              class="flex-1 h-9 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-colors inline-flex items-center justify-center gap-1.5">
              <i data-lucide="eye" style="width:14px;height:14px"></i> Xem trước
            </button>
            <button type="button" onclick="deleteAiHistory('${e.id}')" title="Xoá"
              class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors">
              <i data-lucide="trash-2" style="width:15px;height:15px"></i>
            </button>
          </div>
        </div>`;
    })
    .join("");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Xem trước 1 bản ghi lịch sử: khôi phục các ô nhập đã dùng (để có thể "Tạo lại"
// ra bản mới) và nạp kết quả vào khu Preview — KHÔNG áp dụng ngay vào thiệp.
function previewAiHistory(id) {
  const entry = _loadAiHistory().find((e) => e.id === id);
  if (!entry || !entry.result) {
    showToast("⚠️ Không tìm thấy nội dung", "warning");
    return;
  }
  if (entry.payload) _restoreAiInputs(entry.payload);
  _aiResult = entry.result;
  _renderAiPreview(_aiResult);
  _setAiView("preview");
  // Footer preview về trạng thái thường (phòng khi trước đó đang stream dở).
  const status = document.getElementById("ai-stream-status");
  if (status) {
    status.classList.add("hidden");
    status.classList.remove("flex");
  }
  const backBtn = document.getElementById("ai-back-btn");
  const applyBtn = document.getElementById("ai-apply-btn");
  if (backBtn) backBtn.disabled = false;
  if (applyBtn) {
    applyBtn.disabled = false;
    applyBtn.innerHTML = "Áp dụng vào thiệp";
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Khôi phục các ô nhập của form AI từ payload đã lưu (dùng khi Xem trước lịch sử).
// Nhờ đó bấm "Tạo lại" sẽ sinh nội dung mới với cùng ngữ cảnh và được tính là
// một bản ghi lịch sử mới.
function _restoreAiInputs(p) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  set("ai-info", p.info);
  // story_love là text nguyên văn; payload cũ (lịch sử) có thể còn mảng "bullets".
  set(
    "ai-bullets",
    p.story_love != null
      ? p.story_love
      : Array.isArray(p.bullets)
        ? p.bullets.map((b) => "- " + b).join("\n")
        : p.bullets || "",
  );
  _aiSelectApply("ai-region", p.region || "");
  _aiTone = p.tone || "romantic";
  _setAiTone(_aiTone);
  _syncAiClearButtons();
  _saveAiDraft();
}

function deleteAiHistory(id) {
  try {
    const list = _loadAiHistory().filter((e) => e.id !== id);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(list));
  } catch {}
  _renderAiHistory();
}

async function submitAiGenerate() {
  const storyLove = (document.getElementById("ai-bullets")?.value || "").trim();
  const info = (document.getElementById("ai-info")?.value || "").trim();
  const region = document.getElementById("ai-region")?.value || "";

  // Tên/ngày/giờ cưới nay nằm trong ô Thông tin để AI tự trích → bắt buộc có nội dung.
  if (!info) {
    showToast(
      "⚠️ Vui lòng nhập thông tin cô dâu, chú rể (tên, ngày, giờ cưới…)",
      "warning",
    );
    document.getElementById("ai-info")?.focus();
    return;
  }

  // Chuyện tình gửi lên NGUYÊN VĂN (textarea liền mạch) — backend tự tách mốc theo
  // ngữ nghĩa (số mốc để AI tự quyết theo prompt).
  const payload = {
    tone: _aiTone,
    story_love: storyLove,
    info,
    region,
  };

  const btn = document.getElementById("ai-generate-btn");
  const oldHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Đang tạo...`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  // Khung kết quả rỗng, được bồi dần khi block chảy về
  _aiResult = { story_quote: "", love_story: [], timeline: [], fields: {} };
  let gotAny = false;

  const statusEl = document.getElementById("ai-stream-status");
  // Lúc stream: chuyển sang preview, khoá "Tạo lại", nút "Áp dụng" xoay + "Đang tạo…"
  const enterPreview = () => {
    _setAiView("preview");
    if (statusEl)
      (statusEl.classList.remove("hidden"), statusEl.classList.add("flex"));
    const backBtn = document.getElementById("ai-back-btn");
    const applyBtn = document.getElementById("ai-apply-btn");
    if (backBtn) backBtn.disabled = true;
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width:16px;height:16px"></i> Đang tạo…`;
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  };
  const finishPreview = () => {
    if (statusEl)
      (statusEl.classList.add("hidden"), statusEl.classList.remove("flex"));
    const backBtn = document.getElementById("ai-back-btn");
    const applyBtn = document.getElementById("ai-apply-btn");
    if (backBtn) backBtn.disabled = false;
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.innerHTML = "Áp dụng vào thiệp";
    }
  };

  // Vào NGAY màn kết quả + skeleton (không đợi block đầu tiên) để người dùng thấy
  // đang xử lý, thay vì chỉ xoay nút "Tạo với AI".
  enterPreview();
  _renderAiSkeleton();

  try {
    await window.aiDAL.generateInvitationStream(payload, (evt) => {
      if (evt.block) {
        gotAny = true;
        _mergeAiBlock(_aiResult, evt.block);
        _renderAiPreview(_aiResult);
      } else if (evt.full) {
        // Fallback Groq: nhận kết quả đầy đủ 1 lần
        _aiResult = evt.full;
        gotAny = true;
        enterPreview();
        _renderAiPreview(_aiResult);
      } else if (evt.meta && evt.meta.error) {
        throw new Error(evt.meta.error);
      }
    });

    if (!gotAny)
      throw new Error("AI chưa tạo được nội dung, vui lòng thử lại.");
    finishPreview();
    _renderAiPreview(_aiResult);
    _pushAiHistory(payload, _aiResult);
  } catch (err) {
    // Streaming lỗi → thử 1 lần non-stream nếu chưa có gì
    if (!gotAny) {
      try {
        const result = await window.aiDAL.generateInvitation(payload);
        _aiResult = result;
        enterPreview();
        finishPreview();
        _renderAiPreview(result);
        _pushAiHistory(payload, result);
      } catch (err2) {
        showToast("❌ " + (err2.message || "Không tạo được nội dung"), "error");
        backToAiForm();
      }
    } else {
      // Đã stream được một phần → giữ lại, chỉ báo nhẹ
      finishPreview();
      showToast(
        "⚠️ " + (err.message || "Tạo bị gián đoạn, dùng phần đã có"),
        "warning",
      );
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }
}

// Bồi 1 block (đã sạch từ server) vào cấu trúc kết quả tích luỹ
function _mergeAiBlock(acc, b) {
  if (!b || !b.type) return;
  if (b.type === "text" && b.key === "story_quote") {
    acc.story_quote = b.value || "";
  } else if (b.type === "love") {
    if (acc.love_story.length < 10)
      acc.love_story.push({
        date: b.date || "",
        title: b.title || "",
        content: b.content || "",
      });
  } else if (b.type === "timeline") {
    if (acc.timeline.length < 10)
      acc.timeline.push({
        time: b.time || "",
        title: b.title || "",
        type: b.kind || "ceremony",
      });
  } else if (b.type === "field" && b.key) {
    acc.fields[b.key] = b.value;
  }
}

// Skeleton loading: dựng khung xám nhấp nháy THEO ĐÚNG thứ tự các mục sẽ hiển thị
// (thông tin → chuyện tình → lịch trình → slogan) để lúc block chảy về không bị nhảy layout.
function _renderAiSkeleton() {
  const box = document.getElementById("ai-preview-content");
  if (!box) return;
  // Khoá cuộn của khung sheet khi đang skeleton → placeholder gói gọn trong 1 màn,
  // không sinh thanh cuộn. Khi có dữ liệu thật (_renderAiPreview) sẽ mở cuộn lại.
  const scroller = box.closest(".overflow-y-auto");
  if (scroller) {
    // Đưa về đầu TRƯỚC khi khoá cuộn — nếu không, vị trí cuộn cũ (từ form) bị giữ lại
    // khiến dòng trạng thái "AI đang viết…" ở trên cùng bị đẩy khuất khỏi tầm nhìn.
    scroller.scrollTop = 0;
    scroller.classList.add("ai-lock-scroll");
  }
  const group = (labelW, body) =>
    `<div class="ai-sk-group">
       <div class="ai-sk ai-sk-label" style="width:${labelW}"></div>
       ${body}
     </div>`;
  const box6 = Array(6).fill('<div class="ai-sk ai-sk-box"></div>').join("");
  const card = (cls = "") => `<div class="ai-sk ai-sk-card ${cls}"></div>`;
  box.innerHTML =
    group("38%", `<div class="ai-fld-grid">${box6}</div>`) +
    group("32%", card() + card() + card()) +
    group("28%", card("sm") + card("sm")) +
    group("22%", card("lg"));
}

// ── Sửa kết quả AI: bấm bút chì → BIND thành control tương ứng ────────────────
// AI có thể trả sai → cho sửa. KHÔNG dùng contenteditable nữa mà "swap" ô hiển thị
// sang đúng control của form: x-input (chữ ngắn), x-textarea (đoạn dài/slogan),
// x-date (ngày), time-picker (giờ). Giá trị sửa ghi ngược vào _aiResult để "Áp dụng".
const _AI_PENCIL_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
let _aiEid = 0; // reset mỗi lần render để eid ổn định trong 1 lần vẽ

// Ô hiển thị (đọc): span/p mang data-eid để pencil cùng eid tìm ra khi swap.
function _aiDisp(eid, value, cls = "", tag = "span", empty = "(trống)") {
  const has = value !== "" && value != null;
  const inner = has
    ? escapeHtml(String(value))
    : `<span class="ai-disp-empty">${empty}</span>`;
  return `<${tag} class="ai-disp ${cls}" data-eid="${eid}">${inner}</${tag}>`;
}
// Nút bút chì: nắm control cần bind + đích ghi (target) + eid để tìm ô hiển thị.
function _aiPencil(eid, ctrl, target) {
  return `<button type="button" class="ai-edit-ico" data-eid="${eid}" data-ctrl="${ctrl}" data-target="${escapeHtml(target)}" aria-label="Sửa">${_AI_PENCIL_SVG}</button>`;
}
// Cặp [hiển thị][bút chì] liền nhau (dùng cho các ô inline: chuyện tình, lịch trình, slogan).
function _aiCell(value, ctrl, target, opt = {}) {
  const eid = ++_aiEid;
  const { cls = "", tag = "span", empty = "(trống)" } = opt;
  return _aiDisp(eid, value, cls, tag, empty) + _aiPencil(eid, ctrl, target);
}
// Loại control cho từng field trích xuất theo tên khoá.
function _aiCtrlForField(key, full) {
  if (/_date$/.test(key)) return "date";
  if (/_time$/.test(key)) return "time";
  if (full || key === "rsvp_message" || key === "footer_text")
    return "textarea";
  return "input";
}

function _renderAiPreview(result) {
  const box = document.getElementById("ai-preview-content");
  if (!box) return;
  // Có dữ liệu thật → mở lại cuộn (đã khoá lúc skeleton) và gắn cơ chế sửa.
  box.closest(".overflow-y-auto")?.classList.remove("ai-lock-scroll");
  _bindAiPreviewEditing(box);
  // DOM sắp dựng lại → gỡ editor đang mở (nếu có) để không rò listener ngoài.
  if (_aiActiveEdit) {
    document.removeEventListener("pointerdown", _aiActiveEdit.onDocDown, true);
    _aiActiveEdit = null;
  }
  _aiEid = 0;

  const quoteHtml = result.story_quote
    ? `<div>
         <p class="text-xs font-semibold text-gray-500 mb-1">Slogan</p>
         <div class="ai-item bg-rose-50 rounded-xl px-3 py-2 border border-rose-100">
           <div class="ai-item-head">
             ${_aiCell(result.story_quote, "textarea", "q", { cls: "text-sm text-gray-800 italic", empty: "(thêm slogan)" })}
           </div>
         </div>
       </div>`
    : "";

  const loveHtml =
    Array.isArray(result.love_story) && result.love_story.length
      ? `<div>
           <p class="text-xs font-semibold text-gray-500 mb-1">Chuyện tình yêu (${result.love_story.length} mốc)</p>
           <div class="space-y-1.5">
             ${result.love_story
               .map(
                 (
                   it,
                   i,
                 ) => `<div class="ai-item text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                   <div class="ai-item-head">
                     <div class="min-w-0 ai-love-title">
                       ${_aiCell(it.title || "", "input", `l:${i}:title`, { cls: "font-medium text-gray-800", empty: "(tiêu đề)" })}
                       <span class="text-xs text-gray-400 ai-love-date"> · ${_aiCell(it.date || "", "input", `l:${i}:date`, { empty: "(mốc)" })}</span>
                     </div>
                   </div>
                   <div class="ai-item-head mt-0.5">
                     ${_aiCell(it.content || "", "textarea", `l:${i}:content`, { cls: "text-xs text-gray-600", empty: "(thêm mô tả)" })}
                   </div>
                 </div>`,
               )
               .join("")}
           </div>
         </div>`
      : "";

  const timelineHtml =
    Array.isArray(result.timeline) && result.timeline.length
      ? `<div>
           <p class="text-xs font-semibold text-gray-500 mb-1">Lịch trình (${result.timeline.length} mốc)</p>
           <div class="space-y-1.5">
             ${result.timeline
               .map(
                 (
                   it,
                   i,
                 ) => `<div class="ai-item text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 flex items-center gap-2">
                   ${_aiCell(it.time || "", "time", `t:${i}:time`, { cls: "text-xs font-semibold text-rose-500 whitespace-nowrap", empty: "(giờ)" })}
                   ${_aiCell(it.title || "", "input", `t:${i}:title`, { cls: "text-gray-800 flex-1", empty: "(việc)" })}
                 </div>`,
               )
               .join("")}
           </div>
         </div>`
      : "";

  // Thông tin dâu/rể AI trích xuất — mỗi hạng mục là 1 ô riêng lẻ (không dồn khối).
  const f = result.fields || {};
  const items = _AI_FIELD_LABELS
    .map(([key, label, full]) => {
      let v = f[key];
      if (v === undefined || v === null || v === "" || v === false) return "";
      // Ngân hàng: hiển thị tên đầy đủ đã map thay vì mã thô
      if (key === "groom_bank_name" || key === "bride_bank_name")
        v = _resolveBankName(v);
      // Field boolean (VD "Có lễ Vu Quy") KHÔNG cho sửa (tránh phá kiểu true/false).
      if (v === true) {
        return `<div class="ai-fld${full ? " full" : ""}">
                  <span class="ai-fld-label">${label}</span>
                  <span class="ai-fld-val">Có</span>
                </div>`;
      }
      const eid = ++_aiEid;
      const ctrl = _aiCtrlForField(key, full);
      return `<div class="ai-fld${full ? " full" : ""}">
                <div class="ai-fld-top">
                  <span class="ai-fld-label">${label}</span>${_aiPencil(eid, ctrl, "f:" + key)}
                </div>
                ${_aiDisp(eid, String(v), "ai-fld-val")}
              </div>`;
    })
    .filter(Boolean)
    .join("");
  const fieldsHtml = items
    ? `<div>
         <p class="text-xs font-semibold text-gray-500 mb-1.5">Thông tin cô dâu/chú rể</p>
         <div class="ai-fld-grid">${items}</div>
       </div>`
    : "";

  // Thứ tự: thông tin dâu/rể → chuyện tình → lịch trình → slogan (slogan cuối cùng).
  box.innerHTML = fieldsHtml + loveHtml + timelineHtml + quoteHtml;

  if (typeof _setAiView === "function") _setAiView("preview");
}

// Đọc/ghi giá trị theo "target" đã mã hoá: "q" | "f:<key>" | "l:<idx>:<sub>" | "t:<idx>:<sub>".
function _aiGetTarget(t) {
  if (!_aiResult) return "";
  if (t === "q") return _aiResult.story_quote || "";
  const [k, a, b] = t.split(":");
  if (k === "f") return (_aiResult.fields || {})[a] ?? "";
  if (k === "l") return (_aiResult.love_story?.[+a] || {})[b] ?? "";
  if (k === "t") return (_aiResult.timeline?.[+a] || {})[b] ?? "";
  return "";
}
function _aiSetTarget(t, val) {
  if (!_aiResult) return;
  if (t === "q") {
    _aiResult.story_quote = val;
    return;
  }
  const [k, a, b] = t.split(":");
  if (k === "f") (_aiResult.fields = _aiResult.fields || {})[a] = val;
  else if (k === "l") {
    const it = _aiResult.love_story?.[+a];
    if (it) it[b] = val;
  } else if (k === "t") {
    const it = _aiResult.timeline?.[+a];
    if (it) it[b] = val;
  }
}

// Bấm bút chì → thay ô hiển thị bằng control tương ứng, nạp sẵn giá trị, và ghi
// ngược vào _aiResult mỗi khi người dùng sửa. Gắn 1 lần (element #ai-preview-content
// giữ nguyên qua các lần đổi innerHTML nên listener không mất).
function _bindAiPreviewEditing(box) {
  if (box.dataset.editBound === "1") return;
  box.dataset.editBound = "1";
  box.addEventListener("click", (e) => {
    const pencil = e.target.closest(".ai-edit-ico");
    if (pencil && !pencil.classList.contains("hidden"))
      _swapToControl(box, pencil);
  });
}

// Editor đang mở (chỉ 1 tại một thời điểm): giữ đích ghi + cách đọc giá trị + listener.
let _aiActiveEdit = null;

// Gỡ editor đang mở KHÔNG dựng lại preview (dùng khi rời preview: về form / đóng modal).
function _aiTeardownActiveEdit() {
  if (!_aiActiveEdit) return;
  document.removeEventListener("pointerdown", _aiActiveEdit.onDocDown, true);
  _aiActiveEdit = null;
}

const _AI_CHECK_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

// Đóng editor đang mở: save=true → lưu giá trị mới; save=false → bỏ (giữ nguyên cũ).
// Cả 2 trường hợp đều dựng lại preview (ô về dạng hiển thị div như cũ, không còn control).
function _aiCloseActiveEdit(save) {
  const a = _aiActiveEdit;
  if (!a) return;
  _aiActiveEdit = null;
  document.removeEventListener("pointerdown", a.onDocDown, true);
  if (save) _aiSetTarget(a.target, a.readVal());
  // Không lưu → không cần khôi phục (chưa hề ghi vào _aiResult trong lúc sửa).
  _renderAiPreview(_aiResult);
}

function _swapToControl(box, pencil) {
  const eid = pencil.dataset.eid;
  const disp = box.querySelector(`.ai-disp[data-eid="${eid}"]`);
  if (!disp) return;
  const ctrl = pencil.dataset.ctrl;
  const target = pencil.dataset.target;
  const cur = String(_aiGetTarget(target) || "");

  // Chèn holder vào DOM TRƯỚC rồi mới tạo control bên trong — custom element chỉ
  // chạy connectedCallback (dựng input/flatpickr) khi đã gắn vào document.
  const holder = document.createElement("div");
  holder.className = "ai-edit-live";
  const ctrlWrap = document.createElement("div");
  ctrlWrap.className = "ai-edit-ctrl";
  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "ai-edit-ok";
  okBtn.title = "Lưu";
  okBtn.setAttribute("aria-label", "Lưu");
  okBtn.innerHTML = _AI_CHECK_SVG;
  holder.appendChild(ctrlWrap);
  disp.replaceWith(holder);

  let readVal = () => cur;
  let dateInput = null; // để loại trừ click trong lịch flatpickr khỏi "focus out"

  if (ctrl === "textarea") {
    const el = document.createElement("x-textarea");
    el.setAttribute("bare", "");
    el.setAttribute("rows", "3");
    el.setAttribute("input-class", "ai-inp resize-none");
    ctrlWrap.appendChild(el);
    const ta = el.querySelector("textarea");
    ta.value = cur;
    el.syncClearBtn?.();
    readVal = () => ta.value.trim();
    ta.focus();
  } else if (ctrl === "date") {
    // KHÔNG dùng x-date (nó tự init flatpickr kiểu append-body → lịch nhảy lung
    // tung trong bottom-sheet có transform). Tự init với static=true + appendTo
    // ctrlWrap → lịch nằm NGAY DƯỚI ô, và tự căn trái/phải nếu tràn mép phải.
    const input = document.createElement("input");
    input.type = "date";
    input.className = "ai-inp";
    ctrlWrap.appendChild(input);
    dateInput = input;
    readVal = () => {
      const d = input._flatpickr?.selectedDates?.[0];
      return d instanceof Date && !isNaN(d)
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : input.value.trim();
    };
    // Smart position: sau khi mở, nếu lịch tràn mép phải màn hình thì căn phải.
    const smartPos = (_sd, _ds, inst) => {
      const cal = inst.calendarContainer;
      if (!cal) return;
      cal.style.left = "0";
      cal.style.right = "auto";
      requestAnimationFrame(() => {
        const r = cal.getBoundingClientRect();
        if (r.right > window.innerWidth - 8) {
          cal.style.left = "auto";
          cal.style.right = "0";
        }
      });
    };
    if (window.flatpickr && typeof window._weddingFpOptions === "function") {
      const opts = window._weddingFpOptions(input);
      opts.static = true;
      opts.appendTo = ctrlWrap;
      opts.onOpen = smartPos;
      const fp = flatpickr(input, opts);
      if (cur)
        try {
          fp.setDate(cur, false);
        } catch {}
      fp.open();
    } else {
      input.value = cur;
      input.focus();
    }
  } else if (ctrl === "time") {
    const input = document.createElement("input");
    input.type = "text";
    input.readOnly = true;
    input.className = "ai-inp cursor-pointer";
    input.placeholder = "Chọn giờ";
    input.value = cur;
    readVal = () => input.value.trim();
    const openPicker = () => {
      if (typeof openTimePicker === "function") {
        // Chọn giờ trong picker = xác nhận → lưu luôn (đóng editor, về dạng hiển thị).
        openTimePicker(input, input.value, (val) => {
          input.value = val;
          _aiCloseActiveEdit(true);
        });
      }
    };
    input.addEventListener("click", openPicker);
    ctrlWrap.appendChild(input);
    openPicker();
  } else {
    const el = document.createElement("x-input");
    ctrlWrap.appendChild(el);
    const input = el.querySelector("input");
    input.value = cur;
    el.syncClearBtn?.();
    readVal = () => input.value.trim();
    input.focus();
  }

  // Nút ✓ nằm BÊN TRONG ô nhập, cùng cấp với nút × (đặt sau control → nổi trên cùng).
  ctrlWrap.appendChild(okBtn);
  pencil.classList.add("hidden"); // đang sửa → ẩn bút chì

  // "Focus out" = bấm/chạm ra ngoài editor (không phải trong lịch flatpickr / popup
  // giờ) → HUỶ, trả lại dữ liệu cũ. Dùng pointerdown capture để bắt được CẢ chuột
  // LẪN cảm ứng (mobile không phát 'mousedown' khi chạm) và bắt trước cả blur.
  const onDocDown = (e) => {
    if (holder.contains(e.target)) return; // trong editor (kể cả nút ✓/x)
    if (dateInput?._flatpickr?.calendarContainer?.contains(e.target)) return; // lịch
    if (document.getElementById("tp-popup")?.contains(e.target)) return; // popup giờ
    _aiCloseActiveEdit(false);
  };
  document.addEventListener("pointerdown", onDocDown, true);
  okBtn.addEventListener("click", () => _aiCloseActiveEdit(true));

  _aiActiveEdit = { target, readVal, onDocDown };
}

// Nhãn hiển thị cho các field trích xuất (theo thứ tự trong preview)
// [key, nhãn, full?] — full=true → ô chiếm trọn 1 hàng (địa chỉ, lời nhắn dài…).
// Ngân hàng: xếp SỐ TÀI KHOẢN trước, rồi mới đến tên ngân hàng.
const _AI_FIELD_LABELS = [
  ["groom_name", "Tên chú rể"],
  ["bride_name", "Tên cô dâu"],
  ["ceremony_name", "Tên buổi lễ"],
  ["ceremony_date", "Ngày lễ"],
  ["ceremony_time", "Giờ lễ"],
  ["ceremony_location", "Nơi tổ chức lễ", true],
  ["vu_quy_enabled", "Có lễ Vu Quy"],
  ["vu_quy_time", "Giờ Vu Quy"],
  ["vu_quy_location", "Nơi Vu Quy", true],
  ["groom_father", "Bố chú rể"],
  ["groom_mother", "Mẹ chú rể"],
  ["groom_address", "Địa chỉ nhà trai", true],
  ["bride_father", "Bố cô dâu"],
  ["bride_mother", "Mẹ cô dâu"],
  ["bride_address", "Địa chỉ nhà gái", true],
  ["groom_party_date", "Ngày tiệc nhà trai"],
  ["groom_party_time", "Giờ tiệc nhà trai"],
  ["groom_party_location", "Nơi tiệc nhà trai", true],
  ["bride_party_date", "Ngày tiệc nhà gái"],
  ["bride_party_time", "Giờ tiệc nhà gái"],
  ["bride_party_location", "Nơi tiệc nhà gái", true],
  ["rsvp_message", "Lời mời phản hồi", true],
  ["footer_text", "Lời cảm ơn", true],
  ["groom_bank_number", "STK chú rể"],
  ["groom_bank_name", "Ngân hàng chú rể"],
  ["groom_bank_owner", "Chủ TK chú rể"],
  ["bride_bank_number", "STK cô dâu"],
  ["bride_bank_name", "Ngân hàng cô dâu"],
  ["bride_bank_owner", "Chủ TK cô dâu"],
];

// Bấm "Áp dụng vào thiệp" → hỏi xác nhận ghi đè (base showConfirm ở core/helpers/alert.js),
// đồng ý mới áp dụng thật.
async function applyAiResult() {
  if (!_aiResult) return;
  const ok = await showConfirm(
    "Áp dụng nội dung AI",
    "Toàn bộ nội dung thiệp hiện tại (slogan, chuyện tình yêu, lịch trình và các thông tin do AI trích xuất) sẽ bị ghi đè bằng nội dung vừa tạo.\n\nBạn có chắc muốn tiếp tục?",
    { type: "warning", confirmText: "Ghi đè & áp dụng", cancelText: "Huỷ" },
  );
  if (ok) _doApplyAiResult();
}

// Áp dụng thật nội dung AI vào form thiệp (đã xác nhận ghi đè).
function _doApplyAiResult() {
  if (!_aiResult) return;

  // 1) Slogan → dùng lại cơ chế của randomQuote (set value + dispatch input để autosave + x-input đồng bộ)
  if (_aiResult.story_quote) {
    const ta = document.getElementById("story-quote-textarea");
    if (ta) {
      ta.value = _aiResult.story_quote;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // 2) Chuyện tình yêu → thay danh sách hiện tại
  if (Array.isArray(_aiResult.love_story) && _aiResult.love_story.length) {
    _loveStoryItems = _aiResult.love_story.map((it) => ({
      date: it.date || "",
      title: it.title || "",
      content: it.content || "",
      image_url: null,
    }));
    _loveStoryKeyExists = true;
    _syncLoveStoryHidden();
    renderLoveStoryList();
  }

  // 3) Lịch trình → thay danh sách hiện tại
  if (Array.isArray(_aiResult.timeline) && _aiResult.timeline.length) {
    _timelineItems = _aiResult.timeline.map((it) => ({
      time: it.time || "",
      title: it.title || "",
      type: it.type || "ceremony",
    }));
    _syncTimelineHidden();
    renderTimelineList();
  }

  // 4) Các field trích xuất/sinh khác (gồm ngày & giờ cưới AI trích từ Thông tin) → đổ vào form
  const f = _aiResult.fields || {};
  Object.keys(f).forEach((key) => _aiSetField(key, f[key]));

  // 5) Bật hiển thị các section tương ứng khi có nội dung
  if ((_aiResult.love_story || []).length) _aiEnableSection("love_story");
  if ((_aiResult.timeline || []).length) _aiEnableSection("timeline");
  if (f.rsvp_message) _aiEnableSection("rsvp");
  if (f.footer_text) _aiEnableSection("footer");
  if (f.groom_father || f.groom_mother || f.bride_father || f.bride_mother)
    _aiEnableSection("family");
  if (
    f.groom_party_date ||
    f.groom_party_time ||
    f.groom_party_location ||
    f.bride_party_date ||
    f.bride_party_time ||
    f.bride_party_location
  )
    _aiEnableSection("party");
  if (
    f.groom_bank_name ||
    f.groom_bank_number ||
    f.groom_bank_owner ||
    f.bride_bank_name ||
    f.bride_bank_number ||
    f.bride_bank_owner
  )
    _aiEnableSection("gift");

  // Hidden input set bằng code không tự phát event → gọi autosave thủ công
  _scheduleAutoSave();

  closeAiModal();
  showToast("✅ Đã áp dụng nội dung AI vào thiệp", "success");
}

// Đổ 1 giá trị vào field của form (tái dùng cách xử lý như fillForm):
// x-input bọc ngoài, bank name (input+hidden riêng), date dùng flatpickr (kèm âm lịch).
function _aiSetField(name, value) {
  if (value === undefined || value === null || value === "") return;
  const form = document.getElementById("wedding-form");
  if (!form) return;

  // Ngân hàng: AI trả về MÃ ngân hàng → map sang chuỗi đầy đủ trong BANK_LIST
  // để bind đúng vào control Tên ngân hàng (input hiển thị + hidden value riêng).
  if (name === "groom_bank_name" || name === "bride_bank_name") {
    const prefix = name === "groom_bank_name" ? "groom" : "bride";
    const input = document.getElementById(`${prefix}-bank-input`);
    const hidden = document.getElementById(`${prefix}-bank-value`);
    const resolved = _resolveBankName(value);
    if (input) input.value = resolved;
    if (hidden) {
      hidden.value = resolved;
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return;
  }

  // vu_quy_enabled: hidden boolean
  if (name === "vu_quy_enabled") {
    const hidden = document.getElementById("vu_quy_enabled");
    if (hidden) {
      hidden.value = value ? "true" : "false";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      if (typeof initCeremonySection === "function")
        initCeremonySection({ vu_quy_enabled: !!value });
    }
    return;
  }

  // Date field dùng Flatpickr → set qua instance để đồng bộ + cập nhật âm lịch
  if (window.flatpickrInstances && window.flatpickrInstances[name]) {
    try {
      window.flatpickrInstances[name].setDate(value, true);
    } catch (e) {}
    let el = form.querySelector(`[name="${name}"]`);
    if (el && el.tagName.startsWith("X-"))
      el = el.querySelector("input, textarea, select") || el;
    el?.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // Field thường (kể cả <x-input>/<x-time>)
  let el = form.querySelector(`[name="${name}"]`);
  if (!el) return;
  if (el.tagName.startsWith("X-"))
    el = el.querySelector("input, textarea, select") || el;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Bật hiển thị một section (set toggle = true nếu đang tắt)
function _aiEnableSection(section) {
  const field = SECTION_VIS_FIELDS[section];
  if (!field) return;
  const hidden = document.getElementById(field);
  if (!hidden) return;
  if (hidden.value !== "true") {
    hidden.value = "true";
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (typeof _updateVisUI === "function") _updateVisUI(section, true);
  if (section === "party" && typeof _updateTimelinePartySection === "function")
    _updateTimelinePartySection();
}

// Chèn khung mẫu vào ô thông tin để người dùng chỉ điền chỗ trống (để trống, không "...").
// Mẫu gồm tên cô dâu/chú rể, ngày & giờ cưới (AI tự trích), rồi địa điểm lễ, cha mẹ, STK.
// Không có dòng riêng cho địa điểm Vu Quy: nếu người dùng không ghi cụ thể, AI tự lấy
// trùng địa chỉ nhà trai/nhà gái (xem rule ở backend buildPrompt).
const _AI_INFO_TEMPLATE = [
  "Chú rể (họ tên đầy đủ): ",
  "Cô dâu (họ tên đầy đủ): ",
  "Ngày/giờ tổ chức lễ cưới: ",
  "Địa chỉ nhà trai: ",
  "Địa chỉ nhà gái: ",
  "Bố mẹ chú rể (bố / mẹ): ",
  "Bố mẹ cô dâu (bố / mẹ): ",
  "STK chú rể (số tài khoản / ngân hàng): ",
  "STK cô dâu (số tài khoản / ngân hàng): ",
  "Lịch trình cưới: ",
]
  .map((line) => "- " + line) // gạch đầu dòng cho từng ý
  .join("\n");

function insertAiInfoTemplate() {
  const ta = document.getElementById("ai-info");
  if (!ta) return;
  const cur = ta.value.trim();
  // Còn trống → chèn mẫu; đã có nội dung → nối thêm vào cuối (không ghi đè).
  const insert = cur ? `\n\n${_AI_INFO_TEMPLATE}` : _AI_INFO_TEMPLATE;
  // Chèn qua execCommand insertText (đưa con trỏ về cuối trước) thay vì gán .value:
  // giữ được stack undo native → có thể Hoàn tác/Ctrl+Z để bỏ phần mẫu vừa chèn.
  // execCommand cũng tự phát "input" nên autosave + nút "x" xoá tự đồng bộ.
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, insert);
  } catch {}
  if (!ok) {
    // Trình duyệt không hỗ trợ → fallback gán trực tiếp (mất undo cho lần chèn này).
    ta.value = cur ? `${cur}\n\n${_AI_INFO_TEMPLATE}` : _AI_INFO_TEMPLATE;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
}

// ── Ngân hàng: mã/tên viết tắt AI trả về → chuỗi đầy đủ trong BANK_LIST ───────
// AI được yêu cầu trả mã (VD "VCB", "MB", "TCB"); ở đây map về đúng tên control.
const _BANK_CODE_MAP = {
  vcb: "Vietcombank",
  ctg: "VietinBank",
  icb: "VietinBank",
  vietin: "VietinBank",
  bidv: "BIDV",
  vba: "Agribank",
  agri: "Agribank",
  agribank: "Agribank",
  mb: "MB Bank",
  mbbank: "MB Bank",
  tcb: "Techcombank",
  techcom: "Techcombank",
  acb: "ACB",
  vpb: "VPBank",
  vpbank: "VPBank",
  tpb: "TPBank",
  tpbank: "TPBank",
  stb: "Sacombank",
  sacom: "Sacombank",
  hdb: "HDBank",
  hdbank: "HDBank",
  vib: "VIB",
  shb: "SHB",
  eib: "Eximbank",
  exim: "Eximbank",
  msb: "MSB",
  ocb: "OCB",
  ssb: "SeABank",
  seab: "SeABank",
  seabank: "SeABank",
  bvb: "VietCapital Bank",
  vccb: "VietCapital Bank",
  banviet: "VietCapital Bank",
  scb: "SCB",
  vbb: "VietBank",
  vietbank: "VietBank",
  lpb: "LienVietPostBank",
  lienviet: "LienVietPostBank",
  pvcb: "PVcomBank",
  pvcombank: "PVcomBank",
  bab: "BacABank",
  bacabank: "BacABank",
  vab: "VietABank",
  vieta: "VietABank",
  ncb: "NCB",
  nvb: "NCB",
  sgb: "SaigonBank",
  sgicb: "SaigonBank",
  abb: "ABBank",
  abbank: "ABBank",
  nab: "Nam A Bank",
  namabank: "Nam A Bank",
  nama: "Nam A Bank",
  pgb: "PGBank",
  pgbank: "PGBank",
  bvbank: "BaoViet Bank",
  baoviet: "BaoViet Bank",
  gpb: "GPBank",
  gpbank: "GPBank",
  oceanbank: "OceanBank",
  ojb: "OceanBank",
  cbb: "CBBank",
  cbbank: "CBBank",
  klb: "KienLongBank",
  kienlong: "KienLongBank",
  dab: "DongA Bank",
  dongabank: "DongA Bank",
  donga: "DongA Bank",
  uob: "UOB",
  scvn: "Standard Chartered",
  standard: "Standard Chartered",
  hsbc: "HSBC",
  shbvn: "Shinhan Bank",
  shinhan: "Shinhan Bank",
  woori: "Woori Bank",
  hlb: "Hong Leong Bank",
  hongleong: "Hong Leong Bank",
  cimb: "CIMB",
  pbvn: "Public Bank",
  publicbank: "Public Bank",
};

function _normBank(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function _resolveBankName(codeOrName) {
  const raw = String(codeOrName || "").trim();
  if (!raw) return raw;
  const list = typeof BANK_LIST !== "undefined" ? BANK_LIST : [];
  if (!list.length) return raw;

  const key = _normBank(raw);
  const short = _BANK_CODE_MAP[key];
  const target = short ? _normBank(short) : key;

  // 1) khớp CHÍNH XÁC phần short name (trước " - ") của mỗi entry
  for (const entry of list) {
    if (_normBank(entry.split(" - ")[0]) === target) return entry;
  }
  // 2) khớp lỏng theo short name (chỉ khi target đủ dài, tránh nhầm)
  if (target.length >= 3) {
    for (const entry of list) {
      const sn = _normBank(entry.split(" - ")[0]);
      if (sn.includes(target) || target.includes(sn)) return entry;
    }
    // 3) khớp trong toàn bộ chuỗi đầy đủ
    for (const entry of list) {
      if (_normBank(entry).includes(target)) return entry;
    }
  }
  return raw; // không tìm được → giữ nguyên (control vẫn cho nhập tự do)
}

// ── Định vị thẻ Soft "Tạo với AI" ────────────────────────────────────────────
// DỌC: luôn cách mép TRÊN thanh nav dưới cùng đúng 16px (theo chiều cao thực của
//   navbar, kể cả khi có Local Draft Notice) — qua biến CSS --ai-fab-bottom.
// NGANG: bám theo mép PHẢI của #wedding-form (thẻ thiết lập), không phải mép màn:
//   • Màn rộng còn nhiều khoảng trắng bên phải form → đặt NGOÀI form, cách mép
//     phải form 16px (thẻ nằm gọn trong khoảng trắng).
//   • Màn hẹp không đủ chỗ → đặt PHÍA TRONG, mép phải thẻ TRÙNG mép phải form (0px).
// Theo dõi bằng ResizeObserver (nav + form) và sự kiện resize để luôn khớp.
const _AI_FAB_GAP = 16;
const _AI_FAB_CARD_W = 192; // bề rộng thẻ (12rem) — ngưỡng quyết định NGOÀI/TRONG

// Toạ độ left (px) để BÁM LỀ #wedding-form theo cạnh cho trước — dùng chung cho auto
// định-vị (_positionAiFab) LẪN bám lề sau khi kéo-thả, để "thả tay" trùng đúng vị trí
// "lúc hiển thị card":
//   • Còn đủ khoảng trắng ngoài form (chứa lọt thẻ 12rem) → NGOÀI, cách mép form 16px.
//   • Không đủ → PHÍA TRONG, mép thẻ TRÙNG mép form (0px).
//   • Chưa có form (skeleton, rect=0) → fallback bám lề màn (M=8).
function _fabSnapLeft(side, w) {
  const vw = document.documentElement.clientWidth;
  const M = 8;
  const form = document.getElementById("wedding-form");
  const r = form && form.getBoundingClientRect();
  if (!r || r.width === 0) return side === "left" ? M : vw - w - M;
  // Ngưỡng theo bề rộng THẺ (không phải nút thu gọn) để chế độ ổn định khi thu/mở.
  const fits = (gap) => gap >= _AI_FAB_GAP + _AI_FAB_CARD_W + 8;
  if (side === "left") {
    return fits(r.left) ? r.left - _AI_FAB_GAP - w : r.left;
  }
  return fits(vw - r.right) ? r.right + _AI_FAB_GAP : r.right - w;
}
// Vị trí do người dùng KÉO đặt (nhớ qua các lần tải trang). Có giá trị = chế độ thủ
// công → bỏ auto-định-vị theo #wedding-form, chỉ kẹp lại trong màn khi resize.
const _AI_FAB_POS_KEY = `cuoixinh_ai_fab_pos_${WEDDING_ID}`;

function _loadFabPos() {
  try {
    return JSON.parse(localStorage.getItem(_AI_FAB_POS_KEY) || "null");
  } catch {
    return null;
  }
}
function _saveFabPos(p) {
  try {
    localStorage.setItem(_AI_FAB_POS_KEY, JSON.stringify(p));
  } catch {}
}

// Áp vị trí thủ công (nếu có), luôn BÁM LỀ theo cạnh đã lưu (giống AssistiveTouch):
// tính lại left từ side + bề rộng hiện tại nên đúng lề kể cả khi đổi kích thước màn,
// xoay máy, hay thẻ thu/mở (card ↔ mini). Kẹp chiều dọc trong khung. Trả về true nếu áp.
function _applyManualFabPos() {
  const pos = _loadFabPos();
  const fab = document.querySelector(".ai-fab");
  if (!pos || !fab) return false;
  const w = fab.offsetWidth,
    h = fab.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const M = 8;
  // side mới (left/right) → bám lề FORM (khớp lúc hiển thị card); dữ liệu cũ
  // (pos.left tuyệt đối) vẫn đọc được, chỉ kẹp lại trong màn.
  let left;
  if (pos.side === "left" || pos.side === "right") {
    left = _fabSnapLeft(pos.side, w);
  } else {
    left = Math.max(M, Math.min(pos.left ?? vw - w - M, vw - w - M));
  }
  const top = Math.max(M, Math.min(pos.top, vh - h - M));
  fab.style.left = left + "px";
  fab.style.top = top + "px";
  fab.style.right = "auto";
  fab.style.bottom = "auto";
  return true;
}

function _positionAiFab() {
  const nav = document.getElementById("bottom-nav-bar");
  // Chỉ ghi khi navbar đã render (offsetHeight > 0). Lúc skeleton, #bottom-nav-bar
  // còn trong #actual-content (display:none) → offsetHeight = 0; nếu ghi sẽ thành
  // 8px, dán fab sát đáy đè lên thanh skeleton. Bỏ qua để dùng fallback CSS
  // (calc(60px + 24px)) cho fab nổi cao hơn thanh dưới.
  if (nav && nav.offsetHeight > 0) {
    document.documentElement.style.setProperty(
      "--ai-fab-bottom",
      nav.offsetHeight + 8 + "px",
    );
  }
  // Đã kéo đặt tay → giữ nguyên vị trí đó (chỉ kẹp lại trong màn), bỏ auto-layout.
  if (_applyManualFabPos()) return;
  const fab = document.querySelector(".ai-fab");
  const form = document.getElementById("wedding-form");
  if (!fab || !form) return;
  const r = form.getBoundingClientRect();
  // Đang skeleton: #actual-content còn .hidden (display:none) nên rect form toàn 0.
  // Tính theo lúc này sẽ khiến thẻ nhảy sang trái (left:16px). Bỏ qua, giữ vị trí
  // mặc định của CSS (right:1rem); ResizeObserver sẽ gọi lại khi form hiện ra.
  if (r.width === 0) return;
  // Bám lề PHẢI của form: ngoài form (cách 16px) nếu đủ chỗ, không thì trùng mép phải.
  fab.style.left = _fabSnapLeft("right", fab.offsetWidth) + "px";
  fab.style.right = "auto";
}

// Đóng thẻ mời của FAB (nút "x"): thu thẻ về nút tròn nhỏ (.ai-mini) trong phiên hiện
// tại, vẫn giữ lối vào AI. KHÔNG ghi nhớ — tải lại trang thì thẻ mời hiện lại.
function dismissAiFab() {
  document.querySelector(".ai-fab")?.classList.add("collapsed");
  try {
    localStorage.setItem(AI_FAB_KEY, "1");
  } catch {} // nhớ để lần sau chỉ hiện icon
  _positionAiFab(); // bề rộng đổi (thẻ → nút nhỏ) → tính lại vị trí cho khớp
}

// Cho phép KÉO-THẢ cả bong bóng AI (.ai-fab: thẻ mời lẫn nút thu gọn). Kéo quá 5px
// mới tính là kéo (để cú chạm/bấm bình thường vẫn mở popup); thả xong nhớ vị trí và
// chặn đúng cú click phát sinh ngay sau đó để không lỡ mở popup.
function _setupFabDrag() {
  const fab = document.querySelector(".ai-fab");
  if (!fab) return;
  const TH = 5;
  let startX = 0,
    startY = 0,
    baseLeft = 0,
    baseTop = 0,
    moved = false,
    dragging = false;

  fab.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return; // chỉ chuột trái
    if (e.target.closest(".ai-fab-close")) return; // nút X — để bấm đóng, không kéo
    const r = fab.getBoundingClientRect();
    baseLeft = r.left;
    baseTop = r.top;
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
    dragging = true;
    // KHÔNG setPointerCapture ở đây: bắt con trỏ ngay từ pointerdown khiến sự kiện
    // click gốc bị nuốt/đổi target → không mở được popup khi CHẠM/BẤM thường. Chỉ bắt
    // con trỏ khi đã thực sự KÉO (xem pointermove).
  });

  fab.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX,
      dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < TH) return;
    if (!moved) {
      moved = true;
      // Vượt ngưỡng → mới là kéo: giờ mới bắt con trỏ để bám tay kể cả khi ra ngoài thẻ.
      try {
        fab.setPointerCapture(e.pointerId);
      } catch {}
    }
    fab.classList.add("dragging");
    const w = fab.offsetWidth,
      h = fab.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const M = 8;
    const left = Math.max(M, Math.min(baseLeft + dx, vw - w - M));
    const top = Math.max(M, Math.min(baseTop + dy, vh - h - M));
    fab.style.left = left + "px";
    fab.style.top = top + "px";
    fab.style.right = "auto";
    fab.style.bottom = "auto";
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      fab.releasePointerCapture(e.pointerId);
    } catch {}
    if (moved) {
      fab.classList.remove("dragging");
      // Bám lề gần nhất theo chiều ngang (giống bong bóng AssistiveTouch iPhone):
      // tâm thẻ ở nửa trái → dán lề trái, nửa phải → dán lề phải. Nhưng "lề" ở đây là
      // lề của #wedding-form (cách 16px) — trùng đúng vị trí lúc hiển thị card, chứ
      // không phải mép màn. Giữ nguyên chiều dọc.
      const w = fab.offsetWidth,
        h = fab.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const M = 8;
      const r = fab.getBoundingClientRect();
      const side = r.left + w / 2 < vw / 2 ? "left" : "right";
      const snapLeft = _fabSnapLeft(side, w);
      const top = Math.max(M, Math.min(r.top, vh - h - M));
      // Trượt mượt về lề rồi bỏ transition để lần kéo sau vẫn bám tay tức thì.
      fab.style.transition =
        "left 0.22s cubic-bezier(0.32,0.72,0,1), top 0.22s cubic-bezier(0.32,0.72,0,1)";
      fab.style.left = snapLeft + "px";
      fab.style.top = top + "px";
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      const clearT = () => {
        fab.style.transition = "";
        fab.removeEventListener("transitionend", clearT);
      };
      fab.addEventListener("transitionend", clearT);
      _saveFabPos({ side, top }); // nhớ cạnh đã bám
      // Nuốt cú click sinh ra ngay sau khi thả để không mở popup do vừa kéo.
      const swallow = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      fab.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(
        () => fab.removeEventListener("click", swallow, { capture: true }),
        0,
      );
    }
  };
  fab.addEventListener("pointerup", end);
  fab.addEventListener("pointercancel", end);
}

(function _initAiFabPosition() {
  const start = () => {
    // Khôi phục trạng thái: nếu lần trước đã thu gọn → hiện luôn dạng icon nhỏ.
    try {
      if (localStorage.getItem(AI_FAB_KEY) === "1") {
        document.querySelector(".ai-fab")?.classList.add("collapsed");
      }
    } catch {}
    _positionAiFab();
    _setupFabDrag();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(_positionAiFab);
      const nav = document.getElementById("bottom-nav-bar");
      const form = document.getElementById("wedding-form");
      if (nav) ro.observe(nav);
      if (form) ro.observe(form);
    }
    window.addEventListener("resize", _positionAiFab);
    // Reflow sau khi font/layout ổn định.
    window.addEventListener("load", _positionAiFab);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
