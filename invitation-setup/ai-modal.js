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
      <p class="text-xs text-gray-500 -mt-0.5">
        Điền vài thông tin, AI sẽ gợi ý slogan, chuyện tình, lịch trình và
        tự điền các mục khác. Bạn xem trước rồi mới áp dụng.
      </p>

      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Họ và tên chú rể</label>
            <div class="ai-inp-wrap">
              <input id="ai-groom" type="text" maxlength="60" class="ai-inp has-clear" placeholder="Nguyễn Văn A" />
              <button type="button" class="ai-inp-clear" data-clear="ai-groom" aria-label="Xoá" tabindex="-1">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Họ và tên cô dâu</label>
            <div class="ai-inp-wrap">
              <input id="ai-bride" type="text" maxlength="60" class="ai-inp has-clear" placeholder="Trần Thị B" />
              <button type="button" class="ai-inp-clear" data-clear="ai-bride" aria-label="Xoá" tabindex="-1">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Ngày cưới</label>
            <x-date bare id="ai-date" name="ai_wedding_date" input-class="ai-inp"></x-date>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Giờ cưới</label>
            <input id="ai-time" type="text" readonly data-ai-timepicker class="ai-inp cursor-pointer" placeholder="Chọn giờ" />
          </div>
        </div>
      </div>

      <!-- Cài đặt phong cách -->
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

      <!-- BLOCK 1: Thông tin cô dâu/chú rể (AI trích xuất) -->
      <div class="ai-block">
        <div class="ai-block-head">
          <span class="ai-block-title">
            <i data-lucide="contact-round" style="width: 15px; height: 15px"></i>
            Thông tin cô dâu/chú rể
          </span>
          <button type="button" onclick="insertAiInfoTemplate()" class="ai-chip">
            <i data-lucide="clipboard-list" style="width: 12px; height: 12px"></i>
            Chèn mẫu
          </button>
        </div>
        <p class="ai-block-sub">
          <i data-lucide="info" style="width: 13px; height: 13px; margin-top: 1px" class="flex-shrink-0 text-rose-400"></i>
          <span>Càng nhiều thông tin, AI điền càng chính xác: bố mẹ hai bên, địa chỉ, tài khoản ngân hàng, lễ Vu Quy…</span>
        </p>
        <x-textarea
          bare
          id="ai-info"
          rows="6"
          maxlength="2500"
          input-class="ai-inp resize-none"
          placeholder="Ví dụ:&#10;Bố mẹ chú rể: Ông Nguyễn Văn An - Bà Trần Thị Bình&#10;Địa chỉ nhà trai: 12 Lê Lợi, Q.1, TP.HCM&#10;STK chú rể: Vietcombank - 0123456789&#10;Bấm 'Chèn mẫu' để có sẵn khung điền."
        ></x-textarea>
      </div>

      <!-- BLOCK 2: Chuyện tình yêu -->
      <div class="ai-block">
        <div class="ai-block-head">
          <span class="ai-block-title">
            <i data-lucide="heart" style="width: 15px; height: 15px"></i>
            Chuyện tình yêu
          </span>
        </div>
        <p class="ai-block-sub">
          <i data-lucide="info" style="width: 13px; height: 13px; margin-top: 1px" class="flex-shrink-0 text-rose-400"></i>
          <span>Bạn có thể kể tự do (không cần gạch đầu dòng). Để trống và chọn “Tự động” thì AI sẽ không tự bịa chuyện tình.</span>
        </p>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Số mốc chuyện tình</label>
            <div class="ai-cselect">
              <input type="hidden" id="ai-love-count" value="" />
              <button type="button" class="ai-inp ai-select ai-cselect-btn">
                <span class="ai-cselect-label">Tự động</span>
              </button>
              <div class="ai-cselect-panel hidden">
                <button type="button" class="ai-cselect-opt sel" data-value="">Tự động</button>
                <button type="button" class="ai-cselect-opt" data-value="3">3 mốc</button>
                <button type="button" class="ai-cselect-opt" data-value="5">5 mốc</button>
                <button type="button" class="ai-cselect-opt" data-value="7">7 mốc</button>
                <button type="button" class="ai-cselect-opt" data-value="10">10 mốc</button>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Kể đôi nét về chuyện tình</label>
            <x-textarea
              bare
              id="ai-bullets"
              rows="4"
              maxlength="1500"
              input-class="ai-inp resize-none"
              placeholder="Ví dụ: gặp nhau 2021 ở Đà Lạt; lần đầu nắm tay ở Quy Nhơn; cầu hôn đúng dịp sinh nhật…"
            ></x-textarea>
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
        class="w-full h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2"
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
let _aiDateFp = null; // instance flatpickr cho ô ngày cưới trong modal
let _aiSelectDocBound = false; // đã gắn listener đóng dropdown khi click ra ngoài chưa
let _aiViewBeforeHistory = "form"; // để "Quay lại" từ lịch sử về đúng bước trước đó

// Cache nội dung đang nhập trong modal AI → lỡ tắt vào lại không phải gõ lại.
const AI_DRAFT_KEY = `cuoixinh_ai_draft_${WEDDING_ID}`;
// Lịch sử các nội dung AI đã tạo (chỉ lưu localStorage, KHÔNG lưu DB).
const AI_HISTORY_KEY = `cuoixinh_ai_history_${WEDDING_ID}`;
const AI_HISTORY_MAX = 12;

function _saveAiDraft() {
  try {
    localStorage.setItem(
      AI_DRAFT_KEY,
      JSON.stringify({
        groom: document.getElementById("ai-groom")?.value || "",
        bride: document.getElementById("ai-bride")?.value || "",
        date: document.getElementById("ai-date")?.value || "",
        time: document.getElementById("ai-time")?.value || "",
        tone: _aiTone,
        region: document.getElementById("ai-region")?.value || "",
        loveCount: document.getElementById("ai-love-count")?.value || "",
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

  const sheet = openBottomSheet({
    id: "ai-sheet",
    title: `<span class="inline-flex items-center gap-2"><i data-lucide="sparkles" style="width:18px;height:18px" class="text-rose-500"></i> Tạo nội dung bằng AI</span>`,
    height: "92vh",
    onClose: () => {
      try {
        _aiDateFp?.destroy();
      } catch (e) {}
      // Gỡ instance tạm của ô ngày trong modal khỏi registry chung.
      if (window.flatpickrInstances) delete window.flatpickrInstances["ai_wedding_date"];
      _aiDateFp = null;
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
  // Ô ngày cưới nay là <x-date> (tự init flatpickr bằng cấu hình chung) →
  // thao tác qua instance thay vì set .value trực tiếp.
  _aiDateFp = document.getElementById("ai-date")?._flatpickr || null;
  set("ai-groom", draft.groom);
  set("ai-bride", draft.bride);
  // Chuẩn hoá về ISO (nháp cũ có thể còn lưu d/m/Y) rồi set qua flatpickr.
  const _dISO = _aiDateToISO(draft.date || "");
  if (_dISO && _aiDateFp) {
    try { _aiDateFp.setDate(_dISO, true); } catch (e) {}
  }
  set("ai-time", draft.time);
  set("ai-bullets", draft.bullets);
  set("ai-info", draft.info);
  _aiSelectApply("ai-region", draft.region);
  _aiSelectApply("ai-love-count", draft.loveCount);
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
  hb.className = "p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors";
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
  ["ai-groom", "ai-bride", "ai-bullets", "ai-info"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", _saveAiDraft);
  });

  // Nút "x" của các ô input thường (tên cô dâu/chú rể): xoá nội dung + ẩn/hiện theo value.
  document.querySelectorAll("#ai-form .ai-inp-clear").forEach((btn) => {
    const inp = document.getElementById(btn.dataset.clear);
    if (!inp) return;
    const sync = () => btn.classList.toggle("show", !!inp.value);
    inp.addEventListener("input", sync);
    inp.addEventListener("change", sync);
    btn.addEventListener("click", () => {
      inp.value = "";
      inp.focus();
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    sync();
  });
  // Ô ngày cưới nay là <x-date> dùng CHUNG flatpickr với form thiết lập (đã tự
  // init). Lưu nháp khi đổi ngày qua sự kiện "change" mà flatpickr phát ra.
  document.getElementById("ai-date")?.addEventListener("change", _saveAiDraft);

  // Control giờ cưới: dùng CHUNG time picker với màn thiết lập (openTimePicker ở core/utils.js).
  const timeEl = document.getElementById("ai-time");
  if (timeEl && typeof openTimePicker === "function") {
    timeEl.addEventListener("click", () => {
      openTimePicker(timeEl, timeEl.value, (val) => {
        timeEl.value = val;
        _saveAiDraft();
      });
    });
  }

  _wireAiSelects();
}

// Đồng bộ nút "x" của các <x-textarea> sau khi gán value bằng code (khôi phục nháp
// / xem trước lịch sử) — vì gán .value trực tiếp không phát sự kiện input.
function _syncAiClearButtons() {
  ["ai-info", "ai-bullets"].forEach((id) => {
    document.getElementById(id)?.closest("x-textarea")?.syncClearBtn?.();
  });
  // Ô input thường (tên cô dâu/chú rể): tự bật/tắt nút "x" theo value hiện tại.
  document.querySelectorAll("#ai-form .ai-inp-clear").forEach((btn) => {
    const inp = document.getElementById(btn.dataset.clear);
    if (inp) btn.classList.toggle("show", !!inp.value);
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
  set("ai-groom", "");
  set("ai-bride", "");
  set("ai-time", "");
  set("ai-info", "");
  set("ai-bullets", "");
  if (_aiDateFp) {
    try { _aiDateFp.clear(); } catch (e) {}
  }
  _aiSelectApply("ai-region", "");
  _aiSelectApply("ai-love-count", "");
  _aiTone = "romantic";
  _setAiTone(_aiTone);
  _syncAiClearButtons();
  _saveAiDraft();
  document.getElementById("ai-groom")?.focus();
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
        panel.querySelectorAll(".ai-cselect-opt").forEach((o) =>
          o.classList.toggle("sel", o === opt),
        );
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
  document.querySelectorAll(".ai-cselect-panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".ai-cselect-btn.open").forEach((b) => b.classList.remove("open"));
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
  const bodies = { form: "ai-form", preview: "ai-preview", history: "ai-history" };
  const footers = { form: "ai-footer-form", preview: "ai-footer-preview", history: "ai-footer-history" };
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
  _setAiView("form");
  // reset trạng thái streaming của khu preview
  const status = document.getElementById("ai-stream-status");
  if (status) status.classList.add("hidden"), status.classList.remove("flex");
  document
    .getElementById("ai-preview-content")
    ?.closest(".overflow-y-auto")
    ?.classList.remove("ai-lock-scroll");
}

// ── Lịch sử tạo (chỉ localStorage) ────────────────────────────────────────────
const _AI_TONE_NAMES = {
  romantic: "Lãng mạn", traditional: "Truyền thống", humorous: "Dí dỏm",
  poetic: "Thơ mộng", modern: "Hiện đại", luxury: "Sang trọng",
  cute: "Dễ thương", vintage: "Cổ điển",
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
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      groom: payload.groom_name || "",
      bride: payload.bride_name || "",
      tone: payload.tone || "",
      story_quote: result.story_quote || "",
      payload, // giữ input đã dùng để "Xem trước" có thể khôi phục & tạo lại
      result,
    };
    const list = _loadAiHistory();
    list.unshift(entry);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(list.slice(0, AI_HISTORY_MAX)));
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
    _aiResult && !document.getElementById("ai-preview")?.classList.contains("hidden")
      ? "preview"
      : "form";
  _renderAiHistory();
  _setAiView("history");
}

function backFromAiHistory() {
  _setAiView(_aiViewBeforeHistory === "preview" && _aiResult ? "preview" : "form");
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
  set("ai-groom", p.groom_name);
  set("ai-bride", p.bride_name);
  set("ai-time", p.wedding_time);
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
  const iso = _aiDateToISO(p.wedding_date || "");
  if (_aiDateFp) {
    try {
      iso ? _aiDateFp.setDate(iso, true) : _aiDateFp.clear();
    } catch (e) {}
  }
  _aiSelectApply("ai-region", p.region || "");
  _aiSelectApply("ai-love-count", p.love_count ? String(p.love_count) : "");
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
  const groom = (document.getElementById("ai-groom")?.value || "").trim();
  const bride = (document.getElementById("ai-bride")?.value || "").trim();
  const date = (document.getElementById("ai-date")?.value || "").trim();
  const time = (document.getElementById("ai-time")?.value || "").trim();
  const storyLove = (document.getElementById("ai-bullets")?.value || "").trim();
  const info = (document.getElementById("ai-info")?.value || "").trim();
  const region = document.getElementById("ai-region")?.value || "";
  const loveCount = parseInt(document.getElementById("ai-love-count")?.value || "0", 10) || 0;

  if (!groom || !bride) {
    showToast("⚠️ Vui lòng nhập tên cô dâu và chú rể", "warning");
    return;
  }

  // Chuyện tình gửi lên NGUYÊN VĂN (textarea liền mạch) — backend tự tách mốc theo
  // ngữ nghĩa, không cần client cắt dòng thành mảng.
  const payload = {
    groom_name: groom,
    bride_name: bride,
    wedding_date: date,
    wedding_time: time,
    tone: _aiTone,
    story_love: storyLove,
    info,
    region,
    love_count: loveCount,
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
    if (statusEl) statusEl.classList.remove("hidden"), statusEl.classList.add("flex");
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
    if (statusEl) statusEl.classList.add("hidden"), statusEl.classList.remove("flex");
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

    if (!gotAny) throw new Error("AI chưa tạo được nội dung, vui lòng thử lại.");
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
      showToast("⚠️ " + (err.message || "Tạo bị gián đoạn, dùng phần đã có"), "warning");
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

// Icon bút chì gợi ý ô có thể sửa (bấm để focus vào ô kế bên).
function _aiEditPencil() {
  return `<button type="button" class="ai-edit-ico" aria-label="Sửa"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`;
}
// Ô nội dung sửa trực tiếp (contenteditable) — kèm data-* để biết ghi ngược vào đâu.
function _aiEd(text, attrs, cls = "") {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeHtml(String(v))}"`)
    .join(" ");
  return `<span class="ai-editable ${cls}" contenteditable="true" spellcheck="false" ${a}>${escapeHtml(text || "")}</span>`;
}

function _renderAiPreview(result) {
  const box = document.getElementById("ai-preview-content");
  if (!box) return;
  // Có dữ liệu thật → mở lại cuộn (đã khoá lúc skeleton) và gắn cơ chế sửa.
  box.closest(".overflow-y-auto")?.classList.remove("ai-lock-scroll");
  _bindAiPreviewEditing(box);

  const quoteHtml = result.story_quote
    ? `<div>
         <div class="ai-ed-head">
           <p class="text-xs font-semibold text-gray-500">Slogan</p>${_aiEditPencil()}
         </div>
         <p class="ai-editable text-sm text-gray-800 italic bg-rose-50 rounded-xl px-3 py-2 border border-rose-100" contenteditable="true" spellcheck="false" data-eq="1">${escapeHtml(result.story_quote)}</p>
       </div>`
    : "";

  const loveHtml =
    Array.isArray(result.love_story) && result.love_story.length
      ? `<div>
           <p class="text-xs font-semibold text-gray-500 mb-1">Chuyện tình yêu (${result.love_story.length} mốc)</p>
           <div class="space-y-1.5">
             ${result.love_story
               .map(
                 (it, i) => `<div class="ai-item text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                   <div class="ai-item-head">
                     <div class="min-w-0">
                       ${_aiEd(it.title || "", { "data-el": i, "data-elk": "title" }, "font-medium text-gray-800")}
                       <span class="text-xs text-gray-400"> · ${_aiEd(it.date || "", { "data-el": i, "data-elk": "date" })}</span>
                     </div>
                     ${_aiEditPencil()}
                   </div>
                   <p class="text-xs text-gray-600 mt-0.5">${_aiEd(it.content || "", { "data-el": i, "data-elk": "content" })}</p>
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
                 (it, i) => `<div class="ai-item text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 flex items-center gap-2">
                   ${_aiEd(it.time || "", { "data-et": i, "data-etk": "time" }, "text-xs font-semibold text-rose-500 w-12 flex-shrink-0")}
                   ${_aiEd(it.title || "", { "data-et": i, "data-etk": "title" }, "text-gray-800 flex-1")}
                   ${_aiEditPencil()}
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
      if (key === "groom_bank_name" || key === "bride_bank_name") v = _resolveBankName(v);
      // Field boolean (VD "Có lễ Vu Quy") KHÔNG cho sửa (tránh phá kiểu true/false).
      if (v === true) {
        return `<div class="ai-fld${full ? " full" : ""}">
                  <span class="ai-fld-label">${label}</span>
                  <span class="ai-fld-val">Có</span>
                </div>`;
      }
      return `<div class="ai-fld${full ? " full" : ""}">
                <div class="ai-fld-top">
                  <span class="ai-fld-label">${label}</span>${_aiEditPencil()}
                </div>
                ${_aiEd(String(v), { "data-ef": key }, "ai-fld-val")}
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

// Cho phép sửa trực tiếp kết quả AI (AI có thể trả sai). Gắn 1 lần cho khung
// preview (element giữ nguyên qua các lần đổi innerHTML nên listener không mất):
//  • bấm bút chì → focus ô kế bên, đặt con trỏ cuối.
//  • gõ vào ô .ai-editable → ghi ngược giá trị vào _aiResult để "Áp dụng" dùng bản đã sửa.
function _bindAiPreviewEditing(box) {
  if (box.dataset.editBound === "1") return;
  box.dataset.editBound = "1";

  box.addEventListener("click", (e) => {
    const pencil = e.target.closest(".ai-edit-ico");
    if (!pencil) return;
    const card = pencil.closest(".ai-fld, .ai-item, div");
    const ed = card?.querySelector(".ai-editable");
    if (!ed) return;
    ed.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(ed);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch {}
  });

  box.addEventListener("input", (e) => {
    const el = e.target.closest?.(".ai-editable");
    if (!el || !_aiResult) return;
    const val = el.textContent.trim();
    if (el.dataset.ef) {
      (_aiResult.fields = _aiResult.fields || {})[el.dataset.ef] = val;
    } else if (el.dataset.eq) {
      _aiResult.story_quote = val;
    } else if (el.dataset.el != null) {
      const it = (_aiResult.love_story || [])[+el.dataset.el];
      if (it) it[el.dataset.elk] = val;
    } else if (el.dataset.et != null) {
      const it = (_aiResult.timeline || [])[+el.dataset.et];
      if (it) it[el.dataset.etk] = val;
    }
  });
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

  // 4) Các field trích xuất/sinh khác → đổ vào form
  const f = _aiResult.fields || {};
  // Ngày & giờ cưới do người dùng CHỌN ở form được ưu tiên (không để AI đè lên).
  const wd = _aiDateToISO(document.getElementById("ai-date")?.value || "");
  const wt = (document.getElementById("ai-time")?.value || "").trim();
  if (wd) f.ceremony_date = wd;
  if (wt) f.ceremony_time = wt;
  Object.keys(f).forEach((key) => _aiSetField(key, f[key]));

  // 5) Bật hiển thị các section tương ứng khi có nội dung
  if ((_aiResult.love_story || []).length) _aiEnableSection("love_story");
  if ((_aiResult.timeline || []).length) _aiEnableSection("timeline");
  if (f.rsvp_message) _aiEnableSection("rsvp");
  if (f.footer_text) _aiEnableSection("footer");
  if (f.groom_father || f.groom_mother || f.bride_father || f.bride_mother)
    _aiEnableSection("family");
  if (
    f.groom_party_date || f.groom_party_time || f.groom_party_location ||
    f.bride_party_date || f.bride_party_time || f.bride_party_location
  )
    _aiEnableSection("party");
  if (
    f.groom_bank_name || f.groom_bank_number || f.groom_bank_owner ||
    f.bride_bank_name || f.bride_bank_number || f.bride_bank_owner
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
// Ngày/giờ LỄ CƯỚI đã chọn ở trên; mẫu bổ sung địa điểm lễ, cha mẹ, STK.
// Không có dòng riêng cho địa điểm Vu Quy: nếu người dùng không ghi cụ thể, AI tự lấy
// trùng địa chỉ nhà trai/nhà gái (xem rule ở backend buildPrompt).
const _AI_INFO_TEMPLATE = [
  "Địa điểm tổ chức lễ cưới: ",
  "Địa chỉ nhà trai: ",
  "Địa chỉ nhà gái: ",
  "Bố mẹ chú rể (bố / mẹ): ",
  "Bố mẹ cô dâu (bố / mẹ): ",
  "STK chú rể (số tài khoản / ngân hàng): ",
  "STK cô dâu (số tài khoản / ngân hàng): ",
]
  .map((line) => "- " + line) // gạch đầu dòng cho từng ý
  .join("\n");

function insertAiInfoTemplate() {
  const ta = document.getElementById("ai-info");
  if (!ta) return;
  const cur = ta.value.trim();
  // Còn trống → chèn mẫu; đã có nội dung → nối thêm vào cuối (không ghi đè)
  ta.value = cur ? `${cur}\n\n${_AI_INFO_TEMPLATE}` : _AI_INFO_TEMPLATE;
  _saveAiDraft();
  _syncAiClearButtons(); // gán .value bằng code không tự phát "input" → tự đồng bộ nút "x"
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ── Ngày cưới (d/m/Y) → ISO YYYY-MM-DD để set vào flatpickr của form ──────────
function _aiDateToISO(str) {
  const s = String(str || "").trim();
  if (!s) return "";
  try {
    const d = _aiDateFp?.selectedDates?.[0];
    if (d instanceof Date && !isNaN(d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  } catch (e) {}
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

// ── Ngân hàng: mã/tên viết tắt AI trả về → chuỗi đầy đủ trong BANK_LIST ───────
// AI được yêu cầu trả mã (VD "VCB", "MB", "TCB"); ở đây map về đúng tên control.
const _BANK_CODE_MAP = {
  vcb: "Vietcombank",
  ctg: "VietinBank", icb: "VietinBank", vietin: "VietinBank",
  bidv: "BIDV",
  vba: "Agribank", agri: "Agribank", agribank: "Agribank",
  mb: "MB Bank", mbbank: "MB Bank",
  tcb: "Techcombank", techcom: "Techcombank",
  acb: "ACB",
  vpb: "VPBank", vpbank: "VPBank",
  tpb: "TPBank", tpbank: "TPBank",
  stb: "Sacombank", sacom: "Sacombank",
  hdb: "HDBank", hdbank: "HDBank",
  vib: "VIB",
  shb: "SHB",
  eib: "Eximbank", exim: "Eximbank",
  msb: "MSB",
  ocb: "OCB",
  ssb: "SeABank", seab: "SeABank", seabank: "SeABank",
  bvb: "VietCapital Bank", vccb: "VietCapital Bank", banviet: "VietCapital Bank",
  scb: "SCB",
  vbb: "VietBank", vietbank: "VietBank",
  lpb: "LienVietPostBank", lienviet: "LienVietPostBank",
  pvcb: "PVcomBank", pvcombank: "PVcomBank",
  bab: "BacABank", bacabank: "BacABank",
  vab: "VietABank", vieta: "VietABank",
  ncb: "NCB", nvb: "NCB",
  sgb: "SaigonBank", sgicb: "SaigonBank",
  abb: "ABBank", abbank: "ABBank",
  nab: "Nam A Bank", namabank: "Nam A Bank", nama: "Nam A Bank",
  pgb: "PGBank", pgbank: "PGBank",
  bvbank: "BaoViet Bank", baoviet: "BaoViet Bank",
  gpb: "GPBank", gpbank: "GPBank",
  oceanbank: "OceanBank", ojb: "OceanBank",
  cbb: "CBBank", cbbank: "CBBank",
  klb: "KienLongBank", kienlong: "KienLongBank",
  dab: "DongA Bank", dongabank: "DongA Bank", donga: "DongA Bank",
  uob: "UOB",
  scvn: "Standard Chartered", standard: "Standard Chartered",
  hsbc: "HSBC",
  shbvn: "Shinhan Bank", shinhan: "Shinhan Bank",
  woori: "Woori Bank",
  hlb: "Hong Leong Bank", hongleong: "Hong Leong Bank",
  cimb: "CIMB",
  pbvn: "Public Bank", publicbank: "Public Bank",
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

// ── Định vị FAB "Tạo với AI" ─────────────────────────────────────────────────
// Luôn cách mép TRÊN của thanh điều hướng dưới cùng đúng 16px — bất kể navbar có
// hay không Local Draft Notice (chiều cao thay đổi). Đặt biến CSS --ai-fab-bottom
// theo chiều cao thực của navbar; theo dõi bằng ResizeObserver để tự cập nhật khi
// notice hiện/ẩn hoặc bị đóng.
function _positionAiFab() {
  const nav = document.getElementById("bottom-nav-bar");
  if (!nav) return;
  document.documentElement.style.setProperty(
    "--ai-fab-bottom",
    nav.offsetHeight + 16 + "px",
  );
}

(function _initAiFabPosition() {
  const start = () => {
    _positionAiFab();
    const nav = document.getElementById("bottom-nav-bar");
    if (nav && window.ResizeObserver) {
      new ResizeObserver(_positionAiFab).observe(nav);
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
