// Hộp mừng cưới: che phần mã QR bằng một hộp quà trong CX_GIFT_BOXES, khách chạm
// mới mở. Chế độ lưu ở theme_setting.gift_box — bỏ trống = hộp mẫu khai ở
// CX_THEME.giftBox, "none" = bỏ hộp (hiện thẳng QR). Mẫu KHÔNG tự vẽ hộp. Bảng chọn
// ở invitation-setup/js/05-theme-panel.js; kiểu dáng ở styles/_common.css (.cx-gb*).
// Nạp SAU core/x-button.js (hộp là một <x-button>).

(function () {
  // Thêm mẫu hộp: bỏ ảnh (nền trong suốt) vào assets/gifts/ rồi thêm một mục ở
  // đây, đặt cạnh các mẫu cùng `group` — id là khoá lưu trong theme_setting nên
  // ĐỪNG đổi id đã phát hành. `hint` (tuỳ chọn) là lời mời chạm dưới hộp. Gỡ một mẫu
  // đã phát hành thì đặt `hidden: true` thay vì xoá, thiệp đang dùng nó mới không mất hộp.
  // `kind: "row"` = hàng chạm dựng bằng markup (màu theo token của thiệp) thay cho ảnh
  // hộp: hàng ĐỨNG YÊN, chạm là mở/đóng phần QR bên dưới (không một chiều như hộp ảnh).
  // `src` khi đó chỉ là ảnh minh hoạ ở bảng chọn, `art: "couple"` lấy ảnh bìa thiệp
  // làm ô ảnh nhỏ đầu hàng.
  const BOXES = [
    {
      id: "lixi_do_hy",
      group: "lixi",
      name: "Lì xì đỏ Song Hỷ",
      desc: "Phong bao đỏ, chữ Hỷ ánh vàng",
      src: "/assets/gifts/lixi_do_hy.webp",
    },
    {
      id: "lixi_do_mungcuoi",
      group: "lixi",
      name: "Lì xì Mừng Cưới",
      desc: "Phong bao đỏ, chữ Mừng Cưới nhũ vàng",
      src: "/assets/gifts/lixi_do_mungcuoi.webp",
    },
    {
      id: "lixi_vang_do",
      group: "lixi",
      name: "Lì xì vàng kim",
      desc: "Phong bao vàng kim, huy hiệu Hỷ đỏ",
      src: "/assets/gifts/lixi_vang_do.webp",
    },
    {
      id: "lixi_hong_mai",
      group: "lixi",
      name: "Lì xì hồng hoa mai",
      desc: "Phong bao hồng phấn, cành mai vàng",
      src: "/assets/gifts/lixi_hong_mai.webp",
    },
    {
      id: "lixi_cap_doi",
      group: "lixi",
      name: "Cặp lì xì",
      desc: "Hai phong bao đỏ – hồng xếp đôi",
      src: "/assets/gifts/lixi_cap_doi.webp",
    },
    {
      id: "lixi_den_long",
      group: "lixi",
      name: "Lì xì lồng đèn",
      desc: "Lồng đèn đỏ, chữ Hỷ, tua rua",
      src: "/assets/gifts/lixi_den_long.webp",
    },
    {
      id: "lixi_tui_gam",
      group: "lixi",
      name: "Túi gấm",
      desc: "Túi gấm đỏ hoa văn, dây rút vàng",
      src: "/assets/gifts/lixi_tui_gam.webp",
    },
    {
      id: "lixi_quat",
      group: "lixi",
      name: "Lì xì hình quạt",
      desc: "Quạt xoè đỏ – vàng, chữ Hỷ, hoa mai",
      src: "/assets/gifts/lixi_quat.webp",
    },
    {
      id: "phongbi_do_hy",
      group: "phongbi",
      name: "Phong bì đỏ Song Hỷ",
      desc: "Phong bì đỏ, dấu sáp vàng chữ Hỷ",
      src: "/assets/gifts/phongbi_do_hy.webp",
    },
    {
      id: "phongbi_kem_sap",
      group: "phongbi",
      name: "Phong bì sáp đỏ",
      desc: "Phong bì kem, dấu sáp đỏ hình tim",
      src: "/assets/gifts/phongbi_kem_sap.webp",
    },
    {
      id: "phongbi_trang_vang",
      group: "phongbi",
      name: "Phong bì viền vàng",
      desc: "Phong bì trắng, viền nhũ vàng, chữ Mừng Cưới",
      src: "/assets/gifts/phongbi_trang_vang.webp",
    },
    {
      id: "phongbi_hong_no",
      group: "phongbi",
      name: "Phong bì nơ hồng",
      desc: "Phong bì hồng phấn thắt nơ lụa",
      src: "/assets/gifts/phongbi_hong_no.webp",
    },
    {
      id: "phongbi_xanh_la",
      group: "phongbi",
      name: "Phong bì lá xanh",
      desc: "Phong bì xanh xô thơm, cành bạch đàn",
      src: "/assets/gifts/phongbi_xanh_la.webp",
    },
    {
      id: "phongbi_kraft",
      group: "phongbi",
      name: "Thư tay giấy kraft",
      desc: "Giấy kraft, tem thư, dây gai buộc",
      src: "/assets/gifts/phongbi_kraft.webp",
    },
    {
      id: "phongbi_airmail",
      group: "phongbi",
      name: "Thư Air Mail",
      desc: "Viền sọc đỏ – xanh, tem máy bay",
      src: "/assets/gifts/phongbi_airmail.webp",
    },
    {
      id: "phongbi_origami_tim",
      group: "phongbi",
      name: "Origami trái tim",
      desc: "Phong bì gấp hình trái tim, dấu sáp",
      src: "/assets/gifts/phongbi_origami_tim.webp",
    },
    {
      id: "phongbi_ve_may_bay",
      group: "phongbi",
      name: "Vé máy bay hạnh phúc",
      desc: "Vé bay từ Độc Thân đến Hạnh Phúc",
      src: "/assets/gifts/phongbi_ve_may_bay.webp",
    },
    {
      // Đã gỡ khỏi bảng chọn nhưng thiệp đã chọn vẫn hiện; còn là hộp mặc định của noir-elegance.
      id: "minimalism_brown",
      hidden: true,
      group: "hop",
      name: "Tối giản nâu",
      desc: "Hộp giấy kem, nơ lụa",
      src: "/assets/gifts/minimalism_brown.webp",
    },
    {
      id: "floral_pink",
      group: "hop",
      name: "Hồng phấn",
      desc: "Hộp hồng phấn, nơ lụa, hoa hồng",
      src: "/assets/gifts/floral_pink.webp",
    },
    {
      id: "mungcuoi_ivory",
      group: "hop",
      name: "Mừng cưới kem",
      desc: "Hộp kem viền vàng, chữ Mừng Cưới",
      src: "/assets/gifts/mungcuoi_ivory.webp",
    },
    {
      id: "hop_do_vang",
      group: "hop",
      name: "Hộp đỏ nơ vàng",
      desc: "Hộp đỏ son, nơ lụa vàng, chữ Hỷ",
      src: "/assets/gifts/hop_do_vang.webp",
    },
    {
      id: "hop_trang_hong",
      group: "hop",
      name: "Hộp trắng nơ hồng",
      desc: "Hộp trắng, nơ hồng, hoa nhỏ",
      src: "/assets/gifts/hop_trang_hong.webp",
    },
    {
      id: "hop_navy_vang",
      group: "hop",
      name: "Xanh đêm ánh kim",
      desc: "Hộp xanh đêm, nơ và viền vàng",
      src: "/assets/gifts/hop_navy_vang.webp",
    },
    {
      id: "hop_trai_tim",
      group: "hop",
      name: "Hộp trái tim",
      desc: "Hộp hình trái tim đỏ, nơ hồng",
      src: "/assets/gifts/hop_trai_tim.webp",
    },
    {
      id: "the_qua_mung",
      group: "the",
      kind: "row",
      art: "couple",
      name: "Hàng gửi quà",
      desc: "Một hàng gọn kèm ảnh cưới, chạm để mở mã QR",
      src: "/assets/gifts/the_qua_mung.svg",
      title: "Gửi quà mừng",
      hint: "Chạm để xem mã QR",
    },
  ];

  // Nhóm của bảng chọn, theo đúng thứ tự hiện; mỗi mẫu khai `group` là một id ở đây.
  const GROUPS = [
    { id: "lixi", name: "Lì xì" },
    { id: "phongbi", name: "Phong bì" },
    { id: "hop", name: "Hộp quà" },
    { id: "the", name: "Thẻ chạm" },
  ];

  const HINT = "Chạm để mở";

  // Khớp animation .cx-gb.is-open trong styles/_common.css: hộp bay lên xong mới
  // tới lượt phần QR hiện ra.
  const OPEN_MS = 420;

  // Mốc dò khối chứa QR khi mẫu không đánh dấu data-cx-gift="qr".
  const ANCHORS = [
    "#groom-qr-img",
    "#bride-qr-img",
    "#groom-bank-number",
    "#bride-bank-number",
  ];

  function boxOf(id) {
    return BOXES.find((b) => b.id === id) || null;
  }

  // Hộp mặc định của mẫu thiệp: id trong BOXES, "none" hoặc bỏ trống = không hộp.
  function themeDefault() {
    return String((window.CX_THEME && window.CX_THEME.giftBox) || "");
  }

  // Khối chứa QR: mẫu tự đánh dấu là chắc nhất; không có thì dò ngược từ ảnh QR
  // lên tới con TRỰC TIẾP của #section-gift (tiêu đề và lời dẫn ở lại).
  function qrParts(sec) {
    const marked = Array.from(sec.querySelectorAll('[data-cx-gift="qr"]'));
    if (marked.length) return marked;
    const out = [];
    ANCHORS.forEach((sel) => {
      let node = sec.querySelector(sel);
      while (node && node.parentElement && node.parentElement !== sec)
        node = node.parentElement;
      if (node && node.parentElement === sec && !out.includes(node))
        out.push(node);
    });
    return out;
  }

  // Giấu tạm phần của mẫu: nhớ lại display cũ để trả về nguyên trạng lúc mở hộp.
  function veil(el) {
    if (!el || el.dataset.cxGbVeil) return;
    el.dataset.cxGbVeil = el.style.display || "-";
    el.style.display = "none";
  }

  function unveil(el) {
    if (!el || !el.dataset.cxGbVeil) return;
    const prev = el.dataset.cxGbVeil;
    el.style.display = prev === "-" ? "" : prev;
    delete el.dataset.cxGbVeil;
  }

  // Gỡ dấu vết lần áp trước — cần khi trang Thiết lập áp lại mà không nạp lại
  // khung xem trước.
  function clear(sec) {
    sec.querySelectorAll('[data-cx-gift="shared"]').forEach((n) => n.remove());
    sec.querySelectorAll("[data-cx-gb-veil]").forEach(unveil);
    sec.classList.remove("cx-gb-flow");
    Array.from(sec.children).forEach((k) => {
      if (!k.dataset.cxGbOrd) return;
      k.style.order = k.dataset.cxGbOrd === "-" ? "" : k.dataset.cxGbOrd;
      delete k.dataset.cxGbOrd;
    });
  }

  function reduced() {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  // Mở hộp: hộp bay lên rồi biến mất, sau đó mới tới phần QR. Một chiều — mở rồi
  // thôi, khách đang định chuyển khoản thì đừng bắt bấm thêm lần nữa.
  function open(wrap, btn, parts) {
    if (wrap.dataset.open === "1") return;
    wrap.dataset.open = "1";
    wrap.classList.add("is-open");
    btn?.setAttribute("aria-expanded", "true");
    setTimeout(
      () => {
        wrap.style.display = "none";
        parts.forEach(unveil);
        parts.forEach((el) => el.classList.add("cx-gb-in"));
      },
      reduced() ? 0 : OPEN_MS,
    );
  }

  // Ảnh nhỏ đầu hàng chạm: ảnh bìa thiệp đã nhận src (renderWedding chạy trước), còn
  // ảnh giữ chỗ 1x1 thì dùng icon hộp quà.
  const GIFT_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';

  function coupleArt() {
    for (const sel of ["#main-photo", "#cover-bg-img"]) {
      const img = document.querySelector(sel);
      const src = img?.currentSrc || img?.getAttribute("src") || "";
      if (src && !src.startsWith("data:image/gif")) return { src, pos: img.style.objectPosition || "" };
    }
    return null;
  }

  // Hàng chạm phải đứng NGAY TRÊN phần QR, nhưng chèn vào giữa DOM là lệch :nth-child
  // của chữ khách đã sửa trong mục (applyTextOverrides chạy TRƯỚC helper này). Nên hàng
  // vẫn ở cuối mục và được đẩy lên bằng `order`: các con đứng trước phần QR (tiêu đề…)
  // nhận -2, hàng -1, còn lại giữ 0. Mục không phải flex/grid thì gắn .cx-gb-flow
  // (flex cột) để `order` có tác dụng.
  function placeRow(sec, wrap, parts) {
    const kids = Array.from(sec.children);
    const top = (el) => {
      while (el && el.parentElement !== sec) el = el.parentElement;
      return el;
    };
    const idx = parts.map((p) => kids.indexOf(top(p))).filter((i) => i >= 0);
    if (!idx.length) return;
    const first = Math.min(...idx);
    if (!/flex|grid/.test(getComputedStyle(sec).display)) sec.classList.add("cx-gb-flow");
    kids.slice(0, first).forEach((k) => {
      k.dataset.cxGbOrd = k.style.order || "-";
      k.style.order = "-2";
    });
    wrap.style.order = "-1";
  }

  // Mở/đóng phần QR dưới hàng chạm; hàng giữ nguyên để khách còn thu lại được.
  function toggleRow(wrap, btn, parts) {
    const on = !wrap.classList.contains("is-on");
    wrap.classList.toggle("is-on", on);
    btn?.setAttribute("aria-expanded", String(on));
    parts.forEach((el) => {
      if (on) {
        unveil(el);
        el.classList.remove("cx-gb-in");
        void el.offsetWidth; // gắn lại để hiệu ứng hiện chạy lại mỗi lần mở
        el.classList.add("cx-gb-in");
      } else {
        el.classList.remove("cx-gb-in");
        veil(el);
      }
    });
  }

  // Hàng chạm: [ảnh/icon] Gửi quà mừng · lời mời chạm [mũi tên]. Lớp vẽ nằm ở thẻ
  // <span> bên trong vì <x-button> mang sẵn utility pill (bo tròn hết) thắng CSS thường.
  function mountRow(sec, item, parts) {
    const wrap = document.createElement("div");
    wrap.className = "cx-gb cx-gb-is-row cx-no-edit";
    wrap.setAttribute("data-cx-gift", "shared");
    wrap.innerHTML =
      '<x-button variant="bare" class="cx-gb-rowbtn" aria-expanded="false">' +
      '<span class="cx-gb-row"><span class="cx-gb-art"></span>' +
      '<span class="cx-gb-txt"><b></b><small></small></span>' +
      '<svg class="cx-gb-chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
      "</span></x-button>";
    sec.appendChild(wrap);

    const btn = wrap.querySelector("button");
    const art = wrap.querySelector(".cx-gb-art");
    const pic = item.art === "couple" ? coupleArt() : null;
    if (pic) {
      const img = document.createElement("img");
      img.src = pic.src;
      img.alt = "";
      if (pic.pos) img.style.objectPosition = pic.pos;
      art.appendChild(img);
    } else {
      art.classList.add("is-icon");
      art.innerHTML = GIFT_ICON;
    }
    wrap.querySelector(".cx-gb-txt b").textContent = item.title || item.name;
    wrap.querySelector(".cx-gb-txt small").textContent = item.hint || HINT;
    btn?.setAttribute("aria-label", (item.title || item.name) + ": mở hoặc thu mã QR");
    btn?.addEventListener("click", () => toggleRow(wrap, btn, parts));
    placeRow(sec, wrap, parts);
  }

  function mount(sec, item, parts) {
    if (item.kind === "row") return mountRow(sec, item, parts);
    const wrap = document.createElement("div");
    wrap.className = "cx-gb cx-no-edit";
    wrap.setAttribute("data-cx-gift", "shared");
    wrap.innerHTML =
      '<x-button variant="bare" class="cx-gb-btn" aria-label="Mở hộp mừng cưới" aria-expanded="false">' +
      '<span class="cx-gb-shadow" aria-hidden="true"></span>' +
      "</x-button>" +
      '<div class="cx-gb-hint cx-t"></div>';
    // Chèn CUỐI mục: các con cũ giữ nguyên thứ tự nên selector :nth-child đã lưu
    // trong text_overrides không lệch. Chèn xong <x-button> mới hoá <button>.
    sec.appendChild(wrap);

    const btn = wrap.querySelector("button");
    const img = document.createElement("img");
    img.className = "cx-gb-img";
    img.alt = "Hộp quà mừng cưới";
    img.src = item.src;
    btn?.appendChild(img);
    wrap.querySelector(".cx-gb-hint").textContent = item.hint || HINT;
    btn?.addEventListener("click", () => open(wrap, btn, parts));
  }

  /** Áp chế độ hộp mừng cưới lên trang thiệp. Gọi SAU renderWedding. */
  function applyGiftBox(setting) {
    if (typeof setting === "string") {
      try {
        setting = JSON.parse(setting);
      } catch (e) {
        setting = null;
      }
    }
    const sec = document.getElementById("section-gift");
    if (!sec) return;
    clear(sec);

    const saved =
      setting && typeof setting === "object" ? String(setting.gift_box || "") : "";
    // id lạ (mẫu hộp đã gỡ khỏi danh mục) cũng rơi về hộp của mẫu thiệp.
    const item = saved === "none" ? null : boxOf(saved) || boxOf(themeDefault());
    if (!item) return;
    const parts = qrParts(sec);
    parts.forEach(veil);
    mount(sec, item, parts);
  }

  window.CX_GIFT_BOXES = BOXES;
  window.CX_GIFT_GROUPS = GROUPS;
  window.cxGiftBox = boxOf;
  window.applyGiftBox = applyGiftBox;

  // Trong khung xem trước của trang Thiết lập: đổi chế độ áp NGAY, không nạp lại
  // cả khung (bảng chọn bên trang cha phải đứng yên để còn thử mẫu khác).
  if (window.top === window) return;
  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent) return;
    const d = ev.data;
    if (!d || d.type !== "cx-gift-box") return;
    applyGiftBox({ gift_box: d.value });
  });
})();
