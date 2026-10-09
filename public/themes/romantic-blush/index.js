// ============= THEME: ROMANTIC BLUSH =============
// Thiệp dạng SLIDE kiểu tạp chí: các .rb-screen nằm chồng tại chỗ, vuốt thì màn
// sau hiện dần đè lên màn trước; chữ và ảnh mang data-a chạy hiệu ứng mỗi lần màn hiện.
// Phần đặc thù: rải ảnh album vào các màn trang trí (_fillPhotos), lịch tháng,
// đếm ngược, chuyện tình chia tối đa 3 màn. Bọc IIFE, chỉ lộ
// CX_THEME + renderWedding.

(function () {
  window.CX_THEME = {
    id: "romantic-blush",

    // Chữ mốc chuyện tình nằm cạnh ảnh, cột hẹp, hai mốc một màn — đoạn ngắn mới vừa.
    loveStory: "short",

    wishesMode: "spotlight",

    // Hộp mừng cưới khi chủ thiệp chưa chọn — phong bì kem sáp hợp tông be.
    giftBox: "phongbi_kem_sap",

    // Đĩa nhạc neo góc phải trên, như mẫu gốc.
    // Thiệp slide không cuộn trang + nút nằm trong bảng điều hướng (chỉ có sau khi
    // mở bìa) → tắt luật "cuộn mới hiện" của nút nhạc.
    music: { variant: "ring", chrome: "fixed-corner", art: "couple", revealOnScroll: 0 },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#4a3b2e",
      body: "#736151",
      accent: "#82664b",
      accent_soft: "#d6c4ae",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#fdfaf4",
      page_bg: "#f2ebe0",
      surface: "#f7f1e7",
      band: "#faf6ef",
      panel: "#ffffff",
      panel_warm: "#fffcf6",
      cover: "#f2ebe0",
      cover_mid: "#e4d8c7",
      cover_veil: "#2e241b",
      lightbox_bg: "#000000",
      line: "#6b5644",
      shadow: "#000000",
      scrim: "#000000",
      deco: "#82664b",
      deco_soft: "#ece2d3",
      deco_2: "#b8956a",
      deco_2_soft: "#f1e8da",
      shine_from: "#ffffff",
      shine_mid: "#f3e9da",
      shine_to: "#b8956a",
    },

    swatches: [
      "#82664b",
      "#6b5444",
      "#4a3b2e",
      "#736151",
      "#d6c4ae",
      "#b8956a",
      "#ece2d3",
      "#f2ebe0",
      "#fdfaf4",
      "#2e241b",
    ],

    wishes: {},

    // Hiệu ứng của mẫu là data-a theo từng màn (_slides), không dùng hiện-dần
    // chung của theme-boot. Selector này cố ý không khớp gì (mảng rỗng làm
    // querySelectorAll("") ném lỗi).
    reveal: ["#main-card .rb-reveal"],

    suggest: "#section-gift",

    // Mẫu không có màn album: ảnh album rải vào các màn trang trí (_fillPhotos),
    // nên bước Ảnh dẫn tới màn ảnh đầu tiên. Chuyện tình chia nhiều màn trong mục.
    focus: { photos: ["#section-forever"], love_story: ["#love-story-list .rb-screen"] },

    skipSteps: [],

    onOpen: null,
  };

  const _isGroom = isGroomSide();
  const _pad = (n) => String(n).padStart(2, "0");
  const _day = (s) => (s ? new Date(s + "T00:00:00") : null);
  const _SIGN = "Brief is life, but love is long.";

  // ============= ĐỔ DỮ LIỆU LÊN THIỆP =============

  function renderWedding(w) {
    if (!w || !w.is_active) return;

    const side = _isGroom ? "groom" : "bride";
    const partyDate = w[`${side}_party_date`];
    const partyLocation = w[`${side}_party_location`];

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";

    // --- Màn 1 (mẫu không có màn bìa) --- chạy TRƯỚC setupMusic để ảnh màn đầu nhận src trước
    renderHero(w, false);
    const cd = _day(w.ceremony_date);
    setText("rb-hero-event", ceremonyName);
    setText("rb-hero-d", cd ? _pad(cd.getDate()) : "", "--");
    setText("rb-hero-m", cd ? _pad(cd.getMonth() + 1) : "", "--");
    setText("rb-hero-y", cd ? String(cd.getFullYear()) : "", "----");
    setText("rb-hero-place", partyLocation || ceremonyLoc, "");

    // Ảnh trang trí của mọi màn lấy từ album
    _fillPhotos(w);

    // --- Màn Forever ---
    renderStoryQuote(w.story_quote);

    // --- Nhạc nền ---
    setupMusic(w.music_url, w.enable_music);

    // --- Gia đình ---
    renderCoupleInfo(w);
    _call("rb-groom-call", w.groom_phone);
    _call("rb-bride-call", w.bride_phone);
    cxToggle("groom-address", !!w.groom_address);
    cxToggle("bride-address", !!w.bride_address);
    cxToggle("section-family", cxEnabled(w.enable_family));

    // --- Thư mời (màn Time) ---
    setText("ceremony-event-name", ceremonyName);
    renderCeremonyDate(w.ceremony_date, ceremonyTime, w.ceremony_lunar);
    setText(
      "rb-ceremony-date",
      cd ? `${_pad(cd.getDate())}.${_pad(cd.getMonth() + 1)}.${cd.getFullYear()}` : "",
      "--.--.----",
    );
    if (ceremonyLoc) {
      setText("ceremony-location-text", ceremonyLoc);
      cxToggle("ceremony-location-wrap", true);
    }
    _renderCalendar(w.ceremony_date, partyDate);

    renderMusicSummary(w, {
      ceremonyName,
      ceremonyTime,
      ceremonyLocation: ceremonyLoc,
    });

    // --- Tiệc cưới ---
    setText("party-section-label", "Tiệc mừng " + ceremonyName.toLowerCase());
    renderPartyDate(partyDate, w[`${side}_party_time`], w[`${side}_party_lunar`], partyLocation, "full");
    cxToggle("section-party", cxEnabled(w.enable_party));

    // --- Địa điểm ---
    renderVenueMaps(w, side);

    // --- Xác nhận tham dự --- (lời nhắn riêng thay cho đoạn chữ mặc định)
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) {
      setText("rsvp-custom-message", w.rsvp_message);
      cxToggle("rsvp-custom-message", true);
      cxToggle("rb-rsvp-lines", false);
    }
    _startCountdown(w.ceremony_date, ceremonyTime);

    // --- Chuyện tình yêu ---
    if (cxEnabled(w.enable_love_story)) {
      _renderStory(w.love_story);
    } else {
      cxToggle("love-story", false);
    }

    // --- Lịch trình ---
    if (cxEnabled(w.enable_timeline)) {
      renderTimeline(w.timeline, side, partyDate, w.ceremony_date, ceremonyName);
      cxToggle("section-timeline", true);
    }

    // --- Hộp mừng cưới ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", w.footer_text);
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // Màn dựng động (album, chuyện tình) cần được theo dõi thêm
    _slides();
  }

  window.renderWedding = renderWedding;

  // ============= CHỒNG MÀN + HIỆU ỨNG =============
  // Cờ .rb-fx/.rb-stack đặt sẵn ở <head> (tab Giao diện không có → thiệp trải dài
  // như trang thường). Mọi màn nằm chồng tại chỗ; đổi màn = màn mới hiện dần đè
  // lên màn cũ, không cuộn. Màn đang hiện mang .rb-on (hiệu ứng chạy), rời đi thì
  // gỡ để lần quay lại chạy lại từ đầu, như slideshow.
  const _fx = () => document.documentElement.classList.contains("rb-fx");
  const _FADE_MS = 900;
  const _SLIDE_SEL = ".rb-screen, .rb-body > .cx-custom-block, .rb-body > #cx-wish-sec";
  let _list = [];
  let _curEl = null;
  let _busyUntil = 0;

  // Danh sách màn theo THỨ TỰ HIỂN THỊ: mục lời chúc và khối văn bản tự thêm đứng
  // chỗ của mình bằng flex `order`, nên xếp theo order của con trực tiếp .rb-body
  // trước rồi mới tới thứ tự DOM. Màn đang tắt (display:none) thì bỏ.
  function _collect() {
    const body = document.querySelector("#main-card .rb-body");
    if (!body) return [];
    _pack(body);
    const top = (el) => {
      let t = el;
      while (t.parentElement && t.parentElement !== body) t = t.parentElement;
      return Number(getComputedStyle(t).order) || 0;
    };
    const nodes = Array.from(body.querySelectorAll(_SLIDE_SEL));
    nodes.forEach((n) => n.classList.add("rb-slide"));
    return nodes
      .map((el, i) => ({ el, i, o: top(el) }))
      .filter((x) => x.el.offsetParent !== null)
      .sort((a, b) => a.o - b.o || a.i - b.i)
      .map((x) => x.el);
  }

  // Màn thưa ghép vào màn khác: mục lời chúc (helper dựng thành một mục riêng,
  // đứng một màn thì trống trải) chuyển vào màn Hộp mừng cưới; tắt quà thì vào
  // màn Lời cảm ơn. Helper chỉ tìm mục theo id nên dời chỗ không ảnh hưởng; dựng
  // lại (đổi dạng lời chúc) thì nó gắn vào cuối thân thiệp → MutationObserver
  // gọi lại đây và mục được dời tiếp.
  function _pack(body) {
    const wish = document.getElementById("cx-wish-sec");
    if (!wish) return;
    const host = ["section-gift", "section-footer"]
      .map((id) => document.getElementById(id))
      .find((s) => s && getComputedStyle(s).display !== "none");
    document.querySelectorAll(".rb-packed").forEach((s) => s !== host && s.classList.remove("rb-packed"));
    if (!host) {
      if (wish.parentElement !== body) body.appendChild(wish);
      wish.classList.remove("rb-pack");
      return;
    }
    host.classList.add("rb-packed");
    if (wish.parentElement === host) return;
    wish.classList.remove("rb-slide", "is-cur", "is-prev", "rb-on");
    wish.classList.add("rb-pack");
    host.appendChild(wish);
  }

  // Gọi sau mỗi lần dựng lại (render, mở thiệp, helper chèn thêm mục): gắn .rb-slide
  // cho màn mới, giữ màn đang xem nếu nó vẫn còn, không thì về màn đầu.
  function _slides() {
    if (!_fx()) return;
    _list = _collect();
    if (!_list.length) return;
    if (!_curEl || _list.indexOf(_curEl) < 0) _show(_list[0], true);
    else _progress();
  }

  function _show(next, instant) {
    if (!next || next === _curEl) return;
    const prev = _curEl;
    _list.forEach((s) => s !== prev && s !== next && s.classList.remove("is-prev", "rb-on"));
    if (prev) {
      prev.classList.remove("is-cur");
      prev.classList.add("is-prev");
      clearTimeout(prev._rbT);
      prev._rbT = setTimeout(
        () => prev !== _curEl && prev.classList.remove("is-prev", "rb-on"),
        instant ? 0 : _FADE_MS,
      );
    }
    clearTimeout(next._rbT);
    next.classList.remove("is-prev");
    next.scrollTop = 0;
    _activate(next);
    next.classList.add("is-cur");
    _curEl = next;
    _progress();
  }

  // Thanh điều hướng đáy thiệp: vạch chia đoạn theo số màn + bảng chọn màn.
  // Lần đầu bung sẵn rồi tự thu (khách biết có nó); chạm vạch là bung lại.
  let _nav = null;
  let _navKey = "";
  let _navT = 0;

  function _label(el, i) {
    if (el.dataset.rbLabel) return el.dataset.rbLabel;
    if (el.id === "cx-wish-sec") return "Lời chúc";
    if (el.classList.contains("cx-custom-block")) return "Lời nhắn";
    return "Màn " + (i + 1);
  }

  // Đầu bảng: nút nhạc · tên bài · nút đóng. Thiệp không có nhạc (hoặc nút nhạc đã
  // nhường cho thành phần nhạc thả lên thiệp) thì đầu bảng chỉ còn nhãn danh sách.
  function _navSong() {
    const el = _nav?.querySelector(".rb-nav-song");
    if (!el) return;
    const music = document.getElementById("music-toggle");
    const on = !!(window.__cxMusicOn && music && music.style.display !== "none");
    _nav.classList.toggle("no-music", !on);
    const title = on ? window.getMusicInfo?.()?.title || "Nhạc nền" : "Danh sách màn";
    if (el.textContent !== title) {
      el.textContent = title;
      el.title = title;
    }
  }

  function _navOpen(open, ms) {
    if (!_nav) return;
    clearTimeout(_navT);
    if (open) _navSong();
    const was = _nav.classList.contains("is-open");
    _nav.classList.toggle("is-open", open);
    // Đang mở mà thu lại → vạch nảy đón bảng (is-land gỡ đi để lần sau chạy lại).
    if (was && !open) {
      _nav.classList.remove("is-land");
      void _nav.offsetWidth;
      _nav.classList.add("is-land");
      clearTimeout(_nav._landT);
      _nav._landT = setTimeout(() => _nav.classList.remove("is-land"), 1400);
    }
    _nav.querySelector(".rb-nav-bar").setAttribute("aria-expanded", String(open));
    if (open && ms) _navT = setTimeout(() => _navOpen(false), ms);
  }

  // Gom màn thành BƯỚC trên thanh: chỉ mục khai `data-rb-main` (index.html) mở bước
  // mới, mục phụ / khối văn bản / lời chúc gộp vào bước đứng trước — thanh ngắn gọn.
  // Nhãn bước = nhãn của mục, mục không khai thì của màn đầu.
  let _groups = [];
  function _group() {
    const body = document.querySelector("#main-card .rb-body");
    const out = [];
    _list.forEach((el, i) => {
      let top = el;
      while (top.parentElement && top.parentElement !== body) top = top.parentElement;
      const last = out[out.length - 1];
      if (last && (last.top === top || !top.hasAttribute("data-rb-main"))) last.slides.push(el);
      else out.push({ top, slides: [el], label: (top !== el && top.dataset.rbLabel) || _label(el, i) });
    });
    return out;
  }

  function _navBuild() {
    const card = document.getElementById("main-card");
    if (!card) return;
    if (!_nav) {
      _nav = document.createElement("nav");
      _nav.className = "rb-nav";
      _nav.setAttribute("aria-label", "Chuyển màn");
      _nav.innerHTML =
        '<div class="rb-nav-panel"><div class="rb-nav-head">' +
        '<div class="rb-nav-music"></div><div class="rb-nav-song"></div>' +
        '<x-button variant="bare" icon-only class="rb-nav-x" aria-label="Đóng danh sách màn">' +
        '<i data-lucide="x" class="cx-ic"></i></x-button></div>' +
        '<div class="rb-nav-list"></div></div>' +
        '<button type="button" class="rb-nav-bar" aria-label="Danh sách màn" aria-expanded="false"></button>';
      card.appendChild(_nav);
      window.lucide?.createIcons({ root: _nav });
      // Uỷ quyền qua _nav: lúc dựng trang còn "loading" nên <x-button> đợi
      // DOMContentLoaded mới thay mình bằng <button> — gắn thẳng là mất listener.
      _nav.addEventListener("click", (e) => {
        if (e.target.closest?.(".rb-nav-x")) _navOpen(false);
      });
      _nav.querySelector(".rb-nav-bar").addEventListener("click", () =>
        _navOpen(!_nav.classList.contains("is-open"), 0),
      );
      _nav.querySelector(".rb-nav-list").addEventListener("click", (e) => {
        const chip = e.target.closest(".rb-nav-chip");
        if (!chip) return;
        _show(_groups[Number(chip.dataset.g)]?.slides[0]); // tới màn ĐẦU của mục
        _navOpen(true, 1200); // để khách thấy mình đã tới đâu rồi mới thu
      });
      // Chạm ra ngoài bảng thì thu lại.
      card.addEventListener("click", (e) => {
        if (_nav.classList.contains("is-open") && !_nav.contains(e.target)) _navOpen(false);
      });
      // Tên bài YouTube trả trễ → vẽ lại mỗi lần trạng thái nhạc đổi.
      window.addEventListener("cx:music-state", _navSong);
      // Mới vào: bảng ẩn, đợi màn đầu chạy xong hiệu ứng chính mới mọc lên từ vạch,
      // để một lúc cho khách đọc rồi thu gọn về lại vạch tiến độ.
      _navT = setTimeout(() => _navOpen(true, 3000), 1600); // khách đã tự chạm vạch thì huỷ
    }
    // Nút nhạc (theme-boot dựng neo góc màn) dời vào góc trái bảng — kiểm mỗi lần
    // vì thanh dựng lúc index.js nạp, TRƯỚC khi theme-boot dựng nút. Bê nguyên node
    // nên id #music-toggle + listener của helper vẫn còn.
    const music = document.getElementById("music-toggle");
    const slot = _nav.querySelector(".rb-nav-music");
    if (music && music.parentElement !== slot) slot.appendChild(music);
    _navSong();
    _groups = _group();
    const key = _groups.map((g) => g.label + ":" + g.slides.length).join("|");
    if (key === _navKey) return;
    _navKey = key;
    _nav.querySelector(".rb-nav-list").innerHTML = _groups
      .map(
        (g, i) =>
          `<button type="button" class="rb-nav-chip" data-g="${i}"><b>${_pad(i + 1)}</b><span>${escapeHtml(g.label)}</span></button>`,
      )
      .join("");
    _nav.querySelector(".rb-nav-bar").innerHTML = _groups
      .map((_, i) => `<i style="--n:${i}"></i>`)
      .join("");
  }

  function _progress() {
    if (!_curEl) return;
    _navBuild();
    if (!_nav) return;
    const cur = _groups.findIndex((g) => g.slides.includes(_curEl));
    _nav.querySelectorAll(".rb-nav-bar i").forEach((n, i) => n.classList.toggle("is-done", i <= cur));
    const list = _nav.querySelector(".rb-nav-list");
    list.querySelectorAll(".rb-nav-chip").forEach((n, i) => {
      n.classList.toggle("is-cur", i === cur);
      if (i === cur) n.setAttribute("aria-current", "step");
      else n.removeAttribute("aria-current");
    });
    // Tự cuộn dải chip cho màn đang xem nằm giữa — đặt scrollLeft, đừng dùng
    // scrollIntoView (nó cuộn lây cả màn chứa thanh).
    const chip = list.children[cur];
    if (chip) list.scrollLeft = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    _nav.classList.toggle("is-dark", _curEl.dataset.rbTone === "dark");
  }

  function _step(dir) {
    if (Date.now() < _busyUntil) return;
    _list = _collect();
    const i = _list.indexOf(_curEl);
    const next = _list[Math.max(0, Math.min(_list.length - 1, (i < 0 ? 0 : i) + dir))];
    if (!next || next === _curEl) return;
    _busyUntil = Date.now() + _FADE_MS;
    _show(next);
  }

  function _activate(screen) {
    screen.classList.remove("rb-on");
    screen.querySelectorAll('[data-a^="ch"]').forEach(_split);
    void screen.offsetWidth; // gỡ rồi gắn lại trong cùng nhịp vẫn chạy lại animation
    screen.classList.add("rb-on");
  }

  // Màn đang xem cuộn được bên trong thì chỉ đổi màn khi đã chạm mép theo hướng vuốt.
  function _atEdge(dir) {
    const s = _curEl;
    if (!s || s.scrollHeight <= s.clientHeight + 2) return true;
    return dir > 0
      ? s.scrollTop + s.clientHeight >= s.scrollHeight - 2
      : s.scrollTop <= 2;
  }

  function _wireGestures() {
    const card = document.getElementById("main-card");
    if (!card) return;

    // Vuốt dọc. Mép được chốt lúc BẮT ĐẦU chạm: vuốt tới cuối màn dài thì lần vuốt
    // đó chỉ cuộn, lần sau mới sang màn.
    let sx = 0;
    let sy = 0;
    let edge = { 1: true, "-1": true };
    card.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        edge = { 1: _atEdge(1), "-1": _atEdge(-1) };
      },
      { passive: true },
    );
    // Màn không cuộn được thì chặn kéo dọc để trình duyệt khỏi nảy cả trang.
    card.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches[0];
        if (Math.abs(t.clientY - sy) <= Math.abs(t.clientX - sx)) return;
        if (e.target.closest?.("textarea, input")) return;
        const s = _curEl;
        if (s && s.scrollHeight <= s.clientHeight + 2 && e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
    card.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        const dy = sy - t.clientY;
        const dx = sx - t.clientX;
        if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
        const dir = dy > 0 ? 1 : -1;
        if (edge[dir]) _step(dir);
      },
      { passive: true },
    );

    // Lăn chuột / bàn di: dồn deltaY cho đủ một nấc rồi mới đổi màn.
    let acc = 0;
    let accT = 0;
    card.addEventListener(
      "wheel",
      (e) => {
        const dir = e.deltaY > 0 ? 1 : -1;
        if (!_atEdge(dir)) return;
        e.preventDefault();
        if (Date.now() < _busyUntil) return;
        acc += e.deltaY;
        clearTimeout(accT);
        accT = setTimeout(() => (acc = 0), 200);
        if (Math.abs(acc) > 40) {
          acc = 0;
          _step(dir);
        }
      },
      { passive: false },
    );

    document.addEventListener("keydown", (e) => {
      if (e.target.closest?.("textarea, input")) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) _step(1);
      else if (["ArrowUp", "PageUp"].includes(e.key)) _step(-1);
      else return;
      e.preventDefault();
    });

    // Helper chèn mục sau khi dựng (lời chúc, khối văn bản) → cập nhật danh sách màn.
    const body = card.querySelector(".rb-body");
    if (body && typeof MutationObserver === "function") {
      new MutationObserver(() => _slides()).observe(body, { childList: true });
    }

    // Trang Thiết lập gửi {type:"cx-focus", key} để tới mục đang chỉnh. Helper
    // chung chỉ biết cuộn trang (vô tác dụng ở đây) → tìm mục rồi mở màn chứa nó.
    window.addEventListener("message", (ev) => {
      if (ev.source !== window.parent || ev.data?.type !== "cx-focus" || !ev.data.key) return;
      const key = String(ev.data.key);
      let tries = 0;
      const run = () => {
        _list = _collect();
        if (key === "couple") return _show(_list[0]);
        const el = typeof _cxFocusFind === "function" ? _cxFocusFind(key) : null;
        if (!el) {
          if (++tries < 8) setTimeout(run, 120);
          return;
        }
        _show(el.closest(".rb-slide"));
      };
      run();
    });
  }

  // Tách chữ trơn thành từng ký tự (--i = thứ tự) để chạy hiệu ứng lần lượt.
  // Gom theo từ (inline-block nowrap) cho khỏi xuống dòng giữa một từ. Chữ bị
  // setText ghi đè sau đó thì lần kích hoạt sau tách lại.
  const _seg =
    typeof Intl !== "undefined" && Intl.Segmenter
      ? new Intl.Segmenter("vi", { granularity: "grapheme" })
      : null;
  function _split(el) {
    if (el.children.length || !el.textContent.trim()) return;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    const chars = (word) =>
      _seg ? Array.from(_seg.segment(word), (x) => x.segment) : Array.from(word.normalize("NFC"));
    el.textContent = "";
    let i = 0;
    text.split(" ").forEach((word, wi) => {
      if (wi) el.appendChild(document.createTextNode(" "));
      const w = document.createElement("span");
      w.className = "rb-w";
      chars(word).forEach((c) => {
        const s = document.createElement("span");
        s.className = "rb-ch";
        s.textContent = c;
        s.style.setProperty("--i", i++);
        w.appendChild(s);
      });
      el.appendChild(w);
    });
  }

  // Mẫu không có màn bìa: hiện màn 1 ngay khi nạp (đặt SAU _split — _activate cần nó).
  if (_fx()) {
    _wireGestures();
    _slides();
  }

  // Tên khách của link mời — trước nằm ở màn bìa, nay ở màn 1. Helper chung điền
  // #cover-guest-name; link chung (không ?name=) thì khối này giấu hẳn.
  if (
    new URLSearchParams(location.search).has("name") &&
    !(typeof isPreviewMode === "function" && isPreviewMode())
  ) {
    // cxToggle nằm ở theme-boot.js (nạp SAU file này) → gỡ class trực tiếp.
    document.getElementById("rb-guest")?.classList.remove("hidden");
  }

  // ============= ẢNH TRANG TRÍ =============
  // <img data-rb-g="N"> nhận ảnh thứ N của album, quay vòng khi album ít ảnh hơn;
  // data-rb-g="cover" (hoặc album rỗng) lấy ảnh bìa.
  function _fillPhotos(w) {
    const imgs = Array.isArray(w.gallery_images) ? w.gallery_images.filter(Boolean) : [];
    const fps = w.image_focal_points || {};
    document.querySelectorAll("img[data-rb-g]").forEach((el) => {
      const k = el.dataset.rbG;
      let file = w.cover_image_url;
      let fp = fps.cover_image_url;
      if (k !== "cover" && imgs.length) {
        file = imgs[Number(k) % imgs.length];
        fp = fps.gallery_images?.[file];
      }
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(fp);
    });
  }

  // Nút gọi: có số thì thành link tel:, không thì giấu hẳn (.rb-call-off).
  function _call(id, phone) {
    const el = document.getElementById(id);
    if (!el) return;
    const num = String(phone || "").replace(/[^\d+]/g, "");
    if (num) el.setAttribute("href", "tel:" + num);
    else el.removeAttribute("href");
    el.classList.toggle("rb-call-off", !num);
  }

  // ============= LỊCH THÁNG (tuần bắt đầu thứ Hai) =============
  function _renderCalendar(dateStr, partyStr) {
    const grid = document.getElementById("rb-cal-grid");
    if (!grid) return;
    const d = _day(dateStr) || new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    setText("rb-cal-d", dateStr ? _pad(d.getDate()) : "--");
    setText("rb-cal-m", _pad(m + 1));
    setText("rb-cal-year", y);

    const p = _day(partyStr);
    const partyDay = p && p.getFullYear() === y && p.getMonth() === m ? p.getDate() : 0;
    const mark = dateStr ? d.getDate() : 0;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();

    let html = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      .map((n) => `<div class="rb-cal-hd">${n}</div>`)
      .join("");
    html += "<div></div>".repeat(lead);
    for (let i = 1; i <= days; i++) {
      const cls = i === mark ? " is-day" : i === partyDay ? " is-party" : "";
      html += `<div class="rb-cal-c${cls}"><span>${i}</span></div>`;
    }
    grid.innerHTML = html;
  }

  // ============= ĐẾM NGƯỢC =============
  let _cdTimer = 0;
  function _startCountdown(dateStr, timeStr) {
    clearInterval(_cdTimer);
    const hm = /^(\d{1,2}):(\d{2})/.exec(String(timeStr || ""));
    const at = dateStr
      ? Date.parse(`${dateStr}T${hm ? _pad(hm[1]) + ":" + hm[2] : "00:00"}:00`)
      : NaN;
    const tick = () => {
      let s = Number.isFinite(at) ? Math.max(0, Math.floor((at - Date.now()) / 1000)) : 0;
      setText("rb-cd-d", _pad(Math.floor(s / 86400)));
      s %= 86400;
      setText("rb-cd-h", _pad(Math.floor(s / 3600)));
      s %= 3600;
      setText("rb-cd-m", _pad(Math.floor(s / 60)));
      setText("rb-cd-s", _pad(s % 60));
    };
    tick();
    if (Number.isFinite(at) && at > Date.now()) _cdTimer = setInterval(tick, 1000);
  }

  // ============= OUR STORY — tối đa 3 màn =============
  // Các mốc chia đều vào ≤3 màn (màn đầu nhận phần dư). Bố cục theo số mốc một
  // màn: 1 = ảnh lớn + chữ dưới, 2 = ảnh lệch khối màu nhấn so le, 3+ = hàng gọn.
  const _STORY_PAGES = 3;

  function _renderStory(events) {
    const section = document.getElementById("love-story");
    const list = document.getElementById("love-story-list");
    if (!section || !list) return;
    if (!Array.isArray(events) || !events.length) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    const item = (ev, i, k) => {
      const img = ev.image_url
        ? `<div class="rb-st-ph" data-a="${i % 2 ? "right" : "left"}" data-d="${2 + k * 3}">
             <div class="rb-st-block"></div>
             <img src="${cxImgSrc(ev.image_url)}" alt="" style="object-position:${cxFocal(ev.focal_point)}" />
           </div>`
        : "";
      return `
        <div class="rb-st-item${i % 2 ? " rb-st-rev" : ""}${img ? "" : " rb-st-noimg"}">
          ${img}
          <div class="rb-st-txt" data-a="up" data-d="${3 + k * 3}">
            ${ev.date ? `<div class="rb-st-date">${escapeHtml(ev.date)}</div>` : ""}
            ${ev.title ? `<div class="rb-st-title cx-h">${escapeHtml(ev.title)}</div>` : ""}
            ${ev.content ? `<div class="rb-st-content cx-t">${escapeHtml(ev.content)}</div>` : ""}
          </div>
        </div>`;
    };

    const n = events.length;
    const pages = Math.min(_STORY_PAGES, n);
    let at = 0;
    let html = "";
    for (let p = 0; p < pages; p++) {
      const size = Math.floor(n / pages) + (p < n % pages ? 1 : 0);
      const mode = size === 1 ? "one" : size === 2 ? "two" : "many";
      const items = events
        .slice(at, at + size)
        .map((ev, k) => item(ev, at + k, k))
        .join("");
      html += `
        <div class="rb-screen rb-st-screen rb-st-${mode}" data-rb-label="Chuyện tình ${p + 1}">
          <h2 class="rb-title rb-title-red" data-a="ch-drop">Our Story</h2>
          <div class="rb-kicker" data-a="up" data-d="1">Chương ${_pad(p + 1)} / ${_pad(pages)}</div>
          <div class="rb-st-list">${items}</div>
          <div class="rb-sign" data-a="wipe" data-d="11">${_SIGN}</div>
        </div>`;
      at += size;
    }
    list.innerHTML = html;
  }
})();
