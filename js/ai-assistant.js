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
  const INPUT_KEY = "cx_aichat_input"; // sessionStorage: câu đang gõ dở trong ô nhập
  const MODE_KEY = "cx_aichat_mode"; // sessionStorage: chế độ của cuộc chat (xem setMode)
  const CONV_KEY = "cx_aichat_cid"; // sessionStorage: mã CUỘC trò chuyện đang mở —
  // sinh ngay khi mở cuộc mới (kể cả lúc bấm Làm mới), để thứ cất riêng ra (câu
  // chờ đăng nhập) biết mình thuộc về cuộc nào
  const PENDING_KEY = "cx_aichat_pending"; // sessionStorage: câu bị chặn vì hết lượt,
  // chờ đăng nhập xong gửi lại (OAuth rời trang rồi quay lại nên phải cất ra ngoài biến)
  const PENDING_TTL = 15 * 60 * 1000; // quá hạn thì bỏ: đăng nhập ở phiên khác mà tự gửi
  // lại câu cũ là khách không hiểu vì đâu mà có
  // Số tin giữ lại trên màn / qua F5. Luồng dẫn một mình đã ~12 tin (ô chọn + dòng "(Đã …)")
  // nên phải rộng hơn hẳn MAX_TURNS; cắt thì vẫn giữ các mốc (xem trimHistory).
  const MAX_KEEP = 80;
  const MAX_TURNS = 20; // số tin gửi cho server — khớp MAX_TURNS của Edge Function
  const MAX_LEN = 10000; // khớp MAX_MSG_LEN của Edge Function
  // Nút "+" mở dải danh mục (ảnh, nhạc, bản đồ, mẫu thiệp): tạm ẩn, bật cờ này là hiện lại.
  const SHOW_ATTACH = false;

  // Hai chế độ khách chọn ở màn chào của cuộc chat mới — CỬA BẮT BUỘC: chưa chọn thì
  // ô nhập còn khoá (syncGate). Mỗi chế độ server dùng một prompt riêng (Edge Function
  // ai-chat), nên câu hỏi thường không phải kéo theo cả bộ luật tạo thiệp.
  // `img` là ảnh minh hoạ dưới mỗi thẻ: hình vẽ riêng cho chỗ này, nền trong suốt,
  // khổ 2:1. Để SVG (hơn 1KB, nét không vỡ ở mọi khổ màn) nên sửa hình là sửa thẳng
  // file trong assets/images/chat/, không phải xuất lại ảnh.
  // Thứ tự ở đây là thứ tự bày ra màn chào: Tạo thiệp đứng trước vì đó là việc chính
  // khách tới đây để làm.
  const MODES = [
    {
      id: "create",
      title: "Tạo thiệp với AI",
      sub: "Kể vài thông tin, XuXi soạn sẵn nội dung thiệp cho bạn dùng luôn.",
      img: "/assets/images/chat/mode-tao-thiep.svg",
    },
    {
      id: "qa",
      title: "Hỏi đáp",
      sub: "Hỏi giá, mẫu thiệp, cách dùng thử hay bất cứ điều gì về Cưới Xinh.",
      img: "/assets/images/chat/mode-hoi-dap.svg",
    },
  ];
  // Câu mở màn ĐẶT SẴN cho khách: bấm "Tạo thiệp với AI" chính là nói câu này, nên
  // giao diện ghi hộ để đoạn hội thoại (và bản gửi lên model) đọc xuôi từ đầu.
  const CREATE_ASK = "Hãy giúp tôi tạo thiệp cưới";

  // Lời mở đầu của chế độ Tạo thiệp. Lượt này lần nào cũng y hệt nhau (chào + đúng 7
  // nhóm thông tin cần khai) nên giao diện in thẳng, không gọi model: đỡ một lượt hạn
  // mức, đỡ vài giây chờ, và prompt ở server cũng bỏ được nguyên khối danh sách
  // (COLLECT_RULES mục 1 dặn model đừng in lại). Nó vào lịch sử như một lượt XuXi
  // THẬT nên vẫn đi kèm trong hội thoại gửi lên — model biết khách đã thấy những gì.
  // Sửa danh sách ở đây thì ngó lại FIELD_SPECS (_shared/card-schema.ts) cho khớp.
  const CREATE_INTRO = [
    "Chúc mừng hai bạn! Kể mình nghe vài điều dưới đây nhé — gửi một lượt hay từng chút đều được, mục nào chưa rõ cứ bỏ qua:",
    "",
    "1. **Cặp đôi:** họ tên chú rể, cô dâu; quê miền Bắc, Trung hay Nam",
    "2. **Lễ cưới:** ngày và giờ làm lễ (có lễ Vu Quy thì kèm giờ)",
    "3. **Địa chỉ:** nhà trai, nhà gái — mình dùng luôn làm nơi tổ chức lễ và tiệc",
    "4. **Tiệc cưới:** giờ tổ chức tiệc mỗi bên (khác ngày cưới thì cho mình ngày)",
    "5. **Gia đình:** tên bố mẹ hai bên",
    "6. **Chuyện tình yêu:** hai bạn quen nhau thế nào, kể tự do thôi; thích văn phong lãng mạn, truyền thống, dí dỏm hay hiện đại",
    "7. **Hộp mừng:** số tài khoản, ngân hàng, tên chủ tài khoản mỗi bên (không muốn để cũng được)",
    "",
    "Lời mời, lời cảm ơn mình sẽ tự đề xuất. Còn mẫu thiệp, ảnh, nhạc, bản đồ chọn ngay sau khi bạn đã khai đủ thông tin",
  ].join("\n");
  const ASK_PLACEHOLDER = "Hỏi XuXi bất cứ điều gì…";
  const GATE_PLACEHOLDER = "Chọn một việc ở trên để bắt đầu…";
  // Dòng phụ dưới tên XuXi trên thanh tiêu đề — cho khách biết đang ở chế độ nào.
  const MODE_SUB = {
    "": "Tạo thiệp cưới hoặc hỏi mình bất cứ điều gì",
    qa: "Đang chat với XuXi",
    create: "Đang tạo thiệp cưới",
  };

  // Chip gợi ý dưới đoạn chat (chưa hỏi câu nào): chữ trên chip cũng chính là câu gửi
  // đi nên đừng tách làm hai. Chip chỉ có CHỮ và cả dải cùng một màu (khai ở
  // styles/_ai-chat.css), thêm gợi ý chỉ cần thêm một câu vào đây.
  const SUGGESTS = {
    qa: ["Thiệp có giá bao nhiêu vậy?", "Thiệp cưới có những gì?", "Mình có thể dùng thử được không?"],
  };

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
  // "" = chưa chọn (màn chào hiện hai lựa chọn) · "qa" · "create". Xem setMode.
  let mode = "";
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
          <p class="aichat-head-sub">Tạo thiệp cưới hoặc hỏi mình bất cứ điều gì</p>
        </div>
        <div class="aichat-nav" id="aichatNav"></div>
        <x-button variant="bare" icon-only id="aichatReset" type="button"
                  aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới"
                  class="aichat-head-btn">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px"></i>
        </x-button>
        <x-button variant="bare" icon-only id="aichatExpand" type="button"
                  aria-label="Mở rộng toàn màn hình" title="Mở rộng"
                  aria-pressed="false" class="aichat-head-btn aichat-expand">
          <i data-lucide="maximize-2" style="width:16px;height:16px"></i>
          <i data-lucide="minimize-2" style="width:16px;height:16px"></i>
        </x-button>
        <x-button variant="bare" icon-only id="aichatClose" type="button"
                  aria-label="Đóng Trợ lý XuXi" class="aichat-head-btn">
          <i data-lucide="x" style="width:18px;height:18px"></i>
        </x-button>
      </div>
      <div class="aichat-body" id="aichatBody"></div>
      <div class="aichat-sugwrap" id="aichatSugWrap">
        <p class="aichat-sug-hd">
          <i data-lucide="lightbulb" style="width:13px;height:13px"></i><span id="aichatSugHd">Gợi ý cho bạn</span>
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
                <i data-lucide="square" style="width:14px;height:14px"></i>
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
      sugHd: panel.querySelector("#aichatSugHd"),
      sub: panel.querySelector(".aichat-head-sub"),
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
      expand: panel.querySelector("#aichatExpand"),
    };
    setExpanded(loadExpanded());
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
    window.matchMedia("(min-width: 521px)").matches &&
    !els.panel.classList.contains("is-expanded");

  // Chế độ mở rộng (chỉ từ 521px — dưới đó bảng vốn đã phủ kín màn, nút bị CSS
  // giấu): bảng phủ gần kín cửa sổ, không kéo được; nhớ lựa chọn cho lần mở sau.
  const EXPAND_KEY = "cx_aichat_expanded";

  function loadExpanded() {
    try {
      return localStorage.getItem(EXPAND_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setExpanded(on) {
    els.panel.classList.toggle("is-expanded", on);
    els.expand.setAttribute("aria-pressed", String(on));
    const label = on ? "Thu nhỏ" : "Mở rộng";
    els.expand.title = label;
    els.expand.setAttribute("aria-label", on ? "Thu nhỏ bảng chat" : "Mở rộng toàn màn hình");
    try {
      localStorage.setItem(EXPAND_KEY, on ? "1" : "0");
    } catch {}
    if (!els.panel.hidden) {
      syncPanelPos();
      scrollToEnd();
    }
  }

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

    // Trong tay cầm có <img> (logo XuXi của bong bóng): trình duyệt tự bắt đầu
    // kéo ảnh kiểu HTML5 rồi bắn pointercancel → cú kéo của mình chết giữa chừng.
    handle.addEventListener("dragstart", (e) => e.preventDefault());

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

    // Báo lỗi không phải một lượt hội thoại nên không có thanh thao tác; dấu giờ chỉ ở lượt khách.
    if (role !== "error") {
      const bar = addActs(col, role === "user", !text);
      if (role === "user") {
        const time = document.createElement("span");
        time.className = "aichat-time";
        time.textContent = timeLabel(at);
        bar.appendChild(time);
      }
    }

    scrollToEnd();
    return bubble;
  }

  // ── Thanh thao tác dưới tin nhắn: Đọc (chỉ phía XuXi) + Sao chép ─────────
  // Đứng cuối cột, mang luôn dấu giờ; thẻ thiệp/ô chọn chèn sau đó đi qua colInsert
  // nên vẫn nằm trên nó. Bong bóng đang stream thì thanh ẩn tới khi gõ xong.

  const TTS = window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;
  // Chrome tự ngắt câu đọc dài quá ~15 giây → cắt đoạn; mỗi chỗ cắt là một nhịp nghỉ
  // nên để đoạn dài nhất còn an toàn (250 ký tự ở tốc độ 1.1 ≈ 12 giây).
  const TTS_CHUNK = 250;
  const TTS_RATE = 1.1;
  const COPY_DONE_MS = 1500;
  let speaking = null; // nút Đọc đang bật
  let speakRun = 0; // tăng mỗi lượt đọc: onend của lượt đã huỷ không được tắt nút lượt sau
  let ttsVoice = null;

  // Giọng tiếng Việt theo thứ tự ưu tiên: Apple ("Linh", bản Premium > Enhanced >
  // thường) > "Google Tiếng Việt" của Chrome > giọng neural của Edge (HoaiMy/NamMinh
  // "Online (Natural)") > giọng cài sẵn khác. Chrome nạp danh sách giọng KHÔNG đồng bộ
  // nên phải chọn lại mỗi lần có `voiceschanged`.
  function pickVoice() {
    const id = (v) => v.name + " " + v.voiceURI;
    const score = (v) =>
      (/com\.apple|\blinh\b/i.test(id(v)) ? 64 + (/premium/i.test(id(v)) ? 2 : /enhanced/i.test(id(v)) ? 1 : 0) : 0) +
      (/google/i.test(v.name) ? 32 : 0) +
      (/natural|neural/i.test(v.name) ? 16 + (/hoaimy/i.test(v.name) ? 1 : 0) : 0) +
      (v.localService === false ? 1 : 0);
    const vi = TTS.getVoices().filter((v) => /^vi/i.test(v.lang));
    ttsVoice = vi.sort((a, b) => score(b) - score(a))[0] || null;
  }

  if (TTS) {
    pickVoice();
    TTS.addEventListener?.("voiceschanged", pickVoice);
  }

  function addActs(col, isUser, pending) {
    const bar = document.createElement("div");
    bar.className = "aichat-acts";
    bar.hidden = pending;
    bar.innerHTML =
      (isUser || !TTS
        ? ""
        : `<x-button variant="bare" icon-only data-speak class="aichat-act"
             aria-label="Đọc to" title="Đọc to" aria-pressed="false">
             <i data-lucide="volume-2" style="width:16px;height:16px"></i>
             <i data-lucide="square" style="width:12px;height:12px"></i>
           </x-button>`) +
      `<x-button variant="bare" icon-only data-copy class="aichat-act"
         aria-label="Sao chép" title="Sao chép">
         <i data-lucide="copy" style="width:16px;height:16px"></i>
         <i data-lucide="check" style="width:16px;height:16px"></i>
       </x-button>`;
    col.appendChild(bar);
    window.lucide?.createIcons({ root: bar });
    syncActsRow(col);
    return bar;
  }

  // Avatar XuXi canh đáy hàng — có thanh thao tác thì nâng lên cho ngang đáy bong bóng.
  function syncActsRow(col) {
    const bar = col.querySelector(".aichat-acts");
    col.parentElement.classList.toggle("has-acts", !!bar && !bar.hidden);
  }

  // Bong bóng stream xong mới có chữ để đọc/chép.
  function showActs(bubble) {
    const col = bubble?.parentElement;
    const bar = col?.querySelector(".aichat-acts");
    if (!bar) return;
    bar.hidden = false;
    syncActsRow(col);
  }

  // Chèn thứ đi kèm lượt (thẻ thiệp, ô chọn, nút) vào cột, TRÊN thanh thao tác.
  function colInsert(col, el) {
    const anchor = col.querySelector(":scope > .aichat-acts");
    if (anchor) col.insertBefore(el, anchor);
    else col.appendChild(el);
  }

  function msgText(btn) {
    const msg = btn.closest(".aichat-col")?.querySelector(".aichat-msg");
    return (msg?.innerText || "").trim();
  }

  async function copyMsg(btn) {
    const text = msgText(btn);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Không có Clipboard API (http, WebView cũ) → lùi về execCommand.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        ta.remove();
      }
    }
    btn.classList.add("is-done");
    btn.setAttribute("aria-label", "Đã sao chép");
    clearTimeout(btn._cxDone);
    btn._cxDone = setTimeout(() => {
      btn.classList.remove("is-done");
      btn.setAttribute("aria-label", "Sao chép");
    }, COPY_DONE_MS);
  }

  // Cắt theo câu, gộp lại cho tới TTS_CHUNK ký tự; câu dài quá thì cắt ở dấu cách.
  function ttsChunks(text) {
    const parts = text.split(/(?<=[.!?…:;\n])\s+/);
    const out = [];
    let cur = "";
    for (let p of parts) {
      while (p.length > TTS_CHUNK) {
        const cut = p.lastIndexOf(" ", TTS_CHUNK);
        const at = cut > 0 ? cut : TTS_CHUNK;
        if (cur) out.push(cur), (cur = "");
        out.push(p.slice(0, at));
        p = p.slice(at).trim();
      }
      if (cur && cur.length + p.length + 1 > TTS_CHUNK) out.push(cur), (cur = "");
      cur = cur ? cur + " " + p : p;
    }
    if (cur) out.push(cur);
    return out.filter((s) => /[\p{L}\p{N}]/u.test(s));
  }

  function setSpeaking(btn, on) {
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
    const label = on ? "Dừng đọc" : "Đọc to";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  function stopSpeak() {
    if (!TTS) return;
    speakRun++;
    TTS.cancel();
    if (speaking) setSpeaking(speaking, false);
    speaking = null;
  }

  // Bấm lại đúng nút đang đọc = dừng; bấm nút khác = chuyển sang đọc tin đó.
  function toggleSpeak(btn) {
    const same = speaking === btn;
    stopSpeak();
    if (same || !TTS) return;
    // Emoji bị đọc thành tên hình ("mặt cười…") nên bỏ trước khi đọc.
    const text = msgText(btn).replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "");
    const chunks = ttsChunks(text);
    if (!chunks.length) return;
    stopMic(); // mic đang nghe sẽ thu luôn giọng đọc vào ô nhập
    const run = speakRun;
    if (!ttsVoice) pickVoice();
    const done = () => run === speakRun && stopSpeak();
    speaking = btn;
    setSpeaking(btn, true);
    try {
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c);
        u.lang = "vi-VN";
        u.rate = TTS_RATE;
        if (ttsVoice) u.voice = ttsVoice;
        if (i === chunks.length - 1) u.onend = done;
        u.onerror = done; // một đoạn hỏng thì dừng cả lượt, không đọc nhảy cóc
        TTS.speak(u);
      });
    } catch {
      stopSpeak(); // trình duyệt từ chối giọng/đoạn → đừng để nút kẹt ở trạng thái Dừng
    }
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

  // Lượt khách hỏi mà hỏng (`failed` = câu báo lỗi) vẫn nằm trong lịch sử để F5 còn
  // thấy, nhưng KHÔNG gửi cho model: một lượt "khách hỏi" chưa có lời đáp làm nó trả lệch.
  function chatTurns() {
    return history.filter((m) => !m.failed).slice(-MAX_TURNS);
  }

  // Vị trí bản chốt: lượt XuXi (không phải dòng giao diện tự ghi) cuối cùng trước lượt
  // "ready" ở vị trí `r`. -1 khi không có.
  function summaryAt(list, r) {
    let s = r - 1;
    while (s >= 0 && (list[s].role !== "assistant" || list[s].local)) s--;
    return s < 0 ? -1 : s;
  }

  // Lượt dựng thiệp (nút Tạo ngay) chỉ gửi BẢN CHỐT khách đã đồng ý — lượt XuXi cuối
  // cùng trước lượt "ready" — kèm lời đồng ý và lệnh dựng, cho prompt ngắn. Field đã thu
  // vẫn đi riêng qua `known`, ảnh/nhạc qua `media`. Không thấy bản chốt thì gửi đủ.
  function buildTurns() {
    const turns = history.filter((m) => !m.failed);
    const r = turns.findIndex((m) => m.ready);
    const s = summaryAt(turns, r);
    if (s < 0) return turns.slice(-MAX_TURNS);
    const agreed = turns.slice(s + 1, r).filter((m) => m.role === "user" && !m.note);
    return [turns[s], ...agreed, turns[turns.length - 1]];
  }

  // Bong bóng lỗi của lượt `m` (ngay dưới câu hỏi / dòng ghi chú của nó). `retry` =
  // có nút "Thử lại" — chỉ lượt cuối mới có. Hết lượt AI thì thay bằng chữ "đăng nhập".
  // Nút bắt click bằng uỷ nhiệm ở els.body (x-button tự thay mình bằng <button>).
  const failRows = new WeakMap();
  function addFailure(m, retry) {
    const errBubble = addBubble("error", m.failed);
    const col = errBubble.parentElement;
    failRows.set(m, col.parentElement);
    if (m.needLogin) return linkLoginWord(errBubble, m.content);
    if (!retry) return;
    col._cxFailed = m;
    const btn = document.createElement("x-button");
    btn.setAttribute("variant", "outline");
    btn.setAttribute("size", "xs");
    btn.setAttribute("icon", "rotate-ccw");
    btn.setAttribute("data-retry", "");
    btn.className = "aichat-retry";
    btn.textContent = "Thử lại";
    col.appendChild(btn);
    scrollToEnd();
  }

  // Gửi lại lượt hỏng: gỡ lượt cũ khỏi lịch sử + hàng lỗi khỏi màn; câu hỏi (hoặc dòng
  // "dựng thiệp") vẫn còn trên màn nên ask không vẽ lại.
  function retryFailed(m) {
    if (busy) return;
    const i = history.indexOf(m);
    if (i >= 0) history.splice(i, 1);
    failRows.get(m)?.remove();
    ask(m.content, { note: m.note, build: m.build, echo: false });
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
    // Câu bị chặn vẫn nằm trong lịch sử dạng lượt lỗi → gửi lại đúng lượt đó.
    const last = history[history.length - 1];
    if (last?.failed && last.content === text) return retryFailed(last);
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

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // Chữ do GIAO DIỆN tự in (lời mở đầu) cũng phải chạy như lượt về từ server: nhả dần
  // từng cụm cho bộ gõ ở trên, chứ dán một phát là nhìn khác hẳn mọi lượt khác.
  const INTRO_WAIT_MS = 260; // ba chấm một nhịp cho giống lượt thật
  const FAKE_STREAM_MS = 900; // cả câu chạy xong trong ngần này
  const FAKE_TICK_MS = 50;

  function fakeStream(text, bubble) {
    typeStart(bubble);
    const step = Math.max(8, Math.ceil(text.length / (FAKE_STREAM_MS / FAKE_TICK_MS)));
    let i = 0;
    return new Promise((done) => {
      const id = setInterval(() => {
        // Bị cắt ngang (Làm mới) thì bộ gõ đã bị dọn — dừng luôn, đừng gõ vào hư không.
        if (!typer) {
          clearInterval(id);
          return done();
        }
        i = Math.min(text.length, i + step);
        typeFeed(text.slice(0, i));
        if (i < text.length) return;
        clearInterval(id);
        typeFinish(text).then(done);
      }, FAKE_TICK_MS);
    });
  }

  function typeStop() {
    if (typer?.raf) cancelAnimationFrame(typer.raf);
    typer = null;
  }

  // ── Thiệp dựng xong ───────────────────────────────────────────────────────
  // Model trả về nguyên bộ nội dung thiệp (cùng shape với kết quả của bảng "Tạo
  // bằng AI" ở trang thiết lập). Ở đây vẽ bảng "Thông tin đám cưới" CỐ ĐỊNH (chữ + ảnh)
  // + một nút; bấm nút là gửi bộ đó sang trang thiết lập rồi điều hướng.

  const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const SUM_GALLERY_MAX = 6; // số ảnh album hiện trên thẻ, còn lại gộp thành "+n"

  // "2026-12-20" → "Chủ Nhật, 20/12/2026". Không đúng dạng thì trả nguyên văn.
  function fmtDay(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(v || "");
    const wd = WEEKDAYS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
    return wd + ", " + m[3] + "/" + m[2] + "/" + m[1];
  }

  // "10:30" → "10:30 sáng" — buổi theo cách nói thường ngày.
  function fmtTime(v) {
    const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(v || "");
    const h = +m[1];
    const part = h < 11 ? "sáng" : h < 13 ? "trưa" : h < 18 ? "chiều" : "tối";
    return m[1].padStart(2, "0") + ":" + m[2] + " " + part;
  }

  // "10:30" → "0630" (phút trong ngày, đệm 4 chữ số để so chuỗi); không đọc được giờ thì null.
  function evMinutes(v) {
    const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? String(+m[1] * 60 + +m[2]).padStart(4, "0") : null;
  }

  function mk(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function ico(name, size) {
    const i = mk("i");
    i.setAttribute("data-lucide", name);
    i.style.width = i.style.height = size + "px";
    return i;
  }

  // Dải ảnh nhỏ; `items` là [{url}], `more` = số ảnh không hiện.
  function sumThumbs(items, more) {
    if (!items.length) return null;
    const wrap = mk("div", "aichat-sum-thumbs");
    items.forEach(({ url }) => {
      const img = mk("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      wrap.appendChild(img);
    });
    if (more > 0) wrap.appendChild(mk("span", "aichat-sum-more", "+" + more));
    return wrap;
  }

  // Một mục có icon + tiêu đề; `fill(body)` vẽ nội dung, không vẽ được gì thì bỏ cả mục.
  function infoSection(parent, icon, title, fill) {
    const body = mk("div", "aichat-sec-body");
    fill(body);
    if (!body.childElementCount) return;
    const badge = mk("span", "aichat-sec-ico");
    badge.appendChild(ico(icon, 14));
    const head = mk("div", "aichat-sec-h");
    head.append(badge, mk("h5", "", title));
    const sec = mk("section", "aichat-sec");
    sec.append(head, body);
    parent.appendChild(sec);
  }

  // Hai ô cạnh nhau (nhà trai / nhà gái); còn một ô thì nó giãn hết hàng (CSS).
  function grid2(parent, fill) {
    const g = mk("div", "aichat-grid2");
    fill(g);
    if (g.childElementCount) parent.appendChild(g);
  }

  function heroPerson(name, role, photo) {
    const box = mk("div", "aichat-hero-person");
    if (photo) {
      const img = mk("img", "aichat-hero-pic");
      img.src = photo;
      img.alt = role;
      img.loading = "lazy";
      box.appendChild(img);
    } else {
      box.appendChild(mk("div", "aichat-hero-pic is-empty", (name || role).trim().charAt(0)));
    }
    box.append(mk("p", "aichat-hero-role", role), mk("p", "aichat-hero-name", name || "—"));
    return box;
  }

  // Đầu thẻ như bìa thiệp: ảnh + tên hai người, ngày giờ lễ, lời ngỏ.
  function infoHero(parent, card, f, img) {
    const hero = mk("div", "aichat-hero");
    hero.appendChild(mk("p", "aichat-hero-eyebrow", "Thiệp đã sẵn sàng"));
    const pair = mk("div", "aichat-hero-pair");
    pair.append(
      heroPerson(f.groom_name, "Chú rể", img("groom_image_url")),
      mk("span", "aichat-hero-amp", "&"),
      heroPerson(f.bride_name, "Cô dâu", img("bride_image_url")),
    );
    hero.appendChild(pair);
    const when = [fmtDay(f.ceremony_date), fmtTime(f.ceremony_time)].filter(Boolean).join(" · ");
    if (when) hero.appendChild(mk("p", "aichat-hero-when", when));
    if (card.story_quote) hero.appendChild(mk("p", "aichat-hero-quote", "“" + card.story_quote + "”"));
    parent.appendChild(hero);
  }

  // Một bên gia đình: nhãn + bố, mẹ, địa chỉ nhà.
  function infoFamily(parent, f, side, label) {
    const rows = [
      ["Bố", f[side + "_father"]],
      ["Mẹ", f[side + "_mother"]],
      ["Nhà", f[side + "_address"]],
    ].filter(([, v]) => v);
    if (!rows.length) return;
    const box = mk("div", "aichat-fam");
    box.appendChild(mk("span", "aichat-tag is-" + side, label));
    rows.forEach(([k, v]) => {
      const p = mk("p", "aichat-fam-row");
      p.append(mk("span", "aichat-fam-lb", k), mk("span", "", v));
      box.appendChild(p);
    });
    parent.appendChild(box);
  }

  // "Trung tâm X, 72 Trần Đăng Ninh, Cầu Giấy" → tên nơi (đậm) + địa chỉ (nhỏ).
  function splitPlace(v) {
    const s = String(v || "").trim();
    const i = s.indexOf(",");
    return i < 0 ? [s, ""] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  }

  // Một sự kiện: ô lịch bên trái (ngày + tháng, không có ngày thì icon) · nhãn, giờ, nơi.
  // `cont`: buổi thứ hai trở đi của cùng một ngày — bỏ ô lịch và dòng thứ/ngày, đứng liền buổi trước.
  function infoEvent(parent, { label, date, time, place }, cont) {
    const m = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const cal = mk("div", "aichat-ev-cal");
    if (cont) cal.classList.add("is-cont");
    else if (m) cal.append(mk("span", "aichat-ev-dd", m[3]), mk("span", "aichat-ev-mm", "Th " + +m[2]));
    else cal.appendChild(ico("calendar-clock", 18));
    const body = mk("div", "aichat-ev-body");
    const head = mk("div", "aichat-ev-head");
    head.appendChild(mk("p", "aichat-ev-k", label));
    if (time) head.appendChild(mk("span", "aichat-tag is-time", fmtTime(time)));
    body.appendChild(head);
    if (m && !cont) body.appendChild(mk("p", "aichat-ev-day", fmtDay(date)));
    const [venue, addr] = splitPlace(place);
    if (venue) body.appendChild(mk("p", "aichat-ev-venue", venue));
    if (addr) body.appendChild(mk("p", "aichat-ev-addr", addr));
    const ev = mk("div", "aichat-ev" + (cont ? " is-cont" : ""));
    ev.append(cal, body);
    parent.appendChild(ev);
  }

  // Dòng thời gian dọc (chấm + vạch nối): thời điểm, tiêu đề, đoạn kể nếu có.
  // `is-compact`: thời điểm và tiêu đề chung một hàng (lịch trình trong ngày).
  function infoSteps(parent, items, cls) {
    if (!items.length) return;
    const ol = mk("ol", "aichat-steps" + (cls ? " " + cls : ""));
    items.forEach(([when, what, more]) => {
      const li = mk("li");
      if (when) li.appendChild(mk("span", "aichat-steps-when", when));
      li.appendChild(mk("p", "aichat-steps-title", what || ""));
      if (more) li.appendChild(mk("p", "aichat-steps-more", more));
      ol.appendChild(li);
    });
    parent.appendChild(ol);
  }

  // "2021-02-14" → "14/02/2021"; dạng khác (năm, tháng/năm, chữ) giữ nguyên.
  function fmtDate(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(v || "");
  }

  // Một đoạn chữ AI viết cho thiệp: nhãn nhỏ + nội dung.
  function infoText(parent, label, text) {
    if (!text) return;
    const box = mk("div", "aichat-text");
    box.append(mk("p", "aichat-text-k", label), mk("p", "aichat-text-v", text));
    parent.appendChild(box);
  }

  // Hộp mừng một bên: nhãn, ảnh QR (nếu có), ngân hàng, số, chủ tài khoản.
  function infoBank(parent, f, side, label, qr) {
    const bank = f[side + "_bank_name"];
    const num = f[side + "_bank_number"];
    const owner = f[side + "_bank_owner"];
    if (!bank && !num && !owner && !qr) return;
    const box = mk("div", "aichat-bank");
    box.appendChild(mk("span", "aichat-tag is-" + side, label));
    if (qr) {
      const img = mk("img", "aichat-bank-qr");
      img.src = qr;
      img.alt = "QR " + label;
      img.loading = "lazy";
      box.appendChild(img);
    }
    if (bank) box.appendChild(mk("p", "aichat-bank-name", bank));
    if (num) box.appendChild(mk("p", "aichat-bank-num", num));
    if (owner) box.appendChild(mk("p", "aichat-bank-owner", owner));
    parent.appendChild(box);
  }

  // Một dòng "nhãn | giá trị" (giá trị là chữ hoặc một phần tử).
  function sumRow(parent, label, value) {
    if (!value) return;
    const row = mk("div", "aichat-sum-row");
    const v = mk("div", "aichat-sum-v");
    if (value instanceof Node) v.appendChild(value);
    else v.textContent = value;
    row.append(mk("span", "aichat-sum-k", label), v);
    parent.appendChild(row);
  }

  // Cả bảng. `st` là CXChatMedia.state() (null khi chưa đọc xong): ảnh chân dung, QR,
  // album, nhạc, bản đồ, mẫu lấy từ đó nên đổi ở ô chọn là bảng tự vẽ lại.
  function paintInfo(wrap, card, st, sides) {
    const f = card.fields || {};
    const img = (k) => st?.images?.[k] || "";
    wrap.innerHTML = "";
    infoHero(wrap, card, f, img);

    infoSection(wrap, "users", "Gia đình", (b) =>
      grid2(b, (g) => {
        infoFamily(g, f, "groom", "Nhà trai");
        infoFamily(g, f, "bride", "Nhà gái");
      }),
    );

    const vuQuy = f.vu_quy_enabled === true || f.vu_quy_enabled === "true";
    infoSection(wrap, "calendar-heart", "Lễ cưới & tiệc cưới", (b) =>
      [
        {
          label: f.ceremony_name || "Lễ cưới",
          date: f.ceremony_date,
          time: f.ceremony_time,
          place: f.ceremony_location,
        },
        vuQuy && { label: "Lễ Vu Quy", time: f.vu_quy_time, place: f.vu_quy_location },
        {
          label: "Tiệc nhà trai",
          date: f.groom_party_date,
          time: f.groom_party_time,
          place: f.groom_party_location,
        },
        {
          label: "Tiệc nhà gái",
          date: f.bride_party_date,
          time: f.bride_party_time,
          place: f.bride_party_location,
        },
      ]
        .filter((e) => e && (e.date || e.time || e.place))
        // Buổi không ghi ngày (Vu Quy, tiệc cùng ngày) là cùng ngày cưới; gom theo ngày, tăng dần theo giờ.
        .map((e) => ({ ...e, date: e.date || f.ceremony_date || "" }))
        .map((e, i) => ({ e, i, key: (e.date || "9999") + " " + (evMinutes(e.time) ?? 9999) }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i))
        .forEach(({ e }, i, all) => infoEvent(b, e, i > 0 && e.date && all[i - 1].e.date === e.date)),
    );

    infoSection(wrap, "book-heart", "Chuyện tình yêu", (b) =>
      infoSteps(b, (card.love_story || []).map((s) => [fmtDate(s.date), s.title, s.content])),
    );
    // Mốc lịch trình không mang ngày: suy từ `type` (tiệc khác ngày thì theo ngày tiệc bên đó).
    const tlDay = { party: f.groom_party_date, "bride-party": f.bride_party_date };
    // Gom theo ngày: mỗi ngày một dòng tiêu đề + dải mốc giờ của ngày đó.
    infoSection(wrap, "clock", "Lịch trình ngày cưới", (b) => {
      const groups = new Map();
      (card.timeline || [])
        .map((t, i) => ({ t, i, date: tlDay[t.type] || f.ceremony_date || "" }))
        .map((x) => ({ ...x, key: (x.date || "9999") + " " + (evMinutes(x.t.time) ?? 9999) }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i))
        .forEach(({ t, date }) => {
          if (!groups.has(date)) groups.set(date, []);
          groups.get(date).push([fmtTime(t.time), t.title]);
        });
      groups.forEach((items, date) => {
        if (date) b.appendChild(mk("p", "aichat-tl-day", fmtDay(date)));
        infoSteps(b, items, "is-compact");
      });
    });
    infoSection(wrap, "gift", "Hộp mừng cưới", (b) =>
      grid2(b, (g) => {
        infoBank(g, f, "groom", "Nhà trai", img("groom_qr_url"));
        infoBank(g, f, "bride", "Nhà gái", img("bride_qr_url"));
      }),
    );
    infoSection(wrap, "message-square-heart", "Lời nhắn trên thiệp", (b) => {
      infoText(b, "Lời mời xác nhận tham dự", f.rsvp_message);
      infoText(b, "Lời cảm ơn cuối thiệp", f.footer_text);
      infoText(b, "Câu mẫu chia sẻ", f.share_message_template);
    });

    infoSection(wrap, "image", "Hình ảnh & nhạc", (b) => {
      if (!st) return;
      const gallery = st.gallery || [];
      // Mỗi nơi đã ghim một dòng: tên buổi + nơi đã ghim (có thể khác địa chỉ khách khai).
      const pinned = sides.filter(([s]) => st.maps?.[s]);
      let maps = null;
      if (pinned.length) {
        maps = mk("ul", "aichat-sum-maps");
        pinned.forEach(([s, label]) => {
          const place = st.maps[s].name || st.places?.[s] || f[s + "_location"] || "";
          const head = mk("div", "aichat-sum-maps-h");
          head.appendChild(mk("span", "aichat-sum-maps-k", label));
          if (st.maps[s].embed) {
            // Bấm → xem bản đồ ở lớp phủ (openMapView), bắt bằng uỷ nhiệm ở els.body.
            const btn = document.createElement("x-button");
            btn.setAttribute("variant", "soft");
            btn.setAttribute("size", "xs");
            btn.setAttribute("icon", "map-pinned");
            btn.setAttribute("icon-only", "");
            btn.setAttribute("aria-label", "Xem bản đồ");
            btn.setAttribute("title", "Xem bản đồ");
            btn.setAttribute("data-map-view", "");
            btn.setAttribute("data-embed", st.maps[s].embed);
            btn.setAttribute("data-title", label + (place ? " · " + place : ""));
            head.appendChild(btn);
          }
          const li = mk("li");
          li.append(head, mk("span", "", place));
          maps.appendChild(li);
        });
      }
      sumRow(b, "Mẫu thiệp", st.theme?.name || st.theme?.theme || "");
      sumRow(b, "Ảnh bìa", sumThumbs(img("cover_image_url") ? [{ url: img("cover_image_url") }] : []));
      sumRow(
        b,
        "Album",
        sumThumbs(
          gallery.slice(0, SUM_GALLERY_MAX).map((g) => ({ url: g.url })),
          gallery.length - SUM_GALLERY_MAX,
        ),
      );
      sumRow(b, "Nhạc nền", st.music?.url ? st.music.title || "Bài từ YouTube" : "");
      sumRow(b, "Bản đồ", maps);
    });

    window.lucide?.createIcons({ root: wrap });
  }

  // Xem nhanh một bản đồ đã ghim: lớp phủ nằm TRONG bảng chat nên không che trang.
  // Đóng bằng nút X, bấm ra nền mờ hoặc Esc (Esc lúc đang mở chỉ đóng lớp này).
  function openMapView(embed, title) {
    if (!embed) return;
    closeMapView();
    const ov = mk("div", "aichat-mapview");
    const box = mk("div", "aichat-mapview-box");
    const head = mk("div", "aichat-mapview-head");
    head.appendChild(mk("p", "aichat-mapview-title", title || "Bản đồ"));
    const x = document.createElement("x-button");
    x.setAttribute("variant", "ghost");
    x.setAttribute("size", "sm");
    x.setAttribute("icon-only", "");
    x.setAttribute("icon", "x");
    x.setAttribute("aria-label", "Đóng");
    x.setAttribute("data-map-close", "");
    head.appendChild(x);
    const frame = mk("iframe", "aichat-mapview-frame");
    frame.src = embed;
    frame.title = title || "Bản đồ";
    frame.referrerPolicy = "no-referrer-when-downgrade";
    frame.setAttribute("allowfullscreen", "");
    box.append(head, frame);
    ov.appendChild(box);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-map-close]")) closeMapView();
    });
    els.panel.appendChild(ov);
  }

  // true khi có lớp bản đồ để đóng.
  function closeMapView() {
    const ov = els.panel.querySelector(".aichat-mapview");
    ov?.remove();
    return !!ov;
  }

  function addBuilding(label) {
    const el = document.createElement("div");
    el.className = "aichat-building";
    el.textContent = label || "Đang dựng nội dung thiệp…";
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
  // trên dấu giờ, và giãn hết bề ngang như ô chọn.
  // `m` là lượt lịch sử mang thiệp (giữ cờ `pending`/`applied` của trang Thiết lập).
  function addCardAction(col, card, m) {
    if (!col) return;
    staleCards();
    // Object thiệp treo thẳng lên phần tử, không serialize: nút bấm chỉ cần tìm
    // ngược lên cột chứa nó là có đủ dữ liệu.
    col._cxCard = card;
    col._cxEntry = m || null;
    col.classList.add("is-wide");

    const box = mk("div", "aichat-card");
    const info = mk("div", "aichat-info");
    box.appendChild(info);

    // Vẽ ngay phần chữ, phần ảnh vẽ lại khi đọc xong trạng thái ô chọn và mỗi lần
    // khách đổi ở đó (nút "+"), nên không cần dựng lại thiệp chỉ vì đổi một tấm ảnh.
    const M = window.CXChatMedia;
    paintInfo(info, card, null, []);
    if (M?.state) {
      const paint = async () => {
        const st = await M.state().catch(() => null);
        if (st) paintInfo(info, card, st, M.sides || []);
      };
      paint();
      M.watch?.(info, paint);
    }

    // <x-button> TỰ THAY mình bằng <button> thật lúc gắn vào DOM → bắt click bằng
    // uỷ nhiệm ở els.body (xem init), đừng gắn listener vào thẻ sắp bị vứt đi.
    const btn = document.createElement("x-button");
    btn.setAttribute("variant", "fill");
    btn.setAttribute("size", "sm");
    btn.setAttribute("full", "");
    btn.setAttribute("data-card-open", "");
    btn.textContent = !inSetup()
      ? "Thiết lập thiệp ngay"
      : m?.pending
        ? "Áp dụng phần vừa sửa"
        : "Áp dụng vào thiệp";
    box.appendChild(btn);

    colInsert(col, box);
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
    colInsert(col, box);
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
    markStep(kind, done, st);
    // Đã có thiệp: bảng tóm tắt tự vẽ lại theo ô chọn, không dẫn tiếp. Chưa có mà đã
    // thu đủ thông tin (lượt "ready"): mời ô kế tiếp, hết ô thì xin dựng thiệp.
    if (canBuild()) await openNextStep();
    else saveHistory();
  }

  // Ghi nhận việc khách vừa làm ở ô `kind` (dòng "(Đã …)") và bỏ nút dẫn luồng của nó.
  function markStep(kind, done, st) {
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
  }

  // Đang ở luồng dẫn sau lượt "ready" và chưa có thiệp → còn dựng được.
  function canBuild() {
    return !history.some((m) => m.card) && history.some((m) => m.ready);
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
    offerBuild();
  }

  // Xin model dựng nội dung thiệp — CHỈ khi khách bấm nút "Tạo ngay", không
  // bao giờ tự gửi. Bảng thông tin (chữ + ảnh) do addCardAction tự in từ dữ liệu, model
  // chỉ viết lời chúc mừng. Đang có lượt khác chạy thì chờ nó.
  const BUILD_NOTE = "(Đã xong phần hình ảnh — dựng thiệp)";
  function buildCard() {
    if (!history.some((m) => m.ready)) return; // khách vừa bấm Làm mới
    if (busy) return void setTimeout(buildCard, 500);
    ask(BUILD_NOTE, { note: true, build: true });
  }

  // Hết ô chọn: một câu mời kèm nút "Tạo ngay" — nút DUY NHẤT dựng thiệp trong luồng dẫn.
  // Lượt này nằm trong lịch sử (cờ `buildAsk`) nên F5 vẽ lại được; nút chỉ hiện khi còn
  // dựng được và chưa bấm.
  const BUILD_ASK =
    "Xong phần hình ảnh rồi! Bạn bấm **Tạo ngay** bên dưới là XuXi dựng thiệp liền nhé.";
  function offerBuild() {
    const m = { role: "assistant", content: BUILD_ASK, at: Date.now(), buildAsk: true };
    history.push(m);
    saveHistory();
    addBuildAsk(m);
  }

  function addBuildAsk(m) {
    const bubble = addBubble("bot", BUILD_ASK, m.at);
    if (!canBuild() || history.some((x) => x.content === BUILD_NOTE)) return;
    const col = bubble.parentElement;
    const btn = document.createElement("x-button");
    btn.setAttribute("variant", "fill");
    btn.setAttribute("size", "sm");
    btn.setAttribute("data-build", "");
    btn.className = "aichat-retry";
    btn.textContent = "Tạo ngay";
    colInsert(col, btn);
    scrollToEnd();
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
  // GHI ĐÈ nội dung sẵn có. Thiệp trước đã áp dụng rồi thì chỉ đổ phần sửa từ đó tới
  // giờ (`pending`), để chỗ khách tự chỉnh tay trên form không bị ghi đè.
  async function applyHere(card, entry) {
    const only = entry?.pending || null;
    const ok =
      typeof showConfirm !== "function" ||
      (await showConfirm(
        only ? "Áp dụng phần XuXi vừa sửa?" : "Áp dụng nội dung XuXi vừa dựng?",
        only
          ? "Chỉ những mục XuXi vừa sửa trong thiệp sẽ bị ghi đè."
          : "Nội dung đang có trong thiệp sẽ bị ghi đè bằng bản XuXi vừa dựng.",
        { confirmText: "Áp dụng" },
      ));
    if (!ok) return;
    window.cxApplyAiCard(card, only || undefined);
    if (entry) {
      entry.applied = true;
      saveHistory();
    }
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
  function useCard(card, entry) {
    if (!card) return;
    if (inSetup()) return void applyHere(card, entry);
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
    const media = await draftMedia();
    setCache(key, {
      ...prev,
      ...fields,
      ...media.fields,
      ...(theme ? { theme } : {}),
      is_published: false,
      ...(owner ? { _owner: owner } : {}),
      _aiCard: media.handoff ? { ...card, media: media.handoff } : card,
      _localOnly: true,
      _savedAt: Date.now(),
    });
    window.CXCartCount?.sync();
  }

  // Bản đồ + nhạc đã chọn ở ô chọn → field của nháp và phần `media` của `_aiCard`.
  // Thẻ bàn giao của nút dưới thiệp chỉ đọc được MỘT lần; mở nháp bằng đường khác
  // ("Đã chọn", mở lại sau) thì trang Thiết lập chỉ còn nháp này để lấy.
  async function draftMedia() {
    const st = await window.CXChatMedia?.state?.().catch(() => null);
    const fields = {};
    const maps = {};
    Object.entries(st?.maps || {}).forEach(([s, m]) => {
      if (!m?.embed) return;
      maps[s] = m;
      fields[s + "_map_embed_url"] = m.embed;
      if (m.name) fields[s + "_location"] = m.name;
    });
    const music = st?.music?.url ? st.music : null;
    if (music) fields.music_url = music.url;
    const same = st ? window.CXChatMedia.partySame(st) : {};
    const handoff =
      music || Object.keys(maps).length || Object.keys(same).length
        ? { music, maps, same }
        : null;
    return { fields, handoff };
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

  // Chip gợi ý chỉ hữu ích lúc chưa biết hỏi gì → ẩn hẳn sau câu hỏi đầu tiên. Chưa
  // chọn chế độ thì cũng không có chip: lúc đó cửa chọn chế độ (gateEl) là thứ duy
  // nhất bấm được.
  // Chip TỰ XUỐNG DÒNG, không cuộn ngang: cả dải phải thấy được cùng lúc.
  function renderSuggests() {
    els.suggests.innerHTML = "";
    syncGate();
    // Chế độ Tạo thiệp không có chip nào (đoạn chat mở màn sẵn rồi) → giấu cả hàng,
    // không thì trơ lại mỗi dòng chữ "Gợi ý cho bạn".
    const list = (mode && SUGGESTS[mode]) || [];
    if (history.length || !list.length) {
      els.sugWrap.hidden = true;
      return;
    }
    els.sugWrap.hidden = false;
    els.sugHd.textContent = "Gợi ý cho bạn";
    list.forEach((text, i) => {
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

  // Cửa chọn chế độ: một thẻ trong đoạn chat, ngay dưới lời chào. Hai lựa chọn là
  // radio nên khách thấy ngay đây là chỗ phải chọn; bấm rồi thì pickMode diễn hoạt
  // cho thẻ thu lại thành cái tag ở đầu đoạn chat (tagEl).
  function gateEl() {
    const box = document.createElement("div");
    box.className = "aichat-gate";
    box.innerHTML =
      '<p class="aichat-gate-hd">XuXi giúp gì cho bạn?</p>' +
      '<div class="aichat-gate-opts" role="radiogroup" aria-label="Chọn việc cần XuXi giúp"></div>';
    const opts = box.querySelector(".aichat-gate-opts");
    MODES.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "aichat-mode";
      b.dataset.mode = m.id;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      // Hiện lần lượt, thẻ sau trễ hơn thẻ trước một nhịp.
      b.style.setProperty("--sug-d", i * 70 + "ms");
      b.innerHTML =
        '<span class="aichat-mode-t"><span class="aichat-mode-r" aria-hidden="true"></span>' +
        `${m.title}</span>` +
        `<span class="aichat-mode-s">${m.sub}</span>` +
        `<span class="aichat-mode-fig"><img src="${m.img}" alt="" aria-hidden="true"` +
        ' loading="lazy" class="aichat-mode-img"></span>';
      b.addEventListener("click", () => pickMode(m.id));
      opts.appendChild(b);
    });
    window.lucide?.createIcons({ root: box });
    return box;
  }

  // Tag chế độ ở ĐẦU đoạn chat — đích mà thẻ vừa chọn bay tới. Hình thức khai chung
  // một chỗ với thẻ đã thu gọn (styles/_ai-chat.css) để cú bay không bị giật khổ.
  function tagEl() {
    const m = MODES.find((x) => x.id === mode);
    if (!m) return null;
    const el = document.createElement("div");
    el.className = "aichat-modetag";
    el.textContent = m.title;
    return el;
  }

  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ba nhịp, mỗi nhịp là một cờ class cho CSS lo phần chuyển động: thẻ kia mờ đi →
  // thẻ đã chọn giãn hết bề ngang → thu lại thành tag. Xong mới chốt chế độ, vì
  // commitMode vẽ lại đoạn chat (thẻ biến mất) rồi bay tag lên đầu.
  function pickMode(id) {
    if (busy) return;
    const gate = els.body.querySelector(".aichat-gate");
    const pick = gate?.querySelector(`.aichat-mode[data-mode="${id}"]`);
    if (!pick || gate.classList.contains("is-picking")) return;
    if (reduceMotion()) return void commitMode(id);
    // Thẻ đang VUÔNG: giãn hết bề ngang là cạnh kia cũng phình theo. Đo chiều cao
    // thật rồi khoá lại ngay lúc bắt đầu diễn hoạt, từ đó chỉ còn bề ngang thay đổi.
    gate.style.setProperty("--pick-h", pick.offsetHeight + "px");
    gate.classList.add("is-picking");
    gate.querySelectorAll(".aichat-mode").forEach((b) => {
      b.classList.add(b === pick ? "is-pick" : "is-drop");
      b.setAttribute("aria-checked", b === pick ? "true" : "false");
      b.disabled = true;
    });
    setTimeout(() => gate.classList.add("is-full"), 200);
    setTimeout(() => gate.classList.add("is-tag"), 540);
    // Đo thẻ ở khổ tag NGAY TRƯỚC khi vẽ lại: đó là mốc xuất phát của cú bay.
    setTimeout(() => commitMode(id, pick.getBoundingClientRect()), 900);
  }

  // Chốt chế độ rồi vẽ lại đoạn chat. `from` = chỗ thẻ vừa thu gọn (pickMode), có
  // thì bay tag từ đó lên đầu đoạn chat.
  function commitMode(id, from) {
    setMode(id);
    paintHistory();
    if (from) flyTag(from);
    if (mode === "create") return void ensureIntro();
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
  }

  // Lời mở đầu của chế độ Tạo thiệp, chỉ khi cuộc chat còn trắng và bảng đang mở —
  // nó chạy chữ nên phải có người nhìn.
  function ensureIntro() {
    if (mode !== "create" || history.length || busy || els.panel.hidden) return;
    playIntro();
  }

  // Không gọi model nhưng vẫn diễn đúng nhịp một lượt trả lời: ba chấm một nhịp rồi
  // chữ chạy dần. Khoá nút gửi trong lúc chạy để lượt của khách không chen vào giữa.
  async function playIntro() {
    busy = true;
    syncSend();
    // Cả hai lượt mang cờ `seed`: chúng do giao diện đặt ra, không tính là khách đã
    // mở lời (xem loadMode).
    history.push({ role: "user", content: CREATE_ASK, at: Date.now(), seed: true });
    saveHistory();
    addBubble("user", CREATE_ASK, history[history.length - 1].at);
    const typing = addTyping();
    await wait(INTRO_WAIT_MS);
    typing.remove();
    // Vào lịch sử TRƯỚC khi gõ: bấm Làm mới hay F5 giữa chừng thì cũng không kẹt lại
    // một bong bóng dở dang.
    history.push({ role: "assistant", content: CREATE_INTRO, at: Date.now(), seed: true });
    saveHistory();
    const bubble = addBubble("bot", "");
    await fakeStream(CREATE_INTRO, bubble);
    showActs(bubble);
    busy = false;
    syncSend();
    if (window.matchMedia("(min-width: 521px)").matches) els.input.focus();
  }

  function flyTag(from) {
    const tag = els.body.querySelector(".aichat-modetag");
    if (!tag || !tag.animate) return;
    const to = tag.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy) return;
    tag.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: 420, easing: "cubic-bezier(.22, 1, .36, 1)" },
    );
  }

  // Chưa chọn chế độ thì KHOÁ chỗ nhập: cửa chọn chế độ là đường duy nhất vào cuộc
  // chat, để mỗi lượt đi đúng prompt của nó ngay từ câu đầu.
  function syncGate() {
    const lock = !mode;
    els.panel.classList.toggle("is-gated", lock);
    els.input.disabled = lock;
    els.input.placeholder = lock ? GATE_PLACEHOLDER : ASK_PLACEHOLDER;
    els.mic.disabled = lock || busy;
    syncSend();
  }

  // Chế độ cuộc chat — server chọn loại prompt theo đây và tự chuyển qa → create khi
  // khách muốn làm thiệp (res.mode). Đã sang create thì không quay lại: prompt tạo thiệp
  // vẫn trả lời được câu hỏi chen ngang.
  function setMode(m) {
    mode = m;
    try {
      if (m) sessionStorage.setItem(MODE_KEY, m);
      else sessionStorage.removeItem(MODE_KEY);
    } catch {
      /* chặn cookie: chỉ không nhớ qua lần tải lại */
    }
    if (els) els.sub.textContent = MODE_SUB[m] || MODE_SUB[""];
  }

  // Lịch sử từ trước khi có chế độ (không có khoá) thì đoán theo dấu vết: đã thu thông tin / chốt / có thiệp là đang tạo thiệp.
  function loadMode() {
    // Khách chưa nói câu nào thì luôn về lại cửa chọn chế độ, kể cả sau khi tải lại
    // trang: chế độ chọn xong mà chưa dùng tới thì chưa có gì để giữ. Chỉ tính lượt
    // khách TỰ gõ — hai lượt mở màn mang cờ `seed` là do giao diện đặt vào.
    if (!history.some((m) => m.role === "user" && !m.seed)) {
      history = [];
      saveHistory();
      return setMode("");
    }
    let m = "";
    try {
      m = sessionStorage.getItem(MODE_KEY) || "";
    } catch {
      /* chặn cookie */
    }
    if (!m && history.length)
      m = known || history.some((x) => x.ready || x.card) ? "create" : "qa";
    setMode(m);
  }

  // Phần sáng tạo của thiệp mới nhất trong cuộc chat — gửi kèm để server biết lượt này là
  // lượt SỬA thiệp và chỉ trả phần thay đổi.
  function currentCard() {
    const c = [...history].reverse().find((m) => m.card)?.card;
    if (!c) return null;
    return { story_quote: c.story_quote || "", love_story: c.love_story || [], timeline: c.timeline || [] };
  }

  // Dồn hai bản vá (phần chưa áp dụng vào form + phần vừa sửa).
  function mergePatch(a, b) {
    if (!a) return { ...b, fields: [...(b.fields || [])] };
    return {
      fields: [...new Set([...(a.fields || []), ...(b.fields || [])])],
      story_quote: !!(a.story_quote || b.story_quote),
      love_story: !!(a.love_story || b.love_story),
      timeline: !!(a.timeline || b.timeline),
    };
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

  // Mốc của luồng tạo thiệp — cắt lịch sử cũng không được mất, thiếu là nút Tạo ngay
  // không hiện và lượt dựng không tìm ra bản chốt: lượt "ready", bản chốt + lời đồng ý
  // ngay trước nó, thiệp, câu mời Tạo ngay.
  function isAnchor(m, i, s, r) {
    return m.ready || m.card || m.buildAsk || i === s || (i > s && i < r && m.role === "user" && !m.note);
  }

  function trimHistory() {
    if (history.length <= MAX_KEEP) return;
    const r = history.findIndex((m) => m.ready);
    const s = summaryAt(history, r);
    const from = history.length - MAX_KEEP;
    history = history.filter((m, i) => i >= from || (s >= 0 && isAnchor(m, i, s, r)) || m.card);
  }

  function saveHistory() {
    trimHistory();
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history));
      if (known) sessionStorage.setItem(KNOWN_KEY, JSON.stringify(known));
      else sessionStorage.removeItem(KNOWN_KEY);
    } catch {
      /* hết chỗ / chặn cookie: chat vẫn chạy, chỉ không nhớ qua lần tải lại */
    }
  }

  function paintHistory() {
    stopSpeak();
    els.body.innerHTML = "";
    // Chưa chọn chế độ thì khung chat CHỈ có cửa này — syncGate giấu luôn ô nhập và
    // nút Trò chuyện mới. Chọn rồi thì đầu đoạn chat đeo một cái tag.
    if (!mode) els.body.appendChild(gateEl());
    else {
      const tag = tagEl();
      if (tag) els.body.appendChild(tag);
    }
    // Dựng lại MỖI LOẠI ô chọn một lần, ở lượt mới nhất của loại đó: ô vẽ theo trạng thái
    // thật của thiệp (ảnh/nhạc đã chọn hiện lại đủ), nên hai ô cùng loại chỉ là bản lặp.
    const lastOf = {};
    history.forEach((m, i) => {
      if (m.ask) lastOf[m.ask] = i;
    });
    const showAsk = (m, i) => m.ask && lastOf[m.ask] === i;
    // F5 lúc đang chờ trả lời: lượt cuối là câu hỏi (hoặc lệnh dựng thiệp) chưa có lời
    // đáp → coi như lượt lỗi để khách có nút Thử lại, không thì luồng kẹt tại đó.
    const lastIdx = history.length - 1;
    const tail = history[lastIdx];
    if (tail?.role === "user" && !tail.failed && (!tail.note || tail.content === BUILD_NOTE)) {
      tail.failed = "Lượt trước bị ngắt giữa chừng, bạn bấm Thử lại nhé.";
      if (tail.content === BUILD_NOTE) tail.build = true;
      saveHistory();
    }
    history.forEach((m, i) => {
      if (m.note) addNote(m.content);
      else if (m.buildAsk) addBuildAsk(m);
      else if (m.local && m.ask) {
        if (showAsk(m, i)) addWidget(m.ask, null, m.guided);
      } else {
        const bubble = addBubble(m.role === "user" ? "user" : "bot", m.content, m.at);
        if (m.card) addCardAction(bubble.parentElement, m.card, m);
        if (showAsk(m, i)) addWidget(m.ask, bubble.parentElement, m.guided);
      }
      if (m.failed) addFailure(m, i === lastIdx);
    });
    // F5 ngay sau khi bấm Tiếp tục ở một ô (chưa kịp mở ô kế / hiện nút Tạo ngay) →
    // dẫn tiếp. Không tốn lượt AI: openNextStep chỉ mở ô hoặc hiện nút.
    if (canBuild() && tail?.note && !tail.failed && !history.some((m) => m.buildAsk))
      openNextStep();
    renderSuggests();
  }

  // Nút Dừng (nút gửi lúc đang chờ trả lời): huỷ lượt đang chạy. Đang gõ nốt câu đã về
  // đủ thì kết thúc ngay (typer.resolve) để ask() đi tiếp tới nhánh `stopped`.
  function stopAsk() {
    if (!abort) return;
    abort.stopped = true;
    abort.abort();
    typer?.resolve?.();
  }

  // Nút Làm mới: xoá sạch đoạn chat, về lại màn chào. Huỷ luôn lượt đang chạy —
  // để nó chạy tiếp thì câu trả lời của cuộc cũ sẽ rơi vào cuộc mới.
  function clearChat() {
    abort?.abort();
    typeStop();
    history = [];
    known = null;
    setMode("");
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
    stopSpeak(); // giọng đọc lọt vào mic thành chữ trong ô nhập
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
    // Câu tới từ ngoài cửa chọn chế độ (ô hỏi ở màn mở đầu trang chủ, câu gửi lại sau
    // khi đăng nhập) = hỏi đáp; muốn làm thiệp thì server tự chuyển. Vẽ lại để dọn cửa
    // đi và đeo tag vào đầu đoạn chat.
    if (!mode) {
      setMode("qa");
      paintHistory();
    }

    busy = true;
    // Gửi lại (echo false) thì ô nhập đang là câu MỚI khách gõ dở — để yên.
    if (!opts.note && opts.echo !== false) {
      stopMic(); // đang gửi thì câu nói dở không còn ô nào để rơi vào
      els.input.value = "";
      autoGrow();
    }
    els.mic.disabled = true;
    syncSend();

    let userBubble = null;
    if (opts.echo !== false) {
      if (opts.note) addNote(text);
      else userBubble = addBubble("user", text);
    }
    // Hỏi sang chuyện khác thì lượt lỗi cũ chỉ còn để đọc — nút Thử lại chỉ đi với lượt cuối.
    els.body.querySelectorAll("[data-retry]").forEach((b) => b.remove());
    const asked = { role: "user", content: text, at: Date.now(), ...(opts.note && { note: true }) };
    history.push(asked);
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
    // Khách bấm Dừng (stopAsk): bỏ phần trả lời đã hiện. Câu khách gõ thì rút hẳn khỏi
    // đoạn chat + lịch sử và trả về ô nhập để sửa/gửi lại. Lượt giao diện tự gửi (dòng ghi
    // chú, vd lệnh dựng thiệp) không có gì để trả về ô nhập → thành lượt lỗi có Thử lại.
    const stopped = () => {
      bubble?.closest(".aichat-row")?.remove();
      if (opts.note) {
        asked.failed = "Bạn đã dừng câu trả lời này.";
        if (opts.build) asked.build = true;
        saveHistory();
        addFailure(asked, true);
        return;
      }
      const i = history.indexOf(asked);
      if (i >= 0) history.splice(i, 1);
      saveHistory();
      // Gửi lại (echo false) thì bong bóng câu hỏi có từ trước — là hàng khách cuối cùng.
      const rows = els.body.querySelectorAll(".aichat-row-user");
      (userBubble?.closest(".aichat-row") || rows[rows.length - 1])?.remove();
      els.body.lastElementChild?.classList.remove("is-cont-next");
      // Khách đã gõ thêm trong lúc chờ thì giữ lại, đặt câu vừa huỷ lên trước.
      const typed = els.input.value.trim();
      els.input.value = typed ? text + "\n" + typed : text;
      autoGrow();
      els.input.focus();
      renderSuggests();
    };
    syncSend(); // có `abort` rồi mới bật được nút Dừng

    try {
      // Ảnh/nhạc/bản đồ/mẫu đang có — model khỏi mời lại thứ đã xong. Hỏng thì gửi thiếu.
      const media = await window.CXChatMedia?.summary().catch(() => null);
      // Chỉ lượt tạo/sửa thiệp mới viết chuyện tình → chỉ khi đó mới đọc bản khai mẫu.
      const storyLen =
        mode === "create" ? await window.CXChatMedia?.storyLen?.().catch(() => "") : "";
      const res = await window.aiChatDAL.ask(opts.build ? buildTurns() : chatTurns(), known, {
        media,
        storyLen,
        ready: wasReady,
        build: opts.build === true,
        mode,
        current: mode === "create" ? currentCard() : null,
        onDelta: (partial) => {
          // Mảnh chữ đầu tiên tới nơi → thay ba chấm bằng bong bóng thật. Dòng "đang
          // dựng" đã hiện từ trước (khách giục dựng luôn) thì dời xuống dưới bong bóng.
          if (!bubble) {
            typing.remove();
            bubble = addBubble("bot", "");
            if (building) els.body.appendChild(building);
            typeStart(bubble);
          }
          typeFeed(partial);
        },
        // Dựng thiệp / viết lại chuyện tình chờ lâu hơn hẳn một câu trả lời thường nên
        // đổi ba chấm thành dòng báo cho khách yên tâm.
        onPhase: (phase) => {
          if ((phase !== "card" && phase !== "edit") || building) return;
          typing.remove();
          building = addBuilding(phase === "edit" ? "Đang cập nhật thiệp…" : "");
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
      // lời của cuộc cũ vào lịch sử cuộc mới. Nút Dừng thì bỏ câu trả lời này.
      if (mine.signal.aborted) return void (mine.stopped && stopped());
      showActs(bubble);

      if (res.known) known = res.known;
      if (res.mode === "create" && mode !== "create") setMode("create");
      const entry = { role: "assistant", content: res.text, at: Date.now() };
      if (res.card) {
        // Phần chưa đổ vào form ở trang Thiết lập: lượt sửa mà thiệp trước đã áp dụng
        // (hoặc cũng đang chờ một bản vá) thì chỉ còn chờ bản vá; còn lại là cả thiệp.
        const prev = [...history].reverse().find((m) => m.card);
        if (res.patch && prev && (prev.applied || prev.pending))
          entry.pending = mergePatch(prev.applied ? null : prev.pending, res.patch);
        // Chỉ giữ thiệp MỚI NHẤT: thẻ cũ đã hết bấm được, mà mỗi thiệp là vài KB
        // nằm trong sessionStorage.
        history.forEach((m) => {
          delete m.card;
          delete m.pending;
          delete m.applied;
        });
        entry.card = res.card;
      }
      // Ô chọn dưới câu trả lời: model chỉ định, hoặc lượt vừa thu đủ thông tin
      // ("ready" lần đầu) thì luồng dẫn tự mở ô đầu tiên còn thiếu — không còn ô nào
      // thì hiện nút "Tạo ngay" (offerBuild, sau khi lượt này đã vào lịch sử).
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
        addCardAction(bubble.parentElement, res.card, entry);
        if (!inSetup()) stashDraft(res.card);
      }
      if (kind) addWidget(kind, bubble.parentElement, true);
    } catch (e) {
      typing.remove();
      building?.remove();
      typeStop();
      // Bị nút Làm mới cắt ngang: màn đã sạch rồi, đừng vẽ gì thêm lên đó.
      if (mine.signal.aborted) return void (mine.stopped && stopped());
      bubble?.remove();
      // Lượt lỗi ở lại lịch sử (F5 vẫn thấy lỗi + nút Thử lại) nhưng mang cờ `failed`
      // nên không bao giờ gửi cho model — xem chatTurns.
      asked.failed = e?.message || "XuXi đang bận, bạn thử lại sau ít phút nhé.";
      if (e?.needLogin) asked.needLogin = true;
      if (opts.build) asked.build = true;
      saveHistory();
      addFailure(asked, true);
    } finally {
      busy = false;
      els.mic.disabled = false;
      syncSend();
      if (abort === mine) abort = null;
      scrollToEnd();
      if (buildNext) offerBuild();
    }
  }

  // ── Đóng / mở ─────────────────────────────────────────────────────────────

  // `o.noIntro` = đừng tự chạy lời mở đầu (lối mở kèm sẵn câu hỏi). Nút bong bóng gắn
  // thẳng hàm này nên `o` có thể là một sự kiện chuột — chỉ đọc đúng khoá cần.
  function open(o) {
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
    if (!o?.noIntro) ensureIntro();
  }

  function close() {
    stopMic();
    stopSpeak();
    closeMapView();
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
    // Đang chờ trả lời: nút gửi thành nút Dừng (luôn bấm được), CSS đổi icon theo cờ is-stop.
    els.send.classList.toggle("is-stop", busy);
    els.send.setAttribute("aria-label", busy ? "Dừng" : "Gửi");
    els.send.disabled = busy
      ? !abort
      : !mode || !els.input.value.trim() || over;
    els.composer.classList.toggle("is-over", over);
    els.count.classList.toggle("is-over", over);
    const fmt = (n) => n.toLocaleString("vi-VN");
    els.count.textContent = `${fmt(len)}/${fmt(MAX_LEN)}`;
    // Mọi lần ô nhập đổi (gõ, đọc giọng nói, gửi, Làm mới) đều qua đây → cất câu gõ dở
    // để F5 không mất.
    try {
      if (els.input.value) sessionStorage.setItem(INPUT_KEY, els.input.value);
      else sessionStorage.removeItem(INPUT_KEY);
    } catch {
      /* chặn cookie: chỉ mất câu gõ dở khi tải lại */
    }
  }

  // ── Khởi động ─────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById("aichatFab")) return;
    build();
    // Trang chủ ghi ảnh dưới mã nháp của cuộc chat và lấy địa điểm từ thông tin đã
    // thu; trang Thiết lập có đích ghi riêng (cxAiMediaSink) nên không cần hai thứ này.
    window.CXChatMedia?.init({ draftId: chatDraftId, known: () => known });
    if (!SHOW_ATTACH || !window.CXChatMedia) els.attach.hidden = true;
    loadHistory();
    loadMode();
    convId(); // cuộc đang mở phải có mã ngay từ đầu (chưa có thì đây là cuộc mới)
    paintHistory();
    initMic();
    try {
      els.input.value = sessionStorage.getItem(INPUT_KEY) || "";
    } catch {
      /* chặn cookie */
    }
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
      else if (e.target.closest("#aichatExpand"))
        setExpanded(!els.panel.classList.contains("is-expanded"));
      else if (e.target.closest("#aichatAttach")) toggleKitbar();
    });
    els.body.addEventListener("click", (e) => {
      const speak = e.target.closest("[data-speak]");
      if (speak) toggleSpeak(speak);
      const copy = e.target.closest("[data-copy]");
      if (copy) copyMsg(copy);
      const btn = e.target.closest("[data-card-open]");
      const holder = btn?.closest(".aichat-col, .aichat-row");
      if (btn && !btn.disabled) useCard(holder?._cxCard, holder?._cxEntry);
      const retry = e.target.closest("[data-retry]");
      const failed = retry?.closest(".aichat-col")?._cxFailed;
      if (failed) retryFailed(failed);
      const view = e.target.closest("[data-map-view]");
      if (view) openMapView(view.dataset.embed, view.dataset.title);
      const build = e.target.closest("[data-build]");
      if (build && !busy && canBuild()) {
        build.remove();
        buildCard();
      }
    });
    els.send.addEventListener("click", () => (busy ? stopAsk() : ask(els.input.value)));
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
      if (e.key !== "Escape" || els.panel.hidden) return;
      if (!closeMapView()) close();
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
  // `mode` = "create" khi câu đó là việc tạo thiệp (chip ở màn mở đầu trang chủ).
  window.cxOpenAiChat = function (opt) {
    // Có sẵn câu hỏi thì khách đã biết mình muốn gì — đừng dội lời mở đầu lên trước.
    open({ noIntro: !!(opt && opt.ask) });
    if (opt && opt.mode === "create" && !busy) {
      setMode("create");
      paintHistory(); // qua cửa chọn chế độ luôn: vẽ lại để đầu đoạn chat có tag
    }
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
