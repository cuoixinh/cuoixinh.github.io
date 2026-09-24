// Trợ lý XuXi: bong bóng nổi góc phải + bảng chat vừa tư vấn dịch vụ vừa hỏi thông
// tin rồi DỰNG LUÔN nội dung thiệp. Dùng ở trang chủ và trang Thiết lập (ở đó
// 24-ai-apply.js đổ kết quả thẳng vào form).
// Toàn bộ markup dựng ở đây (như core/payment.js) nên index.html chỉ cần một thẻ
// <script>; style ở styles/_ai-chat.css. Ô chọn ảnh/nhạc/bản đồ/mẫu nằm ở
// js/ai-chat-media.js (window.CXChatMedia, nạp TRƯỚC file này) — ở đây chỉ đặt chúng
// vào đúng chỗ trong đoạn chat và dẫn khách đi hết lượt.
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
  const CONV_KEY = "cx_aichat_cid"; // sessionStorage: mã CUỘC trò chuyện đang mở —
  // sinh ngay khi mở cuộc mới (kể cả lúc bấm Làm mới), để thứ cất riêng ra (câu
  // chờ đăng nhập) biết mình thuộc về cuộc nào
  const PENDING_KEY = "cx_aichat_pending"; // sessionStorage: câu bị chặn vì hết lượt,
  // chờ đăng nhập xong gửi lại (OAuth rời trang rồi quay lại nên phải cất ra ngoài biến)
  const PENDING_TTL = 15 * 60 * 1000; // quá hạn thì bỏ: đăng nhập ở phiên khác mà tự gửi
  // lại câu cũ là khách không hiểu vì đâu mà có
  const MAX_KEEP = 20; // số tin nhắn giữ lại (server chỉ đọc 20 tin cuối)
  const MAX_LEN = 10000; // khớp MAX_MSG_LEN của Edge Function

  const GREETING =
    "Chào bạn 👋 Mình là XuXi.\n" +
    "Bạn muốn **tạo thiệp cưới** hay cần hỏi gì về Cưới Xinh? Nói với mình một " +
    "câu là được.";

  // Chip gợi ý dưới đoạn chat: chữ trên chip cũng chính là câu gửi đi nên đừng
  // tách làm hai. Chip chỉ có CHỮ và cả dải cùng một màu (khai ở
  // styles/_ai-chat.css), thêm gợi ý chỉ cần thêm một câu vào đây.
  const SUGGESTS = [
    "Tạo thiệp cưới cho mình nhé",
    "Thiệp có giá bao nhiêu vậy?",
    "Thiệp cưới có những gì?",
    "Mình có thể dùng thử được không?",
  ];

  // Lối đi nhanh, dựng thành nút TRÒN CHỈ CÓ ICON trên thanh tiêu đề — thay cho
  // bong bóng Messenger đã bỏ ở trang chủ nên luôn thấy được, không ẩn theo đoạn
  // chat như chip gợi ý. `icon` là tên trong CX_ICONS (core/helpers/icon.js),
  // `label` thành tooltip + nhãn cho trình đọc màn hình.
  // Nhãn và đích đều CỐ ĐỊNH ở đây: XuXi không biết danh sách này, cũng không
  // được phép tự sinh link — bộ dựng markdown ở dưới cố ý không có thẻ <a>, và
  // lời khách thì đi thẳng vào prompt nên để model nhả URL là mở đường cho link
  // giả mạo lẫn link 404 do nó bịa ra.
  // `external` = mở tab mới.
  const NAV_LINKS = [
    {
      label: "Nhắn Messenger",
      icon: "messenger",
      href: "https://m.me/61591515875537",
      external: true,
    },
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
    fab.setAttribute("aria-label", "Mở Trợ lý XuXi");
    fab.innerHTML = '<i data-icon="xuxi" data-size="40"></i>';

    const panel = document.createElement("div");
    panel.id = "aichatPanel";
    panel.className = "aichat-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Trợ lý XuXi của Cưới Xinh");
    panel.innerHTML = `
      <div class="aichat-head">
        <div class="min-w-0 flex-1">
          <p class="aichat-head-title flex gap-1 items-center">Trợ lý XuXi <i data-icon="xuxi" data-size="24"></i></p>
          <p class="aichat-head-sub">Hỏi đáp hoặc nhờ mình tạo thiệp</p>
        </div>
        <div class="aichat-nav" id="aichatNav"></div>
        <x-button variant="bare" icon-only id="aichatReset" type="button"
                  aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới"
                  class="aichat-head-btn">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px"></i>
        </x-button>
        <x-button variant="bare" icon-only id="aichatClose" type="button"
                  aria-label="Đóng Trợ lý XuXi" class="aichat-head-btn">
          <i data-lucide="x" style="width:18px;height:18px"></i>
        </x-button>
      </div>
      <div class="aichat-body" id="aichatBody"></div>
      <div class="aichat-sugwrap" id="aichatSugWrap">
        <p class="aichat-sug-hd">
          <i data-lucide="lightbulb" style="width:13px;height:13px"></i>Gợi ý cho bạn
        </p>
        <div class="aichat-suggests" id="aichatSuggests"></div>
      </div>
      <div class="aichat-foot">
        <div class="aichat-kitbar" id="aichatKitbar" hidden></div>
        <p class="aichat-count" id="aichatCount">0/${MAX_LEN.toLocaleString("vi-VN")}</p>
        <div class="aichat-composer">
          <textarea id="aichatInput" class="aichat-input" rows="1"
                    placeholder="Hỏi XuXi bất cứ điều gì…"
                    aria-label="Câu hỏi cho XuXi"></textarea>
          <div class="aichat-tools">
            <x-button variant="bare" icon-only id="aichatAttach" type="button"
                      aria-label="Thêm ảnh, nhạc, bản đồ, mẫu thiệp"
                      title="Thêm ảnh, nhạc, bản đồ, mẫu thiệp"
                      aria-expanded="false" class="aichat-mic">
              <i data-lucide="plus" style="width:18px;height:18px"></i>
            </x-button>            <div class="aichat-tools-end">
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
          </div>
        </div>
      </div>`;

    // Trang Thiết lập có lối vào riêng ở navbar (#tab-ai) nên KHÔNG thả bong bóng:
    // mép phải là dải xem trực tiếp, mép dưới là navbar, đặt vào đâu cũng vướng.
    // Append TRƯỚC khi truy vấn: <x-button> tự thay mình bằng <button> thật ngay
    // lúc được gắn vào DOM, tra cứu sớm hơn là bắt được thẻ sắp bị vứt đi.
    if (inSetup()) document.body.append(panel);
    else document.body.append(fab, panel);
    window.lucide?.createIcons({ root: fab });
    window.lucide?.createIcons({ root: panel });
    window.cxRenderIcons?.(fab);
    window.cxRenderIcons?.(panel);

    els = {
      fab,
      panel,
      body: panel.querySelector("#aichatBody"),
      suggests: panel.querySelector("#aichatSuggests"),
      sugWrap: panel.querySelector("#aichatSugWrap"),
      nav: panel.querySelector("#aichatNav"),
      input: panel.querySelector("#aichatInput"),
      attach: panel.querySelector("#aichatAttach"),
      count: panel.querySelector("#aichatCount"),
      composer: panel.querySelector(".aichat-composer"),
      kitbar: panel.querySelector("#aichatKitbar"),
      mic: panel.querySelector("#aichatMic"),
      send: panel.querySelector("#aichatSend"),
      reset: panel.querySelector("#aichatReset"),
    };
  }

  // ── Kéo thả ───────────────────────────────────────────────────────────────
  // Cả bong bóng lẫn bảng chat đều kéo đi chỗ khác được: bong bóng hay che nút
  // của trang, còn bảng thì che đúng phần khách đang chỉnh. Bảng kéo bằng THANH
  // TIÊU ĐỀ (kéo cả thân sẽ nuốt mất thao tác bôi đen / cuộn đoạn chat).
  // Vị trí lưu theo TỈ LỆ khoảng trống (localStorage) để xoay máy hay đổi cỡ màn
  // vẫn nằm trong tầm nhìn; chưa kéo lần nào thì để CSS đặt góc mặc định (đừng
  // ghi left/top sẵn, sẽ mất phần né dải xem trước ở .cx-setup).

  const POS_KEY = "cx_aichat_fab_pos";
  const DRAG_SLOP = 5; // px: chưa quá ngưỡng này vẫn tính là một cú bấm mở bảng
  const PANEL_GAP = 8; // khoảng hở giữa bảng và cột form ở trang Thiết lập

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // Khoá riêng cho từng trang: chỗ vừa tay ở trang chủ (góc phải) không phải chỗ
  // vừa tay ở trang Thiết lập (cạnh cột form).
  const panelPosKey = () =>
    "cx_aichat_panel_pos" + (inSetup() ? "_setup" : "_home");

  // Dưới 521px bảng phủ kín màn (xem styles/_ai-chat.css) → không kéo, không đặt
  // toạ độ, mọi thứ để CSS lo.
  const panelFloating = () =>
    window.matchMedia("(min-width: 521px)").matches;

  // Vùng thả hợp lệ của bong bóng, đã trừ dải "xem trực tiếp" (mép phải) và
  // navbar (mép dưới) của trang Thiết lập — hai biến đó chỉ có giá trị khi
  // <html> mang .cx-setup.
  function fabBounds() {
    const cs = getComputedStyle(document.documentElement);
    const rail = parseFloat(cs.getPropertyValue("--cx-rail-w")) || 0;
    const nav = parseFloat(cs.getPropertyValue("--nav-h")) || 0;
    const w = els.fab.offsetWidth;
    const h = els.fab.offsetHeight;
    return {
      minX: 8,
      minY: 8,
      maxX: Math.max(8, window.innerWidth - rail - w - 8),
      maxY: Math.max(8, window.innerHeight - nav - h - 8),
    };
  }

  // Bảng chat thì CHỈ kẹp trong khung nhìn: nó nằm trên cả dải xem trước lẫn
  // navbar (z-index 350) nên kéo đè lên chúng là chuyện khách cố ý.
  function panelBounds() {
    const w = els.panel.offsetWidth;
    const h = els.panel.offsetHeight;
    return {
      minX: 8,
      minY: 8,
      maxX: Math.max(8, window.innerWidth - w - 8),
      maxY: Math.max(8, window.innerHeight - h - 8),
    };
  }

  function place(el, x, y) {
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  // Trả thẻ về đúng chỗ CSS đặt (dùng khi bảng chuyển sang khổ phủ kín màn).
  function clearPlace(el) {
    el.style.removeProperty("left");
    el.style.removeProperty("top");
    el.style.removeProperty("right");
    el.style.removeProperty("bottom");
  }

  function savePos(key, b, x, y) {
    const fx = b.maxX > b.minX ? (x - b.minX) / (b.maxX - b.minX) : 0;
    const fy = b.maxY > b.minY ? (y - b.minY) / (b.maxY - b.minY) : 0;
    try {
      localStorage.setItem(key, JSON.stringify({ fx, fy }));
    } catch {}
  }

  // Vị trí đã lưu, quy về pixel của khung nhìn hiện tại. null = chưa kéo lần nào.
  function loadPos(key, b) {
    let p = null;
    try {
      p = JSON.parse(localStorage.getItem(key) || "null");
    } catch {}
    if (!p || typeof p.fx !== "number" || typeof p.fy !== "number") return null;
    return {
      x: clamp(b.minX + p.fx * (b.maxX - b.minX), b.minX, b.maxX),
      y: clamp(b.minY + p.fy * (b.maxY - b.minY), b.minY, b.maxY),
    };
  }

  // Đặt lại bong bóng theo tỉ lệ đã lưu. Gọi cả lúc khởi động lẫn khi màn đổi cỡ.
  function restoreFabPos() {
    const b = fabBounds();
    const p = loadPos(POS_KEY, b);
    if (p) place(els.fab, p.x, p.y);
  }

  // Chỗ mặc định của bảng ở trang Thiết lập: nằm ngay bên PHẢI cột form, cách
  // đúng PANEL_GAP, đáy ngang với đáy cột (trên navbar). Mở từ tab khác thì cột
  // form đang display:none (đo ra 0) → lấy #nav-card, thẻ nổi cùng khổ max-w-4xl
  // luôn nhìn thấy. Trang chủ không có mốc nào → để CSS giữ góc phải-dưới.
  function panelDefaultPos() {
    if (!inSetup()) return null;
    const col = ["#setup-scroll", "#nav-card"]
      .map((sel) => document.querySelector(sel))
      .find((el) => el && el.getBoundingClientRect().width > 0);
    if (!col) return null;
    const nav =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
      ) || 0;
    const b = panelBounds();
    return {
      x: clamp(col.getBoundingClientRect().right + PANEL_GAP, b.minX, b.maxX),
      y: clamp(
        window.innerHeight - nav - 16 - els.panel.offsetHeight,
        b.minY,
        b.maxY,
      ),
    };
  }

  // Đặt bảng vào chỗ khách đã kéo, chưa kéo thì chỗ mặc định. Phải gọi khi bảng
  // ĐANG HIỆN (thẻ ẩn thì mọi phép đo ra 0).
  function syncPanelPos() {
    if (!panelFloating()) return void clearPlace(els.panel);
    const b = panelBounds();
    const p = loadPos(panelPosKey(), b) || panelDefaultPos();
    if (p) place(els.panel, p.x, p.y);
    else clearPlace(els.panel);
  }

  // Kéo `el` bằng `handle` (mặc định là chính nó). `ignore` là selector của các
  // control trong handle không được tính là chỗ bắt kéo (nút đóng, làm mới…).
  function initDrag(el, { handle = el, bounds, onEnd, enabled, ignore } = {}) {
    let pid = null;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    let x = 0;
    let y = 0;
    let moved = false;

    handle.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      if (enabled && !enabled()) return;
      if (ignore && e.target.closest(ignore)) return;
      pid = e.pointerId;
      const r = el.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ox = x = r.left;
      oy = y = r.top;
      moved = false;
      handle.setPointerCapture(pid);
    });

    handle.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_SLOP) return;
        moved = true;
        el.classList.add("is-dragging");
      }
      const b = bounds();
      x = clamp(ox + dx, b.minX, b.maxX);
      y = clamp(oy + dy, b.minY, b.maxY);
      place(el, x, y);
    });

    const end = (e) => {
      if (e.pointerId !== pid) return;
      if (handle.hasPointerCapture(pid)) handle.releasePointerCapture(pid);
      pid = null;
      if (!moved) return;
      el.classList.remove("is-dragging");
      onEnd?.(bounds(), x, y);
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);

    // Thả tay xong trình duyệt vẫn bắn `click` → chặn để bảng không bung ngay
    // chỗ vừa kéo tới (bong bóng), hay để cú thả trúng nút Đóng không đóng bảng.
    // Listener này phải đăng ký TRƯỚC listener mở bảng: cùng một phần tử thì thứ
    // tự gọi là thứ tự đăng ký, cờ capture không đổi được.
    handle.addEventListener("click", (e) => {
      if (!moved) return;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
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

  // Khung một lượt: avatar (chỉ phía XuXi) + cột chứa bong bóng và giờ. Các lượt
  // liền nhau cùng vai được gom nhóm — hàng mới mang .is-cont, hàng trước mang
  // .is-cont-next — nên chỉ lượt CUỐI nhóm hiện avatar và dấu giờ (luật ở
  // styles/_ai-chat.css).
  function addRow(role) {
    const side = role === "user" ? "user" : "bot";
    const prev = els.body.lastElementChild;
    const cont = prev?.classList.contains("aichat-row") && prev.dataset.side === side;

    const row = document.createElement("div");
    row.className = "aichat-row aichat-row-" + side;
    row.dataset.side = side;
    // Hàng cuối không thể có hàng nối tiếp: cờ còn sót lại là của một hàng đã bị
    // gỡ (ba chấm chờ, bong bóng lỗi) — xoá trước khi tính lại.
    prev?.classList.remove("is-cont-next");
    if (cont) {
      row.classList.add("is-cont");
      prev.classList.add("is-cont-next");
    }
    if (!els.body.childElementCount) row.classList.add("is-first");

    if (side === "bot") {
      const ava = document.createElement("span");
      ava.className = "aichat-ava";
      ava.innerHTML = '<i data-icon="xuxi" data-size="20"></i>';
      row.appendChild(ava);
      window.cxRenderIcons?.(ava);
    }

    const col = document.createElement("div");
    col.className = "aichat-col";
    row.appendChild(col);

    els.body.appendChild(row);
    return col;
  }

  // Trả về chính bong bóng (luồng streaming ghi đè textContent của nó).
  function addBubble(role, text, at) {
    const col = addRow(role);

    const bubble = document.createElement("div");
    bubble.className =
      "aichat-msg " +
      (role === "user"
        ? "aichat-msg-user"
        : role === "error"
          ? "aichat-msg-error"
          : "aichat-msg-bot aichat-md");
    paintBubble(bubble, text, false);
    col.appendChild(bubble);

    // Báo lỗi không phải một lượt hội thoại nên không đóng dấu giờ.
    if (role !== "error") {
      const time = document.createElement("span");
      time.className = "aichat-time";
      time.textContent = timeLabel(at);
      col.appendChild(time);
    }

    scrollToEnd();
    return bubble;
  }

  // Bong bóng lỗi "hết lượt AI, vui lòng đăng nhập": biến chữ "đăng nhập" trong
  // chính câu đó thành chỗ bấm mở popup đăng nhập. Bong bóng lỗi là text thuần
  // (không qua markdown) nên phải tự cắt chuỗi ra rồi chèn thẻ.
  function linkLoginWord(bubble, pending) {
    const txt = bubble.textContent;
    const i = txt.toLowerCase().indexOf("đăng nhập");
    if (i < 0) return;
    const a = document.createElement("a");
    a.className = "aichat-login-link";
    a.setAttribute("role", "button");
    a.tabIndex = 0;
    a.textContent = txt.slice(i, i + "đăng nhập".length);
    a.addEventListener("click", () => promptLogin(pending, bubble));
    bubble.textContent = "";
    bubble.append(txt.slice(0, i), a, txt.slice(i + "đăng nhập".length));
  }

  // Đăng nhập xong là GỬI LẠI luôn câu vừa bị chặn — khách không phải gõ lại.
  // Popup đăng nhập ở ngay trang này nên gửi lại được ngay; đăng nhập bằng OAuth
  // thì trang tải lại, câu chờ nằm ở sessionStorage và init() lo nốt.
  function promptLogin(pending, errBubble) {
    savePending(pending);
    if (window.AuthUI) {
      AuthUI.requireLogin({
        onAuth: () => {
          errBubble?.remove();
          // Bong bóng câu hỏi vẫn còn trên màn → gửi lại mà không vẽ thêm lần nữa.
          resendPending({ echo: false });
        },
      });
      return;
    }
    window.location.href =
      "/my-invitations/?urlRedirect=" + encodeURIComponent(window.location.href);
  }

  function savePending(text) {
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ text, at: Date.now(), cid: convId() }),
      );
    } catch {
      /* chặn cookie: chỉ mất đường gửi lại sau khi tải lại trang */
    }
  }

  // Lấy RA câu chờ (đọc xong là xoá — gửi lại đúng một lần). Quá hạn → bỏ.
  function takePending() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      return "";
    }
    try {
      const p = JSON.parse(raw || "null");
      if (!p?.text || Date.now() - (p.at || 0) > PENDING_TTL) return "";
      // Cuộc chat đã bị Làm mới (mã khác) thì câu cũ không còn chỗ để nối vào:
      // lịch sử model đọc là của cuộc mới, gửi tiếp là lạc đề.
      if (p.cid !== convId()) return "";
      return p.text;
    } catch {
      return "";
    }
  }

  // opts.open: mở bảng chat trước khi gửi (lượt quay lại sau khi đăng nhập bằng
  // OAuth — bảng đang đóng). Chỉ mở khi THẬT SỰ có câu để gửi tiếp.
  async function resendPending(opts = {}) {
    const text = takePending();
    if (!text) return;
    // Phiên mới có thật chưa: token cũ hết hạn thì lại rơi đúng vào lỗi vừa rồi.
    if (!(await window.CXAuth?.getUser())) return;
    if (opts.open) open();
    ask(text, opts);
  }

  // Trả về cả HÀNG: lượt sau gọi .remove() là đi cả avatar lẫn ba chấm.
  function addTyping() {
    const col = addRow("bot");
    const el = document.createElement("div");
    el.className = "aichat-typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    col.appendChild(el);
    scrollToEnd();
    return col.parentElement;
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
  // bằng AI" ở trang thiết lập). Ở đây vẽ bảng tóm tắt CỐ ĐỊNH (chữ + ảnh) + một nút;
  // bấm nút là gửi bộ đó sang trang thiết lập rồi điều hướng.

  // "2026-12-20" → "20/12/2026". Không đúng dạng thì trả nguyên văn.
  function fmtDate(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(v || "");
  }

  const SUM_PHOTOS = [
    ["cover_image_url", "Ảnh bìa"],
    ["groom_image_url", "Chú rể"],
    ["bride_image_url", "Cô dâu"],
  ];
  const SUM_QR = [
    ["groom_qr_url", "Nhà trai"],
    ["bride_qr_url", "Nhà gái"],
  ];
  const SUM_GALLERY_MAX = 6; // số ảnh album hiện trên thẻ, còn lại gộp thành "+n"

  // [nhãn, chuỗi | mảng dòng] theo thứ tự các bước ở trang Thiết lập. Rỗng thì sumRow bỏ.
  function sumRows(card) {
    const f = card.fields || {};
    const join = (...a) => a.filter(Boolean).join(" · ");
    const at = (time, date, place) => join(time, fmtDate(date), place);
    const vuQuy = f.vu_quy_enabled === true || f.vu_quy_enabled === "true";
    const bank = (side, label) => {
      const v = join(f[side + "_bank_name"], f[side + "_bank_number"], f[side + "_bank_owner"]);
      return v ? label + ": " + v : "";
    };
    return [
      ["Lễ cưới", join(f.ceremony_name, at(f.ceremony_time, f.ceremony_date, f.ceremony_location))],
      ["Lễ Vu Quy", vuQuy ? join(f.vu_quy_time, f.vu_quy_location) : ""],
      ["Tiệc nhà trai", at(f.groom_party_time, f.groom_party_date, f.groom_party_location)],
      ["Tiệc nhà gái", at(f.bride_party_time, f.bride_party_date, f.bride_party_location)],
      ["Nhà trai", join(f.groom_father, f.groom_mother, f.groom_address)],
      ["Nhà gái", join(f.bride_father, f.bride_mother, f.bride_address)],
      ["Chuyện tình", (card.love_story || []).map((s) => join(s.date, s.title))],
      ["Lịch trình", (card.timeline || []).map((t) => join(t.time, t.title))],
      ["Mừng cưới", [bank("groom", "Nhà trai"), bank("bride", "Nhà gái")]],
    ];
  }

  // Một dòng "nhãn | giá trị"; giá trị là mảng thì mỗi phần tử một dòng con.
  function sumRow(parent, label, value) {
    const lines = (Array.isArray(value) ? value : [value]).filter(Boolean);
    if (!lines.length && !(value instanceof Node)) return;
    const row = document.createElement("div");
    row.className = "aichat-sum-row";
    const k = document.createElement("span");
    k.className = "aichat-sum-k";
    k.textContent = label;
    const v = document.createElement("div");
    v.className = "aichat-sum-v";
    if (value instanceof Node) v.appendChild(value);
    else
      lines.forEach((t) => {
        const p = document.createElement("p");
        p.textContent = t;
        v.appendChild(p);
      });
    row.append(k, v);
    parent.appendChild(row);
  }

  // Dải ảnh nhỏ; `items` là [{url, cap?}], `more` = số ảnh không hiện.
  function sumThumbs(items, more) {
    if (!items.length) return null;
    const wrap = document.createElement("div");
    wrap.className = "aichat-sum-thumbs";
    items.forEach(({ url, cap }) => {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      img.src = url;
      img.alt = cap || "";
      img.loading = "lazy";
      fig.appendChild(img);
      if (cap) {
        const c = document.createElement("figcaption");
        c.textContent = cap;
        fig.appendChild(c);
      }
      wrap.appendChild(fig);
    });
    if (more > 0) {
      const m = document.createElement("span");
      m.className = "aichat-sum-more";
      m.textContent = "+" + more;
      wrap.appendChild(m);
    }
    return wrap;
  }

  // Mẫu, ảnh, album, nhạc, bản đồ, QR — `st` là CXChatMedia.state().
  function sumMedia(parent, st, sides) {
    const pics = (slots) =>
      slots.filter(([f]) => st.images?.[f]).map(([f, cap]) => ({ url: st.images[f], cap }));
    const gallery = st.gallery || [];
    const pinned = sides.filter(([s]) => st.maps?.[s]).map(([, name]) => name);
    const rows = [
      ["Mẫu thiệp", st.theme?.name || st.theme?.theme || ""],
      ["Ảnh cưới", sumThumbs(pics(SUM_PHOTOS))],
      [
        "Album",
        sumThumbs(
          gallery.slice(0, SUM_GALLERY_MAX).map((g) => ({ url: g.url })),
          gallery.length - SUM_GALLERY_MAX,
        ),
      ],
      ["Nhạc nền", st.music?.url ? st.music.title || "Bài từ YouTube" : ""],
      ["Bản đồ", pinned.join(" · ")],
      ["QR mừng cưới", sumThumbs(pics(SUM_QR))],
    ];
    rows.forEach(([k, v]) => v && sumRow(parent, k, v));
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

  // `col` là cột của lượt XuXi (.aichat-col) — thẻ thiệp xếp ngay dưới bong bóng,
  // trên dấu giờ.
  function addCardAction(col, card) {
    if (!col) return;
    staleCards();
    const f = card.fields || {};
    // Object thiệp treo thẳng lên phần tử, không serialize: nút bấm chỉ cần tìm
    // ngược lên cột chứa nó là có đủ dữ liệu.
    col._cxCard = card;

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

    const sum = document.createElement("div");
    sum.className = "aichat-sum";
    sumRows(card).forEach(([k, v]) => sumRow(sum, k, v));
    box.appendChild(sum);

    // Phần ảnh/nhạc/bản đồ/mẫu vẽ theo trạng thái THẬT của thiệp và vẽ lại mỗi khi
    // khách đổi ở ô chọn (nút "+"), nên không cần dựng lại thiệp chỉ vì đổi một tấm ảnh.
    const M = window.CXChatMedia;
    if (M?.state) {
      const media = document.createElement("div");
      media.className = "aichat-sum";
      box.appendChild(media);
      const paint = async () => {
        const st = await M.state().catch(() => null);
        media.innerHTML = "";
        if (st) sumMedia(media, st, M.sides || []);
        media.hidden = !media.childElementCount;
      };
      paint();
      M.watch?.(media, paint);
    }

    // <x-button> TỰ THAY mình bằng <button> thật lúc gắn vào DOM → bắt click bằng
    // uỷ nhiệm ở els.body (xem init), đừng gắn listener vào thẻ sắp bị vứt đi.
    const btn = document.createElement("x-button");
    btn.setAttribute("variant", "fill");
    btn.setAttribute("size", "sm");
    btn.setAttribute("full", "");
    btn.setAttribute("data-card-open", "");
    btn.textContent = inSetup() ? "Áp dụng vào thiệp" : "Thiết lập thiệp ngay";
    box.appendChild(btn);

    const time = col.querySelector(".aichat-time");
    if (time) col.insertBefore(box, time);
    else col.appendChild(box);
    scrollToEnd();
  }

  // ── Ô chọn ảnh / nhạc / bản đồ / mẫu (js/ai-chat-media.js) ────────────────
  // Ba đường mở: model đặt `ask` ở câu trả lời, luồng dẫn sau khi thiệp dựng xong
  // (Tiếp tục / Bỏ qua mở ô kế tiếp, KHÔNG tốn lượt AI), và khách tự mở ở nút "+".
  // Việc khách làm ở ô chọn thành một dòng "(Đã …)" trong lịch sử để model biết.

  // Đặt ô chọn vào cột `col` (dưới bong bóng), không có cột thì một hàng XuXi mới.
  // `guided` = ô của luồng dẫn, có nút Tiếp tục / Bỏ qua.
  function addWidget(kind, col, guided) {
    const M = window.CXChatMedia;
    if (!M?.isKind(kind)) return;
    col = col || addRow("bot");
    col.classList.add("is-wide");
    const box = M.widget(kind, guided ? { onNext: stepNext } : {});
    const time = col.querySelector(".aichat-time");
    if (time) col.insertBefore(box, time);
    else col.appendChild(box);
    scrollToEnd();
  }

  // Dòng báo việc khách vừa làm ở ô chọn — không phải bong bóng của ai cả.
  function addNote(text) {
    const p = document.createElement("p");
    p.className = "aichat-note";
    p.textContent = String(text).replace(/^\(|\)$/g, "");
    els.body.appendChild(p);
    scrollToEnd();
  }

  // Khách tự mở một ô (nút "+" hoặc chip trên thẻ thiệp).
  function openKind(kind) {
    toggleKitbar(false);
    history.push({
      role: "assistant",
      content: `(Mở ô chọn ${window.CXChatMedia.label(kind).toLowerCase()})`,
      at: Date.now(),
      ask: kind,
      local: true,
    });
    saveHistory();
    addWidget(kind, null, false);
  }

  // Nút Tiếp tục / Bỏ qua của ô trong luồng dẫn. Chỉ dẫn tiếp khi cuộc chat đã có
  // thiệp: ô mở lẻ (khách đòi đổi nhạc giữa chừng) thì ghi nhận rồi thôi.
  async function stepNext(kind, done, st) {
    const M = window.CXChatMedia;
    M.visit(kind);
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].ask === kind) {
        delete history[i].guided; // F5 không vẽ lại nút cho ô đã bấm
        break;
      }
    }
    const note = M.noteFor(kind, st, done);
    history.push({ role: "user", content: note, at: Date.now(), note: true });
    addNote(note);
    // Đã có thiệp: bảng tóm tắt tự vẽ lại theo ô chọn, không dẫn tiếp. Chưa có mà đã
    // thu đủ thông tin (lượt "ready"): mời ô kế tiếp, hết ô thì xin dựng thiệp.
    if (!history.some((m) => m.card) && history.some((m) => m.ready)) await openNextStep();
    else saveHistory();
  }

  async function openNextStep() {
    const M = window.CXChatMedia;
    const kind = await M.next();
    if (kind) {
      history.push({
        role: "assistant",
        content: `(Mời chọn ${M.label(kind).toLowerCase()})`,
        at: Date.now(),
        ask: kind,
        guided: true,
        local: true,
      });
      saveHistory();
      addWidget(kind, null, true);
      return;
    }
    buildCard();
  }

  // Hết ô chọn: xin model dựng nội dung thiệp. Bảng chốt (chữ + ảnh) do addCardAction
  // tự in từ dữ liệu, model chỉ viết lời chúc mừng. Đang có lượt khác chạy thì chờ nó.
  const BUILD_NOTE = "(Đã xong phần hình ảnh — dựng thiệp)";
  function buildCard() {
    if (!history.some((m) => m.ready)) return; // khách vừa bấm Làm mới
    if (busy) return void setTimeout(buildCard, 500);
    ask(BUILD_NOTE, { note: true, build: true });
  }

  // Dải chip sáu mục phía trên ô nhập, bật/tắt bằng nút "+".
  function toggleKitbar(force) {
    const M = window.CXChatMedia;
    if (!M || !els.kitbar) return;
    const show = force ?? els.kitbar.hidden;
    if (show && !els.kitbar.childElementCount)
      els.kitbar.appendChild(M.chips((kind) => openKind(kind)));
    els.kitbar.hidden = !show;
    els.attach?.setAttribute("aria-expanded", String(show));
    els.attach?.classList.toggle("is-on", show);
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
        "Áp dụng nội dung XuXi vừa dựng?",
        "Nội dung đang có trong thiệp sẽ bị ghi đè bằng bản XuXi vừa dựng.",
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
    // Nhạc/bản đồ/mẫu chọn ở ô chọn đi kèm thiệp; ảnh đã nằm trong IndexedDB dưới mã
    // nháp này (js/ai-chat-media.js).
    const media = window.CXChatMedia?.handoff() || null;
    setCache(CARD_KEY, media ? { ...card, media } : card);
    const params = { tab: "preview" };
    const id = chatDraftId();
    const pick = media?.theme?.theme ? media.theme : null;
    if (pick) {
      syncDraftTheme(id, pick.theme);
      window.cxStartDraft?.(pick.theme, pick.name, { id, params });
      return;
    }
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

  // Trang chủ: thiệp dựng xong là có NGAY nháp trên máy dưới mã của cuộc chat, không
  // đợi bấm "Xem thiệp". Chủ đóng dấu như saveLocalDraft (invitation-setup/js/01-state.js):
  // chưa đăng nhập → nháp khách, hiện ở "Đã chọn"; đã đăng nhập → cache `_owner`, không
  // lên giỏ. `_aiCard` là thẻ nguyên vẹn, trang Thiết lập đổ vào form ở lần mở đầu rồi
  // autosave ghi đè mất nó. Mã ngân hàng AI trả là mã rút gọn nên để _aiCard lo.
  async function stashDraft(card) {
    const id = chatDraftId();
    if (!id) return;
    const key = buildCacheKey("draft", id);
    const prev = getCache(key);
    if (prev && !prev._localOnly) return;
    const { groom_bank_name, bride_bank_name, ...fields } = card.fields || {};
    const owner = prev ? prev._owner : window.CXAuth?.getUserSync()?.email;
    const theme = prev?.theme || (await defaultTheme());
    setCache(key, {
      ...prev,
      ...fields,
      ...(theme ? { theme } : {}),
      is_published: false,
      ...(owner ? { _owner: owner } : {}),
      _aiCard: card,
      _localOnly: true,
      _savedAt: Date.now(),
    });
    window.CXCartCount?.sync();
  }

  // Mẫu mặc định cho nháp mới — cùng thứ tự ưu tiên với useCard.
  async function defaultTheme() {
    const first =
      typeof templates !== "undefined" && Array.isArray(templates)
        ? templates.find((t) => t.status === "active")
        : null;
    if (first) return first.theme;
    try {
      return (await window.templatesDAL?.list())?.[0]?.theme || null;
    } catch {
      return null;
    }
  }

  // Nháp của cuộc chat đã mở từ lần bấm trước với mẫu khác: cxStartDraft đi thẳng
  // vào nháp cũ và GIỮ mẫu của nó, nên đổi mẫu ngay trong bản nháp — bỏ luôn tuỳ chỉnh
  // giao diện của mẫu cũ, như _applyThemeChange ở trang Thiết lập.
  function syncDraftTheme(id, theme) {
    if (!id) return;
    const key = buildCacheKey("draft", id);
    const draft = getCache(key);
    if (!draft || draft.theme === theme) return;
    draft.theme = theme;
    delete draft.theme_setting;
    setCache(key, draft);
  }

  // Chip gợi ý chỉ hữu ích lúc chưa biết hỏi gì → ẩn hẳn sau câu hỏi đầu tiên.
  // Chip TỰ XUỐNG DÒNG, không cuộn ngang: cả bốn phải thấy được cùng lúc.
  function renderSuggests() {
    els.suggests.innerHTML = "";
    if (history.length) {
      els.sugWrap.hidden = true;
      return;
    }
    els.sugWrap.hidden = false;
    SUGGESTS.forEach((text, i) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "aichat-chip";
      // Hiện lần lượt, mỗi chip trễ hơn chip trước một nhịp.
      chip.style.setProperty("--sug-d", i * 60 + "ms");
      chip.textContent = text;
      chip.addEventListener("click", () => ask(text));
      els.suggests.appendChild(chip);
    });
  }

  // Lối đi nhanh trên thanh tiêu đề: dựng MỘT LẦN lúc mở bảng, không đụng gì tới
  // đoạn hội thoại.
  function renderNav() {
    if (!els.nav || els.nav.childElementCount) return;
    NAV_LINKS.forEach((item) => {
      const btn = document.createElement("a");
      btn.className = "aichat-head-btn aichat-navbtn";
      btn.href = item.href;
      btn.title = item.label;
      btn.setAttribute("aria-label", item.label);
      if (item.external) {
        btn.target = "_blank";
        btn.rel = "noopener";
      }
      btn.innerHTML = '<i data-icon="' + item.icon + '" data-size="18"></i>';
      els.nav.appendChild(btn);
    });
    // Icon riêng không tự quét lại markup chèn động.
    window.cxRenderIcons?.(els.nav);
  }

  // ── Lịch sử ───────────────────────────────────────────────────────────────

  // Mã cuộc trò chuyện đang mở. Chỉ để đối chiếu nội bộ (không gửi lên server),
  // nên một con số ngẫu nhiên là đủ.
  function convId() {
    try {
      return sessionStorage.getItem(CONV_KEY) || newConvId();
    } catch {
      return "";
    }
  }

  // Mở cuộc mới: gọi lúc khởi động khi chưa có cuộc nào và ở nút Làm mới. Mã đổi
  // là mọi thứ gắn với cuộc cũ (câu chờ đăng nhập) tự hết hiệu lực.
  function newConvId() {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      sessionStorage.setItem(CONV_KEY, id);
    } catch {
      /* chặn cookie: cuộc chat vẫn chạy, chỉ không nhớ qua lần tải lại */
    }
    return id;
  }

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
    // Chỉ dựng lại ô chọn MỚI NHẤT: ô chọn vẽ theo trạng thái thật của thiệp nên các
    // ô cũ chỉ là bản lặp của nó.
    let lastAsk = -1;
    history.forEach((m, i) => {
      if (m.ask) lastAsk = i;
    });
    history.forEach((m, i) => {
      if (m.note) return addNote(m.content);
      if (m.local && m.ask) {
        if (i === lastAsk) addWidget(m.ask, null, m.guided);
        return;
      }
      const bubble = addBubble(m.role === "user" ? "user" : "bot", m.content, m.at);
      if (m.card) addCardAction(bubble.parentElement, m.card);
      if (m.ask && i === lastAsk) addWidget(m.ask, bubble.parentElement, m.guided);
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
    newConvId(); // cuộc mới bắt đầu từ đây, không đợi tới lượt hỏi đầu tiên
    toggleKitbar(false);
    try {
      // Ảnh/nhạc/bản đồ của cuộc cũ (trang chủ) đi theo nháp của nó — đọc mã TRƯỚC khi xoá.
      window.CXChatMedia?.reset(sessionStorage.getItem(DRAFT_KEY));
    } catch {
      /* chặn cookie: không có gì để dọn */
    }
    try {
      sessionStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(KNOWN_KEY);
      // Cuộc mới = thiệp mới: bỏ liên kết với nháp của cuộc vừa xoá.
      sessionStorage.removeItem(DRAFT_KEY);
      // Câu đang chờ đăng nhập thuộc cuộc vừa xoá.
      sessionStorage.removeItem(PENDING_KEY);
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
  let recTimer = null;
  let recStopping = false; // true = LẦN kết thúc này là cố ý, đừng nghe tiếp

  // Im lặng bao lâu thì tự chốt câu. Máy nhận dạng của trình duyệt tự ngắt sớm
  // hơn nhiều (vài giây, không chỉnh được) nên chỗ này tự đếm giờ và mở lại
  // phiên nghe mỗi lần nó ngắt — khách nghĩ giữa chừng vẫn còn mic.
  const MIC_SILENCE_MS = 10000;

  function armSilence() {
    clearTimeout(recTimer);
    recTimer = setTimeout(() => {
      recStopping = true;
      rec?.stop(); // stop giữ lại câu đang nghe dở, khác abort là vứt đi
    }, MIC_SILENCE_MS);
  }

  function setMicState(on) {
    recOn = on;
    if (!on) clearTimeout(recTimer);
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

  // Mở phiên nghe. Mỗi phiên trả chữ tính TỪ ĐẦU phiên đó, nên trước khi mở phải
  // chốt những gì đang có trong ô làm nền — không thì lần nghe lại ghi đè mất.
  function startRec() {
    recBase = els.input.value;
    if (recBase && !recBase.endsWith(" ")) recBase += " ";
    recStopping = false;
    rec.start();
    armSilence();
  }

  function toggleMic() {
    if (recOn) {
      recStopping = true;
      clearTimeout(recTimer);
      rec.stop();
      return;
    }

    if (!rec) {
      rec = new SpeechRec();
      rec.lang = "vi-VN";
      rec.interimResults = true; // chữ hiện dần để khách biết máy đang nghe
      // Nghe liền mạch: ngưng một nhịp giữa câu KHÔNG phải là nói xong. Việc
      // chốt câu do đồng hồ MIC_SILENCE_MS ở trên quyết định.
      rec.continuous = true;

      // Mỗi lần bắn ra là TOÀN BỘ câu tính từ đầu phiên, nên ghi đè chứ không nối
      // thêm — nối thêm sẽ ra chữ lặp mỗi khi bản tạm được sửa lại.
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        els.input.value = recBase + text;
        autoGrow();
        syncSend();
        armSilence(); // còn nói là còn nghe tiếp
      };

      // Trình duyệt tự ngắt sau vài giây im lặng: chưa hết MIC_SILENCE_MS thì mở
      // lại phiên khác ngay, khách không thấy mic tắt.
      rec.onend = () => {
        if (recOn && !recStopping) {
          try {
            startRec();
            return;
          } catch {
            /* mở lại không được thì coi như dừng hẳn */
          }
        }
        setMicState(false);
      };

      rec.onerror = (e) => {
        // Im lặng quá lâu: để onend quyết định nghe tiếp hay dừng, đừng báo lỗi.
        if (e.error === "no-speech") return;
        recStopping = true;
        setMicState(false);
        if (e.error === "aborted") return; // tự mình dừng
        addBubble(
          "error",
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Trình duyệt chưa cho phép dùng micro. Bạn bật quyền micro cho trang này rồi thử lại nhé."
            : "Chưa nghe được, bạn thử lại hoặc gõ câu hỏi giúp mình nhé.",
        );
      };
    }

    try {
      startRec();
      setMicState(true);
    } catch {
      /* start() lúc đang chạy thì ném lỗi — coi như không bấm gì */
    }
  }

  // Dừng ngang: vứt câu đang nghe dở (gửi đi rồi thì nó không còn chỗ để rơi vào).
  function stopMic() {
    if (recOn) {
      recStopping = true;
      rec?.abort();
    }
    setMicState(false);
  }

  // ── Hỏi ───────────────────────────────────────────────────────────────────

  // opts.echo === false: câu hỏi đã có bong bóng trên màn (lượt gửi lại sau khi
  // đăng nhập) nên đừng vẽ thêm lần nữa.
  // opts.note: câu do giao diện tự gửi (buildCard) — vẽ thành dòng ghi chú, không đụng
  // ô nhập của khách. opts.build: lượt xin dựng thiệp (xem aiChatDAL.ask).
  async function ask(question, opts = {}) {
    const text = String(question || "").trim();
    // Quá dài thì KHÔNG cắt bớt rồi gửi: khách mất đúng phần đuôi mà không hay.
    // Ô nhập đang báo đỏ (syncSend) — để nguyên cho khách tự rút gọn.
    if (!text || busy || text.length > MAX_LEN) return;

    busy = true;
    if (!opts.note) {
      stopMic(); // đang gửi thì câu nói dở không còn ô nào để rơi vào
      els.input.value = "";
      autoGrow();
    }
    els.mic.disabled = true;
    syncSend();

    if (opts.note) addNote(text);
    else if (opts.echo !== false) addBubble("user", text);
    history.push({ role: "user", content: text, at: Date.now(), ...(opts.note && { note: true }) });
    saveHistory();
    renderSuggests();

    // Đã báo "ready" từ trước thì lượt này không mở lại luồng dẫn (xem dưới).
    const wasReady = history.some((m) => m.ready);
    let buildNext = false;
    const typing = addTyping();
    let bubble = null;
    let building = null;
    abort = new AbortController();
    const mine = abort; // giữ lại để biết lượt này có bị Làm mới cắt ngang không

    try {
      // Ảnh/nhạc/bản đồ/mẫu đang có — model khỏi mời lại thứ đã xong. Hỏng thì gửi thiếu.
      const media = await window.CXChatMedia?.summary().catch(() => null);
      const res = await window.aiChatDAL.ask(history, known, {
        media,
        build: opts.build === true,
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
      // Ô chọn dưới câu trả lời: model chỉ định, hoặc lượt vừa thu đủ thông tin
      // ("ready" lần đầu) thì luồng dẫn tự mở ô đầu tiên còn thiếu — không còn ô nào
      // thì xin dựng thiệp luôn (buildCard, sau khi lượt này nhả `busy`).
      const M = window.CXChatMedia;
      let kind = M?.isKind(res.ask) ? res.ask : "";
      if (res.ready && !res.card) {
        entry.ready = true;
        if (!wasReady) {
          kind = M ? (await M.next()) || "" : "";
          buildNext = !kind;
        }
      }
      if (kind) {
        entry.ask = kind;
        entry.guided = true;
      }
      history.push(entry);
      saveHistory();
      if (res.card) {
        addCardAction(bubble.parentElement, res.card);
        if (!inSetup()) stashDraft(res.card);
      }
      if (kind) addWidget(kind, bubble.parentElement, true);
    } catch (e) {
      typing.remove();
      building?.remove();
      typeStop();
      // Bị nút Làm mới cắt ngang: màn đã sạch rồi, đừng vẽ gì thêm lên đó.
      if (mine.signal.aborted) return;
      bubble?.remove();
      const errBubble = addBubble(
        "error",
        e?.message || "XuXi đang bận, bạn thử lại sau ít phút nhé.",
      );
      if (e?.needLogin) linkLoginWord(errBubble, text);
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
      if (buildNext) buildCard();
    }
  }

  // ── Đóng / mở ─────────────────────────────────────────────────────────────

  function open() {
    els.panel.hidden = false;
    renderNav();
    // Đặt chỗ NGAY khi thẻ vừa hiện (còn ẩn thì mọi phép đo ra 0) và trước khung
    // hình đầu tiên, không thì bảng bay từ góc phải sang.
    syncPanelPos();
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
  // Không đặt maxlength cho ô nhập: dán đoạn dài là trình duyệt cắt lặng lẽ. Cho vượt
  // rồi báo đỏ + khoá Gửi. Bộ đếm "đã gõ/trần" luôn hiện, đếm đúng ký tự trong ô.
  function syncSend() {
    const len = els.input.value.length;
    const over = len > MAX_LEN;
    els.send.disabled = busy || !els.input.value.trim() || over;
    els.composer.classList.toggle("is-over", over);
    els.count.classList.toggle("is-over", over);
    const fmt = (n) => n.toLocaleString("vi-VN");
    els.count.textContent = `${fmt(len)}/${fmt(MAX_LEN)}`;
  }

  // ── Khởi động ─────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById("aichatFab")) return;
    build();
    // Trang chủ ghi ảnh dưới mã nháp của cuộc chat và lấy địa điểm từ thông tin đã
    // thu; trang Thiết lập có đích ghi riêng (cxAiMediaSink) nên không cần hai thứ này.
    window.CXChatMedia?.init({ draftId: chatDraftId, known: () => known });
    if (!window.CXChatMedia) els.attach.hidden = true;
    loadHistory();
    convId(); // cuộc đang mở phải có mã ngay từ đầu (chưa có thì đây là cuộc mới)
    paintHistory();
    initMic();
    syncSend();

    // Vừa đăng nhập bằng OAuth và quay lại: mở bảng chat rồi gửi tiếp câu đang
    // dở. Lượt đó đã bị gỡ khỏi lịch sử nên màn chưa có bong bóng → phải vẽ lại.
    resendPending({ echo: true, open: true });

    // Không có bong bóng ở trang Thiết lập thì cũng không có gì để kéo/bấm.
    if (!inSetup()) {
      // Phải đứng trước: nó chặn cú click sinh ra sau khi thả tay.
      initDrag(els.fab, {
        bounds: fabBounds,
        onEnd: (b, x, y) => savePos(POS_KEY, b, x, y),
      });
      window.addEventListener("resize", restoreFabPos);
      restoreFabPos();
      els.fab.addEventListener("click", open);
    }

    // Bảng kéo bằng thanh tiêu đề; hai nút trên đó vẫn phải bấm được.
    initDrag(els.panel, {
      handle: els.panel.querySelector(".aichat-head"),
      bounds: panelBounds,
      enabled: panelFloating,
      ignore: "button, x-button, a",
      onEnd: (b, x, y) => savePos(panelPosKey(), b, x, y),
    });
    // Đổi cỡ màn: vị trí lưu theo tỉ lệ nên phải tính lại, và qua/về ngưỡng
    // 521px là đổi hẳn cách đặt (phủ kín màn ↔ thẻ nổi).
    window.addEventListener("resize", () => {
      if (!els.panel.hidden) syncPanelPos();
    });

    // Hai nút trên thanh tiêu đề là <x-button> — chúng TỰ THAY mình bằng
    // <button> thật, nên bắt sự kiện ở panel thay vì gắn vào thẻ đã biến mất.
    els.panel.addEventListener("click", (e) => {
      if (e.target.closest("#aichatClose")) close();
      else if (e.target.closest("#aichatReset")) clearChat();
      else if (e.target.closest("#aichatAttach")) toggleKitbar();
    });
    els.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-card-open]");
      if (btn && !btn.disabled) useCard(btn.closest(".aichat-col, .aichat-row")?._cxCard);
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

  // Mở khung chat từ nơi khác (ô hỏi ở màn mở đầu trang chủ, ?open=ai).
  // `mic` = bật luôn micro, thay cho luồng "nói cho AI nghe" trước đây.
  // `ask` = câu hỏi gửi luôn khi vừa mở (khách đã gõ ở ô ngoài, đừng bắt gõ lại).
  window.cxOpenAiChat = function (opt) {
    open();
    // Nút micro ẩn khi trình duyệt không hỗ trợ SpeechRecognition — lúc đó bỏ qua,
    // khách vẫn gõ được như thường. toggleMic chỉ bật vì bảng vừa mở, chưa nghe gì.
    if (opt && opt.mic && !els.mic.hidden) toggleMic();
    if (opt && opt.ask) {
      // Quá trần thì ask() từ chối gửi — đưa vào ô nhập để khách thấy báo đỏ mà sửa.
      if (String(opt.ask).trim().length > MAX_LEN) {
        els.input.value = opt.ask;
        autoGrow();
        syncSend();
      } else ask(opt.ask);
    }
  };

  // Trang Thiết lập nạp file này ĐỘNG qua loader.js (DOMContentLoaded đã bắn từ
  // lâu) nên phải đi qua __cxOnReady; trang chủ không có hàm đó → hai nhánh sau.
  if (typeof window.__cxOnReady === "function") window.__cxOnReady(init);
  else if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
