// Trợ lý AI: bong bóng nổi góc phải + bảng chat vừa tư vấn dịch vụ vừa hỏi thông
// tin rồi DỰNG LUÔN nội dung thiệp. Dùng ở trang chủ và trang Thiết lập (ở đó
// 24-ai-apply.js đổ kết quả thẳng vào form).
// Toàn bộ markup dựng ở đây (như core/payment.js) nên index.html chỉ cần một thẻ
// <script>; style ở styles/_ai-chat.css.
//
// Lớp UI thuần: mọi thứ gọi model đi qua window.aiChatDAL (core/dal/ai-chat-dal.js)
// → Edge Function ai-chat, nơi giữ tri thức sản phẩm, luật thu thập và hạn mức.
//
// Dùng ở HAI nơi. Trang chủ: thiệp dựng xong đi sang trang thiết lập qua
// localStorage (CARD_KEY) chứ không qua URL vì nó là object vài KB — bên đọc là
// invitation-setup/js/24-ai-apply.js. Trang Thiết lập: đã có thiệp đang mở nên gọi
// thẳng window.cxApplyAiCard, không dựng nháp mới.

(function () {
  const STORE_KEY = "cx_aichat_history"; // sessionStorage: giữ đoạn chat khi F5
  const KNOWN_KEY = "cx_aichat_known"; // sessionStorage: thông tin thiệp đã thu được
  const CARD_KEY = buildCacheKey("chat_card"); // localStorage: bàn giao sang trang thiết lập
  const DRAFT_KEY = "cx_aichat_draft"; // sessionStorage: nháp gắn với cuộc chat này
  const MAX_KEEP = 20; // số tin nhắn giữ lại (server chỉ đọc 20 tin cuối)
  const MAX_LEN = 800; // khớp MAX_MSG_LEN của Edge Function

  const GREETING =
    "Chào bạn 👋 Mình là trợ lý của Cưới Xinh.\n" +
    "Bạn cứ hỏi mình về thiệp cưới online — hoặc bảo mình tạo thiệp, mình hỏi vài " +
    "thông tin rồi dựng luôn cho bạn.";

  const SUGGESTS = [
    "Mình muốn tạo thiệp cưới",
    "Giá bao nhiêu?",
    "Thiệp có những gì?",
    "Dùng thử được không?",
  ];

  // Lịch sử gửi lên server: [{role:"user"|"assistant", content, at}]. `at` chỉ để
  // vẽ giờ dưới bong bóng, server bỏ qua. Lời chào KHÔNG nằm trong này — nó là
  // câu mở màn của giao diện, không phải một lượt hội thoại.
  let history = [];
  // Thông tin thiệp gom được qua các lượt ({tone, region, fields}). Server trả về
  // sau mỗi lượt và cần nhận lại ở lượt sau — lịch sử hội thoại chỉ mang lời nói,
  // không mang dữ liệu, nên thiếu cái này là model hỏi lại từ đầu.
  let known = null;
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
    fab.innerHTML = '<i data-lucide="wand-sparkles" style="width:22px;height:22px"></i>';

    const panel = document.createElement("div");
    panel.id = "aichatPanel";
    panel.className = "aichat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Trợ lý AI Cưới Xinh");
    panel.innerHTML = `
      <div class="aichat-head">
        <div class="min-w-0 flex-1">
          <p class="aichat-head-title flex gap-1">Trợ lý AI Cưới Xinh <i data-icon="sparkles-solid" data-size="24"></i></p>
          <p class="aichat-head-sub">Hỏi đáp hoặc nhờ mình tạo thiệp</p>
        </div>
        <x-button variant="bare" icon-only id="aichatReset" type="button"
                  aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới"
                  class="aichat-head-btn">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px"></i>
        </x-button>
        <x-button variant="bare" icon-only id="aichatClose" type="button"
                  aria-label="Đóng trợ lý" class="aichat-head-btn">
          <i data-lucide="x" style="width:18px;height:18px"></i>
        </x-button>
      </div>
      <div class="aichat-body" id="aichatBody"></div>
      <div class="aichat-suggests" id="aichatSuggests"></div>
      <div class="aichat-foot">
        <div class="aichat-composer">
          <textarea id="aichatInput" class="aichat-input" rows="1" maxlength="${MAX_LEN}"
                    placeholder="Nhập câu hỏi của bạn…"
                    aria-label="Câu hỏi cho trợ lý"></textarea>
          <x-button variant="bare" icon-only id="aichatMic" type="button"
                    aria-label="Nhập bằng giọng nói" title="Nhập bằng giọng nói"
                    aria-pressed="false" class="aichat-mic">
            <i data-lucide="mic" style="width:18px;height:18px"></i>
          </x-button>
          <x-button variant="bare" icon-only id="aichatSend" type="button"
                    aria-label="Gửi" class="aichat-send">
            <i data-lucide="send" style="width:18px;height:18px"></i>
          </x-button>
        </div>
      </div>`;

    // Append TRƯỚC khi truy vấn: <x-button> tự thay mình bằng <button> thật ngay
    // lúc được gắn vào DOM, tra cứu sớm hơn là bắt được thẻ sắp bị vứt đi.
    document.body.append(fab, panel);
    window.lucide?.createIcons({ root: fab });
    window.lucide?.createIcons({ root: panel });
    window.cxRenderIcons?.(panel);

    els = {
      fab,
      panel,
      body: panel.querySelector("#aichatBody"),
      suggests: panel.querySelector("#aichatSuggests"),
      input: panel.querySelector("#aichatInput"),
      mic: panel.querySelector("#aichatMic"),
      send: panel.querySelector("#aichatSend"),
      reset: panel.querySelector("#aichatReset"),
    };
  }

  // ── Markdown nhẹ ──────────────────────────────────────────────────────────
  // Câu trả lời do model sinh ra nên TUYỆT ĐỐI không cắm thẳng vào innerHTML:
  // thoát HTML trước, rồi tự dựng lại đúng bốn thứ prompt cho phép (xem
  // CHAT_RULES trong supabase/functions/ai-chat/knowledge.ts) — **đậm**, `mã`,
  // gạch đầu dòng "- ", danh sách "1.". Ký hiệu khác giữ nguyên văn.

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Nhấn mạnh TRONG MỘT DÒNG. Tách theo `mã` trước để dấu sao nằm trong đoạn mã
  // còn nguyên; mọi mẫu đều cấm ký tự xuống dòng nên không nuốt lây dòng dưới.
  function mdInline(s) {
    return s
      .split(/(`[^`\n]+`)/)
      .map((seg) =>
        seg.length > 2 && seg.startsWith("`") && seg.endsWith("`")
          ? "<code>" + seg.slice(1, -1) + "</code>"
          : seg
              .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
              .replace(/(^|[\s(])[*_]([^*_\n]+)[*_]/g, "$1<em>$2</em>"),
      )
      .join("");
  }

  const RE_BULLET = /^[ \t]*[-*•][ \t]+(.*)$/;
  const RE_ORDER = /^[ \t]*(\d{1,2})[.)][ \t]+(.*)$/;

  // Trả về HTML đã an toàn: khối <p>/<ul>/<ol>, xuống dòng lẻ thành <br>.
  function mdToHtml(src) {
    const lines = esc(src).replace(/\r\n?/g, "\n").split("\n");
    let html = "";
    let list = ""; // "ul" | "ol" | "" (chưa mở danh sách nào)
    let para = [];

    const flushPara = () => {
      if (!para.length) return;
      html += "<p>" + mdInline(para.join("\n")).replace(/\n/g, "<br>") + "</p>";
      para = [];
    };
    const closeList = () => {
      if (list) html += "</" + list + ">";
      list = "";
    };
    // Danh sách đánh số không bắt đầu từ 1 (nhắc lại mục còn thiếu: "2.", "4.")
    // thì phải khai `start`, không thì trình duyệt đánh lại từ 1.
    const openList = (kind, start) => {
      if (list === kind) return;
      closeList();
      list = kind;
      html +=
        kind === "ol" && start !== 1
          ? '<ol start="' + start + '">'
          : "<" + kind + ">";
    };

    for (const line of lines) {
      if (!line.trim()) {
        flushPara();
        closeList();
        continue;
      }
      const bullet = line.match(RE_BULLET);
      const order = bullet ? null : line.match(RE_ORDER);
      if (bullet) {
        flushPara();
        openList("ul", 1);
        html += "<li>" + mdInline(bullet[1]) + "</li>";
      } else if (order) {
        flushPara();
        openList("ol", Number(order[1]));
        html += "<li>" + mdInline(order[2]) + "</li>";
      } else {
        closeList();
        para.push(line);
      }
    }
    flushPara();
    closeList();
    return html;
  }

  // Bản đang gõ dở: bỏ cụm ký hiệu vừa gõ ra ở CUỐI rồi tự khép cặp còn hở, để
  // chữ hiện lên là đậm sẵn thay vì nhấp nháy mấy dấu sao rồi mới đậm.
  function mdPartial(s) {
    let t = s.replace(/[*_`]+$/, "");
    if ((t.match(/`/g) || []).length % 2) t += "`";
    if ((t.match(/\*\*/g) || []).length % 2) t += "**";
    return t;
  }

  // ── Bong bóng tin nhắn ────────────────────────────────────────────────────

  // Chỉ bong bóng của TRỢ LÝ đi qua markdown (cờ .aichat-md); lời khách và báo
  // lỗi dùng textContent — chữ khách gõ không việc gì phải diễn giải.
  function paintBubble(bubble, text, partial) {
    if (bubble.classList.contains("aichat-md"))
      bubble.innerHTML = mdToHtml(partial ? mdPartial(text) : text);
    else bubble.textContent = text;
  }

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
          : "aichat-msg-bot aichat-md");
    paintBubble(bubble, text, false);
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

  // ── Chữ chạy đều ──────────────────────────────────────────────────────────
  // Server nhả chữ theo cụm to nhỏ thất thường (một tiếng, rồi cả đoạn) — dán
  // thẳng vào bong bóng là nhìn giật cục. Bộ đệm này giữ chữ lại rồi rót ra
  // theo khung hình, tốc độ bám theo phần còn tồn nên không bao giờ tụt lại xa.

  const TYPE_DRAIN_MS = 260; // ngần này là xả hết chỗ đang tồn
  const TYPE_MIN_CPS = 40; // tốc độ sàn: chữ về nhỏ giọt cũng không rề rà

  let typer = null;

  function typeStart(bubble) {
    typer = { bubble, target: "", n: 0, last: 0, raf: 0, resolve: null };
  }

  // partial = TOÀN BỘ câu tính tới lúc này (DAL cộng dồn sẵn), không phải mảnh mới.
  function typeFeed(partial) {
    if (!typer) return;
    typer.target = partial;
    if (!typer.raf) {
      typer.last = performance.now();
      typer.raf = requestAnimationFrame(typeStep);
    }
  }

  function typeStep(now) {
    const t = typer;
    if (!t) return;
    // Tab bị ẩn rồi quay lại: dt tính ra cả giây — kẹp lại kẻo nhả một cục.
    const dt = Math.min(now - t.last, 120);
    t.last = now;
    const left = t.target.length - t.n;
    if (left > 0) {
      const cps = Math.max(TYPE_MIN_CPS, (left * 1000) / TYPE_DRAIN_MS);
      t.n = Math.min(t.target.length, t.n + Math.max(1, Math.round((cps * dt) / 1000)));
      paintBubble(t.bubble, t.target.slice(0, t.n), true);
      scrollToEnd();
    }
    if (t.n < t.target.length) t.raf = requestAnimationFrame(typeStep);
    else {
      t.raf = 0;
      t.resolve?.(); // chỉ có khi typeFinish đang đợi gõ nốt
    }
  }

  // Chốt bằng bản đầy đủ của server rồi đợi gõ hết — có đợi thì lượt sau mới
  // không chen vào giữa lúc câu này còn đang chạy.
  function typeFinish(text) {
    const t = typer;
    if (!t) return Promise.resolve();
    t.target = text;
    if (t.n >= text.length) {
      paintBubble(t.bubble, text, false);
      typeStop();
      return Promise.resolve();
    }
    return new Promise((done) => {
      t.resolve = () => {
        paintBubble(t.bubble, text, false); // gõ xong: vẽ lại bản đầy đủ
        typeStop();
        done();
      };
      if (!t.raf) {
        t.last = performance.now();
        t.raf = requestAnimationFrame(typeStep);
      }
    });
  }

  function typeStop() {
    if (typer?.raf) cancelAnimationFrame(typer.raf);
    typer = null;
  }

  // ── Thiệp dựng xong ───────────────────────────────────────────────────────
  // Model trả về nguyên bộ nội dung thiệp (cùng shape với kết quả của bảng "Tạo
  // bằng AI" ở trang thiết lập). Ở đây chỉ vẽ thẻ tóm tắt + một nút; bấm nút là
  // gửi bộ đó sang trang thiết lập rồi điều hướng.

  // "2026-12-20" → "20/12/2026". Không đúng dạng thì trả nguyên văn.
  function fmtDate(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(v || "");
  }

  // Địa điểm lễ thường là địa chỉ dài; thẻ tóm tắt chỉ cần thành phần đầu.
  function shortPlace(v) {
    return String(v || "").split(",")[0].trim();
  }

  function addBuilding() {
    const el = document.createElement("div");
    el.className = "aichat-building";
    el.textContent = "Đang dựng nội dung thiệp…";
    els.body.appendChild(el);
    scrollToEnd();
    return el;
  }

  // Thiệp mới ra thì thẻ cũ hết bấm được: nội dung của nó đã lỗi thời, bấm nhầm
  // là mang sang trang thiết lập đúng thứ khách vừa bảo sửa.
  function staleCards() {
    els.body.querySelectorAll(".aichat-card").forEach((box) => {
      box.classList.add("is-stale");
      const btn = box.querySelector("button");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Đã có bản mới hơn";
      }
    });
  }

  function addCardAction(row, card) {
    if (!row) return;
    staleCards();
    const f = card.fields || {};
    // Object thiệp treo thẳng lên phần tử, không serialize: nút bấm chỉ cần tìm
    // ngược lên hàng chứa nó là có đủ dữ liệu.
    row._cxCard = card;

    const box = document.createElement("div");
    box.className = "aichat-card";

    const add = (cls, text) => {
      if (!text) return;
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = text;
      box.appendChild(p);
    };

    add("aichat-card-title", "✨ Thiệp đã sẵn sàng");
    add("aichat-card-name", [f.groom_name, f.bride_name].filter(Boolean).join(" & "));
    add(
      "aichat-card-meta",
      [f.ceremony_time, fmtDate(f.ceremony_date), shortPlace(f.ceremony_location)]
        .filter(Boolean)
        .join(" · "),
    );
    const nLove = (card.love_story || []).length;
    const nTime = (card.timeline || []).length;
    add(
      "aichat-card-meta",
      [nLove ? nLove + " mốc chuyện tình" : "", nTime ? nTime + " mốc lịch trình" : ""]
        .filter(Boolean)
        .join(" · "),
    );

    // <x-button> TỰ THAY mình bằng <button> thật lúc gắn vào DOM → bắt click bằng
    // uỷ nhiệm ở els.body (xem init), đừng gắn listener vào thẻ sắp bị vứt đi.
    const btn = document.createElement("x-button");
    btn.setAttribute("variant", "fill");
    btn.setAttribute("size", "sm");
    btn.setAttribute("full", "");
    btn.setAttribute("data-card-open", "");
    btn.textContent = inSetup() ? "Áp dụng vào thiệp" : "Xem thiệp";
    box.appendChild(btn);

    row.appendChild(box);
    scrollToEnd();
  }

  // Trang Thiết lập nạp js/24-ai-apply.js nên có hàm này; trang chủ thì không.
  const inSetup = () => typeof window.cxApplyAiCard === "function";

  // Mã nháp gắn với cuộc chat này, sinh ở lần bấm đầu rồi giữ nguyên: bấm "Xem
  // thiệp" lần nữa — mở lại khung chat, hay dựng lại thiệp sau khi sửa — phải rơi
  // vào chính thiệp đó chứ không đẻ thêm nháp mới mỗi lần bấm. Bấm ở trang Thiết
  // lập thì applyHere ghi đè mã này bằng thiệp đang mở.
  function chatDraftId() {
    try {
      let id = sessionStorage.getItem(DRAFT_KEY);
      if (!id && window.cxNewDraftId) {
        id = window.cxNewDraftId();
        sessionStorage.setItem(DRAFT_KEY, id);
      }
      return id || undefined;
    } catch {
      // Chặn cookie: không nhớ được mã thì để cxStartDraft tự sinh như trước.
      return undefined;
    }
  }

  // Đang ở trang Thiết lập: đổ thẳng vào thiệp đang mở. Hỏi trước vì thao tác này
  // GHI ĐÈ nội dung sẵn có.
  async function applyHere(card) {
    const ok =
      typeof showConfirm !== "function" ||
      (await showConfirm(
        "Áp dụng nội dung AI?",
        "Nội dung đang có trong thiệp sẽ bị ghi đè bằng bản AI vừa dựng.",
        { confirmText: "Áp dụng" },
      ));
    if (!ok) return;
    window.cxApplyAiCard(card);
    // Cuộc chat gắn luôn với thiệp vừa nhận nội dung: quay về trang chủ bấm lại
    // thì phải mở đúng thiệp này chứ không phải nháp của lần chat trước.
    try {
      if (typeof WEDDING_ID !== "undefined" && WEDDING_ID)
        sessionStorage.setItem(DRAFT_KEY, WEDDING_ID);
    } catch {
      /* chặn cookie: bỏ qua, chỉ mất phần ghi nhớ */
    }
  }

  // Trang chủ: cất thiệp vào localStorage rồi đi đúng đường của nút "Tạo thiệp
  // ngay", nhưng vào ĐÚNG nháp của cuộc chat này và mở thẳng tab Xem trước.
  // `templates` khai bằng let ở js/templates-data.js → binding TOÀN CỤC chứ không
  // phải window.templates; chưa nạp xong thì để cxStartDefaultDraft đi hỏi server.
  function useCard(card) {
    if (!card) return;
    if (inSetup()) return void applyHere(card);
    setCache(CARD_KEY, card);
    const params = { tab: "preview" };
    const id = chatDraftId();
    const first =
      typeof templates !== "undefined" && Array.isArray(templates)
        ? templates.find((t) => t.status === "active")
        : null;
    if (first)
      window.cxStartDraft?.(first.theme, first.name, {
        chosen: false,
        id,
        params,
      });
    else window.cxStartDefaultDraft?.(params, { id });
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
    try {
      known = JSON.parse(sessionStorage.getItem(KNOWN_KEY) || "null");
    } catch {
      known = null;
    }
  }

  function saveHistory() {
    history = history.slice(-MAX_KEEP);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history));
      if (known) sessionStorage.setItem(KNOWN_KEY, JSON.stringify(known));
      else sessionStorage.removeItem(KNOWN_KEY);
    } catch {
      /* hết chỗ / chặn cookie: chat vẫn chạy, chỉ không nhớ qua lần tải lại */
    }
  }

  function paintHistory() {
    els.body.innerHTML = "";
    addBubble("bot", GREETING);
    history.forEach((m) => {
      const bubble = addBubble(m.role === "user" ? "user" : "bot", m.content, m.at);
      if (m.card) addCardAction(bubble.parentElement, m.card);
    });
    renderSuggests();
  }

  // Nút Làm mới: xoá sạch đoạn chat, về lại màn chào. Huỷ luôn lượt đang chạy —
  // để nó chạy tiếp thì câu trả lời của cuộc cũ sẽ rơi vào cuộc mới.
  function clearChat() {
    abort?.abort();
    typeStop();
    history = [];
    known = null;
    try {
      sessionStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(KNOWN_KEY);
      // Cuộc mới = thiệp mới: bỏ liên kết với nháp của cuộc vừa xoá.
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* chặn cookie: bộ nhớ trong phiên đã sạch là đủ */
    }
    paintHistory();
    els.input.value = "";
    autoGrow();
    syncSend();
    // Chỉ lấy con trỏ trên máy tính: ở điện thoại, focus là bật bàn phím lên
    // giữa lúc khách chỉ muốn dọn màn hình.
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
  }

  // ── Nhập bằng giọng nói ───────────────────────────────────────────────────
  // Web Speech API (Chrome/Edge/Safari có, Firefox không) — nhận dạng chạy ở
  // phía trình duyệt nên không tốn hạn mức của Edge Function. Không hỗ trợ thì
  // GIẤU HẲN nút, đừng để một nút bấm vào chẳng có gì xảy ra.

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let recOn = false;
  let recBase = ""; // phần chữ đã có trong ô trước khi bấm nói

  function setMicState(on) {
    recOn = on;
    els.mic.classList.toggle("is-rec", on);
    els.mic.setAttribute("aria-pressed", String(on));
    els.mic.setAttribute(
      "aria-label",
      on ? "Dừng nhập giọng nói" : "Nhập bằng giọng nói",
    );
  }

  function initMic() {
    if (!SpeechRec) {
      els.mic.hidden = true;
      return;
    }
    els.mic.addEventListener("click", toggleMic);
  }

  function toggleMic() {
    if (recOn) {
      rec.stop(); // stop giữ lại câu đang nghe dở, khác abort là vứt đi
      return;
    }

    if (!rec) {
      rec = new SpeechRec();
      rec.lang = "vi-VN";
      rec.interimResults = true; // chữ hiện dần để khách biết máy đang nghe
      rec.continuous = false; // ngưng nói một nhịp là tự chốt câu

      // Mỗi lần bắn ra là TOÀN BỘ câu tính từ lúc bấm, nên ghi đè chứ không nối
      // thêm — nối thêm sẽ ra chữ lặp mỗi khi bản tạm được sửa lại.
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        els.input.value = (recBase + text).slice(0, MAX_LEN);
        autoGrow();
        syncSend();
      };

      rec.onend = () => setMicState(false);

      rec.onerror = (e) => {
        setMicState(false);
        // Im lặng quá lâu hoặc tự mình dừng: không phải lỗi để báo cho khách.
        if (e.error === "no-speech" || e.error === "aborted") return;
        addBubble(
          "error",
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Trình duyệt chưa cho phép dùng micro. Bạn bật quyền micro cho trang này rồi thử lại nhé."
            : "Chưa nghe được, bạn thử lại hoặc gõ câu hỏi giúp mình nhé.",
        );
      };
    }

    // Nói tiếp vào phần đang gõ dở, chừa khoảng trắng cho khỏi dính chữ.
    recBase = els.input.value.trim();
    if (recBase) recBase += " ";
    try {
      rec.start();
      setMicState(true);
    } catch {
      /* start() lúc đang chạy thì ném lỗi — coi như không bấm gì */
    }
  }

  // Dừng ngang: vứt câu đang nghe dở (gửi đi rồi thì nó không còn chỗ để rơi vào).
  function stopMic() {
    if (recOn) rec?.abort();
    setMicState(false);
  }

  // ── Hỏi ───────────────────────────────────────────────────────────────────

  async function ask(question) {
    const text = String(question || "").trim().slice(0, MAX_LEN);
    if (!text || busy) return;

    busy = true;
    stopMic(); // đang gửi thì câu nói dở không còn ô nào để rơi vào
    els.mic.disabled = true;
    els.input.value = "";
    autoGrow();
    syncSend();

    addBubble("user", text);
    history.push({ role: "user", content: text, at: Date.now() });
    saveHistory();
    renderSuggests();

    const typing = addTyping();
    let bubble = null;
    let building = null;
    abort = new AbortController();
    const mine = abort; // giữ lại để biết lượt này có bị Làm mới cắt ngang không

    try {
      const res = await window.aiChatDAL.ask(history, known, {
        onDelta: (partial) => {
          // Mảnh chữ đầu tiên tới nơi → thay ba chấm bằng bong bóng thật.
          if (!bubble) {
            typing.remove();
            bubble = addBubble("bot", "");
            typeStart(bubble);
          }
          typeFeed(partial);
        },
        // Model nói xong câu rồi mới dựng thiệp: chỗ này chờ lâu hơn hẳn một câu
        // trả lời thường nên đổi ba chấm thành dòng báo cho khách yên tâm.
        onPhase: (phase) => {
          if (phase !== "card" || building) return;
          typing.remove();
          building = addBuilding();
        },
        signal: mine.signal,
      });

      typing.remove();
      building?.remove();
      if (!bubble) {
        bubble = addBubble("bot", "");
        typeStart(bubble);
      }
      await typeFinish(res.text);
      // Nút Làm mới bấm trong lúc đang gõ nốt: màn đã sạch, đừng nhét câu trả
      // lời của cuộc cũ vào lịch sử cuộc mới.
      if (mine.signal.aborted) return;

      if (res.known) known = res.known;
      const entry = { role: "assistant", content: res.text, at: Date.now() };
      if (res.card) {
        // Chỉ giữ thiệp MỚI NHẤT: thẻ cũ đã hết bấm được, mà mỗi thiệp là vài KB
        // nằm trong sessionStorage.
        history.forEach((m) => delete m.card);
        entry.card = res.card;
      }
      history.push(entry);
      saveHistory();
      if (res.card) addCardAction(bubble.parentElement, res.card);
    } catch (e) {
      typing.remove();
      building?.remove();
      typeStop();
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
      els.mic.disabled = false;
      syncSend();
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
    autoGrow(); // đo được chiều cao ô nhập từ lúc này, khi bảng đã hiện
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
    syncViewport();
    scrollToEnd();
  }

  function close() {
    stopMic();
    els.panel.classList.add("is-closing");
    document.documentElement.classList.remove("aichat-open");
    setTimeout(() => {
      els.panel.hidden = true;
      els.panel.classList.remove("is-closing");
      syncViewport();
    }, 200);
  }

  // Trên điện thoại bảng phủ kín màn bằng 100dvh — nhưng dvh là LAYOUT viewport,
  // bàn phím ảo không làm nó nhỏ đi: chân bảng (ô nhập) nằm dưới bàn phím, và
  // iOS còn đẩy cả trang lên nên bảng trông như bị lệch. visualViewport là thứ
  // duy nhất biết chỗ thật sự còn trống → đo rồi phát ra --aichat-vh (chiều cao)
  // và --aichat-vb (khoảng hở tính từ đáy layout viewport) cho styles/_ai-chat.css.
  function syncViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    if (els.panel.hidden) {
      root.style.removeProperty("--aichat-vh");
      root.style.removeProperty("--aichat-vb");
      root.classList.remove("aichat-kb");
      return;
    }
    const layout = root.clientHeight;
    const gap = Math.max(0, Math.round(layout - vv.height - vv.offsetTop));
    root.style.setProperty("--aichat-vh", Math.round(vv.height) + "px");
    root.style.setProperty("--aichat-vb", gap + "px");
    // Hở hơn 120px so với màn = bàn phím đang bung (thanh địa chỉ co giãn chỉ
    // vài chục px nên không dính nhầm).
    root.classList.toggle("aichat-kb", layout - vv.height > 120);
  }

  // Ô nhập cao dần theo nội dung, tối đa max-h-24 do CSS chặn. scrollHeight KHÔNG
  // tính viền còn box-sizing:border-box thì có, nên phải cộng bù — thiếu là ô lúc
  // nào cũng hụt đúng bề dày viền và trình duyệt vẽ thanh cuộn dù chưa gõ gì.
  // Chỉ khi chạm trần mới trả cuộn lại cho ô (CSS để overflow-y: hidden).
  function autoGrow() {
    const el = els.input;
    // Bảng đang ẩn thì mọi phép đo ra 0 — đo lúc đó là ép ô về chiều cao 0, chỉ
    // còn trơ padding. Trả ô về chiều cao tự nhiên của rows=1 rồi thôi.
    if (!el.offsetParent) {
      el.style.height = "";
      return;
    }
    const cs = getComputedStyle(el);
    const border =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = "auto";
    const want = el.scrollHeight + border;
    el.style.height = want + "px";
    el.style.overflowY = want > parseFloat(cs.maxHeight) ? "auto" : "hidden";
  }

  // Nút Gửi chỉ sáng khi có chữ để gửi và không phải đang chờ câu trả lời. Gọi
  // sau MỌI chỗ đổi nội dung ô nhập (gõ, nói, xoá đoạn chat, vừa gửi xong).
  function syncSend() {
    els.send.disabled = busy || !els.input.value.trim();
  }

  // ── Khởi động ─────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById("aichatFab")) return;
    build();
    loadHistory();
    paintHistory();
    initMic();
    syncSend();

    els.fab.addEventListener("click", open);
    // Hai nút trên thanh tiêu đề là <x-button> — chúng TỰ THAY mình bằng
    // <button> thật, nên bắt sự kiện ở panel thay vì gắn vào thẻ đã biến mất.
    els.panel.addEventListener("click", (e) => {
      if (e.target.closest("#aichatClose")) close();
      else if (e.target.closest("#aichatReset")) clearChat();
    });
    els.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-card-open]");
      if (btn && !btn.disabled) useCard(btn.closest(".aichat-row")?._cxCard);
    });
    els.send.addEventListener("click", () => ask(els.input.value));
    els.input.addEventListener("input", () => {
      autoGrow();
      syncSend();
    });
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

    // Bàn phím bung/thu là một sự kiện resize của visualViewport; scroll bắt
    // luôn lúc iOS đẩy trang lên sau khi con trỏ vào ô nhập.
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncViewport);
      window.visualViewport.addEventListener("scroll", syncViewport);
    }
    // Bảng vừa co lại vì bàn phím → tin nhắn cuối bị đẩy khuất, kéo về cuối.
    els.input.addEventListener("focus", () => {
      setTimeout(() => {
        syncViewport();
        scrollToEnd();
      }, 300);
    });
  }

  // Mở khung chat từ nơi khác (menu "Tạo thiệp ngay" ở trang chủ, ?open=ai).
  // `mic` = bật luôn micro, thay cho luồng "nói cho AI nghe" trước đây.
  window.cxOpenAiChat = function (opt) {
    open();
    // Nút micro ẩn khi trình duyệt không hỗ trợ SpeechRecognition — lúc đó bỏ qua,
    // khách vẫn gõ được như thường. toggleMic chỉ bật vì bảng vừa mở, chưa nghe gì.
    if (opt && opt.mic && !els.mic.hidden) toggleMic();
  };

  // Trang Thiết lập nạp file này ĐỘNG qua loader.js (DOMContentLoaded đã bắn từ
  // lâu) nên phải đi qua __cxOnReady; trang chủ không có hàm đó → hai nhánh sau.
  if (typeof window.__cxOnReady === "function") window.__cxOnReady(init);
  else if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
