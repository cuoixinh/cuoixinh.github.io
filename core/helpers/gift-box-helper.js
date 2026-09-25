// Hộp mừng cưới: che phần mã QR bằng một hộp quà, khách chạm mới mở. Chế độ lưu
// ở theme_setting.gift_box — bỏ trống = giữ nguyên mẫu, "none" = bỏ hộp (hiện
// thẳng QR), còn lại là id một mẫu trong CX_GIFT_BOXES. Bảng chọn ở
// invitation-setup/js/05-theme-panel.js; kiểu dáng ở styles/_common.css (.cx-gb*).
// Nạp SAU core/x-button.js (hộp là một <x-button>).

(function () {
  // Thêm mẫu hộp: bỏ ảnh (nền trong suốt) vào assets/gifts/ rồi thêm một mục ở
  // đây, đặt cạnh các mẫu cùng `group` — id là khoá lưu trong theme_setting nên
  // ĐỪNG đổi id đã phát hành. `hint` (tuỳ chọn) là lời mời chạm dưới hộp. Gỡ một mẫu
  // đã phát hành thì đặt `hidden: true` thay vì xoá, thiệp đang dùng nó mới không mất hộp.
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
      // Đã gỡ khỏi bảng chọn nhưng thiệp đã chọn vẫn hiện; ảnh còn là hộp riêng của noir-elegance.
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
  ];

  // Nhóm của bảng chọn, theo đúng thứ tự hiện; mỗi mẫu khai `group` là một id ở đây.
  const GROUPS = [
    { id: "lixi", name: "Lì xì" },
    { id: "phongbi", name: "Phong bì" },
    { id: "hop", name: "Hộp quà" },
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

  // Hộp/phong bao SẴN CÓ của mẫu mở bằng chính cú bấm mà mẫu chờ — đoán class
  // trạng thái của từng mẫu là hỏng ngay khi mẫu đổi hiệu ứng.
  function opener(native) {
    if (!native) return null;
    if (native.tagName === "BUTTON" || native.hasAttribute("onclick"))
      return native;
    return native.querySelector('button, [onclick], [role="button"]');
  }

  // Đã bấm hộp gốc của mẫu chưa? Mẫu mở hộp MỘT CHIỀU nên đây là thứ duy nhất
  // không tự trả về nguyên trạng được — trang Thiết lập phải nạp lại khung xem
  // trước (xem listener ở cuối file).
  let nativeOpened = false;

  function openNative(native) {
    const btn = opener(native);
    if (!btn) return false;
    btn.click();
    nativeOpened = true;
    return true;
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
  }

  function reduced() {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  // Mở hộp: hộp bay lên rồi biến mất, sau đó mới tới phần QR. Một chiều — mở rồi
  // thôi, khách đang định chuyển khoản thì đừng bắt bấm thêm lần nữa.
  function open(wrap, btn, parts, native) {
    if (wrap.dataset.open === "1") return;
    wrap.dataset.open = "1";
    wrap.classList.add("is-open");
    btn?.setAttribute("aria-expanded", "true");
    setTimeout(
      () => {
        wrap.style.display = "none";
        parts.forEach(unveil);
        // Mẫu có hộp riêng thì để hiệu ứng bung của nó chạy; mẫu không có thì
        // dùng hiệu ứng chung, không phần QR sẽ hiện đánh bụp một cái.
        if (!openNative(native))
          parts.forEach((el) => el.classList.add("cx-gb-in"));
      },
      reduced() ? 0 : OPEN_MS,
    );
  }

  function mount(sec, item, parts, native) {
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
    btn?.addEventListener("click", () => open(wrap, btn, parts, native));
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

    const mode =
      setting && typeof setting === "object" ? String(setting.gift_box || "") : "";
    if (!mode) return; // "Mặc định" — mẫu tự lo phần này

    const native = sec.querySelector('[data-cx-gift="box"]');
    if (mode === "none") {
      // Bỏ hộp: mở sẵn hộp của mẫu (nếu có) rồi giấu nó đi, còn lại mã QR.
      openNative(native);
      veil(native);
      return;
    }

    const item = boxOf(mode);
    if (!item) return; // id lạ (mẫu đã gỡ khỏi danh mục) → về mặc định
    veil(native);
    const parts = qrParts(sec);
    parts.forEach(veil);
    mount(sec, item, parts, native);
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
    // Về "Mặc định" sau khi đã bấm hộp gốc của mẫu là thứ duy nhất không lùi
    // được — nhờ trang cha nạp lại. Không tự reload: file này chạy cả trên thiệp
    // công khai, tự điều hướng là việc của trang, không phải của helper.
    if (!d.value && nativeOpened)
      window.parent.postMessage({ type: "cx-gift-reload" }, "*");
    else applyGiftBox({ gift_box: d.value });
  });
})();
