// iPhone Messenger — bìa là màn khoá điện thoại có thông báo, thân thiệp là cuộc trò chuyện:
// ảnh, thẻ sự kiện, vị trí, quà mừng đều là tin nhắn, hiện lần lượt khi cuộn tới.
// Chỉ khai báo CX_THEME + renderWedding; phần chạy nằm ở core/helpers/theme-boot.js.

(function () {
  window.CX_THEME = {
    id: "messenger-iphone",
    wishesMode: "chat",
    // Lời chúc luôn ở dạng chat trong cửa sổ kéo xuống — trang Thiết lập không cho đổi dạng.
    wishesFixed: true,
    // Quà mừng là tin nhắn tự mở rộng ra QR — không phủ thêm hộp.
    giftBox: "none",
    music: { variant: "mini", chrome: "fixed-corner", art: "couple" },

    // Bộ màu MẶC ĐỊNH của mẫu — bản khai máy đọc được của đúng những giá trị
    // :root trong theme.css (nguồn sự thật). Trang Thiết lập đọc nó để hiện mục
    // "Mặc định"; theme_setting.palette ghi đè lên trên lúc chạy.
    // Sinh lại bằng: node scripts/check-theme-palette.mjs --write
    palette: {
      heading: "#1c1a27",
      body: "#6a6680",
      accent: "#6c4cf5",
      accent_soft: "#a855f7",
      on_accent: "#ffffff",
      on_image: "#ffffff",
      on_lightbox: "#ffffff",
      card_bg: "#f4f2f8",
      page_bg: "#e9e6f0",
      surface: "#ece9f3",
      band: "#ffffff",
      panel: "#ffffff",
      panel_warm: "#ffffff",
      cover: "#1c1a27",
      cover_mid: "#2a2440",
      cover_veil: "#181230",
      lightbox_bg: "#0e0c16",
      line: "#e6e2f0",
      shadow: "#1c1a27",
      scrim: "#181230",
      deco: "#ff4f8b",
      deco_soft: "#ffd6e5",
      deco_2: "#22a45d",
      deco_2_soft: "#dcf3e6",
      shine_from: "#6c4cf5",
      shine_mid: "#a855f7",
      shine_to: "#ff4f8b",
    },

    swatches: ["#6c4cf5", "#a855f7", "#ff4f8b", "#1c1a27", "#6a6680", "#e6e2f0", "#f4f2f8", "#ffffff"],

    wishes: { bubble: "#ffffff", text: "#1c1a27", accent: "#6c4cf5", btn: "#6c4cf5" },

    // Tin nhắn tự hiện theo nhịp riêng (_bindThread) — không dùng hiệu ứng cuộn chung.
    reveal: ["#mi-no-reveal"],
    suggest: "#section-footer",
    skipSteps: ["family", "timeline", "love_story"],
    loveStory: "short",
    onOpen: () => _bindThread(),
  };

  const _isGroom = isGroomSide();
  const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const pad = (n) => String(n).padStart(2, "0");
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderWedding(w) {
    if (!w || !w.is_active) return;
    const side = _isGroom ? "groom" : "bride";

    // Ảnh màn đầu nhận src TRƯỚC setupMusic (YouTube API đi sau).
    renderCover(w);
    _fillPhotos(w);
    // Câu khen ảnh đầu mục Lễ cưới chỉ hợp khi vừa gửi album — đổi câu khuôn trước khi
    // CXXungHo điền (không thêm/bớt tin để khỏi lệch :nth-child của text_overrides).
    if (!cxEnabled(w.enable_photos)) {
      const ask = document.getElementById("mi-ask-date");
      if (ask) {
        ask.dataset.cxSay = "{Hai} cưới vào ngày nào vậy?";
        ask.textContent = "Hai bạn cưới vào ngày nào vậy?";
      }
    }
    // Câu chat [data-cx-say] xưng hô theo khách (Cô ↔ cháu…). Chạy trước các setText bên
    // dưới: lời chủ thiệp tự nhập (rsvp_message…) vẫn đè lên câu khuôn, rồi qua _say().
    _roles = window.CXXungHo?.apply(document.getElementById("main-card")) || null;
    window.CXXungHo?.apply(document.getElementById("cover-screen"));
    _bindVoice();

    const isVuQuy = !_isGroom && cxEnabled(w.vu_quy_enabled);
    const ceremonyName = isVuQuy ? "Lễ Vu Quy" : w.ceremony_name || "Lễ Thành Hôn";
    const ceremonyTime = isVuQuy ? w.vu_quy_time : w.ceremony_time;
    const ceremonyLoc = isVuQuy ? w.vu_quy_location : w.ceremony_location || "";
    const cd = _date(w.ceremony_date);

    // --- Màn khoá ---
    setText("mi-lock-date", cd ? `${WD[cd.getDay()]}, ${cd.getDate()} tháng ${cd.getMonth() + 1}` : "", "-------");
    setText("mi-lock-time", ceremonyTime, "--:--");
    setText(
      "mi-n3-text",
      `${ceremonyName} ${w.bride_name || "----"} & ${w.groom_name || "----"}` +
        (cd ? `, ${WD[cd.getDay()]} ${_fmtDMY(w.ceremony_date)}` : "") +
        (ceremonyTime ? ` lúc ${ceremonyTime}` : ""),
    );
    _bindUnlock();

    setupMusic(w.music_url, w.enable_music);

    // --- Thanh tiêu đề + tên người gửi ---
    renderHero(w, false);
    renderCoupleInfo(w);
    ["b1", "b2", "b3", "b4", "b5"].forEach((k) => setText(`mi-who-${k}`, w.bride_name, "----------"));
    ["g1", "g2", "g3"].forEach((k) => setText(`mi-who-${k}`, w.groom_name, "----------"));
    if (w.story_quote) setText("story-quote", _say(w.story_quote));

    // --- Thẻ sự kiện ---
    setText("ceremony-event-name", ceremonyName);
    setText("mi-cal-m", cd ? `THG ${cd.getMonth() + 1}` : "", "THG --");
    setText("mi-cal-d", cd ? pad(cd.getDate()) : "", "--");
    setText("mi-ev-date", cd ? `${WD[cd.getDay()]}, ${_fmtDMY(w.ceremony_date)}` : "", "--.--.----");
    setText("mi-ev-cer", [ceremonyTime, _place(ceremonyLoc)].filter(Boolean).join(" · "), "--:--");
    setText("mi-ev-cer-sub", w.ceremony_lunar || "");
    cxToggle("mi-ev-cer-sub", !!w.ceremony_lunar);

    const partyDate = w[`${side}_party_date`];
    const partyTime = w[`${side}_party_time`];
    const partyLoc = w[`${side}_party_location`] || "";
    const pd = _date(partyDate);
    setText("mi-ev-party", partyTime ? `Tiệc mừng ${partyTime}` : "Tiệc mừng");
    setText(
      "mi-ev-party-sub",
      [pd ? `${WD[pd.getDay()]} ${pad(pd.getDate())}.${pad(pd.getMonth() + 1)}` : "", _place(partyLoc)]
        .filter(Boolean)
        .join(", "),
    );
    cxToggle("section-party", cxEnabled(w.enable_party));
    _calendarLink(w, ceremonyName, ceremonyTime, ceremonyLoc);

    renderMusicSummary(w, { ceremonyName, ceremonyTime, ceremonyLocation: ceremonyLoc });

    // --- Album ---
    if (cxEnabled(w.enable_photos)) {
      renderGallery(w.gallery_images, w.image_focal_points?.gallery_images);
    } else {
      cxToggle("section-photos", false);
    }

    // --- Bản đồ ---
    renderVenueMaps(w, side);
    _bindDirections();

    // --- Xác nhận tham dự ---
    const rsvp = document.getElementById("rsvp-section");
    if (rsvp) rsvp.style.display = cxEnabled(w.rsvp_enabled) ? "flex" : "none";
    if (w.rsvp_message) setText("rsvp-custom-message", _say(w.rsvp_message, true));

    // --- Quà mừng ---
    renderQRCodes(w);
    cxToggle("section-gift", cxEnabled(w.enable_gift));
    _bindGift();

    // --- Lời cảm ơn ---
    if (w.footer_text) setText("footer-text", _say(w.footer_text, true));
    cxToggle("section-footer", cxEnabled(w.enable_footer));

    // --- Lời chúc: gom vào khung mở từ thanh tiêu đề ---
    _bindWishPanel();

    requestAnimationFrame(() => document.getElementById("cover-screen")?.classList.add("mi-live"));
  }

  window.renderWedding = renderWedding;

  // ============= XƯNG HÔ =============
  // Bộ vai của khách đang xem (CXXungHo.apply trả về) — null khi chưa nạp helper.
  let _roles = null;

  // Câu chủ thiệp tự viết: đổi "tụi mình…" (và "bạn" khi câu nói với khách) theo khách.
  function _say(text, toGuest) {
    return _roles ? window.CXXungHo.adapt(text, _roles, { guest: toGuest }) : text;
  }

  // Câu do helper dùng chung tự chèn (wedding-helper: xác nhận tham dự; wishes-helper: ô gửi
  // lời chúc) viết cứng "bạn / chúng tôi" → đổi sang câu khuôn. So NGUYÊN VĂN: helper đổi
  // chữ thì câu đó rơi về bản gốc, không vỡ gì.
  const VOICE = {
    "Cảm ơn bạn! Chúng tôi rất mong được gặp bạn 🌸": "{Ta} cảm ơn {goi} nhiều {nha}! Hẹn gặp {goi} ở đám cưới 🌸",
    "Cảm ơn bạn đã phản hồi. Chúc bạn nhiều sức khỏe!": "{Ta} cảm ơn {goi} đã báo cho {ta} biết{a}. Chúc {goi} nhiều sức khỏe!",
    "Bạn đã xác nhận tham dự. Hẹn gặp bạn nhé 🌸": "{Goi} đã xác nhận tham dự rồi, hẹn gặp {goi} ở đám cưới {nha} 🌸",
    "Bạn đã phản hồi không tham dự. Cảm ơn bạn!": "{Goi} đã báo không tới được, {ta} cảm ơn {goi} nhiều {nha}!",
    "Chưa gửi được xác nhận, bạn thử lại giúp nhé (kiểm tra kết nối mạng).":
      "Chưa gửi được xác nhận, {goi} thử lại giúp {ta} {nhe} (kiểm tra kết nối mạng).",
    "Cảm ơn lời chúc của bạn!": "{Ta} cảm ơn lời chúc của {goi} {nha}!",
    "Đã gửi, cảm ơn bạn!": "Đã gửi, {ta} cảm ơn {goi} {nha}!",
  };
  const VOICE_IDS = ["attend-msg", "cx-wdock-hint"];

  function _bindVoice() {
    if (!_roles || document.body._miVoice) return;
    document.body._miVoice = true;
    const fix = () =>
      VOICE_IDS.forEach((id) => {
        const el = document.getElementById(id);
        const tpl = el && VOICE[el.textContent.trim()];
        if (tpl) el.textContent = window.CXXungHo.fill(tpl, _roles);
      });
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true, characterData: true });
    fix();
  }

  // Ảnh đặt theo vai: data-mi-img="bride|groom" (ảnh đại diện trên thông báo), data-mi-g="N"
  // (ảnh thứ N của album, album rỗng thì ảnh bìa).
  function _fillPhotos(w) {
    const fps = w.image_focal_points || {};
    document.querySelectorAll("img[data-mi-img]").forEach((el) => {
      const k = el.dataset.miImg;
      el.src = getImageUrl(w[`${k}_image_url`]);
      el.style.objectPosition = cxFocal(fps[`${k}_image_url`]);
    });
    // Tắt Album thì ảnh trong tin nhắn lấy ảnh bìa, không lộ ảnh album.
    const gal = (cxEnabled(w.enable_photos) && w.gallery_images) || [];
    document.querySelectorAll("img[data-mi-g]").forEach((el) => {
      const file = gal.length ? gal[+el.dataset.miG % gal.length] : w.cover_image_url;
      el.src = getImageUrl(file);
      el.style.objectPosition = cxFocal(gal.length ? fps.gallery_images?.[file] : fps.cover_image_url);
    });
  }

  // ============= MÀN KHOÁ: vuốt lên (hoặc chạm) để mở =============

  function _bindUnlock() {
    const cover = document.getElementById("cover-screen");
    if (!cover || cover._miBound) return;
    cover._miBound = true;
    let y0 = null;
    let t0 = 0;
    let dy = 0;
    const open = () => {
      y0 = null;
      window.openInvitation();
    };
    cover.addEventListener("pointerdown", (e) => {
      y0 = e.clientY;
      t0 = Date.now();
      dy = 0;
      cover.style.transition = "none";
    });
    cover.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = Math.min(0, e.clientY - y0);
      cover.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (y0 === null) return;
      const tap = Math.abs(dy) < 8 && Date.now() - t0 < 400;
      if (dy < -60 || tap) return open();
      y0 = null;
      cover.style.transition = "transform .35s cubic-bezier(.2,.9,.3,1)";
      cover.style.transform = "";
    };
    cover.addEventListener("pointerup", end);
    cover.addEventListener("pointercancel", end);
  }

  // ============= TIN NHẮN HIỆN LẦN LƯỢT =============
  // Tin vào khung nhìn thì xếp hàng hiện từng tin; tin có data-typing hiện "đang nhập…"
  // trước. Tin đứng TRƯỚC một tin vừa hiện mà đã trôi lên trên màn thì bật ngay (vuốt
  // mạnh có tin lướt qua mà observer không kịp bắt). Khung của trang Thiết lập bỏ hiệu ứng.

  function _bindThread() {
    const msgs = Array.from(document.querySelectorAll("#main-card .mi-msg"));
    const q = new URLSearchParams(location.search);
    const still = REDUCE || (isPreviewMode() && (q.get("source") === "live" || q.get("edit") === "1"));
    if (still) {
      msgs.forEach((m) => m.classList.add("in"));
      return;
    }
    let queue = Promise.resolve();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const show = (m) => {
      if (m._miQ) return;
      m._miQ = true;
      io.unobserve(m);
      queue = queue.then(() => {
        // Tin trong mục đang ẩn (tắt album, RSVP ở link chung…) không được giữ nhịp chờ.
        if (!m.getClientRects().length) {
          m.classList.add("in");
          return;
        }
        if (!m.hasAttribute("data-typing")) {
          m.classList.add("in");
          return wait(280);
        }
        m.classList.add("typing");
        return wait(850).then(() => {
          m.classList.add("in");
          return wait(200);
        });
      });
    };
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const k = msgs.indexOf(e.target);
          for (let i = 0; i < k; i++) {
            const m = msgs[i];
            if (m._miQ) continue;
            if (m.getBoundingClientRect().bottom < 0) {
              m._miQ = true;
              io.unobserve(m);
              m.classList.add("in");
            } else show(m);
          }
          show(e.target);
        }),
      { threshold: 0.3 },
    );
    msgs.forEach((m) => io.observe(m));
  }

  // ============= THẺ SỰ KIỆN =============

  // "Tư gia nhà trai — Số 18 …" → phần trước gạch ngang là tên nơi; không có thì cả chuỗi.
  function _place(loc) {
    return String(loc || "").split(/\s+[—–-]\s+/)[0].trim();
  }

  // Nút "Thêm vào lịch": mở Google Calendar điền sẵn lễ (2 tiếng, giờ Việt Nam).
  function _calendarLink(w, name, time, loc) {
    const a = document.getElementById("mi-ev-add");
    if (!a) return;
    const d = _date(w.ceremony_date);
    if (!d) {
      a.classList.add("hidden");
      return;
    }
    const [h, m] = String(time || "08:00").split(":").map((x) => +x || 0);
    const stamp = (hh) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(m)}00`;
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: `${name} ${w.bride_name || ""} & ${w.groom_name || ""}`.trim(),
      dates: `${stamp(h)}/${stamp(Math.min(23, h + 2))}`,
      ctz: "Asia/Ho_Chi_Minh",
      location: loc || "",
    });
    a.href = `https://calendar.google.com/calendar/render?${q}`;
    a.classList.remove("hidden");
  }

  // Nút "Mở chỉ đường": đổi link xem bản đồ (?query=) thành trang chỉ đường. Uỷ quyền
  // trên cả mục nên bản đồ thứ hai (renderVenueMaps nhân ra) cũng có.
  function _bindDirections() {
    const sec = document.getElementById("section-map");
    if (!sec || sec._miDir) return;
    sec._miDir = true;
    sec.addEventListener("click", (e) => {
      const link = e.target.closest("[data-mi-dir]")?.closest("a");
      if (!link) return;
      e.preventDefault();
      const q = new URL(link.href, location.href).searchParams.get("query");
      const url = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : link.href;
      window.open(url, "_blank", "noopener");
    });
  }

  // ============= QUÀ MỪNG: chạm đầu thẻ là mở rộng ra mã QR =============

  function _bindGift() {
    const pay = document.getElementById("mi-pay");
    if (!pay || pay._miBound) return;
    pay._miBound = true;
    pay.addEventListener("click", (e) => {
      const top = e.target.closest("[data-mi-pay]");
      if (!top) return;
      top.setAttribute("aria-expanded", String(pay.classList.toggle("is-open")));
    });
  }

  // ============= LỜI CHÚC: cửa sổ kéo xuống từ thanh tiêu đề =============
  // wishes-helper dựng #cx-wish-sec vào thân thiệp → hễ nó xuất hiện trong .mi-chat là
  // chuyển sang #mi-wish-slot. Thanh đáy chỉ hiện khi có mục (tắt lời chúc, hoặc link chung
  // chưa ai chúc thì helper không dựng): tầng tóm tắt khi đã có lời chúc, tầng ô nhắn khi
  // khách gửi được (có ô gõ). Đóng: nút ✕, chạm vùng mờ, Esc, vuốt tay nắm đáy lên.

  // Danh sách lời chúc của wishes-helper (mới nhất đứng đầu) — `let` cấp cao nhất của
  // script đó, đọc được theo tên. Không đọc từ DOM: dạng chat cuộn vòng nên tên đầu đổi mãi.
  function _wishItems() {
    return typeof _cxWishItems !== "undefined" && Array.isArray(_cxWishItems) ? _cxWishItems : [];
  }

  // Tầng tóm tắt: tối đa 3 chấm chữ cái đầu tên người chúc gần nhất +
  // "Minh Anh và 11 người khác đã gửi lời chúc". Có lời chúc mới thì chấm đầu nảy lên.
  let _peekKey = "";
  function _peek(n) {
    const names = [];
    _wishItems().forEach((w) => {
      const t = String(w?.name || "").trim() || "Khách mời";
      if (names.length < 3 && !names.includes(t)) names.push(t);
    });
    const first = names[0] || "Khách mời";
    setText("mi-wish-peek-text", n > 1 ? `${first} và ${n - 1} người khác đã gửi lời chúc` : `${first} đã gửi lời chúc`);
    const key = names.slice(0, 3).join("|");
    if (key === _peekKey) return;
    const bump = _peekKey && _peekKey.split("|")[0] !== names[0];
    _peekKey = key;
    const faces = document.getElementById("mi-wish-faces");
    if (!faces) return;
    faces.textContent = "";
    (names.length ? names.slice(0, 3) : [first]).forEach((nm, i) => {
      const f = document.createElement("span");
      f.className = "mi-face" + (i === 0 && bump ? " is-new" : "");
      f.textContent = (Array.from(nm.split(/\s+/).pop() || "")[0] || "♡").toUpperCase();
      faces.appendChild(f);
    });
  }

  function _bindWishPanel() {
    const chat = document.querySelector("#main-card .mi-chat");
    const slot = document.getElementById("mi-wish-slot");
    const panel = document.getElementById("mi-wishes");
    if (!chat || !slot || !panel || panel._miBound) return;
    panel._miBound = true;

    const sync = () => {
      const sec = document.getElementById("cx-wish-sec");
      if (sec && sec.parentElement !== slot) slot.appendChild(sec);
      const n = _wishItems().length;
      const canWrite = !!sec?.querySelector("#cx-wdock-text");
      cxToggle("mi-input", !!sec && (n > 0 || canWrite));
      cxToggle("mi-wish-write", canWrite);
      cxToggle("mi-wish-peek", !!sec && n > 0);
      if (sec && n > 0) _peek(n);
      if (!sec) close();
    };
    const open = (write) => {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      if (write) setTimeout(() => document.getElementById("cx-wdock-text")?.focus({ preventScroll: true }), REDUCE ? 0 : 320);
    };
    const close = () => {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      // Mở lần sau luôn về nửa màn — đợi trượt lên xong mới thu, kẻo thấy cửa sổ co giật.
      setTimeout(() => panel.querySelector(".mi-wpanel-sheet")?.classList.remove("is-full"), 550);
    };

    new MutationObserver(sync).observe(chat, { childList: true });
    new MutationObserver(sync).observe(slot, { childList: true, subtree: true, characterData: true });
    sync();

    const now = new Date();
    setText("mi-wpanel-date", `${WD[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`);

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mi-wishopen]");
      if (btn) open(btn.hasAttribute("data-mi-wishwrite"));
      if (e.target.closest("[data-mi-wishclose]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });

    // Tay nắm đáy: kéo xuống thì cửa sổ dài theo ngón tay tới trọn màn (.is-full), kéo lên
    // thì co về nửa màn, co quá nửa màn là đóng. Chạm (không kéo) = đổi qua lại hai nấc.
    const grip = panel.querySelector("[data-mi-wishgrip]");
    const sheet = panel.querySelector(".mi-wpanel-sheet");
    let y0 = null;
    let h0 = 0;
    let dy = 0;
    const halfH = () => panel.clientHeight / 2;
    grip?.addEventListener("pointerdown", (e) => {
      y0 = e.clientY;
      h0 = sheet.offsetHeight;
      dy = 0;
      grip.setPointerCapture?.(e.pointerId);
      sheet.style.transition = "none";
    });
    grip?.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = e.clientY - y0;
      const h = h0 + dy;
      const half = halfH();
      // Dài ra trong khoảng nửa màn → trọn màn; ngắn hơn nửa màn thì cả cửa sổ trượt lên.
      sheet.style.height = `${Math.min(panel.clientHeight, Math.max(half, h))}px`;
      sheet.style.transform = h < half ? `translateY(${h - half}px)` : "";
    });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      const h = h0 + dy;
      const full = sheet.classList.contains("is-full");
      sheet.style.transition = "";
      sheet.style.height = "";
      sheet.style.transform = "";
      if (Math.abs(dy) < 6) return sheet.classList.toggle("is-full");
      if (h < halfH() - 60) return close();
      sheet.classList.toggle("is-full", full ? dy > -80 : dy > 60);
    };
    grip?.addEventListener("pointerup", end);
    grip?.addEventListener("pointercancel", end);
  }

  // ============= ALBUM: lưới 6 ô (ô cuối ghi +N), chạm mở trình xem ở đúng ảnh =============

  function renderGallery(images, focalPoints) {
    const grid = document.getElementById("gallery-grid");
    if (!grid) return;
    const urls = images?.length
      ? images.map(getImageUrl)
      : Array(6)
          .fill(null)
          .map(() => createPlaceholderSVG("Chưa có ảnh"));
    const fp = (i) => cxFocal(focalPoints?.[images?.[i]]);

    lightboxImages.length = 0;
    lightboxImages.push(...urls);

    const shown = urls.slice(0, 6);
    const more = urls.length - shown.length;
    grid.style.setProperty("--n", shown.length <= 2 ? shown.length : shown.length === 4 ? 2 : 3);
    grid.innerHTML = shown
      .map(
        (u, i) =>
          `<button type="button" class="mi-at" data-mi-lb="${i}" aria-label="Xem ảnh ${i + 1}">
            <img src="${cxImgSrc(u)}" alt="" style="object-position:${fp(i)}">
            ${more > 0 && i === shown.length - 1 ? `<em>+${more}</em>` : ""}
          </button>`,
      )
      .join("");
    setText("mi-album-count", `${urls.length} ảnh`);

    _buildViewer(urls, fp);
    grid.onclick = (e) => {
      const t = e.target.closest("[data-mi-lb]");
      if (t) _viewer?.open(+t.dataset.miLb);
    };
  }

  let _viewer = null;

  // Trình xem album: dải ảnh cuộn ngang có snap, bộ đếm + dải ảnh nhỏ đi theo ảnh đang xem.
  function _buildViewer(urls, fp) {
    const lb = document.getElementById("mi-lb");
    const track = document.getElementById("mi-lbtrack");
    const thumbs = document.getElementById("mi-lbthumbs");
    const n = document.getElementById("mi-lbn");
    if (!lb || !track || !thumbs) return;
    track.innerHTML = urls.map((u, i) => `<img src="${cxImgSrc(u)}" alt="Ảnh cưới ${i + 1}" loading="lazy">`).join("");
    thumbs.innerHTML = urls
      .map(
        (u, i) =>
          `<button type="button" data-mi-lbgo="${i}" aria-label="Ảnh ${i + 1}"><img src="${cxImgSrc(u)}" alt="" loading="lazy" style="object-position:${fp(i)}"></button>`,
      )
      .join("");

    const cur = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
    const go = (i, smooth) => {
      i = Math.max(0, Math.min(urls.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !REDUCE ? "smooth" : "auto" });
    };
    const sync = () => {
      const i = cur();
      const t = thumbs.children[i];
      if (n) n.textContent = `${i + 1} / ${urls.length}`;
      Array.from(thumbs.children).forEach((b, k) => b.classList.toggle("on", k === i));
      // Dải ảnh nhỏ là khung cuộn lồng nên tự đặt scrollLeft, không dùng scrollIntoView.
      if (t) thumbs.scrollLeft = t.offsetLeft - thumbs.clientWidth / 2 + t.offsetWidth / 2;
    };
    const close = () => {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
    };
    _viewer = {
      open(i) {
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
        go(i, false);
        sync();
      },
    };

    if (lb._miBound) return;
    lb._miBound = true;
    track.addEventListener("scroll", sync, { passive: true });
    lb.addEventListener("click", (e) => {
      if (e.target.closest("[data-mi-lbclose]")) return close();
      const st = e.target.closest("[data-mi-lbstep]");
      if (st) return go(cur() + +st.dataset.miLbstep, true);
      const g = e.target.closest("[data-mi-lbgo]");
      if (g) go(+g.dataset.miLbgo, true);
    });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") go(cur() + (e.key === "ArrowRight" ? 1 : -1), true);
    });
  }

  function _date(s) {
    const d = s ? new Date(s + "T00:00:00") : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }

  // "2027-01-09" → "09.01.2027"; rỗng nếu không phân giải được.
  function _fmtDMY(s) {
    const d = _date(s);
    return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "";
  }
})();
