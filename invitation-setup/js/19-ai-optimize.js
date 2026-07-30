// Tích hợp AI "Tối ưu" (làm giàu nội dung) cho các ô văn bản của trang thiết lập.
// Dùng CHUNG endpoint ai-invitation (mode=optimize), truyền inputType để server chọn
// prompt phù hợp (slogan | rsvp | footer | love_story | timeline | share).
//
// Các textarea AI dùng CHUNG thanh navbar đáy ô giống modal "Tạo nội dung với AI":
// [Tối ưu · Mic · Hoàn tác · Làm lại] — do x-undo.js (attachUndoRedo) dựng, cùng style
// .x-ta-toolbar-btn. Nút "Tối ưu" là tuỳ chọn opts.optimize của attachUndoRedo.
//
// Đăng ký trong loader.js SAU 14-timeline-story.js: tham chiếu state _loveStoryItems
// / _timelineItems (khai báo ở file 14) chỉ bên trong thân hàm, chạy lúc runtime nên
// toàn bộ script đã nạp xong.

// Bật/tắt trạng thái "đang tối ưu" của nút (CSS làm icon quay + khoá click).
function _setAiWandLoading(btn, on) {
  if (btn) btn.dataset.loading = on ? "1" : "0";
}

// CSS skeleton (tiêm 1 lần): các thanh xám shimmer phủ đúng vùng textarea khi gọi AI.
(function () {
  if (document.getElementById("x-ta-skeleton-style")) return;
  const s = document.createElement("style");
  s.id = "x-ta-skeleton-style";
  s.textContent =
    ".x-ta-skeleton{position:absolute;z-index:5;display:flex;flex-direction:column;" +
    "gap:10px;padding:12px 14px;border-radius:8px;background:#fff;overflow:hidden;" +
    "box-sizing:border-box;pointer-events:none}" +
    ".x-ta-skeleton span{height:11px;border-radius:6px;" +
    "background:linear-gradient(90deg,#eee 25%,#f5f5f5 37%,#eee 63%);" +
    "background-size:400% 100%;animation:x-ta-sk 1.4s ease infinite}" +
    ".x-ta-skeleton span:nth-child(3n+1){width:92%}" +
    ".x-ta-skeleton span:nth-child(3n+2){width:78%}" +
    ".x-ta-skeleton span:nth-child(3n){width:64%}" +
    "@keyframes x-ta-sk{0%{background-position:100% 50%}100%{background-position:0 50%}}";
  document.head.appendChild(s);
})();

// Phủ skeleton lên đúng hình chữ nhật của <textarea> trong lúc chờ AI. Dùng offset*
// (so với gốc định vị) để chỉ che ô nhập, không đè label/nút phía trên (VD ô "câu mẫu").
function _showTaSkeleton(ta) {
  if (!ta) return null;
  const host = ta.closest(".x-ta-wrap") || ta.parentElement;
  if (!host) return null;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const sk = document.createElement("div");
  sk.className = "x-ta-skeleton";
  // Số thanh skeleton = số dòng nhìn thấy (cao ô / line-height), thay vì đọc rows.
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  const rows = Math.max(3, Math.min(7, Math.floor((ta.clientHeight || lh * 4) / lh)));
  sk.innerHTML = "<span></span>".repeat(rows);
  sk.style.top = ta.offsetTop + "px";
  sk.style.left = ta.offsetLeft + "px";
  sk.style.width = ta.offsetWidth + "px";
  sk.style.height = ta.offsetHeight + "px";
  host.appendChild(sk);
  return sk;
}

// Lõi dùng chung: đọc text hiện tại → gọi AI → ghi lại. getVal/setVal do nơi gọi cấp;
// targetEl (nếu có) → hiện skeleton phủ ô trong lúc chờ.
async function _runAiOptimize(btn, inputType, getVal, setVal, targetEl) {
  if (btn && btn.dataset.loading === "1") return; // chống bấm chồng
  const cur = String(getVal() || "").trim();
  if (!cur) {
    showToast("Hãy nhập nội dung trước khi tối ưu", "warning");
    return;
  }
  _setAiWandLoading(btn, true);
  const sk = _showTaSkeleton(targetEl);
  try {
    const out = await aiDAL.optimizeText({
      inputType,
      text: cur,
      // Chỉ có tác dụng với ô chuyện tình: server lọc tên riêng khỏi mốc.
      groomName: (document.querySelector('input[name="groom_name"]')?.value || "").trim(),
      brideName: (document.querySelector('input[name="bride_name"]')?.value || "").trim(),
    });
    if (out) {
      setVal(out);
      showToast("Đã tối ưu bằng AI", "default", "sparkles");
    } else {
      showToast("AI chưa tối ưu được, thử lại nhé", "warning");
    }
  } catch (e) {
    showToast(e?.message || "Không tối ưu được", "error");
  } finally {
    _setAiWandLoading(btn, false);
    sk?.remove();
  }
}

// Cấu hình "Nói để nhập" (mic) cho từng loại ô — tiêu đề popup + câu hỏi gợi ý.
const _AI_SPEECH_FIELDS = {
  slogan: {
    title: "Nói lời ngỏ / slogan",
    questions: [
      "Bạn muốn nhắn gửi điều gì tới nửa kia?",
      "Cảm xúc của bạn về hành trình sắp tới?",
    ],
  },
  rsvp: {
    title: "Nói lời mời xác nhận tham dự",
    questions: [
      "Bạn muốn nhắn gì tới khách mời?",
      "Mong khách phản hồi tham dự thế nào?",
    ],
  },
  footer: {
    title: "Nói lời cảm ơn cuối thiệp",
    questions: ["Bạn muốn cảm ơn quan khách điều gì?"],
  },
  love_story: {
    title: "Kể về khoảnh khắc này",
    questions: ["Chuyện gì đã diễn ra?", "Cảm xúc của hai bạn lúc đó?"],
  },
  share: {
    title: "Nói tin nhắn mời khách",
    questions: ["Bạn muốn mời khách đến chung vui thế nào?"],
  },
};

// Gắn cụm điều khiển AI (Tối ưu + Mic + Undo/Redo) vào MỘT <textarea> con thật.
function _attachAiTextareaControls(target, inputType) {
  if (!target || !window.attachUndoRedo) return;
  window.attachUndoRedo(target, {
    speech: _AI_SPEECH_FIELDS[inputType],
    optimize: (t, btn) =>
      _runAiOptimize(
        btn,
        inputType,
        () => t.value,
        (v) => {
          t.value = v;
          // Bắn input để autosave + lịch sử undo ghi lại (tối ưu = 1 bước hoàn tác).
          t.dispatchEvent(new Event("input", { bubbles: true }));
        },
        t,
      ),
  });
}

// Ô "câu mẫu chia sẻ": tối ưu nhưng phải GIỮ NGUYÊN biến ##...## — so token trước/sau,
// mất biến nào thì nhắc kiểm tra (bắt 'before' ngay lúc bấm để khỏi báo nhầm).
function _attachShareControls(target) {
  if (!target || !window.attachUndoRedo) return;
  const tokensOf = (s) => new Set(String(s).match(/##[^#]+##/g) || []);
  window.attachUndoRedo(target, {
    speech: _AI_SPEECH_FIELDS.share,
    optimize: (t, btn) => {
      const before = tokensOf(t.value);
      _runAiOptimize(
        btn,
        "share",
        () => t.value,
        (v) => {
          t.value = v;
          t.dispatchEvent(new Event("input", { bubbles: true }));
          const after = tokensOf(v);
          const lost = [...before].filter((x) => !after.has(x));
          if (lost.length) showToast("Kiểm tra lại biến: " + lost.join(", "), "warning");
        },
        t,
      );
    },
  });
}

// Wire các <textarea> nội dung của "Câu chuyện tình yêu" sau mỗi lần render (file 14
// gọi hàm này ở cuối renderLoveStoryList): đặt lại value + listener + cụm AI.
function _wireLoveStoryTextareas(listEl) {
  if (!listEl) return;
  listEl.querySelectorAll("textarea[data-ls-content]").forEach((ta) => {
    const idx = Number(ta.dataset.lsContent);
    // <x-textarea> render bỏ text con → nạp lại value TRƯỚC khi gắn undo (làm mốc gốc).
    const val = _loveStoryItems[idx]?.content || "";
    if (ta.value !== val) ta.value = val;
    ta.closest("x-textarea")?.syncClearBtn?.(); // hiện nút "x" đúng khi có nội dung
    if (!ta._lsWired) {
      ta._lsWired = true;
      ta.addEventListener("input", () => {
        if (_loveStoryItems[idx]) {
          _loveStoryItems[idx].content = ta.value;
          _syncLoveStoryHidden();
        }
      });
    }
    _attachAiTextareaControls(ta, "love_story");
  });
}

// Một sự kiện trong "Lịch trình ngày cưới" (ô input 1 dòng, giữ nút icon inline).
function optimizeTimelineTitle(idx, btn) {
  _runAiOptimize(
    btn,
    "timeline",
    () => (_timelineItems[idx] && _timelineItems[idx].title) || "",
    (v) => {
      if (!_timelineItems[idx]) return;
      _timelineItems[idx].title = v;
      _syncTimelineHidden();
      renderTimelineList();
    },
  );
}

// Gắn cụm AI cho các ô TĨNH (đã là <x-textarea> sẵn) sau khi toàn bộ script đã nạp.
window.__cxOnReady?.(function () {
  _attachAiTextareaControls(
    document.querySelector('textarea[name="story_quote"]'),
    "slogan",
  );
  _attachAiTextareaControls(
    document.querySelector('textarea[name="rsvp_message"]'),
    "rsvp",
  );
  _attachAiTextareaControls(
    document.querySelector('textarea[name="footer_text"]'),
    "footer",
  );
  _attachShareControls(document.getElementById("share-message-template"));
});

// ── "Tạo câu chuyện tình yêu" bằng AI (panel inline, không popup) ─────────────
// Nút ở đầu mục → mở ô textarea kể tự do + nút "Tạo". AI trả danh sách mốc
// {date,title,content} → fill thẳng vào từng block của mục.

// Mở/đóng panel nhập chuyện tình. force=true bắt mở, false bắt đóng, undefined = lật.
function toggleLoveAiPanel(force) {
  const panel = document.getElementById("love-ai-panel");
  if (!panel) return;
  const show = force === undefined ? panel.classList.contains("hidden") : !!force;
  panel.classList.toggle("hidden", !show);
  if (show) document.getElementById("love-ai-input")?.focus();
}

async function generateLoveStoryAi(btn) {
  const ta = document.getElementById("love-ai-input");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) {
    showToast("Hãy kể câu chuyện tình yêu trước", "warning");
    ta.focus();
    return;
  }
  if (btn && btn.dataset.loading === "1") return;
  _setAiWandLoading(btn, true);
  try {
    // Gửi kèm tên đang điền: chuyện tình phải ở ngôi "chúng mình/anh/em",
    // server dùng hai tên này để lọc nốt tên nếu AI lỡ gọi thẳng.
    const items = await aiDAL.generateLoveStory({
      text,
      groomName: (document.querySelector('input[name="groom_name"]')?.value || "").trim(),
      brideName: (document.querySelector('input[name="bride_name"]')?.value || "").trim(),
    });
    if (!items.length) {
      showToast("AI chưa tạo được mốc nào, thử kể chi tiết hơn nhé", "warning");
      return;
    }
    // Thay toàn bộ danh sách bằng các mốc AI tạo (cắt theo trần cho phép).
    _loveStoryItems.length = 0;
    Object.keys(_loveStoryPendingImages).forEach(
      (k) => delete _loveStoryPendingImages[k],
    );
    items.slice(0, MAX_LOVE_STORY_ITEMS).forEach((it) => {
      _loveStoryItems.push({
        date: it.date || "",
        title: it.title || "",
        content: it.content || "",
        image_url: null,
      });
    });
    _syncLoveStoryHidden();
    renderLoveStoryList();
    _idbSaveLoveStoryImages(); // đồng bộ IDB (đã xoá ảnh pending cũ)
    // Bật hiển thị mục trên thiệp + kích hoạt autosave (hidden set bằng code không tự bắn).
    if (typeof _aiEnableSection === "function") _aiEnableSection("love_story");
    document
      .getElementById("love-story-value")
      ?.dispatchEvent(new Event("input", { bubbles: true }));
    showToast("Đã tạo " + _loveStoryItems.length + " mốc chuyện tình", "default", "sparkles");
    ta.value = "";
    toggleLoveAiPanel(false);
  } catch (e) {
    showToast(e?.message || "Không tạo được", "error");
  } finally {
    _setAiWandLoading(btn, false);
  }
}

window.optimizeTimelineTitle = optimizeTimelineTitle;
window._wireLoveStoryTextareas = _wireLoveStoryTextareas;
window.toggleLoveAiPanel = toggleLoveAiPanel;
window.generateLoveStoryAi = generateLoveStoryAi;
