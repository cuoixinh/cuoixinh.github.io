// Trợ lý AI của trang chủ: bong bóng nổi góc phải + bảng chat tư vấn về dịch vụ.
// Toàn bộ markup dựng ở đây (như core/payment.js) nên index.html chỉ cần một thẻ
// <script>; style ở styles/_ai-chat.css.
//
// Lớp UI thuần: mọi thứ gọi model đi qua window.aiChatDAL (core/dal/ai-chat-dal.js)
// → Edge Function ai-chat, nơi giữ tri thức sản phẩm và hạn mức.

(function () {
  const STORE_KEY = "cx_aichat_history"; // sessionStorage: giữ đoạn chat khi F5
  const MAX_KEEP = 20; // số tin nhắn giữ lại (server chỉ đọc 12 tin cuối)
  const MAX_LEN = 800; // khớp MAX_MSG_LEN của Edge Function

  const GREETING =
    "Chào bạn 👋 Mình là trợ lý của Cưới Xinh.\n" +
    "Bạn muốn biết gì về thiệp cưới online — cách làm, giá, hay tính năng trong thiệp?";

  const SUGGESTS = [
    "Làm thiệp mất bao lâu?",
    "Giá bao nhiêu?",
    "Thiệp có những gì?",
    "Dùng thử được không?",
  ];

  // Lịch sử gửi lên server: [{role:"user"|"assistant", content, at}]. `at` chỉ để
  // vẽ giờ dưới bong bóng, server bỏ qua. Lời chào KHÔNG nằm trong này — nó là
  // câu mở màn của giao diện, không phải một lượt hội thoại.
  let history = [];
  let busy = false;
  let abort = null; // AbortController của lượt đang chạy (nút Làm mới huỷ nó)
  let els = null;

  // ── Dựng giao diện ────────────────────────────────────────────────────────

  function build() {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "aichatFab";
    fab.className = "aichat-fab";
    fab.setAttribute("aria-label", "Mở trợ lý AI");
    fab.innerHTML = '<i data-icon="wand-sparkles" data-size="22"></i>';

    const panel = document.createElement("div");
    panel.id = "aichatPanel";
    panel.className = "aichat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Trợ lý AI Cưới Xinh");
    panel.innerHTML = `
      <div class="aichat-head">
        <span class="aichat-head-icon"><i data-icon="sparkles" data-size="18"></i></span>
        <div class="min-w-0 flex-1">
          <p class="aichat-head-title">Trợ lý AI</p>
          <p class="aichat-head-sub">Hỏi gì về thiệp cưới cũng được</p>
        </div>
        <x-button variant="bare" icon-only id="aichatReset" type="button"
                  aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới"
                  class="aichat-head-btn">
          <i data-icon="refresh-cw" data-size="16"></i>
        </x-button>
        <x-button variant="bare" icon-only id="aichatClose" type="button"
                  aria-label="Đóng trợ lý" class="aichat-head-btn">
          <i data-icon="x" data-size="18"></i>
        </x-button>
      </div>
      <div class="aichat-body" id="aichatBody"></div>
      <div class="aichat-suggests" id="aichatSuggests"></div>
      <p class="aichat-note">Trợ lý có thể trả lời chưa chính xác — cần chắc chắn, bạn gọi 034.884.0032 nhé.</p>
      <div class="aichat-foot">
        <textarea id="aichatInput" class="aichat-input" rows="1" maxlength="${MAX_LEN}"
                  placeholder="Nhập câu hỏi của bạn…"
                  aria-label="Câu hỏi cho trợ lý"></textarea>
        <x-button variant="bare" icon-only id="aichatSend" type="button"
                  aria-label="Gửi" class="aichat-send">
          <i data-icon="send" data-size="18"></i>
        </x-button>
      </div>`;

    // Append TRƯỚC khi truy vấn: <x-button> tự thay mình bằng <button> thật ngay
    // lúc được gắn vào DOM, tra cứu sớm hơn là bắt được thẻ sắp bị vứt đi.
    document.body.append(fab, panel);

    els = {
      fab,
      panel,
      body: panel.querySelector("#aichatBody"),
      suggests: panel.querySelector("#aichatSuggests"),
      input: panel.querySelector("#aichatInput"),
      send: panel.querySelector("#aichatSend"),
      reset: panel.querySelector("#aichatReset"),
    };
  }

  // ── Bong bóng tin nhắn ────────────────────────────────────────────────────
  // Dùng textContent chứ không innerHTML: câu trả lời do model sinh ra, không
  // được phép thành HTML. Xuống dòng đã có `whitespace-pre-wrap` lo.

  function timeLabel(at) {
    return new Date(at || Date.now()).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Trả về chính bong bóng (luồng streaming ghi đè textContent của nó).
  function addBubble(role, text, at) {
    const row = document.createElement("div");
    row.className = "aichat-row " + (role === "user" ? "aichat-row-user" : "aichat-row-bot");

    const bubble = document.createElement("div");
    bubble.className =
      "aichat-msg " +
      (role === "user"
        ? "aichat-msg-user"
        : role === "error"
          ? "aichat-msg-error"
          : "aichat-msg-bot");
    bubble.textContent = text;
    row.appendChild(bubble);

    // Báo lỗi không phải một lượt hội thoại nên không đóng dấu giờ.
    if (role !== "error") {
      const time = document.createElement("span");
      time.className = "aichat-time";
      time.textContent = timeLabel(at);
      row.appendChild(time);
    }

    els.body.appendChild(row);
    scrollToEnd();
    return bubble;
  }

  function addTyping() {
    const el = document.createElement("div");
    el.className = "aichat-typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    els.body.appendChild(el);
    scrollToEnd();
    return el;
  }

  function scrollToEnd() {
    els.body.scrollTop = els.body.scrollHeight;
  }

  // Chip gợi ý chỉ hữu ích lúc chưa biết hỏi gì → ẩn hẳn sau câu hỏi đầu tiên.
  function renderSuggests() {
    els.suggests.innerHTML = "";
    if (history.length) {
      els.suggests.hidden = true;
      return;
    }
    els.suggests.hidden = false;
    SUGGESTS.forEach((q) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "aichat-chip";
      chip.textContent = q;
      chip.addEventListener("click", () => ask(q));
      els.suggests.appendChild(chip);
    });
  }

  // ── Lịch sử ───────────────────────────────────────────────────────────────

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      history = raw ? JSON.parse(raw) : [];
    } catch {
      history = [];
    }
    if (!Array.isArray(history)) history = [];
  }

  function saveHistory() {
    history = history.slice(-MAX_KEEP);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history));
    } catch {
      /* hết chỗ / chặn cookie: chat vẫn chạy, chỉ không nhớ qua lần tải lại */
    }
  }

  function paintHistory() {
    els.body.innerHTML = "";
    addBubble("bot", GREETING);
    history.forEach((m) =>
      addBubble(m.role === "user" ? "user" : "bot", m.content, m.at),
    );
    renderSuggests();
  }

  // Nút Làm mới: xoá sạch đoạn chat, về lại màn chào. Huỷ luôn lượt đang chạy —
  // để nó chạy tiếp thì câu trả lời của cuộc cũ sẽ rơi vào cuộc mới.
  function clearChat() {
    abort?.abort();
    history = [];
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* chặn cookie: bộ nhớ trong phiên đã sạch là đủ */
    }
    paintHistory();
    els.input.value = "";
    autoGrow();
    // Chỉ lấy con trỏ trên máy tính: ở điện thoại, focus là bật bàn phím lên
    // giữa lúc khách chỉ muốn dọn màn hình.
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
  }

  // ── Hỏi ───────────────────────────────────────────────────────────────────

  async function ask(question) {
    const text = String(question || "").trim().slice(0, MAX_LEN);
    if (!text || busy) return;

    busy = true;
    els.send.disabled = true;
    els.input.value = "";
    autoGrow();

    addBubble("user", text);
    history.push({ role: "user", content: text, at: Date.now() });
    saveHistory();
    renderSuggests();

    const typing = addTyping();
    let bubble = null;
    abort = new AbortController();
    const mine = abort; // giữ lại để biết lượt này có bị Làm mới cắt ngang không

    try {
      const answer = await window.aiChatDAL.ask(
        history,
        (partial) => {
          // Mảnh chữ đầu tiên tới nơi → thay ba chấm bằng bong bóng thật.
          if (!bubble) {
            typing.remove();
            bubble = addBubble("bot", "");
          }
          bubble.textContent = partial;
          scrollToEnd();
        },
        mine.signal,
      );

      typing.remove();
      if (!bubble) bubble = addBubble("bot", "");
      bubble.textContent = answer;
      history.push({ role: "assistant", content: answer, at: Date.now() });
      saveHistory();
    } catch (e) {
      typing.remove();
      // Bị nút Làm mới cắt ngang: màn đã sạch rồi, đừng vẽ gì thêm lên đó.
      if (mine.signal.aborted) return;
      bubble?.remove();
      addBubble("error", e?.message || "Trợ lý đang bận, bạn thử lại sau ít phút nhé.");
      // Câu hỏi lỗi không được nằm lại trong lịch sử: lần hỏi sau sẽ gửi kèm một
      // lượt "khách hỏi" chưa có lời đáp, model dễ trả lời lệch.
      history.pop();
      saveHistory();
    } finally {
      busy = false;
      els.send.disabled = false;
      if (abort === mine) abort = null;
      scrollToEnd();
    }
  }

  // ── Đóng / mở ─────────────────────────────────────────────────────────────

  function open() {
    els.panel.hidden = false;
    els.panel.classList.add("is-opening");
    document.documentElement.classList.add("aichat-open");
    // Bỏ cờ ở khung hình sau để trình duyệt kịp thấy trạng thái đầu → có
    // transition thay vì hiện bụp một cái.
    requestAnimationFrame(() => els.panel.classList.remove("is-opening"));
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
    scrollToEnd();
  }

  function close() {
    els.panel.classList.add("is-closing");
    document.documentElement.classList.remove("aichat-open");
    setTimeout(() => {
      els.panel.hidden = true;
      els.panel.classList.remove("is-closing");
    }, 200);
  }

  // Ô nhập cao dần theo nội dung, tối đa max-h-24 do CSS chặn.
  function autoGrow() {
    els.input.style.height = "auto";
    els.input.style.height = els.input.scrollHeight + "px";
  }

  // ── Khởi động ─────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById("aichatFab")) return;
    build();
    loadHistory();
    paintHistory();

    els.fab.addEventListener("click", open);
    // Hai nút trên thanh tiêu đề là <x-button> — chúng TỰ THAY mình bằng
    // <button> thật, nên bắt sự kiện ở panel thay vì gắn vào thẻ đã biến mất.
    els.panel.addEventListener("click", (e) => {
      if (e.target.closest("#aichatClose")) close();
      else if (e.target.closest("#aichatReset")) clearChat();
    });
    els.send.addEventListener("click", () => ask(els.input.value));
    els.input.addEventListener("input", autoGrow);
    els.input.addEventListener("keydown", (e) => {
      // Enter gửi, Shift+Enter xuống dòng (thói quen của mọi khung chat).
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ask(els.input.value);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.panel.hidden) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
